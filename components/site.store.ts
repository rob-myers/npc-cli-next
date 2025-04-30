import type { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { devtools } from "zustand/middleware";
import { focusManager } from "@tanstack/react-query";
import { Model, type TabNode, type IJsonModel } from "flexlayout-react";

// 🔔 avoid unnecessary HMR: do not reference view-related consts
import { defaultSiteTopLevelState, siteTopLevelKey, allArticlesMeta, emptyTabset } from "./const";

import { safeJsonParse, tryLocalStorageGet, tryLocalStorageSet, info, isDevelopment, error, deepClone, warn, tryLocalStorageRemove } from "@/npc-cli/service/generic";
import { connectDevEventsWebsocket } from "@/npc-cli/service/fetch-assets";
import { isTouchDevice } from "@/npc-cli/service/dom";
import { createLayoutFromBasicLayout, type TabDef, type TabsetLayout } from "@/npc-cli/tabs/tab-factory";
import { extractTabNodes, flattenLayout, restoreTabsetLookup } from "@/npc-cli/tabs/tab-util";

const initializer: StateCreator<State, [], [["zustand/devtools", never]]> = devtools((set, get) => ({
  articleKey: null,
  articlesMeta: allArticlesMeta,
  discussMeta: {},
  draggingView: false,
  pageMetadata: {} as PageMetadata,
  navOpen: false,
  tabset: restoreTabsetLookup(),
  viewOpen: false,

  api: {

    //#region tabset

    changeTabset(nextTabsetKey) {
      let next = get().tabset[nextTabsetKey];
  
      if (next !== undefined) {
        // change current
        set(({ tabset: lookup }) => ({ tabset: { ...lookup,
          current: deepClone(next),
        } }));
      } else {
        
        // create new empty current
        next = { ...deepClone(emptyTabset), key: nextTabsetKey };
  
        set(({ tabset: lookup }) => ({ tabset: { ...lookup,
          [next.key]: next,
          [`_${next.key}`]: deepClone(next),
          current: deepClone(next),
        }}));

        warn(`${'changeTabset'}: created empty tabset "${nextTabsetKey}"`);
      }
  
      return next;
    },

    createTabset(tabset) {

      if (isTouchDevice()) {// better UX on mobile
        tabset.layout = flattenLayout(tabset.layout);
      }

      const next = useSite.api.tryRestoreLayout(tabset);
      const _next = deepClone(tabset);

      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        [next.key]: next,
        [`_${next.key}`]: _next,
        current: deepClone(next),
      }}));

      // save "restore point"
      tryLocalStorageSet(`tabset@_${next.key}`, JSON.stringify(_next));

      return next;
    },

    forgetCurrentLayout() {
      const { current } = get().tabset;
      tryLocalStorageRemove(`tabset@${current.key}`);  
    },

    revertCurrentTabset() {
      const { current } = get().tabset;
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        current: deepClone({...lookup[`_${current.key}`], key: current.key }),
        [current.key]: deepClone({...lookup[`_${current.key}`], key: current.key }),
      } }));
    },

    storeCurrentLayout(model) {
      const { current } = get().tabset;
      const serializable = model.toJson();
      tryLocalStorageSet(`tabset@${current.key}`, JSON.stringify(serializable));
    },

    syncCurrentTabset(model) {
      set(({ tabset: lookup }) => ({ tabset: { ...lookup,
        current: { key: lookup.current.key, layout: model.toJson().layout },
      }}));
    },

    // 🚧 temp
    testChangeTabsLayout() {
      
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

      set(({ tabset: lookup }) => {
        return { tabset: { ...lookup,
          current: { key: lookup.current.key, layout: next },
        }};
      });

    },

    tryRestoreLayout(tabset) {
      const jsonModelString = tryLocalStorageGet(`tabset@${tabset.key}`);
    
      if (jsonModelString !== null) {
        try {
          const serializable = JSON.parse(jsonModelString) as IJsonModel;
    
          if (serializable.global) {
            serializable.global.splitterExtra = 12; // Larger splitter hit test area
            serializable.global.splitterSize = 2;
            serializable.global.tabSetEnableDivide = !isTouchDevice();
            serializable.global.enableEdgeDock = !isTouchDevice();
          }
    
          const model = Model.fromJson(serializable);
    
          // Overwrite persisted `TabMeta`s with their value from `props`
          const tabKeyToMeta = extractTabNodes(tabset.layout).reduce(
            (agg, item) => Object.assign(agg, { [item.id as string]: item.config }),
            {} as Record<string, TabDef>
          );
          model.visitNodes((x) => x.getType() === "tab" &&
            Object.assign((x as TabNode).getConfig(), tabKeyToMeta[x.getId()])
          );
    
          // Validate i.e. `tabset` must mention same ids
          const prevTabNodeIds = [] as string[];
          model.visitNodes((x) => x.getType() === "tab" && prevTabNodeIds.push(x.getId()));
          const nextTabNodeIds = extractTabNodes(tabset.layout).map((x) => x.id);
          if (
            prevTabNodeIds.length === nextTabNodeIds.length &&
            prevTabNodeIds.every((id) => nextTabNodeIds.includes(id))
          ) {
            return {
              key: tabset.key,
              layout: model.toJson().layout,
            };
          } else {
            throw Error(JSON.stringify({ message: 'prev/next ids differ', prevTabNodeIds, nextTabNodeIds }, undefined, '\t'));
          }
        } catch (e) {
          warn("tryRestoreLayout", e);
        }
      }
    
      // Either:
      // (a) no Tabs model found in local storage, or
      // (b) Tabs prop "tabs" has different ids
      return tabset;
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
  /**
   * Tabset layout by `key`.
   * - `current` is always the current tabset
   * - `_${key}` is the first layout set against `key`,
   *   i.e. the tabset we reset to.
   */
  tabset: Record<string, TabsetLayout> & { current: TabsetLayout };
  navOpen: boolean;
  viewOpen: boolean;

  api: {
    // clickToClipboard(e: React.MouseEvent): Promise<void>;
    /** Change, creating new empty if n'exist pas */
    changeTabset(tabsetKey: string): TabsetLayout;
    /** Create, possibly overwriting `${key}` and `_${key}` */
    createTabset(tabsetDef: TabsetLayout): TabsetLayout;
    forgetCurrentLayout(): void;
    getPageMetadataFromScript(): PageMetadata;
    initiateBrowser(): () => void;
    isViewClosed(): boolean;
    onGiscusMessage(message: MessageEvent): boolean;
    onTerminate(): void;
    revertCurrentTabset(): void;
    toggleNav(next?: boolean): void;
    /** Returns next value of `viewOpen` */
    toggleView(next?: boolean): boolean;
    storeCurrentLayout(model: Model): void;
    syncCurrentTabset(model: Model): void;
    testChangeTabsLayout(): void; // 🚧 temp
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
