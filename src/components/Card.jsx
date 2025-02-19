"use client";

import { css } from '@emotion/react';
import React from 'react';

import { breakpoint } from '../const';

/** @param {Props} props */
export default function Card(props) {
  return (
    <div css={rootCss}>
      {props.id && <div id={props.id} className="card-anchor" />}
      {props.children}
    </div>
  );
}

const rootCss = css`
  margin: 32px 0;
  padding: 0px 48px;
  border-left: 4px solid #dde;
  position: relative;

  @media(max-width: ${breakpoint}) {
    padding: 0px 32px;
  }

  > .card-anchor {
    position: absolute;
    top: -80px;
  }
`;

/**
 * @typedef {React.PropsWithChildren<{ id?: string }>} Props
 */
