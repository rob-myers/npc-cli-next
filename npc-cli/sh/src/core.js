import { isStringInt, removeFirst } from '@/npc-cli/service/generic';
import { helper } from '@/npc-cli/service/helper';
import * as util from './util';
import { createDecorNumber } from './dev';

/**
 * @param {NPC.RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY }, tabs }) {
  if (typeof WORLD_KEY !== 'string') {
    throw Error(`WORLD_KEY not a string`);
  }

  yield `${api.ansi.Cyan}awaiting ${api.ansi.White}${WORLD_KEY}`;

  while (api.getCached(WORLD_KEY)?.isReady(api.meta.sessionKey) !== true) {
    await api.sleep(0.05);
  }

  tabs.updateTabMeta({
    key: /** @type {Key.TabId} */ (api.meta.sessionKey),
    ttyWorldKey: /** @type {Key.TabId} */ (WORLD_KEY),
  });
}

/**
 * ```sh
 * # unbounded unblocking left clicks
 * click
 * # exactly 1 blocking click
 * click 1
 * # unbounded unblocking right clicks
 * click --right
 * # unbounded unblocking left/right clicks
 * click --any
 * # exactly 5 blocking clicks with truthy meta.nav
 * click 5 '({ meta }) => meta.nav'
 * # ditto
 * click 5 meta.nav
 * # unbounded unblocking clicks with truthy meta.nav
 * click meta.nav
 * # exactly 2 blocking clicks with truthy meta.nav
 * click meta.nav 2
 * # exactly 3 blocking red clicks
 * click --red 3
 * # exactly 3 blocking red clicks preserving previous red
 * click --red --keep 3
 * # clear all click labels
 * click --clear
 * # root 2D instead of 3D
 * click -2
 * ```
 * 
 * - Shows number of clicks in decor
 * @param {NPC.RunArg} ct
 */
export async function* click(ct) {
  const { args, api, w } = ct;
  let { opts, operands } = ct.api.getOpts(args, {
    boolean: [
      "left",  // left clicks only
      "right", // right clicks only
      "long",  // long press only
      "any",   // left or right permitted
      "block", // e.g. `click --block`
      "clear", // clear all colours
      "keep",  // keep clicks of current color
      // --red, --blue, --green (default black)
    ],
  });

  if (opts["right"] === false && opts["any"] === false)  {
    opts.left = true; // default to left clicks only
  }
  if (!isStringInt(operands[0]) && isStringInt(operands[1])) {
    operands = [operands[1], operands[0]]; // support reverse order `click meta.nav 2`
  }
  // must support `click -2`
  // if (isStringInt(args[0]) && Number(args[0]) < 0) {
  //   return; // check arg: -1 an opt not an operand
  // }

  /** Number of clicks remaining */
  let numClicks = isStringInt(operands[0]) ? parseInt(operands[0]) : Number.MAX_SAFE_INTEGER;
  const totalClicks = numClicks;
  const clickId = isStringInt(operands[0]) || opts.block === true ? api.getUid() : undefined;
  const blocking = clickId !== undefined;

  const colors = { red: '#c00', green: '#0c0', blue: '#00c',  black: '#999' };
  const color = opts.red === true ? colors.red : opts.blue === true ? colors.blue : opts.green === true ? colors.green : colors.black;
  const clickGroup = `click-${color}`;
  const decorOffset = opts.keep === true ? w.decor.group[clickGroup]?.length ?? 0 : 0;

  if (opts.clear === true) {// clear labels of all colours
    Object.values(colors).forEach(color => w.decor.removeGroup(`click-${color}`));
    if (operands.length === 0) {
      return; // `click --clear` does not send clicks
    }
  }

  // support `click meta.nav`
  // support `click '({ meta }, ct) => meta.nav && ct.home.myTest'`
  const filterDef = isStringInt(operands[0]) ? operands[1] : operands[0];
  const filter = filterDef !== undefined
    ? api.generateSelector(api.parseFnOrStr(filterDef), [ct])
    : undefined
  ;

  /** @type {import('@/npc-cli/service/broadcaster').BasicSubscription} */
  let eventsSub;

  // suspend/resume handled by `api.isRunning()` below
  const handlers = api.handleStatus({
    cleanups() {
      blocking === true && removeFirst(w.view.clickIds, clickId);
      eventsSub?.unsubscribe();
    },
  });

  try {
    while (numClicks > 0) {
      blocking === true && w.view.clickIds.push(clickId);
      
      const e = await /** @type {Promise<NPC.PointerUpEvent>} */ (new Promise((resolve, reject) => {
        eventsSub = w.events.subscribe({ next(e) {
          if (e.key !== "pointerup" || e.pointers > 1 || w.view.isPointerEventDrag(e) === true) {
            return;
          } else if (api.isRunning() === false) {
            return;
          } else if (e.clickId !== undefined && clickId === undefined) {
            return; // `click {n}` overrides `click`
          } else if (e.clickId !== undefined && clickId !== e.clickId) {
            return; // later `click {n}` overrides earlier `click {n}`
          }
          resolve(e); // Must resolve before tear-down induced by unsubscribe 
          eventsSub.unsubscribe();
        }});
        eventsSub.add(() => reject(api.getKillError()));
      }));
  
      if (
        (opts.left === true && e.rmb === true)
        || (opts.right === true && e.rmb === false)
        || (opts.long !== e.justLongDown)
      ) {
        continue;
      }
  
      /** @type {NPC.ClickOutput} */
      const output = {
        // 🔔 root can be 2D or 3D
        ...opts['2'] === true ? e.point : e.position,
        ...e.keys && { keys: e.keys },
        meta: {
          ...e.meta,
          // nav false <=> on floor outside navmesh, e.g. npc meta.nav is undefined
          ...e.meta.floor === true && { nav: w.npc.isPointInNavmesh(e.point) },
          // longClick: e.justLongDown,
        },
      };

      if (filter === undefined || filter?.(output)) {
        if (numClicks === totalClicks && opts.keep !== true && blocking === true) {
          w.decor.removeGroup(clickGroup); // clear current color
        }

        numClicks--;
        yield output;

        if (blocking === true) {
          const number = totalClicks - numClicks; // 1 2 ...
          const decorKey = `${clickGroup}-#${number}-${clickId}`;
          // meta.floor induces meta.nav
          createDecorNumber(ct, {
            decorKey,
            at: output,
            number: number + decorOffset,
            meta: { floor: true, color },
            y: e.position.y,
          });
          w.decor.rememberInGroup(clickGroup, decorKey);
        }
      }
    }
  } finally {
    handlers.dispose();
  }
}

/**
 * Examples:
 * ```sh
 * events | filter 'e => e.npcKey'
 * events | filter /pointerup/
 * events /enter-door/
 * events 'e => e.key === "enter-door"'
 * events where:'e => e.key === "enter-door"'
 * ```
 * @template {NPC.Event} [T=NPC.Event]
 * @param {NPC.RunArg} ctxt
 * @param {{ where?(e: NPC.Event): e is T }} [opts]
 */
export async function* events({ api, args, w }, opts = api.jsArg(args)) {
  const filter = !args[0] ? undefined : (
    opts.where ?? api.generateSelector(api.parseFnOrStr(args[0]), [])
  );
  const asyncIterable = api.observableToAsyncIterable(w.events);
  const handlers = api.handleStatus({
    cleanups() { asyncIterable.return?.() },
  });

  for await (const event of asyncIterable) {
    if (filter === undefined || filter(event)) {
      yield /** @type {T} */ (event);
    }
  }
  // get here via ctrl-c or `kill`
  handlers.dispose();
  throw api.getKillError();
}

/**
 * ```sh
 * follow npc:rob
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string }} [opts]
 */
export async function* follow({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' })) {
  w.e.followNpc(opts.npcKey);
}

/**
 * Make the Camera look at a point.
 * @param {NPC.RunArg} ct
 * @param {{ at: string | import('three').Vector3 | Geom.Vect }} [opts]
 */
export async function* look({ api, args, w }, opts = api.jsArg(args)) {
  let abortAwaitResume = /** @param {*} e */ (e) => {};

  const handlers = api.handleStatus({
    cleanups() {
      w.view.reject.look?.(Error('cancelled'));
      abortAwaitResume(Error('cancelled'));
    },
    onSuspends(byPtags) {
      // 🔔 don't enter manual pause on global pause, else can't reject
      !byPtags && w.view.reject.look?.(Error('manual-pause')); 
      return true;
    },
  });

  try {
    while (true) {
      try {
        await w.e.lookAt(opts.at);
        break;
      } catch (e) {
        if (!(e instanceof Error && e.message === 'manual-pause')) {
          throw e;
        }
        await api.awaitResume(reject => abortAwaitResume = reject);
      }
    }
  } finally {
    handlers.dispose();
  }
}

/**
 * Make npc _do_ something (`do` is a shell keyword)
 * ```sh
 * make npc:rob do:$( click 1 )
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string } & NPC.DoOpts} [opts]
 */
export const make = async ({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' })) => {
  const npc = w.npc.get(opts.npcKey);

  let abortAwaitResume = /** @param {*} e */ (e) => {};

  const handlers = api.handleStatus({
    cleanups() {
      npc.rejectMove(Error('cancelled'));
      npc.rejectFade(Error('cancelled'));
      npc.rejectTurn(Error('cancelled'));
      abortAwaitResume(Error('cancelled'));
    },
    onSuspends(byPtags) {
      if (!byPtags && npc.doMeta !== opts.do.meta) {
        npc.rejectMove(Error('manual-pause'));
        npc.rejectFade(Error('manual-pause'));
        npc.rejectTurn(Error('manual-pause'));
      }
      return true;
    },
  });

  try {
    while (true) {
      try {
        await npc.make({ do: opts.do });
        break;
      } catch (e) {
        if (!(e instanceof Error && e.message === 'manual-pause')) {
          throw e;
        }
        await api.awaitResume(reject => abortAwaitResume = reject);
      }
    }
  } finally {
    handlers.dispose();
  }
}

/**
 * Supports manual process suspend/resume
 * ```sh
 * move npc:rob to:$( click 1 )
 * move npc:rob to:"$( click 2 )"
 * move npc:rob to:$( clicks 2 )
 * 
 * while true; do
 *   move npc:rob to:$( clicks 2 ) ...
 * done
 * ```
 * @param {NPC.RunArg} ct
 * @param {{ npcKey: string; '...'?: true } & NPC.MoveOpts} [opts]
 */
export const move = async ({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' }, { array: { to: true } })) => {
  const npc = w.npc.get(opts.npcKey);
  let to = Array.isArray(opts.to) ? opts.to.slice() : [opts.to];
  const arriveAnim = opts['...'] === true ? false : opts.arriveAnim;
  let abortAwaitResume = /** @param {*} e */ (e) => {};

  const handlers = api.handleStatus({
    cleanups() {
      npc.rejectMove(Error('cancelled'));
      abortAwaitResume(Error('cancelled'));
    },
    onSuspends(byPtags) {
      if (!byPtags) {
        to = npc.getRemainingPath();
        npc.rejectMove(Error('manual-pause'));
      }
      return true;
    },
  });

  try {
    while (true) {
      try {
        await npc.move({ ...opts, to, arriveAnim });
        break;
      } catch (e) {
        if (!(e instanceof Error && e.message === 'manual-pause')) {
          throw e;
        }
        await api.awaitResume(reject => abortAwaitResume = reject);
      }
    }
  } finally {
    handlers.dispose();
  }
}

/**
 * This is `util.narrate` but also logs speech.
 * @param {NPC.RunArg} ct
 * @param {Parameters<typeof util.narrate>[1]} [opts]
 */
export async function narrate(ct, opts = ct.api.jsArg(ct.args, { as: 'voice' })) {
  return await util.narrate(ct, {
    voice: ct.w.menu.defaultVoice?.name,
    ...opts,
    async onSay({ voice, words }) {
      ct.w.menu.say('VO', words); // "VO" means "Voice Over"
      opts.onSay?.({ voice, words });
    }
  });
}

/**
 * Provides nearby decor.meta.
 * - Parent decor can be identified via `meta.decorKey`.
 * ```sh
 * near to:$( click 1 )
 * near to:$( click 1 ) within:1
 * near to:rob
 * near to:$( click 1 ) where:bed
 * near to:$( click 1 ) where:'m => m.bed'
 * near npc:rob
 * near npc:rob | flatMap items
 * ```
 * 
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {NPC.GroundPoint | string} opts.to `npcKey` or point inside a room.
 * @param {number} [opts.within]
 * @param {string | ((meta: Geomorph.Decor['meta']) => any)} [opts.where]
 * @returns {{ count: number; items: Geomorph.Decor['meta'][] }}
 */
export function near({ api, args, w }, opts = api.jsArg(args, { npc: 'to' })) {
  const to = typeof opts.to === 'string' ? w.npc.get(opts.to).point : opts.to;
  if (helper.isVectJson(to) === false) {
    throw Error('opts.to must be a point');
  }
  const gmRoomId = w.npc.findRoomContaining(to);
  if (gmRoomId === null) {
    throw Error('opts.to must be inside a room');
  }
  
  const defaultRadius = 0.5;
  const decors = w.decor.query(to, opts.within ?? defaultRadius, { grKey: gmRoomId.grKey, reachRect: true });
  const id = /** @param {Geomorph.Decor['meta']} meta */ (meta) => meta;
  const selector = opts.where !== undefined ? api.generateSelector(opts.where) : id;
  const items = decors.map(x => x.meta).filter(selector);

  return { count: items.length, items };
}

/**
 * Test whether a ray hits walls or closed doors.
 * - Point available via `ray point`
 * - Detail available via `ray detail`
 * ```sh
 * ray from:$( click 1 ) to:$( click 1 )
 * ray from:kate to:will
 * ray point from:kate to:will
 * ray detail from:kate to:will
 * ray from:rob to:rob
 * ```
 * @param {NPC.RunArg} ct
 * @param {object} [opts]
 * @param {NPC.GroundPoint | string} opts.src
 * @param {NPC.GroundPoint | string} opts.dst
 * @param {boolean} [opts.point] Output point.
 * @param {boolean} [opts.detail] Output detailed result.
 */
export async function ray({ api, args, w }, opts = api.jsArg(args, { from: 'src', to: 'dst' })) {
  const src = typeof opts.src === 'string' ? w.npc.get(opts.src).point : opts.src;
  const dst = typeof opts.dst === 'string' ? w.npc.get(opts.dst).point : opts.dst;
  const result = await w.npc.raycast(src, dst);
  if (opts.point === true) {
    return result.hit;
  } else if (opts.detail === true) {
    return result;
  } else {
    return result.hit === null;
  }
}

/**
 * ```sh
 * # say something
 * say {1..5} npc:rob
 * say world: 1, rob: 0 npc:rob
 * say words:hello npc:rob
 * # say nothing
 * say npc:rob
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string; say: string; words?: string }} [opts]
 */
export function say({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' })) {
  const words = opts.words ?? args.filter(x => x in opts).join(' ');
  w.e.say({ npcKey: opts.npcKey, words });
}

/**
 * ```sh
 * spawn npc:rob at:$( click 1 )
 * spawn npc:rob at:$( click 1 ) granted:.
 * spawn npc:rob at:$( click 1 ) as:soldier-0,soldier-0,base,base
 * spawn npc:rob at:$( click 1 ) skin:,,base,base
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ granted?: string } & NPC.SpawnOpts} [opts]
 */
export async function* spawn({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey', skin: 'as' })) {
  await w.npc.spawn(opts);
  if (typeof opts.granted === 'string') {
    w.e.grantAccess(opts.granted, opts.npcKey);
  }
}

/**
 * ```sh
 * think npc:rob of:bed '[top bunk]' or [bottom] ?
 * # disable extant thought
 * think npc:rob of:bed
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string; thoughtKey: string; parts?: string[]; }} [opts]
 */
export function think({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey', of: 'thoughtKey' })) {
  const parts = opts.parts ?? args.filter(x => x in opts);
  const bubble = w.bubble.ensure(opts.npcKey);
  bubble.think(opts.thoughtKey, ...parts);
  w.n[opts.npcKey].showLabel(false);
}

/**
 * Usage:
 * ```sh
 * w
 * w 'x => x.crowd'
 * w crowd
 * w e.toggleDoor g0d0
 * w gmGraph.findRoomContaining $( click -2 1 )
 * click 1 | w npc.findRoomContaining -
 * echo image/webp | w view.openSnapshot - 50
 * click 1 | w n.rob.look - 500
 * ```
 *
 * - can always `ctrl-c`, even without cleaning up ongoing computations
 * - can read stdin via hyphen arg
 * 
 * @param {NPC.RunArg} ct
 */
export async function* w(ct) {
  const { api, args, w } = ct;

  // support piped inputs via hyphen args -
  // e.g. `click 1 | w npc.findRoomContaining -`
  const stdinInputChar = "-";
  const readStdin = args.slice(1).some(arg => arg === stdinInputChar);
  
  let reject = /** @param {*} e */ (e) => {};
  const handlers = api.handleStatus({
    cleanups() { reject(new Error("potential ongoing computation")) },
  });
  /** @param {any} value */
  async function awaitOrIgnore(value) {// handle non-promise or promise
    return Promise.race([value, new Promise((_, rej) => reject = rej)]).finally(() => {
      reject(null);
      handlers.dispose();
    });
  }

  if (readStdin !== true) {
    const func = api.generateSelector(
      api.parseFnOrStr(args[0]),
      args.slice(1).map(api.parseJsArg),
      true,
    );
    yield await awaitOrIgnore(func(w, ct));
    return;
  }
  
  /** @type {*} */ let datum;
  while ((datum = await api.read()) !== api.eof) {
    const func = api.generateSelector(
      api.parseFnOrStr(args[0]),
      args.slice(1).map(x => x === stdinInputChar ? datum : api.parseJsArg(x)),
      true,
    );
    try {
      yield awaitOrIgnore(func(w, ct));
    } catch (e) {
      yield `${api.ansi.Cyan}${e}${api.ansi.Reset}`;
    }
  }
}

// If needed bring back w.view.dst.distance with resolve/reject
// /**
//  * @param {NPC.RunArg} ctxt
//  * @param {{ to: number }} [opts]
//  */
// export async function* zoom({ api, args, w }, opts = api.jsArg(args)) {
//   if (typeof opts.to !== 'number') {
//     throw Error(`opts.distance must be numeric`);
//   }
//   const handlers = api.handleStatus({
//     cleanups() { w.view.reject.distance?.('cancelled'); },
//     onSuspends() { w.view.reject.distance?.('pause'); return true; },
//   });

//   while (true) {
//     try {
//       return await w.view.tween({ distance: opts.to }).then(handlers.dispose);
//     } catch (e) {
//       if (e !== 'pause') {
//         handlers.dispose();
//         throw e;
//       }
//     }
//     await api.awaitResume();
//   }
// }
