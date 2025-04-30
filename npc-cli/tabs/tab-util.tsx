import { type IJsonTabNode, type IJsonRowNode, IJsonModel } from "flexlayout-react";
import { deepClone, tryLocalStorageGetParsed } from "../service/generic";
import { isTouchDevice } from "../service/dom";
import type { TabDef, TabsetLayout } from "./tab-factory";
import { emptyTabset } from "@/components/const";

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

export function extractTabNodes(layout: IJsonRowNode): IJsonTabNode[] {
  return layout.children.flatMap(child => {
    if (child.type === 'row') {
      return extractTabNodes(child);
    } else {
      return child.children.flatMap(x=> x);
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

/** Same as `node.getId()` ? */
function getTabIdentifier(meta: TabDef) {
  return meta.filepath;
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
