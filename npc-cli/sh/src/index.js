import profile1Sh from "./profile-1.sh";
import profileAwaitWorldSh from "./profile-awaitWorld.sh";

export const profile = {
  profile1Sh,
  profileAwaitWorldSh,
};

/**
 * @typedef {keyof typeof profile} ProfileKey
 */

/**
 * @template {any} [T=any]
 * @typedef RunArg
 * @property {import('../cmd.service').CmdService['processApi'] & {
*   getCached(key: '__WORLD_KEY_VALUE__'): import('../../world/World').State;
* }} api
* @property {string[]} args
* @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
* @property {import('../../world/World').State} w See `CACHE_SHORTCUTS`
* @property {T} datum A shortcut for declaring a variable
*/
