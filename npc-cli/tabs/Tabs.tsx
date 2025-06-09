import React from "react";
import { Action, Actions, Layout as FlexLayout, Model, type TabNode, type TabSetNode } from "flexlayout-react";
import debounce from "debounce";
import { css } from "@emotion/react";

import { detectTabPrevNextShortcut } from "../service/generic";
import { type TabDef, type TabsBaseProps, factory } from "./tab-factory";
import { layoutToModelJson } from './tab-util';
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

export const Tabs = React.forwardRef<State, Props>(function Tabs(props, ref) {

  const state = useStateRef((): State => ({
    enabled: false,
    everEnabled: false,
    hash: "",
    model: {} as Model,
    prevFocused: null,
    resets: 0,
    rootEl: null as any,
    tabsState: {},

    focusRoot() {
      state.rootEl.focus();
    },
    hardReset() {
      props.onHardReset?.();
      state.reset(false);
    },
    onAction(act) {
      if (act.type === Actions.MAXIMIZE_TOGGLE) {
        if (state.model.getMaximizedTabset() !== undefined) {
          // We're minimising: enable just covered tabs
          Object.values(state.tabsState).forEach(tabState => {
            if (
              tabState.justCovered === true
              && state.enabled === true
              && tabState.disabled === true
            ) {
              tabState.disabled = false;
              props.onToggleTab?.(tabState);
            }
            tabState.everUncovered = true;
            tabState.justCovered = false;
          });
        } else {
          // We're maximising: 🔔 disable hidden non-terminal tabs
          const maxIds = (state.model.getNodeById(act.data.node) as TabSetNode)
            .getChildren()
            .map((x) => x.getId())
          ;

          state.model.visitNodes((node) => {
            const id = node.getId();
            const tabState = state.tabsState[id];
            if (
              tabState !== undefined
              && !maxIds.includes(id)
              && tabState.type === "component"
              && tabState.disabled === false
            ) {
              tabState.justCovered = true;
              tabState.disabled = true;
              props.onToggleTab?.(tabState);
            }
          });
        }
        update();
      }
      if (act.type === Actions.ADJUST_BORDER_SPLIT) {
        state.focusRoot();
      }
      if (act.type === Actions.SELECT_TAB) {
        state.focusRoot();
      }
      return act;
    },
    onKeyDown(e) {
      const tabDir = detectTabPrevNextShortcut(e);
      if (tabDir) {// cycle through current tabset
        e.stopPropagation();
        e.preventDefault();
        const tabset = state.model.getActiveTabset();
        const node = tabset?.getSelectedNode();
        if (tabset && node) {
          const children = tabset.getChildren();
          const numChildren = children.length;
          const currIndex = children.findIndex(x => x === node);
          const nextIndex = (currIndex + tabDir + numChildren) % numChildren;
          state.model.doAction(Actions.selectTab(children[nextIndex].getId()));
        }
      }
    },
    // 🔔 saw "Debounced method called with different contexts" for 300ms
    onModelChange: debounce((() => {
      props.onModelChange?.(false);
    }), 30),
    reset(rememberLayout = true) {
      state.tabsState = {};
      if (!state.enabled) {
        state.everEnabled = false;
      }
      if (rememberLayout === true) {// Save and sync current
        props.onModelChange?.(true);
      }
      // Remount
      state.resets++;
      update();

      props.onReset?.();
    },
    toggleEnabled(nextEnabled = !state.enabled) {
      const prev = state.enabled;

      if (prev === nextEnabled) {
        return;
      }

      state.everEnabled ||= nextEnabled;
      state.enabled = nextEnabled;

      if (nextEnabled === true) {
        const prevFocused = state.prevFocused;
        state.prevFocused = null;
        // setTimeout prevents enter propagating to Terminal
        setTimeout(() => (prevFocused || state.rootEl).focus());
      } else {
        state.prevFocused = document.activeElement as HTMLElement | null;
        state.rootEl.focus();
      }

      // Toggle all tabs
      state.toggleTabsDisabled(!nextEnabled);
      update();

      props.onToggled?.(nextEnabled);
    },
    toggleTabsDisabled(nextDisabled) {
      for (const tabState of Object.values(state.tabsState)) {
        if (nextDisabled === false && tabState.visible === false && tabState.type !== 'terminal') {
          continue; // do not set background non-tty tabs enabled
        }
        if (tabState.disabled !== nextDisabled) {
          tabState.disabled = nextDisabled;
          props.onToggleTab?.(tabState);
        }
      }
    },
    updateHash(nextHash) {
      const tabsDefChanged = state.hash !== nextHash;
      state.hash = nextHash;
      return tabsDefChanged;
    },
  }), { deps: [// 🔔 crucial deps
    props.onModelChange, 
    props.onHardReset, 
    props.onToggled
  ]});
  
  const tabsDefChanged = state.updateHash(JSON.stringify(props.tabset));

  state.model = React.useMemo(() => {
    
    const output = Model.fromJson(
      layoutToModelJson(props.tabset, props.rootOrientationVertical)
    );
    const seenTabIds = new Set<string>();

    // Enable and disable tabs relative to visibility
    output.visitNodes((node) => {
      if (node.getType() !== "tab") {
        return;
      }
      seenTabIds.add(node.getId());

      node.setEventListener("visibility", async ({ visible }) => {
        // console.log('visibility', key, visible);
        
        const [key, tabDef] = [node.getId() as Key.TabId, (node as TabNode).getConfig() as TabDef];
        const prevDisabled = key in state.tabsState ? state.tabsState[key].disabled : undefined;
        const tabState = state.tabsState[key] ??= {
          key,
          type: tabDef.type,
          disabled: !state.enabled,
          everUncovered: false,
          justCovered: false,
          visible: false,
        };
        
        if (visible) {
          // 🔔 visible tab enabled iff Tabs is
          tabState.disabled = !state.enabled;
          const maxNode = state.model.getMaximizedTabset()?.getSelectedNode();
          tabState.everUncovered ||= maxNode ? node === maxNode : true;
          setTimeout(update); // 🔔 Cannot update a component (`Tabs`) while rendering a different component (`Layout`)
        }
        
        if (!visible && tabDef.type === "component") {
          // 🔔 invisible tabs of type "component" get disabled in background
          // 🔔 tabs of type "terminal" stay enabled in background (unless Tabs disabled)
          tabState.disabled = true;
          setTimeout(update);
        }

        tabState.visible = Boolean(visible);

        if (prevDisabled === undefined || prevDisabled !== tabState.disabled) {
          props.onToggleTab?.(tabState); // new or changed
        }
      });
    });

    // Restrict tabsState to extant tabs
    for (const tabId of Object.keys(state.tabsState)) {
      if (!seenTabIds.has(tabId)) {
        delete state.tabsState[tabId];
      }
    }

    return output;
  }, [tabsDefChanged, state.resets, props.updates]);

  React.useImperativeHandle(ref, () => state);

  const update = useUpdate();

  return (
    <figure
      key={state.resets}
      css={tabsCss}
      className="tabs"
      onKeyDown={state.onKeyDown}
      ref={state.ref('rootEl')}
      tabIndex={0}
    >
      {state.everEnabled === true && (
        <FlexLayout
          factory={(node) => factory(node, state, tabsDefChanged)}
          model={state.model}
          onModelChange={state.onModelChange}
          onAction={state.onAction}
          realtimeResize
        />
      )}
    </figure>
  );
});

export interface Props extends TabsBaseProps {
  /** A model update does not involve remounting */
  updates: number;
  rootOrientationVertical?: boolean;
  onHardReset?(): void;
  onModelChange?(syncCurrent: boolean): void;
  /**
   * Invoked onchange `tabState.disabled`, which can happen for many
   * reasons e.g. select other tab, maximize tab, disable Tabs.
   */
  onToggleTab?(tabState: TabState): void;
  /** Invoked onchange state.enabled */
  onToggled?(next: boolean): void;
  onReset?(): void;
}

export interface State {
  enabled: boolean;
  everEnabled: boolean;
  hash: string;
  prevFocused: null | HTMLElement;
  /** A reset involves remounting */
  resets: number;
  rootEl: HTMLElement;
  /** By tab identifier */
  tabsState: Record<string, TabState>;
  model: Model;
  focusRoot(): void;
  hardReset(): void;
  onAction(act: Action): Action | undefined;
  onKeyDown(e: React.KeyboardEvent): void;
  onModelChange(): void;
  reset(rememberLayout?: boolean): void;
  /** Toggle if argument undefined, else set */
  toggleEnabled(nextEnabled?: boolean): void;
  toggleTabsDisabled(next: boolean): void;
  /** Returns true iff hash changed */
  updateHash(nextHash: string): boolean;
}

export interface TabState {
  /** Tab identifier */
  key: Key.TabId;
  type: TabDef["type"];
  disabled: boolean;
  /**
   * `true` iff this tab's contents has ever been visible,
   * in which case we should have mounted the respective component.
   */
  everUncovered: boolean;
  /** `true` iff was just covered by a maximised tab */
  justCovered: boolean;
  visible: boolean;
}

const tabsCss = css`
  position: relative;
  width: 100%;
  height: 100%;

  .flexlayout__tabset_content {
    background-color: #000;
  }

  .flexlayout__tab {
    background-color: black;
    border-top: 3px solid #444;
    overflow: hidden;
  }
  .flexlayout__tabset_tabbar_outer {
    background: #222;
    border-bottom: 1px solid #555;
  }
  .flexlayout__tab_button--selected,
  .flexlayout__tab_button:hover {
    background: #444;
  }
  .flexlayout__tab_button_content {
    user-select: none;
    font-size: 0.7rem;
    font-family: sans-serif;
    font-weight: 300;
    color: #aaa;
  }
  .flexlayout__tab_button--selected .flexlayout__tab_button_content {
    color: #fff;
  }
  .flexlayout__tab_button:hover:not(.flexlayout__tab_button--selected)
    .flexlayout__tab_button_content {
    color: #ddd;
  }
  .flexlayout__splitter_vert,
  .flexlayout__splitter_horz {
    background: #827575;
  }
  .flexlayout__tab_toolbar_button {
    cursor: pointer;
    &:focus {
      outline: 2px solid #99f;
    }
  }
  .flexlayout__tab_toolbar_button-max svg {
    border: 1px solid white;
    path:nth-of-type(2) {
      fill: white;
    }
  }
  .flexlayout__tab_toolbar_button-max:hover {
    path:nth-of-type(2) {
      fill: black;
    }
  }
  .flexlayout__error_boundary_container {
    background-color: black;
    .flexlayout__error_boundary_content {
      color: red;
      font-size: 1.2rem;
    }
  }
`;
