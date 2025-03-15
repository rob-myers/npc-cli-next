namespace Key {

  type Anim = keyof import('../service/helper').Helper['fromAnimKey'];

  type DecorImg = import('../service/const.js').DecorImgKey;

  type Geomorph =(
    | "g-101--multipurpose"
    | "g-102--research-deck"
    | "g-103--cargo-bay"
    | "g-301--bridge"
    | "g-302--xboat-repair-bay"
    | "g-303--passenger-deck"
  );

  type GeomorphNumber = (
    | 101
    | 102
    | 103
    | 301
    | 302
    | 303
  );

  /**
   * Corresponds to Blender model and its exported GLB/GLTF.
   */
  type NpcClass = (
    | 'human-0'
    | 'cuboid-man' // 🚧 remove
  );

  type ObjectPickedType = (
    | 'wall'
    | 'floor'
    | 'ceiling'
    | 'door'
    | 'quad'
    | 'obstacle'
    | 'cuboid'
    | 'npc'
    | 'lock-light'
  );

  /**
   * Skin class
   * - can have multiple respective sheets.
   * - can be the skin class of multiple npc classes.
   */
  type SkinClass = (
    | "human-skin-0"
    | "cuboid-man" // 🚧 remove
  );

  /**
   * 🔔 Depends on service/const, but avoids duplication.
   */
  type Symbol = import('../service/const').SymbolKey;

}
