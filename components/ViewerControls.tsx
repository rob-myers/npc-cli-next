import React from "react";
import cx from "classnames";
import { css } from "@emotion/react";
import { shallow } from "zustand/shallow";
import debounce from "debounce";

import useSite from "./site.store";
import { afterBreakpoint, breakpoint, nav, view, viewerCssVar, zIndexSite } from "./const";
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
} from "../npc-cli/components/Icon";
import Spinner from "@/npc-cli/components/Spinner";

export default function ViewerControls({ api }: Props) {
  const site = useSite(({ navOpen, viewOpen }) => ({ navOpen, viewOpen }), shallow);

  const state = useStateRef(() => ({
    dragOffset: null as null | number,
    showReset: false,

    getViewerBase() {
      const percentage = api.rootEl.style.getPropertyValue(viewerCssVar.base);
      return percentage === '' ? null : parseFloat(percentage);
    },
    onClickChevron(longPress = false) {
      const percentage = state.getViewerBase();
      if (percentage === null) {
        state.setVisibility('open'); // initial?
      } else if (longPress === false && percentage > 50) {
        state.setVisibility('midpoint');
      } else if (percentage === 0) {
        state.setViewerBase(longPress ? 75 : 50);
        state.setVisibility('open');
      } else {
        state.setVisibility('closed');
      }
    },
    onClickEnabledOrPause() {
      api.tabs.toggleEnabled();
      update();
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

        const percent = parseFloat(api.rootEl.style.getPropertyValue(viewerCssVar.base));
        if (percent < 10) {// almost closed anyway
          state.setVisibility('closed');
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
        api.rootEl.style.setProperty(viewerCssVar.base, `${0}%`);
        useSite.api.toggleView(true);
      }
    },
    onLongReset() {
      api.tabs.hardReset();
      state.showReset = false;
      update();
    },
    onClickMaximize() {
      state.setViewerBase(100);
      useSite.api.toggleView(true);
    },
    onClickReset() {// pre reset i.e. show actual reset button
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
      api.rootEl.style.setProperty(viewerCssVar.base, `${percentage}%`);
      tryLocalStorageSet(localStorageKey.viewerBasePercentage, `${percentage}%`);
    },
    setVisibility(act: 'closed' | 'midpoint' | 'open') {
      switch (act) {
        case 'midpoint':
          state.setViewerBase(50);
          state.setVisibility('open');
          break;
        case 'closed':
          state.dragOffset = null;
          useSite.api.toggleView(false);
          api.tabs.toggleEnabled(false);
          state.setViewerBase(0);
          break;
        case 'open':
          state.dragOffset = null;
          useSite.api.toggleView(true);
          isSmallView() && useSite.api.toggleNav(false);
          break;
      }
    },
  }));

  const resetHandlers = useLongPress({
    onLongPress: state.onLongReset,
    onClick: state.onReset,
    ms: 1000,
  });

  const chevronHandlers = useLongPress({
    onLongPress: state.onClickChevron.bind(state, true),
    onClick: state.onClickChevron.bind(state, false),
    ms: 500,
  });

  const update = useUpdate();

  return (
    <div
      css={viewerControlsCss}
      className="viewer-buttons"
      onPointerDown={state.onDragStart}
      style={{
        zIndex: site.navOpen ? zIndexSite.belowMainFadeOverlay : zIndexSite.aboveMainFadeOverlay,
      }}
    >
      <div className="left-or-bottom-group">
        <div className="drag-indicator">
          <FontAwesomeIcon icon={faGrip} size="1x" />
        </div>
        <Spinner className="internal-api-spinner" size={18} color="#ff9" />
      </div>

      <div className="status-text">
        {api.tabs.everEnabled
          ? api.tabs.enabled ? 'active' : 'paused'
          : 'idle'}
      </div>

      <button
        title={api.tabs.enabled ? "pause tabs" : "enable tabs"}
        onClick={state.onClickEnabledOrPause}
        className="top-level"
      >
        <FontAwesomeIcon icon={api.tabs.enabled ? faCirclePauseThin : faCirclePlay} size="1x" />
      </button>

      <div className={cx("reset-container", { showReset: state.showReset })}>
        <button
          className="top-level"
          title="reset tabs"
          onClick={state.onClickReset}
          /* disabled={api.tabs.everEnabled === false} */
        >
          <FontAwesomeIcon icon={faRefreshThin} size="1x" />
        </button>
        <button
          className="confirm-reset"
          title="hold for hard reset"
          {...resetHandlers}
        >
          reset
        </button>
      </div>

      <button
        className="top-level"
        title="maximise tabs"
        onClick={state.onClickMaximize}
      >
        <FontAwesomeIcon icon={faExpandThin} size="1x" />
      </button>

      <button
        className="top-level"
        title={site.viewOpen === true ? "hide tabs" : "show tabs"}
        {...chevronHandlers}
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

const viewerControlsCss = css`
  display: flex;
  justify-content: right;
  align-items: center;

  background-color: #000;
  touch-action: none;
  border-top: 1px solid #555;

  > .status-text {    
    display: flex;
    justify-content: start;
    align-items: center;
    
    font-size: 0.9rem;
    font-family: monospace;
    color: #dda;
    letter-spacing: 2px;
    pointer-events: none;
    user-select: none;
  }

  .left-or-bottom-group {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;

    padding: 12px 16px;
    pointer-events: none;

    .drag-indicator {
      color: #666;
    }
    .internal-api-spinner {
      transition: opacity 500ms;
      opacity: var(${viewerCssVar.internalApiSpinnerOpacity});
    }
  }

  @media (min-width: ${afterBreakpoint}) {
    width: var(${viewerCssVar.barSize});
    height: 100%;
    flex-direction: column-reverse;

    cursor: col-resize;
    border-right: 1px solid #444;
    font-size: 1rem;

    > .status-text {
      writing-mode: vertical-rl;
      text-orientation: upright;
      padding-top: 32px;
    }
    .left-or-bottom-group {
      flex-direction: column-reverse;
      align-items: end;
    }
  }

  @media (max-width: ${breakpoint}) {
    height: ${view.barSize};
    flex-direction: row;

    cursor: row-resize;
    border-bottom: 1px solid #444;

    > .status-text {
      height: 100%;
      padding-right: 12px;
      margin-top: 2px;
      user-select: none;
    }
  }

  // each control is a button
  button.top-level {
    display: flex;
    justify-content: center;
    align-items: center;

    @media (min-width: ${afterBreakpoint}) {
      width: var(${viewerCssVar.barSize});
      height: ${nav.menuItem};
    }
    @media (max-width: ${breakpoint}) {
      width: var(${viewerCssVar.iconSize});
      height: var(${viewerCssVar.barSize});
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

    .top-level {
      transition: opacity 300ms;
      opacity: 1;
    }

    .confirm-reset {
      position: absolute;
      top: 1px;
      left: 1px;
      width: calc(100% - 2px);
      height: calc(100% - 2px);
      font-size: small;
      color: rgba(255, 150, 150, 1);
      user-select: none;
  
      transition: opacity 300ms, transform 1s;
      opacity: 0;
      pointer-events: none;
      &:active {
        transform: scale(1.4);
      }
    }

    &.showReset {
      .top-level {
        opacity: 0;
        pointer-events: none;
      }
      .confirm-reset {
        opacity: 1;
        pointer-events: all;
      }
    }

  }
`;
