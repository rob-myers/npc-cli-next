import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { createPortal } from "react-dom";
import debounce from "debounce";

import { debug, tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { html3DOpacityCssVar, worldViewBgColorCssVar, zIndexTabs, zIndexWorld } from "../service/const";
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

    bgScale: 16, // [1..20]
    brightness: tryLocalStorageGetParsed(`brightness@${w.key}`) ?? 10,
    defaultLoggerWidth: w.smallViewport ? 300 : 500,
    draggable: /** @type {*} */ (null),
    dragClassName: w.smallViewport ? popUpButtonClassName : undefined,
    durationKeys: {},
    invertColor: false,
    logger: /** @type {*} */ (null),
    preventDraggable: false,
    showDebug: tryLocalStorageGetParsed(`logger:debug@${w.key}`) ?? false,
    showEffects: false,

    applyControlsInitValues() {
      /** @param {any} value */
      const toEvent = (value) => /** @type {React.ChangeEvent<HTMLInputElement>} */ ({ currentTarget: { value, checked: value } });
      state.onChangeBrightness(toEvent(state.brightness))
      state.onChangeBgScale(toEvent(state.bgScale));
      state.onChangeCanTweenPaused(toEvent(w.view.canTweenPaused));
      state.onChangeInvertColor(toEvent(state.invertColor));
    },
    measure(msg) {
      if (state.showDebug === false) {
        return;
      } else if (msg in state.durationKeys) {
        const durationMs = (performance.now() - state.durationKeys[msg]).toFixed(1);
        state.logger?.xterm.writeln(`${msg} ${ansi.BrightYellow}${durationMs}${ansi.Reset}`);
        debug(`measure: ${msg} (${durationMs}ms)`);
        delete state.durationKeys[msg];
      } else {
        state.durationKeys[msg] = performance.now();
        debug(`measure: ${msg} (${'started'})`);
      }
    },
    onChangeBrightness(e) {
      state.brightness = Number(e.currentTarget.value);
      w.view.setCssFilter({ brightness: `${100 + 10 * (state.brightness - 10)}%` });
      tryLocalStorageSet(`brightness@${w.key}`, `${state.brightness}`);
    },
    onChangeLoggerLog(e) {
      state.showDebug = e.currentTarget.checked;
      tryLocalStorageSet(`logger:debug@${w.key}`, `${state.showDebug}`);
      update();
    },
    onChangeCanTweenPaused(e) {
      w.view.canTweenPaused = e.currentTarget.checked;
      w.update();
      if (w.disabled === true && w.view.canTweenPaused === true)  {
        w.view.onPausedTick();
      }
    },
    onChangeInvertColor(e) {
      state.invertColor = e.currentTarget.checked;
      w.view.setCssFilter({ invert: state.invertColor ? '1' : '0' });
      w.updateTexAux({
        0: state.invertColor ? [1, 1, 1, 1] : [0, 0, 0, 0], // invert ~ 0th key
      });
      w.view.showEffects({ enabled: state.invertColor ? false : state.showEffects });
      w.update();
    },
    onChangeBgScale(e) {
      state.bgScale = Number(e.currentTarget.value); // [1..20]
      const scale = state.bgScale / 20;
      // 🚧 hard-coded
      w.view.rootEl.style.setProperty(worldViewBgColorCssVar, `rgb(${255 * scale}, ${255 * scale}, ${255 * scale})`);
    },
    onChangeShowEffects(e) {
      state.showEffects = e.currentTarget.checked;
      w.view.showEffects({ enabled: state.showEffects });
      w.update();
    },
    onClickLoggerLink(e) {
      const [npcKey] = e.fullLine.slice('['.length).split('] ', 1);
      if (npcKey in w.n) {// prefix `[{npcKey}] ` 
        w.events.next({ key: 'logger-link', npcKey, ...e });
      }
    },
    onConnect(connectorKey) {
      state.logger.xterm.writeln(`[${ansi.Blue}${connectorKey}${ansi.Reset}] connected`);
    },
    onOverlayPointerUp() {
      props.setTabsEnabled(true);
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
  }));

  w.menu = state;

  React.useEffect(() => {
    w.npc !== null && state.applyControlsInitValues();
  }, [w.npc]);

  React.useLayoutEffect(() => {
    const showHtml3dsAfter300ms = debounce(() => 
      w.view.rootEl.style.setProperty(html3DOpacityCssVar, '1')
    , 300);
    const obs = new ResizeObserver(([_entry]) => {
      w.view.rootEl.style.setProperty(html3DOpacityCssVar, '0');
      showHtml3dsAfter300ms();
    });
    obs.observe(w.view.rootEl);
    return () => obs.disconnect();
  }, []);


  return <>

    {w.view.rootEl !== null && createPortal(
      <Draggable
        css={loggerAndPopUpCss}
        className={cx({ preventDraggable: state.preventDraggable })}
        ref={state.ref('draggable')}
        container={w.view.rootEl}
        dragClassName={state.dragClassName}
        initPos={{ x: 0, y: 0 }}
        localStorageKey={`logger:drag-pos@${w.key}`}
        defaultWidth={state.defaultLoggerWidth}
        defaultHeight={100}
      >
        <PopUp
          label="⋯"
          css={popUpCss}
          width={300}
        >
          <div className="ranges">
            <label>
              <input
                type="range"
                className="scale-bg-color"
                min={1}
                max={20}
                defaultValue={state.bgScale}
                onChange={state.onChangeBgScale}
              />
              <div>
                ⏰
              </div>
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
            <label title="tween camera while paused?">
              tween
              <input
                type="checkbox"
                onChange={state.onChangeCanTweenPaused}
                checked={w.view.canTweenPaused}
                disabled={w.disabled === false}
              />
            </label>
            <label>
              inv
              <input
                type="checkbox"
                onChange={state.onChangeInvertColor}
                checked={state.invertColor}
              />
            </label>
            <label>
              fx
              <input
                type="checkbox"
                onChange={state.onChangeShowEffects}
                checked={state.showEffects}
              />
            </label>
          </div>
        </PopUp>

        <Logger
          ref={state.ref('logger')}
          onClickLink={state.onClickLoggerLink}
        />
      </Draggable>,
      w.view.rootEl,
    )}

    <TouchIndicator/>

    {w.crowd === null && <CentredSpinner size={32} style={{ position: 'absolute', top: 0 }} />}

  </>;
}

const defaultLoggerHeightPx = 40;
const defaultLoggerWidthPx = 200;
/** Must be a factor of default height */
const loggerHeightDelta = 20;
const defaultLoggerWidthDelta = 40;

const loggerAndPopUpCss = css`
  position: absolute;
  left: 0;
  top: 0;
  max-width: 100%;
  z-index: ${zIndexWorld.logger};
  
  > div:nth-of-type(2) {
    /* width: 0px;
    max-width: 100%; */
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
  
  position: absolute;
  right: 0;

  .${popUpButtonClassName} {
    color: #8888ff;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: #000a;
    padding: 2px 12px;
    text-decoration: underline;
    padding: 0 20px 8px 20px;
  }
  
  @media(min-width: 700px) {
    .${popUpButtonClassName} {
      padding: 0 8px 8px 8px;
    }
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
        width: 16px;
      }
      input {
        width: 60px;
      }
    }

    .checkboxes {
      width: 150px;
      
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      label {
        margin-right: 8px;
      }
    }

    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Courier New', Courier, monospace;

      &:has(> input:disabled) {
        color: #aaa;
      }
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
 * @property {number} bgScale In [1..20]. For background-color scaling.
 * @property {number} brightness [1..20] inducing percentage `100 + 10 * (b - 10)`
 * @property {number} defaultLoggerWidth
 * @property {import('../components/Draggable').State} draggable Draggable containing Logger
 * @property {string} [dragClassName] We can restrict Logger dragging to this className
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {boolean} invertColor
 * @property {import('../terminal/Logger').State} logger
 * @property {boolean} preventDraggable
 * @property {boolean} showDebug
 * @property {boolean} showEffects
 *
 * @property {() => void} applyControlsInitValues
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeBrightness
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeCanTweenPaused
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeInvertColor
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeLoggerLog
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeShowEffects
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeBgScale
 * @property {(e: NPC.LoggerLinkEvent) => void} onClickLoggerLink
 * @property {(connectorKey: string) => void} onConnect
 * @property {() => void} onOverlayPointerUp
 * @property {(npcKey: string, line: string) => void} say
 * @property {(shouldPrevent: boolean) => void} setPreventDraggable
 */
