import { type IJsonTabNode, type IJsonRowNode, IJsonModel, IJsonTabSetNode } from "flexlayout-react";
import { deepClone, tryLocalStorageGetParsed } from "../service/generic";
import { isTouchDevice } from "../service/dom";
import type { TabDef, TabsetLayout } from "./tab-factory";
import { emptyTabset } from "@/components/const";

export function appendTabToLayout(tabset: TabsetLayout, tabDef: TabDef) {
  const { layout } = tabset;
  const tabId = getTabIdentifier(tabDef);
  if (layout.children.length === 0) {
    layout.children.push({ type: 'tabset', children: [], active: true });
  }
  if (!hasTabNode(layout, tabId)) {// add node
    const [activeTabset] = getActiveTabset(layout);
    activeTabset.children.push(createTabNodeFromDef(tabDef))
  }
  // 🚧 select node

  return tabset;
}

export function computeJsonModel(tabset: TabsetLayout, rootOrientationVertical?: boolean): IJsonModel {
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
          children: defs.map(createTabNodeFromDef),
        },
      ],
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

export function extractTabNodes(layout: IJsonRowNode): IJsonTabNode[] {
  return layout.children.flatMap(child => {
    if (child.type === 'row') {
      return extractTabNodes(child);
    } else {
      return child.children.flatMap(tabNode => tabNode);
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

/** Either singleton or empty. */
function getActiveTabset(layout: IJsonRowNode): IJsonTabSetNode[] {
  return layout.children.flatMap(child => {
    if (child.type === 'row') {
      return getActiveTabset(child);
    } else {
      return child.active ? child : [];
    }
  });
}

/** Same as `node.getId()` ? */
function getTabIdentifier(meta: TabDef) {
  return meta.filepath;
}

function hasTabNode(layout: IJsonRowNode, tabId: string): boolean {
  return layout.children.some(child => {
    if (child.type === 'row') {
      return hasTabNode(child, tabId);
    } else {
      return child.children.some(tabNode => tabNode.id === tabId);
    }
  });
}

export function restoreTabsetLookup() {

  const tabsetsMeta: AllTabsetsMeta = tryLocalStorageGetParsed('tabsets-meta') ?? {
    currentKey: 'empty',
    allKeys: ['empty', '_empty'],
  };
  
  const lookup = tabsetsMeta.allKeys.reduce((agg, tabsetKey) => {
    const restored: TabsetLayout = {
      key: tabsetKey,
      layout: (
        tryLocalStorageGetParsed<IJsonModel>(`tabset@${tabsetKey}`)?.layout
        ?? tryLocalStorageGetParsed<IJsonModel>(`tabset@_${tabsetKey}`)?.layout
        ?? deepClone(emptyTabset.layout)
      ),
    };
    return agg[tabsetKey] = restored, agg;
  }, {
    empty: deepClone(emptyTabset),
    _empty: {...deepClone(emptyTabset), key: '_empty' },
  } as Record<string, TabsetLayout>)
  
  const output = {
    ...lookup,
    current:  deepClone(lookup[tabsetsMeta.currentKey] ?? emptyTabset),
  };
  
  console.log(`${'restoreTabsetLookup'}`, output);
  return output;
}

export interface AllTabsetsMeta {
  currentKey: string;
  allKeys: string[];
}
