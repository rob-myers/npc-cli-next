import { type IJsonRowNode, IJsonModel, IJsonTabSetNode } from "flexlayout-react";
import { profile } from "../sh/src";
import { deepClone, tryLocalStorageGetParsed } from "../service/generic";
import { isTouchDevice } from "../service/dom";
import type { ComponentClassKey, CustomIJsonTabNode, TabDef, TabsetLayout } from "./tab-factory";

export function appendTabToLayout(layout: TabsetLayout, tabDef: TabDef) {
  const tabId = getTabIdentifier(tabDef);
  if (layout.children.length === 0) {
    layout.children.push({ type: 'tabset', children: [], active: true });
  }

  const tabsetNodes = extractTabsetNodes(layout);
  
  const tabsetNode = tabsetNodes.find(x => x.children.some(y => y.id === tabId));
  const activeTabset = tabsetNodes.find(x => x.active) ?? tabsetNodes[tabsetNodes.length - 1];
  tabsetNodes.forEach(x => x.maximized = false);
  
  if (tabsetNode === undefined) {// add and select node
    const numTabs = activeTabset.children.push(createTabNodeFromDef(tabDef));
    activeTabset.active = true;
    activeTabset.selected = numTabs - 1;
  } else {// select node
    activeTabset.active = false;
    tabsetNode.active = true;
    tabsetNode.selected = tabsetNode.children.findIndex(x => x.id === tabId);
  }

  return layout;
}

export function layoutToModelJson(layout: TabsetLayout, rootOrientationVertical?: boolean): IJsonModel {
  return {
    global: {
      tabEnableRename: false,
      rootOrientationVertical,
      // tabEnableClose: false,
      tabEnableClose: true,
      tabSetEnableDivide: !isTouchDevice(),
      enableEdgeDock: !isTouchDevice(),
      splitterExtra: 12,
      splitterSize: 2,
    },
    layout,
  };
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
      children: [{
        type: "tabset",
        children: defs.map(createTabNodeFromDef),
      }],
    })),
  };
}

function createTabNodeFromDef(def: TabDef) {
  return {
    type: "tab",
    // Tabs must not be duplicated within same `Tabs`,
    // for otherwise this internal `id` will conflict.
    id: getTabIdentifier(def),
    name: getTabIdentifier(def),
    config: deepClone(def),
  };
}

export function extractTabNodes(layout: IJsonRowNode): (CustomIJsonTabNode)[] {
  return layout.children.flatMap(child => {
    if (child.type === 'row') {
      return extractTabNodes(child);
    } else {
      return child.children.flatMap(tabNode => tabNode as CustomIJsonTabNode);
    }
  });
}

function extractTabsetNodes(layout: IJsonRowNode): IJsonTabSetNode[] {
  return layout.children.flatMap(child => {
    if (child.type === 'row') {
      return extractTabsetNodes(child);
    } else {
      return child;
    }
  });
}

export function flattenLayout(layout: IJsonRowNode): IJsonRowNode {
  return {
    type: 'row',
    children: [// 🔔 flatten tabsets on mobile for better UX
      { type: 'tabset', children: extractTabNodes(layout) }
    ],
  };
}

const fromComponentClassKey: Record<ComponentClassKey, true> = {
  HelloWorld: true,
  World: true,
};

function getTabIdentifier(meta: TabDef) {
  return meta.filepath;
}

export function isComponentClassKey(input: string): input is ComponentClassKey {
  return input in fromComponentClassKey;
}

export function removeTabFromLayout(layout: IJsonRowNode, tabId: string) {
  for (const tabset of extractTabsetNodes(layout)) {
    const index = tabset.children.findIndex(x => x.id === tabId);
    if (index >= 0) {
      tabset.children.splice(index, 1);
      return true;
    }
  }
  return false;
}

export function restoreTabsetLookup(): AllTabsets {
  
  function restoreLayout(key: keyof AllTabsets) {
    return tryLocalStorageGetParsed<IJsonModel>(`tabset@${key}`)?.layout
      ?? deepClone(emptyTabsetLayout);
  }
  
  const output = {
    started: restoreLayout('started'),
    synced: restoreLayout('synced'),
    saved: restoreLayout('saved'),
  };
  console.log(`${'restoreTabsetLookup'}`, output);
  return output;
}

/**
 * Tabset layout by `key`.
 * - `started` is most recent layout started in `<Tabs>`
 * - `synced` is the actual layout, in sync with flexlayout-react
 * - `saved` is the layout we restore to on hard reset
 */
export interface AllTabsets {
  started: TabsetLayout;
  synced: TabsetLayout;
  saved: TabsetLayout;
}

export const emptyTabsetLayout: TabsetLayout = {
  type: 'row',
  children: [],
};

export const layoutPreset: Record<LayoutPresetKey, TabsetLayout> = {
  "empty-layout": emptyTabsetLayout,
  "layout-preset-0": createLayoutFromBasicLayout([
    [
      {
        type: "component",
        class: "World",
        filepath: "test-world-1",
        // props: { worldKey: "test-world-1", mapKey: "small-map-1" },
        props: { worldKey: "test-world-1", mapKey: "demo-map-1" },
      },
    ],
    [
      {
        type: "terminal",
        filepath: "tty-1",
        env: { WORLD_KEY: "test-world-1", PROFILE: profile.profile1Sh },
      },
      {
        type: "terminal",
        filepath: "tty-2",
        env: { WORLD_KEY: "test-world-1", PROFILE: profile.profileAwaitWorldSh },
      },
      { type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} },
    ]
  ]),
};

type LayoutPresetKey = (
  | 'empty-layout'
  | 'layout-preset-0'
);

export function isLayoutPresetKey(input: string): input is LayoutPresetKey {
  return input in layoutPreset;
}
