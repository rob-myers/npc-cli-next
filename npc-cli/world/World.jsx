import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Subject } from "rxjs";
import * as THREE from "three";
import { Timer } from "three-stdlib";

import { geom } from "../service/geom";
import { GmGraphClass } from "../graph/gm-graph";
import { GmRoomGraphClass } from "../graph/gm-room-graph";
import { floorTextureDimension, maxNumberOfNpcs, skinsLabelsTextureHeight, skinsLabelsTextureWidth, skinsTextureDimension, skinsUvsTextureWidth, texAuxDepth } from "../service/const";
import { debug, isDevelopment, removeFirst, pause, mapValues, range, entries, hashText } from "../service/generic";
import { getContext2d, invertCanvas, isSmallViewport } from "../service/dom";
import { queryCache, removeCached, setCached } from "../service/query-client";
import { fetchGeomorphsJson, getDecorSheetUrl, getNpcSkinSheetUrl, getObstaclesSheetUrl, WORLD_QUERY_FIRST_KEY } from "../service/fetch-assets";
import { geomorph } from "../service/geomorph";
import createGmsData from "../service/create-gms-data";
import { imageLoader } from "../service/three";
import { helper } from "../service/helper";
import { TexArray } from "../service/tex-array";
import { WorldContext } from "./world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import useHandleEvents from "./use-handle-events";
import WorldView from "./WorldView";
import Floor from "./Floor";
import Ceiling from "./Ceiling";
import Decor from "./Decor";
import Obstacles from "./Obstacles";
import Walls from "./Walls";
import Doors from "./Doors";
import Npcs from "./Npcs";
import Debug from "./Debug";
import WorldMenu from "./WorldMenu";
import WorldWorkers from "./WorldWorkers";

/**
 * @param {Props} props
 */
export default function World(props) {
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    key: props.worldKey,
    disabled: !!props.disabled,
    hash: /** @type {State['hash']} */ ({
      full: /** @type {*} */ (''),
    }),
    mapKey: props.mapKey,
    r3f: /** @type {*} */ (null),
    reqAnimId: 0,
    threeReady: false,
    timer: new Timer(),

    nav: /** @type {*} */ ({}),
    physics: { worker: /** @type {*} */ (null), bodyKeyToUid: {}, bodyUidToKey: {}, rebuilds: 0 },

    gmsData: /** @type {*} */ (null),
    events: new Subject(),
    geomorphs: /** @type {*} */ (null),
    gms: [],
    gmGraph: new GmGraphClass([]),
    gmRoomGraph: new GmRoomGraphClass(),
    hmr: /** @type {*} */ ({}),
    smallViewport: isSmallViewport(),

    // 🔔 hmr issue when initial width = height = 0
    texAux: new TexArray({ ctKey: 'aux', type: THREE.FloatType, numTextures: texAuxDepth, width: 1, height: 1 }),
    texFloor: new TexArray({ ctKey: 'floor-tex', numTextures: 1, width: floorTextureDimension, height: floorTextureDimension }),
    texFloorLight: new TexArray({ ctKey: 'floor-light-tex', numTextures: 1, width: floorTextureDimension, height: floorTextureDimension }),
    texCeil: new TexArray({ ctKey: 'ceil-tex', numTextures: 1, width: floorTextureDimension, height: floorTextureDimension }),
    texDecor: new TexArray({ ctKey: 'decor-tex', numTextures: 1, width: 0, height: 0 }),
    texObs: new TexArray({ ctKey: 'obstacle-tex', numTextures: 1, width: 0, height: 0 }),
    texNpcAux: new TexArray({ ctKey: 'skins-aux', type: THREE.FloatType, numTextures: maxNumberOfNpcs, width: skinsUvsTextureWidth, height: 2 }),
    texSkin: new TexArray({ ctKey: 'skins-tex', numTextures: 1, width: skinsTextureDimension, height: skinsTextureDimension }),
    texNpcLabel: new TexArray({ ctKey: 'skins-label', numTextures: maxNumberOfNpcs, width: skinsLabelsTextureWidth, height: skinsLabelsTextureHeight }),
    texVs: { floor: 0, ceiling: 0 }, // versions

    crowd: /** @type {*} */ (null),

    view: /** @type {*} */ (null),
    floor: /** @type {*} */ ({}),
    ceil: /** @type {*} */ ({}),
    decor: /** @type {*} */ (null),
    obs: /** @type {*} */ (null),
    wall: /** @type {*} */ ({}),
    door: /** @type {State['door']} */ ({
      onTick(_) {},
    }),
    npc: /** @type {*} */ (null), // Npcs
    menu: /** @type {State['menu']} */ ({ measure(_) {} }), // WorldMenu
    debug: /** @type {*} */ (null), // Debug
    bubble: /** @type {*} */ (null), // NpcSpeechBubbles
    cm: /** @type {*} */ (null),

    lib,

    e: /** @type {*} */ (null), // useHandleEvents
    n: {}, // w.npc.npc
    a: {}, // w.npc.byAgId
    d: {}, // w.door.byKey

    isReady(connectorKey) {
      const ready = state.crowd !== null && state.decor?.queryStatus === 'success';
      if (ready === true && typeof connectorKey === 'string') {
        // "connected" if connectorKey provided
        state.menu.onConnect(connectorKey);
      }
      return ready;
    },
    onTick() {
      state.reqAnimId = requestAnimationFrame(state.onTick);
      state.timer.update();
      const deltaMs = state.timer.getDelta();

      if (state.npc === null || state.r3f === null) {
        return; // wait for <NPCs>
      }

      state.crowd.update(deltaMs);
      state.npc.onTick(deltaMs);
      state.door.onTick(deltaMs);
      // console.info(state.r3f.gl.info.render);

      state.view.onTick(deltaMs);
    },
    stopTick() {
      cancelAnimationFrame(state.reqAnimId);
      state.reqAnimId = 0;
    },
    trackHmr(nextHmr) {
      const output = mapValues(state.hmr, (prev, key) => prev !== nextHmr[key])
      return state.hmr = nextHmr, output;
    },
    async update(mutator) {
      await mutator?.(state);
      update();
    },
    updateTexAux(partial) {
      const buffer = new Float32Array(4);
      for (const indexStr in partial) {
        buffer.set(partial[indexStr])
        state.texAux.updateIndex(Number(indexStr), new Float32Array(buffer));
      }
    },
  }), { reset: { lib: true, texFloor: false, texCeil: false } });

  state.disabled = !!props.disabled;

  useHandleEvents(state);

  const query = useQuery({
    queryKey: [WORLD_QUERY_FIRST_KEY, state.key, props.mapKey],
    queryFn: async () => {
      if (module.hot?.active === false) {
        return false; // Avoid query from disposed module
      }

      const prevGeomorphs = state.geomorphs;
      const geomorphsJson = await fetchGeomorphsJson(location.href);

      /**
       * Used to apply changes synchronously.
       * @type {Pick<State, 'geomorphs' | 'gms' | 'gmsData' | 'gmGraph' | 'gmRoomGraph' | 'hash' | 'mapKey'>}
       */
      const next = {
        // previous values (possibly overwritten below)
        geomorphs: prevGeomorphs,
        gms: state.gms,
        gmsData: state.gmsData,
        gmGraph: state.gmGraph,
        gmRoomGraph: state.gmRoomGraph,
        // next values
        hash: geomorph.computeHash(geomorphsJson, props.mapKey),
        mapKey: props.mapKey,
      };

      const dataChanged = !prevGeomorphs || state.hash.full !== next.hash.full;
      if (dataChanged === true) {
        next.geomorphs = geomorph.deserializeGeomorphs(geomorphsJson);
      }
      
      const mapChanged = dataChanged || state.mapKey !== props.mapKey;
      if (mapChanged === true) {
        next.mapKey = props.mapKey;
        const mapDef = next.geomorphs.map[next.mapKey];
        next.gms = mapDef.gms.map(({ gmKey, transform }, gmId) => 
          geomorph.computeLayoutInstance(next.geomorphs.layout[gmKey], gmId, transform)
        );
      }
      
      // 🔔 if this function changes we'll run the whole query
      const queryFnHash = hashText(queryCache.find({ queryKey: [WORLD_QUERY_FIRST_KEY], exact: false })?.options.queryFn?.toString() ?? '');
      const { createGmsData: gmsDataChanged, GmGraphClass: gmGraphChanged, queryFnHash: queryFnHashChanged } = state.trackHmr({
        createGmsData,
        GmGraphClass,
        queryFnHash,
      });

      
      if (mapChanged === true || gmsDataChanged === true) {
        next.gmsData = createGmsData();
        
        // ensure GmData per gmKey in map
        state.menu.measure('gmsData');
        const breathingSpaceMs = 100;
        for (const gmKey of new Set(next.gms.map(({ key }) => key))) {
          if (next.gmsData[gmKey].unseen) {
            await pause(breathingSpaceMs);
            await next.gmsData.computeGmData(next.geomorphs.layout[gmKey]);
          }
        };
        next.gmsData.computeRoot(next.gms);
        state.menu.measure('gmsData');
      }

      if (mapChanged) {
        const dimension = floorTextureDimension;
        state.texFloor.resize({ width: dimension, height: dimension, numTextures: next.gmsData.seenGmKeys.length });
        state.texFloorLight.resize({ width: dimension, height: dimension, numTextures: next.gmsData.seenGmKeys.length });
        state.texCeil.resize({ width: dimension, height: dimension, numTextures: next.gmsData.seenGmKeys.length });
        state.texVs.floor++; // e.g. fix edit const.js
        state.texVs.ceiling++;
      }
      
      if (mapChanged || gmsDataChanged || gmGraphChanged) {
        await pause();
        state.menu.measure('gmGraph');
        next.gmGraph = GmGraphClass.fromGms(next.gms, { permitErrors: true });
        state.menu.measure('gmGraph');
        next.gmGraph.w = state;
        
        await pause();
        state.menu.measure('gmRoomGraph');
        next.gmRoomGraph = GmRoomGraphClass.fromGmGraph(next.gmGraph, next.gmsData);
        state.menu.measure('gmRoomGraph');
      }

      // apply changes synchronously
      if (state.gmGraph !== next.gmGraph) {
        state.gmGraph.dispose();
        state.gmRoomGraph.dispose();
      }
      if (dataChanged || gmsDataChanged) {
        // only when GmData lookup has been rebuilt
        state.gmsData?.dispose();
      }
      Object.assign(state, next);
      debug({
        prevGeomorphs: !!prevGeomorphs,
        dataChanged,
        mapChanged,
        gmsDataChanged,
        gmGraphChanged,
        hash: state.hash,
      });

      if (!dataChanged && !queryFnHashChanged) {
        update();
        return true;
      }

      // Update texture arrays: decor, obstacles, skins
      const {
        sheet: { decorDims, maxDecorDim, obstacleDims, maxObstacleDim },
        skin,
      } = state.geomorphs;

      for (const { src, dim, texArray, invert } of [
        {
          src: decorDims.map((_, sheetId) => getDecorSheetUrl(sheetId)),
          texArray: state.texDecor,
          dim: maxDecorDim, 
          invert: false,
        },
        {
          src: obstacleDims.map((_, sheetId) => getObstaclesSheetUrl(sheetId)),
          texArray: state.texObs,
          dim: maxObstacleDim, 
          invert: true,
        },
        {
          src: entries(skin.numSheets).flatMap(([npcClassKey, skinSheetCount]) =>
            range(skinSheetCount).map(sheetId => getNpcSkinSheetUrl(npcClassKey, sheetId))
          ),
          texArray: state.texSkin,
          dim: { width: skinsTextureDimension, height: skinsTextureDimension },
          invert: false,
        },
      ]) {
        texArray.resize({ width: dim.width, height: dim.height, numTextures: src.length });
        texArray.tex.anisotropy = state.r3f.gl.capabilities.getMaxAnisotropy();

        await Promise.all(src.map(async (url, texId) => {
          const img = await imageLoader.loadAsync(url);
          texArray.ct.clearRect(0, 0, dim.width, dim.height);
          texArray.ct.drawImage(img, 0, 0);
          invert && invertCanvas(texArray.ct.canvas, getContext2d('invert-copy'), getContext2d('invert-mask'));
          texArray.updateIndex(texId);
          // texArray.tex.wrapS = THREE.RepeatWrapping;
          // texArray.tex.wrapT = THREE.RepeatWrapping;
        }));

        texArray.update();
        update();
      }

      state.texNpcLabel.tex.anisotropy = state.r3f.gl.capabilities.getMaxAnisotropy();

      state.npc?.forceUpdate(); // violate <MemoizedNPC>

      return true;
    },
    refetchOnWindowFocus: isDevelopment() ? "always" : false,
    // refetchOnWindowFocus: false,
    enabled: state.threeReady, // 🔔 fixes horrible reset issue on mobile
    gcTime: 0, // concurrent queries with different mapKey can break HMR
    throwOnError: true, // Very useful for debugging
    networkMode: isDevelopment() ? 'always' : 'online',
  });

  React.useEffect(() => {// provide world for tty
    setCached([props.worldKey], state);
    return () => removeCached([props.worldKey]);
  }, []);

  React.useEffect(() => {// hmr query
    if (query.data === false && query.isRefetching === false) {
      query.refetch();
    }
  }, [query.data === false]);

  React.useEffect(() => {// enable/disable
    state.timer.reset();
    state.view.syncRenderMode();
    if (!state.disabled) {
      state.onTick();
      state.view.didTweenPaused = false;
    }
    state.events.next({ key: state.disabled ? 'disabled' : 'enabled' });
    return () => state.stopTick();
  }, [state.disabled]);

  return (
    <WorldContext.Provider value={state}>
      <WorldView disabled={props.disabled} stats>
        {state.geomorphs && (
          <group>
            <React.Suspense>
              {state.crowd && <>
                <Decor />
                <Npcs />
                <Debug
                  // showNavMesh
                  // showOrigNavPoly
                  // showStaticColliders
                />
              </>}
            </React.Suspense>
            <Floor />
            <group visible={state.crowd !== null}>
              <Ceiling />
              <Walls />
              <Doors />
              <Obstacles />
            </group>
          </group>
        )}
      </WorldView>
      <WorldMenu setTabsEnabled={props.setTabsEnabled} />
      <WorldWorkers />
    </WorldContext.Provider>
  );
}

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps & {
 *   mapKey: keyof import('../../public/geomorphs.json')['map'];
 *   worldKey: string;   
 * }} Props
 */

/**
 * @typedef State
 * @property {string} key This is `props.worldKey` and never changes
 * @property {boolean} disabled
 * @property {string} mapKey
 * @property {Geomorph.GeomorphsHash} hash
 * @property {Geomorph.GmsData} gmsData
 * Data determined by `w.gms` or a `Key.Geomorph`.
 * - A geomorph key is "non-empty" iff `gmsData[gmKey].wallPolyCount` non-zero.
 * @property {{
 *   createGmsData: typeof createGmsData;
 *   GmGraphClass: typeof GmGraphClass;
 *   queryFnHash: number;
 * }} hmr
 * Change-tracking for Hot Module Reloading (HMR) only
 * @property {Subject<NPC.Event>} events
 * @property {Geomorph.Geomorphs} geomorphs
 * @property {boolean} threeReady
 * @property {number} reqAnimId
 * @property {import("@react-three/fiber").RootState & { camera: THREE.PerspectiveCamera }} r3f
 * @property {Timer} timer
 *
 * @property {{
 *   worker: WW.NavWorker;
 *   offMeshDefs: import("recast-navigation").OffMeshConnectionParams[];
 *   offMeshLookup: NPC.SrcToOffMeshLookup;
 *   doorToOffMesh: NPC.DoorToOffMeshLookup;
 * } & NPC.TiledCacheResult} nav
 * @property {{ worker: WW.PhysicsWorker; rebuilds: number; } & import("../service/rapier").PhysicsBijection} physics
 *
 * @property {import('./WorldView').State} view
 * @property {import('./Floor').State} floor
 * @property {import('./Ceiling').State} ceil
 * @property {import('./Decor').State} decor
 * @property {import('./Obstacles').State} obs
 * @property {import('./Walls').State} wall
 * @property {import('./Doors').State} door
 * @property {import('./Npcs').State} npc
 * Npcs (dynamic)
 * @property {import('./WorldMenu').State} menu
 * @property {import("./NpcSpeechBubbles").State} bubble
 * Npc speech bubbles
 * @property {import('./Debug').State} debug
 * @property {StateUtil & import("../service/helper").Helper} lib
 *
 * @property {import("./use-handle-events").State} e
 * Events state i.e. useHandleEvents state
 * @property {import("./Npcs").State['npc']} n
 * Shortcut for `w.npc.npc`
 * @property {import("./Npcs").State['byAgId']} a
 * Shortcut for `w.npc.byAgId`
 * @property {import("./Doors").State['byKey']} d
 * Shortcut for `w.door.byKey`
 * @property {import('./ContextMenu').State} cm
 *
 * @property {TexArray} texAux
 * @property {TexArray} texCeil
 * @property {TexArray} texDecor
 * @property {TexArray} texFloor
 * @property {TexArray} texFloorLight
 * @property {TexArray} texObs
 * @property {TexArray} texSkin skin texels, one pre skin
 * @property {TexArray} texNpcAux uv re-mapping and skin tinting, one per npc
 * @property {TexArray} texNpcLabel label texels, one per npc
 * @property {{ floor: number; ceiling: number; }} texVs
 * @property {Geomorph.LayoutInstance[]} gms
 * Aligned to `map.gms`.
 * Only populated for geomorph keys seen in some map.
 * @property {GmGraphClass} gmGraph
 * @property {GmRoomGraphClass} gmRoomGraph
 * @property {import('@recast-navigation/core').Crowd} crowd
 * @property {boolean} smallViewport Was viewport small when we mounted World?
 *
 * @property {() => void} onTick
 * @property {(connectorKey?: string) => boolean} isReady
 * @property {() => void} stopTick
 * @property {(next: State['hmr']) => Record<keyof State['hmr'], boolean>} trackHmr
 * Has function `createGmsData` changed?
 * @property {(mutator?: (w: State) => void | Promise<void>) => void} update
 * @property {(partial: Record<number, [number, number, number, number]>) => void} updateTexAux
 */

/**
 * @typedef StateUtil Utility functions and classes
 * @property {typeof geom['radRange']} radRange
 * @property {typeof removeFirst} removeFirst
 */

const lib = {
  removeFirst,
  radRange: geom.radRange,
  ...helper,
};
