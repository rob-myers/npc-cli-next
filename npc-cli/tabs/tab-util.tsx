import { type IJsonRowNode, IJsonModel, IJsonTabNode, IJsonTabSetNode } from "flexlayout-react";
import { deepClone, testNever, tryLocalStorageGetParsed, warn } from "../service/generic";
import { isTouchDevice } from "../service/dom";
import type { CustomIJsonTabNode, TabDef, TabsetLayout } from "./tab-factory";
import { helper } from "../service/helper";
import type { ProfileKey } from "../sh/src";

/**
 * If exists do nothing, else mutate by appending to active tabset.
 */
export function addTabToLayout({ layout, selectTab, tabDef }: {
  layout: TabsetLayout;
  selectTab?: boolean;
  tabDef: TabDef;
}) {
  const tabId = getTabIdentifier(tabDef);
  if (layout.children.length === 0) {
    layout.children.push({ type: 'tabset', children: [], active: true });
  }

  const tabsetNodes = extractTabsetNodes(layout);
  const tabsetNode = tabsetNodes.find(x => x.children.some(y => y.id === tabId));

  if (tabsetNode !== undefined) {
    return layout; // already exists
  }

  const activeTabset = tabsetNodes.find(x => x.active) ?? tabsetNodes[tabsetNodes.length - 1];
  activeTabset.active = true;
  
  const numTabs = activeTabset.children.push(
    createTabNodeFromDef(tabDef)
  );

  if (selectTab === true) {
    tabsetNodes.forEach(x => x.maximized = false); // minimize
    activeTabset.selected = numTabs - 1; // select
  }
  
  return layout;
}

export function computeStoredTabsetLookup(): TabsetLayouts {
  
  function restoreLayout(key: keyof TabsetLayouts) {
    return ensureManageTab(
      tryLocalStorageGetParsed<IJsonRowNode>(`tabset@${key}`)
      ?? deepClone(emptyTabsetLayout)
    );
  }
  
  const synced = restoreLayout('synced');
  const started = deepClone(synced);

  const output: TabsetLayouts = {
    saved: restoreLayout('saved'),
    started,
    synced,
    tabs: extractTabNodes(synced),
    version: 0,
  };

  console.log(`${'restoreTabsetLookup'}`, output);
  return output;
}

/**
 * @param opts More relaxed than respective components props, e.g.
 * - for `World` have fallback for mapKey
 * - for `Tty` have fallback for worldKey
 */
export function computeTabDef(
  opts: { id: string; } & (
    | { classKey: 'Debug' | 'HelloWorld' | 'Manage';  }
    | { classKey: 'Tty'; profileKey?: ProfileKey; env?: Record<string, any> }
    | { classKey: 'World'; mapKey?: Key.Map }
  )
): TabDef {

  if (opts.classKey === 'Tty') {// 'Tty' is not a Key.ComponentClass
    if (opts.profileKey === undefined || !helper.isProfileKey(opts.profileKey)) {
      opts.profileKey = 'profile-empty-sh';
    }
    return {
      type: 'terminal',
      filepath: opts.id,
      profileKey: opts.profileKey,
      env: opts.env ?? {},
    };
  }

  let tabDef: TabDef;

  switch (opts.classKey) {
    case 'Debug':
    case 'HelloWorld':
    case 'Manage':
      tabDef = {
        type: 'component',
        class: opts.classKey,
        filepath: opts.id,
        props: {},
      };
      break;
    case 'World': {
      const worldKey = opts.id;
      tabDef = {
        type: 'component',
        class: opts.classKey,
        filepath: worldKey,
        props: {
          worldKey,
          mapKey: opts.mapKey ?? "demo-map-1"
        },
      };
      break;
    }
    default:
      throw testNever(opts);
  }

  return tabDef;
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

function getManageTabCount(tabsets: IJsonTabSetNode[]) {
  return tabsets.reduce((sum, tabset) =>
    sum + tabset.children.filter(x => isManageTabDef(x.config)).length,
    0,
  );
}

function getTabIdentifier(meta: TabDef) {
  return meta.filepath;
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

function isManageTabDef(def: TabDef) {
  return def.type === 'component' && def.class === 'Manage';
}

/**
 * Mutates `layout` and return `true` iff actually removed the tab.
 */
export function removeTabFromLayout({ layout, tabId }: {
  layout: IJsonRowNode;
  tabId: string;
}) {
  const tabsets = extractTabsetNodes(layout);
  const numManages = getManageTabCount(tabsets);
  if (numManages === 0) {
    warn(`${'removeTabFromLayout'}: layout lacks a "manage tab"`);
  }

  for (const tabset of tabsets) {
    const { children } = tabset;
    const index = children.findIndex(x => x.id === tabId);

    if (index === -1) {
      continue;
    }
    if (numManages === 1 && isManageTabDef(children[index].config)) {
      throw Error(`${'removeTabFromLayout'}: cannot remove last "manage tab"`);
    }

    children.splice(index, 1); // remove the tab

    if (typeof tabset.selected !== 'number' || children.length === 0) {
      tabset.selected = undefined;
      return true;
    }

    if (index > tabset.selected) {
      // NOOP
    } else if (index === tabset.selected) {
      tabset.selected = Math.min(tabset.selected, children.length - 1);
    } else {
      tabset.selected = Math.max(tabset.selected - 1, 0);
    }

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

export function selectTabInLayout({ layout, tabId }: {
  layout: IJsonRowNode;
  tabId: string;
}) {
  for (const tabset of extractTabsetNodes(layout)) {
    const index = tabset.children.findIndex(x => x.id === tabId);
    if (index >= 0) {
      tabset.selected = index;
      return true;
    }
  }
  return false;
}

const emptyTabsetLayout: TabsetLayout = {
  type: 'row',
  children: [],
};

/**
 * Tabset layouts and current tabs meta
 * - `started` is most recent layout started in `<Tabs>`
 * - `synced` is the actual layout, in sync with flexlayout-react
 * - `saved` is the layout we restore to on hard reset
 */
export interface TabsetLayouts {
  started: TabsetLayout;
  synced: TabsetLayout;
  saved: TabsetLayout;
  /** The tabs of `synced` */
  tabs: CustomIJsonTabNode[];
  /**
   * Used to trigger tabset model recompute.
   * This does not involve a remount.
   */
  version: number;
}

/**
 * 🤔 could extend e.g. permit vertical split via `TabDef[][] | TabDef[][][]`
 */
export type BasicTabsLayout = TabDef[][];
