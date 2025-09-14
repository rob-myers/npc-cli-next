/**
 * Based on https://www.npmjs.com/package/cli-high
 */

import { tokenize } from 'sugar-high'
import { ansi } from "./const";

export interface HighlightOptions {
  showLineNumbers?: boolean
}
export function highlight(code: string, options: HighlightOptions = { showLineNumbers: false }) {
  const tokens = tokenize(code)

  const lines: string[] = []
  let i = 1
  const lineTokens: Array<[number, string]> = []

  function createLine(content: string) {
    return content;
  }
  function flushLine(tokens: Array<[number, string]>) {
    lines.push(
      createLine(
        tokens
          .map(([type, value]) => {
            console.log({type,value});
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
                return ansi.Blue + value + ansi.Reset;
              // case 8: // comment
              //   return ansi.DarkGrey + value
              default:
                // return value
                return ansi.BrightYellow + value
            }
          })
          .join(''),
      ),
    )
  }

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
            flushLine(lineTokens)
            lineTokens.length = 0
          }
        }
      } else {
        lineTokens.push(token)
      }
    } else {
      lineTokens.push([type, ''])
      flushLine(lineTokens)
      lineTokens.length = 0
    }
  }

  if (lineTokens.length > 0) flushLine(lineTokens)

  return lines.join('\n')
}
