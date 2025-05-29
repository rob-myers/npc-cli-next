import React from "react";
import { css } from "@emotion/react";
import useStateRef from "../hooks/use-state-ref";

/** @param {Props} props */
export default function Manage(props) {

  const state = useStateRef(/** @returns {State} */ () => ({
    foo: "bar",
  }));

  return (
    <div css={manageCss}>
      <h2>Manage</h2>

      <div className="links">
        <a href={`#/internal/set-tabs/empty-layout`}>use preset empty-tabs</a>

        <a href={`#/internal/set-tabs/layout-preset-0`}>set preset 'layout-preset-0'</a>

        <a href={`#/internal/reset-tabs`}>reset current tabset</a>

        <a href={`#/internal/test-mutate-tabs`}>test mutate current tabset</a>

        <a href={`#/internal/remember-tabs`}>remember current tabset</a>

        <a href={`#/internal/open-tab/HelloWorld?suffix=1`}>open tab hello-world-1</a>

        <a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld"}`}>open Tty tab</a>

        <a href={`#/internal/open-tab/World?suffix=2&mapKey=small-map-1`}>open World tab</a>

        <a href={`#/internal/open-tab/Tty?suffix=4&env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld;%20echo%20foo%20bar!"}`}>open Tty tab with PROFILE with spaces via `%20`</a>

        <a href={`#/internal/close-tab/hello-world-1`}>close tab hello-world-1</a>

        <a href={`#/internal/change-tab/test-world-1?props={mapKey:"small-map-1"}`}>change "test-world-1" tab props: mapKey=small-map-1 </a>

        <a href={`#/internal/change-tab/test-world-1?props={mapKey:"demo-map-1"}`}>change "test-world-1" tab props: mapKey=demo-map-1 </a>
      </div>


    </div>
  );
}

const manageCss = css`
  color: white;
  background-color: #222;
  padding: 16px;
  h2 {
    padding: 8px 12px 8px 0;
    font-size: large;
  }

  .links {
    display: flex;
    flex-direction: column;
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
