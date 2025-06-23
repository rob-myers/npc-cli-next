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
 * ```
 * @param {NPC.RunArg} ctxt
 */
export async function* click({ api, args, w, w: { lib } }) {
  let { opts, operands } = api.getOpts(args, {
    boolean: [
      "left",     // left clicks only
      "right",    // right clicks only
      "long",     // long press only
      "any",      // any permitted
      "blocking", // e.g. `click --blocking`
    ],
  });
  if (opts["right"] === false && opts["any"] === false)  {
    opts.left = true; // default to left clicks only
  }

  if (
    w.lib.generic.isStringInteger(operands[0]) === false
    && w.lib.generic.isStringInteger(operands[1]) === true
  ) {// support reverse order `click meta.nav 2`
    operands = [operands[1], operands[0]];
  }

  let numClicks = Number(operands[0]) || Number.MAX_SAFE_INTEGER;
  const clickId = numClicks < Number.MAX_SAFE_INTEGER || opts.blocking === true
    ? api.getUid()
    : undefined
  ;

  // support `click meta.nav`
  const filterDef = numClicks === Number.MAX_SAFE_INTEGER ? operands[0] : operands[1];
  const filter = filterDef !== undefined ? api.generateSelector(api.parseFnOrStr(filterDef), []) : undefined;

  /** @type {import('rxjs').Subscription} */
  let eventsSub;

  // suspend/resume handled by `api.isRunning()` below
  const handlers = api.handleStatus({
    cleanups() {
      clickId !== undefined && w.lib.generic.removeFirst(w.view.clickIds, clickId);
      eventsSub?.unsubscribe();
    },
  });

  try {
    while (numClicks > 0) {
      clickId !== undefined && w.view.clickIds.push(clickId);
      
      const e = await /** @type {Promise<NPC.PointerUpEvent>} */ (new Promise((resolve, reject) => {
        eventsSub = w.events.subscribe({ next(e) {
          if (e.key !== "pointerup" || e.pointers > 1 || w.view.isPointerEventDrag(e) === true || api.isRunning() === false) {
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
        numClicks--;
        yield output;
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
 * @param {NPC.RunArg} ctxt
 * @param {{ at: string | import('three').Vector3 | Geom.Vect }} [opts]
 */
export async function* look({ api, args, w }, opts = api.jsArg(args)) {
  const handlers = api.handleStatus({
    cleanups() { w.view.reject.look?.('cancelled'); },
    onSuspends() { w.view.reject.look?.('pause'); return true; },
  });

  while (true) {
    try {
      return await w.e.lookAt(opts.at).then(handlers.dispose);
    } catch (e) {
      if (e !== 'pause') {
        handlers.dispose();
        throw e;
      }
    }
    await api.awaitResume();
  }
}

/**
 * Supports manual process suspend/resume
 * ```sh
 * move npcKey:rob to:$( click 1 ) arriveAnim:none
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ npcKey: string } & NPC.MoveOpts} [opts]
 */
export const move = async ({ api, args, w }, opts = api.jsArg(args)) => {
  const npc = w.npc.getOrThrow(opts.npcKey);
  
  const handlers = api.handleStatus({
    cleanups() { npc.reject.move?.(Error('cancelled')); },
    onSuspends(byPtags) { if (!byPtags) { npc.reject.move?.(Error('manual-pause')); return true; } },
  });

  while (true) {
    try {
      await npc.api.move(opts);
      handlers.dispose();
      break;
    } catch (e) {
      if (e instanceof Error && e.message === 'manual-pause') {
        await api.awaitResume();
        continue;
      }
      handlers.dispose();
      throw e;
    }
  }
}

/**
 * ```sh
 * spawn npcKey:rob at:$( click 1 ) arriveAnim:none
 * spawn npcKey:rob at:$( click 1 ) grant:.
 * ```
 * @param {NPC.RunArg} ctxt
 * @param {{ grant?: string } & NPC.SpawnOpts} [opts]
 */
export async function* spawn({ api, args, w }, opts = api.jsArg(args)) {
  await w.npc.spawn(opts);
  if (typeof opts.grant === 'string') {
    w.e.grantAccess(opts.grant, opts.npcKey);
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
    cleanups() { reject("potential ongoing computation") },
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
    );
    yield await awaitOrIgnore(func(w, ct));
    return;
  }
  
  /** @type {*} */ let datum;
  while ((datum = await api.read()) !== api.eof) {
    const func = api.generateSelector(
      api.parseFnOrStr(args[0]),
      args.slice(1).map(x => x === stdinInputChar ? datum : api.parseJsArg(x)),
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
 * @param {{ distance: number }} [opts]
 */
export async function* zoom({ api, args, w }, opts = api.jsArg(args)) {
  if (typeof opts.distance !== 'number') {
    throw Error(`opts.distance must be numeric`);
  }
  const handlers = api.handleStatus({
    cleanups() { w.view.reject.distance?.('cancelled'); },
    onSuspends() { w.view.reject.distance?.('pause'); return true; },
  });

  while (true) {
    try {
      return await w.view.tween({ distance: opts.distance }).then(handlers.dispose);
    } catch (e) {
      if (e !== 'pause') {
        handlers.dispose();
        throw e;
      }
    }
    await api.awaitResume();
  }
}
