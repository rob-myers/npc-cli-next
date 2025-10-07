/**
 * Usage
 * - npm run cwebp '{ "files": ["/2d/g-101--multipurpose.floor.png", "/2d/g-301--bridge.floor.png"] }'
 * - npm run --quality=50 cwebp-fast '{ "files": ["/2d/g-101--multipurpose.floor.png", "/2d/g-301--bridge.floor.png"] }'
 * 
 * Paths are relative to repo root.
 * 
 * Depends on `cwebp`.
 */
/// <reference path="./deps.d.ts"/>

import path from "path";
import childProcess from "child_process";
//@ts-ignore
import getopts from 'getopts';

import { error, safeJsonParse } from "../npc-cli/service/generic";

const opts = getopts(process.argv, { string: ['quality'] });
const [,, filesJsonStr] = opts._;
const quality = opts.quality || 75;
const repoRootDir = path.resolve(__dirname, "../..");

(async function main() {

  const json = /** @type {FilesJson} */ (safeJsonParse(filesJsonStr));
  if (!(json && json.files?.every(item => typeof item === 'string') )) {
    error(`usage: npm run cwebp '{ files: ["path/to/file1.png"] }'`);
    process.exit(1);
  }

  childProcess.execSync(`
    echo '${
      json.files.map(x => `"${path.resolve(repoRootDir, x)}"`).join('\n')
    }' |
      xargs -L 1 -I {} -n 1 -P 3 cwebp -q ${quality} -noasm ${'-quiet'} "{}" -o "{}".webp
  `);
})();

/**
 * @typedef FilesJson
 * @property {string[]} files
 * @property {any} [opts] // 🚧
 */
