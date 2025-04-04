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
import ViewerControls from "./ViewerControls";
import Spinner from "@/npc-cli/components/Spinner";

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
    percentStr !== null && state.rootEl.style.setProperty("--viewer-base", percentStr);
  }, []);

  const update = useUpdate();

  const collapsed = !site.viewOpen;

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
        className={cx({ collapsed })}
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

        {state.tabs.everEnabled === false && (
          <button
            css={interactButtonCss}
            className={cx({ collapsed })}
            onPointerDown={() => state.tabs.toggleEnabled(true)}
          >
            <div>
              {site.browserLoaded ? "interact" : <Spinner size={24} />}
            </div>
          </button>
        )}

      </div>
    </aside>
  );
}

export interface State {
  onChangeIntersect(intersects: boolean): void;
  onKeyDown(e: React.KeyboardEvent): void;
  rootEl: HTMLElement;
  /** Tabs API */
  tabs: TabsState;
}

const viewerCss = css`
  // ViewerControls
  --view-bar-size: ${view.barSize};
  --view-icon-size: ${view.iconSize};
  
  // if never drag or maximise, toggle acts like this
  --viewer-base: 50%;
  &.collapsed {
    --viewer-base: 0%;
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
    min-width: var(--viewer-base);
    &.collapsed {
      min-width: 0%;
    }
  }

  @media (max-width: ${breakpoint}) {
    flex-direction: column;
    transition: min-height 500ms;
    min-height: var(--viewer-base);
    &.collapsed {
      min-height: 0%;
    }
  }
`;

const tabsContainerCss = css`
  height: 100%;

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
`;

const interactButtonCss = css`
  position: absolute;
  display: flex;
  &.collapsed {
    display: none;
  }

  justify-content: center;
  align-items: center;

  user-select: none;

  @media (min-width: ${afterBreakpoint}) {
    left: var(--view-bar-size);
    top: 0;
    width: calc(100% - var(--view-bar-size));
    height: 100%;
  }
  @media (max-width: ${breakpoint}) {
    left: 0;
    top: calc(var(--view-bar-size) + 32px + 4px);
    width: 100%;
    height: calc(100% - 2 * var(--view-bar-size));
  }

  > div {
    letter-spacing: 2px;
    pointer-events: all;
    
    cursor: pointer;
    font-size: 1rem;
    color: white;
  }
`;
