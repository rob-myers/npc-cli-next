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
  padding: 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */
