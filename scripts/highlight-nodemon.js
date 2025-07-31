import nodemon from 'nodemon';

// @ts-ignore
nodemon({
  delay: 0.1,
  ext: 'sh,js',
  runOnChangeOnly: true,
  script: 'scripts/noop.js', // 🔔 must override default behaviour 
  watch: [
    'npc-cli/sh/src/',
  ],
  exitcrash: true,
}).on('restart', onRestart).on('quit', onQuit);

/**
 * @param {string[]} [nodemonFiles] 
 */
async function onRestart(nodemonFiles = []) {
  console.log('🔔', {nodemonFiles});
  
  // 🚧 create "highlight script" which uses POST /api/syntax-highlight to create json
  // 🚧 run the script here
}

/**
 * @param {number} code 
 */
function onQuit(code) {
  process.exit();
}
