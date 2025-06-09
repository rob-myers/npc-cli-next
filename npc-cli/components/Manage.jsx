import React from "react";
import { css } from "@emotion/react";
import { shallow } from "zustand/shallow";
import { testNever } from "../service/generic";
import { helper } from "../service/helper";
import { computeTabDef } from "../tabs/tab-util";
// import { mapKeys } from './'; // 🔔 keep this facade
import useStateRef from "../hooks/use-state-ref";
import useSite from "@/components/site.store";
import useSession from "../sh/session.store";
import { faCheck, faPlug, faPause, FontAwesomeIcon, faPlus, faClose } from "@/components/Icon";

/** @param {Props} props */
export default function Manage(props) {
  const tabDefs = useSite(({ tabset: { tabs } }) => tabs.map(x => x.config), shallow);
  const tabsMeta = useSite(({ tabsMeta }) => tabsMeta, shallow);

  const state = useStateRef(/** @returns {State} */ () => ({
    createTabEpoch: 0,
    closeTab(e) {
      const tabId = /** @type {string} */ (e.currentTarget.dataset.tabId);
      useSite.api.closeTab(tabId);
    },
    createTab(e) {
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabClassKey = /** @type {Key.TabClass} */ (li.dataset.tabClass);

      const nextTabId = useSite.api.getNextSuffix(tabClassKey);

      /** @type {import("../tabs/tab-factory").TabDef} */ let tabDef;
      switch (tabClassKey) {
        case 'World': {
          const [mapSelect] = [...li.querySelectorAll('select')].filter(
            x => x.dataset.mapKey
          );
          tabDef = computeTabDef({
            classKey: tabClassKey,
            id: `world-${nextTabId}`,
            mapKey: /** @type {Key.Map} */ (mapSelect.value),
          });
          break;
        }
        case 'Tty': {
          const [profileSelect] = [...li.querySelectorAll('select')].filter(
            x => x.dataset.profileKey
          );
          const [worldKeyInput] = [...li.querySelectorAll('input')].filter(
            x => x.dataset.worldKeySuffix
          );
          tabDef = computeTabDef({
            classKey: tabClassKey,
            id: `tty-${nextTabId}`,
            ...Number.isInteger(Number(worldKeyInput.value)) && {
              profileKey: /** @type {Key.Profile} */ (profileSelect.value),
              env: { WORLD_KEY: `${helper.toTabClassMeta.World.tabPrefix}-${worldKeyInput.value}` },
            } || {
              profileKey: 'profile-empty-sh',
            },
          });
          break;
        }
        case 'Debug':
          tabDef = computeTabDef({
            classKey: tabClassKey,
            id: `debug-${nextTabId}`,
          });
          break;
        case 'HelloWorld':
          tabDef = computeTabDef({
            classKey: tabClassKey,
            id: `hello-world-${nextTabId}`,
          });
          break;
        case 'Manage':
          tabDef = computeTabDef({
            classKey: tabClassKey,
            id: `manage-${nextTabId}`,
          });
          break;
        default:
          throw testNever(tabClassKey);
      }

      const created = useSite.api.openTab(tabDef);
      
      if (created && Date.now() - state.createTabEpoch >= 600) {
        // select on long-press
        useSite.api.selectTab(tabDef.filepath);
      }
    },
    selectTab(e) {
      const tabId = /** @type {string} */ (e.currentTarget.dataset.tabId);
      console.log('select', tabId);
      useSite.api.selectTab(tabId);
    },
    setMapKey(e) {
      const mapKey = /** @type {Key.Map} */ (e.currentTarget.value);
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabId = /** @type {string} */ (li.dataset.tabId);
      useSite.api.changeTabProps(tabId, { mapKey });
    },
    syncWorldKey(e) {
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabId = /** @type {Key.TabId} */ (li.dataset.tabId);
      const worldKey = useSession.api.getSession(tabId)?.var.WORLD_KEY;
      typeof worldKey === 'string' && useSite.api.updateTabMeta({
        key: tabId,
        ttyWorldKey: worldKey,
      });
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
                  <button
                    className="tab-id"
                    data-tab-id={tabId}
                    onClick={state.selectTab}
                  >
                    {def.filepath}
                  </button>
                </span>
                <span className="options">
                  {def.type === 'terminal' && (
                    <span
                      className="sync-world-key"
                      onClick={state.syncWorldKey}
                    >
                      {tabMeta?.ttyWorldKey ?? def.env?.WORLD_KEY ?? '-'}
                    </span>
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
              <button
                onClick={state.closeTab}
                data-tab-id={tabId}
              >
                <FontAwesomeIcon
                  className={cssName.closeTab}
                  color="#f66"
                  icon={faClose}
                  size="1x"
                />
              </button>
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
                <select data-map-key defaultValue={helper.mapKeys[0]}>
                  {helper.mapKeys.map(mapKey =>
                    <option key={mapKey} value={mapKey}>{mapKey}</option>
                  )}
                </select>
              </span>
            </span>
            <CreateButton state={state} />
          </li>

          <li data-tab-class={helper.toTabClassMeta.Tty.key}>
            <span className="tab-def">
              <span className="tab-class">
                Tty
              </span>
              <span className="options">
                <select data-profile-key defaultValue={helper.profileKeys[0]}>
                  {helper.profileKeys.map(profileKey =>
                    <option key={profileKey} value={profileKey}>{profileKey}</option>
                  )}
                </select>
                <span className="world-key">
                  world-
                  <input
                    data-world-key-suffix
                    type="text"
                    placeholder="0"
                    pattern="[0-9]{1}"
                    size={2}
                    defaultValue={0}
                  />
                </span>
              </span>
            </span>
            <CreateButton state={state} />
          </li>

          <li data-tab-class={helper.toTabClassMeta.HelloWorld.key}>
            <span className="tab-def">
              <span className="tab-class">
                HelloWorld
              </span>
            </span>
            <CreateButton state={state} />
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
  --separating-border: 1px solid rgba(80, 80, 80, 1);

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
      border: var(--separating-border);
    }
  }

  .current-tabs li {
    justify-content: space-between;
    align-items: stretch;
    gap: 8px;
    color: #aac;

    .tab-status-and-id {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding-left: 8px;
    }
    
    .tab-status {
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
      /* flex-wrap: wrap; */
      align-items: stretch;
      gap: 8px;
    }
  }

  .${cssName.closeTab} {
    cursor: pointer;
    font-family: monospace;
    font-size: large;
    user-select: none;
    padding: 10px;
    border-left: var(--separating-border);
  }

  .create-tabs li {
    display: flex;
    align-items: stretch;
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
      user-select: none;
      font-family: 'Courier New', Courier, monospace;
      font-size: medium;
      font-weight: 500;
    }
  }
  
  .options {
    display: flex;
    gap: 8px;
    max-width: 200px;
    align-items: stretch;

    /* background-color: #222; */
    
    .sync-world-key {
      display: flex;
      align-items: center;
      font-size: small;
      cursor: pointer;
      
      /* &:hover, &:active {
        font-style: italic;
        } */
      }
      
    .world-key {
      display: flex;
      align-items: center;
      font-size: small;
      
      input {
        width: 20px;
      }
    }
  }
  select, input {
    width: 100%;
    height: 100%;
    -webkit-appearance: none;
    appearance: none;
    background-color: inherit;
    filter: sepia();
    color: inherit;
    font-size: small;
    padding: 0 2px;
    text-align: center;
  }
  select::placeholder, input::placeholder {
    color: #555;
  }

  button {
    display: flex;
    align-items: center;
    height: 100%;
  }
  
  .${cssName.openTab} {
    border-left: var(--separating-border);
    padding: 8px;
    cursor: pointer;
    user-select: none;
    padding: 10px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;

    li {
      padding: 4px 8px;
      border: var(--separating-border);
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
 * @property {number} createTabEpoch
 * @property {OnClickHandler} closeTab
 * @property {OnClickHandler} createTab
 * @property {OnClickHandler} selectTab
 * @property {OnChangeHandler} setMapKey
 * @property {OnClickHandler} syncWorldKey
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

/** @param {{ state: State }} props */
function CreateButton({ state }) {
  return (
    <button
      onClick={state.createTab}
      onPointerDown={() => state.createTabEpoch = Date.now()}
    >
      <FontAwesomeIcon
        className={cssName.openTab}
        color="#5a5"
        icon={faPlus}
        size="1x"
      />
    </button>
  );
}
