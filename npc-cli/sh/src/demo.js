import { deltaAngle } from "maath/misc";
import { Mat } from "@/npc-cli/geom";
import { helper } from "@/npc-cli/service/helper";
import { geom } from "@/npc-cli/service/geom";
import * as core from "./core";
import * as dev from "./dev";

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

/**
 * Expose basic choices via TTY.
 * 🤔 Repeated UI looks a bit crap...
 * ```sh
 * import demoDirectViaTty from demo
 * demoDirectViaTty npc:rob to:$( clicks 3 )
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string; to: NPC.MoveOpts['to']; '...'?: true; }} [opts]
 */
export async function* demoDirectViaTty(ct, opts = ct.api.jsArg(ct.args, { npc: 'npcKey' })) {
  const it = dev.direct(ct, opts);
  for await (const v of it) {
    yield* ct.api.choice('[ stop ]() [ pause ]() [ continue ]()', 'handleDirectChoice');
    const output = /** @type {typeof v['will']} */ (ct.home.handleDirectChoice);
    v.will = output; // send message back to `direct`
  }
}

/**
 * 🚧
 * Expose basic choices via UI.
 * ```sh
 * import demo
 * demoDirectViaUi npc:rob to:$( clicks 3 )
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ uiKey?: string; npcKey: string; to: NPC.MoveOpts['to']; '...'?: true; }} [opts]
 */
export async function* demoDirectViaUi(ct, opts = ct.api.jsArg(ct.args, { ui: 'uiKey', npc: 'npcKey' })) {
  const feedback = await core.connectFeedback(ct);
  const it = dev.direct(ct, opts);
  
  for await (const v of it) {
    const uiKey = opts.uiKey ?? `${opts.npcKey}?`;
    const bubble = await ct.w.bubble.ensure(opts.npcKey);

    feedback.add({
      key: uiKey,
      title: `${opts.npcKey}?`,
      portalParent: bubble.uiRootEl,
      input: {
        stop: { type: 'button', key: 'stop' },
        continue: { type: 'button', key: 'continue' },
        pause: { type: 'button', key: 'pause' },
      },
    });

    // wait until a button pressed
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const unSub = feedback.ui.subscribe(({ lookup }) => lookup[uiKey], (ui) => {
        if (ui && (ui.lastButton === 'stop' || ui.lastButton === 'continue' || ui.lastButton === 'pause')) {
          v.will = ui.lastButton;
          // after "pause" pressing "continue" should resume
          if (ui.lastButton === 'continue') ct.api.resume();
          resolve();
        }
      });

      ct.api.handleStatus({
        cleanups() {
          unSub();
          reject(ct.api.getKillError());
          feedback.remove(uiKey);
        },
      });
    }));

  }
}

/**
 * ```sh
 * demoUi
 * demoUi ui:base
 * demoUi npc:rob
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ uiKey?: string; npcKey?: string }} [opts]
 */
export async function demoUi(ct, opts = ct.api.jsArg(ct.args, { ui: 'key', npc: 'npcKey' })) {
  const feedback = await core.connectFeedback(ct, { key: 'feedback-0' });
  const uiKey = opts?.uiKey ?? 'demo-0';
  const { npcKey } = opts;
  
  await new Promise((_resolve, reject) => {

    feedback.add({
      key: uiKey,
      title: 'Make a choice...',
      portalParent: npcKey ? ct.w.bubble.byKey[npcKey].uiRootEl : undefined,
      input: {
        choice: { type: 'select', key: 'choice', options: [{ label: 'foo', value: 'foo' }, { label: 'bar', value: 'bar' }] }
      },
    });

    const unsub = feedback.ui.subscribe(({ lookup }) => lookup[uiKey], (ui, prev) => {
      if (!prev || !ui) return; // first or last
      alert(ui.input.choice.value);
    });

    ct.api.handleStatus({
      cleanups() {
        reject(ct.api.getKillError());
        unsub();
        feedback.remove(uiKey);
      },
    })
  });

}

const tmpMat1 = new Mat();

export const meta = {
  map: {
    demoClickToMove,
  },
};