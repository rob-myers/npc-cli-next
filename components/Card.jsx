"use client";

import { css } from '@emotion/react';
import React from 'react';
import { breakpoint } from './const';

/** @param {React.PropsWithChildren<Props>} props */
export default function Card(props) {
  return (
    <div
      css={rootCss}
      style={typeof props.background === 'string' ? { background: props.background } : undefined}
    >
      {props.id && <div id={props.id} className="card-anchor" />}
      {props.children}
    </div>
  );
}

const rootCss = css`
  margin: 32px 0;
  padding: 8px 48px;
  border-left: 4px solid #dde;
  position: relative;

  @media(max-width: ${breakpoint}) {
    padding: 8px 32px;
  }

  > .card-anchor {
    position: absolute;
    top: -80px;
  }
`;

/**
 * @typedef Props
 * @property {string} [id]
 * @property {string} [background]
 */
