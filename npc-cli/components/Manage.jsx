import React from "react";
import { css } from "@emotion/react";
import cx from "classnames";
import { testNever } from "../service/generic";
import { helper } from "../service/helper";
import { computeTabDef, extractTabNodes } from "../tabs/tab-util";
// import { mapKeys } from './'; // 🔔 keep this facade
import useStateRef from "../hooks/use-state-ref";
import useSite from "@/components/site.store";
import useUpdate from "../hooks/use-update";


/** @param {Props} props */
export default function Manage(props) {

  // console.log({geomorphs, mapKeys});

  const tabDefs = useSite(({ tabset }) =>
    extractTabNodes(tabset.synced).map(x => x.config)
  );

  const state = useStateRef(/** @returns {State} */ () => ({
    showDemoLinks: false,

    onClickCreateTabs({ target: el }) {
      const li = el.closest('li');
      const tabClassKey = li?.dataset.tabClass;
      if (!(li !== null && typeof tabClassKey === 'string' && helper.isTabClassKey(tabClassKey))) {
        return;
      }

      if (el.classList.contains(cssName.createTab)) {
        // console.log('create tab', tabClass);

        // 🚧 clean
        const suffix = `${useSite.api.getTabClassNextSuffix(tabClassKey)}`;

        /** @type {import("../tabs/tab-factory").TabDef} */ let tabDef;
        switch (tabClassKey) {
          case 'World': {
            const [mapSelect] = [...li.querySelectorAll('select')].filter(
              x => x.dataset.mapKey
            );
            tabDef = computeTabDef({
              classKey: tabClassKey,
              suffix,
              mapKey: /** @type {Key.Map} */ (mapSelect.value),
            });
            break;
          }
          case 'Tty': {
            const [profileSelect] = [...li.querySelectorAll('select')].filter(
              x => x.dataset.profileKey
            );
            const [worldKeyInput] = [...li.querySelectorAll('input')].filter(
              x => x.dataset.worldKey
            );
            tabDef = computeTabDef({
              classKey: tabClassKey,
              suffix,
              ...worldKeyInput.value && {
                profileKey: /** @type {Key.Profile} */ (profileSelect.value),
                env: { WORLD_KEY: worldKeyInput.value },
              } || {
                profileKey: 'profileEmptySh',
              },
            });
            break;
          }
          case 'Debug':
          case 'HelloWorld':
          case 'Manage': // 🚧
            tabDef = computeTabDef({
              classKey: tabClassKey,
              suffix,
            });
            break;
          default:
            throw testNever(tabClassKey);
        }

        useSite.api.openTab(tabDef);
      }
    },
    onClickDemoLinks({ target: el }) {
      if (el.matches('h2') === true) {
        state.showDemoLinks = !state.showDemoLinks;
        update();
      }
    },
    onClickCurrentTabs({ target: el }) {
      const tabId = el.closest('li')?.dataset.tabId;
      if (typeof tabId !== 'string') {
        return;
      }

      if (el.classList.contains(cssName.closeTab)) {
        useSite.api.closeTab(tabId);
      }
    },
  }));

  const update = useUpdate();

  return (
    <div css={manageCss}>
      <div 
        className="current-tabs"
        onClick={state.onClickCurrentTabs}
      >
        <h2>
          Current Tabs
        </h2>

        <ul>
          {tabDefs.map(def =>
            <li
              key={def.filepath}
              data-tab-id={def.filepath}
            >
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
      
      <div
        className="create-tabs"
        onClick={state.onClickCreateTabs}
      >
        <h2>Create Tabs</h2>
        
        <ul>
          <li data-tab-class={helper.toTabClassMeta.World.key}>
            <span className="tab-class">
              World
            </span>
            <select data-map-key={true} defaultValue={helper.mapKeys[0]}>
              {helper.mapKeys.map(mapKey =>
                <option key={mapKey} value={mapKey}>{mapKey}</option>
              )}
            </select>
            <span className={cssName.createTab}>
              +
            </span>
          </li>

          <li data-tab-class={helper.toTabClassMeta.Tty.key}>
            <span className="tab-class">
              Tty
            </span>
            <div className="options">
              <select data-profile-key={true} defaultValue={helper.profileKeys[0]}>
                {helper.profileKeys.map(profileKey =>
                  <option key={profileKey} value={profileKey}>{profileKey}</option>
                )}
              </select>
              <input data-world-key type="text" placeholder="world-key" />
            </div>
            <span className={cssName.createTab}>
              +
            </span>
          </li>

          <li data-tab-class={helper.toTabClassMeta.HelloWorld.key}>
            <span className="tab-class">
              HelloWorld
            </span>
            <span className={cssName.createTab}>
              +
            </span>
          </li>
        </ul>
      </div>

      <div
        onClick={state.onClickDemoLinks}
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
          <li><a href={`#/internal/open-tab/Tty?suffix=4&profileKey=profileAwaitWorldSh&env={WORLD_KEY:"test-world-1",FOO:"BAR"}`}>open Tty tab</a></li>
          {/* 🔔 do not support custom profile: must use profileKey so can be synced against file */}
          {/* <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld"}`}>open Tty tab</a></li> */}
          {/* <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld;%20echo%20foo%20bar!"}`}>open Tty tab with PROFILE with spaces via `%20`</a></li> */}
          <li><a href={`#/internal/open-tab/World?suffix=2&mapKey=small-map-1`}>open World tab</a></li>
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
  createTab: 'create-tab',
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
    color: #ccc;
  }
  li {
    display: flex;
    gap: 4px;
    
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: small;

  }

  .current-tabs {
    width: 200px;
  }
  .current-tabs li {
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

  .create-tabs {
    width: 240px;

    li {
      justify-content: space-between;
    }

    .tab-class {
      flex: 1;
      padding: 0 4px;
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    select, input {
      background-color: inherit;
      color: inherit;
      border: 1px solid #555;
      max-width: 100px;
    }
    input::placeholder {
      color: #555;
    }

    .${cssName.createTab} {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;

      margin: 0 2px 0 8px;
      cursor: pointer;
      font-family: monospace;
      font-size: large;
      /* background-color: #9bd19b; */
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      color: #9bd19b;
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
 * @property {(e: React.MouseEvent<HTMLDivElement> & { target: HTMLElement }) => void} onClickCreateTabs
 * @property {(e: React.MouseEvent<HTMLDivElement> & { target: HTMLElement }) => void} onClickCurrentTabs
 * @property {(e: React.MouseEvent<HTMLDivElement> & { target: HTMLElement }) => void} onClickDemoLinks
 */
