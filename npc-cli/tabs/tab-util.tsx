import { type IJsonTabNode, type IJsonRowNode, IJsonModel } from "flexlayout-react";
import { deepClone, tryLocalStorageGet, tryLocalStorageGetParsed } from "../service/generic";
import { type TabsetLayout } from "./tab-factory";
import { emptyTabset } from "@/components/const";

export function restoreTabsetLookup() {
  // 🚧 store list of tabsetKeys in localStorage
  const tabsetKeys = ['temp_tabset', '_temp_tabset'];
  // 🚧 store `currentTabsetKey` in localStorage
  const currentTabsKey = 'temp_tabset';
  
  const lookup = tabsetKeys.reduce((agg, tabsetKey) => {
    const restored: TabsetLayout = {
      key: tabsetKey,
      layout: (
        (tryLocalStorageGetParsed<IJsonModel>(`tabset@${tabsetKey}`))?.layout
        ?? (tryLocalStorageGetParsed<IJsonModel>(`tabset@_${tabsetKey}`))?.layout
        ?? deepClone(emptyTabset.layout)
      ),
    };
    return agg[tabsetKey] = restored, agg;
  }, {} as Record<string, TabsetLayout> & { current: TabsetLayout })
  
  lookup.current = deepClone(lookup[currentTabsKey] ?? emptyTabset);
  
  console.log('restored', {lookup});

  return lookup;
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
