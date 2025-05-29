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
      Manage
    </div>
  );
}

const manageCss = css`
  background-color: #222;
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef State
 * @property {'bar'} foo
 */
