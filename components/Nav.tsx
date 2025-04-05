import Link from "next/link";
import { css } from "@emotion/react";
import React from "react";
import { Sidebar, Menu, MenuItem, SubMenu, sidebarClasses, menuClasses } from "react-pro-sidebar";

import { afterBreakpoint, breakpoint, nav, view, zIndexSite } from "./const";
import useSite from "./site.store";
import useStateRef from "../npc-cli/hooks/use-state-ref";
import { FontAwesomeIcon, faRobot, faCode, faCircleQuestion, faCircleInfo, faChevronRight, faCodeBranch } from "./Icon";

export default function Nav() {
  const collapsed = useSite(({ navOpen }) => !navOpen);

  const state = useStateRef(() => ({
    onClickMenu(e: React.MouseEvent) {
      const li = (e.target as HTMLElement).closest('li');
      if (li && li.previousSibling !== null) {
        e.stopPropagation();
      }
    },
    onClickToggle(e: React.MouseEvent) {
      state.toggleCollapsed();
      e.stopPropagation();
    },
    toggleCollapsed() {
      useSite.api.toggleNav();
    },
  }), {
    deps: [collapsed],
  });

  return (
    <Sidebar
      backgroundColor="black"
      css={navCss}
      collapsed={collapsed}
      collapsedWidth={nav.collapsedWidth}
      data-testid="nav"
      onClick={state.toggleCollapsed}
      width={nav.expandedWidth}
    >
      <button
        onClick={state.onClickToggle}
        css={toggleCss}
        className="toggle"
        style={{ zIndex: 10 }}
      >
         <FontAwesomeIcon
          icon={faChevronRight}
          size="1x"
          beat={false}
          flip={collapsed ? undefined : "horizontal"}
        />
      </button>

      <Menu onClick={state.onClickMenu}>
        <MenuItem className="title" component="span" tabIndex={-1}>
          <Link href="/blog/index" tabIndex={-1}>NPC CLI</Link>
        </MenuItem>
        <SubMenu icon={icon.blog} label="Blog">
          <MenuItem component="span">
            <Link href="/blog/intent">Intent</Link>
          </MenuItem>
          <MenuItem component="span">
            <Link href="/blog/strategy-1">Strategy 1</Link>
          </MenuItem>
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <SubMenu icon={icon.dev} label="Dev">
          <MenuItem>Tech</MenuItem>
          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <MenuItem icon={icon.research}>Research</MenuItem>
        <MenuItem icon={icon.help}>Help</MenuItem>
        <MenuItem icon={icon.about}>About</MenuItem>
      </Menu>
    </Sidebar>
  );
}

const navCss = css`

  .${sidebarClasses.container} {
    z-index: ${zIndexSite.nav};
  }

  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  color: white;
  border-right: 1px solid #444 !important;
  text-transform: lowercase;


  // root item height and hover
  a.${menuClasses.button}, span.${menuClasses.button} {
    height: ${nav.menuItem};
    
    &:hover {
      background-color: transparent;
      text-decoration: underline;
    }
  }

  // root item icon
  span.${menuClasses.icon} {
    width: 1rem;
    min-width: 1rem;
    margin-right: 24px;
    margin-left: 12px;
    transition: margin-left 300ms;
  }

  // sub-menu
  .${menuClasses.subMenuContent} {
    background-color: #222222;
    padding-left: 20px;
  }
  .${menuClasses.SubMenuExpandIcon} {
    padding-right: 0.5rem;
  }

  // collapsed (only visible on desktop)
  &.${sidebarClasses.collapsed} {
    span.${menuClasses.icon} {
      margin-left: 4px;
    }
    .${menuClasses.SubMenuExpandIcon} {
      display: none;
    }
  }

  // Nav title
  .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 500ms;
    margin-left: 0.75rem;

    .${menuClasses.button} {
      pointer-events: none; // ignore clicks outside <a>
      height: ${view.barSize};
    }
    
    .${menuClasses.label} {
      text-transform: capitalize;
      letter-spacing: 0.5rem;
      a {
        pointer-events: all;
        color: #ddd;
      }
      @media (max-width: ${breakpoint}) {
        font-weight: 500;
        font-size: 1.1rem;
      }
      @media (min-width: ${afterBreakpoint}) {
        font-weight: 200;
        font-size: 1.3rem;
      }
    }
  }
  &.${sidebarClasses.collapsed} .${menuClasses.menuItemRoot}.title {
    opacity: 0;
  }

  @media (max-width: ${breakpoint}) {

    // avoid displace <main> on expand
    position: fixed !important;
    z-index: ${zIndexSite.nav};
    height: 100vh;
    height: 100dvh;

    // only show toggle when collapsed
    &.${sidebarClasses.collapsed} {
      pointer-events: none;
      button.toggle {
        pointer-events: all;
      }

      border: none !important;
      > div {
        background-color: transparent;
        overflow: hidden;
        .${menuClasses.root} {
          display: none;
        }
      }
    }
  }
`;

const icon = {
  blog: <FontAwesomeIcon icon={faRobot} color="white" size="1x" />,
  dev: <FontAwesomeIcon icon={faCode} color="white" size="1x" />,
  help: <FontAwesomeIcon icon={faCircleQuestion} color="white" size="1x" />,
  about: <FontAwesomeIcon icon={faCircleInfo} color="white" size="1x" />,
  research: <FontAwesomeIcon icon={faCodeBranch} color="white" size="1x" />,
};

const toggleCss = css`
  position: absolute;
  top: 0.6rem;
  right: 1rem;
  transition: margin-top 300ms;
  margin-top: ${nav.titleMarginTop};

  border-radius: 50%;
  background-color: white;
  color: black;
  width: 1.8rem;
  height: 1.8rem;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  
  transform: scale(0.8);
  filter: invert(1);
`;
