import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import debounce from "debounce";

import { defaultClassKey, maxNumberOfNpcs, npcClassToMeta } from "../service/const";
import { entries, isDevelopment, jsStringify, keys, mapValues, pause, range, takeFirst, warn } from "../service/generic";
import { computeMeshUvMappings, emptyAnimationMixer, toV3 } from "../service/three";
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
    doToNpc: {},
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
        npc.agent = w.crowd.addAgent(npc.position, {
          ...crowdAgentParams,
          maxSpeed: npc.s.run ? helper.defaults.runSpeed : helper.defaults.walkSpeed,
          queryFilterType: helper.queryFilterType.respectUnwalkable,
        });
        npc.agentAnim = w.crowd.raw.getAgentAnimation(npc.agent.agentIndex);

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
        filter: w.crowd.getFilter(helper.queryFilterType.respectUnwalkable),
      });

      if (success === true && p.distanceTo(closest) <= maxDelta) {
        return new THREE.Vector3(closest.x, 0, closest.z);
      }
      
      warn(`${'getClosestNavigable'} failed: ${JSON.stringify(p)}`);
      return null;
    },
    getNpc(npcKey) {
      const npc = state.npc[npcKey];
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
    onTick(deltaSecs) {
      Object.values(state.npc).forEach(npc => npc.api.onTick(deltaSecs, state.physicsPositions));
      // 🔔 Float32Array caused issues i.e. decode failed
      const positions = new Float64Array(state.physicsPositions);
      w.physics.worker.postMessage({ type: 'send-npc-positions', positions}, [positions.buffer]);
      state.physicsPositions.length = 0;
    },
    onTickIdleTurn: null,
    async restore() {// onchange nav-mesh restore agents
      const npcs = Object.values(state.npc).filter(x => x.agent !== null);
      const animKeys = npcs.map(x => x.s.anim);
      npcs.forEach(npc => state.removeAgent(npc));

      w.crowd.update(w.timer.getFixedDelta());
      await pause();

      for(const [i, npc] of npcs.entries()) {
        const agent = state.attachAgent(npc);
        const closest = state.getClosestNavigable(npc.position);
        if (closest === null) {// Agent outside nav keeps target but `Idle`s 
          npc.api.startAnimation(animKeys[i]);
        } else if (npc.s.target !== null) {
          npc.api.move({ to: npc.api.getRemainingPath() });
        } else {// pin them to current position
          agent.requestMoveTarget(npc.position);
        }
      }
    },
    remove(...npcKeys) {
      const npcs = npcKeys.map(x => state.npc[x]).filter(Boolean);
      for (const npc of npcs) {
        npc.api.cancel('removed'); // rejects promises
        state.removeAgent(npc);
        
        delete state.npc[npc.key];
        state.freeId.add(npc.def.uid);
        state.idToKey.delete(npc.def.uid);
        if (npc.s.doMeta !== null) {
          const { doPoint, y } = npc.s.doMeta;
          delete state.doToNpc[`${doPoint.x},${y ?? 0},${doPoint.y}`];
        }
      }
      w.events.next({ key: 'removed-npcs', npcKeys: npcs.map(x => x.key) });
    },
    removeAgent(npc) {
      if (npc.agent !== null) {
        w.crowd.removeAgent(npc.agent.agentIndex);
        
        delete state.byAgId[npc.agent.agentIndex];
        npc.agent = null;
        npc.agentAnim = null;
        npc.s.offMesh = null;
      }
    },
    resolveSkin(shortcut) {// order: head,head-overlay,body,body-overlay
      const parts = shortcut.split(',');
      const head = parts[0] || undefined;
      const fallback = parts.length === 1 ? head : undefined;
      const headOverlay = parts.length > 1 && (parts[1] || parts[0]) || fallback;
      const body = parts.length > 2 && (parts[2] || parts[0] || parts[1]) || fallback;
      const bodyOverlay = parts.length > 3 && (parts[3] || parts[2] || parts[0] || parts[1]) || fallback;
      return {
        ...head !== undefined && { "head-{front,back,left,right,top,bottom}": { prefix: head} },
        ...headOverlay !== undefined && { "head-overlay-{front,back,left,right,top,bottom}": { prefix: headOverlay} },
        ...body !== undefined && { "body-{front,back,left,right,top,bottom}": { prefix: body} },
        ...bodyOverlay !== undefined && { "body-overlay-{front,back,left,right,top,bottom}": { prefix: bodyOverlay} },
      };
    },
    setDoMeta(npcKey, doMeta) {
      const npc = w.n[npcKey];

      if (npc.s.doMeta !== null) {
        const { doPoint, y } = npc.s.doMeta;
        delete state.doToNpc[`${doPoint.x},${y ?? 0},${doPoint.y}`];
      }

      if (doMeta === null) {
        npc.s.doMeta = null;
      } else {
        const { doPoint, y } = doMeta;
        const key = /** @type {const} */ (`${doPoint.x},${y ?? 0},${doPoint.y}`);
        state.doToNpc[key] = npcKey;
        npc.s.doMeta = doMeta;
      }
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

      if (!(typeof at?.x === 'number' && typeof at.y === 'number')) {
        throw Error(`opts.at must be {x,y} or {x,y,z}`);
      }

      const point = helper.toXZ(at);
      const meta = opts.meta ?? at.meta ?? {};

      if (!(typeof opts.npcKey === 'string' && /^[a-z0-9-_]+$/i.test(opts.npcKey))) {
        throw Error(`opts.npcKey must match /^[a-z0-9-_]+$/i`);
      } else if (opts.npcKey.length > 10) {
        throw Error(`opts.npcKey must have length ≤ 10`);
      }
      
      if (helper.isVectJson(opts.facing) === true) {
        opts.facing = helper.toXZ(opts.facing);
        opts.angle = geom.clockwiseFromNorth(opts.facing.y - point.y, opts.facing.x - point.x);
      }

      const dstNav = meta.nav === true || state.isPointInNavmesh(point);
      const attachAgent = dstNav;

      if (dstNav === false && meta.do !== true) {
        throw Error(`not navigable nor doable: ${jsStringify(point)} (height ${'z' in at ? at.y : 0})`);
      } else if (opts.classKey !== undefined && !helper.isNpcClassKey(opts.classKey)) {
        throw Error(`invalid classKey: ${JSON.stringify(at)}`);
      }
      
      const gmRoomId = w.gmGraph.findRoomContaining(point, true);
      if (gmRoomId === null) {
        throw Error(`must be in some room: ${JSON.stringify(at)}`);
      }

      state.validateDoMeta(meta.do === true ? meta : null);
      
      let npc = state.npc[opts.npcKey];

      if (npc === undefined && state.freeId.size === 0) {
        throw Error(`max npcs reached: ${maxNumberOfNpcs}`);
      }

      // prevent look e.g. if will Lie
      const nextAnimKey = helper.getAnimKeyFromMeta(meta);
      if (helper.canAnimKeyLook(nextAnimKey) === false) {
        opts.angle = opts.facing = undefined;
      }

      opts.angle ??= typeof meta.orient === 'number'
        ? meta.orient * (Math.PI / 180) // keep using "cw from north"
        : undefined
      ;

      if (npc !== undefined) {
        
        // Respawn
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

      state.setDoMeta(opts.npcKey, meta.do === true ? meta : null);

      if (typeof opts.as === 'string') {
        opts.as = state.resolveSkin(opts.as);
      }

      if (opts.as !== undefined) {
        // 🔔 opts.skin keys may be brace-expansions (normalized by applySkin)
        Object.assign(npc.skin, opts.as);
        npc.api.applySkin();
      }

      if (npc.s.spawns === 0) {
        await new Promise(resolve => {
          npc.resolve.spawn = resolve;
          update();
        });
      }
      
      const position = toV3(at);
      // 🔔 non-zero height must be set via `meta.y`
      position.y = typeof meta.y === 'number' ? meta.y : 0;

      npc.position.copy(position);
      npc.rotation.y = npc.api.getEulerAngle(npc.def.angle);
      npc.lastTarget.copy(position);

      const forceStartAnim = npc.s.spawns === 0;
      npc.api.startAnimation(meta, forceStartAnim); // 🔔 at.meta.y important

      if (npc.agent === null) {
        if (attachAgent === true) {
          const agent = state.attachAgent(npc);
          // 🔔 pin to current position
          agent.requestMoveTarget(position);
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
          state.byAgId[agent.agentIndex] = npc;
        }
      } else {
        if (dstNav === false || attachAgent === false) {
          state.removeAgent(npc);
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
        } else {
          npc.agent.teleport(position);
        }
      }
      
      npc.s.spawns++;
      npc.s.offMesh = null;
      w.events.next({ key: 'spawned', npcKey: npc.key, gmRoomId });

      return npc;
    },
    async spawnMany(opts) {// 🔔 no validation
      const baseKey = opts.baseKey ?? 'npc';
      
      const numPermitted = maxNumberOfNpcs - state.idToKey.size;
      /** {x,y} or {x,y,z} possibly with meta  */
      const groundPoints = opts.points.slice(0, numPermitted);
      const preNpcKeys = groundPoints.map((_, i) => opts.keys?.[i]);
      /** Ground point either has act meta or we assume it is navigable */
      const doMetas = groundPoints.map(p => p.meta?.do === true && helper.isVectJson(p.meta.doPoint) ? p.meta : null);
      
      const angles = groundPoints.map((p, i) => {
        if (typeof p.meta?.orient === 'number') {
          return p.meta.orient * (Math.PI / 180);
        } else {
          const look = helper.isVectJson(opts.looks?.[i]) ? helper.toXZ(opts.looks[i]) : opts.looks?.[i];
          const { x, y} = helper.toXZ(p);
          return helper.isVectJson(look) ? geom.clockwiseFromNorth(look.y - y, look.x - x) : Math.PI/2;
        }
      });
      
      const npcs = /** @type {NPC.NPC[]} */ ([]);

      // initialize all
      for (const [i, preNpcKey] of preNpcKeys.entries()) {
        const doMeta = doMetas[i];
        // fallback npcKey uses 1st freeId
        const freeId = takeFirst(state.freeId);
        const npcKey = preNpcKey ?? `${baseKey}_${freeId}`;
        let npc = state.npc[npcKey];
        
        if (npc === undefined) {// spawn
          npc = state.npc[npcKey] = createNpc({
            key: npcKey,
            uid: freeId,
            angle: angles[i],
            classKey: defaultClassKey,
            runSpeed: helper.defaults.runSpeed,
            walkSpeed: helper.defaults.walkSpeed,
          }, w);

          state.idToKey.set(npc.def.uid, npcKey);
          npc.api.initialize(state.gltf[npc.def.classKey]);
        } else {// respawn
          state.freeId.add(freeId); // put it back
          npc.api.cancel('respawned');
          npc.epochMs = Date.now();
          npc.s.lookAngleDst = null;
  
          npc.def = {
            key: npcKey,
            uid: npc.def.uid,
            angle: npc.api.getAngle(), // prev angle fallback
            classKey: npc.def.classKey,
            runSpeed: helper.defaults.runSpeed,
            walkSpeed: helper.defaults.walkSpeed,
          };

          // Reorder keys
          delete state.npc[npcKey];
          state.npc[npcKey] = npc;
        }

        if (doMeta !== null) {
          state.setDoMeta(npcKey, doMeta);
        }
        npcs.push(npc);
      }

      // mount all
      pause().then(update);
      await Promise.all(npcs.map(npc => new Promise(resolve => npc.resolve.spawn = resolve)));

      // finish setup all
      for (const [i, point] of groundPoints.entries()) {
        const position = toV3(point);
        position.y = typeof point.meta?.y === 'number' ? point.meta.y : 0;
        
        const npc = npcs[i];
        npc.position.copy(position);
        npc.rotation.y = npc.api.getEulerAngle(npc.def.angle);
        npc.lastTarget.copy(position);
        const forceStartAnim = npc.s.spawns === 0;
        npc.api.startAnimation(point.meta ?? {}, forceStartAnim);

        // attach/detach agents
        const doMeta = doMetas[i];
        const attachAgent = doMeta === null;
        if (npc.agent === null) {
          if (attachAgent === true) {
            const agent = state.attachAgent(npc);
            agent.requestMoveTarget(position);
            state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
            state.byAgId[agent.agentIndex] = npc;
          }
        } else {
          if (attachAgent === false) {
            state.removeAgent(npc);
            state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
          } else {
            npc.agent.teleport(position);
          }
        }

        npc.s.spawns++;
        npc.s.offMesh = null;
      }

      w.events.next({ key: 'spawned-many', npcKeys: npcs.map(npc => npc.key) });
    },
    // Paused spawn is debounced
    tickOnceSpawn: debounce(() => {
      // re-spawn outside nav removes agent, so must update crowd
      w.crowd.update(w.timer.getFixedDelta());
      state.onTick(1 / 60);
      w.view.ensureRender();
    }, 300, { immediate: true }),
    async tickOnceDebug() {
      state.onTick(1 / 60);
      await pause(100); // delay render e.g. for paused npc selection
      w.view.ensureRender();
    },
    update,
    validateDoMeta(doMeta) {
      if (doMeta === null) {
        return;
      }

      if (!helper.isVectJson(doMeta.doPoint)) {
        throw Error(`doMeta.doPoint must exist: ${jsStringify(doMeta)}`);
      }

      const { doPoint, y } = doMeta;
      const key = /** @type {const} */ (`${doPoint.x},${y ?? 0},${doPoint.y}`);
      if (key in state.doToNpc) {
        throw Error(`actable used by ${state.doToNpc[key]}: ${jsStringify(doMeta.doPoint)} (height ${y})`);
      }
    },
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
 * @property {Record<`${number},${number},${number}`, string>} doToNpc
 * Act point to current npc or undefined.
 * - `${x},${y},${z}` -> npcKey
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
 * @property {(npcKey: string) => NPC.NPC} getNpc
 * @property {() => void} hotReloadNpcs
 * @property {(p: THREE.Vector3, maxDelta?: number) => null | THREE.Vector3} getClosestNavigable
 * @property {(input: Geom.VectJson | THREE.Vector3Like) => boolean} isPointInNavmesh
 * @property {() => void} restore
 * @property {null | ((npc: NPC.NPC, agent: NPC.CrowdAgent) => void)} onStuckNpc
 * @property {(deltaSecs: number) => void} onTick
 * @property {null | ((npc: NPC.NPC, agent: NPC.CrowdAgent) => void)} onTickIdleTurn
 * Handle turning of idle npcs e.g. turn towards nearby npcs.
 * @property {(npcKey: string) => void} remove
 * @property {(npc: NPC.NPC) => void} removeAgent
 * @property {(shortcut: string) => Record<string, NPC.SkinReMapValue>} resolveSkin
 * Examples:
 * - `base` `soldier-0`, `suit-0` each remap all
 * - `soldier-0,` remaps head and head-overlay
 * - `,,soldier-0,` remaps body and body-overlay
 * @property {(npcKey: string, doMeta: null | Meta) => void} setDoMeta
 * @property {(opts: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * Examples (js):
 * ```js
 * spawn({ npcKey: "rob", x, y, meta })
 * spawn({ npcKey: "rob", as: "soldier-0", x, y, z, meta })
 * spawn({ npcKey: "rob", classKey: "human-0", x, y, z, meta })
 * ```
 * @property {(opts: NPC.SpawnManyOpts) => Promise<void>} spawnMany
 * @property {() => void} tickOnceSpawn
 * @property {() => Promise<void>} tickOnceDebug
 * @property {() => void} update
 * - Ensures incomingLabels i.e. does not replace.
 * - Returns `true` iff the label sprite-sheet had to be updated.
 * - Every npc label may need updating,
     avoidable by precomputing labels 
 * @property {(doMeta: null | Meta) => void} validateDoMeta
 * Throws if `doMeta` lacks `doPoint` or is in use.
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
        // renderOrder={5}
        renderOrder={0}
      >
        {/* <meshBasicMaterial color="red" /> */}
      
        <humanZeroMaterial
          key={HumanZeroMaterial.key}
          atlas={npc.w.texSkin.tex}
          aux={npc.w.texNpcAux.tex}
          globalAux={npc.w.texAux.tex}
          
          diffuse={[1, 1, 1]}
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
