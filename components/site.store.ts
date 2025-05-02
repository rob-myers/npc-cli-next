import type { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { devtools } from "zustand/middleware";
import { focusManager } from "@tanstack/react-query";
import { Model, type TabNode, type IJsonModel, IJsonRowNode } from "flexlayout-react";

// 🔔 avoid unnecessary HMR: do not reference view-related consts
import { defaultSiteTopLevelState, siteTopLevelKey, allArticlesMeta } from "./const";

import { safeJsonParse, tryLocalStorageGet, tryLocalStorageSet, info, isDevelopment, error, deepClone, warn, tryLocalStorageRemove } from "@/npc-cli/service/generic";
import { connectDevEventsWebsocket } from "@/npc-cli/service/fetch-assets";
import { isTouchDevice } from "@/npc-cli/service/dom";
import type { TabDef, TabsetLayout } from "@/npc-cli/tabs/tab-factory";
import { type AllTabsets, appendTabToLayout, createLayoutFromBasicLayout, extractTabNodes, flattenLayout, layoutToModelJson, removeTabFromLayout, restoreTabsetLookup } from "@/npc-cli/tabs/tab-util";

const initializer: StateCreator<State, [], [["zustand/devtools", never]]> = devtools((set, get) => ({
  articleKey: null,
  articlesMeta: allArticlesMeta,
  discussMeta: {},
  draggingView: false,
  pageMetadata: {} as PageMetadata,
  navOpen: false,
  tabset: restoreTabsetLookup(),
  tabsetUpdates: 0,
  viewOpen: false,

  api: {

    //#region tabset

    changeTabProps(tabId, partialProps) {
      const layout = get().tabset.synced;
      const found = extractTabNodes(layout).find(x => x.id === tabId);
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

      set(({ tabset: lookup }) => ({ tabset: {...lookup,
        started: layout,
        synced: deepClone(layout),
      } }));
    },

    ensureTabset(tabset, preserveRestore = false) {

      if (isTouchDevice()) {// better UX on mobile
        tabset = flattenLayout(tabset);
      }

      // restore from localStorage if possible
      const next = useSite.api.tryRestoreLayout(tabset);

      // hard-reset returns to `saved` or `tabset`
      const restorable = preserveRestore
        ? get().tabset.saved ?? deepClone(tabset)
        : deepClone(tabset)
       ;

      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        started: deepClone(next),
        synced: next,
        saved: restorable,
      }}));

      tryLocalStorageSet(`tabset@${'saved'}`, JSON.stringify(restorable));

      return next;
    },

    openTab(tabDef) {
      const lookup = useSite.getState().tabset;
      const next = {...appendTabToLayout(lookup.synced, tabDef)};

      useSite.setState(({ tabsetUpdates }) => ({
        tabset: { ...lookup,
          started: next,
          synced: deepClone(next),
        },
        tabsetUpdates: tabsetUpdates + 1,
      }));
    },

    rememberCurrentTabs() {
      const lookup = get().tabset;
      const restorable = deepClone(lookup.synced);
      set(({ tabset: { ...lookup, saved: restorable }}));
      // remember in case `ensureTabset(current.key, true)` later
      tryLocalStorageSet(`tabset@${'saved'}`, JSON.stringify(restorable));
    },
    
    removeTab(tabId) {
      const lookup = get().tabset;
      const tabset = lookup.synced;

      if (removeTabFromLayout(tabset, tabId) === true) {
        set(({ tabsetUpdates }) => ({
          tabset: { ...lookup,
            synced: { ...tabset },
            started: deepClone(tabset),
          },
          tabsetUpdates: tabsetUpdates + 1,
        }))
        return true;
      } else {
        return false;
      }
    },

    revertCurrentTabset() {
      const lookup = get().tabset;
      const next = lookup.saved;

      set(({ tabsetUpdates }) => ({
        tabset: { ...lookup,
          started: deepClone(next),
          synced: deepClone(next),
        },
        // force <Tabs> to compute new model, else revert only works 1st time
        tabsetUpdates: tabsetUpdates + 1,
      }));
      
      // overwrite localStorage too
      tryLocalStorageSet(`tabset@${'synced'}`, JSON.stringify(next));
    },

    setTabset(layout) {
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        started: deepClone(layout),
        synced: deepClone(layout),
      }}));
    },

    storeCurrentLayout(model) {
      const serializable = model.toJson();
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        // tabset.synced doesn't drive <Tabs> but keeps track of its current state
        synced: serializable.layout,
      }}));
      tryLocalStorageSet(`tabset@${'synced'}`, JSON.stringify(serializable.layout));
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

    // 🚧 avoid creating Model i.e. manipulate json directly
    tryRestoreLayout(layout) {
      const jsonModelString = tryLocalStorageGet(`tabset@${'synced'}`);
    
      if (jsonModelString === null) {
        return layout;
      }

      try {
        const restored = JSON.parse(jsonModelString) as IJsonRowNode;
  
        // 🚧 rootOrientationVertical always true?
        const model = Model.fromJson(layoutToModelJson(restored, true));
  
        const tabKeyToDef = extractTabNodes(layout).reduce(
          (agg, item) => Object.assign(agg, { [item.id as string]: item.config }),
          {} as Record<string, TabDef>
        );
        /**
         * Overwrite `restored` tab's config with `tabset`s config.
         * We require config to have type @see {TabDef}, e.g.
         * > `{type: "component", class: "HelloWorld", filepath: "hello-world-9", props: {}}`
         */
        model.visitNodes((x) => x.getType() === "tab" &&
          Object.assign((x as TabNode).getConfig(), tabKeyToDef[x.getId()])
        );
  
        // Validate i.e. `tabset` must mention same ids
        const prevTabNodeIds = [] as string[];
        model.visitNodes((x) => x.getType() === "tab" && prevTabNodeIds.push(x.getId()));
        const nextTabNodeIds = extractTabNodes(layout).map((x) => x.id);
        if (
          prevTabNodeIds.length === nextTabNodeIds.length &&
          prevTabNodeIds.every((id) => nextTabNodeIds.includes(id))
        ) {
          return model.toJson().layout;
        } else {
          throw Error(JSON.stringify({ message: 'prev/next ids differ', prevTabNodeIds, nextTabNodeIds }, undefined, '\t'));
        }
      } catch (e) {
        warn("tryRestoreLayout", e);
      }
    
      // `tabset` vs `restored` do not contain the same tab ids
      return layout;
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
        set(() => ({ viewOpen: topLevel.viewOpen }));
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

  tabset: AllTabsets;
  /**
   * Used to trigger tabset model recompute.
   * This does not involve a remount.
   */
  tabsetUpdates: number;
  navOpen: boolean;
  viewOpen: boolean;

  api: {
    // clickToClipboard(e: React.MouseEvent): Promise<void>;
    /**
     * - If tab type is component we merge into props.
     * - If tab type is terminal we merge into env.
     */
    changeTabProps(tabId: string, partialProps: Record<string, any>): void;
    ensureTabset(tabsetDef: TabsetLayout, preserveRestore?: boolean): TabsetLayout;
    getPageMetadataFromScript(): PageMetadata;
    initiateBrowser(): () => void;
    isViewClosed(): boolean;
    onGiscusMessage(message: MessageEvent): boolean;
    onTerminate(): void;
    openTab(tabDef: TabDef): void;
    rememberCurrentTabs(): void;
    removeTab(tabId: string): boolean;
    revertCurrentTabset(): void;
    toggleNav(next?: boolean): void;
    /** Returns next value of `viewOpen` */
    toggleView(next?: boolean): boolean;
    setTabset(layout: TabsetLayout): void;
    storeCurrentLayout(model: Model): void;
    syncCurrentTabset(model: Model): void;
    testMutateLayout(): void; // 🚧 temp
    tryRestoreLayout(layout: TabsetLayout): TabsetLayout;
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

const useSite = Object.assign(useStore, { api: useStore.getState().api });
export default useSite;
