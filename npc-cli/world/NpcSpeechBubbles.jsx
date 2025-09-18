import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";

import { WorldContext } from "./world-context";
import { SpeechBubbleApi } from "./speech-bubble-api";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d } from "../components/Html3d";
import { zIndexWorld } from "../service/const";

export default function NpcSpeechBubbles() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {},
    lastFront: '',
    delete(...npcKeys) {
      for (const npcKey of npcKeys) {
        state.lookup[npcKey]?.dispose();
        delete state.lookup[npcKey];
      }
      update();
    },
    ensure(npcKey) {// ensure exists and is tracking npc
      const bubble = state.lookup[npcKey] ??= new SpeechBubbleApi(npcKey, w);
      const npc = w.n[npcKey];
      bubble.setTracked({ object: npc.m.group, offset: npc.offsetSpeech });
      return bubble;
    },
    setHideOptions(npcKey, next = !state.lookup[npcKey].hideOptions) {
      const bubble = state.lookup[npcKey];
      bubble.hideOptions = next;
      bubble.update();
    },
    setOptions(npcKey, ...inputs) {
      const bubble = state.ensure(npcKey);
      const options = bubble.setOptions(...inputs);
      bubble.updateNpcLabel();
      update();
      return options;
    },
    toFront(npcKey) {
      const prevBubbleDiv = state.lookup[state.lastFront]?.html3d.rootDiv;
      if (prevBubbleDiv) prevBubbleDiv.style.zIndex = '';
      const bubbleDiv = state.lookup[npcKey].html3d.rootDiv;
      bubbleDiv.style.zIndex = `${zIndexWorld.baseSpeechBubble + 10}`;
      state.lastFront = npcKey;
    },
  }));

  w.bubble = state;

  React.useMemo(() => {// HMR
    if (process.env.NODE_ENV === 'development') {
      for (const bubble of Object.values(state.lookup)) {
        // copy over (a) new properties, (b) prototype
        // assuming there are no function-valued properties (they won't be overwritten)
        const tempBubble = new SpeechBubbleApi(bubble.key, w);
        Object.assign(bubble, { ...tempBubble }, { ...bubble });
        Object.setPrototypeOf(bubble, Object.getPrototypeOf(tempBubble));
      }
    }
  }, []);

  const update = useUpdate();

  return Object.values(state.lookup).filter(({ visible }) => visible).map((bubble) =>
    <MemoizedSpeechBubble
      key={bubble.key}
      bubble={bubble}
      epochMs={bubble.epochMs}
    />
  );
}

/**
 * @typedef State
 * @property {string} lastFront npcKey
 * @property {(...npcKeys: string[]) => void} delete
 * @property {(npcKey: string) => SpeechBubbleApi} ensure
 * @property {{ [npcKey: string]: SpeechBubbleApi }} lookup
 * @property {(npcKey: string, shouldHide?: boolean) => void} setHideOptions
 * @property {(npcKey: string, ...inputs: (string | ((prev: string[]) => string[]))[]) => string[]} setOptions
 * @property {(npcKey: string) => void} toFront
 */

/**
 * @param {SpeechBubbleProps} props
 */
function NpcSpeechBubble({ bubble }) {

  bubble.update = useUpdate();

  React.useEffect(() => {
    // Extra initial render e.g. for speak while paused
    setTimeout(bubble.update);
  }, []);

  const hideActions = bubble.options.length === 0 || bubble.hideOptions === true;

  return (
    <Html3d
      ref={bubble.html3dRef.bind(bubble)}
      css={npcSpeechBubbleCss}
      baseScale={speechBubbleBaseScale}
      offset={bubble.offset}
      position={bubble.position}
      r3f={bubble.w.r3f}
      tracked={bubble.tracked ?? null}
      visible={bubble.visible}
    >
      <div className="speech">
        <select
          className={cx("actions", { hidden: hideActions })}
          onWheel={bubble.forwardWheelEvents.bind(bubble)}
          name={bubble.selectElName}
          onChange={bubble.onChangeSelect.bind(bubble)}
          value="" // fixed value
        >
          <option value="">
            {bubble.key}
          </option>
          {bubble.options.map((option) =>
            <option key={option} value={option}>
              do{' '}{option}
            </option>
          )}
        </select>
        &nbsp;
        {bubble.speech ?? undefined}
      </div>
    </Html3d>
  );
}

/**
 * @typedef SpeechBubbleProps
 * @property {SpeechBubbleApi} bubble
 */

/** @type {React.MemoExoticComponent<(props: SpeechBubbleProps & { epochMs: number }) => React.JSX.Element>} */
const MemoizedSpeechBubble = React.memo(NpcSpeechBubble);

export const speechBubbleBaseScale = 4;

export const npcSpeechBubbleOpacityCssVar = '--npc-speech-bubble-opacity';

export const npcSpeechBubbleCss = css`
  
  --speech-bubble-width: 300px;

  position: absolute;
  top: -16px;
  left: calc(-1/2 * var(--speech-bubble-width));
  transform-origin: 0 0;
  
  pointer-events: none;
  background: transparent !important;

  > div {
    transform-origin: calc(+1/2 * var(--speech-bubble-width)) 0;
    width: var(--speech-bubble-width);
    
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    
    opacity: var(${npcSpeechBubbleOpacityCssVar});
    transition: opacity 300ms;
  }

  .speech {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size: 1.6rem;

    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.3);
    background-color: rgba(0, 0, 0, 0.4);
    line-height: 1.4;
    padding: 0px 8px;
    text-shadow: 2px 0px black;
    
    display: -webkit-box;
    justify-content: center;
    /* -webkit-line-clamp: 1; */
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; 
    overflow: hidden;
    
    text-align: center;
  }
  
  select.actions {
    pointer-events: all;
    cursor: pointer;
    text-align: center;
    /** 🔔 fix safari */
    text-align-last: center;
    appearance: none;
    /* 🚧 measure npcKey */
    width: 48px;
    
    font-style: italic;
    color: #ff9;
    background-color: rgba(0, 0, 0, 0);
    /* border: 1px solid rgba(255, 255, 255, 0.3); */
  }
`;
