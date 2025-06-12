import { defaultClassKey, fromDecorImgKey, fromSymbolKey, npcClassToMeta } from "./const";
import { keys } from "./generic";

/**
 * - Use object so can merge into `w.lib`.
 * - Used in web workers.
 * - Used in server script assets.js.
 */
export const helper = {

  /** @type {Record<Key.ComponentClass, true>} */
  fromComponentClass: {
    Debug: true,
    HelloWorld: true,
    Manage: true,
    World: true,
  },

  /** Aligned to media/symbol/{key}.svg */
  fromSymbolKey,

  /** Aligned to media/decor/{key}.svg */
  fromDecorImgKey,

  ...(/** @param {Record<Key.Profile, true>} fromProfileKey */
    (fromProfileKey) => ({ fromProfileKey, profileKeys: keys(fromProfileKey) })
  )({
    default_profile: true, // 1st is default
    profile_1: true,
    empty_profile: true,
  }),

  ...(/** @param {Record<Key.Map, true>} fromMapKey */
    (fromMapKey) => ({
      fromMapKey,
      mapKeys: keys(fromMapKey),
    })
  )({
    "small-map-1": true, // default
    "demo-map-1": true,
  }),

  /** @type {Record<Key.NpcClass, true>} */
  fromNpcClassKey: {
    "human-0": true,
  },

  /**
   * 🔔 These "basic layouts" are populated when initiateBrowser
   * @type {Record<Key.LayoutPreset, import("../tabs/tab-util").BasicTabsLayout>}
   */
  layoutPreset: {
    "empty-layout": [],
    "layout-preset-0": [
      [
        {
          type: "component",
          class: "World",
          filepath: "world-0",
          props: {
            worldKey: "world-0",
            mapKey: "demo-map-1",
          },
        },
        {
          type: "component",
          class: "Debug",
          filepath: "debug-0",
          props: {},
        },
      ],
      [
        { type: "component", class: "Manage", filepath: "manage-0", props: {} },
        {
          type: "terminal",
          filepath: "tty-1",
          profileKey: 'profile_1',
          env: { WORLD_KEY: "world-0" },
        },
        // {
        //   type: "terminal",
        //   filepath: "tty-2",
        //   profileKey: 'profile-awaitWorld-sh',
        //   env: { WORLD_KEY: "world-0" },
        // },
        { type: "component", class: "HelloWorld", filepath: "hello-world-1", props: {} },
      ]
    ],
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
    Debug: { key: 'Debug', tabPrefix: 'debug' },
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
  
  /** 🚧 should be by classKey */
  defaults: {
    height: npcClassToMeta[defaultClassKey].modelHeight * npcClassToMeta[defaultClassKey].scale,
    radius: npcClassToMeta[defaultClassKey].modelRadius * npcClassToMeta[defaultClassKey].scale * 0.75,
    runSpeed: npcClassToMeta[defaultClassKey].runSpeed * npcClassToMeta[defaultClassKey].scale,
    walkSpeed: npcClassToMeta[defaultClassKey].walkSpeed * npcClassToMeta[defaultClassKey].scale,
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
   * @param {string} input 
   * @returns {input is Key.TabClass}
   */
  isTabClassKey(input) {
    return input === 'Tty' || (input in helper.fromComponentClass);
  },

};

/**
 * @typedef {typeof helper} Helper
 */
