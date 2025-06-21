import React from "react";
import { css } from "@emotion/react";
import { error } from "../service/generic";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useTabs from "../tabs/tabs.store";
import useSession from "../sh/session.store";

export default function PsList() {

  const sessionKeys = useTabs(({ tabsMeta }) =>
    Object.keys(tabsMeta).filter(x => x.startsWith('tty-'))
  );

  const state = useStateRef(/** @returns {State} */ () => ({
    processes: [],
    sessionKey: '',
    onChangeSessionKey(e) {
      const { value } = e.currentTarget;
      state.sessionKey = value;
      update();
    },
  }));

  const update = useUpdate();

  React.useMemo(() => {
    if (sessionKeys.length === 0 || state.sessionKey === '') {
      state.sessionKey = '';
      return;
    }
    if (!sessionKeys.includes(state.sessionKey)) {
      // 🔔 assume <select> falls back to 1st <option>
      state.sessionKey = sessionKeys[0];
    }

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

  }, [sessionKeys.length, state.sessionKey]);

  const sessionsExist = sessionKeys.length > 0;

  return (
    <div css={psListCss}>

      <div className="header">
        <h2>Processes</h2>
        {!sessionsExist && <div className="no-sessions">{`[No sessions found]`}</div>}
        {sessionsExist && <select onChange={state.onChangeSessionKey}>
          {sessionKeys.map(x => <option key={x} value={x}>{x}</option>)}
        </select>}
      </div>
      
      {/* 🚧 */}
      {sessionsExist && <div className="process-leaders">
        {state.processes.map(p =>
          <div className="process-leader" key={p.pid}>
            <div>{p.pid}</div>
            <div>{p.src}</div>
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
    select {
      width: 100px;
      border: var(--separating-border);
    }
  }
  .process-leaders {
    display: flex;
    flex-direction: column;
    gap: 4px;

    font-family: 'Courier New', Courier, monospace;
    font-size: medium;
    color: #0f0;
  }
  .process-leader {
    display: flex;
    gap: 8px;
    background-color: #333;
  }
`;

/**
 * @typedef State
 * @property {ProcessLeader[]} processes
 * @property {string} sessionKey
 * @property {(e: React.ChangeEvent<HTMLSelectElement>) => void} onChangeSessionKey
 */

/**
 * @typedef ProcessLeader
 * @property {number} pid
 * @property {string} src
 * // 🚧
 */
