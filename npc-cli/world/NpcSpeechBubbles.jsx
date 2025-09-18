import React from "react";
import { css } from "@emotion/react";

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
    ensure(npcKey) {
      if (!(npcKey in w.n)) {
        throw Error(`npc not found: "${npcKey}"`);
      }
      const item = state.lookup[npcKey] ??= new SpeechBubbleApi(npcKey, w);
      item.visible = true;
      
      const npc = w.n[npcKey];
      item.setTracked({ object: npc.m.group, offset: npc.offsetSpeech });
      item.baseScale = speechBubbleBaseScale; // speech bubble always scaled
      update();
      return item;
    },
    forwardWheelEvents(e) {
      e.stopPropagation();
      w.view.canvas.dispatchEvent(new WheelEvent(e.nativeEvent.type, e.nativeEvent));
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
      for (const item of Object.values(state.lookup)) {
        // copy new properties and prototype over
        const tempNewItem = new SpeechBubbleApi(item.key, w);
        Object.assign(item, { ...tempNewItem }, { ...item });
        Object.setPrototypeOf(item, Object.getPrototypeOf(tempNewItem));
      }
    }
  }, []);

  const update = useUpdate();

  return Object.values(state.lookup).filter(({ visible }) => visible).map((cm) =>
    <MemoizedSpeechBubble
      key={cm.key}
      cm={cm}
      epochMs={cm.epochMs}
      forwardWheelEvents={state.forwardWheelEvents}
    />
  );
}

/**
 * @typedef State
 * @property {string} lastFront npcKey
 * @property {(...npcKeys: string[]) => void} delete
 * @property {(npcKey: string) => SpeechBubbleApi} ensure
 * @property {{ [npcKey: string]: SpeechBubbleApi }} lookup
 * @property {(e: React.WheelEvent) => void} forwardWheelEvents
 * @property {(npcKey: string) => void} toFront
 */

/**
 * @param {ContextMenuProps} props
 */
function NpcSpeechBubble({ cm, forwardWheelEvents }) {

  cm.update = useUpdate();

  React.useEffect(() => {
    // Extra initial render e.g. for speak while paused
    setTimeout(cm.update);
  }, []);

  return (
    <Html3d
      ref={cm.html3dRef.bind(cm)}
      css={npcSpeechBubbleCss}
      baseScale={cm.baseScale}
      offset={cm.offset}
      position={cm.position}
      r3f={cm.w.r3f}
      tracked={cm.tracked ?? null}
      visible={cm.visible}
    >
      <div className="speech">
        <span className="npc-key">{cm.speech ? `${cm.key} ` : undefined}</span>
        {cm.speech}
      </div>
      <div
        className="actions"
        onWheel={forwardWheelEvents}
      >
        <select name={`${cm.key}-actions`}>
          <option value="">{`[action]`}</option>
          {cm.options.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
    </Html3d>
  );
}

/**
 * @typedef ContextMenuProps
 * @property {SpeechBubbleApi} cm
 * @property {(e: React.WheelEvent) => void} forwardWheelEvents
 */

/** @type {React.MemoExoticComponent<(props: ContextMenuProps & { epochMs: number }) => React.JSX.Element>} */
const MemoizedSpeechBubble = React.memo(NpcSpeechBubble);

const speechBubbleBaseScale = 4;

export const npcSpeechBubbleOpacityCssVar = '--npc-speech-bubble-opacity';

export const npcSpeechBubbleCss = css`
  --speech-bubble-width: 400px;

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
    /* font-family: 'Courier New', Courier, monospace; */
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size: 1.6rem;

    color: rgba(255, 255, 255, 0.8);
    /* border: 1px solid rgba(255, 255, 255, 0.3); */
    background-color: rgba(0, 0, 0, 0.4);
    /* letter-spacing: 2px; */
    line-height: 1.4;
    padding: 0px 8px;
    text-shadow: 2px 0px black;
    
    display: -webkit-box;
    justify-content: center;
    -webkit-line-clamp: 2;
    /* -webkit-line-clamp: 1; */
    -webkit-box-orient: vertical; 
    overflow: hidden;
    
    text-align: center;
  }
  
  .npc-key {
    /* font-weight: lighter; */
    font-style: italic;
    color: #ff9;
  }

  .actions {
    select {
      background-color: rgba(0, 0, 0, 0.3);
      color: white;
      pointer-events: all;
      font-size: 1.2rem;
      font-weight: 300;
      text-align: center;
      /* appearance: none; */
    }
  }
`;
