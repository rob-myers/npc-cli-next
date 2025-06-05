import React from "react";
import cx from "classnames";
import { css } from "@emotion/react";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import useSite from "./site.store";
import { afterBreakpoint, breakpoint, nav, view, viewBarSizeCssVar, viewerBaseCssVar, viewIconSizeCssVar, zIndexSite } from "./const";
import { getNavWidth, isSmallView } from "./layout";
import { isTouchDevice } from "@/npc-cli/service/dom";
import { tryLocalStorageSet } from "@/npc-cli/service/generic";
import { localStorageKey } from "@/npc-cli/service/const";

import useLongPress from "@/npc-cli/hooks/use-long-press";
import useUpdate from "@/npc-cli/hooks/use-update";
import useStateRef from "@/npc-cli/hooks/use-state-ref";
import { type State } from "./Viewer";
import {
  FontAwesomeIcon,
  faRefreshThin,
  faExpandThin,
  faCirclePauseThin,
  faChevronRight,
  faGrip,
  faCirclePlay,
} from "./Icon";

export default function ViewerControls({ api }: Props) {
  const site = useSite(({ viewOpen }) => ({ viewOpen }), shallow);

  const state = useStateRef(() => ({
    dragOffset: null as null | number,
    showReset: false,

    getViewerBase() {
      const percentage = api.rootEl.style.getPropertyValue(viewerBaseCssVar);
      return percentage === null ? null : parseFloat(percentage);
    },
    onLongReset() {
      api.tabs.hardReset();
      state.showReset = false;
      update();
    },
    onMaximize() {
      state.setViewerBase(100);
      useSite.api.toggleView(true);
    },
    onDrag(e: PointerEvent) {
      if (state.dragOffset === null) {
        return;
      }
      if (isSmallView() === true) {
        // try fix mobile edge via visualViewport
        // const height = window.visualViewport?.height ?? window.innerHeight;
        const height = window.innerHeight;
        const percent = (100 * (height - (e.clientY + state.dragOffset))) / height;
        state.setViewerBase(percent);
      } else {
        const percent = (100 * (window.innerWidth - (e.clientX + state.dragOffset))) / (window.innerWidth - getNavWidth());
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
    onPreReset() {
      state.showReset = true;
      setTimeout(() => (state.showReset = false, update()), 3000);
      update();
    },
    onReset: debounce(() => {
      api.tabs.reset();
      state.showReset = false;
      update();
    }, 300),
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
    toggleEnabled() {
      api.tabs.toggleEnabled();
      update();
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
        className="top-level"
      >
        <FontAwesomeIcon icon={api.tabs.enabled ? faCirclePauseThin : faCirclePlay} size="1x" />
      </button>

      <div className="reset-container">
        <button
          className="top-level"
          title="reset tabs"
          onClick={state.onPreReset}
          disabled={api.tabs.everEnabled === false}
        >
          <FontAwesomeIcon icon={faRefreshThin} size="1x" />
        </button>
        <button
          className={cx("confirm-reset", { show: state.showReset })}
          {...resetHandlers}
        >
          reset
        </button>
      </div>

      <button
        className="top-level"
        title="maximise tabs"
        onClick={state.onMaximize}
        >
        <FontAwesomeIcon icon={faExpandThin} size="1x" />
      </button>

      <button
        className="top-level"
        title={site.viewOpen ? "hide tabs" : "show tabs"}
        onClick={() => state.toggleCollapsed()}
      >
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

const buttonsCss = css`
  z-index: ${zIndexSite.aboveViewerFocusOutline};

  display: flex;
  justify-content: right;
  align-items: center;

  background-color: #000;
  touch-action: none;
  border-top: 1px solid #333;

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
  button.top-level {
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
  > button:last-child {
    @media (min-width: ${afterBreakpoint}) {
      height: ${view.barSize};
      height: 4rem;
    }
    @media (max-width: ${breakpoint}) {
      transform: rotate(90deg);
      margin-right: 0.5rem;
    }
  }
  
  .reset-container {
    position: relative;
  }

  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes fadeOut {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }

  .confirm-reset {
    position: absolute;
    top: 1px;
    left: 1px;
    width: calc(100% - 2px);
    height: calc(100% - 2px);
    font-size: small;
    color: rgba(255, 150, 150, 1);
    background-color: rgba(0, 0, 0, 1);
    user-select: none;

    transition: opacity 300ms;
    opacity: 0;
    pointer-events: none;
    
    &.show {
      opacity: 1;
      pointer-events: all;
    }
  }
`;
