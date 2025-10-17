import { deltaAngle } from "maath/misc";
import { Mat } from "@/npc-cli/geom";
import { jsStringify } from "@/npc-cli/service/generic";
import { helper } from "@/npc-cli/service/helper";
import { geom } from "@/npc-cli/service/geom";
import * as core from "./core";

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

/**
 * @param {NPC.RunArg} ct
 */
export const demoCameraWASD = ({ w }) => {
  w.view.keyDowns.changeAngle = async (e) => {
    const key = e.key.toLowerCase();

    const angle = geom.radRange(w.view.controls.getAzimuthalAngle());
    const delta = Math.PI * 0.5;
    const ratio = angle / delta; // [0..4)
    switch (key) {
      case "w": {
        await w.view.tween({
          azimuthal: Math.round(ratio) * delta,
          polar: Math.abs(deltaAngle(w.view.controls.getPolarAngle(), 0)) < 0.1 ? Math.PI/3 : 0,
        });
        break;
      }
      case "a": await w.view.tween({ azimuthal: Math.floor(ratio - 0.01) * delta }); break;
      case "s": await w.view.tween({ azimuthal: angle + Math.PI }); break;
      case "d": await w.view.tween({ azimuthal: Math.ceil(ratio + 0.01) * delta }); break;
    }
  };
};

/**
 * Bound to a particular npcKey.
 * ```sh
 * click meta.floor | demoClickToMove npc:rob
 * ```
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string }} [opts]
 */
export function demoClickToMove(input, { api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' })) {
  const npc = w.npc.get(opts.npcKey);
  // catch permits override and ignores points too far from nav
  npc.move({ to: input, close: 0.5 }).catch(() => {});
}

/**
 * Bound to a particular npcKey.
 * ```sh
 * demoNarrateToBed npc:rob
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string }} [opts]
 */
export async function *demoNarrateToBed(ct, opts = ct.api.jsArg(ct.args, { npc: 'npcKey' })) {
  const { w } = ct;
  
  function narrateEnterRoom() {
    const roomLabel = w.e.getNpcMeta(opts.npcKey)?.room?.label;
    core.narrate(ct, {
      words: roomLabel === 'stateroom' ? 'Oh look, a bed' : 'No bed here!'
      // words: `${opts.npcKey} was tired, ${roomLabel === 'stateroom' ? 'there ' : 'no'}`
    });
  }

  narrateEnterRoom();

  for await (const e of core.events(ct, {
    /** @returns {e is NPC.EnterDoorEvent | NPC.StoppedMovingEvent} */
    where: (e) => 'npcKey' in e && e.npcKey === opts.npcKey && (
      e.key === 'enter-door'
      || (e.key === 'stopped-moving' && e.reason.key === 'arrived')
    )
  })) {

    if (e.key === 'enter-door') {
      narrateEnterRoom();
      continue;
    }

    // stopped-moving
    const result = core.near(ct, { to: opts.npcKey,
      where(meta) { return meta.bed && meta.doPoint },
    });

    if (result.count > 0) {
      core.narrate(ct, { words: `${opts.npcKey} went over to the bed...` });
      // 🚧
      // ct.w.menu.log(...result.items.map(meta => `[goto bed] at ${jsStringify(meta.doPoint)} height ${meta.y}`))
    }

  }
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

const tmpMat1 = new Mat();

export const meta = {
  map: {
    demoClickToMove,
  },
};