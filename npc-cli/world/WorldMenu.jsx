import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { createPortal } from "react-dom";

import { tryLocalStorageGetParsed, tryLocalStorageSet, warn } from "../service/generic";
import { zIndexTabs, zIndexWorld } from "../service/const";
import { isSmallViewport, isTouchDevice } from "../service/dom";
import { ansi } from "../sh/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Draggable } from "../components/Draggable";
import { PopUp, popUpBubbleClassName, popUpButtonClassName, popUpContentClassName } from "../components/PopUp";
import { globalLoggerLinksRegex, Logger } from "../terminal/Logger";
import TouchIndicator from "./TouchIndicator";
import { CentredSpinner } from "../components/Spinner";

/**
 * @param {Pick<import('./World').Props, 'setTabsEnabled'>} props 
 */
export default function WorldMenu(props) {

  const w = React.useContext(WorldContext);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({

    brightness: 13, // [1..20] inducing percentage `100 + 10 * (b - 10)`
    disconnected: true,
    draggable: /** @type {*} */ (null),
    dragClassName: w.smallViewport ? popUpButtonClassName : undefined,
    durationKeys: {},
    invertColor: false,
    logger: /** @type {*} */ (null),
    loggerHeight: tryLocalStorageGetParsed(`logger:height@${w.key}`) ?? defaultLoggerHeightPx / loggerHeightDelta,
    loggerWidth: tryLocalStorageGetParsed(`logger:width@${w.key}`) ?? defaultLoggerWidthPx / defaultLoggerWidthDelta,
    loggerWidthDelta: defaultLoggerWidthDelta,
    preventDraggable: false,
    showDebug: tryLocalStorageGetParsed(`logger:debug@${w.key}`) ?? false,
    xRayOpacity: 8, // [1..20]

    applyControlsInitValues() {
      /** @param {any} value */
      const toEvent = (value) => /** @type {React.ChangeEvent<HTMLInputElement>} */ ({ currentTarget: { value, checked: value } });
      state.onChangeBrightness(toEvent(state.brightness))
      state.onChangeXRay(toEvent(state.xRayOpacity));
      state.onChangeCanTweenPaused(toEvent(w.view.canTweenPaused));
      state.onChangeInvertColor(toEvent(state.invertColor));
      state.onResizeLoggerHeight(toEvent(state.loggerHeight));
      state.onResizeLoggerWidth(toEvent(state.loggerWidth));
    },
    measure(msg) {
      if (state.showDebug === false) {
        return;
      } else if (msg in state.durationKeys) {
        const durationMs = (performance.now() - state.durationKeys[msg]).toFixed(1);
        state.logger?.xterm.writeln(`${msg} ${ansi.BrightYellow}${durationMs}${ansi.Reset}`);
        delete state.durationKeys[msg];
      } else {
        state.durationKeys[msg] = performance.now();
      }
    },
    onChangeBrightness(e) {
      state.brightness = Number(e.currentTarget.value);
      w.view.setCssFilter({ brightness: `${100 + 10 * (state.brightness - 10)}%` });
    },
    onChangeLoggerLog(e) {
      state.showDebug = e.currentTarget.checked;
      tryLocalStorageSet(`logger:debug@${w.key}`, `${state.showDebug}`);
      update();
    },
    onChangeCanTweenPaused(e) {
      w.view.canTweenPaused = e.currentTarget.checked;
      w.update();
    },
    onChangeInvertColor(e) {
      state.invertColor = e.currentTarget.checked;
      w.view.setCssFilter({ invert: state.invertColor ? '1' : '0' });
      w.updateTexAux({
        0: state.invertColor ? [1, 1, 1, 1] : [0, 0, 0, 0], // invert ~ 0th key
      });
      w.update();
    },
    onChangeXRay(e) {
      state.xRayOpacity = Number(e.currentTarget.value);
      w.wall.setOpacity(state.xRayOpacity / 20);
      // w.ceil.setOpacity(state.xRayOpacity / 20)
      w.update();
    },
    onClickLoggerLink(e) {
      const [npcKey] = e.fullLine.slice('['.length).split('] ', 1);
      if (npcKey in w.n) {// prefix `[{npcKey}] ` 
        w.events.next({ key: 'logger-link', npcKey, ...e });
      }
    },
    onConnect(connectorKey) {
      state.disconnected === true && setTimeout(update);
      state.disconnected = false;
      state.logger.xterm.writeln(`[${ansi.Blue}${connectorKey}${ansi.Reset}] connected`);
    },
    onOverlayPointerUp() {
      props.setTabsEnabled(true);
    },
    onResizeLoggerHeight(e) {
      state.loggerHeight = Number(e.currentTarget.value); // e.g. 2, ..., 10
      state.logger.container.style.height = `${state.loggerHeight * loggerHeightDelta}px`;
      tryLocalStorageSet(`logger:height@${w.key}`, `${state.loggerHeight}`);
      state.draggable.updatePos();
    },
    onResizeLoggerWidth(e) {
      if (e !== undefined) {
        state.loggerWidth = Number(e.currentTarget.value);
      }
      state.logger.container.style.width = `${state.loggerWidth * state.loggerWidthDelta}px`;
      tryLocalStorageSet(`logger:width@${w.key}`, `${state.loggerWidth}`);
      state.draggable.updatePos();
    },
    say(npcKey, ...parts) {
      const line = parts.join(' ');
      state.logger.xterm.writeln(
        `${ansi.BrightGreen}[${ansi.BrightYellow}${ansi.Bold}${npcKey}${ansi.BrightGreen}${ansi.BoldReset}]${ansi.Reset} ${
          line.replace(globalLoggerLinksRegex, `${ansi.DarkGreen}[${ansi.Blue}$1${ansi.Reset}${ansi.DarkGreen}]${ansi.Reset}`)
        }${ansi.Reset}`
      );
      state.logger.xterm.scrollToBottom();
    },
    setPreventDraggable(shouldPrevent) {
      state.preventDraggable = !!shouldPrevent;
      update();
    },
    toggleXRay() {
      state.xRayOpacity = state.xRayOpacity < 20 ? 20 : 10;
      w.wall.setOpacity(state.xRayOpacity / 20);
      // w.ceil.setOpacity(state.xRayOpacity / 10);

      /** @type {HTMLInputElement} */ (// reflect in range
        state.draggable.el.querySelector('input.change-x-ray')
      ).value = `${state.xRayOpacity}`;
      
      w.update();
    },
  }));

  w.menu = state;

  React.useLayoutEffect(() => {
    const obs = new ResizeObserver(([_entry]) => {
      state.loggerWidthDelta = Math.floor(w.view.rootEl.clientWidth / 10);
      state.logger?.container && state.onResizeLoggerWidth();
    });
    obs.observe(w.view.rootEl);
    return () => obs.disconnect();
  }, []);
  
  React.useEffect(() => {
    w.crowd && state.applyControlsInitValues();
  }, [w.crowd]);

  return <>

    {w.disabled && <div css={pausedControlsCss}>
      <button
        onClick={state.toggleXRay}
        className={state.xRayOpacity < 20 ? 'text-green' : undefined}
      >
        x-ray
      </button>
    </div>}

    {w.view.rootEl !== null && createPortal(
      <Draggable
        css={loggerAndPopUpCss}
        className={cx({ preventDraggable: state.preventDraggable })}
        ref={state.ref('draggable')}
        container={w.view.rootEl}
        dragClassName={state.dragClassName}
        initPos={{ x: 0, y: 0 }}
        localStorageKey={`logger:drag-pos@${w.key}`}
      >
        <PopUp
          label="⋯"
          css={popUpCss}
          width={350}
        >
          <div className="ranges">
            <label>
              <input
                type="range"
                className="change-logger-width"
                min={4}
                max={10}
                defaultValue={state.loggerWidth}
                onChange={state.onResizeLoggerWidth}
              />
              <div>w</div>
            </label>
            <label>
              <input
                type="range"
                className="change-logger-height"
                min={2}
                max={10}
                defaultValue={state.loggerHeight}
                onChange={state.onResizeLoggerHeight}
              />
              <div>h</div>
            </label>
          </div>
          <div className="ranges">
            <label>
              <input
                type="range"
                className="change-x-ray"
                min={1}
                max={20}
                defaultValue={state.xRayOpacity}
                onChange={state.onChangeXRay}
              />
              <div>🫥</div>
            </label>
            <label>
              <input
                type="range"
                className="change-brightness"
                min={1}
                max={20}
                defaultValue={state.brightness}
                onChange={state.onChangeBrightness}
              />
              <div>☀️</div>
            </label>
          </div>
          <div className="checkboxes">
            <label>
              debug
              <input
                type="checkbox"
                defaultChecked={state.showDebug}
                onChange={state.onChangeLoggerLog}
              />
            </label>
            <label>
              paused-tweens
              <input
                type="checkbox"
                onChange={state.onChangeCanTweenPaused}
                checked={w.view.canTweenPaused}
              />
            </label>
            <label>
              invert
              <input
                type="checkbox"
                onChange={state.onChangeInvertColor}
                checked={state.invertColor}
              />
            </label>
          </div>
        </PopUp>

        <Logger
          ref={state.ref('logger')}
          onClickLink={state.onClickLoggerLink}
          initDim={[
            state.loggerWidth * state.loggerWidthDelta,
            state.loggerHeight * loggerHeightDelta,
          ]}
        />
      </Draggable>,
      w.view.rootEl,
    )}

    <TouchIndicator/>

    {w.crowd === null && <CentredSpinner size={32} style={{ position: 'absolute', top: 0 }} />}

    <div
      css={cssTtyDisconnectedMessage}
      className={cx({ hidden: state.disconnected === false })}
    >
      <h3>[disconnected]</h3>
      click or show a tty tab
    </div>

  </>;
}

const defaultLoggerHeightPx = isSmallViewport() ? 40 : 100;
const defaultLoggerWidthPx = 800;
/** Must be a factor of default height */
const loggerHeightDelta = 20;
const defaultLoggerWidthDelta = 80;

const loggerAndPopUpCss = css`
  position: absolute;
  left: 0;
  top: 0;
  max-width: 100%;
  z-index: ${zIndexWorld.logger};
  
  > div:nth-of-type(2) {
    /* height: ${defaultLoggerHeightPx}px; */
    /* width: ${defaultLoggerWidthPx}px; */
    width: 0px;
    max-width: 100%;
    padding: 8px 0 0 12px;
  }
  
  display: flex;
  flex-direction: column;
  align-items: start;

  // avoid blocking World above Logger and right of PopUp
  pointer-events: none !important;
  
  &.preventDraggable > * {
    pointer-events: none !important;
  }
`;

const popUpCss = css`
  pointer-events: all;
  // cover Logger scrollbars
  z-index: ${zIndexWorld.loggerPopUp};
  
  .${popUpButtonClassName} {
    color: #8888ff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-width: 1px 0 0 1px;
    background: black;
    padding: 2px 12px;
    text-decoration: underline;
    padding: 0 20px 8px 20px;
  }
  
  @media(min-width: 700px) {
    .${popUpButtonClassName} {
      padding: 0 8px 8px 8px;
    }
    /* .${popUpBubbleClassName} {
      transform: scale(.9);
    } */
  }

  @media(max-width: 700px) {
    .${popUpBubbleClassName} .${popUpContentClassName} {
      flex-direction: column;
      padding: 12px 0;
      .ranges {
        padding: 0;
      }
      .ranges input {
        width: 100%;
      }
    }
  }

  .${popUpContentClassName} {
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    gap: 8px;

    font-size: small;
    color: white;
    
    .ranges {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 0;

      label div {
        display: flex;
        justify-content: center;
        /* background-color: red; */
        width: 16px;
      }
      input {
        width: 60px;
      }
    }

    .checkboxes {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Courier New', Courier, monospace;
    }

    /** https://www.smashingmagazine.com/2021/12/create-custom-range-input-consistent-browsers/ */
    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    input[type="range"]::-webkit-slider-runnable-track {
      background: #053a5f;
      height: 0.5rem;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; /* Override default look */
      appearance: none;
      background-color: #5cd5eb;
      height: 8px;
      width: 8px;
    }
    input[type="range"]::-moz-range-track {
      background: #053a5f;
      height: 0.5rem;
    }
    input[type="range"]::-moz-range-thumb {
      border: none; /*Removes extra border that FF applies*/
      border-radius: 0; /*Removes default border-radius that FF applies*/
      background-color: #5cd5eb;
      height: 8px;
      width: 8px;
    }
  }
`;

const cssTtyDisconnectedMessage = css`
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: ${zIndexWorld.disconnectedMessage};
  
  user-select: none;
  pointer-events: none;
  padding: 16px;
  margin: 0 16px 16px 0;
  @media (max-width: 700px) {
    margin: 0;
  }

  background-color: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 0.9rem;
  
  color: #aaa;

  h3 {
    font-family: 'Courier New', Courier, monospace;
    color: #8f8;
  }

  transition: opacity 600ms;
  opacity: 100;
  &.hidden {
    opacity: 0;
    /** override commons.css */
    display: initial;
  }
`;

const pausedControlsCss = css`
  position: absolute;
  right: 0;
  top: 64px;
  z-index: ${zIndexTabs.pausedControls};
  display: flex;
  flex-direction: column;
  gap: 12px;

  button {
    color: #aaa;
    padding: 12px;
    background-color: #000;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    border-width: 1px 0 1px 1px;
    border-color: #555;
    font-size: 0.8rem;
    user-select: none;

    width: 80px;
    opacity: 0.75;

    &.text-white {
      color: #fff;
    }
    &.text-green {
      color: #0f0;
    }
  }

  transition: filter 1s;
  &:hover {
    filter: brightness(2) ;
  }
`;

/**
 * @typedef State
 * @property {number} brightness
 * @property {import('../components/Draggable').State} draggable Draggable containing Logger
 * @property {string} [dragClassName] We can restrict Logger dragging to this className
 * @property {boolean} disconnected
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {boolean} invertColor
 * @property {import('../terminal/Logger').State} logger
 * @property {number} loggerHeight
 * @property {number} loggerWidth
 * @property {number} loggerWidthDelta
 * @property {boolean} preventDraggable
 * @property {boolean} showDebug
 * @property {number} xRayOpacity In [1..20]
 *
 * @property {() => void} applyControlsInitValues
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeBrightness
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeCanTweenPaused
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeInvertColor
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeLoggerLog
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeXRay
 * @property {(e: NPC.LoggerLinkEvent) => void} onClickLoggerLink
 * @property {(connectorKey: string) => void} onConnect
 * @property {() => void} onOverlayPointerUp
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onResizeLoggerHeight
 * @property {(e?: React.ChangeEvent<HTMLInputElement>) => void} onResizeLoggerWidth
 * @property {(npcKey: string, line: string) => void} say
 * @property {(shouldPrevent: boolean) => void} setPreventDraggable
 * @property {() => void} toggleXRay
 */
