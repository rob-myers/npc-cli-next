import React from "react";
import { Action, Actions, Layout as FlexLayout, Model, type TabNode, type TabSetNode } from "flexlayout-react";
import debounce from "debounce";
import { css } from "@emotion/react";

import { detectTabPrevNextShortcut } from "../service/generic";
import { type TabDef, type TabsBaseProps, factory } from "./tab-factory";
import { computeJsonModel } from './tab-util';
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
        if (state.model.getMaximizedTabset()) {
          // On minimise, enable justCovered tabs
          Object.values(state.tabsState).forEach((x) => {
            x.justCovered && state.enabled && (x.disabled = false);
            x.everUncovered = true;
            x.justCovered = false;
          });
          update();
        } else {
          // On maximise, disable hidden non-terminal tabs
          const maxIds = (state.model.getNodeById(act.data.node) as TabSetNode)
            .getChildren()
            .map((x) => x.getId());
          state.model.visitNodes((node) => {
            const id = node.getId();
            const meta = state.tabsState[id];
            if (node.getType() === "tab" && !maxIds.includes(id) && meta?.type === "component") {
              !meta.disabled && (meta.justCovered = true);
              meta.disabled = true;
            }
            update();
          });
        }
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
    reset(remember = true) {
      state.tabsState = {};
      if (!state.enabled) {
        state.everEnabled = false;
      }
      if (remember) {// Save and sync current
        props.onModelChange?.(true);
      }
      state.resets++; // Remount
      update();
    },
    toggleEnabled(next) {
      const prev = state.enabled;
      // toggle if `next` undefined, else set
      next ??= !prev;

      if (prev === next) {
        return;
      }

      state.everEnabled ||= next;
      state.enabled = next;

      if (next) {
        const prevFocused = state.prevFocused;
        state.prevFocused = null;
        // setTimeout prevents enter propagating to Terminal
        setTimeout(() => (prevFocused || state.rootEl).focus());
      } else {
        state.prevFocused = document.activeElement as HTMLElement | null;
        state.rootEl.focus();
      }

      // Toggle all tabs
      state.toggleTabsDisabled(next);
      update();

      props.onToggled?.(next);
    },
    toggleTabsDisabled(next) {
      const { tabsState } = state;
      for (const key of Object.keys(tabsState)) {
        tabsState[key].disabled = !next 
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
      computeJsonModel(props.tabset, props.rootOrientationVertical)
    );

    // Enable and disable tabs relative to visibility
    output.visitNodes((node) => {
      if (node.getType() !== "tab") {
        return;
      }

      node.setEventListener("visibility", async ({ visible }) => {
        const [key, tabDef] = [node.getId(), (node as TabNode).getConfig() as TabDef];
        // console.log('visibility', key, visible);
        state.tabsState[key] ??= {
          key,
          type: tabDef.type,
          disabled: !state.enabled,
          everUncovered: false,
          justCovered: false,
        };

        if (visible) {
          state.tabsState[key].disabled = !state.enabled;
          const maxNode = state.model.getMaximizedTabset()?.getSelectedNode();
          state.tabsState[key].everUncovered ||= maxNode ? node === maxNode : true;
          setTimeout(update); // 🔔 Cannot update a component (`Tabs`) while rendering a different component (`Layout`)
        }
        
        if (!visible && tabDef.type === "component") {
          // - invisible tabs of type "component" get disabled in background
          // - tabs of type "terminal" stay enabled in background
          state.tabsState[key].disabled = true;
          setTimeout(update);
        }
      });
    });

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
  /** Invoked onchange state.enabled */
  onToggled?(next: boolean): void;
  onModelChange?(syncCurrent: boolean): void;
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
  reset(remember?: boolean): void;
  toggleEnabled(next?: boolean): void;
  toggleTabsDisabled(next: boolean): void;
  /** Returns true iff hash changed */
  updateHash(nextHash: string): boolean;
}

export interface TabState {
  /** Tab identifier */
  key: string;
  type: TabDef["type"];
  disabled: boolean;
  /**
   * `true` iff this tab's contents has ever been visible,
   * in which case we should have mounted the respective component.
   */
  everUncovered: boolean;
  /** `true` iff was just covered by a maximised tab */
  justCovered: boolean;
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

