import React from "react";
import { useThree } from "@react-three/fiber";
import { shallow } from "zustand/shallow";
// 🚧 our own MapControls class
import { MapControls as MapControlsImpl } from 'three-stdlib'

import useStateRef from "../hooks/use-state-ref";

/**
 * Based on:
 * > https://github.com/pmndrs/drei/blob/master/src/core/MapControls.tsx
 * @type {React.ForwardRefExoticComponent<
 *   React.PropsWithChildren<Props> & React.RefAttributes<State>
 * >}
 */
export const CameraControls = React.forwardRef(function CameraControls(props, ref) {
  // const { domElement, onChange, onStart, onEnd } = props
  
  const r3f = useThree((s) => ({
    invalidate: s.invalidate,
    camera: s.camera,
    gl: s.gl,
    events: s.events,
    set: s.set,
    get: s.get,
  }), shallow);

  const state = useStateRef(/** @returns {State} */ () => ({
    controls: new MapControlsImpl(r3f.camera),
    // 🚧
  }), { deps: [r3f] });

  React.useImperativeHandle(ref, () => state, []);

  React.useEffect(() => {
    state.controls.connect(props.domElement);
    const changeCallback = /** @param {import('three').Event} e */ (e) => {
      r3f.invalidate();
      props.onChange?.(e);
    };
    state.controls.addEventListener('change', changeCallback)

    return () => {
      state.controls.dispose();
      state.controls.removeEventListener('change', changeCallback);
    };
  }, [props.onChange, props.onStart, props.onEnd, props.domElement, state.controls, r3f.invalidate]);

  return (
    <primitive
      ref={ref}
      object={state.controls}
      enableDamping
      // 🚧 ...
    />
  );
});

/**
 * @typedef Props
 * @property {HTMLElement} domElement
 * @property {(e?: import('three').Event) => void} [onChange]
 * @property {() => void} [onEnd]
 * @property {() => void} [onStart]
 */

/**
 * @typedef State
 * @property {MapControlsImpl & import('three').EventDispatcher<{ change: import('three').Event }>} controls
 */
