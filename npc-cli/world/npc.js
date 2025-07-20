import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { damp, dampAngle } from "maath/easing";
import braces from "braces";

import { Vect } from '../geom';
import { defaultAgentUpdateFlags, geomorphGridMeters, glbFadeIn, glbFadeOut, npcClassToMeta, npcLabelMaxChars, defaultNpcArriveDistance, skinsLabelsTextureHeight, skinsLabelsTextureWidth, nearTargetDistance, precision } from '../service/const';
import { error, info, keys, warn } from '../service/generic';
import { geom } from '../service/geom';
import { buildObject3DLookup, emptyAnimationMixer, emptyGroup, emptyShaderMaterial, emptySkinnedMesh, getRootBones, tmpEulerThree, tmpVectThree1, toV3, v3Precision } from '../service/three';
import { helper } from '../service/helper';
import { addBodyKeyUidRelation, npcToBodyKey } from '../service/rapier';

/**
 * @param {NPC.NPCDef} def 
 * @param {import('./World').State} w 
 * @returns {NPC.NPC}
 */
export function createNpc(def, w) {
  const baseNpc = createBaseNpc(def, w);
  const api = new NpcApi(baseNpc, w);
  return Object.assign(baseNpc, { api });
}

/**
 * @param {NPC.NPCDef} def 
 * @param {import('./World').State} w 
 */
export function createBaseNpc(def, w) {

  const bodyUid = addBodyKeyUidRelation(npcToBodyKey(def.key), w.physics);

  return {
    /** @type {string} User specified e.g. `rob` */
    key: def.key,
    /** @type {NPC.NPCDef} Initial definition */
    def,
    /** @type {number} When we (re)spawned */
    epochMs: Date.now(),
    /** @type {number} Physics body identifier i.e. `hashText(key)` */
    bodyUid,
    
    /** @type {NPC.Model} Model */
    m: {
      animations: [],
      bones: [],
      group: /** @type {*} */ (null),
      material: /** @type {*} */ ({}),
      mesh: /** @type {*} */ ({}),
      scale: 1,
      toAct: /** @type {*} */ ({}),
    },
    
    mixer: emptyAnimationMixer,
    /** Shortcut to `this.m.group.position` */
    position: tmpVectThree1,
    /** Shortcut to `this.m.group.rotation` */
    rotation: tmpEulerThree,
    /** Difference between last position */
    delta: new THREE.Vector3(),
  
    /**
     * Amounts to "uv re-mapping".
     * 
     * - Given `skinPartKey` e.g. `"head-overlay-front"` we provide a prefix e.g. `"confused"`,
     *   where `"confused_head-overlay-front"` exists in the respective skin's uvMap.
     * - We overwrite this object.
     */
    skin: /** @type {NPC.SkinReMap} */ ({}),
  
    /**
     * Tint skin parts.
     * - We overwrite this object.
     */
    tint: /** @type {NPC.SkinTint} */ ({
      selector: [1, 1, 1, 0],
    }),
  
    /** Shortcut to `this.w.npc.gltfAux[this.def.classKey]` */
    gltfAux: /** @type {NPC.GltfAux} */ ({}),
  
    /** State */
    s: {
      /** Driven by CrowdAgent.state */
      agentState: /** @type {null | number} */ (null),
      /** Current animation key. */
      anim: /** @type {Key.Anim} */ ('Idle'),
      /** Minimal distance at which npc is consider to have arrived */
      arriveDist: defaultNpcArriveDistance,
      /** Defined iff npc is at an "act point". */
      actMeta: /** @type {null | Meta} */ (null),
      /** Fade duration e.g. during fade spawn */
      fadeSecs: 0.3,
      /**
       * Text of label above npc, or null if empty.
       * This is hidden when the npc has a speech bubble.
       */
      label: /** @type {null | string} */ (null),
      /** Height of label above npc */
      labelY: 0,
      /** Desired look angle (`rotation.y`) */
      lookAngleDst: /** @type {null | number} */ (null),
      /** Look duration e.g. during move or look */
      lookSecs: lookSecsNoTarget,
      /** An offMeshConnection traversal */
      offMesh: /** @type {null | NPC.OffMeshState} */ (null),
      /** For delayed `npc.s.offMesh` `null`ing during initial seg */
      offMeshTimeout: 0,
      /** Opacity e.g. during fade */
      opacity: 1,
      /** Desired opacity */
      opacityDst: /** @type {null | number} */ (null),
      /** Can walk or run */
      run: false,
      /** Default is blue */
      selectorTint: /** @type {[number, number, number]} */ ([0, 0, 1]),
      /** Can tween agent separation weight */
      separation: /** @type {null | { current: number; dst: number; smoothTime?: Number; }} */ (null),
      /**
       * Time when slowness detected (world timer elapsedTime in seconds).
       * 🤔 Pausing currently resets World timer.
       */
      slowBegin: /** @type {null | number} */ (null),
      /** Number of spawns. More than 1 means we've respawned. */
      spawns: 0,
      /** Target during move. */
      target: /** @type {null | THREE.Vector3} */ (null),
      turnBeforeMove: /** @type {null | { ms: Number; towards: Geom.VectJson }} */ (null),
    },
    
    /** @type {null | NPC.CrowdAgent} */
    agent: null,
    /** @type {null | dtCrowdAgentAnimation} */
    agentAnim: null,
    
    /** Last starting position. */
    lastStart: new THREE.Vector3(),
    /** Current target (if moving), last set one (if not) */
    lastTarget: new THREE.Vector3(),
    /** Number of corners left whilst moving */
    numCorners: 0,
  
    /** ContextMenu has different position when `this.s.act` is `Lie` */
    offsetMenu: new THREE.Vector3(),
    offsetSpeech: new THREE.Vector3(),
  
    /**
     * For continuous motion between multiple targets.
     * @type {THREE.Vector3[]}
     */
    pendingTargets: [],

    resolve: {
      fade: /** @type {undefined | ((value?: any) => void)} */ (undefined),
      move: /** @type {undefined | ((value?: any) => void)} */ (undefined),
      separate: /** @type {undefined | ((value?: any) => void)} */ (undefined),
      spawn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
      turn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    },
  
    reject: {// 🚧 support multiple rejects in each case
      fade: /** @type {undefined | ((error: any) => void)} */ (undefined),
      moves: /** @type {((error: NPC.StopReason | Error) => void)[]} */ ([]),
      separate: /** @type {undefined | ((error: any) => void)} */ (undefined),
      // spawn: /** @type {undefined | ((error: any) => void)} */ (undefined),
      turn: /** @type {undefined | ((error: any) => void)} */ (undefined),
    },

    w,
  };
}

/**
 * @typedef {ReturnType<typeof createBaseNpc>} BaseNPC
 */

export class NpcApi {

  /** @type {NPC.NPC} */ base;
  
  //#region shortcuts for unchanging references
  /** @type {string} */ key;
  /** @type {NPC.NPCDef} */ def;
  /** @type {THREE.Vector3} */ delta;
  /** @type {BaseNPC['m']} */ m;
  /** @type {THREE.Vector3[]} */ pendingTargets;
  /** @type {BaseNPC['reject']} */ reject;
  /** @type {BaseNPC['resolve']} */ resolve;
  /** @type {BaseNPC['s']} */ s;
  //#endregion

  /** @type {import('./World').State} World API */
  w;

  /**
   * @param {BaseNPC} base
   * @param {import('./World').State} w
   */
  constructor(base, w) {
    // we'll attach `this` as `base.api` later
    this.base = /** @type {NPC.NPC} */ (base);
    this.w = w;
    
    this.def = base.def;
    this.delta = base.delta;
    this.key = base.key;
    this.m = base.m;
    this.pendingTargets = base.pendingTargets;
    this.reject = base.reject;
    this.resolve = base.resolve;
    this.s = base.s;
  }

  /**
   * Possible cases:
   * - opts.at is an "act point"
   *   i.e. `opts.at.meta.act === true` 
   * - npc is at an "act point" (e.g. off-mesh) and opts.at is navigable 
   *   i.e. `opts.at.meta.nav` and `npc.actMeta !== null`
   * - `npc` is off-mesh and `opts.at` is nearly navigable
   * 
   * @param {NPC.ActOpts} opts 
   */
  async act(opts) {
    const p = opts.at;
    if (helper.isVectJson(p) === false) {
      throw Error('opts.at must be {x,y} or {x,y,z}');
    } else if (p.meta == null) {
      throw Error('opts.at.meta expected');
    }
    const point = /** @type {Meta<Geom.VectJson>} */ (helper.toXZ(p));
    point.meta = p.meta;

    const w = this.w;
    const srcNav = w.npc.isPointInNavmesh(this.base.position);
    
    // point.meta.act
    if (point.meta.act === true) {
      if (srcNav === true) {// nav -> act point
        await this.onMeshAct(point, { ...opts, preferSpawn: false });
      } else {// off nav -> act point
        await this.offMeshAct(point);
      }
      return;
    }

    // point.meta.nav && npc.actMeta
    if (point.meta.nav === true && this.s.actMeta !== null) {
      if (srcNav === true) {
        w.npc.setActMeta(this.key, null);
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
      if (closest !== null) {
        await this.offMeshAct({...helper.toXZ(closest), meta: { nav: true }});
      }
    }
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
      const target = this.base.skin[skinPartKey];
      
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
      if (skinPartKey in this.base.tint) {
        data.set(/** @type {number[]} */ (this.base.tint[skinPartKey]), offset);
      } else {
        data.set(defaultPixel, offset);
      }
    }

    texNpcAux.updateIndex(this.def.uid, data, 1);
  }

  /**
   * @param {'removed' | 'respawned'} reason 
   */
  cancel(reason) {
    info(`${'cancel'}: cancelling ${this.key}`);

    this.reject.fade?.(`${'cancel'}: cancelled fade`);
    this.rejectMove({ type: 'stop-reason', key: reason });
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

  ensureAnimationMixer() {
    if (this.base.mixer !== emptyAnimationMixer) {
      return;
    }
    this.base.mixer = new THREE.AnimationMixer(this.m.group);
    this.m.toAct = this.m.animations.reduce((agg, a) => helper.isAnimKey(a.name)
      ? (agg[a.name] = this.base.mixer.clipAction(a), agg)
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
    const lookup = this.base.skin;
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

    this.base.skin = pending;
  }

  /**
   * Brace expansion of keys of `this.tint`, e.g.
   * > `'head-{front,back}'` -> `['head-front', 'head-back']`
   * - Any keys with braces will be expanded and removed.
   * - Later keys override earlier ones.
   */
  expandTint() {
    const lookup = this.base.tint;
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

    this.base.tint = pending;
  }

  /** @param {NPC.GroundPoint[]} pendingTargets  */
  extendMove(pendingTargets) {
    this.pendingTargets.push(...pendingTargets.map(x => toV3(x, precision)));
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
   * - `spawn` sets `npc.actMeta` when `meta.act === true`
   * @param {MaybeMeta<Geom.VectJson>} at 
   * @param {object} opts
   * @param {Meta} [opts.meta]
   * @param {number} [opts.angle] clockwise from north from above
   * @param {Key.NpcClass} [opts.classKey]
   * @param {boolean} [opts.requireNav]
   */
  async fadeSpawn(at, opts = {}) {
    try {
      await this.fade(0, 200);

      const currPoint = this.getPoint();
      const dx = at.x - currPoint.x;
      const dy = at.y - currPoint.y;

      await this.w.npc.spawn({
        angle: opts.angle ?? (
          dx === 0 && dy === 0 ? undefined : geom.clockwiseFromNorth(dy, dx)
        ),
        at,
        classKey: opts.classKey,
        meta: opts.meta,
        npcKey: this.key,
      });
    } finally {
      await this.fade(1, 150);
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
    /* return geom.radRange(Math.PI - this.base.rotation.y); */
    return Math.PI - this.base.rotation.y;
  }

  /**
   * Cannot use agent.corners() because ag->ncorners is 0 on offMeshConnection
   */
  getCornerAfterOffMesh() {
    return {
      x: /** @type {NPC.CrowdAgent} */ (this.base.agent).raw.get_cornerVerts(6 + 0),
      y: /** @type {NPC.CrowdAgent} */ (this.base.agent).raw.get_cornerVerts(6 + 2),
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
    const anim = /** @type {dtCrowdAgentAnimation} */ (this.base.agentAnim);
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
    const dst = helper.toXZ(input);
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
    const agent = /** @type {NPC.CrowdAgent} */ (this.base.agent);
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
    return ((other.position.x - this.base.position.x) * direction.x) + ((other.position.z - this.base.position.z) * direction.y);
  }

  /** @returns {Geom.VectJson} */
  getPoint() {
    const { x, z: y } = this.base.position;
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

  getRemainingPath() {
    if (this.s.target === null) {
      warn(`${'getRemainingPath'}: ${this.key}: npc.s.target is null`);
      return this.pendingTargets.map(helper.toXZ);
    } else if (this.pendingTargets.length > 0 && this.isNearTarget() === true) {
      return this.pendingTargets.map(helper.toXZ);
    } else {
      return [this.s.target].concat(this.pendingTargets).map(helper.toXZ);
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

    const anim = /** @type {dtCrowdAgentAnimation} */ (this.base.agentAnim);

    if (offMesh.seg === 0 && anim.t > anim.tmid) {
      offMesh.seg = 1;
      this.w.events.next({ key: 'enter-off-mesh-main', npcKey: this.key });
    } else if (offMesh.seg === 1 && anim.t > 0.5 * (anim.tmid + anim.tmax)) {
      offMesh.seg = 2; // midway in main segment
      if (this.pendingTargets.length === 0 && this.isNearTarget() === true) {
        // 🔔 fix sharp final turn just after offMeshConnection
        this.s.lookSecs = 0.8;
      }
    }

    // look further along the path
    // 🔔 with 0.2 saw jerk when two agents through doorway
    const lookAt = this.getFurtherAlongOffMesh(offMesh, 0.8);
    const dirX = lookAt.x - this.base.position.x;
    const dirY = lookAt.y - this.base.position.z;
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
      if (nei.dist > closeDist) {
        continue;
      }

      // maybe cancel traversal
      const other = this.w.a[nei.idx];
      if ((
        other.s.target === null &&
        geom.lineSegIntersectsCircle(
          point,
          offMesh.src,
          other.api.getPoint(),
          0.35, // noticeable flicker at 0.3
        ) === false
      ) || (
        other.s.offMesh !== null
        && this.getOtherDoorwayLead(other) >= 0.25
      )) {
        // 🔔 other idle and "not in the way", or
        // 🔔 other traversing with enough lead
        continue;
      }

      this.stopMoving({
        type: 'stop-reason',
        key: 'collided',
        otherNpcKey: other.key,
        rest: this.getRemainingPath(),
      });
      return;
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
    m.material = /** @type {THREE.ShaderMaterial} */ (m.mesh.material);

    m.mesh.updateMatrixWorld();
    m.mesh.computeBoundingBox();
    m.mesh.computeBoundingSphere();

    m.scale = meta.scale;

    this.applySkin();
    this.applyTint();

    this.base.gltfAux = this.w.npc.gltfAux[this.def.classKey];
  }

  isNearTarget(nearDistance = nearTargetDistance) {
    const { lastTarget, position } = this.base;
    return (
      Math.abs(lastTarget.x - position.x) < nearDistance
      && Math.abs(lastTarget.z - position.z) < nearDistance
    );
  }

  /**
   * @param {number | Geom.VectJson | THREE.Vector3Like} input
   * - radians (cw from north), or
   * - point
   * @param {number} [ms]
   */
  async look(input, ms = 300) {
    if (helper.isVectJson(input) === true) {
      input = this.getLookAngle(input);
    }
    if (!Number.isFinite(input)) {
      throw new Error(`${'look'}: 1st arg must be radians or point`);
    }
    if (helper.canAnimKeyLook(this.s.anim) === false) {
      throw new Error(`${'look'}: cannot whilst "${this.s.anim}"`);
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
    const { agent } = this.base;

    if (agent === null) {
      throw new Error(`npc ${this.key} lacks agent`);
    }
    if (this.s.actMeta !== null) {// must be on-mesh act point
      this.w.npc.setActMeta(this.key, null);
    }

    const points = Array.isArray(opts.to) ? opts.to : [opts.to];
    if (!(points.every(helper.isVectJson))) {
      throw Error(`${'npc.api.move'}: opts.to must be {x,y}, {x,y,z} or array`);
    }
    
    this.s.target !== null && this.rejectMove({
      type: 'stop-reason',
      key: 'move-again',// turn off continuous motion
      rest: this.getRemainingPath(),
    });

    if (points.length === 0) {
      return;
    }
    
    const to = /** @type {NPC.GroundPoint} */ (points.shift());
    this.pendingTargets.push(...points.map(x => toV3(x, precision)));
    this.setSlowDown(this.pendingTargets.length === 0);

    // doorway half-depth is 0.3 or 0.4, i.e. ≤ 0.5
    const closest = this.w.npc.getClosestNavigable(toV3(to), Math.max(opts.close ?? 0, 0.05));
    if (closest === null) {
      throw new Error(`${this.key}: not navigable: ${JSON.stringify(to)}`);
    }

    v3Precision(closest);
    this.s.arriveDist = opts.s?.arriveDist ?? defaultNpcArriveDistance;
    this.s.lookSecs = 0.2;

    agent.raw.params.set_maxAcceleration(defaultMaxAcceleration);
    agent.raw.params.set_maxSpeed(this.getMaxSpeed());
    agent.raw.params.set_collisionQueryRange(defaultAgentUpdateFlags);
    agent.raw.params.set_separationWeight(defaultSeparationWeight);
    agent.raw.params.set_queryFilterType(helper.queryFilterType.respectUnwalkable);
    agent.raw.params.set_radius((this.s.run ? 1.5 : 1) * helper.defaults.radius);

    this.base.lastStart.copy(this.base.position);
    this.s.target = this.base.lastTarget.copy(closest);

    if (this.tryStopOffMesh() === true) {
      agent.teleport(this.base.position);
      if (this.s.agentState === 2) {// in case of immediate new offMeshConnection
        this.s.agentState = -1;
      }
    }

    agent.requestMoveTarget(closest);

    const nextAct = this.s.run === true ? 'Run' : 'Walk';
    if (this.s.anim !== nextAct) {
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
      if (!(helper.isStopReason(e) && e.key === 'move-again') && this.s.target !== null) {
        this.stopMoving(); // stop on error except "move-again"
      }
      throw e;
    } finally {
      this.setSlowDown(true); // turn off continuous motion
      this.pendingTargets.length = 0;
      this.tryStopOffMesh(); // when turnBeforeMove
      this.s.turnBeforeMove = null; // 🚧
      this.base.numCorners = 0;
    }
  }

  /**
   * @param {MaybeMeta<Geom.VectJson>} point 
   */
  async offMeshAct(point) {
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
      {...meta.actPoint ?? point}, // 🚧 act points should have meta.actPoint
      {
        angle: meta.nav === true && meta.act !== true
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
        agent.teleport(this.base.position);
        return error(`${this.key}: bailed out of unknown offMeshConnection: ${JSON.stringify(this.base.position)}`);
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
   * @param {NPC.CrowdAgent} agent
   * @param {number} numCorners
   */
  onChangeNumCorners(agent, numCorners) {
    this.base.numCorners = numCorners;
    if (this.s.offMesh !== null) {
      return;
    }
    if (numCorners === 1) {
      //console.log('APPROACH');
    } else if (numCorners === 2) {
      //console.log('JUST_AROUND_CORNER');
    }
  }

  /**
   * @param {MaybeMeta<Geom.VectJson>} point 
   * @param {object} opts
   * @param {boolean} [opts.preferSpawn]
   */
  async onMeshAct(point, opts = {}) {
    const src = this.getPoint();
    const meta = point.meta ?? {};

    /** Actual "do point" usually differs from clicked point */
    const actPoint = /** @type {Geom.VectJson} */ (meta.actPoint) ?? point;

    if (meta.act !== true) {
      throw Error('not actable');
    }
    if (!this.w.gmGraph.inSameRoom(src, actPoint)) {
      throw Error('too far away');
    }

    // `meta.orient` (degrees) uses "cw from north",
    const dstRadians = typeof meta.orient === 'number'
      ? meta.orient * (Math.PI/180)
      : undefined
    ;
    
    // 🤔 could do visibility check (raycast)
    if (!opts.preferSpawn && this.w.npc.isPointInNavmesh(actPoint) === true) {
      /**
       * Walk, [Turn], Do
       */
      await this.move({ to: actPoint });
      if (typeof dstRadians === 'number') {
        await this.look(dstRadians, 500 * geom.compareAngles(this.getAngle(), dstRadians));
      }
      this.w.npc.setActMeta(this.key, meta);
      this.startAnimation(meta);
    } else {
      // sets `this.s.actMeta` because `meta.act === true`
      await this.fadeSpawn(actPoint, {
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
      this.base.position = group.position;
      this.base.rotation = group.rotation;
      // Resume `w.npc.spawn`
      this.resolve.spawn?.();
      // Ensure non-empty animation mixer
      this.ensureAnimationMixer();
    } else {
      this.m.group = emptyGroup;
      this.base.position = tmpVectThree1;
    }
  }

  /**
   * @param {number} deltaSecs
   * @param {number[]} positions
   * Format `[..., bodyUid_i, x_i, y_i, z_i, ...]` for physics.worker
   */
  onTick(deltaSecs, positions) {
    this.base.mixer.update(deltaSecs);

    if (this.s.lookAngleDst !== null) {
      if (dampAngle(this.base.rotation, 'y', this.s.lookAngleDst, this.s.lookSecs, deltaSecs, 20, undefined, 0.01) === false) {
        this.s.lookAngleDst = null;
        this.resolve.turn?.();
      }
    }

    if (this.s.opacityDst !== null) {
      if (damp(this.s, 'opacity', this.s.opacityDst, this.s.fadeSecs / 1.5, deltaSecs, undefined, undefined, 0.005) === false) {
        this.s.opacityDst = null;
        this.resolve.fade?.();
      }
      this.setUniform('opacity', this.s.opacity);
    }

    const { agent } = this.base;

    if (agent === null) {
      return;
    }

    this.onTickAgent(deltaSecs, agent);

    if (agent.raw.dvel !== 0 || this.s.offMesh !== null) {
      const { x, y, z } = this.base.position;
      positions.push(this.base.bodyUid, x, y, z);
    }
  }

  /**
   * @param {number} deltaSecs
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   */
  onTickAgent(deltaSecs, agent) {
    const position = agent.position();
    const state = agent.state();

    this.delta.copy(position).sub(this.base.position);
    this.base.position.copy(position);

    if (state !== this.s.agentState) {
      this.onChangeAgentState(agent, state);
      this.s.agentState = state;
    }

    if (this.s.separation !== null) {
      this.onTickSeparation(deltaSecs, agent, this.s.separation);
    }

    if (this.s.offMesh !== null) {
      this.handleOffMeshConnection(agent, this.s.offMesh);

      if (this.s.turnBeforeMove !== null) {
        this.onTurnBeforeMove(agent, deltaSecs, this.s.turnBeforeMove);
      }

      return; // Avoid stopMoving whilst offMesh
    }

    if (this.s.target === null) {
      this.w.npc.onTickIdleTurn?.(this.base, agent);
      return;
    }

    this.onTickTurnTarget(agent);

    const distance = this.s.target.distanceTo(position);

    const numCorners = agent.raw.get_ncorners();
    if (numCorners !== this.base.numCorners) {
      this.onChangeNumCorners(agent, numCorners);
    }

    // 🔔 arriving earlier avoids small loops
    const arriveDist = this.s.arriveDist * (this.pendingTargets.length === 0 ? 1 : 1.5);
    if (distance <= arriveDist) {// Reached target
      const pendingTarget = this.pendingTargets.shift();
      
      if (pendingTarget === undefined) {
        this.stopMoving({ type: 'stop-reason', key: 'arrived' });
      } else {
        this.base.lastStart.copy(this.base.position);
        this.s.target = this.base.lastTarget.copy(pendingTarget);
        this.base.numCorners = 0;
        agent.requestMoveTarget(this.s.target);
        this.setSlowDown(this.pendingTargets.length === 0); // update per pendingTarget
        this.w.events.next({ key: 'continued-moving', npcKey: this.key, showNavPath: this.w.npc.showLastNavPath, });
      }
      return;
    }
    
    // avoid fast final turn
    if (this.pendingTargets.length === 0 && distance <= 5 * defaultNpcArriveDistance) {
      this.s.lookSecs = 0.5;
    }

    this.onTickDetectStuck(deltaSecs, agent);
  }

  /**
   * @param {number} deltaSecs
   * @param {NPC.CrowdAgent} agent
   * @param {NonNullable<this['s']['separation']>} separation
   */
  onTickSeparation(deltaSecs, agent, separation) {
    const { current, dst, smoothTime = 0.4 } = separation;
    if (damp(separation, 'current', dst, smoothTime, deltaSecs, undefined, undefined, 0.02) === false) {
      this.s.separation = null;
      agent.raw.params.set_separationWeight(dst);
      this.resolve.separate?.();
    } else {
      agent.raw.params.set_separationWeight(current);
    }
  }

  /**
   * 🚧 hard-coding: small distance, long enough time
   * @param {number} deltaSecs 
   * @param {NPC.CrowdAgent} agent 
   */
  onTickDetectStuck(deltaSecs, agent) {
    const smallDist = 0.3 * agent.raw.desiredSpeed * deltaSecs;

    if (Math.abs(this.delta.x) > smallDist || Math.abs(this.delta.z) > smallDist) {
      return this.s.slowBegin = null; // reset tracking
    }
    
    const { elapsedTime } = this.w.timer;
    this.s.slowBegin ??= elapsedTime;
    if (elapsedTime - this.s.slowBegin < 0.5) {
      return; // too short
    }

    if (this.w.npc.onStuckNpc === null) {
      // 🔔 fixes "cannot arrive close enough" due to nearby-ish npc
      this.stopMoving({
        type: 'stop-reason',
        key: 'stuck',
        nearTarget: this.isNearTarget(),
        rest: this.getRemainingPath(),
      });
    } else {
      this.w.npc.onStuckNpc?.(this.base, agent);
    }
  }

  /** @param {NPC.CrowdAgent} agent */
  onTickTurnTarget(agent) {
    const vel = agent.velocity();
    this.s.lookAngleDst = this.getEulerAngle(
      geom.clockwiseFromNorth(vel.z, vel.x)
    );
  }

  /**
   * 
   * @param {NPC.CrowdAgent} agent 
   * @param {number} deltaSecs 
   * @param {NonNullable<NPC.NPC['s']['turnBeforeMove']>} turnBeforeMove 
   */
  onTurnBeforeMove(agent, deltaSecs, turnBeforeMove) {
    const { position } = this.base;
    const { towards } = turnBeforeMove;
    this.s.lookAngleDst = this.getEulerAngle(
      geom.clockwiseFromNorth(towards.y - position.z, towards.x - position.x)
    );

    const ms = (turnBeforeMove.ms -= deltaSecs * 1000);
    if (ms > 0) {
      return;
    }

    // finished turn
    this.s.turnBeforeMove = null;
    agent.raw.params.set_maxSpeed(this.getMaxSpeed());
    if (this.s.offMesh !== null) {
      const agentAnim = /** @type {NPC.dtCrowdAgentAnimation} */ (this.base.agentAnim);
      agentAnim.set_t(0);
      agentAnim.set_tmid(this.s.offMesh.anim.tmid);
      agentAnim.set_tmax(this.s.offMesh.anim.tmax);
    }
  }

  resetSkin() {
    this.base.skin = {};
    this.applySkin();
  }

  resetTint() {
    /** @type {Partial<Record<Key.SkinPart, true>>} */
    const remember = { 'breath': true, 'label': true, 'selector': true, }
    
    for (const skinPartKey of keys(this.base.tint)) {
      !(skinPartKey in remember) && delete this.base.tint[skinPartKey];
    }

    this.applyTint();
  }

  /**
   * Smoothly change agent.separationWeight
   * @param {number} separationWeight 
   * @param {number} [smoothTime] 
   */
  async separate(separationWeight, smoothTime = 0.2) {
    this.reject.separate?.(Error('separate-again'));
    try {
      const agent = /** @type {NPC.CrowdAgent} */ (this.base.agent);
      this.s.separation = {
        current: agent.raw.params.get_separationWeight(),
        dst: separationWeight,
        smoothTime,
      };
      await new Promise((resolve, reject) => {
        this.resolve.separate = resolve;
        this.reject.separate = reject;
      });
    } catch (e) {
      this.s.separation = null;
      throw e;
    }
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
   * @param {boolean} enabled 
   */
  setSlowDown(enabled) {
    const slowDownRadius = enabled === true ? defaultSlowDownRadius : 0.05;
    const agent = /** @type {NPC.CrowdAgent} */ (this.base.agent);
    agent.raw.params.set_slowDownRadius(slowDownRadius);
  }

  /** @param {NPC.StopReason | Error} error */
  rejectMove(error) {
    this.reject.moves.forEach(reject => reject(error));
    this.reject.moves.length = 0;
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
    (this.base.tint.label ??= [1, 1, 1, 1])[3] = shouldShow ? 1 : 0;
    this.applyTint();
  }

  /**
   * Also tints selector via @see {s.selectorColor}
   * @param {boolean} shouldShow
   */
  showSelector(shouldShow) {
    this.base.tint.selector = [...this.s.selectorTint, shouldShow ? 1 : 0];
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
    const curr = this.m.toAct[this.s.anim];
    const next = this.m.toAct[input];
    curr.fadeOut(glbFadeOut[this.s.anim][input]);
    next.reset().fadeIn(glbFadeIn[this.s.anim][input]).play();

    this.s.anim = input;
    const meta = npcClassToMeta[this.def.classKey];
    this.base.mixer.timeScale = meta.timeScale[input] ?? 1;

    this.updateLabelOffsets();
  }

  /** @param {NPC.StopReason} reason */
  stopMoving(reason = { type: 'stop-reason', key: 'stopped', rest: this.getRemainingPath() }) {
    const agent = this.base.agent;

    if (agent === null || this.s.target === null) {
      return;
    }

    this.s.lookSecs = lookSecsNoTarget;
    this.s.lookAngleDst = null;
    this.s.slowBegin = null;
    this.s.target = null;

    agent.raw.params.set_maxSpeed(this.getMaxSpeed() * 0.75);
    agent.raw.params.set_maxAcceleration(defaultMaxAcceleration);
    agent.raw.params.set_updateFlags(defaultAgentUpdateFlags);
    agent.raw.params.set_collisionQueryRange(defaultCollisionQueryRange);
    agent.raw.params.set_separationWeight(defaultIdleSeparationWeight);
    agent.raw.params.set_radius(helper.defaults.radius);
    
    this.startAnimation('Idle');

    const pos = agent.position(); // reset small motions:
    const position = this.base.lastStart.distanceTo(pos) <= 0.05 ? this.base.lastStart : pos;

    if (this.s.offMesh === null || this.s.offMesh.seg === 0) {
      this.tryStopOffMesh();
      agent.teleport(position);
      agent.requestMoveTarget(position);
    } else {// midway through traversal, so stop when finish
      agent.requestMoveTarget(toV3(this.s.offMesh.dst));
    }

    if (reason.key === 'arrived') {
      this.resolve.move?.();
    } else {
      this.rejectMove(reason);
    }

    this.w.events.next({ key: 'stopped-moving', npcKey: this.key, reason });
  }

  tryStopOffMesh() {
    // 🔔 offMeshConnection can happen when `this.s.offMesh` null,
    // e.g. when npc without access is close to door
    if (this.base.agentAnim?.active !== true) {
      return false;
    }
    if (
      this.base.agentAnim.t <= this.base.agentAnim.tmid
      || this.base.agentAnim.tmax === Infinity // turnBeforeMove
    ) {
      this.w.events.next({ key: 'clear-off-mesh', npcKey: this.key });
      return true;
    }
    return false;
  }

  updateLabelOffsets() {
    const { anim: act } = this.s;
    const { animHeights, labelHeight } = this.base.gltfAux;
    const offsetY = animHeights[act] + 3 * labelHeight;
    
    // speech bubble (if exists)
    this.base.offsetSpeech.y = offsetY;

    // shader label position
    this.s.labelY = this.base.position.y + offsetY;
    this.setUniform('labelY', this.s.labelY);

    if (act === 'Lie') {// fix contextmenu position
      const clockwiseFromEast = this.getAngle() - Math.PI/2;
      this.base.offsetMenu.set(0.5 * Math.cos(clockwiseFromEast), 0, 0.5 * Math.sin(clockwiseFromEast));      
    } else {
      this.base.offsetMenu.set(0, 0, 0);
    }
  }

  async waitUntilStopped() {
    await new Promise((resolve, reject) => {
      this.resolve.move = resolve; // see "stopped-moving"
      this.reject.moves.push(reject); // see w.npc.remove
    });
  }

}

const lookSecsNoTarget = 0.75;
// 🔔 tuned so that sharp turns (e.g. 180°) are smooth
const defaultMaxAcceleration = 7;

// const staticSeparationWeight = 0.25;
// const movingSeparationWeight = 0.5;
/**
 * 🔔 sudden change can cause jerk onexit doorway
 * 🔔 relevant to reachability of arrival distance
 */
const defaultSeparationWeight = 0.1;
const defaultIdleSeparationWeight = 0.25;
const defaultCollisionQueryRange = 2;
const defaultSlowDownRadius = helper.defaults.radius * 2;

const preOffMeshCloseDist = helper.defaults.radius;

/** @type {Partial<import("@recast-navigation/core").CrowdAgentParams>} */
export const crowdAgentParams = {
  radius: helper.defaults.radius, // 🔔 too large causes jerky collisions
  slowDownRadius: defaultSlowDownRadius,
  // slowDownRadius: npcTargetArriveDistance,
  // slowDownRadius: helper.defaults.radius,
  height: 1.5,
  maxAcceleration: defaultMaxAcceleration,
  pathOptimizationRange: helper.defaults.radius * 30,
  collisionQueryRange: defaultCollisionQueryRange,
  separationWeight: defaultIdleSeparationWeight,
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
