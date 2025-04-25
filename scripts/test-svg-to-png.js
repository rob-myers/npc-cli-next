/**
 * Usage:
 * - npm run test-svg-to-png-fast media/debug/node-canvas-bug.svg
 * - npm run test-svg-to-png-fast media/debug/minecraft-testing.svg
 * - npm run test-svg-to-png media/debug/minecraft-testing.svg
 * - npm run test-svg-to-png media/debug/test-human-0.0.tex.svg
 * - npm run test-svg-to-png media/debug/test-gradient-fill.svg
 */
import fs from 'fs';
import { promises as stream } from 'stream';
import path from 'path';
import napiRsCanvas from '@napi-rs/canvas';
import nodeCanvas from 'canvas';

const napiRsCanvasOutput = false;

const [ ,, ...args] = process.argv;

(async function main() {

  const [inputSvgFilePath] = args;
  const outputSvgFilePath = `${inputSvgFilePath}.png`;

  // we import SVG using node-canvas, because loadImage
  // supports most features, e.g.
  // - <image> with data-url
  // - `url(&quot;foo&quot;)` in style
  const svgPath = path.resolve(process.cwd(), inputSvgFilePath);
  const image = await nodeCanvas.loadImage(svgPath);
  const canvas = new nodeCanvas.Canvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);

  // 🔔 must explicitly add svg.{width,height} in BoxySVG
  console.log({ width: image.width, height: image.height });

  if (napiRsCanvasOutput) {
    
    // we export using @napi-rs/canvas, because
    // we've observed nondeterministic output in node-canvas
    const dataUrl = canvas.toDataURL();
    const napiRsImage = await napiRsCanvas.loadImage(dataUrl);
    const canvas2 = new napiRsCanvas.Canvas(napiRsImage.width, napiRsImage.height);
    canvas2.getContext('2d').drawImage(napiRsImage, 0, 0);
    const pngData = await canvas2.encode('png');
    await fs.promises.writeFile(outputSvgFilePath, pngData);

  } else {

    // export using node-canvas
    // 🔔 may be nondeterministic
    await stream.pipeline(
      canvas.createPNGStream({}),
      fs.createWriteStream(outputSvgFilePath),
    );
  }

})();
