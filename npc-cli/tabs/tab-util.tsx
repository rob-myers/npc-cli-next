import { type IJsonRowNode, IJsonModel, IJsonTabSetNode } from "flexlayout-react";
import { deepClone, tryLocalStorageGetParsed, warn } from "../service/generic";
import { isTouchDevice } from "../service/dom";
import type { ComponentClassKey, CustomIJsonTabNode, TabDef, TabsetLayout } from "./tab-factory";
import { helper } from "../service/helper";

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
      tabEnableClose: false, // use "manage" tab to close tabs
      tabSetMinHeight: 100,
      tabSetMinWidth: 200,
      tabSetEnableDivide: !isTouchDevice(),
      enableEdgeDock: !isTouchDevice(),
      splitterExtra: 12,
      splitterSize: 2,
    },
    layout,
  };
}

/**
 * Ensure at least one manage tab in layout.
 */
export function ensureManageTab(layout: IJsonRowNode): IJsonRowNode {
  const tabsets = extractTabsetNodes(layout);

  if (tabsets.length === 0) {
    return createLayoutFromBasicLayout([[
      { type: 'component', class: 'Manage', filepath: 'manage', props: {} },
    ]]);
  }

  const tabset = tabsets.find(x => x.children.find(y => isManageTabDef(y.config)));

  if (tabset === undefined) {// add manage tab to final tabset
    tabsets.at(-1)!.children.push(createTabNodeFromDef({
      type: 'component', class: 'Manage', filepath: 'manage', props: {}
    }));
  }

  return layout;
}

/**
 * 🔔 All layouts should be created this way.
 */
export function createLayoutFromBasicLayout(
  basicLayout: BasicTabsLayout,
): IJsonRowNode {
  return ensureManageTab({
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
  });
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
  Debug: true,
  HelloWorld: true,
  Manage: true,
  World: true,
};

export const toComponentClassPrefix: Record<ComponentClassKey, string> = {
  Debug: 'debug',
  HelloWorld: 'hello-world',
  Manage: 'manage',
  World: 'world',
};

function getTabIdentifier(meta: TabDef) {
  return meta.filepath;
}

export function isComponentClassKey(input: string): input is ComponentClassKey {
  return input in fromComponentClassKey;
}

function isManageTabDef(def: TabDef) {
  return def.type === 'component' && def.class === 'Manage';
}

export function removeTabFromLayout(layout: IJsonRowNode, tabId: string) {
  
  const tabsets = extractTabsetNodes(layout);

  const manageTabCount = tabsets.reduce((sum, tabset) =>
    sum + tabset.children.filter(x => isManageTabDef(x.config)).length,
    0,
  );
  if (manageTabCount === 0) {
    warn(`${'removeTabFromLayout'}: layout lacks a "manage tab"`);
  }

  for (const tabset of tabsets) {
    const index = tabset.children.findIndex(x => x.id === tabId);
    
    if (index === -1) {
      continue;
    }
    if (isManageTabDef(tabset.children[index].config) && manageTabCount === 1) {
      throw Error(`${'removeTabFromLayout'}: cannot remove last "manage tab"`);
    }

    tabset.children.splice(index, 1);
    
    const { length } = tabset.children;
    if (length === 0) tabset.selected = undefined;
    else if (length === index) tabset.selected = index - 1;
    else tabset.selected = index; // preserve
    return true;
  }
  return false;
}

export function resolveLayoutPreset(layoutPresetKey: Key.LayoutPreset) {
  if (!helper.isLayoutPresetKey(layoutPresetKey)) {
    warn(`${'resolveLayoutPreset'}: invalid layoutKey: ${layoutPresetKey}`);
    layoutPresetKey = 'layout-preset-0';
  }
  return createLayoutFromBasicLayout(helper.layoutPreset[layoutPresetKey]);
}

export function computeStoredTabsetLookup(): AllTabsets {
  
  function restoreLayout(key: keyof AllTabsets) {
    return ensureManageTab(
      tryLocalStorageGetParsed<IJsonRowNode>(`tabset@${key}`)
      ?? deepClone(emptyTabsetLayout)
    );
  }
  
  const output = {
    started: restoreLayout('synced'),
    synced: restoreLayout('synced'),
    saved: restoreLayout('saved'),
  };
  console.log(`${'restoreTabsetLookup'}`, output);
  return output;
}

const emptyTabsetLayout: TabsetLayout = {
  type: 'row',
  children: [],
};

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

/**
 * 🤔 could extend e.g. permit vertical split via `TabDef[][] | TabDef[][][]`
 */
export type BasicTabsLayout = TabDef[][];
