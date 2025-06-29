import React from "react";
import cx from "classnames";
import { shallow } from "zustand/shallow";
import { css } from "@emotion/react";
import debounce from "debounce";

import { error } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useTabs from "../tabs/tabs.store";
import { getPtagsPreview } from "../sh/util";
import useSession, { ProcessStatus } from "../sh/session.store";
import { faRefresh, faPause, faPlay, faClose, FontAwesomeIcon, faRefreshThin } from "./Icon";

export default function PsList() {

  const ttyTabMetas = useTabs(({ tabsMeta }) =>
    Object.values(tabsMeta).filter(x => x.key.startsWith('tty-')),
    shallow,
  );

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    processes: [],
    ordered: [],
    sessionKey: '',
    sessionSelectEl: null,
    ttyTabMeta: null,

    changeProcess(e) {
      const pid = Number(e.currentTarget.dataset.pid);
      const act = /** @type {'pause' | 'resume' | 'kill' | 'reboot'} */ (e.currentTarget.dataset.act);
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
        case 'reboot': {
          useSession.api.reboot(state.sessionKey, pid);
          break;
        }
        default:
      }
    },
    connectSession() {
      try {
        state.disconnectSession?.();
        const session = useSession.api.getSession(state.sessionKey);
        if (session === undefined) {// sessionKey could be empty string
          state.processes = state.ordered = [];
          return;
        }

        const leaders = Object.values(session.process).filter(p => p.key === p.pgid);
        
        state.processes = leaders.reduce((agg, { key: pid, src, status, ptags }) => {
          const group = useSession.api.getProcesses(state.sessionKey, pid);
          const bootable = group.some(p => p.reboot !== undefined);
          agg[pid] = {
            pid,
            src,
            status,
            ptagsText: getPtagsPreview(ptags).join(''),
            bootable,
          };
          return agg;
        }, /** @type {ProcessLeader[]} */ ([]));
        
        // order by pid=0, tags, src
        state.ordered = state.processes.slice().sort((p, q) => {
          if (p.pid === 0) return -1;
          if (q.pid === 0) return +1;
          return (p.ptagsText < q.ptagsText || p.src < q.src) ? -1 : +1;
        });
        
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
    debouncedUpdate: debounce(update, 200, { immediate: true }),
    disconnectSession: null,
    handleLeaderMessage(msg) {
      // console.log(msg);
      const process = state.processes[msg.pid];
      if (!process) {
        return;
      }
      switch (msg.act) {
        case 'ended': {
          process.status = ProcessStatus.Killed;
          msg.pid === 0 ? state.debouncedUpdate() : update();
          break;
        }
        case 'paused':
          process.status = ProcessStatus.Suspended;
          update();
          break;
        case 'resumed':
          process.status = ProcessStatus.Running;
          update();
          break;
        case 'started': {
          process.status = ProcessStatus.Running;
          const session = useSession.api.getSession(state.sessionKey);
          process.src = session.process[msg.pid]?.src ?? process.src;
          msg.pid === 0 ? state.debouncedUpdate() : update();
          break;
        }
      }
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

  React.useEffect(() => {
    // 🚧 cleaner approach to syncing state.ttyTabMeta
    const sessionKeys = /** @type {string[]} */ (ttyTabMetas.map(x => x.key));
    if (ttyTabMetas.length === 0) {
      state.sessionKey = '';
      state.ttyTabMeta = null;
    } else if (!sessionKeys.includes(state.sessionKey)) {
      state.sessionKey = state.sessionSelectEl?.value ?? sessionKeys[0];
      state.ttyTabMeta = ttyTabMetas[ttyTabMetas.findIndex(x => x.key === state.sessionKey)];
    } else {// Must sync
      state.ttyTabMeta = ttyTabMetas[ttyTabMetas.findIndex(x => x.key === state.sessionKey)];
    }
  }, [ttyTabMetas]);
  
  React.useEffect(() => {// sync onchange session or hmr session
    if (state.processes.length > 0) {
      state.refreshProcessLeaders();
    }
  }, [state.ttyTabMeta?.ttyBootedAt])

  const sessionsExist = ttyTabMetas.length > 0;

  return (
    <div css={psListCss}>

      <div className="header">
        <h2>Processes</h2>
        {sessionsExist && (
          <div className="session-controls">
            <select
              ref={state.ref('sessionSelectEl')}
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
          
          {state.ordered.map(p =>
            <div
              key={p.pid}
              className={cx("process-leader", p.status === ProcessStatus.Suspended
                ? 'paused'
                : p.status === ProcessStatus.Running ? 'running' : 'killed'
              )}
            >
              <div className="pid-and-ptags">  
                <div className="pid">
                  {p.pid}
                </div>
                {p.ptagsText && <div className="ptags">
                  {p.ptagsText}
                </div>}
              </div> 
              <div className="process-controls">
                <div className="control" onClick={p.status !== ProcessStatus.Killed ? state.changeProcess : undefined} data-act={p.status === ProcessStatus.Suspended ? "resume" : "pause"} data-pid={p.pid}><FontAwesomeIcon icon={p.status === ProcessStatus.Suspended ? faPlay : faPause} title={p.status === ProcessStatus.Suspended ? "resume" : "pause"} size="xs" /></div>
                <div className="control" onClick={p.status !== ProcessStatus.Killed ? state.changeProcess : undefined} data-act="kill" data-pid={p.pid}><FontAwesomeIcon icon={faClose} title="kill" size="1x" /></div>
                {p.bootable && <div className="control" onClick={state.changeProcess} data-act="reboot" data-pid={p.pid}><FontAwesomeIcon icon={faRefreshThin} title="reboot" size="xs" /></div>}
              </div>
              {p.src !== '' && (
                <div className="src">
                  {p.src}
                </div>
              )}
            </div>
          )}

          {state.ordered.length === 0 && (
            <div className="no-processes">
              Refresh to track current processes.
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

    h2 {
      color: #ccc;
      align-self: end;
      font-family: 'Courier New', Courier, monospace;
      padding-bottom: 2px;
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
        /* 🔔 fixes safari */
        text-align-last: center;
        font-size: 0.9rem;
        font-family: 'Courier New', Courier, monospace;
        background: #333;
      }

      button.refresh {
        border: none;
        border-bottom: none;
        padding: 0 8px;
      }
    }
  }

  .process-leaders {
    display: flex;
    flex-direction: column;
    gap: 4px;

    font-size: medium;
    color: #fff;
    
    .no-processes {
      font-size: small;
      color: #ff9;
      border: 1px solid #555;
      padding: 16px;
      border-radius: 4px;
    }
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
    font-family: 'Courier New', Courier, monospace;
    
    .pid-and-ptags {
      display: flex;
      justify-content: space-between;
      gap: 0;
      background-color: black;
      border: 1px solid #aaca;
    }
    .pid {
      color: #ff9;
      padding: 0 4px;
    }
    .ptags {
      padding: 0 4px;
      background-color: #222;
    }

    .process-controls {
      display: flex;
      align-items: stretch;
      gap: 4px;
      color: #fff;

      .control {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px 8px;
        cursor: pointer;
        border: 1px solid #555;

        width: 28px;
      }

    }
    .control[data-act="kill"] svg {
      color: #faa;
    }
    .control[data-act="copy"] svg {
      color: #bac;
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
 * @property {ProcessLeader[]} ordered Re-ordered `processes`
 * @property {string} sessionKey
 * @property {null | HTMLSelectElement} sessionSelectEl
 * @property {null | import("../tabs/tabs.store").TabStoreTabMeta} ttyTabMeta
 *
 * @property {(e: React.PointerEvent<HTMLDivElement>) => void} changeProcess
 * @property {() => void} connectSession
 * @property {debounce.DebouncedFunction<() => void>} debouncedUpdate
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
 * @property {string} ptagsText
 * @property {boolean} bootable
 */
