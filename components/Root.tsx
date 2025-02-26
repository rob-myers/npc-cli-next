"use client";

import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { css } from "@emotion/react";
import { menuClasses, sidebarClasses } from "react-pro-sidebar";
import { useBeforeunload } from "react-beforeunload";

import { queryClient } from '@/npc-cli/service/query-client';
import { afterBreakpoint, breakpoint, view, zIndexSite } from "./const";
import useSite from "./site.store";
import useOnResize from "@/npc-cli/hooks/use-on-resize";
import Nav from "./Nav";
import Main from "./Main";
import Comments from "./Comments";
import Viewer from "./Viewer";

export default function Root({ children, meta }: Props) {

  React.useMemo(() => useSite.api.setArticleKey(meta.key), [meta.key]);

  // Update matchMedia computations
  useOnResize();

  React.useEffect(() => useSite.api.initiateBrowser(), []);

  useBeforeunload(() => void useSite.api.onTerminate());

  return (
    <QueryClientProvider client={queryClient} >
      <div
        css={rootCss}
        data-testid="root"
      >
        <Nav />
        <div css={rootContentCss} data-testid="root-content">
          <Main>
            <article>
              {children}
            </article>
            <Comments
              id="comments"
              term={meta?.giscusTerm || meta?.path || "fallback-discussion"}
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

interface Props extends React.PropsWithChildren {
  meta: Frontmatter;
}

export interface Frontmatter {
  key: string;
  date: string;
  info: string;
  giscusTerm: string;
  label: string;
  path: string;
  tags: string[];
}

const rootCss = css`
  display: flex;
  flex-direction: row;
  height: 100vh;
  height: 100dvh;

  @media (max-width: ${breakpoint}) {
    // cannot move to Nav due to react-pro-sidebar api
    > aside {
      position: fixed;
      z-index: ${zIndexSite.nav};
      height: 100vh;
      height: 100dvh;

      &.${sidebarClasses.collapsed} {
        pointer-events: none;

        border: none !important;
        > div {
          background-color: transparent;
          overflow: hidden;
          .${menuClasses.root} {
            display: none;
          }
        }
        button.toggle {
          top: calc(0.5 * (${view.barSize} - 2rem));
          width: 2rem;
          height: 2rem;
          margin-top: 0;
          pointer-events: all;
        }
      }
    }
  }
`;

const rootContentCss = css`
  flex: 1;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  
  @media (max-width: ${breakpoint}) {
    flex-direction: column;
  }
  @media (min-width: ${afterBreakpoint}) {
    background-color: #ccc;
  }
`;
