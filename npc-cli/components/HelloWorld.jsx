import React from "react";
import { css } from "@emotion/react";

/** @param {Props} props */
export default function HelloWorld(props) {
  return (
    <div css={helloWorldCss}>
      Hello, world! ({props.disabled ? "disabled" : "enabled"})
    </div>
  );
}

const helloWorldCss = css`
  color: white;
  padding: 24px;
  height: 100%;
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */
