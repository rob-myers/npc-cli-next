import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { tryLocalStorageGet, tryLocalStorageSet } from "../service/generic";
import { localStorageKey, zIndexTabs } from "../service/const";
import type { Session } from "../sh/session.store";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

export default function TtyMenu(props: Props) {
  const update = useUpdate();

  const state = useStateRef(() => ({
    xterm: props.session.ttyShell.xterm,
    touchMenuOpen: true,

    async onClickMenu(e: React.MouseEvent) {
      const target = e.target as HTMLElement;
      state.xterm.xterm.scrollToBottom();
      if (target.classList.contains("paste")) {
        try {
          const textToPaste = await navigator.clipboard.readText();
          state.xterm.spliceInput(textToPaste);
        } catch {}
      } else if (target.classList.contains("can-type")) {
        const next = !state.xterm.canType();
        state.xterm.setCanType(next);
        tryLocalStorageSet(localStorageKey.touchTtyCanType, `${next}`);
        next && state.xterm.warnIfNotReady();
        update();
      } else if (target.classList.contains("ctrl-c")) {
        state.xterm.sendSigKill();
      } else if (target.classList.contains("enter")) {
        if (!state.xterm.warnIfNotReady()) {
          // avoid sending 'newline' whilst 'await-prompt'
          state.xterm.queueCommands([{ key: "newline" }]);
        }
      } else if (target.classList.contains("delete")) {
        state.xterm.deletePreviousWord();
      } else if (target.classList.contains("clear")) {
        state.xterm.clearScreen();
      } else if (target.classList.contains("up")) {
        state.xterm.reqHistoryLine(+1);
      } else if (target.classList.contains("down")) {
        state.xterm.reqHistoryLine(-1);
      }
      // xterm.xterm.focus();
    },
    toggleTouchMenu() {
      const next = !state.touchMenuOpen;
      state.touchMenuOpen = next;
      tryLocalStorageSet(localStorageKey.touchTtyOpen, `${next}`);
      update();
    },
  }));

  state.xterm = props.session.ttyShell.xterm;

  React.useMemo(() => {
    if (!tryLocalStorageGet(localStorageKey.touchTtyCanType)) {
      // tty enabled by default (including touch devices)
      tryLocalStorageSet(localStorageKey.touchTtyCanType, "true");
    }
    if (!tryLocalStorageGet(localStorageKey.touchTtyOpen)) {
      // touch menu closed by default
      tryLocalStorageSet(localStorageKey.touchTtyOpen, "false");
    }
    state.xterm.setCanType(tryLocalStorageGet(localStorageKey.touchTtyCanType) === "true");
    state.touchMenuOpen = tryLocalStorageGet(localStorageKey.touchTtyOpen) === "true";
    return () => void state.xterm.setCanType(true);
  }, []);

  return <>
    <div
      css={menuCss}
      className={cx({ open: state.touchMenuOpen })}
      onClick={state.onClickMenu}
    >
      <div className="toggle-and-paused-controls">
        <div className="toggle" onClick={state.toggleTouchMenu}>
          {state.touchMenuOpen ? ">" : "<"}
        </div>
      </div>
      
      <div className="touch-menu">
        {/* <div
          className={cx("icon can-type", { enabled: state.xterm.canType() })}
          title={`text input ${state.xterm.canType() ? "enabled" : "disabled"}`}
        >
          $
        </div> */}
        <div className="icon paste" title="or press e.g. Cmd+V">
          paste
        </div>
        <div className="icon enter" title="or press Enter">
          enter
        </div>
        <div className="icon delete" title="or press Backspace">
          del
        </div>
        <div className="icon ctrl-c" title="or press Ctrl+C">
          kill
        </div>
        <div className="icon clear" title="or press Ctrl+L">
          clear
        </div>
        <div className="icon up" title="or press Up">
          prev
        </div>
        <div className="icon down" title="or press Down">
          next
        </div>
      </div>
    </div>
  </>;
}

interface Props {
  session: Session;
  disabled?: boolean;
  setTabsEnabled(next: boolean): void;
}

const menuCss = css`
  --menu-width: 54px;

  position: absolute;
  z-index: ${zIndexTabs.pausedControls};
  top: 0;
  right: 0;
  width: var(--menu-width);

  display: flex;
  flex-direction: column;

  line-height: 1; /** Needed for mobile viewing 'Desktop site' */
  background-color: rgba(0, 0, 0, 0.7);
  font-size: 8px;
  border: 1px solid #555;
  border-width: 1px 1px 1px 1px;
  color: white;

  transition: transform 500ms;
  &.open {
    transform: translate(0px, 0px);
    .toggle {
      background: rgba(0, 0, 0, 0.5);
    }
  }
  &:not(.open) {
    transform: translate(var(--menu-width), 0px);
  }

  .toggle-and-paused-controls {
    position: absolute;
    top: 0px;
    right: calc(var(--menu-width) - 1px);

    .toggle {
      width: 32px;
      height: 32px;
  
      display: flex;
      justify-content: center;
      align-items: center;
  
      cursor: pointer;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.5);
      color: #ddd;
      border: 2px solid #444;
    }
  }

  .icon {
    cursor: pointer;
    width: 100%;
    text-align: center;
    padding: 12px;
    transform: scale(1.2);
    color: #cfc;
  }

  .can-type {
    color: #0f0;
    &:not(.enabled) {
      color: #999;
    }
  }
`;
