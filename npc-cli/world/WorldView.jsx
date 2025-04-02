import React from "react";
import * as THREE from "three";
import { css } from "@emotion/react";
import { Canvas } from "@react-three/fiber";
import { MapControls, PerspectiveCamera, Stats } from "@react-three/drei";
import { damp, damp3 } from "maath/easing";

import { debug } from "../service/generic.js";
import { Rect, Vect } from "../geom/index.js";
import { dataUrlToBlobUrl, getModifierKeys, getRelativePointer, isRMB, isTouchDevice } from "../service/dom.js";
import { fromXrayInstancedMeshName, longPressMs, pickedTypesInSomeRoom, zIndexWorld } from "../service/const.js";
import { dampXZ, emptySceneForPicking, hasObjectPickShaderMaterial, pickingRenderTarget, toV3, toXZ, unitXVector3, v3Precision } from "../service/three.js";
import { popUpRootDataAttribute } from "../components/PopUp.jsx";
import { WorldContext } from "./world-context.js";
import useStateRef from "../hooks/use-state-ref.js";
import NpcSpeechBubbles from "./NpcSpeechBubbles.jsx";
import { ContextMenu } from "./ContextMenu.jsx";

/**
 * @param {Props} props
 */
export default function WorldView(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    camInitPos: [0, 20, 0],
    canvas: /** @type {*} */ (null),
    clickIds: [],
    controls: /** @type {*} */ (null),
    controlsOpts: {
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: +Infinity,
      minPolarAngle: Math.PI * 0,
      maxPolarAngle: Math.PI * 1/3,
      minDistance: 8,
      maxDistance: w.smallViewport ? 20 : 32,
      panSpeed: 2,
      zoomSpeed: 0.5,
    },
    down: null,
    epoch: { pickStart: 0, pickEnd: 0, pointerDown: 0, pointerUp: 0 },
    fov: 30,
    glOpts: {
      toneMapping: 3,
      toneMappingExposure: 1,
      logarithmicDepthBuffer: true,
      pixelRatio: window.devicePixelRatio,
    },
    justLongDown: false,
    lastDown: undefined,
    lastScreenPoint: new Vect(),
    normal: {
      tri: new THREE.Triangle(),
      indices: new THREE.Vector3(),
      mat3: new THREE.Matrix3(),
    },
    raycaster: new THREE.Raycaster(),
    resolve: { fov: undefined, look: undefined, distance: undefined, polar: undefined, azimuthal: undefined },
    reject: { fov: undefined, look: undefined, distance: undefined, polar: undefined, azimuthal: undefined },
    rootEl: /** @type {*} */ (null),

    dst: {},

    zoomState: 'near', // 🚧 finer-grained

    canvasRef(canvasEl) {
      if (canvasEl !== null) {
        state.canvas = canvasEl;
        state.rootEl = /** @type {HTMLDivElement} */ (canvasEl.parentElement?.parentElement);
      }
    },
    clearTweens() {// 🔔 does not stop follow

      if (state.dst.look !== undefined && state.reject.look !== undefined) {
        // stop looking (not following)
        state.reject.look?.('cancelled look');
        state.reject.look = undefined;
        delete state.dst.look; // 🔔
      }

      state.reject?.distance?.('cancelled distance');
      state.reject?.fov?.('cancelled fov');
      state.reject?.polar?.('cancelled rotation: polar');
      state.reject?.azimuthal?.('cancelled rotation: azimuthal');
      
      state.syncRenderMode();
      state.controls.zoomToConstant = null;
      state.clearTargetDamping();
    },
    clearTargetDamping() {
      /**
       * 🔔 clear damping https://github.com/pmndrs/maath/blob/626d198fbae28ba82f2f1b184db7fcafd4d23846/packages/maath/src/easing.ts#L93
       * @type {{ __damp?: { [velKey: string]: number } }}
       */ (state.controls.target).__damp = undefined;
    },
    computeNormal(mesh, intersection) {// 🚧
      const { indices, mat3, tri } = state.normal;
      const output = new THREE.Vector3();
      indices.fromArray(
        /** @type {THREE.BufferAttribute} */ (mesh.geometry.index).array,
        /** @type {number} */ (intersection.faceIndex) * 3,
      );
      tri.setFromAttributeAndIndices(mesh.geometry.attributes.position, indices.x, indices.y, indices.z);
      tri.getNormal(output);
      const normalMatrix = mat3.getNormalMatrix(mesh.matrixWorld);
      output.applyNormalMatrix(normalMatrix);
      return output;
    },
    enableControls(enabled = true) {
      state.controls.enabled = !!enabled;
    },
    getDownDistancePx() {
      return state.down?.screenPoint.distanceTo(state.lastScreenPoint) ?? 0;
    },
    getNumPointers() {
      return state.down?.pointerIds.length ?? 0;
    },
    getWorldPointerEvent({
      key,
      distancePx = state.getDownDistancePx(),
      event,
      justLongDown = state.justLongDown,
      meta,
      position,
    }) {
      /** @type {ReturnType<State['getWorldPointerEvent']>} */
      const e = {
        key,
        position: new THREE.Vector3().copy(position),
        point: toXZ(position),
        distancePx,
        justLongDown,
        keys: getModifierKeys(event.nativeEvent),
        pointers: state.getNumPointers(),
        rmb: isRMB(event.nativeEvent),
        screenPoint: getRelativePointer(event),
        touch: isTouchDevice(),
        meta,
      };
      if (e.key === 'pointerup' && state.isPointerEventDrag(e) === false) {
        e.clickId = state.clickIds.pop();
      }
      return e;
    },
    handleClickInDebugMode(e) {
      if (
        w.disabled === true
        && w.menu.debugMode === true
        && state.lastDown !== undefined
        && state.lastDown.longDown === false
        && state.lastDown.screenPoint.distanceTo(getRelativePointer(e)) < 1
      ) {
        w.npc.tickOnceDebug();
      }
    },
    isPointerEventDrag(e) {
      return e.distancePx > (e.touch ? 20 : 5);
    },
    async lookAt(point, opts = { smoothTime: 0.4 }) {// look with "locked zoom"
      if (w.disabled === true && state.dst.look !== undefined && w.reqAnimId === 0) {
        state.clearTargetDamping(); // needs justification
      }

      try {
        const dst = toV3(point);
        state.controls.zoomToConstant = dst;
        await state.tween({ look: dst, lookOpts: opts });
      } finally {
        state.controls.zoomToConstant = null;
      }
    },
    onChangeControls(_e) {
      const zoomState = state.controls.getDistance() > 20 ? 'far' : 'near';
      zoomState !== state.zoomState && w.events.next({ key: 'changed-zoom', level: zoomState });
      state.zoomState = zoomState;
    },
    onControlsEnd() {
      w.events.next({ key: 'controls-end' });
    },
    onControlsStart() {
      w.events.next({ key: 'controls-start' });
      // 🔔 enabled controls override targetFov, target, targetDistance,
      state.reject.fov?.('cancelled fov change');
      state.reject.distance?.('cancelled zoom');
      state.reject.look?.('cancelled look');
    },
    onCreated(rootState) {
      w.threeReady = true;
      w.r3f = /** @type {typeof w['r3f']} */ (rootState);
      w.update(); // e.g. show stats
    },
    onObjectPickPixel(e, pixel) {// 🔔 references `w.e`
      
      state.lastDown = undefined; // overwritten below on successful raycast
      
      const [r, g, b, a] = Array.from(pixel);
      const decoded = w.e.decodeObjectPick(r, g, b, a);
      debug('picked:', { r, g, b, a }, '\n', decoded);

      if (decoded === null) {
        return;
      }

      const res = w.e.getRaycastIntersection(e, decoded);

      if (res === null) {
        return;
      }

      const position = v3Precision(decoded.picked === 'npc'
        ? w.n[decoded.npcKey].position.clone()
        : res.intersection.point.clone()
      );
      
      const normal = decoded.picked === 'npc'
        ? new THREE.Vector3(0, 1, 0)
        : state.computeNormal(res.mesh, res.intersection)
      ;
      // 🔔 fix flipped normals e.g. double-sided decor quad
      w.r3f.camera.getWorldDirection(tmpVectThree);
      if (normal.dot(tmpVectThree) > 0) {
        normal.multiplyScalar(-1);
      }

      const meta = {
        ...decoded,
        ...pickedTypesInSomeRoom[decoded.picked] === true
          && w.gmGraph.findRoomContaining(toXZ(position), true),
      };

      state.lastDown = {
        longDown: false,
        screenPoint: Vect.from(getRelativePointer(e)),
        position: position.clone(),
        normal,
        quaternion: new THREE.Quaternion().setFromUnitVectors(unitXVector3, normal),
        meta,
      };

      w.events.next(state.getWorldPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        justLongDown: false,
        meta,
        position,
      }));

      if (state.epoch.pointerUp >= state.epoch.pickStart) {
        // Native "pointerup" occurred before we finished this object-pick.
        // We can now trigger the world event:
        w.events.next(state.getWorldPointerEvent({
          key: "pointerup",
          event: e,
          meta,
          position,
        }));
      }
    },
    onPointerDown(e) {
      const sp = getRelativePointer(e);
      state.lastScreenPoint.copy(sp);
      state.epoch.pointerDown = Date.now();

      window.clearTimeout(state.down?.longTimeoutId); // No MultiTouch Long Press

      if (e.target !== state.canvas) {
        return; // ignore ContextMenu clicks
      }

      const cameraKey = e.metaKey || e.ctrlKey || e.shiftKey;

      state.down = {
        screenPoint: state.lastScreenPoint.clone(),
        longTimeoutId: state.down || cameraKey ? 0 : window.setTimeout(() => {
          state.justLongDown = true;
          if (state.lastDown === undefined) {
            return;
          }
          state.lastDown.longDown = true;
          w.events.next(state.getWorldPointerEvent({
            key: "long-pointerdown",
            event: e,
            justLongDown: false,
            meta: {},
            position: state.lastDown.position,
          }));
        }, longPressMs),
        pointerIds: (state.down?.pointerIds ?? []).concat(e.pointerId),
      };

      // includes async render-and-read-pixel
      state.pickObject(e);
    },
    onPointerLeave(e) {
      if (!state.down) {
        return;
      }

      window.clearTimeout(state.down.longTimeoutId);

      state.down.pointerIds = state.down.pointerIds.filter(x => x !== e.pointerId);
      if (state.down.pointerIds.length === 0) {
        state.down = null;
      }

      const rect = Rect.fromJson(state.canvas.getBoundingClientRect());
      if (!rect.contains({ x: e.clientX, y: e.clientY })) {
        state.justLongDown = false; // on drag outside
      }
    },
    onPointerMove(e) {
      state.lastScreenPoint.copy(getRelativePointer(e));

      if (state.down !== null && state.getDownDistancePx() > 5) {
        state.clearTweens(); // won't stop follow
      }
    },
    onPointerUp(e) {
      state.epoch.pointerUp = Date.now();
      if (state.down === null || state.lastDown === undefined) {
        return;
      }

      if (state.epoch.pickStart < state.epoch.pickEnd) {
        // object-pick has finished, so can send world event
        w.events.next(state.getWorldPointerEvent({
          key: "pointerup",
          event: e,
          meta: state.lastDown.meta ?? {},
          position: state.lastDown.position,
        }));
      }

      state.onPointerLeave(e);
      state.justLongDown = false;

      state.handleClickInDebugMode(e); // step world in debug mode
    },
    onTick(deltaMs) {
      const { camera } = w.r3f;

      if (state.dst.fov !== undefined) {// change fov
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
        if (damp(state, 'fov', state.dst.fov, 0.4, deltaMs, undefined, undefined, 1) === false) {
          delete state.dst.fov;
          state.syncRenderMode();
          state.resolve.fov?.();
        }
      }

      if (state.dst.look !== undefined && state.down === null) {// look or follow
        const { look: target, lookOpts } = state.dst;
        if (dampXZ(state.controls.target, target, lookOpts?.smoothTime, deltaMs, lookOpts?.maxSpeed, lookOpts?.y ?? 1.5, 0.01) === false) {
          state.resolve.look?.();
        }
        //@ts-ignore see patch i.e. fix azimuth angle
        state.controls.update(true);
      }

      if (state.dst.distance !== undefined) {// zoom
        const { minDistance, maxDistance, target } = state.controls;
        const targetDistance = Math.min(maxDistance, Math.max(minDistance, state.dst.distance));
        const targetCamPos = tmpVectThree.copy(camera.position).sub(target).setLength(targetDistance).add(target);
        if (damp3(camera.position, targetCamPos, 0.2, deltaMs, undefined, undefined, 0.01) === false) {
          delete state.dst.distance;
          state.resolve.distance?.();
        }
      }

      if (state.dst.azimuthal !== undefined) {// azimuthal angle
        if (Math.abs(state.controls.sphericalDelta.theta) < 0.01) {
          delete state.dst.azimuthal;
          state.resolve.azimuthal?.();
        }
      }

      if (state.dst.polar !== undefined) {// polar angle
        if (Math.abs(state.controls.sphericalDelta.phi) < 0.01) {
          delete state.dst.polar;
          state.resolve.polar?.();
        }
      }

    },
    openSnapshot(type = 'image/webp', quality) {
      window.open(dataUrlToBlobUrl(state.toDataURL(type, quality)), '_blank');
    },
    pickObject(e) {// https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js
      const { gl, camera } = w.r3f;
      // handle fractional device pixel ratio e.g. 2.625 on Pixel
      const glPixelRatio = gl.getPixelRatio();
      const targetRect = (/** @type {HTMLElement} */ (e.target)).getBoundingClientRect();

      // Set the projection matrix to only look at the pixel we are interested in.
      camera.setViewOffset(
        state.canvas.width,
        state.canvas.height,
        (e.clientX - targetRect.left) * glPixelRatio,
        (e.clientY - targetRect.top) * glPixelRatio,
        1,
        1,
      );

      gl.setRenderTarget(pickingRenderTarget);
      gl.clear();
      gl.render(emptySceneForPicking, camera);

      state.epoch.pickStart = Date.now();
      e.persist();
      gl.readRenderTargetPixelsAsync(pickingRenderTarget, 0, 0, 1, 1, pixelBuffer)
        .then(state.onObjectPickPixel.bind(null, e))
        .finally(() => state.epoch.pickEnd = Date.now())
      ;

      gl.setRenderTarget(null);
      camera.clearViewOffset();
    },
    renderObjectPickItem(gl, scene, camera, x) {
      x.material.uniforms.objectPick.value = true;
      x.material.uniformsNeedUpdate = true;
      gl.renderBufferDirect(camera, scene, /** @type {THREE.BufferGeometry} */ (x.geometry), x.material, x.object, null);
      // We immediately turn objectPick off e.g. overriding manual prop in Memoed <Npc>
      x.material.uniforms.objectPick.value = false;
      x.material.uniformsNeedUpdate = true;
    },
    renderObjectPickScene() {// 🚧 more efficient approach to render list
      const { gl, scene, camera } = w.r3f;
      // https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js
      // This is the magic, these render lists are still filled with valid data.  So we can
      // submit them again for picking and save lots of work!
      const renderList = gl.renderLists.get(scene, 0);

      renderList.opaque.forEach(x => {
        if (hasObjectPickShaderMaterial(x) === true) {
          state.renderObjectPickItem(gl, scene, camera, x);
        }
      });
      renderList.transparent.forEach(x => {
        // 🔔 ignore walls, ceilings, doors
        if (w.wall.opacity < 1 && x.object.name in fromXrayInstancedMeshName) {
          return;
        }
        if (hasObjectPickShaderMaterial(x) === true) {
          state.renderObjectPickItem(gl, scene, camera, x);
        }
      });
    },
    stopFollowing() {
      if (state.dst.look !== undefined && state.resolve.look === undefined) {
        delete state.dst.look;
        state.controls.zoomToConstant = null;
        return true;
      } else {
        return false;
      }
    },
    syncRenderMode() {
      const tweening = Object.keys(state.dst).length > 0;
      const frameloop = w.disabled === true && tweening === false ? 'demand' : 'always';
      w.r3f?.set({ frameloop });
      return frameloop;
    },
    toDataURL(type, quality) {
      w.r3f.advance(Date.now());
      return state.canvas.toDataURL(type, quality);
    },
    toggleFollowPosition(dst, opts = { smoothTime: 0.8, y: 1.5 }) {
      if (state.stopFollowing()) {
        return;
      }

      // lock zoom
      state.controls.zoomToConstant = dst;

      /**
       * - following amounts to "look tween without resolve/reject"
       * - 🔔 stop look via @see {state.stopFollowing} or @see {state.toggleFollowPosition}
       */
      state.dst.look = dst;
      state.dst.lookOpts = opts;
      state.resolve.look = undefined;
      state.reject.look = undefined;
    },
    async tween(opts) {
      const promises = /** @type {Promise<void>[]} */ ([]);

      /** @param {Exclude<keyof State['dst'], 'lookOpts'>} key */
      function createPromise(key) {
        return (new Promise((resolve, reject) =>
          [state.resolve[key] = resolve, state.reject[key] = reject]
        ).catch(() => delete state.dst[key])); // stop on reject
      }

      if (typeof opts.fov === 'number') {
        state.dst.fov = opts.fov;
        promises.push(createPromise('fov'));
      }

      if (typeof opts.distance === 'number') {
        state.dst.distance = opts.distance;
        promises.push(createPromise('distance'));
      }

      if (opts.look !== undefined) {

        state.dst.look = opts.look;
        state.dst.lookOpts = opts.lookOpts;
        promises.push(createPromise('look'));

      } else {// we don't support rotations if looking
        
        if (typeof opts.azimuthal === 'number') {
          const { minAzimuthAngle, maxAzimuthAngle } = state.controls;
          state.dst.azimuthal = Math.min(maxAzimuthAngle, Math.max(minAzimuthAngle, opts.azimuthal));
          state.controls.setAzimuthalAngle(state.dst.azimuthal);
          promises.push(createPromise('azimuthal'));
        }
        if (typeof opts.polar === 'number') {
          const { minPolarAngle, maxPolarAngle } = state.controls;
          state.dst.polar = Math.min(maxPolarAngle, Math.max(minPolarAngle, opts.polar));
          state.controls.setPolarAngle(state.dst.polar);
          promises.push(createPromise('polar'));
        }

      }

      if (w.disabled === true) {// can tween while paused
        state.syncRenderMode();
        w.timer.reset();
        w.onDebugTick();
      }

      await Promise.all(promises);
    },
  }), { reset: { controlsOpts: false } });

  w.view = state;

  React.useEffect(() => {
    if (state.controls && !w.crowd) {// 🔔 initially only
      state.controls.setPolarAngle(Math.PI / 6);
      state.controls.setAzimuthalAngle(Math.PI / 4);
    }
    emptySceneForPicking.onAfterRender = state.renderObjectPickScene;
  }, [state.controls]);

  return (
    <Canvas
      ref={state.canvasRef}
      css={rootCss}
      frameloop={state.syncRenderMode()}
      resize={{ debounce: 0 }}
      gl={state.glOpts}
      onCreated={state.onCreated}
      onPointerDown={w.r3f ? state.onPointerDown : undefined}
      onPointerMove={state.onPointerMove}
      onPointerUp={state.onPointerUp}
      onPointerLeave={state.onPointerLeave}
      onContextMenu={e => isTouchDevice() && e.preventDefault()}
      tabIndex={0}
      {...{ [popUpRootDataAttribute]: true }}
    >
      {props.children}

      {props.stats && state.rootEl &&
        <Stats showPanel={0} css={statsCss} parent={{ current: state.rootEl }} />
      }

      <PerspectiveCamera
        position={state.camInitPos}
        makeDefault
        fov={state.fov}
        zoom={1}
      />

      <MapControls
        ref={state.ref('controls')}
        makeDefault
        zoomToCursor
        onChange={state.onChangeControls}
        domElement={state.canvas}
        onStart={state.onControlsStart}
        onEnd={state.onControlsEnd}
        {...state.controlsOpts}
        //@ts-ignore see three-stdlib patch
        minPanDistance={w.smallViewport ? 0.05 : 0}
      />

      <ContextMenu/>

      <NpcSpeechBubbles/>
    </Canvas>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 * @property {React.ReactNode} [children]
 * @property {boolean} [stats]
 */

/**
 * @typedef State
 * @property {THREE.Vector3Tuple} camInitPos
 * @property {HTMLCanvasElement} canvas
 * @property {string[]} clickIds
 * - Pending click identifiers, provided by shell.
 * - The last click identifier is the "current one".
 * @property {(canvasEl: null | HTMLCanvasElement) => void} canvasRef
 * @property {() => void} clearTweens
 * @property {() => void} clearTargetDamping
 * @property {(mesh: THREE.Mesh, intersection: THREE.Intersection) => THREE.Vector3} computeNormal
 * @property {import('three-stdlib').MapControls & {
 *   sphericalDelta: THREE.Spherical;
 *   zoomToConstant: null | THREE.Vector3;
 * }} controls
 * We provide access to `sphericalDelta` via patch.
 * @property {import('@react-three/drei').MapControlsProps} controlsOpts
 * @property {{ screenPoint: Geom.Vect; pointerIds: number[]; longTimeoutId: number; } | null} down
 * Non-null iff at least one pointer is down.
 * 
 * @property {{
 *   azimuthal?: number;
 *   distance?: number;
 *   fov?: number;
 *   polar?: number;
 *   look?: THREE.Vector3;
 *   lookOpts?: LookAtOpts;
 * }} dst
 *
 * @property {{ pickStart: number; pickEnd: number; pointerDown: number; pointerUp: number; }} epoch
 * Each uses Date.now() i.e. milliseconds since epoch
 * @property {number} fov
 * @property {import('@react-three/fiber').RenderProps<HTMLCanvasElement>['gl']} glOpts
 * @property {NPC.DownData} [lastDown]
 * Defined iff last pointer was down over the World.
 * @property {boolean} justLongDown
 * @property {Geom.Vect} lastScreenPoint Updated `onPointerMove` and `onPointerDown`.
 * @property {{ tri: THREE.Triangle; indices: THREE.Vector3; mat3: THREE.Matrix3 }} normal
 * @property {THREE.Raycaster} raycaster
 * @property {Record<'fov' | 'look' | 'distance' | 'azimuthal' | 'polar', undefined | ((value?: any) => void)>} resolve
 * - follow has `resolve.look` undefined i.e. never resolves
 * @property {Record<'fov' | 'look' | 'distance' | 'azimuthal' | 'polar', undefined | ((error?: any) => void)>} reject
 * @property {HTMLDivElement} rootEl
 * @property {'near' | 'far'} zoomState
 *
 * @property {(enabled?: boolean) => void} enableControls Default `true`
 * @property {() => number} getDownDistancePx
 * @property {() => number} getNumPointers
 * @property {(e: React.PointerEvent, pixel: THREE.TypedArray) => void} onObjectPickPixel
 * @property {(def: WorldPointerEventDef) => NPC.PointerUpEvent | NPC.PointerDownEvent | NPC.LongPointerDownEvent} getWorldPointerEvent
 * @property {(e: React.PointerEvent) => void} handleClickInDebugMode
 * @property {(e: NPC.PointerUpEvent | NPC.LongPointerDownEvent) => boolean} isPointerEventDrag
 * @property {(input: Geom.VectJson | THREE.Vector3Like, opts?: LookAtOpts) => Promise<void>} lookAt
 * @property {() => boolean} stopFollowing
 * @property {() => import("@react-three/fiber").RootState['frameloop']} syncRenderMode
 * @property {(e?: THREE.Event) => void} onChangeControls
 * @property {import('@react-three/fiber').CanvasProps['onCreated']} onCreated
 * @property {() => void} onControlsEnd
 * @property {() => void} onControlsStart
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerDown
 * @property {(e: React.PointerEvent) => void} onPointerLeave
 * @property {(e: React.PointerEvent) => void} onPointerMove
 * @property {(e: React.PointerEvent<HTMLElement>) => void} onPointerUp
 * @property {(deltaMs: number) => void} onTick
 * @property {(type?: string, quality?: any) => void} openSnapshot
 * @property {(e: React.PointerEvent<HTMLElement>) => void} pickObject
 * @property {(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, ri: THREE.RenderItem & { material: THREE.ShaderMaterial }) => void} renderObjectPickItem
 * @property {() => void} renderObjectPickScene
 * @property {(dst: THREE.Vector3, opts?: LookAtOpts) => void} toggleFollowPosition
 * @property {HTMLCanvasElement['toDataURL']} toDataURL
 * Canvas only e.g. no ContextMenu
 * @property {(opts: {
 *   fov?: number;
 *   distance?: number;
 *   look?: THREE.Vector3;
 *   azimuthal?: number;
 *   polar?: number;
 *   lookOpts?: LookAtOpts;
 * }) => Promise<void>} tween
 */

const rootCss = css`
  user-select: none;
  canvas[data-engine] {
    width: 100%;
    height: 100%;
    background-color: rgba(20, 20, 20, 1);
  }
`;

const statsCss = css`
  position: absolute !important;
  z-index: ${zIndexWorld.stats} !important;
  left: unset !important;
  right: 0px;
`;

/**
 * @typedef WorldPointerEventDef
 * @property {'pointerup' | 'pointerdown' | 'long-pointerdown'} key
 * @property {number} [distancePx]
 * @property {React.PointerEvent | React.MouseEvent} event
 * @property {boolean} [justLongDown]
 * @property {Meta} meta
 * @property {THREE.Vector3Like} position
*/

/**
 * @typedef LookAtOpts
 * @property {number} [maxSpeed]
 * @property {number} [smoothTime]
 * @property {number} [y]
*/

const pixelBuffer = new Uint8Array(4);
const tmpVectThree = new THREE.Vector3();
