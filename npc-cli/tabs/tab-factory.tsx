import React from "react";
import loadable from "@loadable/component";
import { type IJsonModel, type IJsonRowNode, IJsonTabNode, Model, TabNode } from "flexlayout-react";

import type ActualTerminal from "../terminal/TtyWithFunctions";
import {
  deepClone,
  tryLocalStorageGet,
  tryLocalStorageRemove,
  tryLocalStorageSet,
  warn,
} from "../service/generic";
import { CentredSpinner } from "../components/Spinner";
import { Props as TabsProps, State as TabsApi } from "./Tabs";
import { TabMemo } from "./Tab";
import { isTouchDevice } from "../service/dom";

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

export interface TabsetLayout {
  key: string;
  layout: IJsonRowNode;
}

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

/** Same as `node.getId()` ? */
function getTabIdentifier(meta: TabDef) {
  return meta.filepath;
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

//#region persist

export function clearModelFromStorage(id: string) {
  tryLocalStorageRemove(`model@${id}`);
}

export function createOrRestoreJsonModel(props: TabsProps) {
  const jsonModelString = tryLocalStorageGet(`model@${props.id}`);

  if (props.persistLayout && jsonModelString) {
    try {
      const serializable = JSON.parse(jsonModelString) as IJsonModel;

      if (serializable.global) {
        serializable.global.splitterExtra = 12; // Larger splitter hit test area
        serializable.global.splitterSize = 2;
        serializable.global.tabSetEnableDivide = !isTouchDevice();
        serializable.global.enableEdgeDock = !isTouchDevice();
      }

      const model = Model.fromJson(serializable);

      // Overwrite persisted `TabMeta`s with their value from `props`
      
      const tabKeyToMeta = extractTabNodes(props.tabset.layout).reduce(
        (agg, item) => Object.assign(agg, { [item.id as string]: item.config }),
        {} as Record<string, TabDef>
      );
      model.visitNodes(
        (x) =>
          x.getType() === "tab" &&
          Object.assign((x as TabNode).getConfig(), tabKeyToMeta[x.getId()])
      );

      // Validate i.e. props.tabs must mention same ids
      const prevTabNodeIds = [] as string[];
      model.visitNodes((x) => x.getType() === "tab" && prevTabNodeIds.push(x.getId()));
      const nextTabNodeIds = extractTabNodes(props.tabset.layout).map((x) => x.id);
      if (
        prevTabNodeIds.length === nextTabNodeIds.length &&
        prevTabNodeIds.every((id) => nextTabNodeIds.includes(id))
      ) {
        return model;
      } else {
        throw Error(JSON.stringify({
          message: 'prev/next ids differ',
          prevTabNodeIds,
          nextTabNodeIds,
        }, undefined, '\t'));
      }
    } catch (e) {
      warn("createOrRestoreJsonModel", e);
    }
  }

  // Either:
  // (a) no Tabs model found in local storage, or
  // (b) Tabs prop "tabs" has different ids
  return Model.fromJson(
    computeJsonModel(props.tabset, props.rootOrientationVertical)
  );
}

export function extractTabNodes(layout: IJsonRowNode): IJsonTabNode[] {
  return layout.children.flatMap(child => {
    if (child.type === 'row') {
      return extractTabNodes(child);
    } else {
      return child.children.flatMap(x=> x);
    }
  });
}

export function createLayoutFromBasicLayout(
  basicLayout: TabDef[][],
): IJsonRowNode {
  return {
    type: "row",
    // One row for each list in `tabs`.
    children: basicLayout.map((defs) => ({
      type: "row",
      weight: defs[0]?.weight,
      // One tabset for each list in `tabs`
      children: [
        {
          type: "tabset",
          // One tab for each def in `defs`
          children: defs.map((def) => ({
            type: "tab",
            // Tabs must not be duplicated within same `Tabs`,
            // for otherwise this internal `id` will conflict.
            id: getTabIdentifier(def),
            name: getTabIdentifier(def),
            config: deepClone(def),
          })),
        },
      ],
    })),
  };
}


function computeJsonModel(tabset: TabsetLayout, rootOrientationVertical?: boolean): IJsonModel {
  return {
    global: {
      tabEnableRename: false,
      rootOrientationVertical,
      tabEnableClose: false,
      tabSetEnableDivide: !isTouchDevice(),
      enableEdgeDock: !isTouchDevice(),
      splitterExtra: 12,
      splitterSize: 2,
    },
    layout: tabset.layout,
  };
}

export function storeModelAsJson(id: string, model: Model) {
  const serializable = model.toJson();
  tryLocalStorageSet(`model@${id}`, JSON.stringify(serializable));
}

//#endregion
