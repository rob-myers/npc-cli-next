import { Mat, Vect } from "@/npc-cli/geom";
import { helper } from "@/npc-cli/service/helper";
import { geom } from '@/npc-cli/service/geom';
import { ansi } from "../const";
import * as core from "./core";

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
 * direct npc:rob to:$( clicks 2 )
 * 
 * while true; do
 *   direct npc:rob to:$( clicks 2 ) ...
 * done
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string; to: NPC.MoveOpts['to']; '...'?: true; }} [opts]
 */
export async function* direct(ct, opts = ct.api.jsArg(ct.args, { npc: 'npcKey' }, { array: { to: true } })) {
  let to = opts.to;
  while (true) {
    try {
      const arriveAnim = opts['...'] === true ? false : undefined;
      await core.move(ct, { npcKey: opts.npcKey, to, arriveAnim });
      break;
    } catch (e) {
      if (!helper.isStopReason(e) || !('rest' in e)) {
        throw e; // e.g. reboot, respawn, remove
      }
      to = e.rest;

      // caller can optionally continue/stop, rather than pause
      const msg = { npcKey: opts.npcKey, reason: e.key,
        will: /** @type {'pause' | 'continue' | 'stop'} */ ('pause'),
      };
      yield msg;

      switch (msg.will) {
        case 'stop': return;
        case 'continue': continue;
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
 * ```sh
 * click --long | lookOrDoOnClick read:base.npcKey
 * ```
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {string} opts.readKey
 */
export async function lookOrDoOnClick(input, ct, opts = ct.api.jsArg(ct.args, { read: 'readKey' })) {
  await lookOrDoTracked(ct, { ...opts, to: input });
}

/**
 * ```sh
 * lookOrDoTracked to:$( click 1 ) read:base.npcKey
 * ```
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {MaybeMeta<NPC.GroundPoint>} opts.to
 * @param {string} opts.readKey
 */
export async function lookOrDoTracked(ct, opts = ct.api.jsArg(ct.args, { read: 'readKey' })) {
  const [uiKey, inputKey] = opts.readKey.split('.');
  const { ui } = await core.connectFeedbackUi(ct, { uiKey, inputKeys: [inputKey] });

  const npcKey = /** @type {string} */ (ui.input[inputKey].value);
  const npc = ct.w.npc.get(npcKey);
  
  if (opts.to.meta?.floor === true && !npc.doMeta) {
    npc.look(opts.to).catch(() => {});
  } else {// do or stop doing
    await npc.make({ do: opts.to }).catch(() => {});
  }
}

/**
 * ```sh
 * moveTrackedNpc to:$( click 1 ) read:base.npcKey
 * ```
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {NPC.MoveOpts['to']} opts.to
 * @param {string} opts.readKey Where the selected npc key is read from
 * @param {number} [opts.maxDistance] Max distance from navigable permitted
 * @param {string[]} [opts.keys] clarify 🚧
 */
export async function moveTrackedNpc(ct, opts = ct.api.jsArg(ct.args, { read: 'readKey' })) {
  const [uiKey, inputKey] = opts.readKey.split('.');
  const { ui } = await core.connectFeedbackUi(ct, { uiKey, inputKeys: [inputKey] });

  const npcKey = /** @type {string} */ (ui.input[inputKey].value);
  const npc = ct.w.n[npcKey];
  if (!npc) return;
  npc.run = opts.keys?.includes("shift") ?? false;
  npc.move({ to: opts.to, close: opts.maxDistance ?? 0.5 }).catch(() => {});
}

/**
 * ```sh
 * click | moveNpcOnClick read:base.npcKey
 * ```
 * @param {MaybeMeta<NPC.GroundPoint> & { keys?: string[] }} input
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {string} opts.readKey
 * @param {number} [opts.maxDistance] Max distance from navigable permitted
 */
export function moveNpcOnClick(input, ct, opts = ct.api.jsArg(ct.args, { read: 'readKey' })) {
  moveTrackedNpc(ct, { ...opts, to: input, keys: input.keys });
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
 * Select specific npc, keeping track via `opts.writeKey`.
 * ```sh
 * selectTrackedNpc npc:rob write:base.npcKey
 * ```
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {string} opts.npcKey
 * @param {`${string}.${string}`} opts.writeKey Where we store the selected npc key
 */
export async function selectTrackedNpc(ct, opts = ct.api.jsArg(ct.args, { npc: 'npcKey', write: 'writeKey' })) {
  const [uiKey, inputKey] = opts.writeKey.split('.');
  const { feedback, ui } = await core.connectFeedbackUi(ct, { uiKey, inputKeys: [inputKey] });
  
  feedback.ui.setState(draft => { draft.lookup[uiKey].input[inputKey].value = opts.npcKey; });

  const nextNpc = ct.w.npc.get(opts.npcKey);
  nextNpc.showSelector(true);
  
  const prevNpcKey = /** @type {string} */ (ui.input[inputKey].value);
  if (prevNpcKey !== opts.npcKey) {
    const prevNpc = ct.w.n[prevNpcKey];
    prevNpc?.showSelector(false);
  }
  
  ct.w.view.ensureRender();
}

/**
 * ```sh
 * click | selectNpcOnClick write:base.npcKey
 * ```
 * @param {NPC.ClickOutput} input
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {`${string}.${string}`} opts.writeKey
 */
export function selectNpcOnClick(input, ct, opts = ct.api.jsArg(ct.args, { write: 'writeKey' })) {
  selectTrackedNpc(ct, { npcKey: /** @type {string} */ (input.meta.npcKey), ...opts });
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

    if (other.target === null) {
      return;
    }

    if (nei.dist <= (other.run === true ? 0.8 : 0.6)) {
      // turn towards "closest neighbour" if they have a target
      npc.lookAngleDst = geom.clockwiseFromNorth(
        other.point.y - npc.point.y,
        other.point.x - npc.point.x
      );
    } else {
      npc.lookAngleDst = null;
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
 * tour npc:rob to:"$( click 3 )"
 * tour npc:rob to:"[$( click 3 )]"
 * tour npc:rob to:"$( clicks 2 ) $( clicks 2 )"
 * 
 * points=$( click 4 )
 * tour npc:rob to:"$( points )"
 * tour npc:rob to:"[$( points )]"
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

/**
 * Follow/unfollow and select/unselect
 * ```sh
 * uiFollowSelect key:base
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ uiKey?: string; }} [opts]
 */
export async function uiFollowSelect(ct, opts = ct.api.jsArg(ct.args, { key: 'uiKey' })) {
  const feedback = await core.connectFeedback(ct, { key: 'feedback-0' });
  const { w } = ct;

  await new Promise((_resolve, reject) => {
    const uiKey = opts.uiKey ?? 'follow-select-ui';

    feedback.add({
      key: uiKey,
      icon: '@',
      label: 'npc follow/select',
      input: {
        // 🚧 update select on spawn/remove
        npcKey: { type: 'select', key: 'npcKey', options: Object.keys(w.n).map(npcKey => ({ label: npcKey, value: npcKey })) },
        follow: { type: 'checkbox', key: 'follow' },
        select: { type: 'checkbox', key: 'select' },
        refresh: { type: 'button', key: 'refresh' },
      },
    });

    const unsub = feedback.ui.subscribe(({ lookup }) => lookup[uiKey], (ui, prevUi) => {
      if (!prevUi || !ui) return; // first or last
      const changed = Object.values(ui.input).filter((input) => input !== prevUi.input[input.key]);
      
      if (changed.length === 0) return;

      // 🚧 other processes should use this npcKey e.g. for move
      const npcKey = /** @type {string} */ (ui.input.npcKey.value);
      const follow = /** @type {boolean} */ (ui.input.follow.value);
      const select = /** @type {boolean} */ (ui.input.select.value);

      // changing select, the two toggles, or pressing refresh have same effect,
      // i.e. determined by { npcKey, follow, select }

      if (follow === true) w.e.followNpc(npcKey);
      else w.e.stopFollowing();

      if (select === true) {
        const prevNpcKey = /** @type {string} */ (prevUi.input.npcKey.value);
        w.n[prevNpcKey]?.showSelector(false);
        w.n[npcKey]?.showSelector(true);
      } else {
        w.n[npcKey]?.showSelector(false);
      }

      w.view.ensureRender();
    });

    ct.api.handleStatus({
      cleanups() {
        reject(ct.api.getKillError());
        unsub();
        feedback.removeUi(uiKey); // always remove?
      },
    });
  });
}

const tmpVect1 = new Vect();
const tmpMat1 = new Mat();

export const meta = {
  map: {
    handleContextMenu,
    handleLoggerLinks,
    lookOrDoOnClick,
    moveNpcOnClick,
    selectNpcOnClick,
    toggleOnDoor,
    tour,
  },
};