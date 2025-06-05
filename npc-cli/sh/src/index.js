import profile1Sh from "./profile-1.sh";
import profileAwaitWorldSh from "./profile-awaitWorld.sh";
import profileEmptySh from "./profile-empty.sh";

// 🔔 prefer kebab-case
export const profile = {
  'profile-1-sh': profile1Sh,
  'profile-awaitWorld-sh': profileAwaitWorldSh,
  'profile-empty-sh': profileEmptySh,
};

/**
 * @typedef {keyof typeof profile} ProfileKey
 */

/**
 * @template {any} [Datum=any]
 *
 * @typedef RunArg
 *
 * @property {import('../cmd.service').CmdService['processApi'] & {
*   getCached(key: '__WORLD_KEY_VALUE__'): import('../../world/World').State;
* }} api
* @property {string[]} args
* @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
* @property {import('../../terminal/TtyWithFunctions').TtyJsFunctions} lib
* @property {import('../../world/World').State} w See `CACHE_SHORTCUTS`
*
* @property {Datum} datum A shortcut for declaring a variable
*/
