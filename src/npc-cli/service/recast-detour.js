import * as THREE from "three";
import { NavMesh, RecastBuildContext, TileCache, TileCacheMeshProcess, freeCompactHeightfield, freeHeightfield, TileCacheData, freeHeightfieldLayerSet, VerticesArray, TrianglesArray, ChunkIdsArray, TriangleAreasArray, createRcConfig, calcGridSize, DetourTileCacheParams, Raw, vec3, NavMeshParams, RecastChunkyTriMesh, cloneRcConfig, allocHeightfield, createHeightfield, markWalkableTriangles, rasterizeTriangles, filterLowHangingWalkableObstacles, filterLedgeSpans, filterWalkableLowHeightSpans, allocCompactHeightfield, buildCompactHeightfield, erodeWalkableArea, allocHeightfieldLayerSet, buildHeightfieldLayers, getHeightfieldLayerHeights, getHeightfieldLayerAreas, getHeightfieldLayerCons, buildTileCacheLayer,  markConvexPolyArea } from "@recast-navigation/core";
import { getPositionsAndIndices } from "@recast-navigation/three";
import { createDefaultTileCacheMeshProcess, dtIlog2, dtNextPow2, generateTileCache, getBoundingBox, tileCacheGeneratorConfigDefaults } from "@recast-navigation/generators";

/**
 * @param {import("@recast-navigation/core").Crowd} crowd
 * @param {import("@recast-navigation/core").NavMesh} navMesh
 */
export function disposeCrowd(crowd, navMesh) {
  crowd.getAgents().forEach((agent) => crowd.removeAgent(agent));
  crowd.destroy();
}

/** @param {import("@recast-navigation/core").CrowdAgent} agent  */
export function getAgentTarget(agent) {
  return agent.corners().length > 0 ? agent.nextTargetInPath() : null;
}

/**
 * https://github.com/isaac-mason/recast-navigation-js/blob/d64fa867361a316b53c2da1251820a0bd6567f82/packages/recast-navigation-generators/src/generators/generate-tile-cache.ts#L108
 */
export function getTileCacheMeshProcess() {
  return new TileCacheMeshProcess((navMeshCreateParams, polyAreas, polyFlags) => {
    // info({
    //   polyCount: navMeshCreateParams.polyCount(),
    //   vertCount: navMeshCreateParams.vertCount(),
    // });
    for (let i = 0; i < navMeshCreateParams.polyCount(); ++i) {
      polyAreas.set(i, 0);
      // polyFlags.set(i, 1);
      polyFlags.set(i, 2 ** 1); // walkable ~ 2nd lsb bit high
    }
  });
}

/** @returns {Partial<TileCacheGeneratorConfig>} */
export function getTileCacheGeneratorConfig() {
  // const cs = 0.05;
  // const cs = 0.1472;
  // const cs = 0.148;
  const cs = 0.15;
  // const cs = 0.1495;
  // const cs = 0.1;
  return {
    // tileSize: 7.6 / cs,
    // tileSize: 7.2 / cs,
    tileSize: 9 / cs,
    cs, // Small `cs` means more tileCache updates when e.g. add obstacles
    ch: 0.01, // EPSILON breaks obstacles
    borderSize: 0,
    expectedLayersPerTile: 1,
    detailSampleDist: 0,
    walkableClimb: 0,
    tileCacheMeshProcess: getTileCacheMeshProcess(),
    // maxSimplificationError: 0.8,
    walkableRadius: 0,
    detailSampleMaxError: 0,
    // maxVertsPerPoly: 3,
  };
}

/**
 * 
 * @param {THREE.Mesh[]} meshes 
 * @param {Partial<TileCacheGeneratorConfig>} navMeshGeneratorConfig 
 * @param {TileCacheCustomOptions} [options]
 */
export function customThreeToTileCache(meshes, navMeshGeneratorConfig = {}, options) {
  const [positions, indices] = getPositionsAndIndices(meshes);
  return customGenerateTileCache(positions, indices, navMeshGeneratorConfig, options);
}

/**
 * 
 * @param {ArrayLike<number>} positions 
 * @param {ArrayLike<number>} indices 
 * @param {Partial<TileCacheGeneratorConfig>} [navMeshGeneratorConfig ]
 * @param {TileCacheCustomOptions} [options]
 * @returns {TileCacheGeneratorResult}
 */
export function customGenerateTileCache(
  positions,
  indices,
  navMeshGeneratorConfig = {},
  options = {}
) {

  const buildContext = new RecastBuildContext();

  /** @type {TileCacheGeneratorIntermediates} */
  const intermediates = {
    type: 'tilecache',
    buildContext,
    chunkyTriMesh: undefined,
    tileIntermediates: [],
  };

  const tileCache = new TileCache();
  const navMesh = new NavMesh();

  function cleanup() {
    if (!options.keepIntermediates) {
      for (let i = 0; i < intermediates.tileIntermediates.length; i++) {
        const tileIntermediate = intermediates.tileIntermediates[i];

        if (tileIntermediate.heightfield) {
          freeHeightfield(tileIntermediate.heightfield);
          tileIntermediate.heightfield = undefined;
        }

        if (tileIntermediate.compactHeightfield) {
          freeCompactHeightfield(tileIntermediate.compactHeightfield);
          tileIntermediate.compactHeightfield = undefined;
        }

        if (tileIntermediate.heightfieldLayerSet) {
          freeHeightfieldLayerSet(tileIntermediate.heightfieldLayerSet);
          tileIntermediate.heightfieldLayerSet = undefined;
        }
      }
    }
  }

  /**
   * @param {string} error 
   * @returns {TileCacheGeneratorFailResult}
   */
  function fail(error) {
    cleanup();

    tileCache.destroy();
    navMesh.destroy();

    return {
      success: false,
      navMesh: undefined,
      tileCache: undefined,
      intermediates,
      error,
    };
  };

  const verts = /** @type {number[]} */ (positions);
  const nVerts = indices.length;
  const vertsArray = new VerticesArray();
  vertsArray.copy(verts);

  const tris = /** @type {number[]} */ (indices);
  const nTris = indices.length / 3;
  const trisArray = new TrianglesArray();
  trisArray.copy(tris);

  const { bbMin, bbMax } = getBoundingBox(positions, indices);

  const { expectedLayersPerTile, maxObstacles, ...recastConfig } = {
    ...tileCacheGeneratorConfigDefaults,
    ...navMeshGeneratorConfig,
  };

  //
  // Step 1. Initialize build config.
  //
  const config = createRcConfig(recastConfig);

  const gridSize = calcGridSize(bbMin, bbMax, config.cs);
  config.width = gridSize.width;
  config.height = gridSize.height;

  config.minRegionArea = config.minRegionArea * config.minRegionArea; // Note: area = size*size
  config.mergeRegionArea = config.mergeRegionArea * config.mergeRegionArea; // Note: area = size*size
  config.detailSampleDist =
    config.detailSampleDist < 0.9 ? 0 : config.cs * config.detailSampleDist;
  config.detailSampleMaxError = config.ch * config.detailSampleMaxError;

  const tileSize = Math.floor(config.tileSize);
  const tileWidth = Math.floor((config.width + tileSize - 1) / tileSize);
  const tileHeight = Math.floor((config.height + tileSize - 1) / tileSize);

  // Generation params
  config.borderSize = config.walkableRadius + 3; // Reserve enough padding.
  config.width = config.tileSize + config.borderSize * 2;
  config.height = config.tileSize + config.borderSize * 2;

  // Tile cache params
  const tileCacheParams = DetourTileCacheParams.create({
    orig: bbMin,
    cs: config.cs,
    ch: config.ch,
    width: config.tileSize,
    height: config.tileSize,
    walkableHeight: config.walkableHeight,
    walkableRadius: config.walkableRadius,
    walkableClimb: config.walkableClimb,
    maxSimplificationError: config.maxSimplificationError,
    maxTiles: tileWidth * tileHeight * expectedLayersPerTile,
    maxObstacles,
  });

  const allocator = new Raw.RecastLinearAllocator(32000);
  const compressor = new Raw.RecastFastLZCompressor();

  const tileCacheMeshProcess =
    navMeshGeneratorConfig.tileCacheMeshProcess ??
    createDefaultTileCacheMeshProcess();

  if (!tileCache.init(tileCacheParams, allocator, compressor, tileCacheMeshProcess)) {
    return fail('Failed to initialize tile cache');
  }

  const orig = vec3.fromArray(bbMin);

  // Max tiles and max polys affect how the tile IDs are caculated.
  // There are 22 bits available for identifying a tile and a polygon.
  let tileBits = Math.min(
    Math.floor(
      dtIlog2(dtNextPow2(tileWidth * tileHeight * expectedLayersPerTile))
    ),
    14
  );
  if (tileBits > 14) {
    tileBits = 14;
  }
  const polyBits = 22 - tileBits;

  const maxTiles = 1 << tileBits;
  const maxPolysPerTile = 1 << polyBits;

  const navMeshParams = NavMeshParams.create({
    orig,
    tileWidth: config.tileSize * config.cs,
    tileHeight: config.tileSize * config.cs,
    maxTiles,
    maxPolys: maxPolysPerTile,
  });

  if (!navMesh.initTiled(navMeshParams)) {
    return fail('Failed to initialize tiled navmesh');
  }

  const chunkyTriMesh = new RecastChunkyTriMesh();
  intermediates.chunkyTriMesh = chunkyTriMesh;

  if (!chunkyTriMesh.init(vertsArray, trisArray, nTris, 256)) {
    return fail('Failed to build chunky triangle mesh');
  }

  /**
   * @param {number} tileX 
   * @param {number} tileY 
   */
  function rasterizeTileLayers(tileX, tileY) {
    // Tile intermediates
    /** @type {TileCacheGeneratorTileIntermediates} */
    const tileIntermediates = { tileX, tileY };

    // Tile bounds
    const tcs = config.tileSize * config.cs;

    const tileConfig = cloneRcConfig(config);

    /** @type {THREE.Vector3Tuple} */
    const tileBoundsMin = [
      bbMin[0] + tileX * tcs,
      bbMin[1],
      bbMin[2] + tileY * tcs,
    ];

    /** @type {THREE.Vector3Tuple} */
    const tileBoundsMax = [
      bbMin[0] + (tileX + 1) * tcs,
      bbMax[1],
      bbMin[2] + (tileY + 1) * tcs,
    ];

    tileBoundsMin[0] -= tileConfig.borderSize * tileConfig.cs;
    tileBoundsMin[2] -= tileConfig.borderSize * tileConfig.cs;
    tileBoundsMax[0] += tileConfig.borderSize * tileConfig.cs;
    tileBoundsMax[2] += tileConfig.borderSize * tileConfig.cs;

    tileConfig.set_bmin(0, tileBoundsMin[0]);
    tileConfig.set_bmin(1, tileBoundsMin[1]);
    tileConfig.set_bmin(2, tileBoundsMin[2]);

    tileConfig.set_bmax(0, tileBoundsMax[0]);
    tileConfig.set_bmax(1, tileBoundsMax[1]);
    tileConfig.set_bmax(2, tileBoundsMax[2]);

    // Allocate voxel heightfield where we rasterize our input data to.
    const heightfield = allocHeightfield();
    tileIntermediates.heightfield = heightfield;

    if (
      !createHeightfield(
        buildContext,
        heightfield,
        tileConfig.width,
        tileConfig.height,
        tileBoundsMin,
        tileBoundsMax,
        tileConfig.cs,
        tileConfig.ch
      )
    ) {
      return { n: 0 };
    }

    /** @type {THREE.Vector2Tuple} */
    const tbmin = [tileBoundsMin[0], tileBoundsMin[2]];
    /** @type {THREE.Vector2Tuple} */
    const tbmax = [tileBoundsMax[0], tileBoundsMax[2]];

    // TODO: Make grow when returning too many items.
    const maxChunkIds = 512;
    const chunkIdsArray = new ChunkIdsArray();
    chunkIdsArray.resize(maxChunkIds);

    const nChunksOverlapping = chunkyTriMesh.getChunksOverlappingRect(
      tbmin,
      tbmax,
      chunkIdsArray,
      maxChunkIds
    );

    if (nChunksOverlapping === 0) {
      return { n: 0 };
    }

    for (let i = 0; i < nChunksOverlapping; ++i) {
      const nodeId = chunkIdsArray.raw.get_data(i);
      const node = chunkyTriMesh.nodes(nodeId);
      const nNodeTris = node.n;

      const nodeTrisArray = chunkyTriMesh.getNodeTris(nodeId);

      const triAreasArray = new TriangleAreasArray();
      triAreasArray.resize(nNodeTris);

      // Find triangles which are walkable based on their slope and rasterize them.
      // If your input data is multiple meshes, you can transform them here, calculate
      // the are type for each of the meshes and rasterize them.
      markWalkableTriangles(
        buildContext,
        tileConfig.walkableSlopeAngle,
        vertsArray,
        nVerts,
        nodeTrisArray,
        nNodeTris,
        triAreasArray
      );

      const success = rasterizeTriangles(
        buildContext,
        vertsArray,
        nVerts,
        nodeTrisArray,
        triAreasArray,
        nNodeTris,
        heightfield,
        tileConfig.walkableClimb
      );

      triAreasArray.raw.free();

      if (!success) {
        return { n: 0 };
      }
    }

    // Once all geometry is rasterized, we do initial pass of filtering to
    // remove unwanted overhangs caused by the conservative rasterization
    // as well as filter spans where the character cannot possibly stand.
    filterLowHangingWalkableObstacles(
      buildContext,
      config.walkableClimb,
      heightfield
    );
    filterLedgeSpans(
      buildContext,
      config.walkableHeight,
      config.walkableClimb,
      heightfield
    );
    filterWalkableLowHeightSpans(
      buildContext,
      config.walkableHeight,
      heightfield
    );

    const compactHeightfield = allocCompactHeightfield();
    if (
      !buildCompactHeightfield(
        buildContext,
        config.walkableHeight,
        config.walkableClimb,
        heightfield,
        compactHeightfield
      )
    ) {
      return { n: 0 };
    }

    if (!options.keepIntermediates) {
      freeHeightfield(tileIntermediates.heightfield);
      tileIntermediates.heightfield = undefined;
    }

    // Erode the walkable area by agent radius
    if (
      !erodeWalkableArea(
        buildContext,
        config.walkableRadius,
        compactHeightfield
      )
    ) {
      return { n: 0 };
    }

    // 🚧 Create Detour data from Recast poly mesh
    for (const { areaId, areas } of options.areas ?? []) {
      for (const { hmin, hmax, verts } of areas) {
        const vertsArray = new VerticesArray();
        const numVerts = verts.length;
        vertsArray.copy(verts.flatMap(v => [v.x, v.y, v.z]));
        markConvexPolyArea(
          buildContext,
          vertsArray,
          numVerts,
          hmin,
          hmax,
          areaId,
          compactHeightfield,
        );
      }
    }

    const heightfieldLayerSet = allocHeightfieldLayerSet();
    if (
      !buildHeightfieldLayers(
        buildContext,
        compactHeightfield,
        config.borderSize,
        config.walkableHeight,
        heightfieldLayerSet
      )
    ) {
      return { n: 0 };
    }

    if (!options.keepIntermediates) {
      freeCompactHeightfield(compactHeightfield);
      tileIntermediates.compactHeightfield = undefined;
    }

    const tiles = /** @type {import("@recast-navigation/core").UnsignedCharArray[]} */ ([]);

    for (let i = 0; i < heightfieldLayerSet.nlayers(); i++) {
      const tile = new TileCacheData();
      const heightfieldLayer = heightfieldLayerSet.layers(i);

      // Store header
      const header = new Raw.dtTileCacheLayerHeader();
      header.magic = Raw.Detour.TILECACHE_MAGIC;
      header.version = Raw.Detour.TILECACHE_VERSION;

      // Tile layer location in the navmesh
      header.tx = tileX;
      header.ty = tileY;
      header.tlayer = i;

      const heightfieldLayerBin = heightfieldLayer.bmin();
      const heightfieldLayerBmax = heightfieldLayer.bmax();
      header.set_bmin(0, heightfieldLayerBin.x);
      header.set_bmin(1, heightfieldLayerBin.y);
      header.set_bmin(2, heightfieldLayerBin.z);

      header.set_bmax(0, heightfieldLayerBmax.x);
      header.set_bmax(1, heightfieldLayerBmax.y);
      header.set_bmax(2, heightfieldLayerBmax.z);

      // Tile info
      header.width = heightfieldLayer.width();
      header.height = heightfieldLayer.height();
      header.minx = heightfieldLayer.minx();
      header.maxx = heightfieldLayer.maxx();
      header.miny = heightfieldLayer.miny();
      header.maxy = heightfieldLayer.maxy();
      header.hmin = heightfieldLayer.hmin();
      header.hmax = heightfieldLayer.hmax();

      const heights = getHeightfieldLayerHeights(heightfieldLayer);
      const areas = getHeightfieldLayerAreas(heightfieldLayer);
      const cons = getHeightfieldLayerCons(heightfieldLayer);

      const status = buildTileCacheLayer(
        compressor,
        header,
        heights,
        areas,
        cons,
        tile
      );

      if (Raw.Detour.statusFailed(status)) {
        return { n: 0 };
      }

      tiles.push(tile);
    }

    if (!options.keepIntermediates) {
      freeHeightfieldLayerSet(heightfieldLayerSet);
      tileIntermediates.heightfieldLayerSet = undefined;
    }

    intermediates.tileIntermediates.push(tileIntermediates);

    return { n: tiles.length, tiles };
  };

  // Preprocess tiles
  for (let y = 0; y < tileHeight; ++y) {
    for (let x = 0; x < tileWidth; ++x) {
      const { n, tiles: newTiles } = rasterizeTileLayers(x, y);

      if (n > 0 && newTiles) {
        for (let i = 0; i < n; i++) {
          const tileCacheData = newTiles[i];

          const addResult = tileCache.addTile(tileCacheData);

          if (Raw.Detour.statusFailed(addResult.status)) {
            buildContext.log(
              Raw.Module.RC_LOG_WARNING,
              `Failed to add tile to tile cache: (${x}, ${y})`
            );
            continue;
          }
        }
      }
    }
  }

  // Build initial meshes
  for (let y = 0; y < tileHeight; y++) {
    for (let x = 0; x < tileWidth; x++) {
      const dtStatus = tileCache.buildNavMeshTilesAt(x, y, navMesh);

      if (Raw.Detour.statusFailed(dtStatus)) {
        return fail(`Failed to build nav mesh tiles at: (${x}, ${y})`);
      }
    }
  }

  cleanup();

  return {
    success: true,
    tileCache,
    navMesh,
    intermediates,
  };

}

const emptyUserData = {};

/**
 * @typedef {import("@recast-navigation/generators").TileCacheGeneratorConfig} TileCacheGeneratorConfig
 */
/**
 * @typedef {import("@recast-navigation/generators").TileCacheGeneratorResult} TileCacheGeneratorResult
 */
/**
 * @typedef {import("@recast-navigation/generators").TileCacheGeneratorIntermediates} TileCacheGeneratorIntermediates
 */
/**
 * @typedef {import("@recast-navigation/generators").TileCacheGeneratorTileIntermediates} TileCacheGeneratorTileIntermediates
 */
/**
 * @typedef {import("@recast-navigation/wasm").default.UnsignedCharArray} UnsignedCharArray
 */

/**
 * @typedef TileCacheGeneratorFailResult
 * @property {undefined} tileCache
 * @property {undefined} navMesh
 * @property {false} success
 * @property {string} error
 * @property {TileCacheGeneratorIntermediates} intermediates
 */

/**
 * @typedef TileCacheCustomOptions
 * @property {boolean} [keepIntermediates]
 * @property {NPC.TileCacheConvexAreaDef[]} [areas]
 */
