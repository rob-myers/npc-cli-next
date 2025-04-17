import type { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { devtools } from "zustand/middleware";
import { focusManager } from "@tanstack/react-query";

// 🔔 avoid unnecessary HMR: do not reference view-related consts
import {
  defaultSiteTopLevelState,
  siteTopLevelKey,
  allArticlesMeta,
  initialTabsetLookup,
} from "./const";

import {
  safeJsonParse,
  tryLocalStorageGet,
  tryLocalStorageSet,
  info,
  isDevelopment,
  error,
} from "@/npc-cli/service/generic";
import { connectDevEventsWebsocket } from "@/npc-cli/service/fetch-assets";
import { isTouchDevice } from "@/npc-cli/service/dom";
import { type TabsetLayout as TabsetLayout } from "@/npc-cli/tabs/tab-factory";

const initializer: StateCreator<State, [], [["zustand/devtools", never]]> = devtools((set, get) => ({
  articleKey: null,
  articlesMeta: allArticlesMeta,
  discussMeta: {},
  draggingView: false,
  pageMetadata: {} as PageMetadata,
  navOpen: false,
  tabset: initialTabsetLookup,
  viewOpen: false,

  api: {
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

      // ready

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

    setTabset(tabset) {
      const current: TabsetLayout = {
        key: tabset.key,
        // 🔔 flatten tabsets on mobile for better UX
        layout: isTouchDevice() ? [tabset.layout.flatMap(x => x)] : tabset.layout,
      };

      set(({ tabset: lookup }) => ({
        tabset: {
          ...lookup,
          ...!(current.key in lookup) && { [`_${current.key}`]: current },
          [current.key]: current,
          current,
        }
      }));
      return current;
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
    initiateBrowser(): () => void;
    isViewClosed(): boolean;
    onGiscusMessage(message: MessageEvent): boolean;
    onTerminate(): void;
    getPageMetadataFromScript(): PageMetadata;
    setTabset(tabsetDef: TabsetLayout): TabsetLayout;
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

const useSite = Object.assign(useStore, { api: useStore.getState().api });
export default useSite;
