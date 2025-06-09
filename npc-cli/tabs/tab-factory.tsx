import React from "react";
import loadable from "@loadable/component";
import type { IJsonRowNode, IJsonTabNode, TabNode } from "flexlayout-react";

import type ActualTerminal from "../terminal/TtyWithFunctions";
import type { State as TabsApi } from "./Tabs";
import { TabMemo } from "./Tab";
import { CentredSpinner } from "../components/Spinner";

export function factory(node: TabNode, api: TabsApi, forceUpdate: boolean) {
  const state = api.tabsState[node.getId()];
  if (state?.everUncovered) {
    // console.debug(`rendering "${node.getId()}"`, state.disabled);
    return React.createElement(TabMemo, {
      def: node.getConfig() as TabDef,
      api,
      state,
      disabled: state.disabled, // For memo
      forceUpdate, // For memo
    });
  } else {
    return null;
  }
}

export type TabsetLayout = IJsonRowNode;

export type TabDef = { weight?: number } & (
  | ({
      type: "component";
      /** Determines tab */
      filepath: Key.TabId;
      /** Determines component */
      class: ComponentClassKey;
    } & TabMetaProps)
  | {
      type: "terminal";
      /** Session identifier (determines tab) */
      filepath: Extract<Key.TabId, `tty-${number}`>;
      profileKey: Key.Profile;
      env?: Record<string, any>;
    }
);

export type ManageTabDef = Extract<TabDef, TabMetaPropsGeneric<"Manage">>;
export type TtyTabDef = Extract<TabDef, { type: "terminal" }>;
export type WorldTabDef = Extract<TabDef, TabMetaPropsGeneric<"World">>;

export interface TabsBaseProps {
  /** Required e.g. as identifier */
  id: string;
  /** List of rows each with a single tabset */
  tabset: TabsetLayout;
  /** Initially enabled? */
  initEnabled?: boolean;
  persistLayout?: boolean;
}

const classToComponent = {
  Debug: loadableComponentFactory(() => import("../components/Debug")),
  HelloWorld: loadableComponentFactory(() => import("../components/HelloWorld")),
  Manage: loadableComponentFactory(() => import("../components/Manage")),
  World: loadableComponentFactory(() => import("../world/World")),
};

function loadableComponentFactory<T extends () => Promise<any>>(input: T) {
  return {
    loadable: loadable(input),
    get:(module: Awaited<ReturnType<T>>) =>
      (props: React.ComponentProps<(typeof module)["default"]>) =>
        React.createElement(module.default, { disabled: true, ...props }),
  };
}

export async function getComponent(componentClassKey: ComponentClassKey, errorIdentifier?: string) {
  return (
    classToComponent[componentClassKey]?.get(
      (await classToComponent[componentClassKey].loadable.load()) as any
    ) ?? FallbackComponentFactory(errorIdentifier ?? componentClassKey)
  );
}

/** Components we can instantiate inside a tab */
export type ComponentClassKey = keyof typeof classToComponent;

type TabMetaProps = TabMetaPropsDistributed<ComponentClassKey>;

type TabMetaPropsDistributed<K extends ComponentClassKey> = K extends infer A
  ? A extends ComponentClassKey
    ? TabMetaPropsGeneric<A>
    : never
  : never;

type TabMetaPropsGeneric<K extends ComponentClassKey> = {
  class: K;
  props: Omit<ComponentClassKeyToProps[K], 'setTabsEnabled'>;
};

type ComponentClassKeyToProps = {
  [K in ComponentClassKey]: Parameters<ReturnType<(typeof classToComponent)[K]["get"]>>[0];
};

export interface BaseTabProps {
  /**
   * A Tab is disabled if either:
   * - Tabs disabled (all tabs disabled) 
   * - Tab is hidden (behind another tab).
   * 
   * In the future we may permit disabling a visible Tab whilst Tabs enabled.
   */
  disabled?: boolean;
  /**
   * For example, can enable all tabs:
   * - onclick anywhere in a single tab (World)
   * - onclick a link (Tty)
   */
  setTabsEnabled(next: boolean): void;
}

function FallbackComponentFactory(componentKey: string) {
  return () =>
    React.createElement(
      "div",
      { style: { color: "white", padding: "0 8px", fontSize: 20 } },
      `Component "${componentKey}" not found`
    );
}

export const Terminal = loadable(() => import("../terminal/TtyWithFunctions"), {
  ssr: false,
  fallback: <CentredSpinner size={32} />,
}) as typeof ActualTerminal;

export type CustomIJsonTabNode = Omit<IJsonTabNode, 'config'> & { config: TabDef };
