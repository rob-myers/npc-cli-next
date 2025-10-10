import React from 'react';
import cx from 'classnames';
import { css } from "@emotion/react";
import { getRelativePointer } from '../service/dom';
import useStateRef from '../hooks/use-state-ref';
import { zIndexWorld } from '../service/const';
import { WorldContext } from './world-context';

export default function TouchIndicator() {

  const w = React.useContext(WorldContext);

  const state = useStateRef( () => ({
    touchCircle: /** @type {HTMLDivElement} */ ({}),
    touchErrorPx: w.smallViewport ? 15 : 5,
  }));

  React.useEffect(() => {

    /** @param {PointerEvent} e */
    function onPointerDown (e) {
      state.touchCircle.style.left = `${(e.clientX - touchRadiusPx)}px`;
      state.touchCircle.style.top = `${(e.clientY - touchRadiusPx)}px`;
      state.touchCircle.classList.add('active');
    }
    /** @param {PointerEvent} e */
    function onPointerUp (e) {
      state.touchCircle.classList.remove('active');
    }
    /** @param {PointerEvent} e */
    function onPointerMove(e) {
      if (w.view.down === null) {
        return;
      }
      if (w.view.down.screenPoint.distanceTo(getRelativePointer(e)) > state.touchErrorPx) {
        state.touchCircle.classList.remove('active');
      }
    }

    const el = w.view.canvas;

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerout', onPointerUp);
    el.addEventListener('pointermove', onPointerMove);
    
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerout', onPointerUp);
      el.removeEventListener('pointermove', onPointerMove);
    };

  }, []);

  return (
    <div
      css={touchIndicatorCss}
      className={cx(w.menu.dark && 'dark')}
      ref={state.ref('touchCircle')}
    >
      <div className="inner-circle" />
    </div>
  );
}

const touchRadiusPx = 12;
const touchFadeSecs = 1;

const touchIndicatorCss = css`
  position: fixed;
  z-index: ${zIndexWorld.touchCircle};
  width: calc(2 * ${touchRadiusPx}px);
  height: calc(2 * ${touchRadiusPx}px);
  pointer-events:none;

  opacity: 0;
  transform: scale(0);
  transition: opacity ${touchFadeSecs}s, transform ease-out ${touchFadeSecs}s;
  
  &.active {
    transform: scale(1);
    opacity: 0.25;
    transition: opacity 0.3s 0.2s, transform 0.3s 0.2s;
  }
  
  background-color: #fff;
  border: 4px solid #000;
  border-radius: 50%;
  &.dark {
    border-color: white;
  }

`;
