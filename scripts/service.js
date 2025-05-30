import fs from 'fs';
import childProcess from 'child_process';

// relative imports for sucrase-node
import { assertDefined, info } from '../npc-cli/service/generic';
import { ansi } from '../npc-cli/sh/const';

/**
 * @param {string} info 
 * @returns {FilenameMeta}
 */
function extractGeomorphInfo(info) {
  const is = /** @type {string[]} */ ([]);
  const has = /** @type {string[]} */  ([])
  const parts = info.split(' ');

  if (parts[0] === '[Overlay]') {
    is.push(assertDefined(parts.shift()).slice(1, -1).toLowerCase());
  }
  if (parts[0].match(/^\(\d+\)$/)) {
    is.push(`part-${assertDefined(parts.shift()).slice(1, -1)}`);
  }
  if (parts[0].match(/^\d+x$/)) {
    is.push(assertDefined(parts.shift()).toLowerCase());
  }

  const startBracket = parts.findIndex(x => x.startsWith('('));
  if (startBracket !== -1) {
    const bracketed = parts.splice(startBracket, parts.length).join(' ').slice(1, -1);
    has.push(...bracketed.split(',').map(x => normalizeStarshipChars(x)).filter(Boolean));
  }
  
  return {
    label: normalizeStarshipChars(parts.join('-')),
    is,
    has,
  };
}

export const rootFilenameRegex = /^(\d+x\d+)(.*)\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromRootFilename(matched) {
  const srcName = matched[0];
  const gridDim = /** @type {[number, number]} */ (matched[1].split('x').map(x => Number(x) / 5));
  const id = -1;
  const ids = [id];
  const description = normalizeStarshipChars(matched[2]);
  const dstName = `${gridDim[0]}x${gridDim[1]}${description ? `--${description}` : ''}.png`;
  return { srcName, dstName, id, gridDim, is: ['root'], has: [], ids };
}

export const geomorphsFilenameRegex = /^([A-Z]+)?([\d,]+) \[(\d+x\d+)\] ([^(]*)(.*)\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromGeomorphFilename(matched) {
  const srcName = matched[0];
  const ids = matched[1] ? [-1] : matched[2].split(',').map(Number);
  const id = ids[0];
  const extendedId = matched[1] ? `${matched[1]}${matched[2]}` : undefined;
  const gridDim = /** @type {[number, number]} */ (matched[3].split('x').map(x => Number(x) / 5));
  const description = matched[4].concat(matched[5]);
  const { label, is, has } = extractGeomorphInfo(description);
  const dstName =`g-${extendedId || matched[2].split(',')[0]}--${label}.png`;
  return { srcName, dstName, id, gridDim, is, has, ids, extendedId };
}

/**
 * [1: category] [2: local_id][3: a-z]? [4: subcategory ]?[5: width*height][6: meta].png
 */
export const symbolsFilenameRegex = /^(.*) (\d+)([a-z])? (?:(.+) )?\[(\d+x\d+)\](.*)\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromSymbolFilename(matched) {
  let category = normalizeStarshipChars(matched[1]);
  if (matched[4]) category += `-${normalizeStarshipChars(matched[4])}`;
  const id = Number(matched[2]);
  const ids = [id];
  const gridDim = /** @type {[number, number]} */ (matched[5].split('x').map(x => Number(x) / 5));
  // ids are local unlike geomorphs
  const is = /** @type {string[]} */ ([]);
  const has = /** @type {string[]} */ ([]);
  if (matched[3]) is.push(`part-${matched[3]}`);
  if (matched[6]) {
    is.push(normalizeStarshipChars(matched[6]));
    has.push(...matched[6].split(',').map(normalizeStarshipChars));
  }
  return {
    srcName: matched[0],
    dstName: `${category}--${matched[2]}--${gridDim[0]}x${gridDim[1]}.png`,
    id, gridDim, is, has, ids,
  };
}

/**
 * [1: category] [2: width*height].png
 */
export const altSymbolsFilenameRegex = /^(.*) \[(\d+x\d+)\]\.png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromAltSymbolFilename(matched) {
  const category = normalizeStarshipChars(matched[1]);
  const gridDim = /** @type {[number, number]} */ (matched[2].split('x').map(x => Number(x) / 5));
  return { 
    srcName: matched[0],
    dstName: `${category}--${gridDim[0]}x${gridDim[1]}.png`,
    id: -1, gridDim, is: [], has: [], ids: [-1],
  };
}

export const smallCraftFilenameRegex = /^(.*).png$/;

/**
 * @param {RegExpMatchArray} matched 
 * @returns {FileMeta}
 */
export function metaFromSmallCraftFilename(matched) {
  return {
    srcName: matched[0],
    dstName: `${normalizeStarshipChars(matched[1])}--small-craft.png`,
    id: -1,
    /** Unfortunately, grid dimension not provided in original filename. */
    gridDim: [0, 0],
    is: [], has: [], ids: [-1],
  };
}

/**
 * @param {string} word 
 */
function normalizeStarshipChars(word) {
  return word.trim().toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[ -]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  ;
}

/**
 * Logs std{out,err} with `label` prefix.
 * Options can be provided as single args like `--quality=75`.
 * @param {string} label
 * @param {string} command
 * @param {string[]} args
 */
export async function labelledSpawn(label, command, ...args) {
  await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const proc = childProcess.spawn(command, args);
      proc.stdout.on('data', (data) => /** @type {string} */ 
        (data.toString()).trimEnd().split('\n').forEach(line =>
          console.log(`[${ansi.Bold}${label}${ansi.Reset}]`, `${line}${ansi.Reset}`)
        )
      );
      // stderr needn't contain error messages
      proc.stderr.on('data', (data) => /** @type {string} */ 
        (data.toString()).trimEnd().split('\n').forEach(line =>
          console.log(`[${ansi.Bold}${label}${ansi.Reset}]`, `${line}${ansi.Reset}`)
        )
      );
      // proc.stdout.on('close', () => resolve());
      proc.on('error', (e) => reject(e));
      proc.on('exit', (errorCode) => {
        if (typeof errorCode === 'number' && errorCode !== 0) {
          reject({ errorCode });
        } else {
          resolve();
        }
      });
  }));
}

/**
 * Read file as string, or `null` on error.
 * @param {string} filePath 
 */
export async function tryReadString(filePath) {
  try {
    return (await fs.promises.readFile(filePath)).toString();
  } catch (e) {// assume doesn't exist
    return null;
  }
}

/**
 * @typedef FilenameMeta
 * @property {string} label
 * @property {string[]} is
 * @property {string[]} has
 */

/**
 * @typedef FileMeta
 * @property {string} srcName
 * @property {number} id Numeric identifier from Starship Geomorphs 2.0
 * @property {number[]} ids Sometimes a range is given
 * @property {string} [extendedId]
 * @property {[number, number]} gridDim Dimension in grid squares of Starship Geomorphs 2.0
 * @property {string} dstName
 * @property {string[]} is
 * @property {string[]} has
 */
