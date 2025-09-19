import React from "react";
import { css } from "@emotion/react";

import { zIndexWorld } from "../service/const";
import { WorldContext } from "./world-context";
import { SpeechBubbleApi } from "./speech-bubble-api";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d } from "../components/Html3d";
import { PopUp, popUpButtonClassName, popUpContentClassName } from "../components/PopUp";

export default function NpcSpeechBubbles() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    byKey: {},
    lastFront: '',
    delete(...npcKeys) {
      for (const npcKey of npcKeys) {
        state.byKey[npcKey]?.dispose();
        delete state.byKey[npcKey];
      }
      update();
    },
    ensure(npcKey) {// ensure exists and is tracking npc
      const bubble = state.byKey[npcKey] ??= new SpeechBubbleApi(npcKey, w);
      const npc = w.n[npcKey];
      bubble.setTracked({ object: npc.m.group, offset: npc.offsetSpeech });
      return bubble;
    },
    setHideOptions(npcKey, next = !state.byKey[npcKey].hideOptions) {
      const bubble = state.byKey[npcKey];
      bubble.hideOptions = next;
      bubble.update();
    },
    setOptions(npcKey, ...inputs) {
      const bubble = state.ensure(npcKey);
      const options = bubble.setOptions(...inputs);
      bubble.syncNpcLabel();
      update();
      return options;
    },
    toFront(npcKey) {
      const prevBubbleDiv = state.byKey[state.lastFront]?.html3d.rootDiv;
      if (prevBubbleDiv) prevBubbleDiv.style.zIndex = '';
      const bubbleDiv = state.byKey[npcKey].html3d.rootDiv;
      bubbleDiv.style.zIndex = `${zIndexWorld.baseSpeechBubble + 10}`;
      state.lastFront = npcKey;
    },
  }));

  w.bubble = state;
  w.b = state.byKey;

  React.useMemo(() => {// HMR
    if (process.env.NODE_ENV === 'development') {
      for (const bubble of Object.values(state.byKey)) {
        // copy over (a) new properties, (b) prototype
        // assuming there are no function-valued properties (they won't be overwritten)
        const tempBubble = new SpeechBubbleApi(bubble.key, w);
        Object.assign(bubble, { ...tempBubble }, { ...bubble });
        Object.setPrototypeOf(bubble, Object.getPrototypeOf(tempBubble));
      }
    }
  }, []);

  const update = useUpdate();

  return Object.values(state.byKey).filter(({ visible }) => visible).map((bubble) =>
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
 * @property {{ [npcKey: string]: SpeechBubbleApi }} byKey
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

  return (
    <Html3d
      ref={bubble.html3dRef.bind(bubble)}
      css={npcSpeechBubbleCss}
      baseScale={speechBubbleBaseScale}
      offset={bubble.offset}
      position={bubble.position}
      r3f={bubble.w.r3f}
      tracked={bubble.tracked}
      visible={bubble.visible}
    >
      <div className="speech">
        <span className="npc-key">
          <PopUp // invisible but clickable
            ref={bubble.popUpRef.bind(bubble)}
            label={<span className="npc-key">{bubble.key}</span>}
            css={popUpCss}
            width={100}
          >
            🚧
          </PopUp>
          {bubble.key}
        </span>
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
    font-size: 1.4rem;

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
  
  .npc-key {
    display: inline-block;
    font-style: italic;
    color: #ff9;
  }
`;

export const popUpCss = css`
  position: absolute;
  pointer-events: all;
  
  /* border: 1px solid red; */
  .npc-key {
    visibility: hidden;
  }
  
  .${popUpButtonClassName} {
    outline: none;
  }

  .${popUpContentClassName} {
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;
