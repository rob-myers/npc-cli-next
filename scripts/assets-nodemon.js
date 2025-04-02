import nodemon from 'nodemon';
import { labelledSpawn } from './service';
import { info } from '../npc-cli/service/generic';

/** Is the script currently running? */
let running = false;
/** We pause to allow multiple changes to aggregate */
const delayMs = 300;
/** Absolute path to `Date.now()` */
const changed = /** @type {Map<string, number>} */ (new Map());

// @ts-ignore
nodemon({
  delay: 0.1,
  ext: 'svg,png,glb',
  runOnChangeOnly: true,
  script: 'scripts/noop.js', // 🔔 must override default behaviour 
  watch: [
    'scripts/assets.js',
    'npc-cli/service/geomorph.js',
    'npc-cli/service/const.js',
    'media/symbol/',
    'media/map/',
    'media/decor/',
    'media/npc/',
    'public/3d/*.glb',
  ],
  exitcrash: true,
}).on('restart', onRestart).on('quit', onQuit);

info('watching assets...');

/**
 * @param {string[]} [nodemonFiles] 
 */
async function onRestart(nodemonFiles = []) {
  nodemonFiles.forEach(file => changed.set(file, Date.now()));
  
  if (!running) {
    running = true;
  } else {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, delayMs));
  
  const startEpochMs = Date.now();
  const changedFiles = Array.from(changed.keys());
  await labelledSpawn('assets',
    // 'sucrase-node',
    'bun',
    'scripts/assets', `--changedFiles=${JSON.stringify(changedFiles)}`,
  );
  const seconds = ((Date.now() - startEpochMs) / 1000).toFixed(2);
  info(`took ${seconds}s`);
  changed.forEach((epochMs, file) =>
    epochMs <= startEpochMs && changed.delete(file)
  );

  running = false;

  if (changed.size > 0) {
    await onRestart();
  }
}

/**
 * @param {number} code 
 */
function onQuit(code) {
  // console.log('quit', code);
  process.exit();
}
