import React from "react";
import loadable from "@loadable/component";
import type { IJsonRowNode, IJsonTabNode, TabNode } from "flexlayout-react";

import type { ProfileKey } from "../sh/src";
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
      filepath: string;
      /** Determines component */
      class: ComponentClassKey;
    } & TabMetaProps)
  | {
      type: "terminal";
      /** Session identifier (determines tab) */
      filepath: string;
      profileKey: ProfileKey;
      env?: Record<string, any>;
    }
);

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
  HelloWorld: {
    loadable: loadable(() => import("../components/HelloWorld")),
    get:
      (module: typeof import("../components/HelloWorld")) =>
      (props: React.ComponentProps<(typeof module)["default"]>) =>
        React.createElement(module.default, { disabled: true, ...props }),
  },
  World: {
    loadable: loadable(() => import("../world/World"), {
      // fallback: <CentredSpinner style={{ position: 'absolute', top: 0 }} />,
    }),
    get:
      (module: typeof import("../world/World")) =>
      (props: React.ComponentProps<(typeof module)["default"]>) =>
        React.createElement(module.default, { disabled: true, ...props }),
  },
};

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
   * Is this Tab disabled?
   * Either
   * - every tab is disabled
   * - every tab is enabled (except background component tabs)
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
