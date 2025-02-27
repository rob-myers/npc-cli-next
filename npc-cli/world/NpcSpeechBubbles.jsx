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
        cm.setTracked(w.n[npcKey].m.group);
        cm.updateOffset();
        cm.baseScale = speechBubbleBaseScale; // speech bubble always scaled
        cm.open = true;
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
    <MemoizedContextMenu key={cm.key} cm={cm} epochMs={cm.epochMs}/>
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
    // Need extra initial render e.g. when paused
    cm.update();
  }, []);

  return (
    <Html3d
      ref={cm.html3dRef.bind(cm)}
      css={cm.key === 'default' ? undefined: npcContextMenuCss}
      baseScale={cm.baseScale}
      offset={cm.offset}
      position={cm.position}
      r3f={cm.w.r3f}
      tracked={cm.tracked ?? null}
      visible={cm.open}
    >
      <div className="bubble">
        <div className="speech">
          {cm.speech}
        </div>
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

export const npcContextMenuCss = css`
  --menu-width: 200px;

  position: absolute;
  top: 0;
  left: calc(-1/2 * var(--menu-width));
  transform-origin: 0 0;
  
  pointer-events: none;
  background: transparent !important;

  > div {
    transform-origin: calc(+1/2 * var(--menu-width)) 0;
    width: var(--menu-width);
    display: flex;
    justify-content: center;
  }
  
  .bubble {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    
    font-size: 1rem;
    color: #ff9;
    
    transition: width 300ms;
  }

  .speech {
    font-weight: lighter;
    font-style: italic;
    font-size: 1rem;

    display: -webkit-box;
    justify-content: center;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; 
    overflow: hidden;

    text-align: center;
  }
`;
