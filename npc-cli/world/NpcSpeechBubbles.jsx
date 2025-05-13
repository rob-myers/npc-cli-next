import React from "react";
import { css } from "@emotion/react";

import { WorldContext } from "./world-context";
import { SpeechBubbleApi } from "./speech-bubble-api";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { Html3d } from "../components/Html3d";

export default function NpcSpeechBubbles() {

  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    lookup: {},

    create(npcKey) {// assumes non-existent
      if (npcKey in w.n) {
        const cm = state.lookup[npcKey] = new SpeechBubbleApi(npcKey, w);
        const npc = w.n[npcKey];
        cm.setTracked({ object: npc.m.group, offset: npc.offsetSpeech });
        cm.baseScale = speechBubbleBaseScale; // speech bubble always scaled
        update();
        return cm;
      } else {
        throw Error(`ContextMenus.trackNpc: npc not found: "${npcKey}"`);
      }
    },
    delete(...npcKeys) {
      for (const npcKey of npcKeys) {
        if (npcKey === 'default') {
          continue; // cannot delete default context menu
        }
        state.lookup[npcKey]?.setTracked();
        delete state.lookup[npcKey];
      }
      update();
    },
    get(npcKey) {
      return /** @type {SpeechBubbleApi} */ (state.lookup[npcKey]);
    },
  }));

  w.bubble = state;

  React.useMemo(() => {// HMR
    process.env.NODE_ENV === 'development' && Object.values(state.lookup).forEach(cm => {
      state.lookup[cm.key] = Object.assign(new SpeechBubbleApi(cm.key, w), {...cm});
      cm.dispose();
    });
  }, []);

  const update = useUpdate();

  return Object.values(state.lookup).map(cm =>
    <MemoizedContextMenu
      key={cm.key}
      cm={cm}
      epochMs={cm.epochMs}
    />
  );
}

/**
 * @typedef State
 * @property {{ [cmKey: string]: SpeechBubbleApi }} lookup
 *
 * @property {(npcKey: string) => SpeechBubbleApi} create Add speech bubble for specific npc
 * @property {(...npcKeys: string[]) => void} delete
 * @property {(npcKey: string) => SpeechBubbleApi} get
 */

/**
 * @param {ContextMenuProps} props
 */
function NpcSpeechBubble({ cm }) {

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
      visible
    >
      <div className="speech">
        <span className="npc-key">{cm.key}{': '}</span>
        {cm.speech}
      </div>
    </Html3d>
  );
}

/**
 * @typedef ContextMenuProps
 * @property {SpeechBubbleApi} cm
 */

/** @type {React.MemoExoticComponent<(props: ContextMenuProps & { epochMs: number }) => React.JSX.Element>} */
const MemoizedContextMenu = React.memo(NpcSpeechBubble);

const speechBubbleBaseScale = 4;

export const npcSpeechBubbleOpacityCssVar = '--npc-speech-bubble-opacity';

export const npcSpeechBubbleCss = css`
  --speech-bubble-width: 420px;

  position: absolute;
  top: 0;
  left: calc(-1/2 * var(--speech-bubble-width));
  transform-origin: 0 0;
  
  pointer-events: none;
  background: transparent !important;

  
  > div {
    transform-origin: calc(+1/2 * var(--speech-bubble-width)) 0;
    width: var(--speech-bubble-width);
    display: flex;
    justify-content: center;
    
    opacity: var(${npcSpeechBubbleOpacityCssVar});
    transition: opacity 300ms;
  }
  
  .speech {
    /* font-family: 'Courier New', Courier, monospace; */
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    /* font-weight: lighter; */
    /* font-style: italic; */
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.6);
    background-color: rgba(0, 0, 0, 0.3);
    /* letter-spacing: 0; */
    line-height: 1.4;
    padding: 0px 8px;
    
    display: -webkit-box;
    justify-content: center;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical; 
    overflow: hidden;
    
    text-align: center;
  }

  .npc-key {
    font-style: italic;
    color: #ff9;
  }
`;
