import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import debounce from "debounce";

import { defaultClassKey, maxNumberOfNpcs, npcClassToMeta } from "../service/const";
import { entries, isDevelopment, keys, mapValues, pause, range, takeFirst, warn } from "../service/generic";
import { computeMeshUvMappings, emptyAnimationMixer, toV3, toXZ } from "../service/three";
import { helper } from "../service/helper";
import { HumanZeroMaterial } from "../service/glsl";
import { createBaseNpc, NpcApi, crowdAgentParams, createNpc } from "./npc";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { geom, tmpVec1 } from "../service/geom";

/**
 * @param {Props} props
 */
export default function Npcs(props) {
  const w = React.useContext(WorldContext);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    byAgId: {},
    freeId: new Set(range(maxNumberOfNpcs)),
    gltf: /** @type {*} */ ({}),
    gltfAux: /** @type {*} */ ({}),
    group: /** @type {*} */ (null),
    idToKey: new Map(),
    sheetAux: /** @type {*} */ ({}),
    npc: {},
    physicsPositions: [],
    showLastNavPath: false, // 🔔 for debug

    attachAgent(npc) {
      if (npc.agent === null) {
        npc.agent = npc.w.crowd.addAgent(npc.position, {
          ...crowdAgentParams,
          maxSpeed: npc.s.run ? helper.defaults.runSpeed : helper.defaults.walkSpeed,
          queryFilterType: npc.w.lib.queryFilterType.respectUnwalkable,
        });
        npc.agentAnim = npc.w.crowd.raw.getAgentAnimation(npc.agent.agentIndex);

        state.byAgId[npc.agent.agentIndex] = npc;
      }
      return npc.agent;
    },
    findPath(src, dst) {// 🔔 agent only uses path as a guide
      const query = w.crowd.navMeshQuery;
      const { path, success } = query.computePath(src, dst, {
        filter: w.crowd.getFilter(helper.queryFilterType.respectUnwalkable),
        halfExtents: { x: 0.1, y: 0.1, z: 0.1 },
      });
      if (path.length === 0) {
        return path;
      }
      if (success === true && tmpVec1.copy(dst).distanceTo(path[path.length - 1]) < 0.1) {
        return path;
      }
      warn(`${'findPath'} failed: ${JSON.stringify({ src, dst })}`);
      return null;
    },
    forceUpdate() {
      const now = Date.now();
      Object.values(state.npc).forEach(npc => npc.epochMs = now)
      update();
    },
    getClosestNavigable(p, maxDelta = 0.5) {
      const { success, point: closest } = w.crowd.navMeshQuery.findClosestPoint(p, {
        // 🔔 ~ (2 * maxDelta) * (2 * smallHalfExtent) * (2 * maxDelta) search space
        halfExtents: { x: maxDelta, y: smallHalfExtent, z: maxDelta },
        filter: w.crowd.getFilter(w.lib.queryFilterType.respectUnwalkable),
      });

      if (success === true && p.distanceTo(closest) <= maxDelta) {
        return toV3(closest);
      }
      
      warn(`${'getClosestNavigable'} failed: ${JSON.stringify(p)}`);
      return null;
    },
    getNpc(npcKey, processApi) {
      const npc = processApi === undefined
        ? state.npc[npcKey]
        : undefined // 🚧 state.connectNpcToProcess(processApi, npcKey);
      ;
      if (npc === undefined) {
        throw Error(`npc "${npcKey}" does not exist`);
      } else {
        return npc;
      }
    },
    hotReloadNpcs() {
      const npcs = Object.values(state.npc);
      let hmrKeys = /**
        * @type {undefined | {
        *  add: (keyof NPC.BaseNPC)[];
        *  del: (keyof NPC.NPC)[];
        *  s: { add: (keyof NPC.BaseNPC['s'])[]; del: (keyof NPC.NPC['s'])[]; }
        * }}
        **/ (undefined);

      for (const npc of npcs) {
        const base = createBaseNpc(npc.def, w);

        // copy in new from `base`, delete old from `npc`, also for `s`
        // 🤔 we don't support type-change (should overwrite with base[x])
        if (hmrKeys === undefined) {
          // only compute keys to add/delete once
          hmrKeys = {
            add: keys(base).filter(x => !(x in npc) && Object.assign(npc, { [x]: base[x] })),
            del: keys(npc).filter(x => !(x in base) && delete npc[x]),
            s: {
              add: keys(base.s).filter(x => !(x in npc.s) && Object.assign(npc.s, { [x]: base.s[x] })),
              del: keys(npc.s).filter(x => !(x in base.s) && delete npc.s[x]),
            },
          };
        } else {
          hmrKeys.add.forEach(x => Object.assign(npc, { [x]: base[x] }));
          hmrKeys.del.forEach(x => delete npc[x]);
          hmrKeys.s.add.forEach(x => Object.assign(npc.s, { [x]: base.s[x] }));
          hmrKeys.s.del = keys(npc.s).filter(x => !(x in base.s) && delete npc.s[x])
        }

        npc.api = new NpcApi(npc, w); // replace NpcApi
        npc.epochMs = Date.now(); // invalidate React.Memo
        if (npc.agent !== null) {// avoid stale ref
          state.byAgId[npc.agent.agentIndex] = npc;
        }
        // track npc class meta
        npc.m.scale = npcClassToMeta[npc.def.classKey].scale;

        // 🚧 needed?
        // npc.applySkin();
        // npc.applyTint();
      }
    },

    isPointInNavmesh(input) {
      const v3 = toV3(input);
      const { success, point } = w.crowd.navMeshQuery.findClosestPoint(v3, { halfExtents: { x: smallHalfExtent, y: smallHalfExtent, z: smallHalfExtent } });
      return success === true && Math.abs(point.x - v3.x) < smallHalfExtent && Math.abs(point.z - v3.z) < smallHalfExtent;
    },
    onStuckNpc: null,
    onTick(deltaMs) {
      Object.values(state.npc).forEach(npc => npc.api.onTick(deltaMs, state.physicsPositions));
      // 🔔 Float32Array caused issues i.e. decode failed
      const positions = new Float64Array(state.physicsPositions);
      w.physics.worker.postMessage({ type: 'send-npc-positions', positions}, [positions.buffer]);
      state.physicsPositions.length = 0;
    },
    onTickIdleTurn: null,
    async restore() {// onchange nav-mesh restore agents
      const npcs = Object.values(state.npc).filter(x => x.agent !== null);
      const animKeys = npcs.map(x => x.s.act);
      npcs.forEach(npc => state.removeAgent(npc));

      await pause();

      for(const [i, npc] of npcs.entries()) {
        const agent = state.attachAgent(npc);
        const closest = state.getClosestNavigable(npc.position);
        if (closest === null) {// Agent outside nav keeps target but `Idle`s 
          npc.api.startAnimation(animKeys[i]);
        } else if (npc.s.target !== null) {
          npc.api.move({ to: toXZ(npc.s.target) });
        } else {// so they'll move "out of the way" of other npcs
          agent.requestMoveTarget(npc.position);
        }
      }
    },
    remove(...npcKeys) {
      try {
        for (const npcKey of npcKeys) {
          const npc = state.getNpc(npcKey); // throw if n'exist pas
          npc.api.cancel('removed'); // rejects promises
          state.removeAgent(npc);
          
          delete state.npc[npcKey];
          state.freeId.add(npc.def.uid);
          state.idToKey.delete(npc.def.uid);

          w.events.next({ key: 'removed-npc', npcKey });
        }
      } finally {
        update();
      }
    },
    removeAgent(npc) {
      if (npc.agent !== null) {
        npc.w.crowd.removeAgent(npc.agent.agentIndex);
        
        delete state.byAgId[npc.agent.agentIndex];
        npc.agent = null;
        npc.agentAnim = null;
        npc.s.offMesh = null;
      }
    },
    resolveSkin(shortcut) {
      // e.g. "soldier-0" maps all
      // e.g. "soldier-0///" only maps head, otherwise "base" skin
      // e.g. "soldier-0/-/-/-" only maps head, nothing else changed
      const parts = shortcut.split('/');
      const fallback = parts[parts.length - 1];
      const [head, body = fallback, headOverlay = fallback, bodyOverlay = fallback] = parts;
      return {
        ...head !== '-' && { "head-{front,back,left,right,top,bottom}": { prefix: head || 'base' } },
        ...body !== '-' && { "body-{front,back,left,right,top,bottom}": { prefix: body || 'base' } },
        ...headOverlay !== '-' && { "head-overlay-{front,back,left,right,top,bottom}": { prefix: headOverlay || 'base' } },
        ...bodyOverlay !== '-' && { "body-overlay-{front,back,left,right,top,bottom}": { prefix: bodyOverlay || 'base' } },
      };
    },
    setupSkins() {
      // 🔔 compute sheetAux e.g. uvMap
      // 🔔 compute gltfAux e.g. triangleId -> uvRectKey

      w.menu.measure(`npc.setupSkins`);
      for (const [npcClassKey, gltf] of entries(state.gltf)) {
        
        const meta = npcClassToMeta[npcClassKey];

        const mesh = /** @type {THREE.SkinnedMesh} */ (gltf.nodes[meta.meshName]);
        // get initial sheetId from orig material name e.g. human-0.0.tex.png
        const origMaterial = /** @type {THREE.MeshStandardMaterial} */ (mesh.material);
        const matBaseName = origMaterial.map?.name ?? null;
        const initSheetId = matBaseName === null ? 0 : (Number(matBaseName.split('.')[1]) || 0);

        const {
          uvMap: {[meta.npcClassKey]: uvMap},
          sheetTexId: {[meta.npcClassKey]: sheetTexIds},
        } = w.geomorphs.skin;

        state.sheetAux[npcClassKey] = {
          npcClassKey: meta.npcClassKey,
          sheetId: initSheetId,
          sheetTexIds,
          uvMap,
        };

        if (mesh.geometry.index !== null) {
          // 🔔 un-weld vertices so triangleId follows from vertexId
          mesh.geometry = mesh.geometry.toNonIndexed();
        }

        // 🔔 always recompute: either mesh or sheet might have changed
        const {
          triToUvKeys,
          partToUvRect,
          breathTriIds,
          labelTriIds,
          selectorTriIds,
        } = computeMeshUvMappings(mesh, uvMap, initSheetId);
        const labelUvRect = uvMap.default_label;

        state.gltfAux[npcClassKey] = {
          npcClassKey: meta.npcClassKey,
          breathTriIds,
          labelTriIds,
          selectorTriIds,
          labelUvRect4: labelUvRect
            ? [labelUvRect.x, labelUvRect.y, labelUvRect.width, labelUvRect.height]
            : [0, 0, 0, 0],
          partToUv: partToUvRect,
          triToKey: triToUvKeys,
          animHeights: mapValues(meta.modelAnimHeight, x => x * meta.scale),
          labelHeight: meta.modelLabelHeight * meta.scale,
        };
      }
      w.menu.measure(`npc.setupSkins`);
    },
    async spawn(opts) {
      const { at } = opts;
      const point = toXZ(at ?? {});

      if (!(typeof opts.npcKey === 'string' && /^[a-z0-9-_]+$/i.test(opts.npcKey))) {
        throw Error(`opts.npcKey must match /^[a-z0-9-_]+$/i`);
      } else if (opts.npcKey.length > 10) {
        throw Error(`opts.npcKey must have length ≤ 10`);
      } else if (!(typeof point?.x === 'number' && typeof point.y === 'number')) {
        throw Error(`opts.at must be a valid point`);
      }

      if (w.lib.isVectJson(opts.look) === true) {
        opts.look = toXZ(opts.look);
        opts.angle = geom.clockwiseFromNorth(opts.look.y - point.y, opts.look.x - point.x);
      }

      const dstNav = at.meta?.nav === true || state.isPointInNavmesh(point);
      /** Attach agent iff dst navigable */
      const agent = dstNav;

      if (dstNav === false && at.meta?.do !== true) {
        throw Error(`must spawn on navPoly or do point: ${JSON.stringify(at)}`);
      } else if (opts.classKey !== undefined && !w.lib.isNpcClassKey(opts.classKey)) {
        throw Error(`invalid classKey: ${JSON.stringify(at)}`);
      }
      
      const gmRoomId = w.gmGraph.findRoomContaining(point, true);
      if (gmRoomId === null) {
        throw Error(`must be in some room: ${JSON.stringify(at)}`);
      }

      let npc = state.npc[opts.npcKey];
      
      // prevent look e.g. if will Lie
      const nextAnimKey = helper.getAnimKeyFromMeta(at.meta ?? {});
      if (helper.canAnimKeyLook(nextAnimKey) === false) {
        opts.angle = opts.look = undefined;
      }

      opts.angle ??= typeof at.meta?.orient === 'number'
        ? at.meta.orient * (Math.PI / 180) // keep using "cw from north"
        : undefined
      ;

      if (npc !== undefined) {// Respawn
        npc.api.cancel('respawned');
        npc.epochMs = Date.now();
        npc.s.lookAngleDst = null;

        npc.def = {
          key: opts.npcKey,
          uid: npc.def.uid,
          angle: opts.angle ?? npc.api.getAngle(), // prev angle fallback
          classKey: opts.classKey ?? npc.def.classKey ?? defaultClassKey,
          runSpeed: opts.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: opts.walkSpeed ?? helper.defaults.walkSpeed,
        };

        // Reorder keys
        delete state.npc[opts.npcKey];
        state.npc[opts.npcKey] = npc;
      } else {
        
        // Spawn
        npc = state.npc[opts.npcKey] = createNpc({
          key: opts.npcKey,
          uid: takeFirst(state.freeId),
          angle: opts.angle ?? Math.PI/2, // default face along x axis
          classKey: opts.classKey ?? defaultClassKey,
          runSpeed: opts.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: opts.walkSpeed ?? helper.defaults.walkSpeed,
        }, w);
        state.idToKey.set(npc.def.uid, opts.npcKey);

        npc.api.initialize(state.gltf[npc.def.classKey]);
      }

      if (typeof opts.skin === 'string') {
        opts.skin = state.resolveSkin(opts.skin);
      }

      if (opts.skin !== undefined) {
        // 🔔 opts.skin keys may be brace-expansions (normalized by applySkin)
        Object.assign(npc.skin, opts.skin);
        npc.api.applySkin();
      }

      if (npc.s.spawns === 0) {
        await new Promise(resolve => {
          npc.resolve.spawn = resolve;
          update();
        });
      }
      
      // 🔔 input `p` can be Vect (x, y) or Vector3Like (x, y, z)
      const position = toV3(at);
      // 🔔 non-zero height must be set via `p.meta`
      position.y = typeof at.meta?.y === 'number' ? at.meta.y : 0;

      npc.position.copy(position);
      npc.rotation.y = npc.api.getEulerAngle(npc.def.angle);
      npc.lastTarget.copy(position);

      npc.api.startAnimation(at.meta ?? {}); // 🔔 at.meta.y important

      if (npc.agent === null) {
        if (agent === true) {
          const agent = state.attachAgent(npc);
          // 🔔 pin to current position
          agent.requestMoveTarget(position);
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
          state.byAgId[agent.agentIndex] = npc;
        }
      } else {
        if (dstNav === false || agent === false) {
          state.removeAgent(npc);
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
        } else {
          npc.agent.teleport(position);
        }
      }
      
      npc.s.spawns++;
      npc.s.doMeta = at.meta?.do === true ? at.meta : null;

      npc.s.offMesh = null;
      w.events.next({ key: 'spawned', npcKey: npc.key, gmRoomId });

      return npc;
    },
    tickOnceDebounced: debounce(() => {
      w.crowd.update(w.timer.getFixedDelta()); // agent may no longer exist
      state.onTick(1000 / 60);
      w.r3f.advance(Date.now()); // so they move
    }, 30, { immediate: true }),
    async tickOnceDebug() {
      state.onTick(1000 / 60);
      // delay render e.g. for paused npc selection
      await pause(100);
      w.r3f.advance(Date.now());
    },
    update,
  }), { reset: { showLastNavPath: true } });

  w.npc = state;
  w.n = state.npc;
  w.a = state.byAgId;
  
  // load meshes
  entries(npcClassToMeta).forEach(([npcClassKey, meta]) => {
    const { [npcClassKey]: hash } = w.geomorphs.sheet.glbHash;
    const cacheBustingQuery = isDevelopment() ? `?hash=${hash}` : '';
    state.gltf[npcClassKey] = useGLTF(`${meta.modelUrl}${cacheBustingQuery}`);
  });
  

  React.useEffect(() => {// hot reload each npc
    if (process.env.NODE_ENV === 'development') {
      state.hotReloadNpcs();
    }
  }, []);
  
  React.useEffect(() => {// onchange gltf or sheets
    state.setupSkins();

    Object.values(state.npc).forEach(npc => {
      // update stale ref
      npc.gltfAux = state.gltfAux[npc.def.classKey];

      // reinitialize if changed meshes
      if (npc.m.animations !== state.gltf[npc.def.classKey].animations) {
        npc.api.initialize(state.gltf[npc.def.classKey]);
        npc.mixer = emptyAnimationMixer; // overwritten on remount
        npc.epochMs = Date.now(); // invalidate cache
      }
    });

    update();
  }, [...Object.values(state.gltf), w.hash.sheets]);

  return (
    <group
      name="npcs"
      ref={state.ref('group')}
    >
      {Object.values(state.npc).map(npc =>
        // <NPC key={npc.key} npc={npc} />
        <MemoizedNPC
          key={npc.key}
          npc={npc}
          epochMs={npc.epochMs} // can invalidate memo
        />
      )}
    </group>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {{ [crowdAgentId: number]: NPC.NPC }} byAgId
 * @property {Set<number>} freeId Those npc object-pick ids not-currently-used.
 * @property {THREE.Group} group
 * @property {Record<Key.NpcClass, import("three-stdlib").GLTF & import("@react-three/fiber").ObjectMap>} gltf
 * //@property {{ [npcKey: string]: Npc }} npc
 * @property {{ [npcKey: string]: NPC.NPC }} npc
 * Custom callback to handle npc slow down.
 * We don't use an event because it can happen too often.
 * @property {number[]} physicsPositions
 * Format `[npc.bodyUid, npc.position.x, npc.position.y, npc.position.z, ...]`
 * @property {Map<number, string>} idToKey
 * Correspondence between object-pick ids and npcKeys.
 * @property {boolean} showLastNavPath
 *
 * @property {Record<Key.NpcClass, {
 *   npcClassKey: Key.NpcClass;
 *   sheetId: number;
 *   sheetTexIds: number[];
 *   uvMap: Geomorph.UvRectLookup;
 * }>} sheetAux
 * For each npcClassKey (a.k.a 3d model), its:
 * - `npcClassKey`
 * - initial `sheetId` relative to npcClassKey
 * - `sheetTexIds` (mapping from sheetId to DataTextureArray index)
 * - uv map `uvMap` (over all sheets)
 * @property {Record<Key.NpcClass, NPC.GltfAux>} gltfAux
 * For each npcClassKey (a.k.a 3d model), its:
 * - `npcClassKey`
 * - triangle ids `labelTriIds` corresponds to label quad
 * - initial mapping `partToUv` from skinPartKey to uvRect
 * - initial mapping `triToKey` from triangleId to { uvRectKey, skinPartKey }.
 *
 * @property {(npc: NPC.NPC) => NPC.CrowdAgent} attachAgent
 * @property {() => void} setupSkins
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {() => void} forceUpdate
 * @property {(npcKey: string, processApi?: any) => NPC.NPC} getNpc
 * @property {() => void} hotReloadNpcs
 * @property {(p: THREE.Vector3, maxDelta?: number) => null | THREE.Vector3} getClosestNavigable
 * @property {(input: Geom.VectJson | THREE.Vector3Like) => boolean} isPointInNavmesh
 * @property {() => void} restore
 * @property {null | ((npc: NPC.NPC, agent: NPC.CrowdAgent) => void)} onStuckNpc
 * @property {(deltaMs: number) => void} onTick
 * @property {null | ((npc: NPC.NPC, agent: NPC.CrowdAgent) => void)} onTickIdleTurn
 * Handle turning of idle npcs e.g. turn towards nearby npcs.
 * @property {(npcKey: string) => void} remove
 * @property {(npc: NPC.NPC) => void} removeAgent
 * @property {(shortcut: string) => Record<string, NPC.SkinReMapValue>} resolveSkin
 * Examples:
 * - `"soldier-0"`
 * - `"soldier-0//soldier-0/scientist-0"`
 * - `"soldier-0/-/-/-"`
 * @property {(opts: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * Examples (js):
 * ```js
 * spawn({ npcKey: "rob", x, y, meta })
 * spawn({ npcKey: "rob", skin: "soldier-0", x, y, z, meta })
 * spawn({ npcKey: "rob", classKey: "human-0", x, y, z, meta })
 * ```
 * @property {() => void} tickOnceDebounced
 * @property {() => Promise<void>} tickOnceDebug
 * @property {() => void} update
 * - Ensures incomingLabels i.e. does not replace.
 * - Returns `true` iff the label sprite-sheet had to be updated.
 * - Every npc label may need updating,
     avoidable by precomputing labels 
 */

/**
 * @param {NPCProps} props 
 */
function NPC({ npc }) {
  const { bones, mesh } = npc.m;

  return (
    <group
      key={npc.key}
      ref={npc.api.onMount.bind(npc.api)}
      scale={npc.m.scale}
      // dispose={null}
    >
      {/* <mesh position={[0, (physicsConfig.agentHeight / 2) * 1/npc.m.scale, 0]} scale={1/npc.m.scale} renderOrder={1}>
        <cylinderGeometry args={[physicsConfig.agentRadius, physicsConfig.agentRadius, physicsConfig.agentHeight, 32]} />
        <meshBasicMaterial color="red" transparent opacity={0.25} />
      </mesh> */}

      {bones.map((bone, i) => <primitive key={i} object={bone} />)}

      <skinnedMesh
        geometry={mesh.geometry}
        position={mesh.position}
        skeleton={mesh.skeleton}
        userData={mesh.userData}

        // 🔔 keep shader up-to-date e.g. onchange gltf
        key={`${HumanZeroMaterial.key} ${mesh.uuid}`}
        onUpdate={(skinnedMesh) => {
          npc.m.mesh = skinnedMesh; 
          npc.m.material = /** @type {THREE.ShaderMaterial} */ (skinnedMesh.material);
        }}

        renderOrder={0}
      >
        {/* <meshBasicMaterial color="red" /> */}
      
        <humanZeroMaterial
          key={HumanZeroMaterial.key}
          atlas={npc.w.texSkin.tex}
          aux={npc.w.texNpcAux.tex}
          globalAux={npc.w.texAux.tex}
          
          // diffuse={[1, 1, 1]}
          diffuse={[0.8, 0.8, 0.8]}
          label={npc.w.texNpcLabel.tex}
          labelY={npc.s.labelY}
          opacity={npc.s.opacity}
          transparent
          uid={npc.def.uid}

          // 🚧 move to w.texAux
          labelUvRect4={npc.gltfAux.labelUvRect4}
          breathTriIds={npc.gltfAux.breathTriIds}
          labelTriIds={npc.gltfAux.labelTriIds}
          selectorTriIds={npc.gltfAux.selectorTriIds}
        />
        
      </skinnedMesh>
    </group>
  )
}

/**
 * @typedef NPCProps
 * @property {NPC.NPC} npc
 */

/** @type {React.MemoExoticComponent<(props: NPCProps & { epochMs: number }) => React.JSX.Element>} */
const MemoizedNPC = React.memo(NPC);

useGLTF.preload(Object.values(npcClassToMeta).map(x => x.modelUrl));

const smallHalfExtent = 0.001;
