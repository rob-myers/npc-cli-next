import type { StateCreator } from "zustand";
import { createWithEqualityFn } from "zustand/traditional";
import { devtools } from "zustand/middleware";
import { focusManager } from "@tanstack/react-query";

// 🔔 avoid unnecessary HMR: do not reference view-related consts
import {
  defaultSiteTopLevelState,
  siteTopLevelKey,
  allArticlesMeta,
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

const initializer: StateCreator<State, [], [["zustand/devtools", never]]> = devtools((set, get) => ({
  articleKey: null,
  articlesMeta: allArticlesMeta,
  browserLoaded: false,
  discussMeta: {},
  frontMatter: {} as FrontMatter,
  mainOverlay: false,
  navOpen: false,
  viewOpen: false,

  api: {
    getFrontMatterFromScript() {
      try {
        // 🔔 read frontmatter from <script id="frontmatter-json">
        const script = document.getElementById('frontmatter-json') as HTMLScriptElement;
        const frontMatter = JSON.parse(script.innerHTML) as FrontMatter;
        // console.log({frontMatter});
        set({
          articleKey: frontMatter.key ?? null,
          frontMatter,
        }, undefined, "set-article-key");
        return frontMatter;
      } catch (e) {
        error(`frontMatter failed (script#frontmatter-json): using fallback frontMatter`);
        console.error(e);
        return { key: 'fallback-frontmatter' } as FrontMatter;
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

      function onGiscusMessage(message: MessageEvent) {
        if (message.origin === "https://giscus.app" && message.data.giscus?.discussion) {
          const discussion = message.data.giscus.discussion as GiscusDiscussionMeta;
          info("giscus meta", discussion);
          const { articleKey } = get();
          if (articleKey) {
            set(
              ({ discussMeta: comments }) => ({
                discussMeta: { ...comments, [articleKey]: discussion },
              }),
              undefined,
              "store-giscus-meta"
            );
            return true;
          }
        }
      }

      window.addEventListener("message", onGiscusMessage);
      cleanUps.push(() => window.removeEventListener("message", onGiscusMessage));

      set(() => ({ browserLoaded: true }), undefined, "browser-load");

      const topLevel: typeof defaultSiteTopLevelState =
        safeJsonParse(
          tryLocalStorageGet(siteTopLevelKey) ?? JSON.stringify(defaultSiteTopLevelState)
        ) ?? {};
      if (topLevel.viewOpen) {
        set(() => ({ viewOpen: topLevel.viewOpen }));
      }
      if (topLevel.navOpen) {
        set(() => ({ navOpen: topLevel.navOpen }));
      }

      return () => cleanUps.forEach((cleanup) => cleanup());
    },

    isViewClosed() {
      return !get().viewOpen;
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
  browserLoaded: boolean;
  discussMeta: { [articleKey: string]: GiscusDiscussionMeta };
  frontMatter: FrontMatter;

  mainOverlay: boolean;
  navOpen: boolean;
  viewOpen: boolean;

  api: {
    // clickToClipboard(e: React.MouseEvent): Promise<void>;
    initiateBrowser(): () => void;
    isViewClosed(): boolean;
    onTerminate(): void;
    getFrontMatterFromScript(): FrontMatter;
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

export interface FrontMatter {
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
