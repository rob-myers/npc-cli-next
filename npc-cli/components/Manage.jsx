import React from "react";
import { css } from "@emotion/react";
import { shallow } from "zustand/shallow";
import cx from "classnames";

import { TABS_API_KEY } from "../service/const";
import { testNever } from "../service/generic";
import { helper } from "../service/helper";
import { computeTabDef } from "../tabs/tab-util";
import useStateRef from "../hooks/use-state-ref";
import useTabs from "../tabs/tabs.store";
import useSession from "../sh/session.store";
import useUpdate from "../hooks/use-update";
import { faCheck, faPlug, faPause, FontAwesomeIcon, faPlus, faClose } from "@/npc-cli/components/Icon";
import PsList from "./PsList";

/** @param {Props} props */
export default function Manage(props) {
  const tabDefs = useTabs(({ tabset: { tabs } }) => tabs.map(x => x.config), shallow);
  const tabsMeta = useTabs(({ tabsMeta }) => tabsMeta, shallow);

  const state = useStateRef(/** @returns {State} */ () => ({
    createTabEpoch: 0,
    profileKeys: process.env.NODE_ENV === 'production'
      ? helper.profileKeys.filter(key => !key.startsWith('dev_only'))
      : helper.profileKeys,
    show: {
      create: false,
      created: false,
      layout: false,
    },

    changeTtyProfile(e) {
      const profileKey = /** @type {Key.Profile} */ (e.currentTarget.value);
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabId = /** @type {string} */ (li.dataset.tabId);
      useTabs.api.changeTabProps(tabId, { profileKey });
    },
    closeTab(e) {
      const tabId = /** @type {Key.TabId} */ (e.currentTarget.dataset.tabId);
      useTabs.api.closeTab(tabId);
    },
    createTab(e) {
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabClassKey = /** @type {Key.TabClass} */ (li.dataset.tabClass);

      const nextTabId = useTabs.api.getNextSuffix(tabClassKey);

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
            profileKey: /** @type {Key.Profile} */ (profileSelect.value),
            env: {// default WORLD_KEY is `world-0`
              WORLD_KEY: `${helper.toTabClassMeta.World.tabPrefix}-${worldKeyInput.value || 0}`,
              TABS_API_KEY,
            },
          });
          break;
        }
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

      const created = useTabs.api.openTab(tabDef);
      
      if (created && Date.now() - state.createTabEpoch >= 600) {
        // select on long-press
        useTabs.api.selectTab(tabDef.filepath);
      }
    },
    selectTab(e) {
      const tabId = /** @type {string} */ (e.currentTarget.dataset.tabId);
      // console.log('select', tabId);
      useTabs.api.selectTab(tabId);
    },
    setMapKey(e) {
      const mapKey = /** @type {Key.Map} */ (e.currentTarget.value);
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabId = /** @type {string} */ (li.dataset.tabId);
      useTabs.api.changeTabProps(tabId, { mapKey });
    },
    syncWorldKey(e) {
      const li = /** @type {HTMLLIElement} */ (e.currentTarget.closest('li'));
      const tabId = /** @type {Key.TabId} */ (li.dataset.tabId);
      const worldKey = useSession.api.getSession(tabId)?.var.WORLD_KEY;
      helper.isTabId(worldKey) && useTabs.api.updateTabMeta({
        key: tabId,
        ttyWorldKey: worldKey,
      });
    },
    toggleShown(e) {
      const ul = /** @type {HTMLUListElement} */ (e.currentTarget.closest('ul'));
      const sectionKey = /** @type {keyof typeof state['show']} */ (ul.dataset.section);
      state.show[sectionKey] = !state.show[sectionKey];
      update();
    },
  }));

  const update = useUpdate();

  return (
    <div css={manageCss}>
    
      <div className="manage-tabs">

        <ul
          className={cx("created-tabs", { showCreated: state.show.created })}
          data-section="created"
        >
          {tabDefs.map((def, i) => {
            const tabId = def.filepath;
            const tabMeta = tabsMeta[tabId];
            const disabled = tabMeta?.disabled === true;
            const unmounted = tabMeta === undefined;

            return (
              <li key={tabId} data-tab-id={tabId}>
                {i === 0 && (
                  <span
                    className="title"
                    onClick={state.toggleShown}
                  >
                    Tabs
                  </span>
                )}
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
                  <span className="tab-def-options">
                    {def.type === 'terminal' && <>
                      <span
                        className="sync-world-key"
                        onClick={state.syncWorldKey}
                      >
                        {tabMeta?.ttyWorldKey ?? def.env?.WORLD_KEY ?? '-'}
                      </span>
                      <select
                        value={def.profileKey}
                        onChange={state.changeTtyProfile}
                      >
                        {state.profileKeys.map(profileKey =>
                          <option key={profileKey} value={profileKey}>{profileKey}</option>
                        )}
                      </select>
                    </>}
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
                    className="close-tab"
                    color="#f66"
                    icon={faClose}
                    size="1x"
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <ul
          className={cx("create-tabs", { showCreate: state.show.create })}
          data-section="create"
        >

          <li data-tab-class={helper.toTabClassMeta.World.key}>
            <span
              className="title"
              onClick={state.toggleShown}
            >
              Create
            </span>
            <span className="tab-create-def">
              <span className="tab-class">
                World
              </span>
              <span className="tab-def-options">
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
            <span className="tab-create-def">
              <span className="tab-class">
                Tty
              </span>
              <span className="tab-def-options">
                <select data-profile-key defaultValue={state.profileKeys[0]}>
                  {state.profileKeys.map(profileKey =>
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
            <span className="tab-create-def">
              <span className="tab-class">
                HelloWorld
              </span>
            </span>
            <CreateButton state={state} />
          </li>
        </ul>

        <ul
          className={cx("layout-actions", { showLayout: state.show.layout })}
          data-section="layout"
        >
          <li
            className="title"
            onClick={state.toggleShown}
          >
            Layout
          </li>
          <li>
            <a href={`#/internal/set-tabs/world-tty-default_profile`}>world + tty (default_profile)</a>
          </li>
          <li>
            <a href={`#/internal/set-tabs/world-tty-profile_1`}>world + tty (profile_1)</a>
          </li>
          <li>
            <a href={`#/internal/remember-tabs`}>remember tabset</a>
          </li>
          <li>
            <a href={`#/internal/reset-tabs`}>revert tabset</a>
          </li>
          <li>
            <a href={`#/internal/set-tabs/empty-layout`}>clear tabs</a>
          </li>

          {/*           
          <li><a href={`#/internal/reset-tabs`}>reset current tabset</a></li>
          <li><a href={`#/internal/test-mutate-tabs`}>test mutate current tabset</a></li>
          <li><a href={`#/internal/remember-tabs`}>remember current tabset</a></li>
          <li><a href={`#/internal/open-tab/HelloWorld?id=hello-world-1`}>open tab hello-world-1</a></li>
          <li><a href={`#/internal/open-tab/Tty?id=tty-4&profileKey=profileAwaitWorldSh&env={WORLD_KEY:"test-world-1",FOO:"BAR",TABS_API_KEY:"TABS_API_KEY"}`}>open Tty tab</a></li>
          */}
          
          {/* <li><a href={`#/internal/open-tab/World?id=world-2&mapKey=small-map-1`}>open World tab</a></li>
          <li><a href={`#/internal/close-tab/hello-world-1`}>close tab hello-world-1</a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"small-map-1"}`}>change "test-world-1" tab props: mapKey=small-map-1 </a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"demo-map-1"}`}>change "test-world-1" tab props: mapKey=demo-map-1 </a></li> */}
        </ul>
        
      </div>

      <PsList/>

      <br/>
      <br/>
    </div>
  );
}

const manageCss = css`
  --separating-border: 1px solid rgba(80, 80, 80, 0.5);
  --select-or-input-color: #f1d092;

  height: 100%;
  width: 100%;
  overflow: auto;

  display: flex;
  flex-direction: column;
  align-content: flex-start;
  gap: 16px;

  background-color: #111;
  padding: 16px;

  .manage-tabs {
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
  }

  .create-tabs, .created-tabs {
    display: flex;
    flex-direction: column;
    /* flex-wrap: wrap; */
    font-size: small;
    border: var(--separating-border);

    li:first-of-type {
      flex: 1;
    }
  }
  
  .create-tabs li, .created-tabs li {
    display: flex;
    border: var(--separating-border);
    background-color: #111;
    justify-content: space-between;
    align-items: stretch;
    gap: 8px;
    color: white;

    .tab-status-and-id {
      display: flex;
      align-items: center;
      padding: 8px;
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
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: stretch;
      gap: 8px;
    }
    .tab-id {
      color: #aac;
      text-wrap: nowrap;
    }
    .tab-create-def {
      flex: 1;
      display: flex;
      justify-content: center;
      gap: 4px;
      padding-left: 12px;
      /* padding: 8px; */
    }
    .tab-class {
      display: flex;
      gap: 6px;
      align-items: center;
      user-select: none;
      font-family: 'Courier New', Courier, monospace;
      font-size: medium;
      font-weight: 500;
      color: white;
    }
    .close-tab {
      cursor: pointer;
      font-family: monospace;
      font-size: large;
      user-select: none;
      padding: 10px;
      border-left: var(--separating-border);
    }
    .tab-def-options {
      display: flex;
      gap: 8px;
      max-width: 200px;
      align-items: stretch;
  
      .sync-world-key {
        display: flex;
        align-items: center;
        min-width: 60px;
        font-size: small;
        font-style: italic;
        cursor: pointer;
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
    .open-tab {
      border-left: var(--separating-border);
      padding: 8px;
      cursor: pointer;
      user-select: none;
      padding: 10px;
    }
  }

  .layout-actions {
    display: flex;
    flex-wrap: wrap;
    /* background-color: #222; */
    border: var(--separating-border);
    
    li {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      border: var(--separating-border);
      background-color: #111;
      padding: 8px;
    }
    a {
      font-size: small;
      color: #a7a7fb;
    }
  }

  ul .title {
    width: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    user-select: none;
    padding: 12px;
    color: #fff;
    font-size: small;
    background-color: #333;
    border-color: rgba(0, 0, 0, 0);
  }

  ul.created-tabs :not(.showCreated) {
    li {
      border: none;
    }
    .tab-def, button {
      display: none;
    }
  }
  ul.create-tabs:not(.showCreate) {
    li {
      border: none;
    }
    .tab-create-def, button {
      display: none;
    }
  }
  ul.layout-actions :not(.showLayout) {
    li:not(.title) {
      display: none;
    }
  }

  /* 🔔 Applies to subcomponents e.g. <PsList/> */
  select, input {
    width: 100%;
    height: 100%;
    -webkit-appearance: none;
    appearance: none;
    padding: 0 2px;
    background-color: inherit;
    color: var(--select-or-input-color);
    font-size: small;
    text-align: center;
    cursor: pointer;
  }
  select::placeholder, input::placeholder {
    color: #555;
  }
  button {
    display: flex;
    align-items: center;
    height: 100%;
  }
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef State
 * @property {number} createTabEpoch
 * @property {Key.Profile[]} profileKeys No `dev_only*` profiles in production
 * @property {{ create: boolean; created: boolean; layout: boolean; }} show
 * @property {OnChangeHandler} changeTtyProfile
 * @property {OnClickHandler} closeTab
 * @property {OnClickHandler} createTab
 * @property {OnClickHandler} selectTab
 * @property {OnChangeHandler} setMapKey
 * @property {OnClickHandler} syncWorldKey
 * @property {OnClickHandler} toggleShown
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
        className="open-tab"
        color="#5a5"
        icon={faPlus}
        size="1x"
      />
    </button>
  );
}
