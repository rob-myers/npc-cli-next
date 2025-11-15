import Link from "next/link";
import { useRouter } from "next/navigation";
import cx from "classnames";
import { css } from "@emotion/react";
import React from "react";
import { Sidebar, Menu, MenuItem, SubMenu, sidebarClasses, menuClasses } from "react-pro-sidebar";

import { breakpoint, nav, view, zIndexSite } from "./const";
import useSite from "./site.store";
import useStateRef from "../npc-cli/hooks/use-state-ref";
import { FontAwesomeIcon, faRobot, faCode, faCircleQuestion, faCircleInfo, faChevronRight } from "../npc-cli/components/Icon";

export default function Nav() {
  const collapsed = useSite(({ navOpen }) => !navOpen);
  const router = useRouter();

  const state = useStateRef(() => ({
    onClickMenu(e: React.MouseEvent) {
      const li = (e.target as HTMLElement).closest('li');
      if (li === null)  {
        return; // let toggleCollapsed handle it
      }

      // do not toggleCollapsed
      e.stopPropagation();

      // can click anywhere in li,
      // except 1st one when collapsed
      if (collapsed && li.previousSibling === null) {
        return;
      }
      const as = li.querySelectorAll('a');
      if (as.length === 1) {
        router.push(as[0].href);
      }
    },
    toggleCollapsed() {
      useSite.api.toggleNav();
    },
  }), { deps: [collapsed, router] });

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
        css={toggleCss}
        className={cx("toggle", { collapsed })}
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
          <Link href="/blog/index" tabIndex={-1}>
            NPC CLI
          </Link>
        </MenuItem>
        <SubMenu icon={icon.blog} label="Main">
          <MenuItem component="span">
            <Link href="/blog/main/many-npcs">Many NPCs</Link>
          </MenuItem>

          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        <SubMenu icon={icon.devBlog} label="Dev">
        <MenuItem component="span">
            <Link href="/blog/dev/intro-to-world">World Intro</Link>
          </MenuItem>

          <MenuItem>One</MenuItem>
          <MenuItem>Two</MenuItem>
        </SubMenu>
        {/* <MenuItem icon={icon.research}>Research</MenuItem> */}
        <MenuItem icon={icon.help} component="span">
          <Link href="/blog/help">Help</Link>
        </MenuItem>
        <MenuItem icon={icon.about} component="span">
          <Link href="/blog/about">About</Link>
        </MenuItem>
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

  border-right: 1px solid #444 !important;
  text-transform: lowercase;
  color: #998;
  font-size: 0.8rem;
  font-weight: 200;
  letter-spacing: 0.15em;

  // Nav title
  .${menuClasses.menuItemRoot}.title {
    opacity: 1;
    transition: opacity 500ms;
    padding-left: 0.75rem;
    border-bottom: 1px solid #333;
    font-weight: 200;
    font-size: 0.9rem;
    text-transform: capitalize;
    letter-spacing: 0.7rem;

    .${menuClasses.button} {
      pointer-events: none; // ignore clicks outside <a>
      height: ${view.barSize};
    }
    
    .${menuClasses.label} {
      a {
        pointer-events: all;
        color: #998;
      }
    }
  }

  // root item height and hover
  a.${menuClasses.button}, span.${menuClasses.button} {
    height: ${nav.menuItem};
    
    &:hover {
      background-color: transparent;
    }
  }

  // root item icon
  span.${menuClasses.icon} {
    width: 1rem;
    min-width: 1rem;
    margin-right: 24px;
    margin-left: 12px;
    transition: margin-left 300ms;
    svg {
      color: #ccc;
      padding: 6px;
      border-radius: 50%;
    }
  }

  // sub-menu
  .${menuClasses.subMenuContent} {
    background-color: #222;
    padding-left: 20px;
    color: #ddd;
    font-weight: 200;
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

  &.${sidebarClasses.collapsed} .${menuClasses.menuItemRoot}.title {
    opacity: 0;
  }

  @media (max-width: ${breakpoint}) {

    // avoid displace <main> on expand
    position: fixed !important;
    z-index: ${zIndexSite.nav};
    height: 100dvh;
    height: 100vh;

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
  devBlog: <FontAwesomeIcon icon={faCode} color="white" size="1x" />,
  help: <FontAwesomeIcon icon={faCircleQuestion} color="white" size="1x" />,
  about: <FontAwesomeIcon icon={faCircleInfo} color="white" size="1x" />,
  // research: <FontAwesomeIcon icon={faCodeBranch} color="white" size="1x" />,
};

const toggleCss = css`
  position: absolute;
  z-index: ${zIndexSite.navToggle};
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

  filter: invert(1);
  
  display: none;
  &.collapsed {
    display: initial;
    border: 1px solid #bbb;
  }
`;
