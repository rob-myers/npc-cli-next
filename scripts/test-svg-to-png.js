import fs from 'fs';
import path from 'path';
import { Canvas, loadImage, Image } from '@napi-rs/canvas';

const [ ,, ...args] = process.argv;

const approach = /** @type {'default' | 'with-fix'} */ (
  'default'
  // 'with-fix'
);

/**
 * Usage:
 * - npm run test-svg-to-png media/debug/test-gradient-fill.svg
 * - npm run test-svg-to-png media/debug/test-human-0.0.tex.svg
 */
(async function main() {

  const [inputSvgFilePath] = args;
  const outputSvgFilePath = `${inputSvgFilePath}.png`;

  const svgPath = path.resolve(process.cwd(), inputSvgFilePath);
  
  /** @type {Image} */ let image;

  if (approach === 'default') {

    image = await loadImage(svgPath);

  } else {

    // 🔔 fix extra &quot; in urls
    // https://boxy-svg.com/bugs/431/bad-and-quot-s-broken-urls-and-svg-attributes
    const contents = fs.readFileSync(svgPath).toString();
    const dataUrl = `data:image/svg+xml;utf8,${
      // contents
      contents.replace(/url\(&quot;(.+)&quot;\)/g, 'url($1)')
    }`;
    image = await loadImage(dataUrl);

  }
  
  const canvas = new Canvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);

  // @napi-rs/canvas
  const pngData = await canvas.encode('png');
  fs.writeFileSync(outputSvgFilePath, pngData);

  // skia-canvas
  // await canvas.saveAs(outputSvgFilePath, {  });

})();
