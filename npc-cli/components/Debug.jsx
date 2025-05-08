import React from "react";
import { css } from "@emotion/react";

/** @param {Props} props */
export default function Debug(props) {
  return (
    <div css={debugCss}>
      Debug...
    </div>
  );
}

const debugCss = css`
  color: white;
  padding: 24px;
  height: 100%;
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */
