import React from "react";
import { css } from "@emotion/react";
import { error } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useTabs from "../tabs/tabs.store";
import useSession from "../sh/session.store";
import { faRefresh, FontAwesomeIcon } from "./Icon";

export default function PsList() {

  const sessionKeys = useTabs(({ tabsMeta }) =>
    Object.keys(tabsMeta).filter(x => x.startsWith('tty-'))
  );

  const state = useStateRef(/** @returns {State} */ () => ({
    processes: [],
    sessionKey: '',
    sessionSelect: null,

    computeProcessLeaders() {
      try {
        const session = useSession.api.getSession(state.sessionKey);
        const leaders = Object.values(session.process).filter(p => p.key === p.pgid);
        // 🚧 compute leading processes
        state.processes = leaders.map(({ key: pid, src }) => ({
          pid,
          src,
        }));
      } catch (e) {
        error(e);
      }
    },
    onChangeSessionKey(e) {
      const { value } = e.currentTarget;
      state.sessionKey = value;
      update();
    },
    refreshProcessLeaders() {
      state.computeProcessLeaders();
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
      
      {/* 🚧 */}
      {sessionsExist && <div className="process-leaders">
        {state.processes.map(p =>
          <div className="process-leader" key={p.pid}>
            <div className="pid">{p.pid}</div>
            <div className="src">{p.src}</div>
          </div>
        )}
      </div>}

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

    .no-sessions {
      font-size: small;
      color: #999;
    }
    .session-controls {
      display: flex;
      margin-bottom: 2px;
      
      select {
        width: 60px;
        padding: 2px 0;
        font-size: 0.9rem;
      }
      button.refresh {
        border: var(--separating-border);
        padding: 0 4px;
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
    gap: 8px;
    padding: 4px;
    border-radius: 4px;
    background-color: #333;
    color: #0f0;
    font-size: small;
    .pid {
      color: #ff9;
    }
  }
`;

/**
 * @typedef State
 * @property {ProcessLeader[]} processes
 * @property {string} sessionKey
 * @property {null | HTMLSelectElement} sessionSelect
 * @property {(e: React.ChangeEvent<HTMLSelectElement>) => void} onChangeSessionKey
 * @property {() => void} computeProcessLeaders
 * @property {() => void} refreshProcessLeaders
 */

/**
 * @typedef ProcessLeader
 * @property {number} pid
 * @property {string} src
 * // 🚧
 */
