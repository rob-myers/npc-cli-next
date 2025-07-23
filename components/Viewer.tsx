import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { shallow } from "zustand/shallow";
import debounce from "debounce";
import { useBeforeunload } from "react-beforeunload";

import { view, viewerCssVar } from "./const";
import { afterBreakpoint, breakpoint } from "./const";

import { parseJsArg, pause, tryLocalStorageGet } from "@/npc-cli/service/generic";
import { localStorageKey } from "@/npc-cli/service/const";
import { helper } from "@/npc-cli/service/helper";
import { computeTabDef } from "@/npc-cli/tabs/tab-util";

import useSite from "./site.store";
import useTabs from "@/npc-cli/tabs/tabs.store";
import useIntersection from "@/npc-cli/hooks/use-intersection";
import useStateRef from "@/npc-cli/hooks/use-state-ref";
import useUpdate from "@/npc-cli/hooks/use-update";

import ViewerControls from "./ViewerControls";
import { Tabs, type State as TabsState, type TabState } from "@/npc-cli/tabs/Tabs";

export default function Viewer() {

  const site = useSite(({ viewOpen }) => ({
    viewOpen,
  }), shallow);
  
  const tabs = useTabs(({ tabset }) => ({
    tabset: tabset.started,
    tabsetVersion: tabset.version,
  }), shallow);

  const update = useUpdate();

  const state = useStateRef((): State => ({
    rootEl: null as any,
    tabs: {} as TabsState,

    animateInternalApiSpinner() {
      state.rootEl.animate([
        { [viewerCssVar.internalApiSpinnerOpacity]: 0, offset: 0 },
        { [viewerCssVar.internalApiSpinnerOpacity]: 1, offset: 0.1 },
        { [viewerCssVar.internalApiSpinnerOpacity]: 0, offset: 1 },
      ], {
        duration: 1000,
        iterations: 1,
        fill: 'forwards',
      });
    },
    onChangeIntersect: debounce((intersects: boolean) => {
      !intersects && state.tabs?.enabled && state.tabs.toggleEnabled();
      update();
    }, 1000),
    onHardReset() {
      // revert to default layout preset, do not restore
      useTabs.api.revertCurrentTabset(true);
    },
    onInternalApi(internalApiPath) {
      const parsedUrl = new URL(internalApiPath, location.origin);

      /**
       * e.g. `#internal-api/foo/bar?baz=qux&env={WORLD_KEY:"hello"}` yields
       * `{ baz: 'qux', env: {WORLD_KEY:'hello'} }`
       */
      const opts = Array.from(parsedUrl.searchParams).reduce(
        (agg, [k, v]) => (agg[k] = parseJsArg(v), agg),
        {} as Record<string, any>,
      );

      /**
       * e.g. `#internal-api/foo/bar?baz=qux&env={WORLD_KEY:"hello"}` yields
       * `['foo', 'bar']`
       */
      const parts = parsedUrl.pathname.split('/').slice(2);
      // console.log({ internalApiPath, parts, opts });

      switch (parts[0]) {
        case 'change-tab': {// props only, not tty env (useSession instead)
          const tabId = parts[1];
          useTabs.api.changeTabProps(tabId, opts.props);
          break;
        }
        case 'close-tab': {
          const tabId = parts[1];
          useTabs.api.closeTab(tabId as Key.TabId);
          break;
        }
        case 'open-tab': {// 🔔 open tab via classKey, opts
          const classKey = parts[1];
          if (!(helper.isTabClassKey(classKey))) {
            throw Error(`${'onInternalApi'}: open-tab: unknown tab class key "${classKey}"`);
          }
          const tabDef = computeTabDef({
            ...opts,
            classKey,
            id: opts.id,
          });
          useTabs.api.openTab(tabDef);
          break;
        }
        case 'remember-tabs':
          useTabs.api.rememberCurrentTabs();
          break;
        case 'reset-tabs':
          useTabs.api.revertCurrentTabset();
          // setTimeout(update);
          break;
        case 'set-tabs': {// 🔔 set layout via layoutPresetKey
          const layoutPresetKey = parts[1];
          if (helper.isLayoutPresetKey(layoutPresetKey)) {
            useTabs.api.setTabset(layoutPresetKey);
          } else {
            throw Error(`${'onInternalApi'} set-tabs: invalid layoutPresetKey "${layoutPresetKey}"`);
          }
          setTimeout(update); // 🚧 why is a delayed update needed?
          break;
        }
        case 'test-mutate-tabs':
          useTabs.api.testMutateLayout();
          // setTimeout(update);
          break;
        case 'noop':
        default:
          return;
      }

      state.animateInternalApiSpinner();

      window.location.hash = '/internal/noop';
    },
    onKeyDown(e) {
      if (e.key === "Escape" && state.tabs.enabled === true) {
        state.tabs.toggleEnabled(false);
      }
      if (e.key === "Enter" && state.tabs.enabled === false) {
        state.tabs.toggleEnabled(true);
      }
    },
    onModelChange(syncCurrent) {
      useTabs.api.storeCurrentLayout(state.tabs.model);

      if (syncCurrent) {// sync avoids resetting to "initial layout"
        useTabs.api.syncCurrentTabset(state.tabs.model);
      }
    },
    onTabsReset() {
      useTabs.api.clearTabMeta();
    },
    async onToggleTab(tabState) {
      // 🚧 site.store.ts:254 Cannot update a component (`Viewer`) while rendering a different component (`Layout`).
      await pause();
      useTabs.api.updateTabMeta({
        key: tabState.key,
        disabled: tabState.disabled,
      });
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
    percentStr !== null && state.rootEl.style.setProperty(viewerCssVar.base, percentStr);

    // ensure layout if localStorage empty
    useTabs.api.restoreLayoutWithFallback("world-tty-default", { preserveRestore: false });

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

  useBeforeunload(() => useTabs.api.storeCurrentLayout(state.tabs.model));

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
        className={cx('tabs-container', { collapsed, neverEnabled })}
        {...neverEnabled && { onClick: () => state.tabs.toggleEnabled(true) }}
      >
        <Tabs
          ref={state.ref('tabs')}
          id="viewer-tabs"
          initEnabled={false}
          onHardReset={state.onHardReset}
          onModelChange={state.onModelChange}
          onToggleTab={state.onToggleTab}
          onToggled={update}
          onReset={state.onTabsReset}
          persistLayout
          updates={tabs.tabsetVersion}
          rootOrientationVertical
          tabset={tabs.tabset}
        />
      </div>
    </aside>
  );
}
export interface State {
  rootEl: HTMLElement;
  /** Tabs API */
  tabs: TabsState;
  animateInternalApiSpinner(): void;
  onChangeIntersect(intersects: boolean): void;
  onHardReset(): void;
  /** @param pathname e.g. `/internal/set-tabset/empty` */
  onInternalApi(pathname: `/internal/${string}`): void;
  onKeyDown(e: React.KeyboardEvent): void;
  onModelChange(updateLayout: boolean): void;
  onTabsReset(): void;
  onToggleTab(tabState: TabState): void;
  update(): void;
}

const viewerCss = css`
  ${css`
    ${viewerCssVar.barSize}: ${view.barSize};
    ${viewerCssVar.iconSize}: ${view.iconSize};
    ${viewerCssVar.internalApiSpinnerOpacity}: 0;
  `}

  // if never drag or maximise, toggle acts like this
  ${viewerCssVar.base}: 50%;

  position: relative;
  display: flex;

  cursor: pointer;
  color: white;
  background: black;
  -webkit-tap-highlight-color: transparent;

  @media (min-width: ${afterBreakpoint}) {
    flex-direction: row;
    transition: min-width 500ms;
    min-width: var(${viewerCssVar.base});
    &.collapsed {
      min-width: 0%;
    }
  }

  @media (max-width: ${breakpoint}) {
    flex-direction: column;
    transition: height 500ms ease-in-out, min-height 500ms ease-in-out;
    height: calc( max(var(${viewerCssVar.base}, 0px), ${view.barSize}) );
    min-height: calc( max(var(${viewerCssVar.base}, 0px), ${view.barSize}) );
    &.collapsed {
      height: ${view.barSize};
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
    cursor: pointer;

    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 0.5; }
    }
    animation: fadeIn 2s forwards;
    
    background-image: url(/images/desktop-empty-world__20250612.webp);
    background-size: 100%;
    background-repeat: no-repeat;
    background-position: 0% 50%;
    
    filter: grayscale();
  }
`;
