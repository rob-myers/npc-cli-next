"use client";
import { css } from "@emotion/react";
import type { StaticImageData } from "next/image";

export default function Figure({ data, label, objectPosition }: Props) {
  return (
    <figure css={labelledImageCss}>
      {typeof label !== undefined && <label>
        {label}
      </label>}
      <img
        width={data.width}
        height={data.height}
        src={data.src}
        {...objectPosition && { style: { objectPosition } }}
      />
    </figure>
  );
}

interface Props extends Pick<React.CSSProperties, 'objectPosition'> {
  data: StaticImageData;
  label?: React.ReactElement;
}

const labelledImageCss = css`
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
    border-radius: 8px;
  }

  img {
    height: 100%;
    object-fit: cover;
  }
`;
