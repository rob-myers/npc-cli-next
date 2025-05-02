"use client";

import { usePathname } from "next/navigation";
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { css } from "@emotion/react";
import { useBeforeunload } from "react-beforeunload";

import { queryClient } from '@/npc-cli/service/query-client';
import { afterBreakpoint, breakpoint } from "./const";
import useSite from "./site.store";
import useOnResize from "@/npc-cli/hooks/use-on-resize";
import Nav from "./Nav";
import Main from "./Main";
import Comments from "./Comments";
import Viewer from "./Viewer";

// 🚧 remove below
import { profile } from "@/npc-cli/sh/src";
import { createLayoutFromBasicLayout } from "@/npc-cli/tabs/tab-util";

export default function Root({ children }: React.PropsWithChildren) {

  const frontMatter = useSite(x => x.pageMetadata);
  const pathname = usePathname();
  React.useEffect(() => void useSite.api.getPageMetadataFromScript(), [pathname]);
  
  React.useEffect(() => {

    // 🚧 move elsewhere
    useSite.api.restoreLayoutFallback(
      createLayoutFromBasicLayout([[
        {
          type: "component",
          class: "World",
          filepath: "test-world-1",
          // props: { worldKey: "test-world-1", mapKey: "small-map-1" },
          props: { worldKey: "test-world-1", mapKey: "demo-map-1" },
        },
      ],
      [
        {
          type: "terminal",
          filepath: "tty-1",
          env: { WORLD_KEY: "test-world-1", PROFILE: profile.profile1Sh },
        },
        {
          type: "terminal",
          filepath: "tty-2",
          env: { WORLD_KEY: "test-world-1", PROFILE: profile.profileAwaitWorldSh },
        },
        { type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} },
      ]])
    // }, true);
    , { preserveRestore: false });

    useSite.api.initiateBrowser();
  }, []);
  useOnResize(); // Update matchMedia computations
  useBeforeunload(() => void useSite.api.onTerminate());

  return (
    <QueryClientProvider client={queryClient}>
      <div
        css={rootCss}
        data-testid="root"
      >
        <Nav />
        <div
          css={rootContentCss}
          data-testid="root-content"
        >
          <Main>
            <article>
              {children}
            </article>
            <Comments
              id="comments"
              term={frontMatter.giscusTerm || frontMatter.path || "fallback-discussion"}
            />
          </Main>
          <Viewer />
        </div>
      </div>
      <ReactQueryDevtools
        initialIsOpen={false}
        buttonPosition="bottom-left"
      />
    </QueryClientProvider>
  );
}

const rootCss = css`
  display: flex;
  flex-direction: row;
  height: 100vh;
  /* needed by edge mobile */
  height: 100svh;
`;

const rootContentCss = css`
  flex: 1;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  height: 100%;

  
  @media (max-width: ${breakpoint}) {
    flex-direction: column;
  }
  @media (min-width: ${afterBreakpoint}) {
    /* 🚧 dark mode issue */
    background-color: #ccc;
  }
`;
