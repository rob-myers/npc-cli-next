declare namespace NPC {

  type NPC = BaseNPC & { api: import('../world/npc').NpcApi };
  type BaseNPC = import('../world/npc').BaseNPC;

  interface NPCDef {
    /** User specified e.g. `rob` */
    key: string;
    /** Numeric id used e.g. for object-picking */
    uid: number;
    /** Specifies the underlying 3D model */
    classKey: Key.NpcClass;
    /** Radians, cw from north viewed from above */
    angle: number;
    /** World units per second */
    runSpeed: number;
    /** World units per second */
    walkSpeed: number;
  }

  interface Model {
    animations: import('three').AnimationClip[];
    /** Root bones */
    bones: import('three').Bone[];
    /** Root group available on mount */
    group: import('three').Group;
    /** Mounted material (initially import('three').MeshPhysicalMaterial via GLTF) */
    material: import('three').ShaderMaterial;
    /** Mounted mesh */
    mesh: import('three').SkinnedMesh;
    scale: number;
    toAct: Record<Key.Anim, import('three').AnimationAction>;
  }

  interface ClassDef {
    /** e.g. 'Scene' */
    groupName: string;
    /** e.g. 'human_0-material' */
    materialName: string; 
    /** e.g. 'human_0' */
    meshName: string;
    /** Height above npc's head, pre-scale */
    modelAnimHeight: Record<Key.Anim, number>;
    /** Pre-scale height of label */
    modelLabelHeight: number;
    /** Pre-scale height excluding label */
    modelHeight: number;
    /** Pre-scale */
    modelRadius: number;
    /** Format `/3d/{npcClassKey}.glb` */
    modelUrl: `/3d/${Key.NpcClass}.glb`;
    npcClassKey: Key.NpcClass;
    runSpeed: number;
    /** e.g. `1` */
    scale: number;
    /** Animation to timeScale, default 1 */
    timeScale: Partial<Record<Key.Anim, number>>;
    walkSpeed: number;
  }

  interface TexMeta {
    /** e.g. `human-0` */
    npcClassKey: Key.NpcClass;
    /** e.g. `0` 🔔 (assume no gaps and `0` exists) */
    skinSheetId: number;
    /** e.g. `human-0.0.tex.svg` */
    svgBaseName: string;
    svgPath: string;
    pngPath: string;
    /** Can determine by comparing modified time of SVG vs PNG */
    canSkip: boolean;
  }

  interface GltfMeta {
    /** e.g. `human-0` */
    npcClassKey: Key.NpcClass;
    /** e.g. `human-0.glb` */
    glbBaseName: string;
    /** e.g. `.../public/3d/human-0.glb` */
    glbPath: string;
    glbHash: number;
  }

  interface SpawnOpts extends Partial<Pick<NPCDef, 'angle' | 'classKey' | 'runSpeed' | 'walkSpeed'>> {
    npcKey: string;
    at: MaybeMeta<(Geom.VectJson | import('three').Vector3Like)>;
    /** Position to look towards (overrides `angle`) */
    look?: Geom.VectJson | import('three').Vector3Like;
    /**
     * - `string` for skin shortcuts e.g. `soldier-0` or `soldier-0/-///`
     * - object permits brace-expansion of keys.
     */
    skin?: string | Record<string, SkinReMapValue>;
  }

  type Event = (
    | PointerUpEvent
    | PointerDownEvent
    | LongPointerDownEvent
    // | PointerMoveEvent
    | { key: "disabled" }
    | { key: "enabled" }
    | { key: "npc-internal"; npcKey: string; event: "cancelled" | "paused" | "resumed" }
    | { key: "spawned"; npcKey: string; gmRoomId: Geomorph.GmRoomId }
    | { key: "started-moving"; npcKey: string; showNavPath: boolean }
    | { key: "stopped-moving"; npcKey: string; reason: NPC.StopReason }
    | { key: "removed-npc"; npcKey: string }
    | { key: "enter-doorway"; npcKey: string } & Geomorph.GmDoorId
    | { key: "exit-doorway"; npcKey: string } & Geomorph.GmDoorId
    | { key: "enter-room"; npcKey: string } & Geomorph.GmRoomId
    | { key: "exit-room"; npcKey: string } & Geomorph.GmRoomId
    | UpdatedGmDecorEvent
    | { key: "decors-removed"; decors: Geomorph.Decor[] }
    | { key: "decors-added"; decors: Geomorph.Decor[] }
    | {
      /** Try close door after countdown, and keep trying thereafter */
      key: "try-close-door";
      gmId: number; doorId: number; meta?: Meta
    }
    | { key: "opened-door"; gmId: number; doorId: number; meta?: Meta }
    | { key: "closed-door"; gmId: number; doorId: number; meta?: Meta }
    | { key: "locked-door" | "unlocked-door"; gmId: number; doorId: number; meta: Meta }
    | { key: "enter-collider"; npcKey: string; } & BaseColliderEvent
    | { key: "exit-collider"; npcKey: string; } & BaseColliderEvent
    | {
        key: "pre-request-nav";
        /**
         * `changedGmIds[gmId]` is `true` iff either:
         * - `map.gms[gmId]` has different `gmKey` or `transform`
         * - geomorph `map.gms[gmId].gmKey` has different navPoly
         * 
         * The latter is true whenever a room polygon changes.
         * 
         * It is defined for each `gmId` in current map.
         */
        changedGmIds: boolean[];
      }
    | { key: "pre-setup-physics" }
    | { key: "nav-updated" }
    | { key: 'contextmenu-link'; linkKey: string }
    | { key: 'clear-off-mesh'; npcKey: string; }
    | { key: 'enter-off-mesh'; npcKey: string; offMesh: NPC.OffMeshLookupValue }
    | { key: 'enter-off-mesh-main'; npcKey: string }
    | { key: 'exit-off-mesh'; npcKey: string; offMesh: NPC.OffMeshLookupValue }
    | { key: 'logger-link'; npcKey: string; } & NPC.LoggerLinkEvent
    | { key: 'speech'; npcKey: string; speech: string }
    | { key: 'controls-start' }
    | { key: 'controls-end' }
    | { key: 'fade-npc'; npcKey: string; opacityDst: number }
    // ...
  );

  type UpdatedGmDecorEvent = { key: "updated-gm-decor" } & (
    | { type: 'partial'; gmIds: number[]; } // partial <=> gmsIds.length did not change
    | { type: 'all' }
  );

  type BaseColliderEvent = (
    | { type: 'circle' | 'rect'; decorKey: string }
    | { type: 'nearby' } & Geomorph.GmDoorId
  );

  type PointerUpEvent = Pretty<BasePointerEvent & {
    key: "pointerup";
  }>;

  type PointerDownEvent = Pretty<BasePointerEvent & {
    key: "pointerdown";
  }>;
  
  type LongPointerDownEvent = BasePointerEvent & {
    key: "long-pointerdown";
  }

  type BasePointerEvent = {
    clickId?: string;
    /** Distance in screen pixels from previous pointerdown. */
    distancePx: number;
    /** Was previous pointerdown held down for long? */
    justLongDown: boolean;
    /** Ctrl/Shift/Command was down */
    keys?: ('ctrl' | 'shift' | 'meta')[];
    /** Number of active pointers */
    pointers: number;
    /** Was the right mouse button being pressed?  */
    rmb: boolean;
    /** Screen position of pointer */
    screenPoint: Geom.VectJson;
    /** Touch device? */
    touch: boolean;
    position: import("three").Vector3Like;
    /** `{ x: position.x, y: position.z }` */
    point: Geom.VectJson;
    /** Properties of the thing we clicked. */
    meta: Meta;
  };

  type ClickOutput = import('three').Vector3Like & {
    keys?: BasePointerEvent['keys'];
    meta: Meta;
    xz: Geom.VectJson;
  };

  type TiledCacheResult = import('@recast-navigation/core').ImportTileCacheResult;

  interface TileCacheConvexAreaDef {
    areaId: number;
    areas: {
      /** Must define a convex polygon */
      verts: import("three").Vector3Like[];
      hmin: number;
      hmax: number;
    }[];
  }

  type CrowdAgent = import("@recast-navigation/core").CrowdAgent;

  type SrcToOffMeshLookup = {
    [xz2DString: `${number},${number}`]: OffMeshLookupValue;
  };
  type DoorToOffMeshLookup = {
    [gdKey: Geomorph.GmDoorKey]: OffMeshLookupValue[];
  };

  type OffMeshLookupValue = Geomorph.GmDoorId & {
    offMeshRef: number;
    src: import('three').Vector3Like;
    dst: import('three').Vector3Like;
    /** Key of connection in lookup. */
    key: keyof SrcToOffMeshLookup;
    /** Key of connection in reverse direction. */
    reverseKey: keyof SrcToOffMeshLookup;
    /** Room corresponding to `src` */
    srcGrKey: Geomorph.GmRoomKey;
    /** Room corresponding to `dst` */
    dstGrKey: Geomorph.GmRoomKey;
    /** Whether respective door's normal points towards `src` */
    aligned: boolean;
    /** Meta of dst room e.g. for small rooms */
    dstRoomMeta: Meta;
  };

  type OffMeshState = {
    /** The npc using this offMeshConnection. */
    npcKey: string;
    /** Original connection */
    orig: OffMeshLookupValue;
    /**
     * Current progress along the two segments.
     * - `0` is initial seg, from npc position to start of offMeshConnection
     * - `1` is 1st half of offMeshConnection
     * - `2` is 2nd half of offMeshConnection
     */
    seg: 0 | 1 | 2;
    /** Initial position of npc */
    initPos: Geom.VectJson;
    /** Adjusted src */
    src: Geom.VectJson;
    /** Adjusted dst */
    dst: Geom.VectJson;

    /** Unit vector from "initial npc position" to "adjusted src" */
    initUnit: Geom.VectJson;
    /** Unit vector from "adjusted src" to "adjusted dst" */
    mainUnit: Geom.VectJson;
    /**
     * Unit vector from "adjusted dst" to next corner after off-mesh-connection.
     * It can be null if these two points are too close.
     */
    nextUnit: null | Geom.VectJson;
    /** Scale factor converting `dtAgentAnimation.t` into total distance along 2 segs */
    tToDist: number;
  };

  /** Provided after `dtAgentAnimation` has been re-configured */
  interface OverrideOffMeshResult {
    initPos: Geom.VectJson;
    /** Adjusted src */
    src: Geom.VectJson;
    /** Adjusted dst */
    dst: Geom.VectJson;
    nextCorner: Geom.VectJson
  }

  type Obstacle = {
    id: number;
    o: import("@recast-navigation/core").Obstacle;
    mesh: import('three').Mesh;
  };

  type ObstacleRef = import("@recast-navigation/core").ObstacleRef;

  type DecodedObjectPick = Meta<{
    picked: Key.ObjectPickedType;
    instanceId: number;
  }>;

  type MetaActDef = (
    | { key: 'open' | 'close' | 'lock' | 'unlock'; gdKey: Geomorph.GmDoorKey; }
    // ...
  );

  /** Action triggered from ContextMenu */
  interface MetaAct<T = {}> {
    def: MetaActDef;
    /** Label of button */
    label: string;
    /** `icon--*` key */
    icon: Key.DecorImg;
    /** The meta of ContextMenu (from prior click) when button was clicked */
    meta: Meta<T>;
  }

  interface DownData {
    longDown: boolean;
    screenPoint: Geom.Vect;
    position: import('three').Vector3;
    normal: import('three').Vector3;
    meta: Meta;
    /** Derived from `normal` */
    quaternion: import('three').Quaternion;
  }

  interface ContextMenuLink {
    key: string;
    label: string;
    selected?(): boolean;
  }

  interface ContextMenuContextDef {
    position: import('three').Vector3;
    meta: Meta;
  }

  /**
   * Assume `parent.meta` has already been updated.
   */
  type ContextMenuMatcher = (parent: import('../world/ContextMenu').State) => {
    showLinks?: ContextMenuLink[];
    hideKeys?: string[];
  };

  interface LoggerLinkEvent {
    /** e.g. link `[rob]` yields `rob` */  
    linkText: string;
    /** Full possibly-wrapped line */  
    fullLine: string;
    /** 0-based */  
    startRow: number;
    /** 0-based */  
    endRow: number;
    /** 1-based (x,y) positions, originally from hover event */
    viewportRange: import("@xterm/xterm").IViewportRange;
  }

  /**
   * For a given mesh, a mapping from triangle id to its parent uv-rectangle's key.
   * The latter arises from the original SVG used to generate the uv-map, see
   * e.g. media/npc/human-0.svg.
   */
  type TriToUvKeys = {
    /**
     * Key of a uv-rect defined in skin SVG.
     * Never begins with `_`.
     */
    uvRectKey: string;
    /** This is just `uvRectKey.split('_')[1]` */
    skinPartKey: Key.SkinPart;
  }[];

  type SkinPartToUvRect = Record<Key.SkinPart, Geomorph.UvRect>;
  
  /**
   * We also permit brace expansion in keys, e.g.
   * > `"head-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },`
   */
  type SkinReMap = { [skinPartKey in Key.SkinPart]?: SkinReMapValue };

  type SkinReMapValue = {
    /**
     * For example `base`, where `base_{skinPart}` is in this npc's class's uv map.
     */
    prefix: string;
    /**
     * Optionally look inside another model's UV map.
     */
    classKey?: Key.NpcClass;
    /** 
     * Optionally use another skin part:
     * > e.g. if `prefix` is `body-overlay-back` could use `robot--icon_body-overlay-front`
     * 
     * In other words, an icon mapped to body overlay front can also be used on the back.
     */
    otherPart?: Key.SkinPart;
  };

  /**
   * Values are `[r, g, b, a]` where `r`, `g`, `b`, `a` in `[0, 1]`
   */
  type SkinTint = Partial<Record<Key.SkinPart, SkinTintValue>>

  type SkinTintValue = [number, number, number, number];

  interface GltfAux {
    npcClassKey: Key.NpcClass;
    breathTriIds: number[];
    labelTriIds: number[];
    selectorTriIds: number[];
    labelUvRect4: [number, number, number, number];
    partToUv: NPC.SkinPartToUvRect;
    triToKey: NPC.TriToUvKeys;
    animHeights: Record<Key.Anim, number>;
    labelHeight: number;
  }

  interface MoveOpts {
    to: MaybeMeta<Geom.VectJson | THREE.Vector3Like>;
    /**
     * Animation to play once we arrive.
     * - default is `Idle`.
     * - use 'none' for continuous movement
     */
    arriveAnim?: 'none' | Key.Anim;
    /**
     * Show possible path of agent path (only a guide).
     */
    debugPath?: boolean;
  }

  type StopReason = { type: 'stop-reason'; } & (
    | { key: 'arrived'; }
    | { key: 'blocked-doorway'; otherNpcKey: string; }
    | { key: 'collided'; otherNpcKey: string; }
    | { key: 'locked-door'; }
    | { key: 'move-again'; }
    | { key: 'removed'; }
    | { key: 'respawned'; }
    | { key: 'stopped'; }
    | { key: 'stuck'; }
  );
  
}
