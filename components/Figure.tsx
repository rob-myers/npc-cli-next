"use client";
import { css } from "@emotion/react";
import { mobileBreakpoint } from "./const";

export default function Figure(props: React.PropsWithChildren<Props>) {
  return (
    <figure
      css={labelledImageCss}
      style={{
        ['--figure-image-max-height' as any]: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
        ['--figure-object-fit' as any]: props.objectFit ?? 'cover',
        ['--figure-object-position' as any]: props.objectPosition,
        ...props.style,
      }}
    >
      {props.label && (
        <label>{props.label}</label>
      )}
      {props.children}
    </figure>
  );
}

interface Props {
  label?: React.ReactElement;
  maxHeight?: string | number;
  objectFit?: string;
  objectPosition?: string;
  style?: React.CSSProperties;
}

const labelledImageCss = css`
  position: relative;

  height: 100%;
  display: flex;

  flex-direction: column;
  align-items: center;
  /* justify-content: center; */

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
    height: 100%;
    max-height: var(--figure-image-max-height);
    object-fit: var(--figure-object-fit);
    object-position: var(--figure-object-position);
  }
  
  @media (max-width: ${mobileBreakpoint}) {
    label {
      top: 8px;
    }
  }
`;
