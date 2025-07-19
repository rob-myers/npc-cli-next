"use client";

import { css } from "@emotion/react";

/**
 * @param {React.ComponentProps<'code'>} props 
 * @returns 
 */
export default function InlineCode(props) {
    return <code css={inlineCodeCss} {...props} />;
}

// Override tailwind styling
const inlineCodeCss = css`
  &::before {
      content: "" !important;
  }
  &::after {
      content: "" !important;
  }
`;
