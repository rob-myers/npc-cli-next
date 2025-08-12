import { Mat, Vect } from "@/npc-cli/geom";
import { helper } from "@/npc-cli/service/helper";
import { geom } from '@/npc-cli/service/geom';
import { ansi } from "../const";
import { move } from "./core";

/**
 * @param {NPC.RunArg} ct
 * @param {{
 *   from: NPC.GroundPoint;
 *   to: NPC.GroundPoint;
 *   color?: string;
 *   decorKey?: string;
 *   y?: number;
 * }} [opts]
 */
export const createDecorLine = (ct, opts = ct.api.jsArg(ct.args)) => {
  const from = helper.toXZ(opts.from);
  const to = helper.toXZ(opts.to);
  const delta = tmpVect1.copy(to).sub(from);
  
  ct.w.decor.create({
    type: 'quad',
    key: opts.decorKey ?? `line-${from.x},${from.y},${to.x},${to.y}`,
    x: from.x,
    y: from.y,
    width: delta.length,
    height: 0.025, // line thickness
    img: 'colour--white',
    transform: tmpMat1.setRotation(delta.angle).toArray(),
    y3d: opts.y ?? 0.1,
    color: opts.color ?? '#aaf', // default light blue
  });
}

/**
 * Creates floor icon for numbers 0 ... 10, afterwards we use an empty circle.
 * @param {NPC.RunArg} ct
 * @param {{
 *   at: NPC.GroundPoint;
 *   number: number;
 *   decorKey?: string;
 *   meta?: Meta;
 *   y?: number;
 * }} [opts]
 */
export const createDecorNumber = (ct, opts = ct.api.jsArg(ct.args)) => {
  const at = helper.toXZ(opts.at);
  const number = opts.number;
  const decorKey = opts.decorKey ?? `#${number}-${at.x},${at.y}`;
  
  /** @type {Key.DecorImg} */
  const img = Number.isInteger(number) && number >= 0 && number <= 10
    ? `icon--#${/** @type {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10} */ (number)}`
    : 'icon--white-circle'
  ;

  ct.w.decor.create({
    type: 'point',
    key: decorKey,
    x: at.x,
    y: at.y,
    img,
    meta: opts.meta,
    y3d: (opts.y ?? 0) + 0.001, // below npc selector
  });
}

/**
 * Like `move` but on obstruction await resolution, rather than throwing.
 * ```sh
 * direct npc:rob to:"$( click 2 )"
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string; to: NPC.MoveOpts['to']; }} [opts]
 */
export async function* direct(ct, opts = ct.api.jsArg(ct.args, { npc: 'npcKey' })) {
  let to = opts.to;
  while (true) {
    try {
      await move(ct, { npcKey: opts.npcKey, to, s: { arriveDist: 0.1 } });
      break;
    } catch (e) {
      if (!helper.isStopReason(e) || !('rest' in e)) {
        throw e; // e.g. reboot; respawn or remove
      }
      to = e.rest;
      // on paused interrupt, avoid resuming twice
      if (!(e.key === 'move-again' && ct.api.isPaused())) {
        yield `${ansi.Cyan}${opts.npcKey}${ansi.Reset}: awaiting resolution...`;
      }
      ct.api.pause();
      await ct.api.awaitResume();
    }
  }
}

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
    if (e.linkText === e.npcKey) {
      w.e.lookAt(e.npcKey).catch(() => {});
    }
  }
}

/**
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {string} opts.npcKeyPath Where we store the selected npc key
 */
export async function lookActOnLong(input, {api, args, w}, opts = api.jsArg(args, { path: 'npcKeyPath' })) {
  const [npcKey] = api.get([opts.npcKeyPath]);
  const npc = w.n[npcKey];
  if (!npc) return;
  if (input.meta.floor === true && !npc.s.doMeta) {
    npc.api.look(input).catch(() => {});
  } else {// act or stop acting
    await npc.api.make({ do: input }).catch(() => {});
  }
}

/**
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {string} opts.npcKeyPath Where we store the selected npc key
 * @param {number} [opts.close] Max distance from navigable permitted
 */
export function moveNpcOnClick(input, { api, args, w }, opts = api.jsArg(args, { path: 'npcKeyPath' })) {
  const [npcKey] = api.get([opts.npcKeyPath]);
  const npc = w.n[npcKey];
  if (npc) {
    npc.s.run = input.keys?.includes("shift") ?? false;
    npc.api.move({ to: input, close: opts.close ?? 0.5 }).catch(() => {}); // can override
  }
}

/**
 * Prevent ContextMenu on long press of actable or floor.
 * @param {NPC.RunArg} ct
 */
export const preventMenuOnActOrFloor = ({ api, args, w }, opts = api.jsArg(args)) => {
  w.e.pressMenuPrevent.preventMenuOnActOrFloor = (meta) => (
    meta.do === true || meta.floor === true
  );
}

/**
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ctxt
 * @param {object} [opts]
 * @param {string} opts.npcKeyPath Where we store the selected npc key
 */
export function selectNpcOnClick(input, { api, args, w }, opts = api.jsArg(args, { path: 'npcKeyPath' })) {
  const [npcKey] = api.get([opts.npcKeyPath]);
  
  const nextNpcKey = /** @type {string} */ (input.meta.npcKey); // assume
  api.set(opts.npcKeyPath, nextNpcKey);
  const nextNpc = w.npc.getNpc(nextNpcKey); // must
  nextNpc.api.showSelector(true);
  
  if (npcKey !== nextNpcKey) {
    w.n[npcKey]?.api.showSelector(false); // maybe
  }
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
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ctxt
 */
export function toggleOnDoor({ meta }, { w }) {
  if (meta.gdKey) w.e.toggleDoor(meta.gdKey);
}

/**
 * 
 * ```sh
 * tour npc:rob to:"$( click 5 )"
 * tour npc:rob to:"$( click 5 | sponge )"
 * tour npc:rob to:"$( points )"
 * 
 * tour npc:rob to:"$( [] $( points ) )"
 * nestedPoints=$( [] $( click 1 ) $( click 2 ) $( click 1 ) )
 * tour npc:rob to:$( nestedPoints )
 * ```
 * 
 * - `opts.pause` in seconds, default `0.8`
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string; to: NPC.MoveOpts['to'][]; pause?: number }} [opts]
 */
export async function* tour(ct, opts = ct.api.jsArg(ct.args, { npc: 'npcKey' }, { array: { to: true } })) {
  opts.pause ??= 0.8;
  for (const to of opts.to) {
    yield* direct(ct, { npcKey: opts.npcKey, to });
    await ct.api.sleep(opts.pause);
  }
}

const tmpVect1 = new Vect();
const tmpMat1 = new Mat();

export const meta = {
  map: {
    handleContextMenu,
    handleLoggerLinks,
    lookActOnLong,
    moveNpcOnClick,
    selectNpcOnClick,
    toggleOnDoor,
    tour,
  },
};