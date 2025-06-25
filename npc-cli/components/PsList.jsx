import React from "react";
import cx from "classnames";
import { css } from "@emotion/react";
import { error } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useTabs from "../tabs/tabs.store";
import useSession, { ProcessStatus } from "../sh/session.store";
import { faRefresh, faPause, faPlay, faClose, FontAwesomeIcon } from "./Icon";

export default function PsList() {

  const sessionKeys = useTabs(({ tabsMeta }) =>
    Object.keys(tabsMeta).filter(x => x.startsWith('tty-'))
  );

  const state = useStateRef(/** @returns {State} */ () => ({
    processes: [],
    sessionKey: '',
    sessionSelect: null,

    changeProcess(e) {
      const pid = Number(e.currentTarget.dataset.pid);
      const act = /** @type {'pause' | 'resume' | 'exit'} */ (e.currentTarget.dataset.act);
      // console.log({act,pid});
      switch (act) {
        case 'exit':
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
        if (session === undefined) {
          // - sessionKey could be empty string
          // - 🚧 initially session may not be ready (despite tabs.tabsMeta)
          return;
        }

        const leaders = Object.values(session.process).filter(p => p.key === p.pgid);
        
        // compute leading processes
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
    handleLeaderMessage(msg) {// 🚧
      console.log(msg);
      switch (msg.act) {
        case 'ended':
          if (msg.pid in state.processes) {
            state.processes[msg.pid].status = ProcessStatus.Killed;
            update();
          }
          break;
      }
    },
    onChangeSessionKey(e) {
      const { value } = e.currentTarget;
      state.sessionKey = value;
      update();
    },
    refreshProcessLeaders() {
      state.connectSession();
      update();
    },
  }));

  const update = useUpdate();

  React.useEffect(() => {
    if (sessionKeys.length === 0) {
      state.sessionKey = '';
    } else if (!sessionKeys.includes(state.sessionKey)) {
      state.sessionKey = state.sessionSelect?.value ?? sessionKeys[0];
    }
  }, [sessionKeys.length]);
  
  React.useEffect(() => {
    state.refreshProcessLeaders();
  }, [state.sessionKey])

  const sessionsExist = sessionKeys.length > 0;

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
              {sessionKeys.map(x => <option key={x} value={x}>{x}</option>)}
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
            <div className="process-leader" key={p.pid}>
              <div className="pid">
                {p.pid}
              </div>
              <div className="process-controls">
                <div className="control" onClick={state.changeProcess} data-act="pause" data-pid={p.pid}><FontAwesomeIcon icon={faPause} size="sm" /></div>
                <div className="control" onClick={state.changeProcess} data-act="resume" data-pid={p.pid}><FontAwesomeIcon icon={faPlay} size="xs" /></div>
                <div className="control" onClick={state.changeProcess} data-act="exit" data-pid={p.pid}><FontAwesomeIcon icon={faClose} size="1x" color="#f99" /></div>
              </div>
              {p.src !== '' && (
                <div className={cx("src", {
                  killed: p.status === ProcessStatus.Killed,
                })}>
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

      > .control {
        display: flex;
        align-items: center;
        padding: 2px 8px;
        cursor: pointer;
        border: 1px solid #555;
      }
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
    .src.killed {
      color: #f99;
    }

  }
`;

/**
 * @typedef State
 * @property {ProcessLeader[]} processes
 * @property {string} sessionKey
 * @property {null | HTMLSelectElement} sessionSelect
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
