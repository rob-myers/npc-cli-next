import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import debounce from "debounce";

import { defaultClassKey, gmLabelHeightSgu, maxNumberOfNpcs, npcClassKeys, npcClassToMeta, physicsConfig, spriteSheetDecorExtraScale, wallHeight } from "../service/const";
import { mapValues, pause, range, takeFirst, warn } from "../service/generic";
import { getCanvas } from "../service/dom";
import { createLabelSpriteSheet, emptyTexture, textureLoader, toV3, toXZ } from "../service/three";
import { helper } from "../service/helper";
import { cmUvService } from "../service/uv";
import { CuboidManMaterial, HumanZeroShader } from "../service/glsl";
import { getNpcSkinSheetUrl } from "../service/fetch-assets";
import { crowdAgentParams, Npc } from "./npc";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

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
    group: /** @type {*} */ (null),
    idToKey: new Map(),
    label: {
      count: 0,
      lookup: {},
      tex: new THREE.CanvasTexture(getCanvas(`${w.key} npc.label`)),
    },
    npc: {},
    onStuckCustom: null,
    physicsPositions: [],
    tex: /** @type {*} */ ({}), // 🚧 old
    showLastNavPath: false, // 🔔 for debug
    skinTriMap: /** @type {*} */ ({}),

    attachAgent(npc) {
      if (npc.agent === null) {
        npc.agent = npc.w.crowd.addAgent(npc.position, {
          ...crowdAgentParams,
          maxSpeed: npc.s.run ? helper.defaults.runSpeed : helper.defaults.walkSpeed,
          queryFilterType: npc.w.lib.queryFilterType.excludeDoors,
        });
        npc.agentAnim = npc.w.crowd.raw.getAgentAnimation(npc.agent.agentIndex);

        state.byAgId[npc.agent.agentIndex] = npc;
      }
      return npc.agent;
    },
    clearLabels() {
      w.menu.measure('npc.clearLabels');
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;
      createLabelSpriteSheet([], state.label, { fontHeight });
      state.tex.labels = state.label.tex;
      // 🔔 warns from npc with non-null label
      Object.values(state.npc).forEach(npc => cmUvService.updateLabelQuad(npc));
      w.menu.measure('npc.clearLabels');
    },
    drawUvReMap(npc, opts) {
      // 🚧 one pixel per triangle
      // 🚧 hard-coded swap i.e. remap base-head-overlay-front -> confused-head-overlay-front
    },
    findPath(src, dst) {// 🔔 agent only use path as a guide
      const query = w.crowd.navMeshQuery;
      const { path, success } = query.computePath(src, dst, {
        filter: w.crowd.getFilter(0),
      });
      if (success === false) {
        warn(`${'findPath'} failed: ${JSON.stringify({ src, dst })}`);
      }
      return success === false || path.length === 0 ? null : path;
    },
    forceUpdate() {
      const now = Date.now();
      Object.values(state.npc).forEach(npc => npc.epochMs = now)
      update();
    },
    getClosestNavigable(p, maxDelta = 0.5) {
      const { success, point: closest } = w.crowd.navMeshQuery.findClosestPoint(p, {
        // 🔔 maxDelta "means" ~ (2 * maxDelta) * (2 * smallHalfExtent) * (2 * maxDelta) search space
        halfExtents: { x: maxDelta, y: smallHalfExtent, z: maxDelta },
        // filter: w.crowd.getFilter(w.lib.queryFilterType.excludeDoors),
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
    hotReloadNpc(prevNpc) {
      // 🔔 HMR by copying prevNpc non-methods into nextNpc
      const nextNpc = state.npc[prevNpc.key] = Object.assign(new Npc(prevNpc.def, w), {...prevNpc});
      // invalidate React.Memo
      nextNpc.epochMs = Date.now();
      // avoid stale ref
      if (nextNpc.agent !== null) {
        state.byAgId[nextNpc.agent.agentIndex] = nextNpc;
      }
      // track npc class meta 🚧 other properties?
      nextNpc.m.scale = npcClassToMeta[nextNpc.def.classKey].scale;
      prevNpc.dispose();
    },
    isPointInNavmesh(input) {
      const v3 = toV3(input);
      const { success, point } = w.crowd.navMeshQuery.findClosestPoint(v3, { halfExtents: { x: smallHalfExtent, y: smallHalfExtent, z: smallHalfExtent } });
      return success === true && Math.abs(point.x - v3.x) < smallHalfExtent && Math.abs(point.z - v3.z) < smallHalfExtent;
    },
    onTick(deltaMs) {
      Object.values(state.npc).forEach(npc => npc.onTick(deltaMs, state.physicsPositions));
      // 🔔 Float32Array caused issues i.e. decode failed
      const positions = new Float64Array(state.physicsPositions);
      w.physics.worker.postMessage({ type: 'send-npc-positions', positions}, [positions.buffer]);
      state.physicsPositions.length = 0;
    },
    async restore() {// onchange nav-mesh restore agents
      const npcs = Object.values(state.npc).filter(x => x.agent !== null);
      for (const npc of npcs) {
        state.removeAgent(npc);
      }
      await pause();
      for(const npc of npcs ) {
        const agent = state.attachAgent(npc);
        const closest = state.getClosestNavigable(npc.position);
        if (closest === null) {// Agent outside nav keeps target but `Idle`s 
          npc.startAnimation('Idle');
        } else if (npc.s.target !== null) {
          npc.moveTo(toXZ(npc.s.target));
        } else {// so they'll move "out of the way" of other npcs
          agent.requestMoveTarget(npc.position);
        }
      }
    },
    remove(...npcKeys) {
      for (const npcKey of npcKeys) {
        const npc = state.getNpc(npcKey); // throw if n'exist pas
        npc.cancel(); // rejects promises
        state.removeAgent(npc);
        
        delete state.npc[npcKey];
        state.freeId.add(npc.def.pickUid);
        state.idToKey.delete(npc.def.pickUid);
      }
      update();
      for (const npcKey of npcKeys) {
        w.events.next({ key: 'removed-npc', npcKey });
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
    async spawn(opts, p) {
      if (typeof opts === 'string') {
        opts = { npcKey: opts };
      }

      const point = toXZ(p);
      if (!(typeof opts.npcKey === 'string' && /^[a-z0-9-_]+$/i.test(opts.npcKey))) {
        throw Error(`npc key: ${JSON.stringify(opts.npcKey)} must match /^[a-z0-9-_]+$/i`);
      } else if (!(typeof point?.x === 'number' && typeof point.y === 'number')) {
        throw Error(`invalid point {x, y}: ${JSON.stringify(p)}`);
      } else if (opts.npcKey === 'default') {
        throw Error('npc key cannot be "default"');
      }

      const dstNav = p.meta?.nav === true || state.isPointInNavmesh(point);
      /** Attach agent iff dst navigable */
      const agent = dstNav;

      if (dstNav === false && p.meta?.do !== true) {
        throw Error(`must spawn on navPoly or do point: ${JSON.stringify(p)}`);
      } else if (opts.classKey !== undefined && !w.lib.isNpcClassKey(opts.classKey)) {
        throw Error(`invalid classKey: ${JSON.stringify(p)}`);
      }
      
      const gmRoomId = w.gmGraph.findRoomContaining(point, true);
      if (gmRoomId === null) {
        throw Error(`must be in some room: ${JSON.stringify(p)}`);
      }

      let npc = state.npc[opts.npcKey];
      const position = toV3(p);

      // orient to meta 🚧 remove from elsewhere
      opts.angle ??= typeof p.meta?.orient === 'number'
        ? Math.PI/2 - (p.meta.orient * (Math.PI / 180))
        : undefined
      ;

      if (npc !== undefined) {// Respawn
        await npc.cancel();
        npc.epochMs = Date.now();

        npc.def = {
          key: opts.npcKey,
          pickUid: npc.def.pickUid,
          angle: opts.angle ?? npc.getAngle() ?? 0, // prev angle fallback
          classKey: opts.classKey ?? npc.def.classKey ?? defaultClassKey,
          runSpeed: opts.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: opts.walkSpeed ?? helper.defaults.walkSpeed,
        };

        // Reorder keys
        delete state.npc[opts.npcKey];
        state.npc[opts.npcKey] = npc;
      } else {
        
        // Spawn
        npc = state.npc[opts.npcKey] = new Npc({
          key: opts.npcKey,
          pickUid: takeFirst(state.freeId),
          angle: opts.angle ?? 0,
          classKey: opts.classKey ?? defaultClassKey,
          runSpeed: opts.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: opts.walkSpeed ?? helper.defaults.walkSpeed,
        }, w);
        state.idToKey.set(npc.def.pickUid, opts.npcKey);

        if (npc.def.classKey === 'human-0') {
          // 🚧 npc shader migration
          npc.initializeNew(state.gltf[npc.def.classKey]);
        } else {
          npc.initialize(state.gltf[npc.def.classKey]);
        }
      }

      if (npc.s.spawns === 0) {
        await new Promise(resolve => {
          npc.resolve.spawn = resolve;
          update();
        });
        npc.setupMixer();
      }

      // npc.startAnimation('Idle');
      position.y = npc.startAnimation(p.meta ?? 'Idle');
      npc.m.group.rotation.y = npc.getEulerAngle(npc.def.angle);
      npc.lastTarget.copy(position);

      if (npc.agent === null) {
        npc.position.copy(position);
        if (agent === true) {
          const agent = state.attachAgent(npc);
          // 🔔 pin to current position
          agent.requestMoveTarget(npc.position);
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
          state.byAgId[agent.agentIndex] = npc;
        }
      } else {
        if (dstNav === false || agent === false) {
          npc.position.copy(position);
          state.removeAgent(npc);
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
        } else {
          npc.agent.teleport(position);
        }
      }
      
      npc.s.spawns++;
      npc.s.doMeta = p.meta?.do === true ? p.meta : null;

      npc.s.offMesh = null;
      w.events.next({ key: 'spawned', npcKey: npc.key, gmRoomId });

      return npc;
    },
    tickOnceDebounced: debounce(() => {
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
    updateLabels(...incomingLabels) {
      const { lookup } = state.label;
      const unseenLabels = incomingLabels.filter(label => !(label in lookup));

      if (unseenLabels.length === 0) {
        return false;
      }
      
      w.menu.measure('npc.updateLabels');
      const nextLabels = [...Object.keys(lookup), ...unseenLabels];
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;
      createLabelSpriteSheet(nextLabels, state.label, { fontHeight });
      state.tex.labels = state.label.tex;
      w.menu.measure('npc.updateLabels');

      // update npc labels (avoidable by precomputing labels)
      Object.values(state.npc).forEach(npc => cmUvService.updateLabelQuad(npc));
      return true;
    },
  }), { reset: { showLastNavPath: true } });

  w.npc = state;
  w.n = state.npc;

  state.gltf["cuboid-man"] = useGLTF(npcClassToMeta["cuboid-man"].modelUrl);
  state.gltf["human-0"] = useGLTF(npcClassToMeta["human-0"].modelUrl);
  
  React.useEffect(() => {// init + hmr
    cmUvService.initialize(state.gltf);
    if (process.env.NODE_ENV === 'development') {
      Object.values(state.npc).forEach(state.hotReloadNpc);
    }
  }, []);
  
  // 🚧 detect gltf change via geomorphs.sheet.glbHash
  // 🚧 apply mesh normalization i.e. un-weld
  // 🚧 recompute "triangleId -> { uvRectKey, bodyPartKey }"
  React.useEffect(() => {
    console.log('🚧', w.geomorphs.sheet.glbHash);
  }, Object.values(w.geomorphs.sheet.glbHash));

  // 🚧 remove
  React.useEffect(() => {// npc textures
    Promise.all(npcClassKeys.map(async classKey => {
      state.tex[classKey] = emptyTexture;
      const { skinClassKey } = npcClassToMeta[classKey];
      const texUrl = getNpcSkinSheetUrl(skinClassKey, 0);
      const tex = await textureLoader.loadAsync(texUrl);
      tex.flipY = false;
      state.tex[classKey] = tex;
    })).then(() => state.forceUpdate());
  }, [w.hash.sheets]);

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
 * @property {import("../service/three").LabelsSheetAndTex} label
 * @property {Record<NPC.ClassKey, import("three-stdlib").GLTF & import("@react-three/fiber").ObjectMap>} gltf
 * @property {{ [npcKey: string]: Npc }} npc
 * @property {null | ((npc: NPC.NPC, agent: NPC.CrowdAgent) => void)} onStuckCustom
 * Custom callback to handle npc slow down.
 * We don't use an event because it can happen too often.
 * @property {number[]} physicsPositions
 * Format `[npc.bodyUid, npc.position.x, npc.position.y, npc.position.z, ...]`
 * @property {Record<NPC.TextureKey, THREE.Texture>} tex 🚧 old
 * @property {Map<number, string>} idToKey
 * Correspondence between object-pick ids and npcKeys.
 * @property {boolean} showLastNavPath
 * @property {Record<Geomorph.SkinClassKey, NPC.SkinTriMap>} skinTriMap
 *
 * @property {(npc: NPC.NPC) => NPC.CrowdAgent} attachAgent
 * @property {() => void} clearLabels
 * @property {(npc: NPC.NPC, opts?: any) => void} drawUvReMap
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {() => void} forceUpdate
 * @property {(npcKey: string, processApi?: any) => NPC.NPC} getNpc
 * @property {(prevNpc: NPC.NPC) => void} hotReloadNpc
 * @property {(p: THREE.Vector3, maxDelta?: number) => null | THREE.Vector3} getClosestNavigable
 * @property {(input: Geom.VectJson | THREE.Vector3Like) => boolean} isPointInNavmesh
 * @property {() => void} restore
 * @property {(deltaMs: number) => void} onTick
 * @property {(npcKey: string) => void} remove
 * @property {(npc: NPC.NPC) => void} removeAgent
 * @property {(opts: string | NPC.SpawnOpts, position: MaybeMeta<(Geom.VectJson | THREE.Vector3Like)>) => Promise<NPC.NPC>} spawn
 * - `spawn("rob", { x, y, meta })`
 * - `spawn("rob", { x, y, z, meta })`
 * - `spawn({ npcKey: "rob", classKey: "myClassKey" }, { x, y, z, meta })`
 * - `w npc.spawn rob $( click 1 )`
 * @property {() => void} tickOnceDebounced
 * @property {() => Promise<void>} tickOnceDebug
 * @property {() => void} update
 * @property {(...incomingLabels: string[]) => boolean} updateLabels
 * - Ensures incomingLabels i.e. does not replace.
 * - Returns `true` iff the label sprite-sheet had to be updated.
 * - Every npc label may need updating,
     avoidable by precomputing labels 
 */

/**
 * @param {NPCProps} props 
 */
function NPC({ npc }) {
  const { bones, mesh, quad } = npc.m;

  return (
    <group
      key={npc.key}
      ref={npc.onMount.bind(npc)}
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

        key={CuboidManMaterial.key} // 🔔 keep shader up-to-date
        onUpdate={(skinnedMesh) => {
          npc.m.mesh = skinnedMesh; 
          npc.m.material = /** @type {THREE.ShaderMaterial} */ (skinnedMesh.material);
        }}

        renderOrder={0}
      >
        {npc.def.classKey === 'human-0' && (
          // <meshBasicMaterial color="red" />
          // 🚧
          <humanZeroShader
            key={HumanZeroShader.key}
            atlas={npc.w.texSkin.tex}
            texSkinId={npc.m.texSkinId}
            transparent
            uid={npc.def.pickUid}
            uvReMap={npc.w.texSkinUvs.tex}
          />
        ) || <cuboidManMaterial
          key={CuboidManMaterial.key}
          diffuse={[.8, .8, .8]}
          transparent
          opacity={npc.s.opacity}
          uNpcUid={npc.def.pickUid}
          // objectPick={true}

          labelHeight={wallHeight * (1 / 0.65)}
          selectorColor={npc.s.selectorColor}
          showSelector={npc.s.showSelector}
          // showLabel={false}

          uBaseTexture={npc.baseTexture}
          uLabelTexture={npc.labelTexture}
          uAlt1Texture={emptyTexture}
          
          uFaceTexId={quad.face.texId}
          uIconTexId={quad.icon.texId}
          uLabelTexId={quad.label.texId}

          uFaceUv={quad.face.uvs}
          uIconUv={quad.icon.uvs}
          uLabelUv={quad.label.uvs}
          
          uLabelDim={quad.label.dim}
        />}
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

// useGLTF.preload(Object.values(npcClassToMeta).map(x => x.url));

const smallHalfExtent = 0.001;
