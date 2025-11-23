import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { damp, dampAngle } from "maath/easing";
import { deltaAngle } from "maath/misc";
import braces from "braces";

import { Rect, Vect } from '../geom';
import { defaultAgentUpdateFlags, geomorphGridMeters, glbFadeIn, glbFadeOut, npcClassToMeta, npcLabelMaxChars, defaultNpcArriveDistance, skinsLabelsTextureHeight, skinsLabelsTextureWidth, nearTargetDistance, precision, skinsLabelScale } from '../service/const';
import { debug, error, jsStringify, keys, warn } from '../service/generic';
import { geom } from '../service/geom';
import { buildObject3DLookup, emptyAnimationMixer, emptyGroup, emptyShaderMaterial, emptySkinnedMesh, getRootBones, tmpEulerThree, tmpVectThree1, toV3, v3Precision } from '../service/three';
import { helper } from '../service/helper';
import { addBodyKeyUidRelation, npcToBodyKey } from '../service/rapier';

/** AKA `NPC.NPC` */
export class NpcApi {

  /** @type {string} User specified e.g. `rob` */
  key;
  /** @type {NPC.NPCDef} Initial definition */
  def;
  /** @type {number} When we (re)spawned */
  epochMs = Date.now();
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
  /** Point on ground i.e. `(this.position.x, this.position.z)` */
  point = new Vect();
  /** Shortcut to `this.m.group.rotation` */
  rotation = tmpEulerThree;
  /** Difference between last position */
  delta = new Vect();

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

  /** Driven by CrowdAgent.state */
  agentState = /** @type {null | number} */ (null);
  /** Current animation key. */
  anim = /** @type {Key.Anim} */ ('Idle');
  /** Animation to play on arrival or none if `false` (e.g. continuous loop) */
  arriveAnim = /** @type {false | Key.Anim} */ ('Idle');
  /** Minimal distance at which npc is consider to have arrived */
  arriveDist = defaultNpcArriveDistance;
  /** Defined iff npc is at a "do point". */
  doMeta = /** @type {null | Meta} */ (null);
  /** Fade duration e.g. during fade spawn */
  fadeSecs = 0.3;
  /**
   * Text of label above npc, or `null` if empty.
   * This is hidden when the npc has a speech bubble.
   */
  label = /** @type {null | string} */ (null);
  /** Height of label above npc */
  labelY = 0;
  /** Desired look angle (`rotation.y`) */
  lookAngleDst = /** @type {null | number} */ (null);
  /** Look duration e.g. during move or look */
  lookSecs = lookSecsNoTarget;
  /** An offMeshConnection traversal */
  offMesh = /** @type {null | NPC.OffMeshState} */ (null);
  /** Prevent `move` until after this, otherwise repeated offMesh can force its way through  */
  offMeshCoolDown = 0;
  /** Opacity e.g. during fade */
  opacity = 1;
  /** Desired opacity */
  opacityDst = /** @type {null | number} */ (null);
  /** Can walk or run */
  run = false;
  /** Npc selector color, default blue */
  selectorTint = /** @type {[number, number, number]} */ ([0, 0, 1]);
  /** For tweening agent separation weight */
  separation = /** @type {null | { current: number; dst: number; smoothTime?: Number; }} */ (null);
  /**
   * Time when slowness detected (world timer elapsedTime in seconds).
   * 🤔 Pausing currently resets World timer.
   */
  slowBegin = /** @type {null | number} */ (null);
  /** Number of spawns, where more than 1 means we have re-spawned. */
  spawns = 0;
  /** Target during move. */
  target = /** @type {null | Geom.Vect} */ (null);

  /** @type {null | NPC.CrowdAgent} */
  agent = null;
  /** @type {null | dtCrowdAgentAnimation} */
  agentAnim = null;
  
  /** Last starting position. */
  lastStart = new Vect();
  /** Current target (if moving), last set one (if not) */
  lastTarget = new Vect();
  /** Number of corners left whilst moving */
  numCorners = 0;

  /** ContextMenu has different position when `this.act` is `Lie` */
  offsetMenu = new THREE.Vector3();
  offsetSpeech = new THREE.Vector3();

  /**
   * For continuous motion between multiple targets.
   * @type {Geom.Vect[]}
   */
  pendingTargets = [];

  resolve = {
    fade: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    move: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    separate: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    spawn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    turn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
  };

  reject = {
    fade: /** @type {undefined | ((error: any) => void)} */ (undefined),
    move: /** @type {undefined | ((error: NPC.StopReason | Error) => void)} */ (undefined),
    separate: /** @type {undefined | ((error: any) => void)} */ (undefined),
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
    this.w = w;

    this.key = def.key;
    this.def = def;
    this.bodyUid = addBodyKeyUidRelation(npcToBodyKey(this.key), w.physics)
  }

  /**
   * - Adjust `npc.target` and `npc.pendingTargets`.
   * - One should also `requestMoveTarget` if current target changed.
   * @param {null | NPC.GroundPoint} target
   * @param {NPC.GroundPoint[]} pendingTargets
   */
  adjustTargets(target, ...pendingTargets) {
    this.target = target === null ? null : Vect.from(helper.toXZ(target));
    pendingTargets = pendingTargets.map(helper.toXZ);
    this.pendingTargets = pendingTargets.map(Vect.from);
  }

  /**
   * Apply uv re-mapping to `this.skin`.
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

  /**
   * @param {'removed' | 'respawned'} reason 
   */
  cancel(reason) {
    debug(`${'cancel'}: cancelling ${this.key}`);

    this.rejectFade(Error(`${'cancel'}: cancelled fade`));
    this.rejectMove({ type: 'stop-reason', key: reason });
    this.rejectTurn(Error(`${'cancel'}: cancelled fade`));

    // this.w.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
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
   * Exit offMeshConnection optionally continuing at maxSpeed.
   * The latter is optional e.g. in case we're stationary and turning around.
   * @param {Geom.VectJson} target
   */
  exitOffMeshFor(target, continueMaxSpeed = true) {
    const agent = /** @type {NPC.CrowdAgent} */ (this.agent);
    const agentAnim = /** @type {NPC.dtCrowdAgentAnimation} */ (this.agentAnim);

    agentAnim.set_active(false);
    agent.teleport(this.position);

    if (continueMaxSpeed === true) {// fix speed after teleport
      const angle = this.point.angleTo(target);
      agent.raw.set_vel(0, Math.cos(angle) * this.getMaxSpeed());
      agent.raw.set_vel(2, Math.sin(angle) * this.getMaxSpeed());
    }
    
    agent.raw.set_targetState(1);
    agent.requestMoveTarget(toV3(target));
    this.setSlowDownRadius(false);
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
    this.opacityDst = opacityDst;
    this.fadeSecs = ms / 1000;
    
    try {
      this.w.events.next({ key: 'fade-npc', npcKey: this.key, opacityDst });
      await new Promise((resolve, reject) => {
        this.resolve.fade = resolve;
        this.reject.fade = reject;
      });
    } catch (e) {
      this.opacityDst = null;
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
      await this.fade(0, 200);

      const dx = at.x - this.point.x;
      const dy = at.y - this.point.y;

      await this.w.npc.spawn({
        angle: opts.angle ?? (
          dx === 0 && dy === 0 ? undefined : geom.clockwiseFromNorth(dy, dx)
        ),
        at,
        classKey: opts.classKey,
        meta: opts.meta,
        npcKey: this.key,
      });

      await this.fade(1, 150);

    } catch (e) {
      // ensure opacity 1 without blocking
      this.fade(1, 150 * (1 - this.opacity));
      throw e;
    }
  }

  /**
   * Find next off-mesh-connection via lookup
   * @param {NPC.CrowdAgent} agent
   * @returns {null | NPC.OffMeshLookupValue}
   */
  findNextOffMesh(agent) {
    const { offMeshLookup } = this.w.nav;
    return (// find off-mesh-connection via lookup
      offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(0), agent.raw.get_cornerVerts(2))]
      ?? offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(3), agent.raw.get_cornerVerts(5))]
      ?? offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(6), agent.raw.get_cornerVerts(8))]
      ?? null
    );
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
    /* return geom.radRange(Math.PI - this.rotation.y); */
    return Math.PI - this.rotation.y;
  }

  /** @param {NPC.GroundPoint} point */
  getAngleTo(point) {
    return deltaAngle(this.getAngle(), this.getLookAngle(point));
  }

  /**
   * Cannot use agent.corners() because ag->ncorners is 0 on offMeshConnection
   * @param {NPC.OffMeshLookupValue} offMesh
   */
  getCornerAfterOffMesh(offMesh) {
    const agent = /** @type {NPC.CrowdAgent} */ (this.agent);
    // try to use 3rd point but sometimes must use 4th
    const x = agent.raw.get_cornerVerts(6 + 0);
    const y = agent.raw.get_cornerVerts(6 + 2);
    if (Math.abs(offMesh.dst.x - x) < 0.05 && Math.abs(offMesh.dst.z - y) < 0.05) {
      return { x: agent.raw.get_cornerVerts(9 + 0), y: agent.raw.get_cornerVerts(9 + 2) };
    } else {
      return { x, y };
    }
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
    const anim = /** @type {dtCrowdAgentAnimation} */ (this.agentAnim);
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
   * @param {NPC.GroundPoint} input
   */
  getLookAngle(input) {
    const src = this.point;
    const dst = helper.toXZ(input);
    return src.x === dst.x && src.y === dst.y
      ? this.getAngle()
      : geom.clockwiseFromNorth(dst.y - src.y, dst.x - src.x)
    ;
  }

  getMaxSpeed() {
    // return 1;
    return this.run === true ? this.def.runSpeed : this.def.walkSpeed;
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
   * Given other npc using same offMeshConnection, get how far ahead it is.
   * @param {NPC.NPC} other another npc using same offMeshConnection
   */
  getOtherDoorwayLead(other) {
    const offMesh = /** @type {NPC.OffMeshState} */ (other.offMesh);
    const direction = offMesh.seg >= 1 ? offMesh.mainUnit : offMesh.initUnit;
    return (other.point.x - this.point.x) * direction.x + (other.point.y - this.point.y) * direction.y;
  }

  getRadius() {
    return helper.defaults.radius;
  }

  getRect(radius = this.getRadius()) {
    return new Rect(
      this.point.x - radius,
      this.point.y - radius,
      2 * radius,
      2 * radius,
    );
  }

  getRemainingPath() {
    return (
      this.target === null ? [] : [this.target]
    ).concat(this.pendingTargets).map(x => x.json);
  }

  getTarget() {
    return this.pendingTargets.at(-1) ?? this.target ?? null;
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
   * @param {number} deltaSecs
   * @param {NPC.CrowdAgent} agent
   * @param {NPC.OffMeshState} offMesh
   */
  handleOffMeshConnection(deltaSecs, agent, offMesh) {
    if (offMesh.seg === 0) {
      this.handlePreOffMeshCollision(agent, offMesh);
    }

    const anim = /** @type {dtCrowdAgentAnimation} */ (this.agentAnim);

    if (offMesh.seg === 0 && anim.t > anim.tmid) {
      offMesh.seg = 1;
      this.w.events.next({ key: 'enter-off-mesh-main', npcKey: this.key });
    } else if (offMesh.seg === 1 && anim.t > 0.5 * (anim.tmid + anim.tmax)) {
      offMesh.seg = 2; // midway in main segment
    }

    if (offMesh.seg >= 2 && offMesh.tScaleDst !== null) {
      // - slow down if will stop right after doorway
      // - speed up if changed target while slowing down
      // 🔔 scaling up tScaleSmoothTime makes traversal faster
      damp(offMesh, 'tScale', offMesh.tScaleDst, offMesh.tScaleSmoothTime, deltaSecs);
      anim.set_tScale(offMesh.tScale);
    }

    // look further along the path
    // 🔔 with 0.2 saw jerk when two agents through doorway
    const lookAt = this.getFurtherAlongOffMesh(offMesh, 0.4);
    const dirX = lookAt.x - this.point.x;
    const dirY = lookAt.y - this.point.y;
    const radians = geom.clockwiseFromNorth(dirY, dirX);
    this.lookAngleDst = radians;

    if (anim.t > anim.tmax - 0.1) {// exit in direction we're looking
      anim.set_unitExitVel(0, Math.cos(radians - Math.PI/2) * anim.tScale);
      anim.set_unitExitVel(1, 0);
      anim.set_unitExitVel(2, Math.sin(radians - Math.PI/2) * anim.tScale);
    }
  }

  /**
   * Detect collisions whilst on initial segment of offMeshConnection
   * @param {NPC.CrowdAgent} agent
   * @param {NPC.OffMeshState} offMesh
   */
  handlePreOffMeshCollision(agent, offMesh) {
    const nneis  = agent.raw.nneis;
    /** @type {NPC.CrowdNeighbour} */ let nei;
    // 🔔 if too small, can be jerky on collide after offMeshConnection begins
    const closeDist = preOffMeshCloseDist * (this.run === true ? 2 : 1);

    for (let i = 0; i < nneis; i++) {
      nei = agent.raw.get_neis(i);
      if (nei.dist > closeDist) {
        continue;
      }

      // maybe cancel traversal
      const other = this.w.a[nei.idx];

      if (other.offMesh !== null) {
        const lead = this.getOtherDoorwayLead(other);
        if (lead >= 0.3 || lead <= 0) {
          continue; // 🔔 other traversing with enough lead
        }
      }

      const delta = tmpVect1.copy(offMesh.dst).sub(this.point).normalize(
        other.target === null ? 0.5 : 0
      );
      if (geom.lineSegIntersectsCircle(
        // look further ahead, to avoid "npc behind us" from stopping us
        delta.add(this.point).json,
        offMesh.dst,
        other.point,
        0.3,
      ) === false) {
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

    this.gltfAux = this.w.npc.gltfAux[this.def.classKey];
  }

  /**
   * @param {NPC.GroundPoint} [groundPoint]
   * @param {number} [nearDistance]
   */
  isNear(groundPoint = this.lastTarget, nearDistance = nearTargetDistance) {
    const y = 'z' in groundPoint ? groundPoint.z : groundPoint.y;
    return (
      Math.abs(groundPoint.x - this.point.x) < nearDistance
      && Math.abs(y - this.point.y) < nearDistance
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
    if (helper.canAnimKeyLook(this.anim) === false) {
      throw new Error(`${'look'}: cannot whilst "${this.anim}"`);
    }

    this.lookAngleDst = input;
    this.lookSecs = ms / 1000;

    try {
      await new Promise((resolve, reject) => {
        this.resolve.turn = resolve;
        this.reject.turn = reject;
      });
    } catch (e) {
      this.lookAngleDst = null;
      throw e;
    }
  }

  /**
   * Possible cases:
   * - `do` is a "do point"
   *   i.e. `do.meta.do === true` 
   * - npc is at a "do point" (e.g. off-mesh) and `do` is navigable
   *   i.e. `do.meta.nav` and `npc.doMeta !== null`
   * - `npc` is off-mesh and `do` is nearly navigable
   * 
   * @param {NPC.DoOpts} opts 
   */
  async make(opts) {
    const at = opts.do;
    if (helper.isVectJson(at) === false) {
      throw Error('opts.do must be {x,y} or {x,y,z}');
    } else if (at.meta == null) {
      throw Error('opts.do.meta expected');
    }
    const point = /** @type {Meta<Geom.VectJson>} */ (helper.toXZ(at));
    const meta = point.meta = at.meta;

    const w = this.w;
    const srcNav = w.npc.isPointInNavmesh(this.point);
    
    // dst do
    if (meta.do === true) {
      const doPoint = /** @type {Geom.VectJson} */ (meta.doPoint);
      const otherNpcKey = w.npc.doToNpc[`${doPoint.x},${meta.y ?? 0},${doPoint.y}`];
      if (otherNpcKey !== undefined) {
        throw Error(`do point in use (${otherNpcKey})`);
      }

      if (srcNav === true) {// on-mesh -> act point
        await this.onMeshDo(point, { ...at, preferSpawn: false });
      } else {// off-mesh -> do point
        await this.offMeshDo(point);
      }
      return;
    }

    // acting and dst navigable
    if (this.doMeta !== null && meta.nav === true) {
      if (srcNav === true) {
        w.npc.setDoMeta(this.key, null);
        await this.move({ to: point });
      // } else if (w.npc.canSee(this.getPosition(), point, this.getInteractRadius())) {
      // } else if (true) {
      } else if (
        typeof meta.grKey === 'string'
          ? meta.grKey === w.e.npcToRoom.get(this.key)?.grKey
          : false
      ) {
        await this.fadeSpawn(point);
      } else {
        throw Error('cannot reach navigable point')
      }
      return;
    }

    // src off-mesh and dst "nearly navigable"
    if (srcNav === false && meta.nav === false) {
      const closest = w.npc.getClosestNavigable(toV3(at));
      if (closest !== null) {
        await this.offMeshDo({...helper.toXZ(closest), meta: { nav: true }});
        return;
      }
    }

    throw Error('not doable');
  }

  /**
   * @param {NPC.MoveOpts} opts
   */
  async move(opts) {
    const { agent } = this;

    if (agent === null) {
      throw new Error(`npc lacks agent: ${this.key}`);
    }

    // ensure fresh points sans meta
    const points = (Array.isArray(opts.to) ? opts.to : [opts.to]).map(helper.toXZ);
    if (!(points.every(helper.isVectJson))) {
      throw Error(`opts.to must be {x,y}, {x,y,z} or array`);
    }
    
    if (Date.now() < this.offMeshCoolDown) {
      throw /** @satisfies {NPC.StopReason} */ ({
        type: 'stop-reason',
        key: 'too-many-moves',
        rest: points,
      });
    }

    this.getTarget() !== null && this.rejectMove({
      type: 'stop-reason',
      key: 'move-again',
      rest: this.getRemainingPath(),
    });

    if (points.length === 0) {
      return;
    }

    this.arriveAnim = opts.arriveAnim ?? 'Idle';

    const to = /** @type {NPC.GroundPoint} */ (points.shift());
    this.pendingTargets.push(...points.map(x => Vect.from(x).precision(precision)));
    this.setSlowDownRadius();

    // doorway half-depth is 0.3 or 0.4, so could set `opts.close` as `0.5`
    const closest = this.w.npc.getClosestNavigable(toV3(to), Math.max(opts.close ?? 0, 0.05));
    if (closest === null) {
      throw new Error(`not navigable: ${jsStringify(to)}`);
    }

    if (this.pendingTargets.length === 0 && this.isNear(closest, 0.1) === true) {
      this.lookSecs = 0.2;
      this.lookAngleDst = this.getLookAngle(closest)
      return; // avoid close click jerk
    }

    if (this.doMeta !== null) {// must be on-mesh act point
      this.w.npc.setDoMeta(this.key, null);
    }

    v3Precision(closest);
    this.arriveDist = defaultNpcArriveDistance;
    this.lookSecs = 0.2;

    agent.raw.params.set_maxAcceleration(defaultMaxAcceleration);
    agent.raw.params.set_maxSpeed(this.getMaxSpeed());
    agent.raw.params.set_collisionQueryRange(defaultAgentUpdateFlags);
    agent.raw.params.set_separationWeight(defaultSeparationWeight);
    agent.raw.params.set_queryFilterType(helper.queryFilterType.respectUnwalkable);
    agent.raw.params.set_radius((this.run === true ? 1.5 : 1) * helper.defaults.radius);
    this.agentAnim?.set_tScale(1);

    this.lastStart.copy(this.point);
    this.target = this.lastTarget.set(closest.x, closest.z);

    if (this.tryStopOffMesh() === true) {
      agent.teleport(this.position);
      // handle immediate new offMeshConnection
      if (this.agentState === 2) this.agentState = -1;
    } else if (typeof this.offMesh?.tScaleDst === 'number') {
      // speed back up
      this.offMesh.tScaleDst = 1;
      this.offMesh.tScaleSmoothTime = 0.1;
    }

    agent.requestMoveTarget(closest);

    this.startAnimation(
      this.isNear(closest, 0.35) === true
        ? 'Idle' // avoid jerk, looks better when turning
        : this.run === true ? 'Run' : 'Walk'
    );

    this.w.events.next({
      key: 'started-moving',
      npcKey: this.key,
      showNavPath: opts.debugPath ?? this.w.npc.showLastNavPath,
    });

    try {
      await this.waitUntilStopped();
    } catch (e) {
      if (!(helper.isStopReason(e) && e.key === 'move-again') && this.target !== null) {
        this.stopMoving(); // stop on error except "move-again"
      }
      throw e;
    } finally {
      this.pendingTargets.length = 0;
      this.setSlowDownRadius(true);
      this.tryStopOffMesh(); // when turnBeforeMove
      this.numCorners = 0;
    }
  }

  /**
   * @param {MaybeMeta<Geom.VectJson>} at 
   */
  async offMeshDo(at) {
    const src = this.point;
    const meta = at.meta ?? {};

    // 🚧 move this condition "higher up"
    if (// 🔔 permit move between do points in same room, ≤ 3 grids away
      !(src.distanceTo(at) <= geomorphGridMeters * 3)
      || !this.w.npc.inSameRoom(src, at)
      // || !this.w.npc.canSee(src, point, this.getInteractRadius())
    ) {
      throw Error('too far away');
    }

    await this.fadeSpawn(
      {...meta.doPoint ?? at}, // 🚧 do points should have meta.doPoint
      {
        angle: meta.nav === true && meta.do !== true
          // use direction src --> point if entering navmesh
          ? src.equals(at)
            ? undefined
            : src.angleTo(at) + Math.PI/2 // "cw from north"
          // use meta.orient if staying off-mesh
          : typeof meta.orient === 'number'
            ? meta.orient * (Math.PI / 180) // meta.orient already "cw from north"
            : undefined,
        // fadeOutMs: opts.fadeOutMs,
        meta,
      },
    );    
  }

  onArriveTarget() {
    const agent = /** @type {NPC.CrowdAgent} */ (this.agent);
    const pendingTarget = this.pendingTargets.shift();
    
    if (pendingTarget === undefined) {
      this.stopMoving(
        { type: 'stop-reason', key: 'arrived' },
        // only finish look when move a short distance
        this.lastStart.distanceTo(this.point) < 0.5 ? this.lookAngleDst : null
      );
      return;
    }

    this.lastStart.copy(this.point);
    this.target = this.lastTarget.copy(pendingTarget);
    this.numCorners = 0;
    this.setSlowDownRadius();
    agent.requestMoveTarget(toV3(this.target));
    agent.raw.set_targetReplan(true); // fix bad initial path
    this.w.events.next({ key: 'continued-moving', npcKey: this.key, showNavPath: this.w.npc.showLastNavPath });
  }

  /**
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   * @param {number} next
   */
  onChangeAgentState(agent, next) {
    if (next === 2) {// enter offMeshConnection
      const offMesh = this.findNextOffMesh(agent);
      if (offMesh !== null) {
        this.w.events.next({ key: 'try-off-mesh', npcKey: this.key, offMesh });
      } else {
        agent.teleport(this.position);
        error(`${this.key}: bailed out of unknown offMeshConnection`);
      }
      return;
    }
    
    if (this.agentState === 2) {// exit offMeshConnection
      if (this.offMesh !== null) {
        this.w.events.next({ key: 'exit-off-mesh', npcKey: this.key, offMesh: this.offMesh  });
      } else {
        // cancelled offMeshConnection before reaching main segment
        // warn(`${this.key}: exited offMeshConnection but this.offMesh already null`);
      }
      return;
    }
  }

  /**
   * @param {NPC.CrowdAgent} agent
   * @param {number} numCorners
   */
  onChangeNumCorners(agent, numCorners) {// 🚧 unused
    this.numCorners = numCorners;
    if (this.offMesh !== null) {
      return;
    }
    if (numCorners === 1) {
      //console.log('APPROACH');
    } else if (numCorners === 2) {
      //console.log('JUST_AROUND_CORNER');
    }
  }

  /**
   * @param {MaybeMeta<Geom.VectJson>} at 
   * @param {object} opts
   * @param {boolean} [opts.preferSpawn]
   */
  async onMeshDo(at, opts = {}) {
    const src = this.point;
    const meta = at.meta ?? {};

    /** Actual "do point" usually differs from clicked point */
    const doPoint = /** @type {Geom.VectJson} */ (meta.doPoint) ?? at;

    if (meta.do !== true) {
      throw Error('not doable');
    }

    // 🚧 move this condition "higher up"
    if (!this.w.npc.inSameRoom(src, doPoint)) {
      throw Error('too far away');
    }

    // `meta.orient` (degrees) uses "cw from north",
    const angle = typeof meta.orient === 'number'
      ? meta.orient * (Math.PI/180)
      : undefined
    ;
    
    // 🤔 could do visibility check (raycast)
    if (!opts.preferSpawn && this.w.npc.isPointInNavmesh(doPoint) === true) {
      // Walk, [Turn], Act
      await this.move({ to: doPoint });
      if (typeof angle === 'number') {
        await this.look(angle, 500 * geom.compareAngles(this.getAngle(), angle));
      }
      this.w.npc.setDoMeta(this.key, meta);
      this.startAnimation(meta);
    } else {
      // this also sets act meta
      await this.fadeSpawn(doPoint, { angle, requireNav: false, meta });
    }
  }

  /**
   * @param {THREE.Group | null} group 
   */
  onMount(group) {
    if (group !== null) {
      this.m.group = group;
      // Setup shortcut
      this.position = this.position = group.position;
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
   * @param {number} deltaSecs
   * @param {number[]} positions
   * Format `[..., bodyUid_i, x_i, y_i, z_i, ...]` for physics.worker
   */
  onTick(deltaSecs, positions) {
    this.mixer.update(deltaSecs);

    if (this.lookAngleDst !== null) {
      const rotYDst = this.getEulerAngle(this.lookAngleDst);
      if (dampAngle(this.rotation, 'y', rotYDst, this.lookSecs, deltaSecs, undefined, undefined, 0.01) === false) {
        // 🚧 move into this.onArriveAngle
        this.lookAngleDst = null;
        this.resolve.turn?.();

        if (this.target === null && this.pendingTargets.length > 0) {
          this.startAnimation('Walk'); // start walking again
          this.onArriveTarget(); // continue pending target
        } else if (this.target === null) {
          this.startAnimation('Idle'); // go Idle after collision
        }
      }
    }

    if (this.opacityDst !== null) {
      if (damp(this, 'opacity', this.opacityDst, this.fadeSecs / 1.5, deltaSecs, undefined, undefined, 0.005) === false) {
        this.opacityDst = null;
        this.resolve.fade?.();
      }
      this.setUniform('opacity', this.opacity);
    }

    const { agent } = this;

    if (agent === null) {
      return;
    }

    this.onTickAgent(deltaSecs, agent);

    if (agent.raw.dvel !== 0 || this.offMesh !== null) {
      const { x, y, z } = this.position;
      positions.push(this.bodyUid, x, y, z);
    }
  }

  /**
   * @param {number} deltaSecs
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   */
  onTickAgent(deltaSecs, agent) {
    const position = agent.position();
    const agentState = agent.state();

    this.delta.set(position.x, position.z).sub(this.point);
    this.position.copy(position);
    this.point.set(position.x, position.z);

    if (agentState !== this.agentState) {
      this.onChangeAgentState(agent, agentState);
      this.agentState = agentState;
    }

    if (this.separation !== null) {
      this.onTickSeparation(deltaSecs, agent, this.separation);
    }

    if (this.offMesh !== null) {
      this.handleOffMeshConnection(deltaSecs, agent, this.offMesh);
      return; // Avoid stopMoving whilst offMesh
    }

    if (this.target === null) {
      this.w.npc.onTickIdleTurn?.(this, agent);
      return;
    }

    this.onTickTurnTarget(agent);

    const distance = this.target.distanceTo(this.point);

    const numCorners = agent.raw.get_ncorners();
    if (numCorners !== this.numCorners) {
      this.onChangeNumCorners(agent, numCorners);
    }

    // 🔔 arriving earlier avoids small loops
    const arriveDist = this.arriveDist * (this.pendingTargets.length === 0 ? 1 : 1.5);
    if (distance <= arriveDist) {// Reached target
      this.onArriveTarget();
      return;
    }
    
    // avoid fast final turn
    if (this.pendingTargets.length === 0 && this.anim !== 'Idle' && distance <= 5 * arriveDist) {
      this.lookSecs = 0.5;
    }

    this.onTickDetectStuck(deltaSecs, agent);
  }

  /**
   * @param {number} deltaSecs
   * @param {NPC.CrowdAgent} agent
   * @param {NonNullable<this['separation']>} separation
   */
  onTickSeparation(deltaSecs, agent, separation) {
    const { current, dst, smoothTime = 0.4 } = separation;
    if (damp(separation, 'current', dst, smoothTime, deltaSecs, undefined, undefined, 0.02) === false) {
      this.separation = null;
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
    // 🔔 avoid "snap" onenter offMeshConnection at maxSpeed 
    // if (agent.raw.neis.dist > 0.5) {
    if (agent.raw.neis.dist > 0.3) {
      return;
    }
    
    // const smallDist = 0.3 * agent.raw.desiredSpeed * deltaSecs;
    const smallDist = 0.5 * agent.raw.desiredSpeed * deltaSecs;

    if (
      Math.abs(this.delta.x) > smallDist
      || Math.abs(this.delta.y) > smallDist
    ) {
      return this.slowBegin = null; // reset tracking
    }
    
    const { elapsedTime } = this.w.timer;
    this.slowBegin ??= elapsedTime;
    const longEnoughSecs = 0.3;

    if (elapsedTime - this.slowBegin < longEnoughSecs) {
      return; // too short
    }

    if (this.w.npc.onStuckNpc === null) {
      // 🔔 fixes "cannot arrive close enough" due to nearby-ish npc
      this.stopMoving({
        type: 'stop-reason',
        key: 'stuck',
        nearTarget: this.isNear(),
        rest: this.getRemainingPath(),
      });
    } else {
      this.w.npc.onStuckNpc?.(this, agent);
    }
  }

  /** @param {NPC.CrowdAgent} agent */
  onTickTurnTarget(agent) {
    const vel = agent.velocity();
    this.lookAngleDst = geom.clockwiseFromNorth(vel.z, vel.x);
  }

  /** @param {Error} [error] */
  rejectFade(error = Error('cancelled')) {
    this.reject.fade?.(error);
  }

  /** @param {NPC.StopReason | Error} [error] */
  rejectMove(error = { type: 'stop-reason', key: 'stopped', rest: this.getRemainingPath() }) {
    this.reject.move?.(error);
  }

  /** @param {Error} [error] */
  rejectTurn(error = Error('cancelled')) {
    this.reject.turn?.(error);
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
   * Smoothly change agent.separationWeight
   * @param {number} separationWeight 
   * @param {number} [smoothTime] 
   */
  async separate(separationWeight, smoothTime = 0.2) {
    this.reject.separate?.(Error('separate-again'));
    try {
      const agent = /** @type {NPC.CrowdAgent} */ (this.agent);
      this.separation = {
        current: agent.raw.params.get_separationWeight(),
        dst: separationWeight,
        smoothTime,
      };
      await new Promise((resolve, reject) => {
        this.resolve.separate = resolve;
        this.reject.separate = reject;
      });
    } catch (e) {
      this.separation = null;
      throw e;
    }
  }

  /**
   * @param {string | undefined | null} label
   */
  setLabel(label = null) {
    this.label = label;

    if (typeof this.label === 'string') {
      this.label.slice(0, npcLabelMaxChars);
    }

    const { ct } = this.w.texNpcLabel;
    ct.setTransform(1, 0, 0, 1, 0, 0);
    ct.clearRect(0, 0, skinsLabelsTextureWidth, skinsLabelsTextureHeight);
    
    if (label === null) {
      this.w.texNpcLabel.updateIndex(this.def.uid);
      return;
    }

    const strokeWidth = 8 * skinsLabelScale;
    // permits 10 chars on OSX Chrome
    const fontHeight = 32 * skinsLabelScale;
    ct.strokeStyle = 'rgba(20, 20, 20, 1)';
    ct.fillStyle = 'rgba(100, 100, 100, 1)';
    ct.lineWidth = strokeWidth;
    ct.font = `${fontHeight}px sans-serif`;
    ct.textBaseline = 'top';
    ct.letterSpacing = '1px';
    ct.textRendering = 'optimizeLegibility';
    ct.lineJoin = 'round';
    const { width } = ct.measureText(label);
    const dx = (skinsLabelsTextureWidth - width)/2;
    const dy = (skinsLabelsTextureHeight - fontHeight)/2;
    ct.strokeText(label, dx + strokeWidth, dy + strokeWidth);
    ct.fillText(label, dx + strokeWidth, dy + strokeWidth);

    this.w.texNpcLabel.updateIndex(this.def.uid);
  }

  setRun(next = !this.run) {
    if (next === this.run) {
      return;
    }
    this.run = next;
    if (next === true && this.anim === 'Walk') {
      this.startAnimation('Run');
    } else if (next === false && this.anim === 'Run') {
      this.startAnimation('Walk');
    }
    this.agent?.raw.params.set_maxSpeed(this.getMaxSpeed());
  }

  /**
   * - When enabled it has normal size, otherwise it is very small (almost no effect).
   * - By default it is enabled when there are no pendingTargets and there is an arriveAnim.
   * @param {boolean} [enabled] 
   */
  setSlowDownRadius(enabled = this.pendingTargets.length === 0 && this.arriveAnim !== false) {
    const slowDownRadius = enabled === true ? defaultSlowDownRadius : 0.05;
    const agent = /** @type {NPC.CrowdAgent} */ (this.agent);
    agent.raw.params.set_slowDownRadius(slowDownRadius);
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
    this.w.view.ensureRender();
  }

  /**
   * Also tints selector via @see {s.selectorColor}
   * @param {boolean} shouldShow
   */
  showSelector(shouldShow = this.tint.selector?.[3] === 1 ? false : true) {
    this.tint.selector = [...this.selectorTint, shouldShow ? 1 : 0];
    this.applyTint();
    // this.w.view.ensureRender();
  }

  /**
   * Start animation via key or meta
   * @param {Key.Anim | Meta} input
   */
  startAnimation(input, forceStartAnim = false) {
    if (typeof input !== 'string') {
      input = helper.getAnimKeyFromMeta(input);
    }
    if (input === this.anim && forceStartAnim === false) {
      return;
    }

    const curr = this.m.toAct[this.anim];
    const next = this.m.toAct[input];
    curr.fadeOut(glbFadeOut[this.anim][input]);
    next.reset().fadeIn(glbFadeIn[this.anim][input]).play();

    this.anim = input;
    const meta = npcClassToMeta[this.def.classKey];
    this.mixer.timeScale = meta.timeScale[input] ?? 1;

    this.updateLabelOffsets();
  }

  /**
   * @param {NPC.StopReason} reason
   * @param {null | number} lookAngleDst 
   */
  stopMoving(
    reason = { type: 'stop-reason', key: 'stopped', rest: this.getRemainingPath() },
    lookAngleDst = null,
  ) {
    const agent = this.agent;

    if (agent === null || this.target === null) {
      return;
    }

    this.lookSecs = lookAngleDst === null ? lookSecsNoTarget : 0.2;
    this.lookAngleDst = lookAngleDst;
    this.slowBegin = null;
    this.target = null;

    agent.raw.params.set_maxSpeed(this.getMaxSpeed() * 0.75);
    agent.raw.params.set_maxAcceleration(defaultMaxAcceleration);
    agent.raw.params.set_updateFlags(defaultAgentUpdateFlags);
    agent.raw.params.set_collisionQueryRange(defaultCollisionQueryRange);
    agent.raw.params.set_separationWeight(defaultIdleSeparationWeight);
    agent.raw.params.set_radius(helper.defaults.radius);
    
    if (reason.key === 'arrived') {
      if (typeof this.arriveAnim === 'string') {
        this.startAnimation(this.arriveAnim);
      }
    } else if (lookAngleDst === null) {
      this.startAnimation('Idle');
    } else {// Idle after look
      this.lookSecs = 0.3;
    }

    if (this.offMesh === null || this.offMesh.seg === 0) {
      this.tryStopOffMesh();

      if (this.point.distanceTo(this.lastStart) < 0.05) {
        // reset small motions
        this.position.copy(toV3(this.lastStart));
      }

      if (agent.state() === 2) {
        // MUST teleport before requestMoveTarget when offMesh, else get STUCK
        agent.teleport(this.position); // 🔔 sometimes jerky?
      }
      agent.requestMoveTarget(this.position);
    } else {// midway through traversal, so stop when finish
      agent.requestMoveTarget(toV3(this.offMesh.dst));
    }

    if (reason.key === 'arrived') {
      this.resolve.move?.();
    } else {
      this.rejectMove(reason);
    }

    this.w.events.next({ key: 'stopped-moving', npcKey: this.key, reason });
  }

  tryStopOffMesh() {
    const { agentAnim } = this;

    // 🔔 offMeshConnection can happen when `this.offMesh === null`
    // e.g. when npc without access is close to door
    if (agentAnim?.active !== true) {
      return false;
    }

    if (
      agentAnim.t <= agentAnim.tmid
      || agentAnim.tmax === Infinity // turnBeforeMove
    ) {
      this.w.events.next({ key: 'clear-off-mesh', npcKey: this.key });
      return true;
    }

    return false; // active in main seg; can't stop without visibly warping
  }

  updateLabelOffsets() {
    const { anim: act } = this;
    const { animHeights, labelHeight } = this.gltfAux;
    
    // Label in model is half below ground with total height `labelHeight`.
    // We'll move it 2.5 * labelHeight above npc's current height.
    const offsetY = 0.05 + animHeights[act] + (0.5 + 2.5) * labelHeight;
    
    // for speech bubble
    this.offsetSpeech.y = offsetY;

    if (act === 'Lie') {
      // 🚧 fix label too
      // fix contextmenu position
      const clockwiseFromEast = this.getAngle() - Math.PI/2;
      this.offsetMenu.set(0.5 * Math.cos(clockwiseFromEast), 0, 0.5 * Math.sin(clockwiseFromEast));      
    } else {
      this.offsetMenu.set(0, 0, 0);
    }

    // 🚧 labelY -> labelOffset
    this.labelY = this.position.y + offsetY;
    this.setUniform('labelY', this.labelY);
  }

  async waitUntilStopped() {
    await new Promise((resolve, reject) => {
      this.resolve.move = resolve; // see "stopped-moving"
      this.reject.move = reject; // see w.npc.remove
    });
  }

}

const lookSecsNoTarget = 0.75;
// 🔔 tuned so that sharp turns (e.g. 180°) are smooth
const defaultMaxAcceleration = 10;

/**
 * 🔔 sudden change can cause jerk onexit doorway
 * 🔔 relevant to reachability of arrival distance
 */
// const defaultSeparationWeight = 0.25;
const defaultSeparationWeight = 0.1;
const defaultIdleSeparationWeight = 0.25;
const defaultCollisionQueryRange = helper.defaults.radius * 8;
// const defaultCollisionQueryRange = helper.defaults.radius * 4;
// const defaultCollisionQueryRange = 0.1;
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

const tmpVect1 = new Vect();
