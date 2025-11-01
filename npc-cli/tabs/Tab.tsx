import React from "react";

import type { TabState, State as TabsApi } from "./Tabs";
import { TabDef, getComponent, Terminal, BaseTabProps } from "./tab-factory";
import useTabs from "./tabs.store";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";

export function Tab({ def, api: tabs, state: tabState }: TabProps) {

  const state = useStateRef(() => ({
    component: null as Awaited<ReturnType<typeof getComponent>> | null,
    onTerminalKey(e: KeyboardEvent) {
      if (tabs.enabled === true) {
        if (e.key === 'Escape') {
          tabs.toggleEnabled(false);
        }
      } else {
        if (e.key === 'Enter' && (e.shiftKey === true || e.ctrlKey === true)) {
          tabs.toggleEnabled(true);
        }
      }
    },
    setTabsEnabled(next: boolean) {
      tabs.toggleEnabled(next);
    },
  }));

  const update = useUpdate();

  React.useEffect(() => {
    def.type === "component" &&
      getComponent(def.class, def.filepath).then((component) => {
        state.component ??= component;
        update();
      });
  }, []);

  if (def.type === "component") {
    return state.component !== null &&
      React.createElement(state.component as unknown as React.FunctionComponent<BaseTabProps>, {
        disabled: tabState.disabled,
        tabKey: def.filepath,
        setTabsEnabled: state.setTabsEnabled,
        updateTabMeta: useTabs.api.updateTabMeta,
        ...def.props,
      }) || null;
  }

  if (def.type === "terminal") {
    return (
      <Terminal
        disabled={tabState.disabled}
        // 🚧 literal "WORLD_KEY" and "TABS_API_KEY" should be constants
        env={{ ...def.env, CACHE_SHORTCUTS: {
          w: "WORLD_KEY",
          tabs: "TABS_API_KEY",
        }}}
        tabKey={def.filepath}
        onKey={state.onTerminalKey}
        profileKey={def.profileKey}
        sessionKey={def.filepath}
        setTabsEnabled={state.setTabsEnabled}
        updateTabMeta={useTabs.api.updateTabMeta}
      />
    );
  }

  return (
    <div style={{ background: "white", color: "red" }}>
      TabMeta "{JSON.stringify(def)}" has unexpected type
    </div>
  );
}

interface TabProps {
  def: TabDef;
  api: TabsApi;
  state: TabState;
  disabled: boolean;
  forceUpdate: boolean;
}

export const TabMemo = React.memo(
  Tab,
  (prev, next) => prev.disabled === next.disabled && !next.forceUpdate
);
