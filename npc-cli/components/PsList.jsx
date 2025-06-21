import React from "react";
import { css } from "@emotion/react";
import useStateRef from "../hooks/use-state-ref";
import useTabs from "../tabs/tabs.store";

export default function PsList() {

  const sessionKeys = useTabs(({ tabsMeta }) =>
    Object.keys(tabsMeta).filter(x => x.startsWith('tty-'))
  );

  const state = useStateRef(/** @returns {State} */ () => ({
    foo: "bar",
  }));


  return (
    <div css={psListCss}>
      <div className="header">
        <h2>Processes</h2>
        {sessionKeys.length === 0 && <div className="no-sessions">{`[No sessions found]`}</div>}
        {sessionKeys.length > 0 && (
          <select>
            {sessionKeys.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        )}
      </div>
      
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
`;

/**
 * @typedef State
 * @property {'bar'} foo
 */
