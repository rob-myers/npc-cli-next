import Link from "next/link";
import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint, zIndexSite, sideNoteRootDataAttribute } from "./const";
import useSite from "./site.store";
import useRefreshScrollRestoration from "./use-refresh-scroll-restore";

export default function Main(props: React.PropsWithChildren) {
  const site = useSite(({ navOpen, draggingView }) => ({ navOpen, draggingView }), shallow);
  const rootRef = React.useRef<HTMLDivElement>(null);

  useRefreshScrollRestoration(rootRef.current);

  return (
    <div
      css={mainCss}
      className={cx("scroll-container", { draggingView: site.draggingView })}
      ref={rootRef}
    >
      <section
        className="prose max-w-screen-lg prose-headings:font-light dark:prose-invert"
        data-testid="main"
        {...{ [sideNoteRootDataAttribute]: true }}
      >
        <header
          css={mainHeaderCss}
          data-testid="main-title"
        >
          <Link href="/blog/index">NPC CLI</Link>
        </header>

        <main css={mainMainCss}>
          {props.children}
        </main>

        <div
          css={overlayCss}
          className={cx({ draggingView: site.draggingView, navOpen: site.navOpen })}
          onClick={() => useSite.api.toggleNav()}
        />
      </section>
    </div>
  );
}

const mainCss = css`
  --main-min-width-desktop: calc(600px + 2 * 2rem);

  width: 100%;
  overflow: scroll;
  &.draggingView {
    pointer-events: none;
  }

  @media (max-width: ${breakpoint}) {
    > section {
      max-width: unset !important;
      padding: 0 12px;
    }
  }
  
  @media (min-width: ${afterBreakpoint}) {
    > section {
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
  }
`;

const mainHeaderCss = css`
  z-index: ${zIndexSite.mainHeader};
  position: sticky;
  height: 4rem;
  top: 0;

  display: flex;
  justify-content: right;
  align-items: center;

  background-color: #fff8;
  color: #444;

  border-bottom: 1px solid rgba(200, 200, 200, 0.5);
  font-size: 1.2rem;
  letter-spacing: 1.5rem;
  
  pointer-events: none;
  a {
    display: none;
    color: black;
    text-decoration: none;
    pointer-events: all;
  }
  
  @media (min-width: ${afterBreakpoint}) {
    min-width: var(--main-min-width-desktop);
  
    margin-top: 0rem;
    margin-right: 1rem;
    margin-left: 1rem;
    
    padding-top: 1rem;
    padding-right: 2rem;
    padding-bottom: 1rem;
    padding-left: 2rem;

    a {
      display: initial;
    }
  }
`;

const mainMainCss = css`
  /* 🚧 dark mode issue */
  background-color: #fff;
  padding-top: 2rem;

  @media (min-width: ${afterBreakpoint}) {
    flex: 1;
    min-width: var(--main-min-width-desktop);
    margin: 0 1rem;
    padding: 2rem 4rem 6rem 4rem;
  }
`;

const overlayCss = css`
  -webkit-tap-highlight-color: transparent;
  position: absolute;
  z-index: ${zIndexSite.mainOverlay};
  background-color: rgba(0, 0, 0, 0.5);
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;

  pointer-events: none;
  transition: opacity 300ms;
  opacity: 0;

  &.draggingView {
    cursor: pointer;
    opacity: 1;
  }
  @media (max-width: ${breakpoint}) {
    &.navOpen {
      cursor: pointer;
      pointer-events: all;
      opacity: 1;
    }
  }
`;
