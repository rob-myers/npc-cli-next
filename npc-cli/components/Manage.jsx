import React from "react";
import { css } from "@emotion/react";
import useStateRef from "../hooks/use-state-ref";
import useSite from "@/components/site.store";
import { extractTabNodes } from "../tabs/tab-util";

/** @param {Props} props */
export default function Manage(props) {

  const layout = useSite(({ tabset: { synced } }) => synced);

  const state = useStateRef(/** @returns {State} */ () => ({
    foo: "bar",
  }));

  const tabDefs = React.useMemo(() => {
    const defs = extractTabNodes(layout).map(x => x.config);
    return defs;
  }, [layout]);

  return (
    <div css={manageCss}>
      <div>
        <h2>Manage Tabs</h2>

        <ul className="tab-defs">
          {tabDefs.map(def =>
            <li key={def.filepath}>
              {/* {JSON.stringify(def)} */}
              <span>{def.filepath}</span>
              <span className="world-key">{def.type === 'terminal' && `(${def.env?.WORLD_KEY})`}</span>
              <span className="map-key">{def.type === 'component' && def.class === 'World' && `(${def.props.mapKey})`}</span>
            </li>
          )}
        </ul>
      </div>
      
      <div>
        <h2>Demo links</h2>

        <ul className="demo-links">
          <li><a href={`#/internal/set-tabs/empty-layout`}>use preset empty-tabs</a></li>
          <li><a href={`#/internal/set-tabs/layout-preset-0`}>set preset 'layout-preset-0'</a></li>
          <li><a href={`#/internal/reset-tabs`}>reset current tabset</a></li>
          <li><a href={`#/internal/test-mutate-tabs`}>test mutate current tabset</a></li>
          <li><a href={`#/internal/remember-tabs`}>remember current tabset</a></li>
          <li><a href={`#/internal/open-tab/HelloWorld?suffix=1`}>open tab hello-world-1</a></li>
          <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld"}`}>open Tty tab</a></li>
          <li><a href={`#/internal/open-tab/World?suffix=2&mapKey=small-map-1`}>open World tab</a></li>
          <li><a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld;%20echo%20foo%20bar!"}`}>open Tty tab with PROFILE with spaces via `%20`</a></li>
          <li><a href={`#/internal/close-tab/hello-world-1`}>close tab hello-world-1</a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"small-map-1"}`}>change "test-world-1" tab props: mapKey=small-map-1 </a></li>
          <li><a href={`#/internal/change-tab/test-world-1?props={mapKey:"demo-map-1"}`}>change "test-world-1" tab props: mapKey=demo-map-1 </a></li>
        </ul>
      </div>

    </div>
  );
}

const manageCss = css`
  height: 100%;
  width: 100%;
  overflow: auto;

  color: white;
  background-color: #111;
  padding: 16px;

  h2 {
    font-size: large;
    margin-bottom: 8px;
  }

  > div {
    margin-bottom: 12px;
    width: 300px;
  }

  ul {
    /* background-color: #333; */
    color: #ccc;
  }
  li {
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    
    display: flex;
    gap: 4px;
  }
  li > span.world-key, li > span.map-key {
    color: #aaa;
  }

  .demo-links {
    display: flex;
    flex-direction: column;
    a {
      font-size: small;
    }
  }

  a {
    color: #a7a7fb;
  }
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef State
 * @property {'bar'} foo
 */
