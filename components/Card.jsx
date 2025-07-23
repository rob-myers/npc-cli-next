"use client";

import { css } from '@emotion/react';
import React from 'react';
import { breakpoint } from './const';

/** @param {React.PropsWithChildren<Props>} props */
export default function Card(props) {

  /** @type {React.CSSProperties | undefined} */
  const styles = typeof props.background === 'string' ? {
    background: props.background,
    paddingTop: 8,
    paddingBottom: 8,
  } : undefined;

  return (
    <div css={rootCss} style={styles}>
      {props.id && <div id={props.id} className="card-anchor" />}
      {props.children}
    </div>
  );
}

const rootCss = css`
  margin: 32px 0;
  padding: 0 48px;
  border-left: 4px solid #dde;
  position: relative;

  @media(max-width: ${breakpoint}) {
    padding: 0 32px;
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
