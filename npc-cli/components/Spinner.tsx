import React from "react";
import { css } from "@emotion/react";

export default function Spinner(props: Props) {
  return (
    <span
      css={rootCss}
      style={{
        width: props.size,
        height: props.size,
        borderWidth: props.size ? props.size / 12 : undefined,
      }}
    />
  );
}

const rootCss = css`
  width: 48px;
  height: 48px;
  border: 5px solid #fff;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;

  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

type Props = { size?: number };

export function CentredSpinner(props: Props) {
  return (
    <div css={centredCss}>
      <Spinner {...props} />
    </div>
  );
}

const centredCss = css`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;
