import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import { view } from "./const";
import { afterBreakpoint, breakpoint } from "./const";
import useSite from "./site.store";

import { tryLocalStorageGet } from "@/npc-cli/service/generic";
import { localStorageKey } from "@/npc-cli/service/const";
import { profile } from "@/npc-cli/sh/src";
import useIntersection from "@/npc-cli/hooks/use-intersection";
import useStateRef from "@/npc-cli/hooks/use-state-ref";
import useUpdate from "@/npc-cli/hooks/use-update";
import { Tabs, State as TabsState } from "@/npc-cli/tabs/Tabs";
import ViewerControls, { viewBarSizeCssVar, viewIconSizeCssVar } from "./ViewerControls";

export default function Viewer() {
  const site = useSite(({
    browserLoaded,
    tabsDefs,
    viewOpen,
  }) => ({
    browserLoaded,
    tabsDefs,
    viewOpen,
  }), shallow);

  const update = useUpdate();

  const state = useStateRef<State>(() => ({
    rootEl: null as any,
    tabs: {} as TabsState,
    onChangeIntersect: debounce((intersects: boolean) => {
      !intersects && state.tabs?.enabled && state.tabs.toggleEnabled();
      update();
    }, 1000),
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

    // 🚧 initialize Tabs
    // 🔔 presence of `profile` triggers full fast-refresh
    useSite.api.setTabsDefs([[
      {
        type: "component",
        class: "World",
        filepath: "test-world-1",
        // props: { worldKey: "test-world-1", mapKey: "small-map-1" },
        props: { worldKey: "test-world-1", mapKey: "demo-map-1" },
      },
    ],
    [
      {
        type: "terminal",
        filepath: "tty-1",
        env: { WORLD_KEY: "test-world-1", PROFILE: profile.profile1Sh },
      },
      {
        type: "terminal",
        filepath: "tty-2",
        env: { WORLD_KEY: "test-world-1", PROFILE: profile.profileAwaitWorldSh },
      },
      { type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} },
    ]]);

    // remember Viewer percentage
    const percentStr = tryLocalStorageGet(localStorageKey.viewerBasePercentage);
    percentStr !== null && state.rootEl.style.setProperty(viewerBaseCssVar, percentStr);
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
          browserLoaded={site.browserLoaded}
          initEnabled={false}
          onToggled={update}
          persistLayout
          rootOrientationVertical
          tabs={site.tabsDefs}
        />
      </div>
    </aside>
  );
}

export interface State {
  rootEl: HTMLElement;
  /** Tabs API */
  tabs: TabsState;
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
  &.collapsed {
    ${viewerBaseCssVar}: 0%;
  }

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
    transition: min-height 500ms;
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
    cursor: pointer;
    background-image: url(/images/localhost_3000_blog_index.png.webp);
    background-size: 60%;
    background-repeat: no-repeat;
    background-position: 50% 50%;
    filter: sepia() hue-rotate(180deg) brightness(2) invert();
    opacity: 0.5;
  }
`;
