import React from "react";

import { TABS_API_KEY } from "../service/const";
import type { TabState, State as TabsApi } from "./Tabs";
import { TabDef, getComponent, Terminal, BaseTabProps } from "./tab-factory";
import useUpdate from "../hooks/use-update";
import useStateRef from "../hooks/use-state-ref";

export function Tab({ def, api: tabs, state: tabState }: TabProps) {

  const state = useStateRef(() => ({
    component: null as Awaited<ReturnType<typeof getComponent>> | null,
    onTerminalKey(e: KeyboardEvent) {
      if (tabs.enabled === true) {
        if (e.key === 'Escape') tabs.toggleEnabled(false);
      } else {
        // 🔔 assume "Shift + Enter" prevented from propagating to tty
        if (e.shiftKey && e.key === 'Enter') tabs.toggleEnabled(true);
      }
      // 🔔 cannot enable Tabs on 'Enter' because we permit
      // using the terminal whilst !api.enabled (debug mode)
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
        setTabsEnabled: state.setTabsEnabled,
        ...def.props,
      }) || null;
  }

  if (def.type === "terminal") {
    return (
      <Terminal
        disabled={tabState.disabled}
        env={{ ...def.env, CACHE_SHORTCUTS: {
          w: "WORLD_KEY",
          tabs: TABS_API_KEY,
        }}}
        onKey={state.onTerminalKey}
        profileKey={def.profileKey}
        sessionKey={def.filepath}
        setTabsEnabled={state.setTabsEnabled}
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
