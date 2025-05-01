import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { shallow } from "zustand/shallow";
import debounce from "debounce";
import { useBeforeunload } from "react-beforeunload";

import WorldTwoNpcWebp from '../public/images/localhost_3000_blog_index.png.webp';

import { view } from "./const";
import { afterBreakpoint, breakpoint } from "./const";
import useSite from "./site.store";
import ViewerControls, { viewBarSizeCssVar, viewIconSizeCssVar } from "./ViewerControls";

import { deepClone, parseJsArg, testNever, tryLocalStorageGet } from "@/npc-cli/service/generic";
import { localStorageKey } from "@/npc-cli/service/const";
import { appendTabToLayout, isComponentClassKey } from "@/npc-cli/tabs/tab-util";
import type { ComponentClassKey, TabDef } from "@/npc-cli/tabs/tab-factory";
import useIntersection from "@/npc-cli/hooks/use-intersection";
import useStateRef from "@/npc-cli/hooks/use-state-ref";
import useUpdate from "@/npc-cli/hooks/use-update";
import { Tabs, State as TabsState } from "@/npc-cli/tabs/Tabs";


export default function Viewer() {

  const site = useSite(({ viewOpen, tabset: lookup, tabsetUpdates }) => ({
    tabset: lookup.current,
    tabsetUpdates,
    viewOpen,
  }), shallow);

  const update = useUpdate();

  const state = useStateRef((): State => ({
    rootEl: null as any,
    tabs: {} as TabsState,

    computeTabDef(classKey, opts) {
      let tabDef: TabDef;

      switch (classKey) {
        case 'HelloWorld':
          tabDef = {
            type: 'component',
            class: classKey,
            filepath: `hello-world-${opts.suffix ?? '0'}`,
            props: {},
          };
          break;
        case 'World':
          const worldKey = `world-${opts.suffix ?? '0'}`;
          tabDef = {
            type: 'component',
            class: classKey,
            filepath: worldKey,
            props: {
              worldKey,
              mapKey: opts.mapKey ?? "demo-map-1"
            },
          };
          break;
        case 'Tty':
          tabDef = {
            type: 'terminal',
            filepath: `tty-${opts.suffix}`,
            env: opts.env ?? {},
          };
          break;
        default:
          throw testNever(classKey);
      }

      return tabDef;
    },
    onChangeIntersect: debounce((intersects: boolean) => {
      !intersects && state.tabs?.enabled && state.tabs.toggleEnabled();
      update();
    }, 1000),
    onInternalApi(internalApiPath) {
      const parsedUrl = new URL(internalApiPath, location.origin);

      /**
       * e.g. `/internal-api/foo/bar?baz=qux&env={WORLD_KEY:"hello"}` yields
       * `{ baz: 'qux', env: {WORLD_KEY:'hello'} }`
       */
      const opts = Array.from(parsedUrl.searchParams).reduce(
        (agg, [k, v]) => (agg[k] = parseJsArg(v), agg),
        {} as Record<string, string>,
      );

      /**
       * e.g. `/internal-api/foo/bar?baz=qux&env={WORLD_KEY:"hello"}` yields
       * `['foo', 'bar']`
       */
      const parts = parsedUrl.pathname.split('/').slice(2);
      
      console.log({ internalApiPath, parts, opts });

      switch (parts[0]) {
        case 'set-tabs':
          useSite.api.changeTabset(parts[1]);
          setTimeout(update); // 🚧 why is a delayed update needed?
          break;
        case 'reset-tabs':
          useSite.api.revertCurrentTabset();
          setTimeout(update);
          break;
        case 'test-mutate-tabs':
          useSite.api.testMutateLayout();
          setTimeout(update);
          break;
        case 'remember-tabs':
          useSite.api.rememberCurrentTabs();
          setTimeout(update);
          break;
        case 'open-tab': {
          const classKey = parts[1];
          if (!(isComponentClassKey(classKey) || classKey === 'Tty')) {
            throw Error(`${'onInternalApi'}: open-tab: unknown classKey "${classKey}"`);
          }

          const tabDef = state.computeTabDef(classKey, opts);
          useSite.api.openTab(tabDef);
          break;
        }
        case 'close-tab': {
          const tabId = parts[1];
          useSite.api.removeTab(tabId);
          break;
        }
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
    onModelChange(syncCurrent) {
      useSite.api.storeCurrentLayout(state.tabs.model);

      if (syncCurrent) {// sync avoids resetting to "initial layout"
        useSite.api.syncCurrentTabset(state.tabs.model);
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

  useBeforeunload(() => useSite.api.storeCurrentLayout(state.tabs.model));

  const collapsed = !site.viewOpen;
  const neverEnabled = !state.tabs.everEnabled;

  return (
    <aside
      css={viewerCss}
      className={cx({ collapsed })}
      data-testid="viewer"
      ref={state.ref('rootEl')}
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
          onHardReset={useSite.api.revertCurrentTabset}
          onModelChange={state.onModelChange}
          onToggled={update}
          persistLayout
          updates={site.tabsetUpdates}
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
  computeTabDef(classKey: ComponentClassKey | 'Tty', opts: Record<string, any>): TabDef;
  /** @param pathname e.g. `/internal/set-tabset/empty` */
  onInternalApi(pathname: `/internal/${string}`): void;
  onChangeIntersect(intersects: boolean): void;
  onKeyDown(e: React.KeyboardEvent): void;
  onModelChange(updateLayout: boolean): void;
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
