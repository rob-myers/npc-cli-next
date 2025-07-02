import { deltaAngle } from "maath/misc";
import { geom } from '@/npc-cli/service/geom';
import { helper } from "@/npc-cli/service/helper";
import { ansi } from "../const";
import { pause } from "./util";
import { move } from "./game";

/**
 * @param {NPC.RunArg} ct
 */
export const changeAngleOnKeyDown = ({ w }) => {
  w.view.keyDowns.changeAngle = async (e) => {
    const key = e.key.toLowerCase();

    // if (key === 'w') {
    //   return await w.view.tween({
    //     polar: Math.abs(deltaAngle(w.view.controls.getPolarAngle(), 0)) < 0.1 ? Math.PI/4 : 0
    //   });
    // }
    
    const angle = geom.radRange(w.view.controls.getAzimuthalAngle());
    const delta = Math.PI * 0.5;
    const ratio = angle / delta; // [0..4)
    switch (key) {
      case "w": {
        await w.view.tween({
          azimuthal: Math.round(ratio) * delta,
          polar: Math.abs(deltaAngle(w.view.controls.getPolarAngle(), 0)) < 0.1 ? Math.PI/4 : 0,
        });
        break;
      }
      case "a": await w.view.tween({ azimuthal: Math.ceil(ratio + 0.01) * delta }); break;
      case "s": await w.view.tween({ azimuthal: angle + Math.PI }); break;
      case "d": await w.view.tween({ azimuthal: Math.floor(ratio - 0.01) * delta }); break;
    }
  };
};

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
    y3d: 0.1,
  });

  const decorQuad = ct.w.decor.create({
    type: 'quad',
    key: 'test-decor-quad',
    x: 3,
    y: 7.5,
    width: 2,
    height: 0.1,
    img: 'colour--blue',
    // 🚧
    // transform: tmpMat1.setRotationAbout(Math.PI/4, ),
    y3d: 0.1,
  });

  return {
    decorCircle,
    decorPoint,
    decorQuad,
  };
};

/**
 * ```sh
 * events | handleContextMenu
 * ```
 * @param {NPC.RunArg<NPC.Event>} ct
 */
export async function* handleContextMenu({ api, w, datum: e }) {
  while ((e = await api.read()) !== api.eof) {
    if (e.key !== "contextmenu-link") {
      continue;
    }

    const { meta } = w.cm;
    // 🚧 support contextual npc e.g. open/unlock
    const npcKey = /** @type {undefined | string} */ (undefined);

    switch (e.linkKey) {
      case "look":
        if (typeof meta.npcKey === "string") {
          w.e.lookAt(meta.npcKey).catch(() => {});
        } else {
          w.e.lookAt(w.cm.position, { height: w.cm.position.y }).catch(() => {});
        }
        w.cm.update(); // Might have stopped follow
        break;
      case "follow":
        if (typeof meta.npcKey === "string") {
          if (w.e.isFollowingNpc(meta.npcKey)) {
            w.view.stopFollowing();
          } else {
            w.e.followNpc(meta.npcKey);
          }
          w.cm.update();
        }
        break;
      case "open":
      case "close":
        w.e.toggleDoor(meta.gdKey, {
          npcKey,
          [e.linkKey]: true,
          access: npcKey === undefined || (meta.inner === true && meta.secure !== true)
            ? true
            : w.e.npcCanAccess(npcKey, meta.gdKey),
        });
        break;
      case "lock":
      case "unlock":
        w.e.toggleLock(meta.gdKey, {
          npcKey: undefined,
          [e.linkKey]: true,
          access: npcKey === undefined
            ? true
            : w.e.npcCanAccess(npcKey, meta.gdKey),
          // point,
        });
        break;
    }
  }
}

/**
 * For example,
 * ```sh
 * events | handleLoggerLinks
 * ```
 * @param {NPC.RunArg<NPC.Event>} ct
 */
export async function* handleLoggerLinks({ api, datum: e, w }) {
  while ((e = await api.read()) !== api.eof) {
    if (e.key !== "logger-link") {
      continue;
    }
    
    // 🚧
    // if (e.viewportRange.start.x - 1 === 0 && e.viewportRange.start.y - 1 === e.startRow) {
    //   // clicked initial link
    // }
    if (e.linkText === e.npcKey) {
      w.e.lookAt(e.npcKey).catch(() => {});
    }

  }
}

/**
 * - Make a single hard-coded polygon non-navigable,
 *   using `w.lib.queryFilterType.respectUnwalkable`
 * - Indicate it via debug polygon in `<Debug />`.
 * 
 * ```sh
 * selectPolysDemo
 * ```
 * @param {NPC.RunArg} ct
 */
export async function* selectPolysDemo({ w }) {
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
* 🔔 "export const" uses `call` rather than `map`
* @param {NPC.RunArg} ct
*/
export const setupContextMenu = ({ w }) => {

  w.cm.match.door = ({ meta }) => {
    const showLinks = /** @type {NPC.ContextMenuLink[]} */ ([]);

    showLinks.push({ key: "look", label: "look" });

    if (typeof meta.switch === "number") {
      showLinks.push(
        { key: "open", label: "open" },
        { key: "close", label: "close" },
        { key: "lock", label: "lock" },
        { key: "unlock", label: "unlock" },
        // 🚧 ring bell
      );
    }

    if (meta.door === true) {
      showLinks.push(
        { key: "open", label: "open" },
        { key: "close", label: "close" },
        { key: "lock", label: "lock" },
        { key: "unlock", label: "unlock" },
        // 🚧 knock
      );
    }

    if (typeof meta.npcKey === "string") {
      showLinks.push({
        key: "follow",
        label: "follow",
        selected() {
          return w.e.isFollowingNpc(meta.npcKey);
        },
      });
    }

    return { showLinks };
  };

  w.cm.toggleDocked(true);
}

// /**
//  * @param {NPC.RunArg} ct
//  */
// export const setupOnStuckNpc = ({ w, args }) => {
//   w.npc.onStuckCustom = (npc, agent) => {
//     // console.warn(`${npc.key}: going slow`);
//     npc.api.stopMoving({ type: 'stop-reason', key: 'stuck' });
//   };
// }

/**
 * @param {NPC.RunArg} ct
 */
export const setupOnTickIdleTurn = ({ w, args }) => {
  w.npc.onTickIdleTurn = (npc, agent) => {

    if (agent.raw.nneis === 0) {
      return;
    }
    // if (agent.raw.desiredSpeed < 0.5) {
    //   return;
    // }

    // 0th is closest
    const nei = agent.raw.get_neis(0);
    const other = w.a[nei.idx];

    if (other.s.target === null) {
      return;
    }

    if (nei.dist <= (other.s.run === true ? 0.8 : 0.6)) {
      // turn towards "closest neighbour" if they have a target
      npc.s.lookAngleDst = npc.api.getEulerAngle(
        geom.clockwiseFromNorth((
          other.position.z - npc.position.z),
          (other.position.x - npc.position.x)
        )
      );
    } else {
      npc.s.lookAngleDst = null;
    }

  };
}

/**
 * 
 * ```sh
 * tour npcKey:rob to:"$( click 5 )"
 * tour npcKey:rob to:"$( click 5 | sponge )"
 * tour npcKey:rob to:"$( points )"
 * 
 * tour npcKey:rob to:"$( array $( points ) )"
 * nestedPoints=$( array $( click 1 ) $( click 2 ) $( click 1 ) )
 * tour npcKey:rob to:$( nestedPoints )
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string; to: NPC.MoveOpts['to'][]; pauseMs?: number }} [opts]
 */
export async function* tour(ct, opts = ct.api.jsArg(ct.args, { to: 'array' })) {
  let to = /** @type {undefined | NPC.MoveOpts['to']} */ (undefined);
  while (to = opts.to.shift()) {
    try {
      await move(ct, { npcKey: opts.npcKey, to, s: { arriveDist: 0.1 } });
    } catch (e) {
      if (!helper.isStopReason(e)) {
        throw e; // e.g. reboot
      }
      if ('remainingPath' in e) {
        opts.to.unshift(e.remainingPath);
      } else {
        throw e; // respawn or remove
      }
      // on paused interrupt, avoid resuming twice
      if (!(e.key === 'move-again' && ct.api.isPaused())) {
        yield `[ ${ansi.Cyan}${opts.npcKey}${ansi.Reset} ] awaiting GM resolution...`;
      }
      await pause(ct);
      continue;
    }
    await ct.api.sleep(opts.pauseMs ?? 0.8);
  }
}
