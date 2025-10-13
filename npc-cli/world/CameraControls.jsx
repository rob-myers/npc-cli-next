import React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { shallow } from "zustand/shallow";
import { CameraControls as MapControlsImpl } from '../service/camera-controls'

/**
 * Based on:
 * > https://github.com/pmndrs/drei/blob/master/src/core/MapControls.tsx
 * @type {React.ForwardRefExoticComponent<
 *   React.PropsWithChildren<Props> & React.RefAttributes<MapControlsImpl>
 * >}
 */
export const CameraControls = React.forwardRef(function CameraControls(props, ref) {
  const r3f = useThree((s) => ({
    invalidate: s.invalidate,
    camera: /** @type {import('three').PerspectiveCamera} */ (s.camera),
    gl: s.gl,
    events: s.events,
    set: s.set,
    get: s.get,
  }), shallow);

  // support HMR 🚧 remember position etc.
  const controls = React.useMemo(
    () => new MapControlsImpl(r3f.camera, /** @type {*} */ ({})),
    [r3f.camera, MapControlsImpl],
  );
  const domEl = props.domElement ?? r3f.gl.domElement;
  
  React.useEffect(() => {
    controls.connect(domEl);
    const changeCallback = /** @param {import('three').Event} e */ (e) => {
      r3f.invalidate();
      props.onChange?.(e);
    };
    controls.addEventListener('change', changeCallback)
    if (props.onStart) controls.addEventListener('start', props.onStart);
    if (props.onEnd) controls.addEventListener('end', props.onEnd);

    return () => {
      controls.dispose();
      controls.removeEventListener('change', changeCallback);
      if (props.onStart) controls.removeEventListener('start', props.onStart);
      if (props.onEnd) controls.removeEventListener('end', props.onEnd);
    };
  }, [props.onChange, props.onStart, props.onEnd, domEl, controls, r3f.invalidate]);

  React.useEffect(() => {
    const old = r3f.get().controls;
    // @ts-ignore https://github.com/three-types/three-ts-types/pull/1398
    r3f.set({ controls: controls });
    return () => r3f.set({ controls: old })
  }, [controls])

  useFrame(() => controls.update(), -1);

  return (
    <primitive
      ref={ref}
      object={controls}
      enableDamping

      // 🚧 ...
      zoomToCursor
      minAzimuthAngle={0}
      maxAzimuthAngle={0}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 4}
      minDistance={props.minDistance} // target could be ground or npc head
      maxDistance={props.maxDistance}
      panSpeed={2}
      rotateSpeed={0.5}
      zoomSpeed={0.5}

    />
  );
});

/**
 * @typedef Props
 * @property {HTMLElement} domElement
 * @property {(e?: import('three').Event) => void} [onChange]
 * @property {() => void} [onEnd]
 * @property {() => void} [onStart]
 * @property {number} [minDistance]
 * @property {number} [minPanDistance]
 * @property {number} [maxDistance]
 */

/**
 * @typedef {MapControlsImpl & import('three').EventDispatcher<{
 *   start: import('three').Event;
 *   change: import('three').Event;
 *   end: import('three').Event;
 * }>} ControlsImpl
 */
