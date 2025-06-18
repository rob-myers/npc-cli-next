import type { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { devtools } from "zustand/middleware";
import { Model, type IJsonRowNode } from "flexlayout-react";

import { tryLocalStorageGet, tryLocalStorageSet, deepClone, warn } from "../service/generic";
import { isIOS, isTouchDevice } from "../service/dom";
import { helper } from "../service/helper";
import type { TabDef, TabsetLayout } from "../tabs/tab-factory";
import { type TabsetLayouts, addTabToLayout, createLayoutFromBasicLayout, extractTabNodes, flattenLayout, layoutToModelJson, removeTabFromLayout, computeStoredTabsetLookup, resolveLayoutPreset, ensureManageTab, selectTabInLayout, fixIOSCrash } from "../tabs/tab-util";

const initializer: StateCreator<State, [], [["zustand/devtools", never]]> = devtools((set, get) => ({
  tabset: computeStoredTabsetLookup(),
  tabsMeta: {},

  api: {

    changeTabProps(tabId, partialProps) {
      const { synced: layout, tabs } = get().tabset;
      const tab = tabs.find(x => x.id === tabId);

      if (tab === undefined) {
        throw Error(`${'changeTabProps'} cannot find tab "${tabId}"`);
      }

      if (tab.config.type === 'component') {
        Object.assign(tab.config.props, partialProps);
      } else if (tab.config.type === 'terminal') {
        throw Error(`${'changeTabProps'} cannot change terminal "${tabId}" (useSession instead)`);
      } else {
        throw Error(`${'changeTabProps'} unexpected tab config "${JSON.stringify(tab.config)}"`);
      }

      const synced = deepClone(layout);
      set(({ tabset }) => ({ tabset: {...tabset,
        started: layout,
        synced,
        tabs: extractTabNodes(synced),
        version: tabset.version + 1,
      } }));
    },

    clearTabMeta() {
      set(() => ({ tabsMeta: {}}));
    },

    closeTab(tabId) {
      const { synced: layout } = get().tabset;
      removeTabFromLayout({ layout, tabId });
      const synced = deepClone(layout);
      set(({ tabset }) => ({ tabset: { ...tabset,
        started: layout,
        synced,
        tabs: extractTabNodes(synced),
        version: tabset.version + 1,
      }}));
    },

    getNextSuffix(tabClass) {
      const tabClassNodes = get().tabset.tabs.filter(({ config }) => 
        config.type === 'terminal' ? tabClass === 'Tty' : config.class === tabClass
      );
      const { tabPrefix } = helper.toTabClassMeta[tabClass];
      const tabIds = new Set(tabClassNodes.map(x => x.id as string));
      const firstGap = [...Array(tabClassNodes.length + 1)].findIndex((_, i) => !tabIds.has(`${tabPrefix}-${i}`));
      return firstGap;
    },

    initiateBrowser() {
      if (isIOS()) {// 🔔 iOS 18.5 iPhone Mini fails on large maps
        set({ tabset: computeStoredTabsetLookup() }, undefined, 'recompute-layout-ios');
        helper.mapKeys = helper.mapKeys.filter(helper.isSmallMap);
      }
    },

    migrateRestoredLayout(layout) {// 🚧 ensure every tab.config has type TabDef
      return fixIOSCrash(layout);
    },

    openTab(tabDef) {
      const lookup = useTabs.getState().tabset;
      const found = lookup.tabs.find(x => x.id === tabDef.filepath);

      if (found !== undefined) {// exists, so select it
        useTabs.api.selectTab(tabDef.filepath);
        return false;
      }

      const layout = {...addTabToLayout({ layout: lookup.synced, tabDef })};
      const synced = deepClone(layout);

      useTabs.setState(({ tabset }) => ({ tabset: { ...tabset,
        started: layout,
        synced,
        tabs: extractTabNodes(synced),
        version: tabset.version + 1,
      }}));
      return true;
    },

    rememberCurrentTabs() {
      const lookup = get().tabset;
      const restorable = deepClone(lookup.synced);
      set(({ tabset: { ...lookup, saved: restorable }}));
      // remember in case `ensureTabset(current.key, true)` later
      tryLocalStorageSet(`tabset@${'saved'}`, JSON.stringify(restorable));
    },

    restoreLayoutWithFallback(fallbackLayout, opts = {}) {
      if (typeof fallbackLayout === 'string') {
        fallbackLayout = resolveLayoutPreset(fallbackLayout);
      }

      if (isTouchDevice()) {// better UX on mobile
        fallbackLayout = flattenLayout(deepClone(fallbackLayout));
      }

      // restore from localStorage if possible
      const layout = useTabs.api.tryRestoreLayout(fallbackLayout);
      // hard-reset returns to `saved` or `fallbackLayout`
      const restorable = opts.preserveRestore === true
        && get().tabset.saved
        || deepClone(fallbackLayout)
      ;
      const synced = deepClone(layout);

      tryLocalStorageSet(`tabset@${'saved'}`, JSON.stringify(restorable));
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        saved: restorable,
        started: layout,
        synced,
        tabs: extractTabNodes(synced),
      }}), undefined, 'restore-layout-with-fallback');

      return layout;
    },

    revertCurrentTabset() {
      const layout = deepClone(get().tabset.saved);
      const synced = deepClone(layout);

      set(({ tabset }) => ({ tabset: { ...tabset,
        started: layout,
        synced,
        tabs: extractTabNodes(synced),
        // force <Tabs> to compute new model, else revert only works 1st time
        version: tabset.version + 1,
      }}), undefined, 'revert-current-tabset');
      
      // overwrite localStorage too
      tryLocalStorageSet(`tabset@${'synced'}`, JSON.stringify(layout));
    },

    selectTab(tabId) {
      const { synced: layout } = get().tabset;
      selectTabInLayout({ layout, tabId });
      set(({ tabset }) => ({ tabset: { ...tabset,
        started: deepClone(layout),
        synced: layout, // preserved so needn't recompute tabset.tabs
        version: tabset.version + 1,
      }}), undefined, 'select-tab');
    },

    setTabset(layout, opts) {
      if (typeof layout === 'string') {
        layout = resolveLayoutPreset(layout);
      }

      if (isTouchDevice()) {// better UX on mobile
        layout = flattenLayout(deepClone(layout));
      }
      const synced = deepClone(layout);

      set(({ tabset }) => ({ tabset: { ...tabset,
        started: deepClone(layout),
        synced,
        tabs: extractTabNodes(synced),
        ...opts?.overwrite === true && {
          version: tabset.version + 1,
        }
      }}), undefined, 'set-tabset');
    },

    storeCurrentLayout(model) {
      const synced = model.toJson().layout;
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        synced, // 🔔 doesn't drive <Tabs>; tracks current state
        tabs: extractTabNodes(synced),
      }}), undefined, 'store-current-layout');
      tryLocalStorageSet(`tabset@${'synced'}`, JSON.stringify(synced));
    },

    syncCurrentTabset(model) {
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        started: model.toJson().layout,
      }}), undefined, 'sync-current-tabset');
    },
    
    testMutateLayout() {// 🔔 debug only
      
      const next = createLayoutFromBasicLayout([[
        { type: "component", class: "HelloWorld", filepath: "hello-world-2", props: {} },
        { type: "component", class: "HelloWorld", filepath: "hello-world-3", props: {} },
        {
          type: "component",
          class: "World",
          filepath: "world-1",
          // props: { worldKey: "world-1", mapKey: "small-map-1" },
          props: { worldKey: "world-1", mapKey: "demo-map-1" },
        },
      ],
      [
        { type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} },
      ]]);

      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        started: next,
      }}));
    },

    tryRestoreLayout(fallbackLayout) {
      const jsonModelString = tryLocalStorageGet(`tabset@${'synced'}`);
      if (jsonModelString === null) {
        return fallbackLayout;
      }
      try {
        let restored = JSON.parse(jsonModelString) as IJsonRowNode;
        /**
         * - we create Model and serialize it to validate
         * - we assume rootOrientationVertical true
         */
        restored = Model.fromJson(layoutToModelJson(restored, true)).toJson().layout;
        restored = ensureManageTab(restored);
        
        // props could change over time
        restored = useTabs.api.migrateRestoredLayout(restored);

        return restored;
      } catch (e) {
        warn("tryRestoreLayout", e);
        return fallbackLayout;
      }
    },

    updateTabMeta(meta) {
      if (meta.disabled === undefined && get().tabsMeta[meta.key] === undefined) {
        return; // 1st update must specify `disabled`
      }
      set(({ tabsMeta }) => ({ tabsMeta: { ...tabsMeta,
        [meta.key]: { ...tabsMeta[meta.key], ...meta },
      }}), undefined, 'update-tab-meta');
    },

  },
}), {
  name: 'tabs',
  anonymousActionType: 'anon-tabs-act',
});

const useStore = createWithEqualityFn<State>()(initializer);

export type State = {
  tabset: TabsetLayouts;
  tabsMeta: { [tabId: string]: SiteTabMeta };

  api: {
    /**
     * - If tab type is component we merge into props.
     * - If tab type is terminal we merge into env.
     */
    changeTabProps(tabId: string, partialProps: Record<string, any>): void;
    clearTabMeta(): void;
    closeTab(tabId: string): void;
    getNextSuffix(tabClass: Key.TabClass): number;
    initiateBrowser(): void;
    /** ensure every `tab.config` has type @see {TabDef} */
    migrateRestoredLayout(layout: TabsetLayout): TabsetLayout;
    /** Create a tab (returns `true`), or select it (`false`) */
    openTab(tabDef: TabDef): boolean;
    rememberCurrentTabs(): void;
    /** Restore layout from localStorage or use fallback */
    restoreLayoutWithFallback(fallbackLayout: Key.LayoutPreset | TabsetLayout, opts?: { preserveRestore?: boolean; }): TabsetLayout;
    revertCurrentTabset(): void;
    selectTab(tabId: string): void;
    /** If the tabset has the same tabs it won't change, unless `overwrite` is `true` */
    setTabset(layout: Key.LayoutPreset | TabsetLayout, opts?: { overwrite?: boolean }): void;
    /** Track non-layout properties e.g. disabled */
    updateTabMeta(tabMeta: Partial<SiteTabMeta> & { key: Key.TabId }): void;
    storeCurrentLayout(model: Model): void;
    syncCurrentTabset(model: Model): void;
    testMutateLayout(): void; // 🚧 temp
    tryRestoreLayout(layout: TabsetLayout): TabsetLayout;
  };
};

interface SiteTabMeta {
  key: Key.TabId;
  disabled: boolean;
  /** TTY tab: last recorded value of home.WORLD_KEY  */
  ttyWorldKey?: string;
  // ...
}

const useTabs = Object.assign(useStore, { api: useStore.getState().api });
export default useTabs;
