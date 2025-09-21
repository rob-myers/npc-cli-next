import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";

import { zIndexWorld } from "../service/const";
import { WorldContext } from "./world-context";
import { SpeechBubbleApi } from "./speech-bubble-api";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d } from "../components/Html3d";
import { PopUp, popUpBubbleArrowColorCssVar, popUpButtonClassName, popUpContentClassName } from "../components/PopUp";

export default function NpcSpeechBubbles() {

  const w = React.useContext(WorldContext);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    byKey: {},
    lastFront: '',
    delete(...npcKeys) {
      for (const npcKey of npcKeys) {
        state.byKey[npcKey]?.dispose();
        delete state.byKey[npcKey];
        w.n[npcKey]?.showLabel(true);
      }
      update();
    },
    ensure(npcKey) {// ensure exists and is tracking npc
      const npc = w.npc.get(npcKey);
      const bubble = state.byKey[npcKey] ??= new SpeechBubbleApi(npcKey, w);
      bubble.setTracked({ object: npc.m.group, offset: npc.offsetSpeech });
      update();
      return bubble;
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

  return Object.values(state.byKey).map((bubble) =>
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
 * @property {(npcKey: string) => void} toFront
 */

/**
 * @param {SpeechBubbleProps} props
 */
function NpcSpeechBubble({ bubble: b }) {

  b.update = useUpdate();

  React.useEffect(() => {
    setTimeout(b.update); // Extra render e.g. for speak while paused
  }, []);

  return (
    <Html3d
      ref={b.html3dRef.bind(b)}
      css={npcSpeechBubbleCss}
      baseScale={speechBubbleBaseScale}
      offset={b.offset}
      position={b.position}
      r3f={b.w.r3f}
      tracked={b.tracked}
      visible
    >
      <div className="speech">
        <div className="npc-key">
          <PopUp // invisible but clickable
            ref={b.popUpRef.bind(b)}
            css={popUpCss}
            deltaArrowLeft={28}
            label={<span className="npc-key">{b.key}</span>}
            left
            onWheel={b.forwardWheelEvents.bind(b)}
            onChange={b.onPopUpChange.bind(b)}
            top={false}
            width={140}
          >
            <div
              css={thoughtsCss}
              onClick={b.onClickThoughts.bind(b)}
            >
              {b.thoughts.map((thought) =>
                <Thought key={thought.key} thought={thought} />
              )}
              {b.thoughts.length === 0 && <>...</>}
            </div>
          </PopUp>

          {b.key}
        </div>
        
        {b.speech ? <>&nbsp;{b.speech}</> : undefined}
      </div>
    </Html3d>
  );
}

/** @param {{ thought: NPC.BubbleThought }} props */
function Thought({ thought }) {
  return (
    <p className={cx("thought", thought.disabled ? 'disabled' : undefined )}>
      {thought.parts.map(part =>
        Array.isArray(part)
          ? <button
              key={part[0]}
              data-thought-key={thought.key}
              data-button-key={part[1] ?? part[0]}
              disabled={thought.disabled}
            >
              {part[0]}
            </button>
          : part
      )}
      {thought.disabled === true && (
        <button
          data-delete-thought-key={thought.key}
          className="delete"
        >
          x
        </button>
      )}
    </p>
  )
}

/**
 * @typedef SpeechBubbleProps
 * @property {SpeechBubbleApi} bubble
 */

/** @type {React.MemoExoticComponent<(props: SpeechBubbleProps & { epochMs: number }) => React.JSX.Element>} */
const MemoizedSpeechBubble = React.memo(NpcSpeechBubble);

export const speechBubbleBaseScale = 4;

export const npcSpeechBubbleOpacityCssVar = '--npc-speech-bubble-opacity';

const npcSpeechBubbleCss = css`
  
  --speech-bubble-width: 300px;

  position: absolute;
  top: -16px;
  /** 10px seems to align to npc label */
  left: calc(-1/2 * var(--speech-bubble-width) + 10px);
  transform-origin: 0 0;
  
  pointer-events: none;
  background: transparent !important;

  > div {
    /* transform-origin: calc(+1/2 * var(--speech-bubble-width)) 0; */
    width: var(--speech-bubble-width);
    
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    
    opacity: var(${npcSpeechBubbleOpacityCssVar});
    transition: opacity 300ms;
  }

  .npc-key {
    display: inline-block;
    color: #fff;
  }

  .speech {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size: 1.8rem;

    color: #ff9;
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
`;

const popUpCss = css`
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
    background-color: rgba(0, 0, 0, 0.75);
  }

  ${popUpBubbleArrowColorCssVar}: #99f9;
`;

const thoughtsCss = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  font-size: 1rem;

  .thought button {
    display: inline-block;
    color: #99f;
    text-decoration: underline;
    white-space: nowrap;
    padding: 0 4px;
  }
  .thought.disabled {
    color: #999;
    button {
      color: #999;
    }
    button.delete {
      color: #f99;
      text-decoration: none;
    }
  }
`;