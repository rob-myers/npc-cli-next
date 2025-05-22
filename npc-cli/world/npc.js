import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { damp, dampAngle } from "maath/easing";
import { lerp } from "maath/misc";
import braces from "braces";

import { Vect } from '../geom';
import { defaultAgentUpdateFlags, geomorphGridMeters, glbFadeIn, glbFadeOut, npcClassToMeta, npcLabelMaxChars, npcTargetArriveDistance, skinsLabelsTextureHeight, skinsLabelsTextureWidth } from '../service/const';
import { error, info, keys, warn } from '../service/generic';
import { geom } from '../service/geom';
import { buildObject3DLookup, emptyAnimationMixer, emptyGroup, emptyShaderMaterial, emptySkinnedMesh, getRootBones, tmpEulerThree, tmpVectThree1, toV3, toXZ } from '../service/three';
import { helper } from '../service/helper';
import { addBodyKeyUidRelation, npcToBodyKey } from '../service/rapier';

export class Npc {

  /** @type {string} User specified e.g. `rob` */
  key;
  /** @type {NPC.NPCDef} Initial definition */
  def;
  /** @type {number} When we (re)spawned */
  epochMs;
  /** @type {number} Physics body identifier i.e. `hashText(key)` */
  bodyUid;
  
  /** @type {NPC.Model} Model */
  m = {
    animations: [],
    bones: [],
    group: /** @type {*} */ (null),
    material: /** @type {*} */ ({}),
    mesh: /** @type {*} */ ({}),
    scale: 1,
    toAct: /** @type {*} */ ({}),
  };
  
  mixer = emptyAnimationMixer;
  /** Shortcut to `this.m.group.position` */
  position = tmpVectThree1;
  /** Shortcut to `this.m.group.rotation` */
  rotation = tmpEulerThree;
  /** Difference between last position */
  delta = new THREE.Vector3();

  /**
   * Amounts to "uv re-mapping".
   * 
   * - Given `skinPartKey` e.g. `"head-overlay-front"` we provide a prefix e.g. `"confused"`,
   *   where `"confused_head-overlay-front"` exists in the respective skin's uvMap.
   * - We overwrite this object.
   */
  skin = /** @type {NPC.SkinReMap} */ ({});

  /**
   * Tint skin parts.
   * - We overwrite this object.
   */
  tint = /** @type {NPC.SkinTint} */ ({
    selector: [1, 1, 1, 0],
  });

  /** Shortcut to `this.w.npc.gltfAux[this.def.classKey]` */
  gltfAux = /** @type {NPC.GltfAux} */ ({});

  /** State */
  s = {
    act: /** @type {Key.Anim} */ ('Idle'), // 🚧 rename as `anim`
    agentState: /** @type {null | number} */ (null),
    arriveAnim: /** @type {NPC.MoveOpts['arriveAnim']} */ (undefined),
    doMeta: /** @type {null | Meta} */ (null),
    fadeSecs: 0.3,
    label: /** @type {null | string} */ (null),
    labelY: 0,
    /** Desired look angle (rotation.y) */
    lookAngleDst: /** @type {null | number} */ (null),
    lookSecs: lookSecsNoTarget,
    /** An offMeshConnection traversal */
    offMesh: /** @type {null | NPC.OffMeshState} */ (null),
    opacity: 1,
    /** Desired opacity */
    opacityDst: /** @type {null | number} */ (null),
    run: false,
    selectorTint: /** @type {[number, number, number]} */ ([0, 0, 1]),
    /**
     * World timer elapsedTime (seconds) when slowness detected.
     * 🤔 Pausing currently resets World timer.
     */
    slowBegin: /** @type {null | number} */ (null),
    spawns: 0,
    target: /** @type {null | THREE.Vector3} */ (null),
    /**
     * Used to change offMeshConnection exit speed via `agentAnim.tScale`.
     * - Starts at time `0 ≤ start ≤ agentAnim.tmax`.
     * - Approaches `dst` as we exit offMeshConnection.
     */
    tScale: /** @type {null | { start: number; dst: number; }} */ (null),
  };
  
  /** @type {null | NPC.CrowdAgent} */
  agent = null;
  /** @type {null | dtCrowdAgentAnimation} */
  agentAnim = null;
  
  /**
   * Last starting position.
   */
  lastStart = new THREE.Vector3();
  /**
   * - Current target (if moving)
   * - Last set one (if not)
   */
  lastTarget = new THREE.Vector3();

  /** ContextMenu has different position when `this.s.act` is `Lie` */
  offsetMenu = new THREE.Vector3();
  offsetSpeech = new THREE.Vector3();

  resolve = {
    fade: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    move: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    spawn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    turn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
  };

  reject = {
    fade: /** @type {undefined | ((error: any) => void)} */ (undefined),
    move: /** @type {undefined | ((error: any) => void)} */ (undefined),
    // spawn: /** @type {undefined | ((error: any) => void)} */ (undefined),
    turn: /** @type {undefined | ((error: any) => void)} */ (undefined),
  };

  /** @type {import('./World').State} World API */
  w;

  /**
   * @param {NPC.NPCDef} def
   * @param {import('./World').State} w
   */
  constructor(def, w) {
    this.key = def.key;
    this.epochMs = Date.now();
    this.def = def;
    this.w = w;
    this.bodyUid = addBodyKeyUidRelation(npcToBodyKey(def.key), w.physics)
  }

  /**
   * Apply uv re-mapping @see {Npc.skin}
   * - 1st row of pixels
   * - one pixel per triangle
   */
  applySkin() {
    const texNpcAux = this.w.texNpcAux;
    const { classKey } = this.def;
    const { gltfAux: skinAux, sheetAux } = this.w.npc;
    const { sheetId: initSheetId, uvMap, sheetTexIds } = sheetAux[classKey];
    const { triToKey } = skinAux[classKey];

    this.expandSkin();

    /** Index in DataTextureArray of this model's `initSheetId` sheet */
    const initSheetTexId = sheetTexIds[initSheetId];

    // 🔔 texture.type THREE.FloatType to handle negative uv offsets
    // 🔔 skin is 1st row, tint is 2nd row
    const data = new Float32Array(4 * texNpcAux.opts.width * 1);
    const defaultPixel = [0, 0, initSheetTexId];

    /** @type {Partial<Record<Key.SkinPart, true>>} */
    const hideInObjectPick = {
      breath: true,
      label: true,
      selector: true,
    };

    for (const [triangleId, { uvRectKey, skinPartKey }] of triToKey.entries()) {
      const offset = 4 * triangleId;
      const target = this.skin[skinPartKey];
      
      // alpha encodes if skin part rendered during objectPick
      data[offset + 3] = skinPartKey in hideInObjectPick ? 0 : 1;

      if (target === undefined) {
        data.set(defaultPixel, offset);
        continue;
      }

      const dstUvRectKey = /** @type {const} */ (`${target.prefix}_${
        // can refer to other skin part of same size (e.g. body front/back/left/right)
        // so we don't need to explicitly mention every possibility in SVG uv-map
        target?.otherPart ?? skinPartKey
      }`);
      const src = uvMap[uvRectKey];
      const dst = uvMap[dstUvRectKey];

      if (dst === undefined) {
        warn(`${'applySkin'}: dstUvRectKey not found: ${dstUvRectKey}`)
        data.set(defaultPixel, offset); // fallback to initial skin
        continue;
      }

      // can remap skinPartKey to another model's skin
      const dstSheetTexId = (target.classKey === undefined
        ? sheetTexIds : sheetAux[target.classKey].sheetTexIds
      )[dst.sheetId];

      data[offset + 0] = dst.x - src.x;
      data[offset + 1] = dst.y - src.y;
      data[offset + 2] = dstSheetTexId;

      // console.log({
      //   skinPartKey,
      //   src: { ...src },
      //   dst: { ...dst },
      //   data: data.slice(offset, offset + 4),
      // });
    }

    texNpcAux.updateIndex(this.def.uid, data);
  }

  /**
   * Apply uv re-mapping @see {Npc.tint}
   * - 2nd row of pixels
   * - one pixel per triangle
   */
  applyTint() {
    const texNpcAux = this.w.texNpcAux;
    const classKey = this.def.classKey;
    const { triToKey } = this.w.npc.gltfAux[classKey];

    this.expandTint();

    // THREE.FloatType handle negative uv offsets in applySkin
    const data = new Float32Array(4 * texNpcAux.opts.width * 1);
    const defaultPixel = [1, 1, 1, 1];
    for (const [triangleId, { skinPartKey }] of triToKey.entries()) {
      const offset = 4 * triangleId;
      if (skinPartKey in this.tint) {
        data.set(/** @type {number[]} */ (this.tint[skinPartKey]), offset);
      } else {
        data.set(defaultPixel, offset);
      }
    }

    texNpcAux.updateIndex(this.def.uid, data, 1);
  }

  cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    this.reject.fade?.(`${'cancel'}: cancelled fade`);
    this.reject.move?.(`${'cancel'}: cancelled move`);
    this.reject.turn?.(`${'cancel'}: cancelled turn`);

    this.w.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
  }

  disposeModel() {
    this.m.animations = [];
    this.m.bones = [];
    // @ts-ignore
    this.m['group'] = null;
    this.m.material.dispose?.();
    this.m.material = emptyShaderMaterial;
    this.m.mesh.visible = false;
    this.m.mesh = emptySkinnedMesh;
    Object.values(this.m.toAct).forEach(act => act.stop());
    this.m.toAct = /** @type {*} */ ({});
  }

  /**
   * Possible cases:
   * - p is a "do point"
   *   > `p.meta.do === true` 
   * - npc is at a "do point" (e.g. off-mesh) and p is navigable 
   *   > `p.meta.nav` and `npc.doMeta`
   * - `npc` is off-mesh and `p` is nearly navigable
   * 
   * @param {Meta<Geom.VectJson | THREE.Vector3Like>} p 
   * @param {object} opts
   * @param {any[]} [opts.extraParams] // 🚧 clarify
   */
  async do(p, opts = {}) {
    if (Vect.isVectJson(p) === false) {
      throw Error('point expected');
    } else if (p.meta == null) {
      throw Error('point.meta expected');
    }
    const point = /** @type {Meta<Geom.VectJson>} */ (toXZ(p));
    point.meta = p.meta;

    const w = this.w;
    const srcNav = w.npc.isPointInNavmesh(this.position);
    
    // point.meta.do
    if (point.meta.do === true) {
      if (srcNav === true) {// nav -> do point
        // await this.onMeshDo(point, { ...opts, preferSpawn: !!point.meta.longClick });
        await this.onMeshDo(point, { ...opts, preferSpawn: false });
      } else {// off nav -> do point
        await this.offMeshDo(point);
      }
      return;
    }

    // point.meta.nav && npc.doMeta
    if (point.meta.nav === true && this.s.doMeta !== null) {
      if (srcNav === true) {
        this.s.doMeta = null;
        await this.move({ to: point });
      // } else if (w.npc.canSee(this.getPosition(), point, this.getInteractRadius())) {
      // } else if (true) {
      } else if (
        typeof point.meta.grKey === 'string'
          ? point.meta.grKey === w.e.npcToRoom.get(this.key)?.grKey
          : false
      ) {
        await this.fadeSpawn(point);
      } else {
        throw Error('cannot reach navigable point')
      }
      return;
    }

    // handle offMesh and click near nav
    if (srcNav === false && point.meta.nav === false) {
      const closest = w.npc.getClosestNavigable(toV3(p));
      if (closest !== null) await this.offMeshDo({...toXZ(closest), meta: { nav: true }});
    }
  }

  ensureAnimationMixer() {
    if (this.mixer !== emptyAnimationMixer) {
      return;
    }
    this.mixer = new THREE.AnimationMixer(this.m.group);
    this.m.toAct = this.m.animations.reduce((agg, a) => helper.isAnimKey(a.name)
      ? (agg[a.name] = this.mixer.clipAction(a), agg)
      : (warn(`ignored unexpected animation: ${a.name}`), agg)
    , /** @type {typeof this['m']['toAct']} */ ({}));
  }

  /**
   * Brace expansion of keys of `this.skin` e.g.
   * > `'head-{front,back}'` -> `['head-front', 'head-back']`
   * - Any keys with braces will be expanded and removed.
   * - Later keys override earlier ones.
   * - We ignore unresolved expansions (they needn't be errors).
   */
  expandSkin() {
    const lookup = this.skin;
    const pending = /** @type {typeof lookup} */ ({});
    const { sheetAux } = this.w.npc;

    for (const k of keys(lookup)) {
      const remap = lookup[k];
      if (remap === undefined) {
        continue;
      } else if (k.includes('{') === false) {
        pending[k] = remap;
      } else {
        let some = false;
        braces(k, { expand: true }).forEach(expanded => {
          if (helper.isSkinPart(expanded) === false) {
            return warn(`${'expandSkin'}: ${this.key}: invalid skinPart "${expanded}"`);
          }
          const uvKey = `${remap.prefix}_${remap.otherPart ?? expanded}`;
          if (!(uvKey in sheetAux[remap.classKey ?? this.def.classKey].uvMap)) {
            return; // 🔔 `remap.prefix` may not be defined for all {head,body}{,-overlay}
          }
          pending[expanded] = remap;
          some = true;
        });
        if (some === false) {
          warn(`${'expandSkin'}: ${this.key}: ${k}: unused prefix "${remap.prefix}"`);
        }
      }
    }

    this.skin = pending;
  }

  /**
   * Brace expansion of keys of `this.tint`, e.g.
   * > `'head-{front,back}'` -> `['head-front', 'head-back']`
   * - Any keys with braces will be expanded and removed.
   * - Later keys override earlier ones.
   */
  expandTint() {
    const lookup = this.tint;
    const pending = /** @type {typeof lookup} */ ({});

    for (const k of keys(lookup)) {
      const v = lookup[k];
      if (k.includes('{') === false) {
        pending[k] = v;
      } else {
        braces(k, { expand: true }).forEach(expanded => {
          if (helper.isSkinPart(expanded) === false) {
            return warn(`${'expandTint'}: ${this.key}: invalid skinPart "${expanded}"`);
          }
          pending[expanded] = v;
        });
      }
    }

    this.tint = pending;
  }

  /**
   * @param {number} [opacityDst] 
   * @param {number} [ms] 
   */
  async fade(opacityDst = 0.2, ms = 300) {
    if (!Number.isFinite(opacityDst)) {
      throw new Error(`${'fade'}: 1st arg must be numeric`);
    }
    this.s.opacityDst = opacityDst;
    this.s.fadeSecs = ms / 1000;
    
    try {
      this.w.events.next({ key: 'fade-npc', npcKey: this.key, opacityDst });
      await new Promise((resolve, reject) => {
        this.resolve.fade = resolve;
        this.reject.fade = reject;
      });
    } catch (e) {
      this.s.opacityDst = null;
      throw e;
    }
  }

  /**
   * Fade out, spawn, then fade in.
   * - `spawn` sets `npc.doMeta` when `meta.do === true`
   * @param {MaybeMeta<Geom.VectJson>} at 
   * @param {object} opts
   * @param {Meta} [opts.meta]
   * @param {number} [opts.angle] clockwise from north from above
   * @param {Key.NpcClass} [opts.classKey]
   * @param {boolean} [opts.requireNav]
   */
  async fadeSpawn(at, opts = {}) {
    try {
      Object.assign(at.meta ??= {}, opts.meta);
      await this.fade(0, 300);

      const currPoint = this.getPoint();
      const dx = at.x - currPoint.x;
      const dy = at.y - currPoint.y;

      await this.w.npc.spawn({
        angle: opts.angle ?? (
          dx === 0 && dy === 0 ? undefined : geom.clockwiseFromNorth(dy, dx)
        ),
        at,
        classKey: opts.classKey,
        npcKey: this.key,
      });
    } finally {
      await this.fade(1, 300);
    }
  }

  /**
   * Convert `rotation.y` into direction npc is facing, using
   * coordinate system "clockwise from north, viewed from above".
   * 
   * Note that:
   * - in three.js `rotation.y` is counter-clockwise from north viewed from above
   * - when `rotation.y === 0` npc faces south (Blender setup) thus need
   *   180° offset to get "direction npc is facing"
   */
  getAngle() {
    return geom.radRange(Math.PI - this.rotation.y);
  }

  /**
   * Cannot use agent.corners() because ag->ncorners is 0 on offMeshConnection
   */
  getCornerAfterOffMesh() {
    return {
      x: /** @type {NPC.CrowdAgent} */ (this.agent).raw.get_cornerVerts(6 + 0),
      y: /** @type {NPC.CrowdAgent} */ (this.agent).raw.get_cornerVerts(6 + 2),
    };
  }

  /**
   * Given angle "clockwise from north looking down from above", construct value of `rotation.y`
   * which would make the npc face this direction.
   *
   * - The Euler angle rotation.y is counter-clockwise from east, which explains the negative sign.
   * - The additional `Math.PI` is needed because when `rotation.y === 0` the
   *   npc is facing south (Blender setup).
   * @param {number} cwNorthAngle
   * @returns {number}
   */
  getEulerAngle(cwNorthAngle) {
    return Math.PI - cwNorthAngle;
  }

  /**
   * An offMeshConnection actually amounts to three segments:
   * - init from initial npc position to src
   * - main from src to dst
   * - next from dst to nextCorner
   * 
   * Given the npc is traversing an offMeshConnection @see {offMesh},
   * we find a point further along these 3 segments by @see {extraDistance}.
   * @param {NPC.OffMeshState} offMesh
   * @param {number} extraDistance meters
   * @returns {Geom.VectJson}
   */
  getFurtherAlongOffMesh(offMesh, extraDistance) {
    const anim = /** @type {import("./npc").dtCrowdAgentAnimation} */ (this.agentAnim);
    const dstT = anim.t + (extraDistance / offMesh.tToDist);
    if (dstT < anim.tmid) {// look at 'init' seg
      return {
        x: offMesh.initPos.x + offMesh.initUnit.x * (dstT * offMesh.tToDist),
        y: offMesh.initPos.y + offMesh.initUnit.y * (dstT * offMesh.tToDist),
      };
    } else if (dstT < anim.tmax || offMesh.nextUnit === null) {// look at 'main' seg
      return {
        x: offMesh.src.x + offMesh.mainUnit.x * ((dstT - anim.tmid) * offMesh.tToDist),
        y: offMesh.src.y + offMesh.mainUnit.y * ((dstT - anim.tmid) * offMesh.tToDist),
      };
    } else {// look beyond 'main' seg
      return {
        x: offMesh.dst.x + offMesh.nextUnit.x * ((dstT - anim.tmax) * offMesh.tToDist),
        y: offMesh.dst.y + offMesh.nextUnit.y * ((dstT - anim.tmax) * offMesh.tToDist),
      };
    }
  }

  /**
   * Get angle "clockwise from north from above".
   * @param {Geom.VectJson | THREE.Vector3Like} input
   */
  getLookAngle(input) {
    const src = this.getPoint();
    const dst = toXZ(input);
    return src.x === dst.x && src.y === dst.y
      ? this.getAngle()
      : geom.clockwiseFromNorth(dst.y - src.y, dst.x - src.x)
    ;
  }

  getMaxSpeed() {
    // return 0.5;
    // return this.def.runSpeed;
    return this.s.run === true ? this.def.runSpeed : this.def.walkSpeed;
  }

  getNextCorner() {
    const agent = /** @type {NPC.CrowdAgent} */ (this.agent);
    const offset = agent.state() === 2 ? 6 : 0;
    return {// agent.corners() empty while offMeshConnection
      x: agent.raw.get_cornerVerts(offset + 0),
      y: agent.raw.get_cornerVerts(offset + 1),
      z: agent.raw.get_cornerVerts(offset + 2),
    };
  }

  /**
   * Given another npc in the same doorway, get how far ahead it is.
   * @param {NPC.NPC} other an npc in same doorway
   */
  getOtherDoorwayLead(other) {
    const offMesh = /** @type {NPC.OffMeshState} */ (other.s.offMesh);
    const direction = tmpVect1.copy(offMesh.dst).sub(offMesh.src).normalize();
    return ((other.position.x - this.position.x) * direction.x) + ((other.position.z - this.position.z) * direction.y);
  }

  /** @returns {Geom.VectJson} */
  getPoint() {
    const { x, z: y } = this.position;
    return { x, y };
  }

  /**
   * Radius depends on whether idle, walking or running.
   */
  getRadius() {
    if (this.s.target === null) {
      return helper.defaults.radius;
    } else if (this.s.run === true) {
      return helper.defaults.radius * 2;
    } else {
      return helper.defaults.radius;
    }
  }

  /**
   * 1. Step `offMesh.seg` through `[0, 1, 2]`
   * 
   * 1. Handle turns onto/along an offMeshConnection.
   * 
   * 1. Handle collisions during initial segment of offMeshConnection.
   * Recast-Detour doesn't support collisions from `this` agent's perspective,
   * and we've turned off its handling of the other agent.
   * 
   * To get neighbours working during offMeshConnections, we modified `dtCrowd::update`.
   * 
   * We also changed `dtCrowd::update` to ignore collisions of
   * a neighbour on initial part of an offMeshConnection.
   *
   * @param {NPC.CrowdAgent} agent
   * @param {NPC.OffMeshState} offMesh
   */
  handleOffMeshConnection(agent, offMesh) {
    if (offMesh.seg === 0) {
      this.handlePreOffMeshCollision(agent, offMesh);
    }

    const anim = /** @type {dtCrowdAgentAnimation} */ (this.agentAnim);

    if (offMesh.seg === 0 && anim.t > anim.tmid) {
      offMesh.seg = 1;
      this.w.events.next({ key: 'enter-off-mesh-main', npcKey: this.key });
    } else if (offMesh.seg === 1 && anim.t > 0.5 * (anim.tmid + anim.tmax)) {
      offMesh.seg = 2; // midway in main segment

      if (this.isTargetClose(this.position) === true) {
        // 🔔 fix sharp final turn just after offMeshConnection
        this.s.lookSecs = 0.8;
      }
    }

    if (this.s.tScale !== null) {// approach tScale.dst as t -> tmax
      const { start, dst } = this.s.tScale;
      anim.tScale = lerp(1, dst, (anim.t - start) / (anim.tmax - start));
    }

    // look further along the path
    // 🔔 with 0.2 saw jerk when two agents through doorway
    const lookAt = this.getFurtherAlongOffMesh(offMesh, 0.4);
    const dirX = lookAt.x - this.position.x;
    const dirY = lookAt.y - this.position.z;
    const radians = geom.clockwiseFromNorth(dirY, dirX);
    this.s.lookAngleDst = this.getEulerAngle(radians);

    if (anim.t > anim.tmax - 0.1) {// exit in direction we're looking
      anim.set_unitExitVel(0, Math.cos(radians - Math.PI/2));
      anim.set_unitExitVel(1, 0);
      anim.set_unitExitVel(2, Math.sin(radians - Math.PI/2));
    }
  }

  /**
   * Detect collisions whilst on initial segment of offMeshConnection
   * @param {NPC.CrowdAgent} agent
   * @param {NPC.OffMeshState} offMesh
   */
  handlePreOffMeshCollision(agent, offMesh) {
    const nneis  = agent.raw.nneis;
    /** @type {dtCrowdNeighbour} */ let nei;
    // 🔔 if too small, can be jerky on collide after offMeshConnection begins
    const closeDist = preOffMeshCloseDist * (this.s.run === true ? 2 : 1);
    const point = this.getPoint();

    for (let i = 0; i < nneis; i++) {
      nei = agent.raw.get_neis(i);
      if (nei.dist < closeDist) {// maybe cancel traversal
        const other = this.w.a[nei.idx];
        
        if ((
          other.s.target === null &&
          geom.lineSegIntersectsCircle(
            point,
            offMesh.src,
            other.getPoint(),
            0.24,
          ) === false
        ) || (
          other.s.offMesh !== null
          && this.getOtherDoorwayLead(other) >= 0.25
        )) {
          // 🔔 other idle and "not in the way", or
          // 🔔 other traversing with enough lead
          continue;
        }

        this.stopMoving();
        break;
      }
    }
  }

  /**
   * Initialization we can do before mounting
   * @param {import('three-stdlib').GLTF & import('@react-three/fiber').ObjectMap} gltf
   */
  initialize(gltf) {
    if (this.m.group !== null) {// onchange glb
      this.disposeModel();
    }

    const clonedRoot = /** @type {THREE.Group} */ (SkeletonUtils.clone(gltf.scene));
    const objectLookup = buildObject3DLookup(clonedRoot);
    
    const meta = npcClassToMeta[this.def.classKey];
    const { m } = this;
    
    m.animations = gltf.animations;
    // cloned bones
    m.bones = getRootBones(Object.values(objectLookup.nodes));
    // cloned mesh (overridden on mount)
    m.mesh = /** @type {THREE.SkinnedMesh} */ (objectLookup.nodes[meta.meshName]);
    // overridden on mount
    m.material = /** @type {Npc['m']['material']} */ (m.mesh.material);

    m.mesh.updateMatrixWorld();
    m.mesh.computeBoundingBox();
    m.mesh.computeBoundingSphere();

    m.scale = meta.scale;

    this.applySkin();
    this.applyTint();

    this.gltfAux = this.w.npc.gltfAux[this.def.classKey];
  }

  /**
   * @param {Geom.VectJson | THREE.Vector3} input 
   */
  isTargetClose(input) {
    input = toXZ(input);
    return (
      Math.abs(this.lastTarget.x - input.x) < 0.5
      && Math.abs(this.lastTarget.z - input.y) < 0.5
    );
  }

  /**
   * @param {number | Geom.VectJson | THREE.Vector3Like} input
   * - radians (cw from north), or
   * - point
   * @param {number} [ms]
   */
  async look(input, ms = 300) {
    if (this.w.lib.isVectJson(input) === true) {
      input = this.getLookAngle(input);
    }
    if (!Number.isFinite(input)) {
      throw new Error(`${'look'}: 1st arg must be radians or point`);
    }
    if (helper.canAnimKeyLook(this.s.act) === false) {
      throw new Error(`${'look'}: cannot whilst "${this.s.act}"`);
    }

    this.s.lookAngleDst = this.getEulerAngle(input);
    this.s.lookSecs = ms / 1000;

    try {
      await new Promise((resolve, reject) => {
        this.resolve.turn = resolve;
        this.reject.turn = reject;
      });
    } catch (e) {
      this.s.lookAngleDst = null;
      throw e;
    }
  }

  /**
   * @param {NPC.MoveOpts} opts
   */
  async move(opts) {
    if (this.agent === null) {
      throw new Error(`${this.key}: npc lacks agent`);
    }

    const dst = opts.to;
    // doorway half-depth is 0.3 or 0.4, i.e. ≤ 0.5
    const closest = this.w.npc.getClosestNavigable(toV3(dst), 0.5);
    if (closest === null) {
      throw new Error(`${this.key}: not navigable: ${JSON.stringify(dst)}`);
    }

    this.s.arriveAnim = opts.arriveAnim;
    this.s.lookSecs = 0.2;

    this.agent.updateParameters({
      maxAcceleration: movingMaxAcceleration,
      maxSpeed: this.getMaxSpeed(),
      // radius: (this.s.run ? 3 : 2) * helper.defaults.radius, // reset
      radius: helper.defaults.radius,
      collisionQueryRange: movingCollisionQueryRange,
      separationWeight: movingSeparationWeight ,
      queryFilterType: this.w.lib.queryFilterType.excludeDoors,
    });

    this.lastStart.copy(this.position);
    this.s.target = this.lastTarget.copy(closest);

    if (this.tryStopOffMesh() === true) {
      this.agent.teleport(this.position);
      if (this.s.agentState === 2) {// in case of immediate new offMeshConnection
        this.s.agentState = -1;
      }
    }
    this.agent.requestMoveTarget(closest);

    const nextAct = this.s.run ? 'Run' : 'Walk';
    if (this.s.act !== nextAct) {
      this.startAnimation(nextAct);
    }
    
    this.w.events.next({
      key: 'started-moving',
      npcKey: this.key,
      showNavPath: opts.debugPath ?? this.w.npc.showLastNavPath,
    });

    try {
      await this.waitUntilStopped();
    } catch (e) {
      this.stopMoving();
      throw e;
    }
  }

  /**
   * @param {MaybeMeta<Geom.VectJson>} point 
   */
  async offMeshDo(point) {
    const src = Vect.from(this.getPoint());
    const meta = point.meta ?? {};

    if (// 🔔 permit move between do points in same room, ≤ 3 grids away
      !(src.distanceTo(point) <= geomorphGridMeters * 3)
      || !this.w.gmGraph.inSameRoom(src, point)
      // || !this.w.npc.canSee(src, point, this.getInteractRadius())
    ) {
      throw Error('too far away');
    }

    await this.fadeSpawn(
      {...meta.doPoint ?? point}, // 🚧 do points should have meta.doPoint
      {
        angle: meta.nav === true && meta.do !== true
          // use direction src --> point if entering navmesh
          ? src.equals(point)
            ? undefined
            : src.angleTo(point) + Math.PI/2 // "cw from north"
          // use meta.orient if staying off-mesh
          : typeof meta.orient === 'number'
            ? meta.orient * (Math.PI / 180) // meta.orient already "cw from north"
            : undefined,
        // fadeOutMs: opts.fadeOutMs,
        meta,
      },
    );    
  }

  /**
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   * @param {number} next
   */
  onChangeAgentState(agent, next) {
    if (next === 2) {// enter offMeshConnection
      const offMesh = (// find off-mesh-connection via lookup
        this.w.nav.offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(0), agent.raw.get_cornerVerts(2))]
        ?? this.w.nav.offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(3), agent.raw.get_cornerVerts(5))]
        ?? this.w.nav.offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(6), agent.raw.get_cornerVerts(8))]
        ?? null
      );

      if (offMesh === null) {
        agent.teleport(this.position);
        return error(`${this.key}: bailed out of unknown offMeshConnection: ${JSON.stringify(this.position)}`);
      }
      // set this.s.offMesh
      this.w.events.next({ key: 'enter-off-mesh', npcKey: this.key, offMesh });
      return;
    }
    
    if (this.s.agentState === 2) {// exit offMeshConnection
      if (this.s.offMesh !== null) {
        this.w.events.next({ key: 'exit-off-mesh', npcKey: this.key, offMesh: this.s.offMesh.orig  });
      } else {
        // cancelled offMeshConnection before reaching main segment
        // warn(`${this.key}: exited offMeshConnection but this.s.offMesh already null`);
      }
      return;
    }
  }

  /**
   * @param {MaybeMeta<Geom.VectJson>} point 
   * @param {object} opts
   * @param {boolean} [opts.preferSpawn]
   */
  async onMeshDo(point, opts = {}) {
    const src = this.getPoint();
    const meta = point.meta ?? {};

    /** 🚧 Actual "do point" usually differs from clicked point */
    const doPoint = /** @type {Geom.VectJson} */ (meta.doPoint) ?? point;

    if (meta.do !== true) {
      throw Error('not doable');
    }
    if (!this.w.gmGraph.inSameRoom(src, doPoint)) {
      throw Error('too far away');
    }

    // `meta.orient` (degrees) uses "cw from north",
    const dstRadians = typeof meta.orient === 'number'
      ? meta.orient * (Math.PI/180)
      : undefined
    ;
    
    // ℹ️ could do visibility check (raycast)
    if (!opts.preferSpawn && this.w.npc.isPointInNavmesh(doPoint) === true) {
      /**
       * Walk, [Turn], Do
       */
      await this.move({ to: doPoint });
      if (typeof dstRadians === 'number') {
        await this.look(dstRadians, 500 * geom.compareAngles(this.getAngle(), dstRadians));
      }
      // this.startAnimation('Idle');
      this.startAnimation(meta);
      this.doMeta = meta.do === true ? meta : null;
    } else {
      // sets `this.s.doMeta` because `meta.do === true`
      await this.fadeSpawn(doPoint, {
        angle: dstRadians,
        requireNav: false,
        meta,
        // fadeOutMs: opts.fadeOutMs,
      });
    }
  }

  /**
   * @param {THREE.Group | null} group 
   */
  onMount(group) {
    if (group !== null) {
      this.m.group = group;
      // Setup shortcut
      this.position = group.position;
      this.rotation = group.rotation;
      // Resume `w.npc.spawn`
      this.resolve.spawn?.();
      // Ensure non-empty animation mixer
      this.ensureAnimationMixer();
    } else {
      this.m.group = emptyGroup;
      this.position = tmpVectThree1;
    }
  }

  /**
   * @param {number} deltaMs
   * @param {number[]} positions
   * Format `[..., bodyUid_i, x_i, y_i, z_i, ...]` for physics.worker
   */
  onTick(deltaMs, positions) {
    this.mixer.update(deltaMs);

    if (this.s.lookAngleDst !== null) {
      if (dampAngle(this.rotation, 'y', this.s.lookAngleDst, this.s.lookSecs, deltaMs, Infinity, undefined, 0.01) === false) {
        this.s.lookAngleDst = null;
        this.resolve.turn?.();
      }
    }

    if (this.s.opacityDst !== null) {
      if (damp(this.s, 'opacity', this.s.opacityDst, this.s.fadeSecs, deltaMs, undefined, undefined, 0.02) === false) {
        this.s.opacityDst = null;
        this.resolve.fade?.();
      }
      this.setUniform('opacity', this.s.opacity);
    }

    if (this.agent === null) {
      return;
    }

    this.onTickAgent(deltaMs, this.agent);

    if (this.agent.raw.dvel !== 0 || this.s.offMesh !== null) {
      const { x, y, z } = this.position;
      positions.push(this.bodyUid, x, y, z);
    }
  }

  /**
   * @param {number} deltaMs
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   */
  onTickAgent(deltaMs, agent) {
    const pos = agent.position();
    const state = agent.state();

    this.delta.copy(pos).sub(this.position);
    this.position.copy(pos);

    if (state !== this.s.agentState) {
      this.onChangeAgentState(agent, state);
      this.s.agentState = state;
    }

    if (this.s.offMesh !== null) {
      this.handleOffMeshConnection(agent, this.s.offMesh);
      return; // Avoid stopMoving whilst offMesh
    }

    // this.speed = tmpVectThree1.copy(agent.velocity()).length();

    if (this.s.target === null) {
      this.onTickTurnNoTarget(agent);
      return;
    }

    this.onTickTurnTarget(agent);

    const distance = this.s.target.distanceTo(pos);

    if (distance < npcTargetArriveDistance) {// Reached target
      this.stopMoving(true);
      return;
    }

    this.onTickDetectStuck(deltaMs, agent);
  }

  /**
   * @param {number} deltaMs 
   * @param {NPC.CrowdAgent} agent 
   */
  onTickDetectStuck(deltaMs, agent) {// 🔔 customise smallDist and time
    const smallDist = 0.3 * agent.raw.desiredSpeed * deltaMs;

    if (Math.abs(this.delta.x) > smallDist || Math.abs(this.delta.z) > smallDist) {
      this.s.slowBegin = null; // reset
      return;
    }
    
    const { elapsedTime } = this.w.timer;
    this.s.slowBegin ??= elapsedTime;
    if (elapsedTime - this.s.slowBegin < 0.3) {
      return;
    }

    this.w.npc.onStuckCustom?.(this, agent);
  }

  /** @param {NPC.CrowdAgent} agent */
  onTickTurnNoTarget(agent) {
    if (agent.raw.nneis === 0) {
      return;
    }
    if (agent.raw.desiredSpeed < 0.5) {
      return;
    }

    const nei = agent.raw.get_neis(0); // 0th closest
    const other = this.w.a[nei.idx];

    if (other.s.target === null) {
      return;
    }

    // 🚧 rethink e.g. this.rotation.__damp
    if (nei.dist > (other.s.run === true ? 0.8 : 0.6)) {
      this.s.lookAngleDst = null;
    } else {// turn towards "closest neighbour" if they have a target
      this.s.lookAngleDst = this.getEulerAngle(
        geom.clockwiseFromNorth((other.position.z - this.position.z), (other.position.x - this.position.x))
      );
    }
    
  }

  /** @param {NPC.CrowdAgent} agent */
  onTickTurnTarget(agent) {
    const vel = agent.velocity();
    this.s.lookAngleDst = this.getEulerAngle(
      geom.clockwiseFromNorth(vel.z, vel.x)
    );
  }

  resetSkin() {
    this.skin = {};
    this.applySkin();
  }

  resetTint() {
    /** @type {Partial<Record<Key.SkinPart, true>>} */
    const remember = { 'breath': true, 'label': true, 'selector': true, }
    
    for (const skinPartKey of keys(this.tint)) {
      !(skinPartKey in remember) && delete this.tint[skinPartKey];
    }

    this.applyTint();
  }

  /**
   * @param {string | undefined | null} label
   */
  setLabel(label = null) {
    this.s.label = label;

    if (typeof this.s.label === 'string') {
      this.s.label.slice(0, npcLabelMaxChars);
    }

    const { ct } = this.w.texNpcLabel;
    ct.clearRect(0, 0, skinsLabelsTextureWidth, skinsLabelsTextureHeight);
    
    if (label === null) {
      this.w.texNpcLabel.updateIndex(this.def.uid);
      return;
    }

    const strokeWidth = 5;
    const fontHeight = 28; // permits > 12 chars on OSX Chrome
    ct.strokeStyle = 'black';
    ct.fillStyle = '#aaa';
    ct.lineWidth = strokeWidth;
    ct.font = `${fontHeight}px Monospace`;
    ct.textBaseline = 'top';
    const { width } = ct.measureText(label);
    const dx = (skinsLabelsTextureWidth - width)/2;
    const dy = (skinsLabelsTextureHeight - fontHeight)/2;
    ct.strokeText(label, dx + strokeWidth, dy + strokeWidth);
    ct.fillText(label, dx + strokeWidth, dy + strokeWidth);

    this.w.texNpcLabel.updateIndex(this.def.uid);
  }

  /**
   * @param {number} exitSpeed
   */
  setOffMeshExitSpeed(exitSpeed) {
    if (this.s.offMesh === null) {
      return warn(`${'setOffMeshExitSpeed'}: ${this.key}: s.offMesh is null`);
    }
    if (this.agentAnim === null) {
      return warn(`${'setOffMeshExitSpeed'}: ${this.key}: no agent`);
    }
    if (exitSpeed < 0.05) {
      return warn(`${'setOffMeshExitSpeed'}: ${this.key}: exit speed to slow (${exitSpeed})`);
    }

    const maxSpeed = this.getMaxSpeed();
    this.s.tScale = {
      start: this.agentAnim.t,
      dst: exitSpeed / maxSpeed,
    };

    const agent = /** @type {NPC.CrowdAgent} */ (this.agent);
    agent.updateParameters({ maxSpeed: exitSpeed });

    if (exitSpeed >= maxSpeed) {
      this.s.offMesh.tToDist = exitSpeed;
    } else {// 🔔 avoid look flicker when target "before" offMesh.dst
      this.s.offMesh.tToDist = maxSpeed;
    }

    if (this.s.act === 'Run' && exitSpeed < this.def.runSpeed) {
      this.startAnimation('Walk');
    }
  }

  /**
   * @param {'opacity' | 'labelY'} name 
   * @param {number} value 
   */
  setUniform(name, value) {
    this.m.material.uniforms[name].value = value; 
  }

  /**
   * @param {boolean} shouldShow
   */
  showLabel(shouldShow) {
    (this.tint.label ??= [1, 1, 1, 1])[3] = shouldShow ? 1 : 0;
    this.applyTint();
  }

  /**
   * Also tints selector via @see {s.selectorColor}
   * @param {boolean} shouldShow
   */
  showSelector(shouldShow) {
    this.tint.selector = [...this.s.selectorTint, shouldShow ? 1 : 0];
    this.applyTint();
  }

  /**
   * Start animation via key or meta
   * @param {Key.Anim | Meta} input
   */
  startAnimation(input) {
    if (typeof input !== 'string') {
      input = helper.getAnimKeyFromMeta(input);
    }
    const curr = this.m.toAct[this.s.act];
    const next = this.m.toAct[input];
    curr.fadeOut(glbFadeOut[this.s.act][input]);
    next.reset().fadeIn(glbFadeIn[this.s.act][input]).play();
    this.mixer.timeScale = npcClassToMeta[this.def.classKey].timeScale[input] ?? 1;
    this.s.act = input;

    this.updateLabelOffsets();
  }

  stopMoving(arrived = false) {
    if (this.agent === null || this.s.target === null) {
      return;
    }

    this.s.lookSecs = lookSecsNoTarget;
    this.s.lookAngleDst = null;
    this.s.slowBegin = null;
    this.s.target = null;

    this.agent.updateParameters({
      maxSpeed: this.getMaxSpeed() * 0.75,
      maxAcceleration: staticMaxAcceleration,
      updateFlags: defaultAgentUpdateFlags,
      radius: helper.defaults.radius,
      collisionQueryRange: staticCollisionQueryRange,
      separationWeight: staticSeparationWeight,
      // queryFilterType: this.w.lib.queryFilterType.excludeDoors,
      // updateFlags: 1,
    });
    
    if (arrived === true) {
      if (this.s.arriveAnim !== 'none') {
        this.startAnimation(this.s.arriveAnim ?? 'Idle');
      }
    } else {
      this.startAnimation('Idle');
    }

    const pos = this.agent.position(); // reset small motions:
    const position = this.lastStart.distanceTo(pos) <= 0.05 ? this.lastStart : pos;

    if (this.s.offMesh === null || this.s.offMesh.seg === 0) {
      this.tryStopOffMesh();
      this.agent.teleport(position);
      this.agent.requestMoveTarget(position);
    } else {// midway through traversal, so stop when finish
      this.agent.requestMoveTarget(toV3(this.s.offMesh.dst));
    }

    this.resolve.move?.();
    this.w.events.next({ key: 'stopped-moving', npcKey: this.key });
  }

  tryStopOffMesh() {
    // offMeshConnection can happen when `this.s.offMesh` null,
    // e.g. when npc without access is close to door
    if (this.agentAnim === null || this.agentAnim?.active === false) {
      return false;
    } else if (this.agentAnim.t <= this.agentAnim.tmid) {
      this.w.events.next({ key: 'clear-off-mesh', npcKey: this.key });
      return true;
    } else {
      return false;
    }
  }

  updateLabelOffsets() {
    const { act } = this.s;
    const { animHeights, labelHeight } = this.gltfAux;
    const offsetY = animHeights[act] + 3 * labelHeight;
    
    // speech bubble (if exists)
    this.offsetSpeech.y = offsetY;

    // shader label position
    this.s.labelY = this.position.y + offsetY;
    this.setUniform('labelY', this.s.labelY);

    if (act === 'Lie') {// fix contextmenu position
      const clockwiseFromEast = this.getAngle() - Math.PI/2;
      this.offsetMenu.set(0.5 * Math.cos(clockwiseFromEast), 0, 0.5 * Math.sin(clockwiseFromEast));      
    } else {
      this.offsetMenu.set(0, 0, 0);
    }
  }

  async waitUntilStopped() {
    this.s.target !== null && await new Promise((resolve, reject) => {
      this.resolve.move = resolve; // see "stopped-moving"
      this.reject.move = reject; // see w.npc.remove
    });
  }
}

const staticMaxAcceleration = 4;
const movingMaxAcceleration = 6;
// const staticSeparationWeight = 1;
const staticSeparationWeight = 0.25;
// 🔔 sudden change can cause jerk onexit doorway
const movingSeparationWeight = 0.5;
const staticCollisionQueryRange = 2;
const movingCollisionQueryRange = 2;

const preOffMeshCloseDist = helper.defaults.radius;

const lookSecsNoTarget = 0.75;

/** @type {Partial<import("@recast-navigation/core").CrowdAgentParams>} */
export const crowdAgentParams = {
  radius: helper.defaults.radius, // 🔔 too large causes jerky collisions
  height: 1.5,
  maxAcceleration: staticMaxAcceleration,
  pathOptimizationRange: helper.defaults.radius * 30,
  collisionQueryRange: staticCollisionQueryRange,
  separationWeight: staticSeparationWeight,
  queryFilterType: 0,
  updateFlags: defaultAgentUpdateFlags,
};

/**
 * @typedef {ReturnType<
 *  import('@recast-navigation/core').Crowd['raw']['getAgentAnimation']
 * >} dtCrowdAgentAnimation
 */

/**
 * @typedef {import('@recast-navigation/wasm').default.dtCrowdNeighbour} dtCrowdNeighbour
 */

const tmpVect1 = new Vect();
