import React from "react";
import cx from "classnames";
import { css } from "@emotion/react";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import useSite from "./site.store";
import { afterBreakpoint, breakpoint, nav, view, zIndexSite } from "./const";
import { getNavWidth, isSmallView } from "./layout";

import { type State, viewerBaseCssVar } from "./Viewer";
import {
  FontAwesomeIcon,
  faRefreshThin,
  faExpandThin,
  faCirclePauseThin,
  faChevronRight,
  faGrip,
  faCirclePlay,
} from "./Icon";

import { isTouchDevice } from "@/npc-cli/service/dom";
import useLongPress from "@/npc-cli/hooks/use-long-press";
import useUpdate from "@/npc-cli/hooks/use-update";
import useStateRef from "@/npc-cli/hooks/use-state-ref";
import { tryLocalStorageSet } from "@/npc-cli/service/generic";
import { localStorageKey } from "@/npc-cli/service/const";

export default function ViewerControls({ api }: Props) {
  const site = useSite(({ browserLoaded, viewOpen }) => ({ browserLoaded, viewOpen }), shallow);

  const state = useStateRef(() => ({
    onLongReset() {
      api.tabs.hardReset();
      api.update(); // show "interact"
    },
    onReset: debounce(() => {
      api.tabs.reset();
      api.update(); // show "interact"
    }, 300),
    toggleEnabled() {
      api.tabs.toggleEnabled();
      update();
    },
    onMaximize() {
      state.setViewerBase(100);
      useSite.api.toggleView(true);
    },
    dragOffset: null as null | number,
    onDragStart(e: React.PointerEvent) {
      // console.log("drag start");
      if (!(e.target as HTMLElement).matches(".viewer-buttons")) {
        return;
      }
      if (state.dragOffset !== null) {
        state.onDragEnd(e.nativeEvent);
        return;
      }

      state.dragOffset = isSmallView()
        ? api.rootEl.getBoundingClientRect().y - e.clientY
        : api.rootEl.getBoundingClientRect().x - e.clientX;

      document.documentElement.classList.add(
        isSmallView() ? "cursor-row-resize" : "cursor-col-resize"
      );
      // trigger main overlay (iframe can get in the way of body)
      useSite.setState({ draggingView: true });
      document.body.addEventListener("pointermove", state.onDrag);
      document.body.addEventListener("pointerup", state.onDragEnd);
      if (!isTouchDevice()) {
        document.body.addEventListener("pointerleave", state.onDragEnd);
      }
      api.rootEl.style.transition = `min-width 0s, min-height 0s`;

      if (useSite.api.isViewClosed()) {
        api.rootEl.style.setProperty(viewerBaseCssVar, `${0}%`);
        useSite.api.toggleView(true);
      }
    },
    onDrag(e: PointerEvent) {
      if (state.dragOffset !== null) {
        // // 🚧 fix drag when root-content is not full height e.g. mobile keyboard open
        // const h = document.getElementById('root-content')?.clientHeight ?? 0;
        let percent = isSmallView()
          // ? (100 * (h - (e.clientY + state.dragOffset))) / h
          ? (100 * (window.innerHeight - (e.clientY + state.dragOffset))) / window.innerHeight
          : (100 * (window.innerWidth - (e.clientX + state.dragOffset))) / (window.innerWidth - getNavWidth())
        ;
        state.setViewerBase(percent);
      }
    },
    onDragEnd(_e: PointerEvent) {
      if (state.dragOffset !== null) {
        // console.log("drag end");
        state.dragOffset = null;
        document.documentElement.classList.remove("cursor-col-resize");
        document.documentElement.classList.remove("cursor-row-resize");
        useSite.setState({ draggingView: false });
        document.body.removeEventListener("pointermove", state.onDrag);
        document.body.removeEventListener("pointerup", state.onDragEnd);
        document.body.removeEventListener("pointerleave", state.onDragEnd);
        api.rootEl.style.transition = "";

        const percent = parseFloat(api.rootEl.style.getPropertyValue(viewerBaseCssVar));
        if (percent < 10) {
          api.rootEl.style.setProperty(viewerBaseCssVar, `${50}%`);
          state.toggleCollapsed();
        }
      }
    },
    getViewerBase() {
      const percentage = api.rootEl.style.getPropertyValue(viewerBaseCssVar);
      return percentage === null ? null : parseFloat(percentage);
    },
    setViewerBase(percentage: number) {
      percentage = Math.max(0, Math.min(100, percentage));
      api.rootEl.style.setProperty(viewerBaseCssVar, `${percentage}%`);
      tryLocalStorageSet(localStorageKey.viewerBasePercentage, `${percentage}%`);
    },
    toggleCollapsed() {
      const percentage = state.getViewerBase();
      if (percentage !== null && percentage > 50) {// collapse half way
        state.setViewerBase(50);
      } else {// collapse or expand
        state.dragOffset = null;
        const willExpand = useSite.api.toggleView();
        if (!willExpand) {// will collapse
          api.tabs.toggleEnabled(false);
        }
        if (willExpand) {// will expand to last percentage (≤50)
          isSmallView() && useSite.api.toggleNav(false);
        }
      }

    },
  }));

  const resetHandlers = useLongPress({
    onLongPress: state.onLongReset,
    onClick: state.onReset,
    ms: 1000,
  });

  const update = useUpdate();

  return (
    <div
      css={buttonsCss}
      className="viewer-buttons"
      onPointerDown={state.onDragStart}
    >
      <div className="left-or-bottom-group">
        <div className="drag-indicator">
          <FontAwesomeIcon icon={faGrip} size="1x" />
        </div>
      </div>

      <div className={cx("paused-text", { paused: !api.tabs.enabled })}>
        paused
      </div>

      <button
        title={api.tabs.enabled ? "pause tabs" : "enable tabs"}
        onClick={state.toggleEnabled}
      >
        <FontAwesomeIcon icon={api.tabs.enabled ? faCirclePauseThin : faCirclePlay} size="1x" />
      </button>
      <button title="reset tabs" {...resetHandlers}>
        <FontAwesomeIcon icon={faRefreshThin} size="1x" />
      </button>
      <button title="max/min tabs" onClick={state.onMaximize}>
        <FontAwesomeIcon icon={faExpandThin} size="1x" />
      </button>
      <button onClick={() => state.toggleCollapsed()}>
        <FontAwesomeIcon
          icon={faChevronRight}
          size="1x"
          flip={!site.viewOpen ? "horizontal" : undefined}
        />
      </button>
    </div>
  );
}

interface Props {
  /** Viewer API */
  api: State;
}

export const viewBarSizeCssVar = '--view-bar-size';
export const viewIconSizeCssVar = '--view-icon-size';

const buttonsCss = css`
  z-index: ${zIndexSite.aboveViewerFocusOutline};

  display: flex;
  justify-content: right;
  align-items: center;

  background-color: #000;
  touch-action: none;

  > .paused-text {    
    display: flex;
    justify-content: start;
    align-items: center;
    
    font-size: 0.9rem;
    color: #dda;
    letter-spacing: 7px;
    pointer-events: none;
    user-select: none;
    
    transition: opacity 300ms;
    opacity: 0;
  }
  .paused-text.paused {
    opacity: 1;
  }

  @media (min-width: ${afterBreakpoint}) {
    width: var(${viewBarSizeCssVar});
    height: 100%;
    flex-direction: column-reverse;

    cursor: col-resize;
    border-right: 1px solid #444;
    font-size: 1rem;

    > .paused-text {
      writing-mode: vertical-rl;
      text-orientation: upright;
      padding-top: 32px;
    }
  }

  @media (max-width: ${breakpoint}) {
    height: ${view.barSize};
    flex-direction: row;

    cursor: row-resize;
    border-bottom: 1px solid #444;

    > .paused-text {
      height: 100%;
      padding-right: 12px;
      margin-top: 2px;
    }
  }

  .left-or-bottom-group {
    flex: 1;
    display: flex;
    align-items: end;

    padding: 12px 16px;
    pointer-events: none;

    .drag-indicator {
      color: #666;
    }
  }

  // each control is a button
  button {
    display: flex;
    justify-content: center;
    align-items: center;

    @media (min-width: ${afterBreakpoint}) {
      width: var(${viewBarSizeCssVar});
      height: ${nav.menuItem};
    }
    @media (max-width: ${breakpoint}) {
      width: var(${viewIconSizeCssVar});
      height: var(${viewBarSizeCssVar});
    }

    color: white;
    cursor: pointer;
    &:disabled {
      cursor: auto;
      color: #888;
    }
  }

  // toggle Viewer
  button:last-child {
    @media (min-width: ${afterBreakpoint}) {
      height: ${view.barSize};
      height: 4rem;
    }
    @media (max-width: ${breakpoint}) {
      transform: rotate(90deg);
      margin-right: 0.5rem;
    }
  }
`;
