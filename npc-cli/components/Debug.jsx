import React from "react";
import { css } from "@emotion/react";
import useStateRef from "../hooks/use-state-ref";
import { drawRadialFillCustom, getContext2d } from "../service/dom";

/** @param {Props} props */
export default function Debug(props) {

  const state = useStateRef(/** @returns {State} */ () => ({
    canvas: /** @type {*} */ (null),
    tempCt: getContext2d('components-Debug-temp-canvas', {
      width,
      height,
    }),
  }));

  React.useEffect(() => {

    const c = state.canvas;
    const ct = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    ct.clearRect(0, 0, c.width, c.height);

    // draw radial gradient in tempCanvas
    const tct = state.tempCt;
    const tc = tct.canvas;
    drawRadialFillCustom(tct);

    // copy radial gradient into canvas
    ct.drawImage(tc, 0, 0);
    ct.globalAlpha = 0.5;
    ct.drawImage(tc, +1.1 * c.width / 2, 0);
    ct.drawImage(tc, -1.1 * c.width / 2, 0);
    ct.globalAlpha = 1;

  }, []);

  return (
    <div css={debugCss}>
      Debug
      <canvas
        ref={state.ref('canvas')}
        width={width}
        height={height}
      />
    </div>
  );
}

const debugCss = css`
  color: white;
  padding: 24px;
  height: 100%;
  overflow: scroll;

  canvas {
    border: 1px solid #777;
    /* background-color: red; */
  }
`;

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @typedef State
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} tempCt
 */

const width = 400;
const height = 400;
