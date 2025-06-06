import type { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { devtools } from "zustand/middleware";
import { focusManager } from "@tanstack/react-query";
import { Model, type IJsonRowNode } from "flexlayout-react";

// 🔔 avoid unnecessary HMR: do not reference view-related consts
import { defaultSiteTopLevelState, siteTopLevelKey, allArticlesMeta } from "./const";

import { safeJsonParse, tryLocalStorageGet, tryLocalStorageSet, info, isDevelopment, error, deepClone, warn } from "@/npc-cli/service/generic";
import { isTouchDevice } from "@/npc-cli/service/dom";
import { helper } from "@/npc-cli/service/helper";
import { connectDevEventsWebsocket } from "@/npc-cli/service/fetch-assets";
import type { TabDef, TabsetLayout } from "@/npc-cli/tabs/tab-factory";
import { type TabsetLayouts, addTabToLayout, createLayoutFromBasicLayout, extractTabNodes, flattenLayout, layoutToModelJson, removeTabFromLayout, computeStoredTabsetLookup, resolveLayoutPreset, ensureManageTab, selectTabInLayout } from "@/npc-cli/tabs/tab-util";

const initializer: StateCreator<State, [], [["zustand/devtools", never]]> = devtools((set, get) => ({
  articleKey: null,
  articlesMeta: allArticlesMeta,
  discussMeta: {},
  draggingView: false,
  pageMetadata: {} as PageMetadata,
  navOpen: false,
  tabset: computeStoredTabsetLookup(),
  tabsMeta: {},
  viewOpen: false,

  api: {

    //#region tabset (layout)

    changeTabProps(tabId, partialProps) {
      const { synced: layout, tabs } = get().tabset;
      const found = tabs.find(x => x.id === tabId);
      if (found === undefined) {
        throw Error(`${'changeTabProps'} cannot find tabId "${tabId}"`);
      }

      if (found.config.type === 'component') {
        Object.assign(found.config.props, partialProps);
      } else if (found.config.type === 'terminal') {
        throw Error(`${'changeTabProps'} cannot change terminal "${tabId}" (useSession instead)`);
      } else {
        throw Error(`${'changeTabProps'} unexpected tab config "${JSON.stringify(found.config)}"`);
      }

      const synced = deepClone(layout);
      set(({ tabset: lookup }) => ({ tabset: {...lookup,
        started: layout,
        synced,
        tabs: extractTabNodes(synced),
      } }));
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

    getNextTabId(tabClass) {
      const tabClassNodes = get().tabset.tabs.filter(({ config }) => 
        config.type === 'terminal' ? tabClass === 'Tty' : config.class === tabClass
      );
      const { tabPrefix } = helper.toTabClassMeta[tabClass];
      const tabIds = new Set(tabClassNodes.map(x => x.id as string));
      const firstGap = [...Array(tabClassNodes.length + 1)].findIndex((_, i) => !tabIds.has(`${tabPrefix}-${i}`));
      return `${tabPrefix}-${firstGap}`;
    },

    migrateRestoredLayout(layout) {// 🚧 ensure every tab.config has type TabDef
      return layout;
    },

    openTab(tabDef) {
      const lookup = useSite.getState().tabset;
      const found = lookup.tabs.find(x => x.id === tabDef.filepath);

      if (found !== undefined) {// exists, so select it
        useSite.api.selectTab(tabDef.filepath);
        return; 
      }

      const layout = {...addTabToLayout({ layout: lookup.synced, tabDef })};
      const synced = deepClone(layout);

      useSite.setState(({ tabset }) => ({ tabset: { ...tabset,
        started: layout,
        synced,
        tabs: extractTabNodes(synced),
        version: tabset.version + 1,
      }}));
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
      const layout = useSite.api.tryRestoreLayout(fallbackLayout);
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
        started: layout,
        synced: deepClone(layout),
        version: tabset.version + 1,
      }}))
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
      }}));
      tryLocalStorageSet(`tabset@${'synced'}`, JSON.stringify(synced));
    },

    syncCurrentTabset(model) {
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        started: model.toJson().layout,
      }}));
    },
    
    testMutateLayout() {// 🔔 debug only
      
      const next = createLayoutFromBasicLayout([[
        { type: "component", class: "HelloWorld", filepath: "hello-world-2", props: {} },
        { type: "component", class: "HelloWorld", filepath: "hello-world-3", props: {} },
        {
          type: "component",
          class: "World",
          filepath: "test-world-1",
          // props: { worldKey: "test-world-1", mapKey: "small-map-1" },
          props: { worldKey: "test-world-1", mapKey: "demo-map-1" },
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
        restored = useSite.api.migrateRestoredLayout(restored);

        return restored;
      } catch (e) {
        warn("tryRestoreLayout", e);
        return fallbackLayout;
      }
    },

    //#endregion
    
    //#region tab meta
    
    clearTabMeta() {
      set(() => ({ tabsMeta: {}}));
    },

    setTabMeta(meta) {// currently only tracks `disabled`
      set(({ tabsMeta }) => ({ tabsMeta: { ...tabsMeta,
        [meta.key]: {
          key: meta.key,
          disabled: meta.disabled,
        },
      }}));
    },

    //#endregion

    getPageMetadataFromScript() {// 🔔 read metadata from <script id="page-metadata-json">
      try {
        const script = document.getElementById('page-metadata-json') as HTMLScriptElement;
        const pageMetadata = JSON.parse(JSON.parse(script.innerHTML)) as PageMetadata;
        // console.log({pageMetadata});
        set({
          articleKey: pageMetadata.key ?? null,
          pageMetadata,
        }, undefined, "set-article-key");
        return pageMetadata;
      } catch (e) {
        error(`pageMetadata failed: script#page-metadata-json: using fallback pageMetadata`);
        console.error(e);
        return { key: 'fallback-page-metadata' } as PageMetadata;
      }
    },

    initiateBrowser() {
      const cleanUps = [] as (() => void)[];

      if (isDevelopment()) {
        connectDevEventsWebsocket();
        /**
         * In development refetch on refocus can automate changes.
         * In production, see https://github.com/TanStack/query/pull/4805.
         */
        focusManager.setEventListener((handleFocus) => {
          if (typeof window !== "undefined" && "addEventListener" in window) {
            window.addEventListener("focus", handleFocus as (e?: FocusEvent) => void, false);
            return () => {
              window.removeEventListener("focus", handleFocus as (e?: FocusEvent) => void);
            };
          }
        });
      }

      window.addEventListener("message", useSite.api.onGiscusMessage);
      cleanUps.push(() => window.removeEventListener("message", useSite.api.onGiscusMessage));

      // open Nav/Viewer based on localStorage or defaults
      const topLevel: typeof defaultSiteTopLevelState = safeJsonParse(
        tryLocalStorageGet(siteTopLevelKey) ?? JSON.stringify(defaultSiteTopLevelState)
      ) ?? {};
      if (topLevel.viewOpen) {
        set(() => ({ viewOpen: topLevel.viewOpen }), undefined, 'restore-view-open');
      }
      if (topLevel.navOpen) {
        set(() => ({ navOpen: topLevel.navOpen }));
      }

      return () => cleanUps.forEach(cleanup => cleanup());
    },

    isViewClosed() {
      return !get().viewOpen;
    },

    onGiscusMessage(message: MessageEvent) {
      if (message.origin === "https://giscus.app" && message.data.giscus?.discussion) {
        const discussion = message.data.giscus.discussion as GiscusDiscussionMeta;
        info("giscus meta", discussion);
        const { articleKey } = get();
        if (articleKey) {
          set(({ discussMeta: comments }) => ({
            discussMeta: { ...comments, [articleKey]: discussion },
          }), undefined, "store-giscus-meta");
          return true;
        }
      }
      return false;
    },

    onTerminate() {
      const { navOpen, viewOpen } = get();
      tryLocalStorageSet(siteTopLevelKey, JSON.stringify({ navOpen, viewOpen }));
    },

    toggleNav(next) {
      if (next === undefined) {
        set(({ navOpen }) => ({ navOpen: !navOpen }), undefined, "toggle-nav");
      } else {
        set({ navOpen: next }, undefined, `${next ? "open" : "close"}-nav`);
      }
    },

    toggleView(next) {
      if (next === undefined) {
        const { viewOpen } = get();
        set({ viewOpen: !viewOpen }, undefined, "toggle-view");
        return !viewOpen;
      } else {
        set({ viewOpen: next }, undefined, `${next ? "open" : "close"}-view`);
        return next;
      }
    },

  },
}));

const useStore = createWithEqualityFn<State>()(initializer);

export type State = {
  /** Key of currently viewed article */
  articleKey: null | string;
  /** Frontmatter of every article */
  articlesMeta: typeof allArticlesMeta;
  discussMeta: { [articleKey: string]: GiscusDiscussionMeta };
  pageMetadata: PageMetadata;
  
  draggingView: boolean;

  tabset: TabsetLayouts;
  tabsMeta: { [tabId: string]: SiteTabMeta };
  navOpen: boolean;
  viewOpen: boolean;

  api: {
    // clickToClipboard(e: React.MouseEvent): Promise<void>;
    /**
     * - If tab type is component we merge into props.
     * - If tab type is terminal we merge into env.
     */
    changeTabProps(tabId: string, partialProps: Record<string, any>): void;
    clearTabMeta(): void;
    closeTab(tabId: string): void;
    getNextTabId(tabClass: Key.TabClass): `${Key.TabClassPrefix}-${number}`;
    /** ensure every `tab.config` has type @see {TabDef} */
    migrateRestoredLayout(layout: TabsetLayout): TabsetLayout;
    openTab(tabDef: TabDef): void;
    rememberCurrentTabs(): void;
    /** Restore layout from localStorage or use fallback */
    restoreLayoutWithFallback(fallbackLayout: Key.LayoutPreset | TabsetLayout, opts?: { preserveRestore?: boolean; }): TabsetLayout;
    revertCurrentTabset(): void;
    selectTab(tabId: string): void;
    /** If the tabset has the same tabs it won't change, unless `overwrite` is `true` */
    setTabset(layout: Key.LayoutPreset | TabsetLayout, opts?: { overwrite?: boolean }): void;
    /** Track non-layout properties e.g. disabled */
    setTabMeta(tabMeta: SiteTabMeta): void;
    storeCurrentLayout(model: Model): void;
    syncCurrentTabset(model: Model): void;
    testMutateLayout(): void; // 🚧 temp
    tryRestoreLayout(layout: TabsetLayout): TabsetLayout;
    
    getPageMetadataFromScript(): PageMetadata;
    initiateBrowser(): () => void;
    isViewClosed(): boolean;
    onGiscusMessage(message: MessageEvent): boolean;
    onTerminate(): void;
    toggleNav(next?: boolean): void;
    /** Returns next value of `viewOpen` */
    toggleView(next?: boolean): boolean;
  };
};

export type ArticleKey = (
  | 'index'
  | 'strategy-1'
);

export interface ArticleMeta {
  key: ArticleKey;
  date: string;
  giscusTerm?: string;
  info: string;
  label: string;
  path: string;
  tags: string[];
}

export interface PageMetadata {
  key: string;
  date: string;
  info: string;
  giscusTerm: string;
  label: string;
  path: string;
  tags: string[];
}

interface GiscusDiscussionMeta {
  id: string;
  locked: boolean;
  reactionCount: number;
  reactions: Record<
    "CONFUSED" | "EYES" | "HEART" | "HOORAY" | "LAUGH" | "ROCKET" | "THUMBS_DOWN" | "THUMBS_UP",
    { count: number; viewerHasReacted: boolean }
  >;
  repository: { nameWithOwner: string };
  totalCommentCount: number;
  totalReplyCount: number;
  /** e.g. `"https://github.com/rob-myers/the-last-redoubt/discussions/5"` */
  url: string;
}

interface SiteTabMeta {
  key: string;
  disabled: boolean;
  // ...
}

const useSite = Object.assign(useStore, { api: useStore.getState().api });
export default useSite;
