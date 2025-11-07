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
 * 🚧 use new approach to Feedback
 * Click to follow or stop following.
 * ```sh
 * demoFollowViaFeedback
 * ```
 * @param {NPC.RunArg} ct
 */
export async function demoFollowViaFeedback(ct) {
  const feedback = await core.connectFeedback(ct, { key: 'feedback-0' });
  const { w } = ct;

  /** @type {NPC.FeedbackUi} */
  const item = {
    key: 'demo-follow',
    label: '😃',
    inputs: [
      { type: 'select', key: 'npcKey', options: () => Object.keys(w.n).map(npcKey => ({ label: npcKey, value: npcKey })) },
      { type: 'button', key: 'follow' },
      { type: 'button', key: 'select' },
    ],
    onEvent(event, state) {
      console.log({event, state})
      if (event.type === 'click-button') {
        const npcKey = state.npcKey;
        switch (event.inputKey) {
          case 'follow':
            if (w.e.isFollowingNpc(npcKey)) w.e.stopFollowing();
            else w.e.followNpc(npcKey);
            break;
          case 'select':
            // 🚧
            break;
        }
      }
    },
  };

  feedback.addUi(item);
}

/**
 * 🚧 use new approach to Feedback
 * ```sh
 * demoSelectViaFeedback path:selected
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ npcKeyPath: string }} [opts]
 */
export async function demoSelectViaFeedback(ct, opts = ct.api.jsArg(ct.args, { path: 'npcKeyPath' })) {
  const feedback = await core.connectFeedback(ct, { key: 'feedback-0' });
  const { w } = ct;
  
  // 🔔 process must persist to use `ct` on resolve
  await new Promise((_resolve, reject) => {
    /** @type {NPC.FeedbackUi} */
    const item = {
      key: 'demo-select',
      label: 'select',
      inputs: [
        // ...
      ],
      onEvent(event, state) {
        // ...
        // const [prevNpcKey] = ct.api.get([opts.npcKeyPath]);
  
        // const nextNpcKey = value.npcKey;
        // ct.api.set(opts.npcKeyPath, nextNpcKey);
        // const nextNpc = w.npc.get(nextNpcKey);
        // nextNpc.showSelector(true);
  
        // if (prevNpcKey !== nextNpcKey) {
        //   w.n[prevNpcKey]?.showSelector(false);
        // }
  
        // w.view.ensureRender();
      },
    };
  
    feedback.addUi(item);

    ct.api.handleStatus({
      cleanups() {
        reject(ct.api.getKillError());
        feedback.removeUi(item.key);
      },
    })
  });

}

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
 * @param {NPC.RunArg} ct
 * @param {{ key?: string }} [opts]
 */
export async function demoFeedback(ct, opts = ct.api.jsArg(ct.args)) {
  const feedback = await core.connectFeedback(ct, { key: 'feedback-0' });
  
  feedback.addUi({
    key: opts.key ?? 'demo-feedback-0',
    label: 'Make a choice...',
    inputs: [
      // ...
    ],
    onEvent(event, state) {
      alert(`${event}: ${JSON.stringify(state)}`);
    },
  });
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
 * But repeated UI looks a bit crap.
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string; to: NPC.MoveOpts['to']; '...'?: true; }} [opts]
 */
export async function* demoHandleDirectViaTty(ct, opts = ct.api.jsArg(ct.args, { npc: 'npcKey' })) {
  const it = dev.direct(ct, opts);
  for await (const v of it) {
    yield* ct.api.choice('[ stop ]() [ pause ]() [ continue ]()', 'handleDirectChoice');
    const output = /** @type {typeof v['will']} */ (ct.home.handleDirectChoice);
    v.will = output; // send message back to `direct`
  }
}

const tmpMat1 = new Mat();

export const meta = {
  map: {
    demoClickToMove,
  },
};