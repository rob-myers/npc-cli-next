namespace Key {

  type Anim = (
    | 'Idle'
    | 'Lie'
    | 'Run'
    | 'Sit'
    | 'Walk'
  );

  type ComponentClass = import('../tabs/tab-factory').ComponentClassKey;

  type TabClass = ComponentClass | 'Tty';
  type TabClassPrefix = CamelToKebab<TabClass>;

  type DecorImg = import('../service/const.js').DecorImgKey;

  type Geomorph =(
    | 'g-101--multipurpose'
    | 'g-102--research-deck'
    | 'g-103--cargo-bay'
    | 'g-301--bridge'
    | 'g-302--xboat-repair-bay'
    | 'g-303--passenger-deck'
  );

  type GeomorphNumber = (
    | 101
    | 102
    | 103
    | 301
    | 302
    | 303
  );

  type LayoutPreset = (
    | 'empty-layout'
    | 'layout-preset-0'
  );

  type Map = import('../world/World.jsx').MapKey;

  /**
   * Corresponds to Blender model and its exported GLB/GLTF.
   */
  type NpcClass = (
    | 'human-0'
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

  
  type Profile = import('../sh/src').ProfileKey

  type SkinPart = keyof import('../service/helper').Helper['fromSkinPart'];

  /**
   * 🔔 Depends on service/const, but avoids duplication.
   */
  type Symbol = import('../service/const').SymbolKey;

}
