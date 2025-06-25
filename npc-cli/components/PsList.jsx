import React from "react";
import cx from "classnames";
import { shallow } from "zustand/shallow";
import { css } from "@emotion/react";
import { error } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useTabs from "../tabs/tabs.store";
import useSession, { ProcessStatus } from "../sh/session.store";
import { faRefresh, faPause, faPlay, faClose, FontAwesomeIcon } from "./Icon";

export default function PsList() {

  const ttyTabMetas = useTabs(({ tabsMeta }) =>
    Object.values(tabsMeta).filter(x => x.key.startsWith('tty-')),
    shallow,
  );

  const state = useStateRef(/** @returns {State} */ () => ({
    processes: [],
    sessionKey: '',
    sessionSelect: null,
    ttyTabMeta: null,

    changeProcess(e) {
      const pid = Number(e.currentTarget.dataset.pid);
      const act = /** @type {'pause' | 'resume' | 'kill'} */ (e.currentTarget.dataset.act);
      // console.log({act,pid});
      switch (act) {
        case 'kill':
          if (pid === 0) {
            useSession.api.killSessionLeader(state.sessionKey);
          } else {
            useSession.api.kill(state.sessionKey, [pid], { group: true, SIGINT: true });
          }
          break;
        case 'pause':
          useSession.api.kill(state.sessionKey, [pid], { group: true, STOP: true });
          break;
        case 'resume':
          useSession.api.kill(state.sessionKey, [pid], { group: true, CONT: true });
          break;
        default:
      }
    },
    connectSession() {
      try {
        state.disconnectSession?.();
        const session = useSession.api.getSession(state.sessionKey);
        if (session === undefined) {// sessionKey could be empty string
          state.processes = [];
          return;
        }

        const leaders = Object.values(session.process).filter(p => p.key === p.pgid);
        
        state.processes = leaders.reduce((agg, { key: pid, src, status }) => {
          agg[pid] = { pid, src, status };
          return agg;
        }, /** @type {ProcessLeader[]} */ ([]));
        
        // listen for leading process status
        state.disconnectSession = session.ttyShell.io.handleWriters(msg => 
          msg?.key === 'external'
          && msg.msg.key === 'process-leader'
          && state.handleLeaderMessage(msg.msg)
        );

      } catch (e) {
        error(e);
      }
    },
    disconnectSession: null,
    handleLeaderMessage(msg) {
      // console.log(msg);
      const process = state.processes[msg.pid];
      if (!process) {
        return;
      }
      switch (msg.act) {
        case 'ended':
          process.status = ProcessStatus.Killed;
          break;
        case 'paused':
          process.status = ProcessStatus.Suspended;
          break;
        case 'resumed':
          process.status = ProcessStatus.Running;
          break;
        case 'started': {
          process.status = ProcessStatus.Running;
          const session = useSession.api.getSession(state.sessionKey);
          process.src = session.process[msg.pid]?.src ?? process.src;
          break;
        }
      }
      update();
    },
    onChangeSessionKey(e) {
      const { value } = e.currentTarget;
      state.sessionKey = value;
      state.ttyTabMeta = ttyTabMetas[ttyTabMetas.findIndex(x => x.key === state.sessionKey)];
      update();
    },
    refreshProcessLeaders() {
      state.connectSession();
      update();
    },
  }), { deps: [ttyTabMetas] });

  const update = useUpdate();

  // 🚧 cleaner approach to syncing state.ttyTabMeta
  React.useEffect(() => {
    const sessionKeys = /** @type {string[]} */ (ttyTabMetas.map(x => x.key));
    if (ttyTabMetas.length === 0) {
      state.sessionKey = '';
      state.ttyTabMeta = null;
    } else if (!sessionKeys.includes(state.sessionKey)) {
      state.sessionKey = state.sessionSelect?.value ?? sessionKeys[0];
      state.ttyTabMeta = ttyTabMetas[ttyTabMetas.findIndex(x => x.key === state.sessionKey)];
    } else {// Must sync
      state.ttyTabMeta = ttyTabMetas[ttyTabMetas.findIndex(x => x.key === state.sessionKey)];
    }
  }, [ttyTabMetas]);
  
  React.useEffect(() => {// sync onchange session or hmr session
    state.refreshProcessLeaders();
  }, [state.ttyTabMeta?.ttyBootedAt])

  const sessionsExist = ttyTabMetas.length > 0;

  return (
    <div css={psListCss}>

      <div className="header">
        <h2>Processes</h2>
        {sessionsExist && (
          <div className="session-controls">
            <select
              ref={state.ref('sessionSelect')}
              onChange={state.onChangeSessionKey}
              title="sessionKey"
            >
              {ttyTabMetas.map(({ key }) => <option key={key} value={key}>{key}</option>)}
            </select>
            <button
              className="refresh"
              onClick={state.refreshProcessLeaders}
            >
              <FontAwesomeIcon title="refresh" icon={faRefresh} size="sm" />
            </button>
          </div>
        ) || (
          <div className="no-sessions">{`[No sessions found]`}</div>
        )}
      </div>
      
      {sessionsExist && (
        <div className="process-leaders">
          {state.processes.map(p =>
            <div
              key={p.pid}
              className={cx(
                "process-leader",
                p.status === ProcessStatus.Suspended ? 'paused' : p.status === ProcessStatus.Running ? 'running' : 'killed'
              )}
            >
              <div className="pid">
                {p.pid}
              </div>
              <div className="process-controls">
                <div className="control" onClick={p.status !== ProcessStatus.Suspended ? state.changeProcess : undefined} data-act="pause" data-pid={p.pid}><FontAwesomeIcon icon={faPause} size="sm" /></div>
                <div className="control" onClick={p.status !== ProcessStatus.Running ? state.changeProcess : undefined} data-act="resume" data-pid={p.pid}><FontAwesomeIcon icon={faPlay} size="xs" /></div>
                <div className="control" onClick={p.status !== ProcessStatus.Killed ? state.changeProcess : undefined} data-act="kill" data-pid={p.pid}><FontAwesomeIcon icon={faClose} size="1x" /></div>
              </div>
              {p.src !== '' && (
                <div className="src">
                  {p.src}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

const psListCss = css`
  --separating-border: 1px solid rgba(80, 80, 80, 1);
  --disabled-color: #777;

  color: white;
  min-height: 50px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: stretch;

    > h2 {
      font-size: small;
      color: #ccc;
    }

    .no-sessions {
      font-size: small;
      color: #999;
    }

    .session-controls {
      display: flex;
      align-items: stretch;
      
      select {
        width: 60px;
        padding: 2px 0;
        font-size: 0.9rem;
        font-family: 'Courier New', Courier, monospace;
        /* 🔔 fixes safari */
        text-align-last: center;
      }
      button.refresh {
        border: var(--separating-border);
        border-bottom: none;
        padding: 0 8px;
      }
    }
  }

  .process-leaders {
    display: flex;
    flex-direction: column;
    gap: 4px;

    font-family: 'Courier New', Courier, monospace;
    font-size: medium;
    color: #fff;
  }

  .process-leader {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    
    padding: 4px;
    border-radius: 4px;
    background-color: #222;
    color: #0f0;
    
    .pid {
      color: #ff9;
    }
    .process-controls {
      display: flex;
      align-items: stretch;
      gap: 4px;
      color: #fff;

      .control {
        display: flex;
        align-items: center;
        padding: 2px 8px;
        cursor: pointer;
        border: 1px solid #555;
      }

    }
    .control[data-act="kill"] svg {
      color: #faa;
    }

    .src {
      padding: 4px 8px;
      background-color: black;
      border: var(--separating-border);
      font-size: small;
      overflow-x: auto;
      /* max-height: 100px; */
      /* word-break: break-all; */
    }

    &.running {
      .control[data-act="resume"] {
        cursor: auto;
        svg {
          color: var(--disabled-color);
        }
      }
      .src {
        color: #0f0;
      }
    }
    &.paused {
      .control[data-act="pause"] {
        cursor: auto;
        svg {
          color: var(--disabled-color);
        }
      }
      .src {
        color: #ccc;
      }
    }
    &.killed {
      .control {
        cursor: auto;
        svg {
          color: var(--disabled-color);
        }
      }
      .src {
        color: #f99;
      }
    }  

  }
`;

/**
 * @typedef State
 * @property {ProcessLeader[]} processes
 * @property {string} sessionKey
 * @property {null | HTMLSelectElement} sessionSelect
 * @property {null | import("../tabs/tabs.store").TabStoreTabMeta} ttyTabMeta
 *
 * @property {(e: React.PointerEvent<HTMLDivElement>) => void} changeProcess
 * @property {() => void} connectSession
 * @property {null | (() => void)} disconnectSession
 * @property {(msg: import("../sh/io").ExternalMessageProcessLeader) => void} handleLeaderMessage
 * @property {(e: React.ChangeEvent<HTMLSelectElement>) => void} onChangeSessionKey
 * @property {() => void} refreshProcessLeaders
 */

/**
 * @typedef ProcessLeader
 * @property {number} pid
 * @property {string} src
 * @property {ProcessStatus} status
 * // 🚧
 */
