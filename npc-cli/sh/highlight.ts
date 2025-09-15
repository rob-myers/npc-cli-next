/**
 * Based on https://www.npmjs.com/package/cli-high
 */

import { tokenize } from 'sugar-high'
import { ansi } from "./const";

export function highlight(code: string) {
  const tokens = tokenize(code)
  const lines = [] as string[];
  const lineTokens = [] as [number, string][];

  for (const token of tokens) {
    const [type, value] = token
    // Skip "break" tokens
    if (type !== 9) {
      // Divide multi-line token into multi-line code
      if (value.includes('\n')) {
        const lines = value.split('\n')
        for (let j = 0; j < lines.length; j++) {
          lineTokens.push([type, lines[j]])
          if (j < lines.length - 1) {
            lines.push(getLineFromTokens(lineTokens));
            lineTokens.length = 0
          }
        }
      } else {
        lineTokens.push(token)
      }
    } else {
      lineTokens.push([type, ''])
      lines.push(getLineFromTokens(lineTokens));
      lineTokens.length = 0
    }
  }

  if (lineTokens.length > 0) lines.push(getLineFromTokens(lineTokens));

  return ansi.Hex323232Bg + lines.join('\n')
}

function getLineFromTokens(tokens: [number, string][]) {
  return tokens.map(([type, value]) => getCharsFromToken([type, value])).join('');
}

function getCharsFromToken([type, value]: [number, string]) {
  // console.log(type, value);
  switch (type) {
    // case 0: // identifier
    //   // return chalk.pink(value)
    //   return ansi.Purple + value
    // case 1: // keyword
    //   return ansi.Grey + value
    // case 2: // string
    //   return ansi.Grey + value
    // case 3: // Class, number and null
    //   return ansi.BrightYellow + value
    // case 4: // property
    //   // return chalk.pink(value)
    //   return ansi.Purple + value
    // case 5: // entity
    //   return ansi.Purple + value
    // case 6: // jsx literals
    //   // return chalk.whiteSecondary(value)
    //   return ansi.White + value
    case 7: // sign
      // return ansi.Grey + value
      return ansi.Blue + value + ansi.BoldReset;
    // case 8: // comment
    //   return ansi.DarkGrey + value
    default:
      // return value
      return ansi.Yellow + value
  }
}
