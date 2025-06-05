import React from "react";
import { css } from "@emotion/react";
import { shallow } from "zustand/shallow";
import { testNever } from "../service/generic";
import { helper } from "../service/helper";
import { computeTabDef } from "../tabs/tab-util";
// import { mapKeys } from './'; // 🔔 keep this facade
import useStateRef from "../hooks/use-state-ref";
import useSite from "@/components/site.store";
import { faCheck, faHourglass3, faPlug, FontAwesomeIcon } from "@/components/Icon";

/** @param {Props} props */
export default function Manage(props) {

  const tabDefs = useSite(({ tabset: { tabs } }) =>
    tabs.map(x => x.config),
    shallow,
  );

  const tabsMeta = useSite(({ tabsMeta }) =>
    tabsMeta,
    shallow,
  );

  const state = useStateRef(/** @returns {State} */ () => ({
    onClickCreateTabs({ target: el }) {
      const li = el.closest('li');
      const tabClassKey = li?.dataset.tabClass;
      if (!(
        li !== null
        && typeof tabClassKey === 'string'
        && helper.isTabClassKey(tabClassKey)
      )) {
        return;
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        return;
      }

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
              profileKey: 'profile-empty-sh',
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

  return (
    <div css={manageCss}>

      <div 
        className="current-tabs-container"
        onClick={state.onClickCurrentTabs}
      >
        <h2>Current Tabs</h2>

        <ul className="current-tabs">
          {tabDefs.map(def => {

            const tabMeta = tabsMeta[def.filepath];
            const disabled = tabMeta?.disabled === true;
            const unmounted = tabMeta === undefined;

            return <li
              key={def.filepath}
              data-tab-id={def.filepath}
            >
              <span className="tab-def">
                <span className="tab-status-and-id">
                  <span className="tab-status">
                    {(
                      disabled === true && <FontAwesomeIcon title="disabled" icon={faHourglass3} size="1x" />
                      || unmounted === true && <FontAwesomeIcon title="unmounted" icon={faPlug} size="1x" />
                      || <FontAwesomeIcon title="enabled" icon={faCheck} size="1x" />
                    )}
                  </span>
                  {def.filepath}
                </span>
                {def.type === 'terminal' && <span className="world-key">{`(${def.env?.WORLD_KEY})`}</span>}
                {def.type === 'component' && def.class === 'World' && <span className="map-key">{`(${def.props.mapKey})`}</span>}
              </span>
              <span className={cssName.closeTab}>
                ⨉
              </span>
            </li>
          })}
        </ul>
      </div>
      
      <div
        className="create-tabs-container"
        onClick={state.onClickCreateTabs}
      >
        <h2>Create Tabs</h2>
        
        <ul className="create-tabs">
          <li data-tab-class={helper.toTabClassMeta.World.key}>
            <span className={cssName.createTab}>
              +
            </span>
            <span className="tab-class">
              World
            </span>
            <div className="options">
              <select data-map-key={true} defaultValue={helper.mapKeys[0]}>
                {helper.mapKeys.map(mapKey =>
                  <option key={mapKey} value={mapKey}>{mapKey}</option>
                )}
              </select>
            </div>
          </li>

          <li data-tab-class={helper.toTabClassMeta.Tty.key}>
            <span className={cssName.createTab}>
              +
            </span>
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
          </li>

          <li data-tab-class={helper.toTabClassMeta.HelloWorld.key}>
            <span className={cssName.createTab}>
              +
            </span>
            <span className="tab-class">
              HelloWorld
            </span>
          </li>
        </ul>

      </div>

      <div className="actions">
        <h2>Actions 🚧</h2>

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
  flex-direction: column;
  align-content: flex-start;
  gap: 16px;

  background-color: #111;
  padding: 16px;
  
  h2 {
    font-size: small;
    color: #ccc;
  }

  .current-tabs-container, .create-tabs-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .current-tabs, .create-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    li {
      display: flex;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
  }

  .current-tabs li {
    justify-content: space-between;
    gap: 8px;
    color: #aac;

    .tab-status-and-id {
      display: flex;
      align-items: center;
      padding: 6px 8px;
    }

    .tab-status {
      padding: 0 4px;
      margin-right: 8px;
      background-color: #000;
      color: #999;
      border-radius: 50%;
      outline: 1px solid rgba(255, 255, 255, 0.25);


      display: flex;
      justify-content: center;
      align-items: center;
      width: 18px;
      height: 18px;

      > svg {
        font-size: 0.7rem;
      }
    }

    .tab-def {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .world-key, .map-key {
      color: #aa8;
      font-size: small;
      display: flex;
      align-items: end;
    }
  }

  .${cssName.closeTab}, .${cssName.createTab} {
    cursor: pointer;
    font-family: monospace;
    font-size: large;
    user-select: none;
  }

  .${cssName.closeTab} {
    padding: 4px 8px;
    color: #f66;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
    justify-content: center;
  }

  .create-tabs li {
    display: flex;
    align-items: center;
    padding: 0 8px;
    cursor: pointer;
    color: #aaa;
    
    .tab-class {
      padding: 8px 6px;
    }
    .options {
      display: flex;
      gap: 8px;
      max-width: 200px;
    }

    select, input {
      width: 100%;
      background-color: inherit;
      color: inherit;
      /* border: 1px solid #555; */
      padding: 4px;
    }
    input::placeholder {
      color: #555;
    }
  }  

  .${cssName.createTab} {
    color: #9bd19b;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;

    li {
      padding: 4px 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    a {
      font-size: small;
      color: #a7a7fb;
    }
  }
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef State
 * @property {(e: React.MouseEvent<HTMLDivElement> & { target: HTMLElement }) => void} onClickCreateTabs
 * @property {(e: React.MouseEvent<HTMLDivElement> & { target: HTMLElement }) => void} onClickCurrentTabs
 */
