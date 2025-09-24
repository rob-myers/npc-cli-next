import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { createPortal } from "react-dom";
import debounce from "debounce";

import { debug, tryLocalStorageGetParsed, tryLocalStorageSet } from "../service/generic";
import { html3DOpacityCssVar, xRayOpacity, worldViewBgColorCssVar, zIndexTabs, zIndexWorld } from "../service/const";
import { ansi } from "../sh/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Draggable } from "../components/Draggable";
import { PopUp, popUpBubbleArrowColorCssVar, popUpBubbleClassName, popUpButtonClassName, popUpContentClassName } from "../components/PopUp";
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
    bgScale: 8, // [1..20]
    brightness: tryLocalStorageGetParsed(`brightness@${w.key}`) ?? 12,
    dark: true,
    defaultLoggerDim: { x: 0, y: 0, width: w.smallViewport ? 300 : 500, height: 100, minWidth: 200, minHeight: 80 },
    draggable: /** @type {*} */ (null),
    dragClassName: w.smallViewport ? popUpButtonClassName : undefined,
    durationKeys: {},
    logger: /** @type {*} */ (null),
    preventDraggable: false,
    showDebug: tryLocalStorageGetParsed(`logger:debug@${w.key}`) ?? false,
    xRayEnabled: true,

    applyControlsInitValues() {
      /** @param {any} value */
      const toEvent = (value) => /** @type {React.ChangeEvent<HTMLInputElement>} */ ({ currentTarget: { value, checked: value } });
      state.onChangeBrightness(toEvent(state.brightness))
      state.onChangeBgScale(toEvent(state.bgScale));
      state.onChangeCanTweenPaused(toEvent(w.view.canTweenPaused));
      state.onChangeDark(toEvent(state.dark));
    },
    log(...lines) {
      for (const line of lines) {
        state.logger.xterm.writeln(line);
      }
    },
    measure(msg) {
      if (state.showDebug === false) {
        return;
      } else if (msg in state.durationKeys) {
        const durationMs = (performance.now() - state.durationKeys[msg]).toFixed(1);
        state.logger?.xterm.writeln(`${msg} ${ansi.YellowBright}${durationMs}${ansi.Reset}`);
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
    async onChangeDark(e) {
      state.dark = e.currentTarget.checked;
      w.npc.dark = state.dark;
      w.npc.forceUpdate();
      await Promise.all([// redraw
        w.floor.setDark(state.dark),
        w.ceil.setDark(state.dark),
      ]);
      w.update()
    },
    onChangeBgScale(e) {
      state.bgScale = Number(e.currentTarget.value); // [1..20]
      const scale = state.bgScale / 20;
      w.view.rootEl.style.setProperty(worldViewBgColorCssVar, `rgb(${255 * scale}, ${255 * scale}, ${255 * scale})`);
    },
    onChangeXRayEnabled(e) {
      state.xRayEnabled = e.currentTarget.checked;
      w.wall.setOpacity(state.xRayEnabled === true ? xRayOpacity.walls : 1);
      w.ceil.setOpacity(state.xRayEnabled === true ? xRayOpacity.ceiling : 1)
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
    say(name, ...parts) {
      const line = parts.join(' ');
      state.logger.xterm.writeln(
        `${ansi.GreenBright}[${ansi.YellowBright}${ansi.Bold}${name}${ansi.GreenBright}${ansi.BoldReset}]${ansi.Reset} ${
          line.replace(globalLoggerLinksRegex, `${ansi.GreenDark}[${ansi.Blue}$1${ansi.Reset}${ansi.GreenDark}]${ansi.Reset}`)
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
        dim={state.defaultLoggerDim}
        localStorageKey={`logger:drag-pos@${w.key}`}
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
            <label title="show debug messages">
              debug
              <input
                type="checkbox"
                defaultChecked={state.showDebug}
                onChange={state.onChangeLoggerLog}
              />
            </label>
            <label title="tween camera while paused">
              tween
              <input
                type="checkbox"
                onChange={state.onChangeCanTweenPaused}
                checked={w.view.canTweenPaused}
                disabled={w.disabled === false}
              />
            </label>
            <label>
              dark
              <input
                type="checkbox"
                onChange={state.onChangeDark}
                checked={state.dark}
              />
            </label>
            <label title="transparent walls & ceiling">
              xray
              <input
                type="checkbox"
                onChange={state.onChangeXRayEnabled}
                checked={state.xRayEnabled}
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
  
  ${popUpBubbleArrowColorCssVar}: #338;

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
      //font-family: 'Courier New', Courier, monospace;

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
 * @property {import('../components/Draggable').Props['dim']} defaultLoggerDim
 * @property {import('../components/Draggable').State} draggable Draggable containing Logger
 * @property {string} [dragClassName] We can restrict Logger dragging to this className
 * @property {{ [durKey: string]: number }} durationKeys
 * @property {boolean} dark
 * @property {import('../terminal/Logger').State} logger
 * @property {boolean} preventDraggable
 * @property {boolean} showDebug
 * @property {boolean} xRayEnabled
 *
 * @property {() => void} applyControlsInitValues
 * @property {(...lines: string[]) => void} log
 * @property {(msg: string) => void} measure
 * Measure durations by sending same `msg` twice.
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeBgScale
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeBrightness
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeCanTweenPaused
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeDark
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeLoggerLog
 * @property {(e: React.ChangeEvent<HTMLInputElement>) => void} onChangeXRayEnabled
 * @property {(e: NPC.LoggerLinkEvent) => void} onClickLoggerLink
 * @property {(connectorKey: string) => void} onConnect
 * @property {() => void} onOverlayPointerUp
 * @property {(name: string, line: string) => void} say
 * `name` could be an `npcKey` or "narrator"
 * @property {(shouldPrevent: boolean) => void} setPreventDraggable
 */
