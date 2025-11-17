import fs from "fs";
import { error, info } from "@/npc-cli/service/generic";
import { ansi } from "@/npc-cli/sh/const";

/**
 * - `symbolPrefix` e.g. `extra--021--screen`
 * - `svgWidth` e.g. 300 (1 grid unit)
 * - `svgHeight` e.g. 300 (1 grid unit)
 */
const [,, baseSymbolName, svgWidth, svgHeight] = process.argv;

const widthGmUnits = svgToGmUnits(Number(svgWidth));
const heightGmUnits = svgToGmUnits(Number(svgHeight));
const symbolName = `${baseSymbolName}--${widthGmUnits}x${heightGmUnits}`;

if (baseSymbolName.match(/^[a-z]+--\d\d\d(--[a-z]+)?$/) === null) {
  error(`1st argument must match /^[a-z]+--\d\d\d(--[a-z]+)?$/`);
  error(`usage: npm run empty-symbol extra--021--screen 30 150`);
  process.exit(1);
}

if (
  !Number.isFinite(widthGmUnits) ||
  !Number.isFinite(heightGmUnits)
) {
  error(`2nd and 3rd argument must be svg width/height`);
  error(`usage: npm run empty-symbol extra--021--screen 60 150`);
  process.exit(1);
}

for (const filename of fs.readdirSync('media/symbol')) {
  // e.g. extra--020--table becomes extra--020
  const prefix = baseSymbolName.split('--').slice(0, 2).join('--');
  if (filename.startsWith(prefix)) {
    error(`symbol ${filename} with prefix ${prefix} already exists`);
    process.exit(1);
  }
}

const filepath = `media/symbol/${symbolName}.svg`;
const svgContents = `

<?xml version="1.0" encoding="utf-8"?>
<svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:bx="https://boxy-svg.com">

  <defs>
    <bx:grid x="0" y="0" width="300" height="300"/>
  </defs>

</svg>

`.trim();

fs.writeFileSync(filepath, svgContents);

info(`created ${filepath}`)
info(`now goto ${ansi.BlueBold}./npc-cli/service/const.js${ansi.Reset} and add this to ${ansi.YellowBright}fromSymbolKey${ansi.Reset}:
${ansi.GreenBright}'${symbolName}': true,${ansi.Reset}`);

/** @param {number} svgUnits */
function svgToGmUnits(svgUnits) {
  const gmUnits = Number(svgUnits) / 300;
  return Number.isInteger(gmUnits) ? gmUnits : Number(gmUnits.toPrecision(2));
}
