import { Mat } from "@/npc-cli/geom";
import { helper } from "@/npc-cli/service/helper";

/**
 * Bound to a particular npcKey.
 * ```sh
 * click meta.floor | map demo_1 simpleClickToMove npcKey:rob
 * ```
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string }} [opts]
 */
export function simpleClickToMove(input, { api, args, w }, opts = api.jsArg(args)) {
  const npc = w.npc.getNpc(opts.npcKey);
  npc.s.run = input.keys?.includes("shift") ?? false;
  // catch so can override move, also ignores points too far from nav
  npc.api.move({ to: input, close: 0.5 }).catch(() => {});
}

/**
 * - Make a single hard-coded polygon non-navigable,
 *   using `w.lib.queryFilterType.respectUnwalkable`
 * - Indicate it via debug polygon in `<Debug />`.
 * 
 * ```sh
 * demoSelectPolys
 * ```
 * @param {NPC.RunArg} ct
 */
export async function* demoSelectPolys({ w }) {
  const { polyRefs } = w.crowd.navMeshQuery.queryPolygons(
    { x: 1.5 * 1.5, y: 0, z: 2 * 1.5 },
    { x: 0.1, y: 0.1, z: 0.1 },
    { maxPolys: 1 },
  );
  console.log({ polyRefs });

  const { navPolyFlag } = helper;
  polyRefs.forEach(polyRef => w.nav.navMesh.setPolyFlags(polyRef, navPolyFlag.unWalkable));
  w.debug.selectNavPolys(...polyRefs); // display via debug
}

/**
 * @param {NPC.RunArg} ct
 */
export const demoAddDecor = (ct) => {
  const decorCircle = ct.w.decor.create({
    type: 'circle',
    key: 'test-decor-circle',
    center: { x: 2.5, y: 2.5 },
    radius: 1.5,
  });
  
  const decorPoint = ct.w.decor.create({
    type: 'point',
    key: 'test-decor-point',
    x: 3,
    y: 7.5,
    img: 'icon--robot',
    orient: 0,
    y3d: 0.01,
  });

  const decorQuad = ct.w.decor.create({
    type: 'quad',
    key: 'test-decor-quad',
    x: 3,
    y: 7.5,
    width: 2,
    height: 0.025,
    img: 'colour--white',
    transform: tmpMat1.setRotation(Math.PI/4).toArray(),
    y3d: 0.1,
    color: '#f00',
  });

  return {
    decorCircle,
    decorPoint,
    decorQuad,
  };
};

const tmpMat1 = new Mat();

export const meta = {
  map: {
    simpleClickToMove,
  },
};