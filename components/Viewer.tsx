import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import WorldTwoNpcWebp from '../public/images/localhost_3000_blog_index.png.webp';

import { view } from "./const";
import { afterBreakpoint, breakpoint } from "./const";
import useSite from "./site.store";
import ViewerControls, { viewBarSizeCssVar, viewIconSizeCssVar } from "./ViewerControls";

import { tryLocalStorageGet } from "@/npc-cli/service/generic";
import { localStorageKey } from "@/npc-cli/service/const";
import { profile } from "@/npc-cli/sh/src";
import useIntersection from "@/npc-cli/hooks/use-intersection";
import useStateRef from "@/npc-cli/hooks/use-state-ref";
import useUpdate from "@/npc-cli/hooks/use-update";
import { Tabs, State as TabsState } from "@/npc-cli/tabs/Tabs";


export default function Viewer() {

  const site = useSite(({ viewOpen, tabset: lookup }) => ({
    viewOpen,
    tabset: lookup.current,
  }), shallow);

  const update = useUpdate();

  const state = useStateRef<State>(() => ({
    rootEl: null as any,
    tabs: {} as TabsState,

    onChangeIntersect: debounce((intersects: boolean) => {
      !intersects && state.tabs?.enabled && state.tabs.toggleEnabled();
      update();
    }, 1000),
    onInternalApi(internalApiPath) {
      const parts = internalApiPath.split('/').slice(2);
      console.log({ internalApiPath, parts });

      switch (parts[0]) {
        case 'set-tabs':
          useSite.api.changeTabset(parts[1]);
          // 🚧 why is a delayed update needed?
          setTimeout(update);
          break;
        case 'reset-tabs':
          useSite.api.createTabset({
            key: parts[1],
            layout: [],
          });
          break;
        case 'open-tab':
          // 🚧
          break;
        case 'close-tab':
          // 🚧
          break;
        case 'noop':
        default:
          return;
      }

      window.location.hash = '/internal/noop';
    },
    onKeyDown(e) {
      if (e.key === "Escape" && state.tabs.enabled) {
        state.tabs.toggleEnabled(false);
      }
      if (e.key === "Enter" && !state.tabs.enabled) {
        state.tabs.toggleEnabled(true);
      }
    },
    update,
  }));

  useIntersection({
    elRef: () => state.rootEl,
    cb: state.onChangeIntersect,
    trackVisible: true,
  });

  React.useEffect(() => {
    // remember Viewer percentage
    const percentStr = tryLocalStorageGet(localStorageKey.viewerBasePercentage);
    percentStr !== null && state.rootEl.style.setProperty(viewerBaseCssVar, percentStr);

    // handle #/internal/foo/bar triggered via links in blog
    function onHashChange() {
      if (location.hash?.startsWith('#/internal/')) {
        state.onInternalApi(
          `/internal/${location.hash.slice('#/internal/'.length)}`
        );
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const collapsed = !site.viewOpen;
  const neverEnabled = !state.tabs.everEnabled;

  return (
    <aside
      css={viewerCss}
      className={cx({ collapsed })}
      data-testid="viewer"
      ref={(el) => void (el && (state.rootEl = el))}
      tabIndex={0}
      onKeyDown={state.onKeyDown}
    >
      <ViewerControls api={state} />

      <div
        css={tabsContainerCss}
        className={cx({ collapsed, neverEnabled })}
        {...neverEnabled && { onPointerDown: () => state.tabs.toggleEnabled(true) }}
      >
        <Tabs
          ref={state.ref('tabs')}
          id="viewer-tabs"
          initEnabled={false}
          onToggled={update}
          persistLayout
          rootOrientationVertical
          tabset={site.tabset}
        />
      </div>
    </aside>
  );
}

export interface State {
  rootEl: HTMLElement;
  /** Tabs API */
  tabs: TabsState;
  /**
   * @param pathname e.g. `/internal/set-tabset/empty`
   */
  onInternalApi(pathname: `/internal/${string}`): void;
  onChangeIntersect(intersects: boolean): void;
  onKeyDown(e: React.KeyboardEvent): void;
  update(): void;
}

export const viewerBaseCssVar = '--viewer-base';

const viewerCss = css`
  ${css`
    ${viewBarSizeCssVar}: ${view.barSize};
    ${viewIconSizeCssVar}: ${view.iconSize};
  `}

  // if never drag or maximise, toggle acts like this
  ${viewerBaseCssVar}: 50%;

  position: relative;
  display: flex;

  cursor: pointer;
  color: white;
  background: black;
  -webkit-tap-highlight-color: transparent;

  @media (min-width: ${afterBreakpoint}) {
    flex-direction: row;
    transition: min-width 500ms;
    min-width: var(${viewerBaseCssVar});
    &.collapsed {
      min-width: 0%;
    }
  }

  @media (max-width: ${breakpoint}) {
    flex-direction: column;
    transition: min-height 500ms ease-in-out;
    min-height: calc( max(var(${viewerBaseCssVar}), ${view.barSize}) );
    &.collapsed {
      min-height: ${view.barSize};
    }
  }
`;

const tabsContainerCss = css`
  height: 100%;
  width: 100%;
  
  &:not(.collapsed) {
    cursor: auto;
    opacity: 1;
    transition: opacity 200ms 100ms; // delay 100ms
  }
  &.collapsed {
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms;
  }
  
  
  &.neverEnabled {
    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 0.25; }
    }
    animation: fadeIn 2s forwards;
    
    cursor: pointer;
    background-image: url(${WorldTwoNpcWebp.src});
    background-size: 100%;
    background-repeat: no-repeat;
    background-position: 50% 50%;
    filter: brightness(4);
  }
`;
