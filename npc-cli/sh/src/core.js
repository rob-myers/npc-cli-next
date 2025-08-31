import { isStringInt, removeFirst } from '../../service/generic';
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
 * click
 * click 1
 * click --right
 * click --any
 * click 5 '({ meta }) => meta.nav'
 * click 5 meta.nav
 * click meta.nav
 * click meta.nav 2
 * click --red 3
 * click --red --keep 3
 * click --clear
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
      "any",   // any permitted
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
  if (isStringInt(args[0]) && Number(args[0]) < 0) {
    return; // check arg: -1 an opt not an operand
  }

  /** Number of clicks remaining */
  let numClicks = isStringInt(operands[0]) ? parseInt(operands[0]) : Number.MAX_SAFE_INTEGER;
  const totalClicks = numClicks;
  const clickId = isStringInt(operands[0]) || opts.block === true ? api.getUid() : undefined;
  const blocking = clickId !== undefined;

  const colors = { red: '#c00', green: '#0c0', blue: '#00c',  black: '#999' };
  const color = opts.red === true ? colors.red : opts.blue === true ? colors.blue : opts.green === true ? colors.green : colors.black;
  const clickGroup = `click-${color}`;

  if (opts.clear === true) {// clear labels of all colours
    Object.values(colors).forEach(color => w.decor.removeGroup(`click-${color}`));
    if (operands.length === 0) {
      return; // `click --clear` does not send clicks
    }
  }

  // support `click meta.nav`
  const filterDef = isStringInt(operands[0]) ? operands[1] : operands[0];
  const filter = filterDef !== undefined ? api.generateSelector(api.parseFnOrStr(filterDef), []) : undefined;

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
        ...e.position,
        ...e.keys && { keys: e.keys },
        meta: {
          ...e.meta,
          nav: e.meta.floor === true ? w.npc.isPointInNavmesh(e.point) : false,
          // longClick: e.justLongDown,
        },
        xz: {...e.point},
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
          createDecorNumber(ct, { decorKey, at: output, number, meta: { floor: true, color }, y: e.position.y });
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
 * events /pointerup/
 * ```
 * @param {NPC.RunArg} ctxt
 */
export async function* events({ api, args, w }) {
  const filter = args[0] ? api.generateSelector(
    api.parseFnOrStr(args[0]),
    [],
  ) : undefined;
  
  // 🔔 independent because we won't synchronously invoke `w.events.next`
  const asyncIterable = api.observableToAsyncIterable(w.events);
  const handlers = api.handleStatus({
    // could not catch asyncIterable.throw?.(api.getKillError())
    cleanups() { asyncIterable.return?.() },
  });

  for await (const event of asyncIterable) {
    if (filter === undefined || filter?.(event)) {
      yield event;
    }
  }
  // get here via ctrl-c or `kill`
  handlers.dispose();
  throw api.getKillError();
}

/**
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
 * ```sh
 * make npc:rob do:$( click 1 )
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string } & NPC.DoOpts} [opts]
 */
export const make = async ({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' })) => {
  const npc = w.npc.getNpc(opts.npcKey);

  let abortAwaitResume = /** @param {*} e */ (e) => {};

  const handlers = api.handleStatus({
    cleanups() {
      npc.api.rejectMove(Error('cancelled'));
      npc.api.rejectFade(Error('cancelled'));
      npc.api.rejectTurn(Error('cancelled'));
      abortAwaitResume(Error('cancelled'));
    },
    onSuspends(byPtags) {
      if (!byPtags && npc.s.doMeta !== opts.do.meta) {
        npc.api.rejectMove(Error('manual-pause'));
        npc.api.rejectFade(Error('manual-pause'));
        npc.api.rejectTurn(Error('manual-pause'));
      }
      return true;
    },
  });

  try {
    while (true) {
      try {
        await npc.api.make({ do: opts.do });
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
 * move npc:rob to:$( clicks 2 ) inLoop
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string; inLoop?: true } & NPC.MoveOpts} [opts]
 */
export const move = async ({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' }, { array: { to: true } })) => {
  const npc = w.npc.getNpc(opts.npcKey);
  let to = Array.isArray(opts.to) ? opts.to.slice() : [opts.to];
  const arriveAnim = opts.inLoop === true ? false : undefined;
  let abortAwaitResume = /** @param {*} e */ (e) => {};

  const handlers = api.handleStatus({
    cleanups() {
      npc.api.rejectMove(Error('cancelled'));
      abortAwaitResume(Error('cancelled'));
    },
    onSuspends(byPtags) {
      if (!byPtags) {
        to = npc.api.getRemainingPath();
        npc.api.rejectMove(Error('manual-pause'));
      }
      return true;
    },
  });

  try {
    while (true) {
      try {
        await npc.api.move({ ...opts, to, arriveAnim });
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
 * ```sh
 * say {1..5} npc:rob
 * say world: 1, rob: 0 npc:rob
 * say words:hello npc:rob
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string; say: string; words?: string; operands?: string[] }} [opts]
 */
export const say = async ({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' })) => {
  if (opts.words) {
    w.e.say({ npcKey: opts.npcKey, words: opts.words });
  } else {
    const words = args.filter(x => !x.startsWith('npc:')).join(' ');
    w.e.say({ npcKey: opts.npcKey, words });
  }
}

/**
 * ```sh
 * spawn npc:rob at:$( click 1 )
 * spawn npc:rob at:$( click 1 ) granted:.
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ granted?: string } & NPC.SpawnOpts} [opts]
 */
export async function* spawn({ api, args, w }, opts = api.jsArg(args, { npc: 'npcKey' })) {
  await w.npc.spawn(opts);
  if (typeof opts.granted === 'string') {
    w.e.grantAccess(opts.granted, opts.npcKey);
  }
}

/**
 * Usage:
 * ```sh
 * w
 * w 'x => x.crowd'
 * w crowd
 * w e.toggleDoor g0d0
 * w gmGraph.findRoomContaining $( click 1 | map xz )
 * click 1 | map xz | w gmGraph.findRoomContaining -
 * echo image/webp | w view.openSnapshot - 50
 * click 1 | w n.rob.api.look - 500
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
  // e.g. `click 1 | map xz | w gmGraph.findRoomContaining -`
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

/**
 * @param {NPC.RunArg} ctxt
 * @param {{ to: number }} [opts]
 */
export async function* zoom({ api, args, w }, opts = api.jsArg(args)) {
  if (typeof opts.to !== 'number') {
    throw Error(`opts.distance must be numeric`);
  }
  const handlers = api.handleStatus({
    cleanups() { w.view.reject.distance?.('cancelled'); },
    onSuspends() { w.view.reject.distance?.('pause'); return true; },
  });

  while (true) {
    try {
      return await w.view.tween({ distance: opts.to }).then(handlers.dispose);
    } catch (e) {
      if (e !== 'pause') {
        handlers.dispose();
        throw e;
      }
    }
    await api.awaitResume();
  }
}
