import { type IJsonTabNode, type IJsonRowNode, IJsonModel } from "flexlayout-react";
import { deepClone, tryLocalStorageGetParsed } from "../service/generic";
import { type TabsetLayout } from "./tab-factory";
import { emptyTabset } from "@/components/const";

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

export interface AllTabsetsMeta {
  currentKey: string;
  allKeys: string[];
}

