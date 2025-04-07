import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { shallow } from "zustand/shallow";

import { afterBreakpoint, breakpoint, zIndexSite, sideNoteRootDataAttribute } from "./const";
import useSite from "./site.store";
import { isSmallView } from "./layout";

export default function Main(props: React.PropsWithChildren) {
  const site = useSite(({ navOpen, draggingView }) => ({ navOpen, draggingView }), shallow);

  const overlayOpen = site.draggingView || (site.navOpen && isSmallView());

  return (
    <div
      css={mainCss}
      className={cx("scroll-container", { draggingView: site.draggingView })}
    >
      <section
        className="prose max-w-screen-lg prose-headings:font-light"
        data-testid="main"
        {...{ [sideNoteRootDataAttribute]: true }}
      >
        <header
          css={mainHeaderCss}
          data-testid="main-title"
        >
          NPC CLI
        </header>

        <main css={mainMainCss}>
          {props.children}
        </main>

        <div
          css={overlayCss}
          className={cx({ overlayOpen, navOpen: site.navOpen })}
          onClick={() => useSite.api.toggleNav()}
        />
      </section>
    </div>
  );
}

const mainCss = css`
  width: 100%;
  overflow: scroll;
  &.draggingView {
    pointer-events: none;
  }

  > section {
    @media (max-width: ${breakpoint}) {
      /* overflow: scroll; */
      max-width: unset !important;
      padding: 0 12px;
    }
  
    @media (min-width: ${afterBreakpoint}) {
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      /* overflow-x: auto; */
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

  background-color: #fff;
  color: #444;
  border-bottom: 1px solid rgba(200, 200, 200, 0.5);
  font-size: 1.2rem;
  letter-spacing: 1.5rem;

  @media (min-width: ${afterBreakpoint}) {
    min-width: calc(400px + 2 * 2rem);

    margin-top: 0rem;
    margin-right: 1rem;
    margin-left: 1rem;

    padding-top: 1rem;
    padding-right: 2rem;
    padding-bottom: 1rem;
    padding-left: 2rem;
  }
`;

const mainMainCss = css`
  background-color: #fff;
  padding-top: 2rem;

  @media (min-width: ${afterBreakpoint}) {
    flex: 1;
    min-width: calc(400px + 2 * 2rem);

    margin-right: 1rem;
    margin-left: 1rem;

    padding-right: 2rem;
    padding-bottom: 6rem;
    padding-left: 2rem;
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
  height: 100dvh;

  pointer-events: none;
  transition: opacity 300ms;
  opacity: 0;

  &.overlayOpen {
    cursor: pointer;
    opacity: 1;
  }
  
  /* fix Safari i.e. Viewer scroll was jerky when pointer-events: all */
  &.overlayOpen.navOpen {
    pointer-events: all;
  }
`;
