import Head from "next/head";
import { QueryClientProvider } from "@tanstack/react-query";
import { css } from "@emotion/css";
import { menuClasses, sidebarClasses } from "react-pro-sidebar";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from '@/src/npc-cli/service/query-client';
import { breakpoint, view } from "../const";
import Main from "./Main";
import Comments from "./Comments";

export default function Root({ children, ...rest }: Props) {
  console.log({rest})
  return (
    <>
      <Head>
        <title>NPC CLI</title>
      </Head>
      <QueryClientProvider client={queryClient} >
        <div className={rootCss} data-testid="root">
          <Main>
            <article>
              {children}
            </article>
            {/* <Comments
              id="comments"
              term={articleMeta?.giscusTerm || articleMeta?.path || "fallback-discussion"}
            /> */}
          </Main>
          {/* 🚧 Viewer */}
        </div>
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      </QueryClientProvider>
    </>
  );
}

interface Props extends React.PropsWithChildren {
  // ...
}

interface PageMeta {
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
      height: 100vh;
      height: 100dvh;
      z-index: 7;

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