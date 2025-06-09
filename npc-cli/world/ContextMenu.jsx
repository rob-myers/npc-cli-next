import React from "react";
import * as THREE from "three";
import { css } from "@emotion/react";
import cx from "classnames";
import { stringify as javascriptStringify } from 'javascript-stringify';
import debounce from "debounce";

import { tryLocalStorageGetParsed, tryLocalStorageSet, warn } from "../service/generic";
import { WorldContext } from "./world-context";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";
import { PopUp, popUpContentClassName } from "../components/PopUp";
import { Html3d, objectScale } from "../components/Html3d";
import { Draggable } from "../components/Draggable";
import { zIndexWorld } from "../service/const";

export function ContextMenu() {

  const w = React.useContext(WorldContext);
  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    baseScale: undefined,
    downAt: null,
    draggable: /** @type {*} */ (null),
    html3d: /** @type {*} */ (null),
    offset: undefined,
    optsPopUp: /** @type {*} */ (null),
    position: new THREE.Vector3(),
    tracked: undefined,
    
    docked: false,
    open: false,
    pinned: tryLocalStorageGetParsed(`context-menu:pinned@${w.key}`) ?? true,
    scaled: false,
    showKvs: true,
  
    kvs: [],
    links: [],
    match: {},
    meta: {},
    selectNpcKeys: [],

    computeKvsFromMeta(meta) {
      const skip = /** @type {Record<string, boolean>} */ ({
        doorId: 'gdKey' in meta,
        gmId: 'gdKey' in meta || 'grKey' in meta,
        obsId: true,
        picked: true,
        roomId: 'grKey' in meta,
      });
      state.kvs = Object.entries(meta ?? {}).flatMap(([k, v]) => {
        if (skip[k] === true) return [];
        const vStr = v === true ? '' : typeof v === 'string' ? v : javascriptStringify(v) ?? '';
        return { k, v: vStr, length: k.length + (vStr === '' ? 0 : 1) + vStr.length };
      // }).sort((a, b) => a.length < b.length ? -1 : 1);
      }); // sorting destroys tag precedence
    },
    /**
     * Apply matchers, assuming `state.meta` is up-to-date.
     */
    computeLinks() {
      let suppressKeys = /** @type {string[]} */ ([]);

      const keyToLink = Object.values(state.match).reduce((agg, matcher) => {
        const { showLinks, hideKeys } = matcher(state);
        showLinks?.forEach(link => agg[link.key] = link);
        suppressKeys.push(...hideKeys ?? []);
        return agg;
      }, /** @type {{ [linkKey: string]: NPC.ContextMenuLink }} */ ({}));

      suppressKeys.forEach(key => delete keyToLink[key]);
      state.links = Object.values(keyToLink);
    },
    getPosition() {
      if (state.tracked === undefined) {
        return state.position.clone();
      } else {
        const { object, offset } = state.tracked;
        return object.position.clone().add(offset);
      }
    },
    hide(force) {
      if (state.pinned === true && force !== true) {
        return;
      }
      state.open = false;
      update();
    },
    onKeyDownButton(e) {
      if (e.code === 'Space') {
        state.onToggleLink(e);
        e.currentTarget.focus();
      }
    },
    onPointerDown(e) {
      state.downAt = { x: e.clientX, y: e.clientY };
    },
    onPointerUp(e) {
      const { downAt } = state;
      state.downAt = null;
      // e.stopPropagation();

      if (
        downAt === null
        || Math.abs(e.clientX - downAt.x) > 2
        || Math.abs(e.clientY - downAt.y) > 2
      ) {
        return;
      } else {
        state.onToggleLink(e);
      }
    },
    onToggleLink(e) {
      const el = /** @type {HTMLElement} */ (e.target);
      const linkKey = el.dataset.key;

      if (linkKey === undefined) {
        return warn(`${'onToggleLink'}: ignored el ${el.tagName} with class ${el.className}`);
      }

      // w.view.rootEl.focus();
      w.events.next({ key: 'contextmenu-link', linkKey });

      switch (linkKey) {
        // case 'delete': w.c.delete(e.cmKey); break;
        case 'hide': state.hide(true); break;
        case 'toggle-docked': state.toggleDocked(); break;
        case 'toggle-kvs': state.toggleKvs(); break;
        case 'toggle-open': state.toggleOpen(); break;
        case 'toggle-pinned': state.togglePinned(); break;
        case 'toggle-scaled': state.toggleScaled(); break;
      }

      state.persist();
    },
    onToggleOptsPopup(willOpen) {
      if (willOpen) {
        state.refreshOptsPopUp();
      }
    },
    onWheel(e) {// pass scroll through to canvas (zoom)
      w.view.canvas.dispatchEvent(new WheelEvent(e.nativeEvent.type, e.nativeEvent));
    },
    persist() {
      tryLocalStorageSet(`context-menu:pinned@${w.key}`, JSON.stringify(state.pinned));
    },
    refreshOptsPopUp: debounce(() => {
      state.selectNpcKeys = Object.keys(w.n);
      update();
    }, 30, { immediate: true }),
    /**
     * Context is world position and meta concerning said position
     */
    setContext({ position, meta }) {
      state.meta = meta;
      state.position = position.clone();
      state.computeKvsFromMeta(meta);
      state.computeLinks();
    },
    setNonDockedOpacity(opacity) {
      state.html3d.rootDiv.style.setProperty(contextMenuOpacityCssVar, `${opacity}`);
    },
    setTracked(npcKey) {
      if (npcKey === undefined) {
        state.tracked = undefined;
      } else {
        const npc = w.n[npcKey];
        state.tracked = { npcKey, object: npc.m.group, offset: npc.offsetMenu };
      }
    },
    show() {
      state.open = true;
      update();
    },
    toggleDocked(next = !state.docked) {
      if (next === state.docked) {
        return;
      }

      state.docked = next;
      
      if (state.docked === true) {// About to dock
        state.optsPopUp.close();
        state.html3d.innerDiv.style.transform = 'scale(1)';
        // 🔔 crucial to avoid flicker on mobile
        state.draggable.el.style.visibility = 'hidden';
      }

      update();
    },
    toggleOpen() {
      state.open = !state.open;
      update();
    },
    togglePinned() {
      state.pinned = !state.pinned;
      // if (state.pinned === false) {
      //   state.open = false; // auto-close on un-pin
      // }
      update();
    },
    toggleScaled() {
      state.scaled = !state.scaled;
      const position = state.getPosition();
      state.baseScale = state.scaled === true ? 1 / objectScale(position, w.r3f.camera) : undefined;
      update();
    },
    toggleKvs() {
      state.showKvs = !state.showKvs;
      update();
    },
    update,
  }));

  w.cm = state;
  
  // Extra initial render: (a) init paused, (b) trigger CSS transition
  React.useEffect(() => void update(), [state.scaled]);

  return w.r3f === null ? null : (
    <Html3d
      ref={state.ref('html3d')}
      baseScale={state.baseScale}
      css={contextMenuCss}
      docked={state.docked}
      position={state.position}
      r3f={w.r3f}
      tracked={state.tracked ?? null}
      visible={state.open}
    >
      <Draggable
        ref={state.ref('draggable')}
        container={w.view.rootEl}
        defaultWidth={contextMenuWidthPx}
        disabled={state.docked === false}
        initPos={{ x: 0, y: 2000 }}
        localStorageKey={`contextmenu:dragPos@${w.key}`}
      >
        <div
          className="inner-root"
          onPointerUp={state.onPointerUp}
          onPointerDown={state.onPointerDown}
          onWheel={state.onWheel}
        >
          <ContextMenuLinks state={state} />

          {state.showKvs === true && <ContextMenuMeta state={state} />}
        </div>
      </Draggable>
    </Html3d>
  );
}

/** @param {{ state: import("../hooks/use-state-ref").UseStateRef<State> }} Props */
function ContextMenuLinks({ state }) {
  return (
    <div className="links">

      <button
        data-key="toggle-docked"
        onKeyDown={state.onKeyDownButton}
      >
        {state.docked ? '@3d' : 'dock'}
      </button>

      <PopUp
        ref={state.ref('optsPopUp')}
        css={optsPopUpCss}
        label="opts"
        onChange={state.onToggleOptsPopup.bind(state)}
        width={100}
      >
        <button
          key="toggle-scaled"
          data-key="toggle-scaled"
          className={!state.scaled ? 'off' : undefined}
        >
          scale
        </button>
      </PopUp>

      <button
        key="toggle-kvs"
        data-key="toggle-kvs"
        className={!state.showKvs ? 'off' : undefined}
        onKeyDown={state.onKeyDownButton}
      >
        meta
      </button>

      <button
        key="toggle-pinned"
        data-key="toggle-pinned"
        className={!state.pinned ? 'off' : undefined}
        onKeyDown={state.onKeyDownButton}
      >
        pin
      </button>

      <button
        key="toggle-open"
        data-key="toggle-open"
        onKeyDown={state.onKeyDownButton}
      >
        x
      </button>

      {state.links.map(({ key, label, selected }) =>
        <button
          key={key}
          data-key={key}
          className={
            typeof selected === 'function'
              ? cx({ 'custom-link': true, selected: selected?.() === true })
              : 'custom-link'
          }
        >
          {label}
        </button>
      )}
    </div>
  );
}

/** @param {{ state: import("../hooks/use-state-ref").UseStateRef<State> }} Props */
function ContextMenuMeta({ state }) {
  return (
    <div className="kvs">
      {state.kvs.map((x, i) => [
        <span key={i} className="key">{x.k}</span>,
        x.v !== '' ? <span key={i + 'v'} className="value">{x.v}</span> : null,
      ])}
    </div>
  );
}

const contextMenuWidthPx = 200;

export const contextMenuOpacityCssVar = '--content-menu-opacity';


export const contextMenuCss = css`
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  background: transparent !important;
  pointer-events: none;

  > div {
    transform-origin: 0 0;
    /* transformed Draggable receives instead */
    pointer-events: none;
  }

  .inner-root {
    width: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 0 8px 8px 8px;
    border: 1px solid #333;
    padding: 4px;
    font-size: small;
  }
  
  z-index: ${zIndexWorld.contextMenu};
  
  &.docked {
    transform: unset !important;
  }
  &:not(.docked) .inner-root {
    opacity: var(${contextMenuOpacityCssVar});
    transition: opacity 200ms;
  }

  .select-npc {
    background-color: black;
    color: white;
    padding: 4px;
  }

  color: #fff;
  font-size: smaller;

  .links {
    display: flex;
    flex-wrap: wrap;
    
    line-height: normal;
    letter-spacing: 1px;
    gap: 0px;

    user-select: none;
  }

  .links button {
    text-decoration: underline;
    color: #aaf;
    padding: 5px 6px;
  }
  .links button.off {
    filter: brightness(0.7);
  }
  .links button.custom-link {
    padding: 5px 4px;
    &.selected {
      text-decoration: none;
      font-style: italic;
    }
  }

  .kvs {
    display: flex;
    flex-wrap: wrap;
    user-select: text;

    padding: 4px;
    gap: 4px;
    color: #ccc;
    filter: brightness(0.7);

    span.value {
      color: #ff7;
    }
  }
`;

const optsPopUpCss = css`
  z-index: ${zIndexWorld.popUpInContextMenu};

  .${popUpContentClassName} {
    display: flex;
    justify-content: space-around;
    align-items: center;
    font-size: small;
  }
;`

/**
 * @typedef State
 * @property {undefined | number} baseScale
 * @property {boolean} docked
 * @property {import('../components/Draggable').State} draggable
 * @property {import("../components/Html3d").State} html3d
 * @property {null | Geom.VectJson} downAt
 * @property {{ k: string; v: string; length: number }[]} kvs
 * @property {NPC.ContextMenuLink[]} links
 * @property {{ [matcherKey: string]: NPC.ContextMenuMatcher }} match
 * @property {Meta} meta
 * @property {undefined | import("three").Vector3Like} offset
 * @property {boolean} open
 * @property {import("../components/PopUp").State} optsPopUp
 * @property {import('three').Vector3} position
 * @property {undefined | { npcKey: string } & import('../components/Html3d').TrackedObject3D} tracked
 * @property {boolean} pinned
 * @property {boolean} scaled
 * @property {string[]} selectNpcKeys
 * @property {boolean} showKvs
 * @property {(meta: Meta) => void} computeKvsFromMeta
 * @property {() => void} computeLinks
 * @property {() => THREE.Vector3} getPosition Get actual position e.g. if tracked.
 * @property {(force?: boolean | undefined) => void} hide
 * @property {(e: React.KeyboardEvent<HTMLButtonElement>) => void} onKeyDownButton
 * @property {(e: React.PointerEvent) => void} onPointerDown
 * @property {(e: React.PointerEvent) => void} onPointerUp
 * @property {(e: React.MouseEvent | React.KeyboardEvent) => void} onToggleLink
 * @property {(willOpen: boolean) => void} onToggleOptsPopup
 * @property {(e: React.WheelEvent) => void} onWheel
 * @property {() => void} persist
 * @property {() => void} refreshOptsPopUp
 * @property {({ position, meta }: NPC.ContextMenuContextDef) => void} setContext
 * @property {(opacity: number) => void} setNonDockedOpacity
 * @property {(npcKey?: string) => void} setTracked
 * @property {() => void} show
 * @property {(next?: boolean) => void} toggleDocked optional set
 * @property {() => void} toggleOpen
 * @property {() => void} togglePinned
 * @property {() => void} toggleScaled Ensure smooth transition when start scaling
 * @property {() => void} toggleKvs
 * @property {() => void} update
 **/
