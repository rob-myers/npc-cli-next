import React from "react";
import { css } from "@emotion/react";
import useStateRef from "../hooks/use-state-ref";

/** @param {Props} props */
export default function Debug(props) {

  const state = useStateRef(/** @returns {State} */ () => ({
    canvas: /** @type {*} */ (null),
    tempCanvas: document.createElement('canvas'),
  }));

  React.useEffect(() => {

    const c = state.canvas;
    const ct = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    ct.clearRect(0, 0, c.width, c.height)

    // draw radial gradient in tempCanvas
    const tc = state.tempCanvas;
    tc.width = tc.height = c.width;
    const tct = /** @type {CanvasRenderingContext2D} */ (tc.getContext('2d'));
    const rg = tct.createRadialGradient(tc.width / 2, tc.height / 2, 0, tc.width / 2, tc.height / 2, tc.width / 2);
    rg.addColorStop(0.2, 'rgba(255, 255, 255, 1)');
    // rg.addColorStop(0.9, 'rgba(255, 255, 255, 0.2)');
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    tct.fillStyle = rg;
    tct.clearRect(0, 0, tc.width, tc.height)
    // ct.fillRect(0, 0, c.width, c.height);
    tct.beginPath();
    tct.arc(tc.width / 2, tc.height / 2, tc.width / 2, 0, 2 * Math.PI);
    tct.fill();
    // ct.beginPath();
    // ct.arc(c.width, c.height / 2, c.width / 2, 0, 2 * Math.PI);
    // ct.fill();

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
        // @ts-ignore
        ref={state.ref('canvas')}
        width={400}
        height={400}
      />
    </div>
  );
}

const debugCss = css`
  color: white;
  padding: 24px;
  height: 100%;

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
 * @property {HTMLCanvasElement} tempCanvas
 */
