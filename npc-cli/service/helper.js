import { defaultClassKey, fromDecorImgKey, fromSymbolKey, npcClassToMeta, TABS_API_KEY } from "./const";
import { keys, mapValues } from "./generic";
import * as shProfiles from '../sh/profiles';

/**
 * - Use object so can merge into `w.lib`.
 * - Used in web workers.
 * - Used in server script assets.js.
 */
export const helper = {

  /** 🚧 by classKey */
  defaults: {
    height: npcClassToMeta[defaultClassKey].modelHeight * npcClassToMeta[defaultClassKey].scale,
    // radius: npcClassToMeta[defaultClassKey].modelRadius * npcClassToMeta[defaultClassKey].scale * 0.675,
    radius: npcClassToMeta[defaultClassKey].modelRadius * npcClassToMeta[defaultClassKey].scale * 0.6,
    runSpeed: npcClassToMeta[defaultClassKey].runSpeed * npcClassToMeta[defaultClassKey].scale * 0.9,
    walkSpeed: npcClassToMeta[defaultClassKey].walkSpeed * npcClassToMeta[defaultClassKey].scale * 0.8,
  },

  /** @type {Record<Key.ComponentClass, true>} */
  fromComponentClass: {
    HelloWorld: true,
    Manage: true,
    World: true,
  },

  /** Aligned to media/symbol/{key}.svg */
  fromSymbolKey,

  /** Aligned to media/decor/{key}.svg */
  fromDecorImgKey,

  fromProfileKey: mapValues(shProfiles, () => true),
  profileKeys: keys(shProfiles),

  ...(/** @param {Record<Key.Map, true>} fromMapKey */
    (fromMapKey) => ({
      fromMapKey,
      mapKeys: keys(fromMapKey),
    })
  )({
    "small-map-1": true, // default
    "demo-map-1": true,
    "101-only": true,
    "102-only": true,
    "103-only": true,
    "301-only": true,
    "302-only": true,
    "303-only": true,
  }),

  /** @type {Record<Key.NpcClass, true>} */
  fromNpcClassKey: {
    "human-0": true,
  },

  /** @type {Record<Key.TabClassPrefix, true>} */
  fromTabPrefix: {
    "hello-world": true,
    manage: true,
    tty: true,
    world: true,
  },

  /**
   * @type {Record<Key.LayoutPreset, import("../tabs/tab-util").BasicTabsLayout>}
   */
  layoutPreset: {
    "empty-layout": [],

    // each profile has a basic layout preset
    ...keys(shProfiles).reduce((agg, profileKey) => {
      agg[`world-tty-${profileKey}`] = [
        [
          { type: "component", class: "World", filepath: "world-0", props: { worldKey: "world-0", mapKey: "small-map-1" }, weight: 2 },
        ],
        [
          { type: "terminal", filepath: "tty-0", profileKey, env: { WORLD_KEY: "world-0", TABS_API_KEY }, weight: 1 },
          { type: "component", class: "Manage", filepath: "manage-0", props: {}, weight: 1 },
        ],
      ];
      return agg;
    }, /** @type {Record<`world-tty-${Key.Profile}`, import("../tabs/tab-util").BasicTabsLayout>} */ ({})),
  },

  /** Global over all `queryFilter`s */
  navPolyFlag: /** @type {const} */ ({
    /** `2^0` */
    unWalkable: 1,
    /** `2^1` */
    walkable: 2,
  }),

  /** Recast-Detour */
  queryFilterType: /** @type {const} */ ({
    default: 0,
    respectUnwalkable: 1,
  }),

  /** @type {Record<Key.TabClass, { key: Key.TabClass; tabPrefix: Key.TabClassPrefix; }>} */
  toTabClassMeta: {
    HelloWorld: { key: 'HelloWorld', tabPrefix: 'hello-world' },
    Manage: { key: 'Manage', tabPrefix: 'manage' },
    Tty: { key: 'Tty', tabPrefix: 'tty' },
    World: { key: 'World', tabPrefix: 'world' },
  },

  /** @type {Record<Key.GeomorphNumber, Key.Geomorph>} */
  toGmKey: {
    101: "g-101--multipurpose",
    102: "g-102--research-deck",
    103: "g-103--cargo-bay",
    301: "g-301--bridge",
    302: "g-302--xboat-repair-bay",
    303: "g-303--passenger-deck",
  },

  /** @type {Record<Key.Geomorph, Key.GeomorphNumber>} */
  toGmNum: {
    "g-101--multipurpose": 101,
    "g-102--research-deck": 102,
    "g-103--cargo-bay": 103,
    "g-301--bridge": 301,
    "g-302--xboat-repair-bay": 302,
    "g-303--passenger-deck": 303,
  },

  /** @type {Record<Key.Geomorph, Key.Symbol>} */
  toHullKey: {
    "g-101--multipurpose": "101--hull",
    "g-102--research-deck": "102--hull",
    "g-103--cargo-bay": "103--hull",
    "g-301--bridge": "301--hull",
    "g-302--xboat-repair-bay": "302--hull",
    "g-303--passenger-deck": "303--hull",
  },
  
  /** @type {Record<Key.Anim, true>} */
  fromAnimKey: {
    Idle: true,
    Lie: true,
    Run: true,
    Sit: true,
    Walk: true,
  },

  /** @type {Record<Key.Anim, boolean>} */
  toAnimKeyLookable: {
    Idle: true,
    Lie: false,
    Run: true,
    Sit: false,
    Walk: true,
  },

  fromSkinPart: /** @type {const} */ ({
    'head-front': true,
    'head-back': true,
    'head-left': true,
    'head-right': true,
    'head-top': true,
    'head-bottom': true,
  
    'body-top': true,
    'body-bottom': true,
    'body-left': true,
    'body-front': true,
    'body-right': true,
    'body-back': true,
  
    'head-overlay-front': true,
    'head-overlay-back': true,
    'head-overlay-left': true,
    'head-overlay-right': true,
    'head-overlay-top': true,
    'head-overlay-bottom': true,
  
    'body-overlay-top': true,
    'body-overlay-bottom': true,
    'body-overlay-left': true,
    'body-overlay-front': true,
    'body-overlay-right': true,
    'body-overlay-back': true,
    
    'selector': true,
    'breath': true,
    'label': true,
  }),

  /**
   * @param {Key.Anim} animKey 
   */
  canAnimKeyLook(animKey) {
    return helper.toAnimKeyLookable[animKey];
  },

  /**
   * Try construct degenerate "id" from partial.
   * @param {Partial<Geomorph.GmDoorId>} meta 
   * @returns {null | Geomorph.GmDoorId}
   */
  extractGmDoorId(meta) {
    if (typeof meta.gdKey === 'string') {
      return {
        gdKey: meta.gdKey,
        gmId: meta.gmId ?? Number(meta.gdKey.slice(1).split('d', 1)[0]),
        doorId: meta.doorId ?? Number(meta.gdKey.split('d', 1)[1]),
      };
    } else if (typeof meta.gmId === 'number' &&  typeof meta.doorId === 'number') {
      return {
        gdKey: `g${meta.gmId}d${meta.doorId}`,
        gmId: meta.gmId,
        doorId: meta.doorId,
      };
    } else {
      return null;
    }
  },

  /**
   * @param {Meta} meta 
   * @returns {Key.Anim}
   */
  getAnimKeyFromMeta(meta) {
    switch (true) {
      case meta.sit:
        return 'Sit';
      case meta.stand:
        return 'Idle';
      case meta.lie:
        return 'Lie';
      default:
        return 'Idle';
    }
  },

  /**
   * @param {Meta} meta 
   * @returns {null | Key.DoPoint}
   */
  getDoPointKey(meta) {
    if (helper.isVectJson(meta.doPoint) === false) {
      return null;
    }
    const { doPoint: { x, y: z }, y = 0 } = meta;
    return `${x},${y},${z}`;
  },

  /**
   * Usage:
   * - `getGmDoorId(gdKey)`
   * - `getGmDoorId(gmId, doorId)`
   * @param {[Geomorph.GmDoorKey] | [number, number]} input
   * @returns {Geomorph.GmDoorId}
   */
  getGmDoorId(...input) {
    if (typeof input[0] === 'string') {
      const [, gStr, dStr] = input[0].split(/[gd]/);
      return { gdKey: input[0], gmId: Number(gStr), doorId: Number(dStr) };
    } else {
      return { gdKey: helper.getGmDoorKey(input[0], input[1]), gmId: input[0], doorId: input[1] };
    }
  },

  /**
   * @param {number} gmId
   * @param {number} doorId
   * @returns {Geomorph.GmDoorKey}
   */
  getGmDoorKey(gmId, doorId) {
    return `g${gmId}d${doorId}`;
  },

  /**
   * @param {number} gmId
   * @param {number} roomId
   * @returns {Geomorph.GmRoomKey}
   */
  getGmRoomKey(gmId, roomId) {
    return `g${gmId}r${roomId}`;
  },

  /**
   * Usage:
   * - `getGmRoomId(grKey)`
   * - `getGmRoomId(gmId, roomId)`
   * @param {[Geomorph.GmRoomKey] | [number, number]} input
   * @returns {Geomorph.GmRoomId}
   */
  getGmRoomId(...input) {
    if (typeof input[0] === 'string') {
      const [, gStr, rStr] = input[0].split(/[gr]/);
      return { grKey: input[0], gmId: Number(gStr), roomId: Number(rStr) };
    } else {
      return { grKey: helper.getGmRoomKey(input[0], input[1]), gmId: input[0], roomId: input[1] };
    }
  },
  
  /**
   * @param {string} input 
   * @returns {input is Key.Anim}
   */
  isAnimKey(input) {
    return input in helper.fromAnimKey;
  },

  /**
   * @param {string} input 
   * @returns {input is Key.ComponentClass}
   */
  isComponentClassKey(input) {
    return input in helper.fromComponentClass;
  },

  /**
   * @param {string | undefined} input
   * @returns {input is Key.DecorImg}
   */
  isDecorImgKey(input) {
    return input !== undefined && input in helper.fromDecorImgKey;
  },

  /**
   * 🔔 Given `grKey` assume `gmId`, `roomId` too.
   * @param {any} input 
   * @returns {input is Geomorph.GmRoomId}
   */
  isGmRoomId(input) {
    return !!input && typeof input.grKey === 'string';
  },

  /**
   * @param {string} input 
   * @returns {input is Key.LayoutPreset}
   */
  isLayoutPresetKey(input) {
    return input in helper.layoutPreset;
  },

  /**
   * @param {string} input 
   * @returns {input is Key.Map}
   */
  isMapKey(input) {
    return input in helper.fromMapKey;
  },

  /**
   * @param {string} input 
   * @returns {input is Key.NpcClass}
   */
  isNpcClassKey(input) {
    return input in helper.fromNpcClassKey;
  },

  /**
   * @param {string} input 
   * @returns {input is Key.Profile}
   */
  isProfileKey(input) {
    return input in helper.fromProfileKey;
  },

  /**
   * @param {string} input 
   * @returns {input is Key.SkinPart}
   */
  isSkinPart(input) {
    return input in helper.fromSkinPart;
  },

  /**
   * @param {Key.Map} mapKey 
   */
  isSmallMap(mapKey) {
    return mapKey.includes('small');
  },

  /**
   * @param {*} error
   * @returns {error is NPC.StopReason} 
   */
  isStopReason(error) {
    return !!error && /** @type {NPC.StopReason} */ (error)?.type === 'stop-reason';
  },

  /**
   * @param {string} input 
   * @returns {input is Key.TabClass}
   */
  isTabClassKey(input) {
    return input === 'Tty' || (input in helper.fromComponentClass);
  },

  /**
   * @param {string} input 
   * @returns {input is Key.TabId}
   */
  isTabId(input) {
    if (typeof input !== 'string') {
      return false;
    } else {
      const matched = input.match(/^(.+)-\d+$/);
      return (
        matched !== null
        && matched[1] in helper.fromTabPrefix
      );
    }
  },

  /**
   * @param {*} input 
   * @return {input is Geom.VectJson}
   */
  isVectJson(input) {
    return !!input && typeof input.x === 'number' && typeof input.y === 'number';
  },

  /**
   * - Does not create fresh object in case of 2D input.
   * - Preserves meta
   * 
   * - `{ x, y, z }` -> `{ x, y: z }`
   * - `THREE.Vector3` -> `{ x, y: z }`
   * - `{ x, y }` -> same object
   * @param {MaybeMeta<NPC.GroundPoint>} input 
   * @returns {MaybeMeta<Geom.VectJson>}
   */
  toXZ(input) {
    // 🚧 careful of hidden consequences
    // return { x: input.x, y: 'z' in input ? input.z : input.y };

    if ('z' in input) {
      return {
        x: input.x,
        y: input.z,
        ...(input.meta && { meta: input.meta }),
      };
    } else {
      return input;
    }
  },
};

/**
 * @typedef {typeof helper} Helper
 */
