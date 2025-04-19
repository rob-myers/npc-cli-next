/**
 * Usage:
 * - npm run test-svg-to-png media/debug/minecraft-testing.svg
 * - npm run test-svg-to-png media/debug/test-human-0.0.tex.svg
 * - npm run test-svg-to-png media/debug/test-gradient-fill.svg
 */
import fs from 'fs';
import path from 'path';
import { promises as stream } from 'stream';
// import napiRsCanvas from '@napi-rs/canvas';
// import skiaCanvas from 'skia-canvas';
import nodeCanvas from 'canvas';

const [ ,, ...args] = process.argv;

const approach = /** @type {'default' | 'with-fix'} */ (
  'default'
  // 'with-fix'
);

(async function main() {

  const [inputSvgFilePath] = args;
  const outputSvgFilePath = `${inputSvgFilePath}.png`;

  const svgPath = path.resolve(process.cwd(), inputSvgFilePath);
  
  /** @type {nodeCanvas.Image} */ let image;

  if (approach === 'default') {

    image = await nodeCanvas.loadImage(svgPath);

  } else {

    // 🔔 fix extra &quot; in urls
    // https://boxy-svg.com/bugs/431/bad-and-quot-s-broken-urls-and-svg-attributes
    const contents = fs.readFileSync(svgPath).toString();
    const dataUrl = `data:image/svg+xml;utf8,${
      contents
      // contents.replace(/url\(&quot;(.+)&quot;\)/g, 'url($1)')
      // contents.replace(/url\(&quot;(.+)&quot;\)/g, "url($1)")
    }`;
    image = await nodeCanvas.loadImage(dataUrl);

  }
  
  // 🔔 easy to forget to explicitly add svg.{width,height} in BoxySVG
  console.log({
    width: image.width,
    height: image.height,
  });

  const canvas = new nodeCanvas.Canvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);

  // // @napi-rs/canvas
  // const pngData = await canvas.encode('png');
  // fs.writeFileSync(outputSvgFilePath, pngData);

  // // skia-canvas
  // await canvas.saveAs(outputSvgFilePath, {  });

  // canvas (node-canvas)
  await stream.pipeline(
    canvas.createPNGStream({}), 
    fs.createWriteStream(outputSvgFilePath),
  );

})();
