/**
 * Usage:
 * ```sh
 * npm run assets
 * yarn assets-fast
 * yarn assets-fast --changedFiles=[]
 * yarn assets-fast --all
 * yarn assets-fast --changedFiles=['/path/to/file/a', '/path/to/file/b']
 * yarn assets-fast --prePush
 * ```
 *
 * Generates:
 * - assets.json
 * - geomorphs.json
 * - obstacles sprite-sheet (using media/symbol/*.svg)
 * - decor sprite-sheet (using media/decor/*.svg)
 * - npc textures (using media/npc/*.tex.svg)
 * - webp from png
 */
/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import childProcess from "child_process";
import { performance, PerformanceObserver } from 'perf_hooks'
//@ts-ignore
import getopts from 'getopts';
import stringify from "json-stringify-pretty-compact";
import { createCanvas, loadImage } from 'canvas';
import PQueue from "p-queue-compat";

// relative urls for sucrase-node
import { Poly } from "../npc-cli/geom";
import { spriteSheetSymbolExtraScale, worldToSguScale, spriteSheetDecorExtraScale, sguSymbolScaleDown, sguSymbolScaleUp } from "../npc-cli/service/const";
import { hashText, info, keyedItemsToLookup, warn, debug, error, assertNonNull, hashJson, toPrecision, mapValues, range, keys } from "../npc-cli/service/generic";
import { drawPolygons } from "../npc-cli/service/dom";
import { geomorph } from "../npc-cli/service/geomorph";
import { DEV_ENV_PORT, DEV_ORIGIN, ASSETS_JSON_FILENAME, GEOMORPHS_JSON_FILENAME } from "../npc-cli/service/fetch-assets";
import packRectangles from "../npc-cli/service/rects-packer";
import { SymbolGraphClass } from "../npc-cli/graph/symbol-graph";
import { helper } from "../npc-cli/service/helper";
import { labelledSpawn, saveCanvasAsFile, tryLoadImage, tryReadString } from "./service";

const rawOpts = getopts(process.argv, {
  boolean: ['all', 'prePush'],
  string: ['changedFiles'],
});

const imgOpts = {
  debugImage: true,
  // debugImage: false,
  debugNavPoly: true,
  debugNavTris: false,
  packedPadding: 2,
};

function computeOpts() {
  /** @type {string[]} */
  const changedFiles = rawOpts.changedFiles ? JSON.parse(rawOpts.changedFiles) : [];
  const all = (
    Boolean(rawOpts.all)
    || !fs.existsSync(assetsFilepath)
    || changedFiles.includes(assetsScriptFilepath)
    || changedFiles.includes(geomorphServicePath)
  );
  const changedDecorBaseNames = changedFiles.flatMap(x =>
    x.startsWith(decorDir) ? path.basename(x) : []
  );
  return {
    /**
     * We'll update efficiently <=> this is `false` i.e.
     * - no `--all`
     * - assets.json exists
     * - neither this script nor geomorphs.js are in `changedFiles`
     */
    all,
    /** When non-empty, files changed (added/modified/deleted) within {ms}, see `assets-nodemon.js` */
    changedFiles,
    /** Restriction of @see changedFiles to decor SVG baseNames */
    changedDecorBaseNames,
    /** If `!opts.all` and changedFiles explicitly provided  */
    detectChanges: !all && !!rawOpts.changedFiles,
    /**
     * When about to push:
     * - ensure every webp
     * - fail if any asset not committed
     */
    prePush: Boolean(rawOpts.prePush),
  };
}

/** @returns {Promise<Prev>} */
async function computePrev() {
  const prevAssetsStr = !opts.all ? await tryReadString(assetsFilepath) : null
  const prevAssets = /** @type {Geomorph.AssetsJson | null} */ (JSON.parse(prevAssetsStr ?? 'null'));

  const [obstaclePngs, decorPngs, npcTexMetas] = await Promise.all([
    Promise.all(getObstaclePngPaths(prevAssets).map(tryLoadImage)),
    Promise.all(getDecorPngPaths(prevAssets).map(tryLoadImage)),
    getNpcTextureMetas(),
  ]);
  const skipPossible = !opts.all && opts.detectChanges;
  return {
    assets: prevAssets,
    obstaclePngs,
    decorPngs,
    npcTexMetas,
    skipMaps: skipPossible && !opts.changedFiles.some(x => x.startsWith(mapsDir)),
    skipObstacles: skipPossible && obstaclePngs.every(Boolean) && !opts.changedFiles.some(x => x.startsWith(symbolsDir)),
    skipDecor: skipPossible && decorPngs.every(Boolean) && !opts.changedFiles.some(x => x.startsWith(decorDir)),
    skipNpcTex: skipPossible && npcTexMetas.every(x => x.canSkip) && !opts.changedFiles.some(x => x.startsWith(npcDir)),
    // 🔔 only recompute when forced to or some glb changed
    skipGltfs: skipPossible && !opts.changedFiles.some(x => x.endsWith('.glb')),
  };
}

new PerformanceObserver((list) =>
  list.getEntries()
    .sort((a, b) => a.startTime + a.duration < b.startTime + b.duration ? -1 : 1)
    .forEach(entry => info(`⏱ ${entry.name}: ${entry.duration.toFixed(2)} ms`))
).observe({ entryTypes: ['measure'] });

// const staticAssetsDir = path.resolve(__dirname, '../../static/assets');
const staticAssetsDir = path.resolve(__dirname, '../public');
const assetsFilepath = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const assetsScriptFilepath = __filename;
const geomorphServicePath = path.resolve(__dirname, '../npc-cli/service', 'geomorph.js');
const mediaDir = path.resolve(__dirname, '../media');
const mapsDir = path.resolve(mediaDir, 'map');
const symbolsDir = path.resolve(mediaDir, 'symbol');
const assets2dDir = path.resolve(staticAssetsDir, '2d');
const assets3dDir = path.resolve(staticAssetsDir, '3d');
const graphDir = path.resolve(mediaDir, 'graph');
const decorDir = path.resolve(mediaDir, 'decor');
const npcDir = path.resolve(mediaDir, 'npc');
const geomorphsFilepath = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
/** Extended as `${baseDecorPath}.${sheetId}.{png,webp}` */
const baseDecorPath = path.resolve(assets2dDir, 'decor');
/** Extended as `${baseObstaclePath}.${sheetId}.{png,webp}` */
const baseObstaclePath = path.resolve(assets2dDir, 'obstacles');
const symbolGraphVizPath = path.resolve(graphDir, 'symbols-graph.dot');
const sendDevEventUrl = `http://${DEV_ORIGIN}:${DEV_ENV_PORT}/api/send-dev-event`;
const dataUrlRegEx = /"data:image\/png(.*)"/;
const gitStaticAssetsRegex = new RegExp('^public/');
const emptyStringHash = hashText('');
const measuringLabels = /** @type {Set<string>} */ (new Set());

const opts = computeOpts();
info({ opts });

(async function main() {

  perf('computePrev');
  const prev = await computePrev();
  // info({ prev });
  perf('computePrev');

  perf('{symbol,map}BaseNames');
  const [symbolBaseNames, mapBaseNames] = await Promise.all([
    fs.promises.readdir(symbolsDir).then(xs => xs.filter((x) => x.endsWith(".svg")).sort()),
    fs.promises.readdir(mapsDir).then(xs => xs.filter((x) => x.endsWith(".svg")).sort()),
  ]);
  perf('{symbol,map}BaseNames');

  const symbolBaseNamesToUpdate = opts.all
    ? symbolBaseNames
    : symbolBaseNames.filter(x => opts.changedFiles.includes(path.resolve(symbolsDir, x)))
  ;

  /** @type {Geomorph.AssetsJson} The next assets.json */
  const assetsJson = {
    meta: {},
    sheet: {
      decor: /** @type {*} */ ({}),
      decorDims: [],
      maxDecorDim: { width: 0, height: 0 },
      
      obstacle: /** @type {*} */ ({}),
      obstacleDims: [],
      maxObstacleDim: { width: 0, height: 0 },

      glbHash: /** @type {Geomorph.SpriteSheet['glbHash']} */ ({}),
      imagesHash: 0,
    },
    skin: {
      numSheets: /** @type {Geomorph.SpriteSheetSkins['numSheets']} */ ({}),
      svgHashes: /** @type {Geomorph.SpriteSheetSkins['svgHashes']} */ ({}),
      texArrayId: /** @type {Geomorph.SpriteSheetSkins['texArrayId']} */ ({}),
      uvMap: /** @type {Geomorph.SpriteSheetSkins['uvMap']} */ ({}),
      uvMapDim: /** @type {Geomorph.SpriteSheetSkins['uvMapDim']} */ ({}),
    },
    symbols: /** @type {*} */ ({}), maps: {},
  };

  if (prev.assets) {// use previous (may overwrite later)
    const { symbols, meta } = prev.assets;
    symbolBaseNames.forEach(baseName => {
      const symbolKey = /** @type {Geomorph.SymbolKey} */ (baseName.slice(0, -".svg".length));
      assetsJson.symbols[symbolKey] = symbols[symbolKey];
      assetsJson.meta[symbolKey] = meta[symbolKey];
    });
    mapBaseNames.forEach(baseName => {
      const mapKey = baseName.slice(0, -".svg".length);
      assetsJson.meta[mapKey] = meta[mapKey];
    });
    assetsJson.maps = prev.assets.maps;
    assetsJson.sheet = prev.assets.sheet;
  }

  //#region ℹ️ Compute assets.json and sprite-sheets
  perf('assets.json');
  if (symbolBaseNamesToUpdate.length) {
    perf('parseSymbols', `parsing ${symbolBaseNamesToUpdate.length === symbolBaseNames.length
      ? `all symbols`
      : `symbols: ${JSON.stringify(symbolBaseNamesToUpdate)}`
    }`);
    parseSymbols(assetsJson, symbolBaseNamesToUpdate);
    perf('parseSymbols');
  } else {
    info('skipping all symbols');
  }

  if (!prev.skipMaps) {
    perf('parseMaps', 'parsing maps');
    parseMaps(assetsJson, mapBaseNames);
    perf('parseMaps');
  } else {
    info('skipping maps');
  }

  if (!prev.skipObstacles) {
    perf('obstacles', 'creating obstacles sprite-sheet');
    createObstaclesSheetJson(assetsJson);
    await drawObstaclesSheet(assetsJson, prev);
    perf('obstacles');
  } else {
    info('skipping obstacles sprite-sheet');
  }

  if (!prev.skipDecor) {
    perf('decor', 'creating decor sprite-sheet');
    const toDecorImg = await createDecorSheetJson(assetsJson, prev);
    await drawDecorSheet(assetsJson, toDecorImg, prev);
    perf('decor');
  } else {
    info('skipping decor sprite-sheet');
  }

  if (!prev.skipNpcTex) {
    perf('createNpcTextures', 'creating npc textures');
    await createNpcTexturesAndUvMeta(assetsJson, prev);
    perf('createNpcTextures');
  } else {
    info('skipping npc textures');
  }

  const changedSymbolAndMapKeys = Object.keys(assetsJson.meta).filter(
    key => assetsJson.meta[key].outputHash !== prev.assets?.meta[key]?.outputHash
  );
  info({ changedKeys: changedSymbolAndMapKeys });

  // construct sheet.gltfHash
  if (!prev.skipGltfs) {
    assetsJson.sheet.glbHash = computeGlbMetas();
  }

  // hash sprite-sheet PNGs: decor, obstacles, skins
  // 🚧 split for faster computation?
  // 🚧 compute image hash faster?
  perf('sheet.imagesHash');
  if (!(
    prev.skipObstacles === true
    && prev.skipDecor === true
    && prev.skipNpcTex === true
    && assetsJson.sheet.imagesHash !== 0
  )) {
    assetsJson.sheet.imagesHash = hashJson([
      ...getDecorPngPaths(assetsJson),
      ...getObstaclePngPaths(assetsJson),
      ...getSkinPngPaths(prev.npcTexMetas),
    ].map(x => fs.readFileSync(x).toString()));
  }
  perf('sheet.imagesHash');

  fs.writeFileSync(assetsFilepath, stringify(assetsJson));
  perf('assets.json');
  //#endregion

  //#region ℹ️ Compute geomorphs.json
  perf('geomorphs.json');
  
  /** @see assetsJson where e.g. rects and polys are `Rect`s and `Poly`s */
  const assets = geomorph.deserializeAssets(assetsJson);

  /** Compute flat symbols i.e. recursively unfold "symbols" folder. */
  // 🚧 reuse unchanged i.e. `changedSymbolAndMapKeys` unreachable
  const flattened = /** @type {Record<Geomorph.SymbolKey, Geomorph.FlatSymbol>} */ ({});
  perf('stratified symbolGraph');
  const symbolGraph = SymbolGraphClass.from(assetsJson.symbols);
  const symbolsStratified = symbolGraph.stratify();
  perf('stratified symbolGraph');
  // debug(util.inspect({ symbolsStratified }, false, 5))

  // Traverse stratified symbols from leaves to co-leaves,
  // creating `FlatSymbol`s via `flattenSymbol` and `instantiateFlatSymbol`
  perf('flatten symbols');
  symbolsStratified.forEach(level => level.forEach(({ id: symbolKey }) =>
    geomorph.flattenSymbol(assets.symbols[symbolKey], flattened)
  ));
  perf('flatten symbols');
  // debug("stateroom--036--2x4", util.inspect(flattened["stateroom--036--2x4"], false, 5));

  // fs.writeFileSync(symbolGraphVizPath, symbolGraph.getGraphviz('symbolGraph'));

  const changedGmKeys = geomorph.gmKeys.filter(gmKey => {
    const hullKey = helper.toHullKey[gmKey];
    const hullNode = assertNonNull(symbolGraph.getNodeById(hullKey));
    return symbolGraph.getReachableNodes(hullNode).find(x => changedSymbolAndMapKeys.includes(x.id));
  });
  info({ changedGmKeys });

  perf('createLayouts');
  /** @type {Record<Geomorph.GeomorphKey, Geomorph.Layout>} */
  const layout = keyedItemsToLookup(geomorph.gmKeys.map(gmKey => {
    const hullKey = helper.toHullKey[gmKey];
    const flatSymbol = flattened[hullKey];
    return geomorph.createLayout(gmKey, flatSymbol, assets);
  }));
  const layoutJson = mapValues(layout, geomorph.serializeLayout);
  perf('createLayouts');

  /** @type {Geomorph.GeomorphsJson} */
  const geomorphs = {
    map: assetsJson.maps,
    layout: layoutJson,
    sheet: assetsJson.sheet,
    skin: assetsJson.skin,
  };

  fs.writeFileSync(geomorphsFilepath, stringify(geomorphs));

  perf('geomorphs.json');
  //#endregion

  /**
   * Tell the browser we're ready.
   * In development we use PNG (not WEBP) to avoid HMR delay.
   */
  fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser" }),
  }).then(e => e.json()).then(resp => {
    info(`POST ${sendDevEventUrl} received: ${JSON.stringify(resp)}`);
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e}`);
  });

  //#region ℹ️ png -> webp for production

  let pngPaths = [
    ...getObstaclePngPaths(assetsJson),
    ...getDecorPngPaths(assetsJson),
    ...getSkinPngPaths(prev.npcTexMetas),
  ];
  if (!opts.prePush) {
    // Only convert PNG if (i) lacks a WEBP, or (ii) has an "older one"
    pngPaths = pngPaths.filter(pngPath =>
      fs.statSync(pngPath).mtimeMs
      > (fs.statSync(`${pngPath}.webp`, { throwIfNoEntry: false })?.mtimeMs ?? 0)
    );
  }
  pngPaths.length && await labelledSpawn('cwebp',
    'yarn', 'cwebp-fast', JSON.stringify({ files: pngPaths }), '--quality=50',
  );

  if (opts.prePush) {
    /**
     * Fail if any asset not committed.
     */
    const [modifiedPaths, untrackedPaths, stagedPaths] = [
      `git diff --name-only`,
      `git ls-files --others --exclude-standard`,
      `git diff --name-only --cached`,
    ].map(cmd =>
      `${childProcess.execSync(cmd)}`.trim().split(/\n/)
      .filter(x => x.match(gitStaticAssetsRegex))
    );

    if (modifiedPaths.concat(untrackedPaths, stagedPaths).length) {
      error('Please commit public/*', { modifiedPaths, untrackedPaths, stagedPaths });
      process.exit(1);
    }
  }

  //#endregion

})();

/**
 * @param {Geomorph.AssetsJson} output
 * @param {string[]} mapBasenames
 */
function parseMaps({ meta, maps }, mapBasenames) {
  for (const baseName of mapBasenames) {
    const filePath = path.resolve(mapsDir, baseName);
    const contents = fs.readFileSync(filePath).toString();
    const mapKey = baseName.slice(0, -".svg".length);
    maps[mapKey] = geomorph.parseMap(mapKey, contents);
    meta[mapKey] = { outputHash: hashText(stringify(maps[mapKey])) };
  }
}

/**
 * @param {Geomorph.AssetsJson} output
 * @param {string[]} symbolBasenames
 */
function parseSymbols({ symbols, meta }, symbolBasenames) {
  for (const baseName of symbolBasenames) {
    const filePath = path.resolve(symbolsDir, baseName);
    const contents = fs.readFileSync(filePath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (baseName.slice(0, -".svg".length));

    const parsed = geomorph.parseSymbol(symbolKey, contents);
    const serialized = geomorph.serializeSymbol(parsed);
    symbols[symbolKey] = serialized;
    meta[symbolKey] = {
      outputHash: hashJson(serialized),
      // 🔔 emptyStringHash when data-url not found
      pngHash: hashText(contents.match(dataUrlRegEx)?.[0] ?? ''),
      obsHashes: parsed.obstacles.length ? parsed.obstacles.map(x => hashJson(x)) : undefined,
    };
  }

  validateSubSymbolDimensions(symbols);
}

/**
 * @param {Geomorph.AssetsJson['symbols']} symbols 
 */
function validateSubSymbolDimensions(symbols) {
  Object.values(symbols).forEach(({ key: parentKey, symbols: subSymbols }) => {
    subSymbols.forEach(({ symbolKey, width, height }) => {
      try {
        const expected = { width: symbols[symbolKey].width, height: symbols[symbolKey].height };
        const observed = { width, height };
        if (expected.width !== width || expected.height !== height) {
          warn(`${parentKey}: ${symbolKey}: unexpected symbol dimension`, { expected, observed });
        }
      } catch (e) {
        debug(`parent ${parentKey}: sub-symbol: ${symbolKey}`);
        throw e;
      }
    })
  });
}

//#region obstacles

/**
 * Given `media/symbol/{symbolKey}.svg` construct `assets.sheet.obstacle`.
 * @param {Geomorph.AssetsJson} assets
 */
function createObstaclesSheetJson(assets) {

  // Each one of a symbol's obstacles induces a respective packed rect
  const obstacleKeyToRect = /** @type {Record<Geomorph.ObstacleKey, { width: number; height: number; data: Geomorph.ObstacleSheetRectCtxt }>} */ ({});

  for (const { key: symbolKey, obstacles, isHull } of Object.values(assets.symbols)) {
    /** World coords -> Starship Geomorph coords, modulo additional scale in [1, 5] */
    const scale = worldToSguScale * spriteSheetSymbolExtraScale;

    for (const [obstacleId, poly] of obstacles.entries()) {
      const rect = Poly.from(poly).rect.scale(scale).precision(0); // width, height integers
      const [width, height] = [rect.width, rect.height]
      obstacleKeyToRect[`${symbolKey} ${obstacleId}`] = {
        width, height, data: { symbolKey, obstacleId, type: extractObstacleDescriptor(poly.meta), sheetId: -1 },
      };
      // info(`images will pack ${ansi.BrightYellow}${JSON.stringify({ ...rectData, width, height })}${ansi.Reset}`);
    }
  }

  const { bins, width, height } = packRectangles(Object.values(obstacleKeyToRect), {
    logPrefix: 'createObstaclesSheetJson',
    packedPadding: imgOpts.packedPadding,
    // maxWidth: 1000,
    // maxHeight: 1000,
  });
  
  /** @type {Pick<Geomorph.SpriteSheet, 'obstacle' | 'obstacleDims' | 'maxObstacleDim'>} */
  const json = ({
    obstacle: {},
    obstacleDims: bins.map(({ width, height }) => ({ width, height })),
    maxObstacleDim: { width, height },
  });

  for (const [binIndex, bin] of bins.entries()) {
    bin.rects.forEach(r => {
      const { symbolKey, obstacleId, type } = /** @type {Geomorph.ObstacleSheetRectCtxt} */ (r.data);
      json.obstacle[`${symbolKey} ${obstacleId}`] = {
        x: toPrecision(r.x),
        y: toPrecision(r.y),
        width: r.width,
        height: r.height,
        symbolKey,
        obstacleId,
        type,
        sheetId: binIndex,
      }
    });
  }

  assets.sheet = { ...assets.sheet, ...json }; // Overwrite initial/previous
}

/**
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 */
async function drawObstaclesSheet(assets, prev) {
  
  const { obstacle: allObstacles, maxObstacleDim, obstacleDims } = assets.sheet;
  const obstacles = Object.values(allObstacles);
  const ct = createCanvas(maxObstacleDim.width, maxObstacleDim.height).getContext('2d');

  const { changed: changedObstacles, removed: removedObstacles } = detectChangedObstacles(obstacles, assets, prev);
  info({ changedObstacles, removedObstacles });

  if (changedObstacles.size === 0 && removedObstacles.size === 0) {
    return;
  }

  // group global obstacle lookup by sheet
  const bySheetId = Object.values(allObstacles).reduce((agg, d) => {
    (agg[d.sheetId] ??= /** @type {*} */ ({}))[`${d.symbolKey} ${d.obstacleId}`] = d;
    return agg;
  }, /** @type {Geomorph.SpriteSheet['obstacle'][]} */ ([]));

  
  for (const [sheetId, obstacles] of bySheetId.entries()) {
    // 🔔 sheet-dependent, whereas texture array will be maxDecorDim
    const { width, height } = obstacleDims[sheetId];
    ct.canvas.width = width;
    ct.canvas.height = height;

    for (const { x, y, width, height, symbolKey, obstacleId } of Object.values(obstacles)) {
      if (assets.meta[symbolKey].pngHash !== emptyStringHash) {
        const symbol = assets.symbols[symbolKey];
        const scale = worldToSguScale * spriteSheetSymbolExtraScale;
        
        const srcPoly = Poly.from(symbol.obstacles[obstacleId]);
        const srcRect = srcPoly.rect;
        // 🔔 must use smaller src rect for hull symbols, because <img> is smaller
        const srcPngRect = srcPoly.rect.delta(-symbol.pngRect.x, -symbol.pngRect.y).scale(worldToSguScale * (symbol.isHull ? 1 : sguSymbolScaleUp));
        const dstPngPoly = srcPoly.clone().translate(-srcRect.x, -srcRect.y).scale(scale).translate(x, y);
  
        if (!changedObstacles.has(`${symbolKey} ${obstacleId}`)) {
          // info(`${symbolKey} ${obstacleId} obstacle did not change`);
          const prevObs = /** @type {Geomorph.AssetsJson} */ (prev.assets).sheet.obstacle[`${symbolKey} ${obstacleId}`];
          ct.drawImage(/** @type {import('canvas').Image} */ (prev.obstaclePngs[prevObs.sheetId]),
            prevObs.x, prevObs.y, prevObs.width, prevObs.height,
            x, y, width, height,
          );
        } else {

          info(`${symbolKey} ${obstacleId}: redrawing...`);
          const symbolPath = path.resolve(symbolsDir, `${symbolKey}.svg`);
          const matched = fs.readFileSync(symbolPath).toString().match(dataUrlRegEx);
          /**
           * 🔔 <img> of hull symbols are currently 1/5 size of symbol.
           * 🔔 Consider larger image, or avoid using as source for obstacles.
           */
          const dataUrl = assertNonNull(matched)[0].slice(1, -1);
          const image = await loadImage(dataUrl);
          ct.save();
          drawPolygons(ct, dstPngPoly, ['white', null], 'clip');
          ct.drawImage(image, srcPngRect.x, srcPngRect.y, srcPngRect.width, srcPngRect.height, x, y, width, height);
          ct.restore();
        }
  
      } else {
        error(`${symbolKey}.svg: expected data:image/png inside SVG symbol`);
      }
    }

    await saveCanvasAsFile(ct.canvas, `${baseObstaclePath}.${sheetId}.png`);
  }

}

/**
 * Uses special hashes constructed in `assets.meta`.
 * @param {Geomorph.SpriteSheet['obstacle'][*][]} obstacles
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 * @returns {Record<'changed' | 'removed', Set<Geomorph.ObstacleKey>>}
 */
function detectChangedObstacles(obstacles, assets, prev) {
  if (prev.assets && prev.obstaclePngs.every(Boolean)) {
    const changed = /** @type {Set<Geomorph.ObstacleKey>} */ (new Set);
    const removed = new Set(Object.values(prev.assets.sheet.obstacle).map(geomorph.symbolObstacleToKey));
    const [currMeta, prevMeta] = [assets.meta, prev.assets.meta];
    obstacles.forEach(({ symbolKey, obstacleId }) => {
      const key = geomorph.symbolObstacleToKey({ symbolKey, obstacleId });
      removed.delete(key);
      // optional-chaining in case symbol is new
      (currMeta[symbolKey].pngHash !== prevMeta[symbolKey]?.pngHash
        || currMeta[symbolKey].obsHashes?.[obstacleId] !== prevMeta[symbolKey].obsHashes?.[obstacleId]
      ) && changed.add(key);
    });
    return { changed, removed };
  } else {
    return {
      changed: new Set(obstacles.map(geomorph.symbolObstacleToKey)),
      removed: new Set(),
    };
  }
}

/** @param {Meta} meta */
function extractObstacleDescriptor(meta) {
  for (const tag of ['table', 'chair', 'bed', 'shower', 'surface']) {
    if (meta[tag] === true) return tag;
  }
  return 'obstacle';
}

/**
 * @param {Geomorph.AssetsJson | null} [assets]
 */
function getObstaclePngPaths(assets) {
  const numObstacleSheets = assets?.sheet.obstacleDims.length ?? 0;
  return range(numObstacleSheets).map(i => `${baseObstaclePath}.${i}.png`);
}

//#endregion

//#region decor

/**
 * Given `media/decor/{decorImgKey}.svg` construct `assets.sheet.decor`.
 * Returns lookup from _changed_ DecorImgKey to respective PNG (side-effect).
 * 
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 * @returns {Promise<{ [key in Geomorph.DecorImgKey]?: import('canvas').Image }>}
 */
async function createDecorSheetJson(assets, prev) {

  /** `media/decor/{baseName}` for SVGs corresponding to decorImgKeys */
  const svgBasenames = fs.readdirSync(decorDir)
    .filter(baseName => baseName.endsWith(".svg"))
    .filter((baseName) => {
      if (geomorph.isDecorImgKey(baseName.slice(0, -'.svg'.length))) {
        return true;
      } else {
        warn(`${'createDecorSheetJson'}: expected {decorImgKey}.svg: "${baseName}"`);
      }
    }
  ).sort();

  const prevDecorSheet = prev.assets?.sheet.decor;
  const changedSvgBasenames = !!prevDecorSheet && opts.detectChanges
    ? svgBasenames.filter(x => opts.changedDecorBaseNames.includes(x) || !(x in prevDecorSheet))
    : svgBasenames
  ;

  const imgKeyToRect = /** @type {Record<Geomorph.DecorImgKey, { width: number; height: Number; data: Geomorph.DecorSheetRectCtxt }>} */ ({});
  const imgKeyToImg = /** @type {{ [key in Geomorph.DecorImgKey]?: import('canvas').Image }} */ ({});

  // Compute changed images in parallel
  const promQueue = new PQueue({ concurrency: 5 });
  // const promQueue = new PQueue({ concurrency: 1 });
  await Promise.all(changedSvgBasenames.map(baseName => promQueue.add(async () => {
    const decorImgKey = /** @type {Geomorph.DecorImgKey} */ (baseName.slice(0, -'.svg'.length));
    // svg contents -> data url
    const svgPathName = path.resolve(decorDir, baseName);
    const contents = await tryReadString(svgPathName);
    if (contents === null) {
      return warn(`createDecorSheetJson: could not read "${svgPathName}"`);
    }
    // 🚧 `bun` is failing on `loadImage`
    // const svgDataUrl = `data:image/svg+xml;utf8,${contents}`;
    // console.log({svgPathName});
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(contents)}`;
    imgKeyToImg[decorImgKey] = await loadImage(svgDataUrl);
  })));

  /**
   * Decor is drawn in units `sgu * 5` i.e. same approach as SVG symbols.
   * We further adjust how high-res we want it.
   */
  const scale = sguSymbolScaleDown * spriteSheetDecorExtraScale;

  for (const baseName of svgBasenames) {
    const decorImgKey = /** @type {Geomorph.DecorImgKey} */ (baseName.slice(0, -'.svg'.length));
    const img = imgKeyToImg[decorImgKey];

    if (img) {// changedSvgBasenames.includes(baseName)
      const tags = baseName.split('--').slice(0, -1); // ignore e.g. `001.svg`
      const meta = tags.reduce((agg, tag) => { agg[tag] = true; return agg; }, /** @type {Meta} */ ({}));
      imgKeyToRect[decorImgKey] = {
        width: toPrecision(img.width * scale, 0),
        height: toPrecision(img.height * scale, 0),
        data: { ...meta, decorImgKey, sheetId: -1 },
      };
    } else {
      // 🔔 keeping meta.{x,y,width,height} avoids nondeterminism in sheet.decor json
      const meta = /** @type {Geomorph.SpriteSheet['decor']} */ (prevDecorSheet)[decorImgKey];
      imgKeyToRect[decorImgKey] = { width: meta.width, height: meta.height, data: { ...meta, fileKey: baseName } };
    }
  }

  const { bins, width, height } = packRectangles(Object.values(imgKeyToRect), {
    logPrefix: 'createDecorSheetJson',
    packedPadding: imgOpts.packedPadding,
    // maxWidth: 200,
    // maxHeight: 200,
  });

  /** @type {Pick<Geomorph.SpriteSheet, 'decor' | 'maxDecorDim' | 'decorDims'>} */
  const json = ({
    decor: /** @type {*} */ ({}),
    maxDecorDim: { width, height },
    decorDims: bins.map(({ width, height }) => ({ width, height })),
  });

  for (const [binIndex, bin] of bins.entries()) {
    bin.rects.forEach(r => {
      const meta = /** @type {Geomorph.DecorSheetRectCtxt} */ (r.data);
      json.decor[meta.decorImgKey] = {
        ...meta,
        x: toPrecision(r.x),
        y: toPrecision(r.y),
        width: r.width,
        height: r.height,
        sheetId: binIndex,
      };
    });
  }

  // Overwrite initial/previous
  assets.sheet = { ...assets.sheet, ...json };

  return imgKeyToImg; // possibly partial
}

/**
 * Create the actual sprite-sheet PNG(s).
 * 
 * @param {Geomorph.AssetsJson} assets
 * @param {Partial<Record<Geomorph.DecorImgKey, import('canvas').Image>>} decorImgKeyToImage
 * @param {Prev} prev
 */
async function drawDecorSheet(assets, decorImgKeyToImage, prev) {
  const { decor: allDecor, decorDims } = assets.sheet;
  const ct = createCanvas(0, 0).getContext('2d');
  const prevDecor = prev.assets?.sheet.decor;
  
  // group global decor lookup by sheet
  const bySheetId = Object.values(allDecor).reduce((agg, d) => {
    (agg[d.sheetId] ??= /** @type {*} */ ({}))[d.decorImgKey] = d;
    return agg;
  }, /** @type {Geomorph.SpriteSheet['decor'][]} */ ([]));

  for (const [sheetId, decor] of bySheetId.entries()) {
    // 🔔 sheet-dependent, whereas texture array will have dimension `maxDecorDim`
    const { width, height } = decorDims[sheetId];
    ct.canvas.width = width;
    ct.canvas.height = height;

    for (const { x, y, width, height, decorImgKey } of Object.values(decor)) {
      const image = decorImgKeyToImage[decorImgKey];
      if (image) {
        info(`${decorImgKey} changed: redrawing...`);
        ct.drawImage(image, 0, 0, image.width, image.height, x, y, width, height);
      } else {
        // assume image available in previous sprite-sheet
        const prevItem = /** @type {Geomorph.SpriteSheet['decor']} */ (prevDecor)[decorImgKey];
        ct.drawImage(/** @type {import('canvas').Image} */ (prev.decorPngs[prevItem.sheetId]),
          prevItem.x, prevItem.y, prevItem.width, prevItem.height,
          x, y, width, height,
        );
      }
    }

    await saveCanvasAsFile(ct.canvas, `${baseDecorPath}.${sheetId}.png`);
  }
}

/**
 * @param {Geomorph.AssetsJson | null} [assets]
 */
function getDecorPngPaths(assets) {
  const numDecorSheets = assets?.sheet.decorDims.length ?? 0;
  return range(numDecorSheets).map(i => `${baseDecorPath}.${i}.png`);
}

//#endregion

//#region npcs

/**
 * 🔔 filename extension is 'glb' rather than 'gltf'
 * @returns {Geomorph.SpriteSheet['glbHash']}
 */
function computeGlbMetas() {
  const output = /** @type {Geomorph.SpriteSheet['glbHash']} */ ({});
  fs.readdirSync(assets3dDir).filter(
    (baseName) => baseName.endsWith(".glb")
  ).forEach((glbBaseName) => {
    const glbPath = path.resolve(assets3dDir, glbBaseName);
    const glbHash = hashText(fs.readFileSync(glbPath).toString());
    // 🔔 assume `{npcClassKey}.glb`
    const npcClassKey = /** @type {NPC.ClassKey} */ (glbBaseName.split('.')[0]);
    output[npcClassKey] = glbHash;
  });
  return output;
}

/**
 * lexicographically sorted, so that e.g.
 * `{npcClassKey}.0.tex.svg` is before `{npcClassKey}.1.tex.svg`
 * @returns {NPC.TexMeta[]}
 */
function getNpcTextureMetas() {
  return fs.readdirSync(npcDir).filter(
    (baseName) => baseName.endsWith(".tex.svg")
    // (baseName) => {
    //   const matched = baseName.match(/^(\S+)\.\d+\.tex\.svg$/);
    //   return matched !== null && matched[1] in helper.fromSkinClassKey;
    // }
  ).sort().map((svgBaseName) => {
    const svgPath = path.resolve(npcDir, svgBaseName);
    const { mtimeMs: svgMtimeMs } = fs.statSync(svgPath);
    const pngPath = path.resolve(assets3dDir, svgBaseName.slice(0, -'.svg'.length).concat('.png'));
    let pngMtimeMs = 0;
    try { pngMtimeMs = fs.statSync(pngPath).mtimeMs } catch {};
    // 🔔 assume `{skinClassKey}.{skinSheetId}.tex.svg`
    const [skinClassKey, skinSheetId] = svgBaseName.split('.');

    return {
      skinClassKey: /** @type {Geomorph.SkinClassKey} */ (skinClassKey),
      skinSheetId: Number(skinSheetId),
      svgBaseName,
      svgPath,
      pngPath,
      canSkip: svgMtimeMs < pngMtimeMs,
    };
  });
}

/**
 * Convert SVGs into PNGs.
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 */
async function createNpcTexturesAndUvMeta(assets, prev) {
  const { skin } = assets;
  const prevSvgHash = skin.svgHashes;
  
  // group by skinClassKey
  const bySkinClass = mapValues(helper.fromSkinClassKey, (_, skinClassKey) => {
    const npcTexMetas = prev.npcTexMetas.filter(x => x.skinClassKey === skinClassKey);
    return {
      skinClassKey,
      npcTexMetas,
      canSkip: skinClassKey in prevSvgHash && npcTexMetas.every(x => x.canSkip === true),
    };
  });

  for (const { skinClassKey, canSkip, npcTexMetas } of Object.values(bySkinClass)) {
    if (canSkip) {
      // console.log('🔔 skipping', skinClassKey);
      continue; // reuse e.g. skins.uvMap[skinClassKey]
    }

    // reset things we don't overwrite
    skin.numSheets[skinClassKey] = 0;
    skin.svgHashes[skinClassKey] = [];
    skin.uvMap[skinClassKey] = {};

    for (const { svgBaseName, svgPath, pngPath, skinSheetId } of npcTexMetas) {
      const svgContents = fs.readFileSync(svgPath).toString();

      // count sheets per class
      skin.numSheets[skinClassKey]++;
      
      // extract uv-mapping from top-level folder "uv-map"
      // merge sheets (must use distinct names in different SVGs for same skin)
      const { width, height, uvMap } = geomorph.parseUvMapRects(svgContents, skinSheetId, svgBaseName);
      Object.assign(skin.uvMap[skinClassKey] ??= {}, uvMap);
      skin.uvMapDim[skinClassKey] = { width, height };

      skin.svgHashes[skinClassKey].push(hashText(svgContents));
      
      // convert SVG to PNG
      const svgDataUrl = `data:image/svg+xml;utf8,${svgContents}`;
      const image = await loadImage(svgDataUrl);
      const canvas = createCanvas(image.width, image.height);
      canvas.getContext('2d').drawImage(image, 0, 0);
      await saveCanvasAsFile(canvas, pngPath);
    }
  }

  // recompute skins.texArrayId (linearly order all sheets)
  let nextTexArrayId = 0;
  skin.texArrayId = mapValues(skin.numSheets, (numSheets) => {
    const output = range(numSheets).map(i => nextTexArrayId + i);
    nextTexArrayId += output.length;
    return output;
  });

}

/**
 * @param {NPC.TexMeta[]} npcTexMetas
 */
function getSkinPngPaths(npcTexMetas) {
  return npcTexMetas.map(({ pngPath }) => pngPath);
}

//#endregion

/**
 * @typedef Prev
 * @property {Geomorph.AssetsJson | null} assets
 * @property {(import('canvas').Image | null)[]} obstaclePngs
 * @property {(import('canvas').Image | null)[]} decorPngs
 * @property {NPC.TexMeta[]} npcTexMetas
 * @property {boolean} skipMaps
 * @property {boolean} skipObstacles
 * @property {boolean} skipDecor
 * @property {boolean} skipNpcTex
 * @property {boolean} skipGltfs
 */

/**
 * Measure durations.
 * @param {string} label 
 * @param {string} [initMessage] 
 */
function perf(label, initMessage) {
  if (measuringLabels.has(label) === false) {
    performance.mark(`${label}...`); 
    measuringLabels.add(label);
    if (initMessage !== undefined) info(initMessage);
  } else {
    performance.mark(`...${label}`);
    performance.measure(label, `${label}...`, `...${label}`);
    measuringLabels.delete(label);
  }
}
