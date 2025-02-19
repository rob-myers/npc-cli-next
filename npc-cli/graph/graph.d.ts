declare namespace Graph {
  type BaseGraph<T> = import("./base-graph").BaseGraph<T>;

  interface BaseNode {
    /** Identifies the node. */
    id: string;
  }
  interface BaseEdgeOpts {
    src: string;
    dst: string;
  }

  type Edge<Node extends BaseNode = BaseNode, EdgeOpts extends BaseEdgeOpts = BaseEdgeOpts> = Omit<
    EdgeOpts,
    "id" | "src" | "dst"
  > & {
    /** `${src_id}->${dst_id}` */
    id: string;
    src: Node;
    dst: Node;
  };

  interface IGraph<Node extends BaseNode, EdgeOpts extends BaseEdgeOpts> {
    connect(opts: EdgeOpts): { isNew: boolean; edge: Edge<Node, EdgeOpts> | null };
    disconnect(src: Node, dst: Node): boolean;
    removeNode(node: Node): boolean;
    removeNodeById(id: string): boolean;
    disconnectById(edgeid: string): boolean;
    disconnectByIds(srcid: string, dstid: string): boolean;
    reset(): void;
    hasNode(node: Node): boolean;
    isConnected(src: Node, dst: Node): boolean;
    getNodeById(nodeid: string): Node | null;

    plainJson(): GraphJson<Node, EdgeOpts>;
    plainFrom(json: GraphJson<Node, EdgeOpts>): this;
  }

  interface GraphJson<Node extends BaseNode, EdgeOpts extends BaseEdgeOpts> {
    nodes: Node[];
    edges: EdgeOpts[];
  }

  type BaseGraphJson = GraphJson<BaseNode, BaseEdgeOpts>;

  //#region RoomGraph

  interface RoomGraphNodeRoom {
    type: "room";
    /** `room-${roomId} */
    id: string;
    /** Index of `Geomorph.Layout['rooms']` */
    roomId: number;
  }
  interface RoomGraphNodeDoor {
    type: "door";
    /** `door-${doorIndex} */
    id: string;
    /** Index of `Geomorph.Layout['doors']` */
    doorId: number;
  }

  interface RoomGraphNodeWindow {
    type: "window";
    /** `window-${doorIndex} */
    id: string;
    /** Index of `Geomorph.Layout['windows']` */
    windowId: number;
  }

  type RoomGraphNode = RoomGraphNodeRoom | RoomGraphNodeDoor | RoomGraphNodeWindow;

  type RoomGraphNodeConnector = RoomGraphNodeDoor | RoomGraphNodeWindow;

  type RoomGraphEdgeOpts = BaseEdgeOpts;

  type RoomGraphJson = GraphJson<RoomGraphNode, RoomGraphEdgeOpts>;

  // 🚧
  type RoomGraph = import("./room-graph").roomGraphClass;

  //#endregion

  //#region GmGraph

  interface BaseGmGraphNode extends AStarNode {
    /** Index into nodesArray for easy computation of astar.neighbours */
    index: number;
  }

  /** A transformed geomorph */
  interface GmGraphNodeGm extends BaseGmGraphNode {
    type: "gm";
    /** Key of parent geomorph */
    gmKey: Geomorph.GeomorphKey;
    gmId: number;
    /** `gm-${gmKey}-[${transform}]` */
    id: string;
    /** Transform of parent geomorph */
    transform: [number, number, number, number, number, number];

    /** Points to `gm.navRects[navRectId]` */
    navRectId: number;
    /** `gm.navRects[navRectId].rect` in world coords */
    rect: Geom.Rect;
  }

  /** A hull door of some transformed geomorph */
  interface GmGraphNodeDoor extends BaseGmGraphNode {
    type: "door";
    /** `door-${gmKey}-[${transform}]-${hullDoorIndex}` */
    id: string;
    /** Key of parent geomorph */
    gmKey: Geomorph.GeomorphKey;
    /** Index of parent geomorph instance in its respective array */
    gmId: number;
    /** Transform of parent geomorph */
    transform: [number, number, number, number, number, number];
    /** Index of `Geomorph.GeomorphData['doors']` */
    doorId: number;
    /** Index of `Geomorph.GeomorphData['hullDoors']` */
    hullDoorId: number;
    /**
     * Is this door's parent geomorph in front of it?
     * That is, is the door's normal facing it's parent?
     */
    gmInFront: boolean;
    /** Direction it faces in world coords */
    direction: null | Geom.DirectionString;
    /**
     * Is this door node not connected to another door i.e.
     * not connected to another geomorph?
     */
    sealed: boolean;
  }

  type GmGraphNode = GmGraphNodeGm | GmGraphNodeDoor;

  type GmGraphEdgeOpts = BaseEdgeOpts;

  type GmGraph = import("./gm-graph").GmGraphClass;

  /** Given a hull door, the respective ids in adjacent geomorph */
  interface GmAdjRoomCtxt {
    adjGmId: number;
    adjRoomId: number;
    adjGmRoomKey: Geomorph.GmRoomKey;
    adjHullId: number;
    adjDoorId: number;
  }

  interface BaseNavGmTransition {
    srcGmId: number;
    srcRoomId: number;
    srcDoorId: number;
    dstGmId: number;
    dstRoomId: number;
    dstDoorId: number;
  }

  interface NavGmTransition extends BaseNavGmTransition {
    srcHullDoorId: number;
    /**
     * Entrypoint of the hull door from geomorph `srcGmId`,
     * in world coordinates.
     */
    srcDoorEntry: Geom.Vect;

    dstHullDoorId: number;
    /**
     * Entrypoint of the hull door from geomorph `dstGmId`,
     * in world coordinates.
     */
    dstDoorEntry: Geom.Vect;
  }

  /** Indexed by `gmId` */
  type GmRoomsAdjData = {
    [gmId: number]: {
      gmId: number;
      roomIds: number[];
      windowIds: number[];
      closedDoorIds: number[];
    };
  };

  //#endregion

  //#region GmRoomGraph

  interface GmRoomGraphNode extends AStarNode {
    /** `g{gmId}-r{roomId}` */
    id: Geomorph.GmRoomKey;
    gmId: number;
    roomId: number;

    /** Index into nodesArray for easy computation of astar.neighbours */
    index: number;
  }

  interface GmWindowId {
    gmId: number;
    windowId: number;
    // ℹ️ currently don't support hull windows
  }

  interface GmRoomGraphEdgeOpts extends BaseEdgeOpts {
    doors: Geomorph.GmDoorId[];
    windows: GmWindowId[];
  }

  // 🚧
  type GmRoomGraph = import("./gm-room-graph").gmRoomGraphClass;

  //#endregion

  //#region SymbolGraph

  interface SymbolGraphNode {
    id: Geomorph.SymbolKey;
  }
  
  interface SymbolGraphEdgeOpts extends BaseEdgeOpts {
    transform: Geom.SixTuple;
    meta: Meta;
  }

  type SymbolGraphJson = GraphJson<SymbolGraphNode, SymbolGraphEdgeOpts> & {
    /** e.g. `"20,20"` */
    size?: string;
    /** e.g. `"LR"` */
    rankdir?: string;
  };

  //#endregion

  interface AStarNode {
    astar: {
      centroid: Geom.Vect;
      // A* related
      f?: number;
      g?: number;
      h?: number;
      cost: number;
      visited: boolean;
      closed: boolean;
      parent: null | AStarNode;
      neighbours: number[];
    };
  }

}
