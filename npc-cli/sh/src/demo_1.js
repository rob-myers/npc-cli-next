import { Mat } from "@/npc-cli/geom";

/**
 * Bound to a particular npcKey.
 * ```sh
 * click meta.floor | map game_demo_1 simpleClickToMove npcKey:rob
 * ```
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string }} [opts]
 */
export function simpleClickToMove(input, { api, args, w }, opts = api.jsArg(args)) {
  const npc = w.npc.getNpc(opts.npcKey);
  npc.s.run = input.keys?.includes("shift") ?? false;
  // we catch so can override move,
  // which also ignores points too far from nav
  npc.api.move({ to: input, close: 0.5 }).catch(() => {});
}

/**
 * @param {NPC.RunArg} ct
 */
export const testAddDecor = (ct) => {
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
