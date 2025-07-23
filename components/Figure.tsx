"use client";
import { css } from "@emotion/react";

export default function Figure({ children, label, maxHeight }: React.PropsWithChildren<Props>) {
  return (
    <figure
      css={labelledImageCss}
      style={{ ['--figure-max-height' as any]: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
    >
      {label && <label>
        {label}
      </label>}
      {children}
    </figure>
  );
}

interface Props extends Pick<React.CSSProperties, 'objectPosition'> {
  label?: React.ReactElement;
  maxHeight?: string | number;
}

const labelledImageCss = css`
  position: relative;

  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;

  label {
    position: absolute;
    z-index: 1;
    top: 16px;

    padding: 0 16px;
    background-color: #2228;
    color: white;
    border: 1px solid #fff7;
    border-radius: 8px;
  }

  img {
    max-height: var(--figure-max-height);
    object-fit: contain;
  }
`;
