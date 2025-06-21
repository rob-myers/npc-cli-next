import React from "react";
import debounce from "debounce";
import { css } from "@emotion/react";
import cx from "classnames";

import { tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { getTouch, getTouchIdentifier } from "../service/dom";
import useStateRef from "../hooks/use-state-ref";

/**
 * @type {React.ForwardRefExoticComponent<
 *   React.PropsWithChildren<BaseProps> & React.RefAttributes<State>
 * >}
 */
export const Draggable = React.forwardRef(function Draggable(props, ref) {

  const state = useStateRef(/** @returns {State} */ () => ({
    down: {
      clientX: 0,
      clientY: 0,
      translateX: 0,
      translateY: 0,
      width: 0,
      height: 0,
    },
    dragging: false,
    el: /** @type {*} */ (null),
    pos: tryLocalStorageGetParsed(props.localStorageKey ?? '') ?? {...props.initPos ?? { x: 0, y: 0 }},
    resizing: false,
    touchId: /** @type {undefined | number} */ (undefined),

    canDrag(e) {
      return props.disabled !== true && (
        props.dragClassName === undefined
        || /** @type {HTMLElement} */ (e.target).classList.contains(props.dragClassName)
      );
    },
    onMouseDown(e) {
      e.stopPropagation();

      if (e.target.matches('[data-draggable-corner]')) {
        state.resizing = true;
      } else if (!state.canDrag(e)) {
        return;
      } else {
        state.dragging = true;
      }

      state.setRel(e.clientX, e.clientY);
    },
    onMouseUp(e) {
      state.dragging = false;
      state.resizing = false;
    },
    onMouseMove(e) {
      if (state.dragging === false && state.resizing === false) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();

      // Subtract rel to keep the cursor "in same position"
      if (state.dragging === true) {
        state.updatePos(
          state.down.translateX + (e.clientX - state.down.clientX),
          state.down.translateY + (e.clientY - state.down.clientY),
        );
      } else {
        state.updateSize(
          e.clientX - state.down.clientX,
          e.clientY - state.down.clientY,
        );
      }
    },
    onTouchStart(e) {
      e.stopPropagation();

      state.touchId = getTouchIdentifier(e);
      const touchObj = typeof state.touchId  === 'number' && getTouch(e, state.touchId) || null;
      if (touchObj === null) {
        return; // not the right touch
      }

      if (e.target.matches('[data-draggable-corner]')) {
        state.resizing = true;
      } else if (!state.canDrag(e)) {
        return;
      } else {
        state.dragging = true;
      }

      state.setRel(touchObj.clientX, touchObj.clientY);
    },
    onTouchEnd(e) {
      state.dragging = false;
      state.resizing = false;
      state.touchId = undefined;
    },
    onTouchMove(e) {
      if (state.dragging === false && state.resizing === false) {
        return;
      }
      e.stopPropagation();
      
      const touchObj = /** @type {{clientX: number, clientY: number}} */ (getTouch(e, /** @type {number} */ (state.touchId)));
      
      // Subtract rel to keep the cursor "in same position"
      if (state.dragging === true) {
        state.updatePos(
          state.down.translateX + (touchObj.clientX - state.down.clientX),
          state.down.translateY + (touchObj.clientY - state.down.clientY),
        );
      } else {
        state.updateSize(
          touchObj.clientX - state.down.clientX,
          touchObj.clientY - state.down.clientY,
        );
      }
    },
    persist: debounce(() => {
      if (props.localStorageKey !== undefined)
        tryLocalStorageSet(props.localStorageKey, JSON.stringify(state.pos))
    }, 300),
    setRel(clientX, clientY) {
      const { x, y, width, height } = state.el.getBoundingClientRect();
      const container = props.container.getBoundingClientRect();
      state.down.clientX = clientX;
      state.down.clientY = clientY;
      state.down.translateX = x - container.x;
      state.down.translateY = y - container.y;
      state.down.width = width;
      state.down.height = height;
    },
    updatePos(x = state.pos.x, y = state.pos.y) {
      if (props.disabled === true) return; // ensure within bounds:
      state.pos.x = Math.max(0, Math.min(props.container.clientWidth - state.el.offsetWidth, x));
      state.pos.y = Math.max(0, Math.min(props.container.clientHeight - state.el.offsetHeight, y));
      state.el.style.transform = `translate(${state.pos.x}px, ${state.pos.y}px)`;
      state.persist();
    },
    updateSize(x, y) {
      state.el.style.width = `${Math.max(80, state.down.width + x)}px`;
      state.el.style.height = `${Math.max(80, state.down.height + y)}px`;
    },
  }), { deps: [props.container, props.disabled, props.dragClassName, props.localStorageKey] });

  React.useImperativeHandle(ref, () => state, []);
  
  React.useEffect(() => {
    const container = props.container ?? document.body;
    const { onMouseMove, onMouseUp } = state; // for HMR
    document.body.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    return () => {
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
    };
  }, [state.onMouseMove]);

  React.useLayoutEffect(() => {// adjust draggable onresize self or container
    const obs = new ResizeObserver(([entry]) => {
      // 1. do not adjust position when hide (width 0)
      // 2. setTimeout for initial resized viewport (?)
      entry.contentRect.width > 0 && setTimeout(() => state.el !== null && state.updatePos());
    });
    [state.el, props.container].forEach(el => el instanceof HTMLElement && obs.observe(el));
    return () => obs.disconnect();
  }, [state.el, props.container]);

  React.useLayoutEffect(() => {
    if (props.disabled !== true) {
      state.el.style.visibility = 'inherit';
    }
  }, [props.disabled]);

  return (
    <div
      ref={state.ref('el')}
      className={cx('draggable', props.className)}
      
      onMouseDown={state.onMouseDown}
      onMouseUp={state.onMouseUp}
      onTouchStart={state.onTouchStart}
      onTouchEnd={state.onTouchEnd}
      onTouchMove={state.onTouchMove}

      style={{
        transform: props.disabled ? undefined : `translate(${state.pos.x}px, ${state.pos.y}px)`,
        width: props.defaultWidth,
        height: props.defaultHeight,
      }}
    >
      {props.children}

      <div
        css={cornerCss}
        data-draggable-corner
      />
    </div>
  )
})

/**
 * @typedef BaseProps
 * @property {string} [className]
 * @property {HTMLElement} container
 * - So can keep draggable within container.
 * - Now required so we can compute analogy of `offset{Left,Top}`
 * @property {boolean} [disabled]
 * @property {string} [dragClassName]
 * If defined, can only drag element matching it
 * @property {Geom.VectJson} [initPos]
 * Initial position, usually overridden via localStorage
 * @property {string} [localStorageKey]
 * Where to store the position in local storage
 * @property {number} [defaultWidth]
 * @property {number} [defaultHeight]
 */

/**
 * @typedef {{
 *   dragging: boolean;
 *   el: HTMLDivElement;
 *   pos: Geom.VectJson;
 *   down: { clientX: number; clientY: number; translateX: number; translateY: number; width: number; height: number; };
 *   resizing: boolean;
 *   touchId: undefined | number;
 *   canDrag(e: React.MouseEvent | React.TouchEvent): boolean;
 *   onMouseDown(e: React.MouseEvent<HTMLDivElement> & { target: HTMLElement }): void;
 *   onMouseUp(e: React.MouseEvent | MouseEvent): void;
 *   onMouseMove(e: React.MouseEvent | MouseEvent): void;
 *   onTouchStart(e: React.TouchEvent<HTMLDivElement> & { target: HTMLElement }): void;
 *   onTouchEnd(e: React.TouchEvent): void;
 *   onTouchMove(e: React.TouchEvent): void;
 *   persist(): void;
 *   setRel(clientX: number, clientY: number): void;
 *   updatePos(x?: number, y?: number): void;
 *   updateSize(x: number, y: number): void;
 * }} State
 */

const cornerCss = css`
  position: absolute;
  z-index: 100;
  right: 0;
  bottom: 0;
  border-left: 20px solid transparent;
  border-bottom: 20px solid #444;
  cursor: pointer;
  pointer-events: all;
`;
