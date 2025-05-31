import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { extractTabNodes } from "../tabs/tab-util";
import useStateRef from "../hooks/use-state-ref";
import useSite from "@/components/site.store";
import useUpdate from "../hooks/use-update";

/** @param {Props} props */
export default function Manage(props) {

  const layout = useSite(({ tabset: { synced } }) => synced);

  const state = useStateRef(/** @returns {State} */ () => ({
    showDemoLinks: false,

    onClickManageTabs({ target: el }) {
      const tabId = el.closest('li')?.dataset.tabId;
      if (typeof tabId !== 'string') {
        return;
      }

      if (el.classList.contains(cssName.closeTab)) {
        useSite.api.closeTab(tabId);
      }
    },
    toggleDemoLinks() {
      state.showDemoLinks = !state.showDemoLinks;
      update();
    },
  }));

  const tabDefs = React.useMemo(() => {
    const defs = extractTabNodes(layout).map(x => x.config);
    return defs;
  }, [layout]);

  const update = useUpdate();

  return (
    <div css={manageCss}>
      <div 
        className="tab-defs"
        onClick={state.onClickManageTabs}
      >
        <h2>
          Manage Tabs
        </h2>

        <ul>
          {tabDefs.map(def =>
            <li key={def.filepath} data-tab-id={def.filepath}>
              <span className="tab-def">
                <span>{def.filepath}</span>
                {def.type === 'terminal' && <span className="world-key">{`(${def.env?.WORLD_KEY})`}</span>}
                {def.type === 'component' && def.class === 'World' && <span className="map-key">{`(${def.props.mapKey})`}</span>}
              </span>
              <span className={cssName.closeTab}>
                x
              </span>
            </li>
          )}
        </ul>
      </div>
      
      <div>
        <h2>Open Tabs</h2>
        
        {/* 🚧 list of permitted defs */}
      </div>

      <div
        onClick={state.toggleDemoLinks}
        className={cx("demo-links", { hideLinks: !state.showDemoLinks })}
      >
        <h2>
          Demo links
        </h2>

        <ul>
          <li><a href={`#/internal/set-tabs/empty-layout`}>use preset empty-tabs</a></li>
          <li><a href={`#/internal/set-tabs/layout-preset-0`}>set preset 'layout-preset-0'</a></li>
          <li><a href={`#/internal/reset-tabs`}>reset current tabset</a></li>
          <li><a href={`#/internal/test-mutate-tabs`}>test mutate current tabset</a></li>
          <li><a href={`#/internal/remember-tabs`}>remember current tabset</a></li>
          <li><a href={`#/internal/open-tab/HelloWorld?suffix=1`}>open tab hello-world-1</a></li>
          <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld"}`}>open Tty tab</a></li>
          <li><a href={`#/internal/open-tab/World?suffix=2&mapKey=small-map-1`}>open World tab</a></li>
          <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld;%20echo%20foo%20bar!"}`}>open Tty tab with PROFILE with spaces via `%20`</a></li>
          <li><a href={`#/internal/close-tab/hello-world-1`}>close tab hello-world-1</a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"small-map-1"}`}>change "test-world-1" tab props: mapKey=small-map-1 </a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"demo-map-1"}`}>change "test-world-1" tab props: mapKey=demo-map-1 </a></li>
        </ul>
      </div>

    </div>
  );
}

const cssName = {
  closeTab: 'close-tab',
};

const manageCss = css`
  height: 100%;
  width: 100%;
  overflow: auto;

  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 16px;

  color: white;
  background-color: #111;
  padding: 16px;

  h2 {
    font-size: medium;
    margin-bottom: 8px;
  }

  > div {
    margin-bottom: 12px;
    width: 300px;
  }

  ul {
    /* background-color: #333; */
    color: #ccc;
  }
  li {
    display: flex;
    gap: 4px;
    
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: small;

  }

  .tab-defs li {
    justify-content: space-between;

    .tab-def {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .world-key, .map-key {
      color: #aa8;
    }

    .${cssName.closeTab} {
      padding: 0 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: medium;
      color: #f77;
      user-select: none;

      &:hover {
        background-color: #555;
      }
    }
  }

  
  .demo-links {
    display: flex;
    flex-direction: column;

    h2 {
      cursor: pointer;
    }
    a {
      font-size: small;
    }

    &.hideLinks {
      h2 {
        color: #aaa;
      }
      ul {
        display: none;
      }
    }
  }

  a {
    color: #a7a7fb;
  }
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef State
 * @property {boolean} showDemoLinks
 * @property {(e: React.MouseEvent<HTMLDivElement> & { target: HTMLElement }) => void} onClickManageTabs
 * @property {() => void} toggleDemoLinks
 */
