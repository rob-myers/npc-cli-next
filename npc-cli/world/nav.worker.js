import * as THREE from "three";
import { init as initRecastNav, exportTileCache } from "@recast-navigation/core";

import { error, info, debug, range, isInsideWebWorker } from "../service/generic";
import { geomorph } from "../service/geomorph";
import { customThreeToTileCache, getTileCacheGeneratorConfig, getTileCacheMeshProcess, computeGmInstanceMesh } from "../service/recast-detour";
import { fetchGeomorphsJson } from "../service/fetch-assets";

/** @type {WW.WorkerGeneric<WW.MsgFromNavWorker, WW.MsgToNavWorker>} */
const worker = (/** @type {*} */ (self));

if (isInsideWebWorker() === true) {
  info("🤖 nav.worker started", import.meta.url);
  worker.addEventListener("message", handleMessages);
}

/** @param {MessageEvent<WW.MsgToNavWorker>} e */
async function handleMessages(e) {
  const msg = e.data;
  debug("🤖 nav.worker received", JSON.stringify(msg.type));

  if (msg.type === 'request-nav') {
    onRequestNav(msg);
  }

}

/** @param {WW.RequestNavMesh} msg  */
async function onRequestNav(msg) {

  const geomorphs = geomorph.deserializeGeomorphs(await fetchGeomorphsJson(msg.baseUrl));
  const map = geomorphs.map[msg.mapKey ?? "small-map-1"];
  const gms = map.gms.map(({ gmKey, transform }, gmId) =>
    geomorph.computeLayoutInstance(geomorphs.layout[gmKey], gmId, transform)
  );

  const { meshes, customAreaDefs } = await computeGeomorphMeshes(gms);
  await initRecastNav();

  const result = customThreeToTileCache(
    meshes,
    getTileCacheGeneratorConfig(getTileCacheMeshProcess(msg.offMeshDefs)),
    { areas: customAreaDefs.flatMap(x => x) },
  );
  
  meshes.forEach((mesh) => mesh.geometry.dispose());
  if (!result.success) {
    error(`Failed to compute navMesh: ${'error' in result ? result.error : 'unknown error'}`);
    return;
  }

  // 🚧 compute nav/off-mesh-connections for Floor

  // const gmKeyToFirst = gms.reduce(
  //   (agg, gm) => (agg[gm.key] ??= gm, agg),
  //   /** @type {Record<Key.Geomorph, Geomorph.LayoutInstance>} */ ({}),
  // );
  const foo = navForFloorDraw(
    result.navMesh,
    result.offMeshLookup,
  );

  logTileCount(result.navMesh);
  worker.postMessage({
    type: "nav-mesh-response",
    mapKey: msg.mapKey,
    exportedNavMesh: exportTileCache(result.navMesh, result.tileCache),
    offMeshLookup: result.offMeshLookup,
  });

  result.tileCache.destroy();
  result.navMesh.destroy();
}


/** @param {Geomorph.LayoutInstance[]} gms  */
async function computeGeomorphMeshes(gms) {
  const meshes = /** @type {THREE.Mesh[]} */ ([]);
  const customAreaDefs = /** @type {NPC.TileCacheConvexAreaDef[]} */ ([]);
  for (const { mesh, customAreaDefs } of gms.map(computeGmInstanceMesh)) {
    meshes.push(mesh);
    customAreaDefs.push(...customAreaDefs);
  }

  debug('🤖 nav.worker', {
    'total vertices': meshes.reduce((agg, mesh) => agg + (mesh.geometry.getAttribute('position')?.count ?? 0), 0),
    'total triangles': meshes.reduce((agg, mesh) => agg + (mesh.geometry.index?.count ?? 0) / 3, 0),
    'total meshes': meshes.length,
  });

  return { meshes, customAreaDefs };
}

/**
 * @param {import('@recast-navigation/core').NavMesh} navMesh 
 */
function logTileCount(navMesh) {
  const polysPerTile = range(navMesh.getMaxTiles()).flatMap((i) =>
    navMesh.getTile(i).header()?.polyCount() ?? []
  );
  info('🤖 nav.worker', { totalTiles: polysPerTile.length, polysPerTile });
}

/**
 * 🚧
 * @param {import('@recast-navigation/core').NavMesh} nav 
 * @param {NPC.SrcToOffMeshLookup} offMeshLookup 
 */
function navForFloorDraw(nav, offMeshLookup) {// 🚧 compute in worker
  // state.toNavTris = mapValues(w.gmsData.gmKeyToFirst, () => []);
  // /** Those geomorph instances which are 1st for their gmKey */
  // const firstGms = Object.values(w.gmsData.gmKeyToFirst);
  // const v2d = new Vect();
  
  // // compute nav tris in local coords for each seen gmKey
  // const maxTiles = nav.getMaxTiles();
  // for (let tileIndex = 0; tileIndex < maxTiles; tileIndex++) {
  //   const tile = nav.getTile(tileIndex);
  //   const header = tile.header();
  //   if (!header) continue;
    
  //   const point = { x: (header.bmin(0) + header.bmax(0)) * 0.5, y: (header.bmin(2) + header.bmax(2)) * 0.5 };
  //   const gm = firstGms.find(x => x.gridRect.contains(point));
    
  //   if (gm !== undefined) {
  //     const tileTris = getTileTriangles(tile); // [positions, indices][]
      
  //     // apply inverseTransform because we'll draw in local coords
  //     tileTris[0].forEach((t, i, positions) => {
  //       if (i % 3 === 0) {// x -> x
  //         v2d.x = t;
  //       } else if (i % 3 === 2) {// z -> y
  //         v2d.y = t;
  //         gm.inverseMatrix.transformPoint(v2d);
  //         positions[i - 2] = v2d.x;
  //         positions[i] = v2d.y;
  //       }
  //     });

  //     state.toNavTris[gm.key].push(tileTris);
  //   }
  // }

  // // compute off mesh edges in local coords for each seen gmKey
  // state.offMeshEdges = mapValues(w.gmsData.gmKeyToFirst, () => []);
  // const firstGmIds = new Set(firstGms.map(x => x.gmId));

  // const offMeshEdges = Object.values(offMeshLookup)
  //   .map(x => ({ gmId: x.gmId, src: x.src, dst: x.dst }))
  //   .filter(x => firstGmIds.has(x.gmId));
  // ;

  // for (const { gmId, src, dst } of offMeshEdges) {
  //   const gm = w.gms[gmId];
  //   state.offMeshEdges[gm.key].push({
  //     // transform to local coords
  //     src: gm.inverseMatrix.transformPoint(v2d.set(src.x, src.z)).json,
  //     dst: gm.inverseMatrix.transformPoint(v2d.set(dst.x, dst.z)).json,
  //   });
  // }
}
