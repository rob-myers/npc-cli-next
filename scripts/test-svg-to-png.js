import fs from 'fs';
import path from 'path';
import { Canvas, loadImage, Image } from '@napi-rs/canvas';

const [ ,, ...args] = process.argv;

/**
 * Usage:
 * ```sh
 * cd REPO_ROOT
 * npm run test-svg-to-png media/debug/test-gradient-fill.svg
 * ```
 */
(async function main() {

  const [inputSvgFilePath] = args;
  const outputSvgFilePath = `${inputSvgFilePath}.png`;

  const svgPath = path.resolve(process.cwd(), inputSvgFilePath);
  // ℹ️ usual approach
  // const image = await loadImage(svgPath);

  // 🔔 fix extra &quot; in urls
  // https://boxy-svg.com/bugs/431/bad-and-quot-s-broken-urls-and-svg-attributes
  const contents = fs.readFileSync(svgPath).toString();
  const dataUrl = `data:image/svg+xml;utf8,${
    // contents
    contents.replace(/url\(&quot;(.+)&quot;\)/g, 'url($1)')
  }`;
  const image = await loadImage(dataUrl);
  
  const canvas = new Canvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);

  const pngData = await canvas.encode('png');
  fs.writeFileSync(outputSvgFilePath, pngData);

})();
