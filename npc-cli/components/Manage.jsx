import React from "react";
import { css } from "@emotion/react";
import { shallow } from "zustand/shallow";
import { testNever } from "../service/generic";
import { helper } from "../service/helper";
import { computeTabDef } from "../tabs/tab-util";
// import { mapKeys } from './'; // 🔔 keep this facade
import useStateRef from "../hooks/use-state-ref";
import useSite from "@/components/site.store";
import { faCheck, faPlug, faPause, FontAwesomeIcon, faPlus, faClose } from "@/components/Icon";

/** @param {Props} props */
export default function Manage(props) {
  const tabDefs = useSite(({ tabset: { tabs } }) => tabs.map(x => x.config), shallow);
  const tabsMeta = useSite(({ tabsMeta }) => tabsMeta, shallow);

  const state = useStateRef(/** @returns {State} */ () => ({
    closeTab(e) {
      const tabId = /** @type {string} */ (e.currentTarget.dataset.tabId);
      useSite.api.closeTab(tabId);
    },
    createTab(e) {
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabClassKey = /** @type {Key.TabClass} */ (li.dataset.tabClass);
      
      const nextTabId = useSite.api.getNextTabId(tabClassKey);
        
      /** @type {import("../tabs/tab-factory").TabDef} */ let tabDef;
      switch (tabClassKey) {
        case 'World': {
          const [mapSelect] = [...li.querySelectorAll('select')].filter(
            x => x.dataset.mapKey
          );
          tabDef = computeTabDef({
            classKey: tabClassKey,
            id: nextTabId,
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
            id: nextTabId,
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
            id: nextTabId,
          });
          break;
        default:
          throw testNever(tabClassKey);
      }

      useSite.api.openTab(tabDef);
    },
    selectTab(e) {
      const tabId = /** @type {string} */ (e.currentTarget.dataset.tabId);
      console.log('select', tabId);
      useSite.api.selectTab(tabId);
    },
    setMapKey(e) {
      const mapKey = /** @type {Key.Map} */ (e.currentTarget.value);
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabId = /** @type {Key.TabClass} */ (li.dataset.tabId);
      useSite.api.changeTabProps(tabId, { mapKey });
    },
  }));

  return (
    <div css={manageCss}>

      <div className="current-tabs-container">
        <h2>Current Tabs</h2>

        <ul className="current-tabs">
          {tabDefs.map(def => {
            const tabId = def.filepath;
            const tabMeta = tabsMeta[tabId];
            const disabled = tabMeta?.disabled === true;
            const unmounted = tabMeta === undefined;

            return <li key={tabId} data-tab-id={tabId}>
              <span className="tab-def">
                <span className="tab-status-and-id">
                  <span className="tab-status">
                    {(
                      disabled === true && <FontAwesomeIcon title="disabled" icon={faPause} size="1x" />
                      || unmounted === true && <FontAwesomeIcon title="unmounted" icon={faPlug} size="1x" />
                      || <FontAwesomeIcon title="enabled" icon={faCheck} size="1x" />
                    )}
                  </span>
                  <span
                    className="tab-id"
                    data-tab-id={tabId}
                    onClick={state.selectTab}
                  >
                    {def.filepath}
                  </span>
                </span>
                <span className="options">
                  {def.type === 'terminal' && (
                    <span className="world-key">{`(${def.env?.WORLD_KEY})`}</span>
                  )}
                  {def.type === 'component' && def.class === 'World' && (
                    <select
                      defaultValue={def.props.mapKey}
                      onChange={state.setMapKey}
                    >
                      {helper.mapKeys.map(mapKey => <option key={mapKey} value={mapKey}>{mapKey}</option>)}
                    </select>
                  )}
                </span>
              </span>
              <FontAwesomeIcon
                className={cssName.closeTab}
                data-tab-id={tabId}
                onClick={state.closeTab}
                color="#f66"
                icon={faClose}
                size="1x"
              />
            </li>
          })}
        </ul>
      </div>
      
      <div className="create-tabs-container">
        <h2>Create Tabs</h2>
        
        <ul className="create-tabs">

          <li data-tab-class={helper.toTabClassMeta.World.key}>
            <span className="tab-def">
              <span className="tab-class">
                World
              </span>
              <span className="options">
                <select data-map-key={true} defaultValue={helper.mapKeys[0]}>
                  {helper.mapKeys.map(mapKey =>
                    <option key={mapKey} value={mapKey}>{mapKey}</option>
                  )}
                </select>
              </span>
            </span>
            <button onClick={state.createTab}>
              <FontAwesomeIcon
                className={cssName.openTab}
                color="#5a5"
                icon={faPlus}
                size="1x"
              />
            </button>
          </li>

          <li data-tab-class={helper.toTabClassMeta.Tty.key}>
            <span className="tab-def">
              <span className="tab-class">
                Tty
              </span>
              <span className="options">
                <select data-profile-key={true} defaultValue={helper.profileKeys[0]}>
                  {helper.profileKeys.map(profileKey =>
                    <option key={profileKey} value={profileKey}>{profileKey}</option>
                  )}
                </select>
                <input data-world-key type="text" placeholder="world-key" />
              </span>
            </span>
            <button onClick={state.createTab}>
              <FontAwesomeIcon
                className={cssName.openTab}
                color="#5a5"
                icon={faPlus}
                size="1x"
              />
            </button>
          </li>

          <li data-tab-class={helper.toTabClassMeta.HelloWorld.key}>
            <span className="tab-def">
              <span className="tab-class">
                HelloWorld
              </span>
            </span>
            <button onClick={state.createTab}>
              <FontAwesomeIcon
                className={cssName.openTab}
                color="#5a5"
                icon={faPlus}
                size="1x"
              />
            </button>
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
          <li><a href={`#/internal/open-tab/HelloWorld?id=hello-world-1`}>open tab hello-world-1</a></li>
          <li><a href={`#/internal/open-tab/Tty?id=tty-4&profileKey=profileAwaitWorldSh&env={WORLD_KEY:"test-world-1",FOO:"BAR"}`}>open Tty tab</a></li>
          {/* 🔔 do not support custom profile: must use profileKey so can be synced against file */}
          {/* <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld"}`}>open Tty tab</a></li> */}
          {/* <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld;%20echo%20foo%20bar!"}`}>open Tty tab with PROFILE with spaces via `%20`</a></li> */}
          <li><a href={`#/internal/open-tab/World?id=world-2&mapKey=small-map-1`}>open World tab</a></li>
          <li><a href={`#/internal/close-tab/hello-world-1`}>close tab hello-world-1</a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"small-map-1"}`}>change "test-world-1" tab props: mapKey=small-map-1 </a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"demo-map-1"}`}>change "test-world-1" tab props: mapKey=demo-map-1 </a></li>
        </ul>
      </div>
    </div>
  );
}

const cssName = /** @type {const} */ ({
  closeTab: 'close-tab',
  openTab: 'open-tab',
});

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
    align-items: center;
    gap: 8px;
    color: #aac;

    .tab-status-and-id {
      display: flex;
      align-items: center;
      padding: 6px 0 6px 8px;
      cursor: pointer;
    }

    .tab-status {
      padding: 0 4px;
      margin-right: 8px;
      cursor: auto;
      background-color: #000;
      color: #bbb;
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

  .${cssName.closeTab} {
    cursor: pointer;
    font-family: monospace;
    font-size: large;
    user-select: none;
    padding: 8px;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
  }

  .create-tabs li {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #aaa;
    
    .tab-def {
      display: flex;
      padding-left: 12px;
      gap: 4px;
    }

    .tab-class {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: 1rem;
      user-select: none;
    }
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
    font-size: small;
    padding: 0 2px;
  }
  input::placeholder {
    color: #555;
  }
  
  .${cssName.openTab} {
    border-left: 1px solid rgba(255, 255, 255, 0.15);
    padding: 8px;
    cursor: pointer;
    user-select: none;
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
 * @property {OnClickHandler} closeTab
 * @property {OnClickHandler} createTab
 * @property {OnClickHandler} selectTab
 * @property {OnChangeHandler} setMapKey
 */

/**
 * @typedef {(e: React.MouseEvent<HTMLElement | SVGElement> & {
 *   currentTarget: HTMLElement | SVGElement
 * }) => void} OnClickHandler
 */

/**
 * @typedef {(e: React.ChangeEvent<HTMLSelectElement> & {
 *   currentTarget: HTMLSelectElement
 * }) => void} OnChangeHandler
 */
