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
 * ```
 * @param {NPC.RunArg} ctxt
 */
export async function* click({ api, args, w }) {
  const { opts, operands } = api.getOpts(args, {
    boolean: [
      "left",     // left clicks only
      "right",    // right clicks only
      "long",     // long press only
      "any",      // any permitted
      "blocking", // e.g. `click --blocking`
    ],
  });

  if (opts["left"] === false && opts["right"] === false && opts["any"] === false)  {
    opts.left = true; // default to left clicks only
  }

  let numClicks = Number(operands[0]) || Number.MAX_SAFE_INTEGER;
  // if (!Number.isFinite(numClicks)) {
  //   throw new Error("format: \`click [{numberOfClicks}]\`");
  // }
  
  const clickId = numClicks < Number.MAX_SAFE_INTEGER || opts.blocking === true
    ? api.getUid()
    : undefined
  ;
  if (clickId !== undefined) {
    api.addCleanUp(() => w.lib.removeFirst(w.view.clickIds, clickId));
  }

  // support `click meta.nav`
  const filterDef = numClicks === Number.MAX_SAFE_INTEGER ? operands[0] : operands[1];
  const filter = filterDef !== undefined ? api.generateSelector(api.parseFnOrStr(filterDef), []) : undefined;

  /** @type {import('rxjs').Subscription} */
  let eventsSub;
  api.addCleanUp(() => eventsSub?.unsubscribe());

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
  // could not catch asyncIterable.throw?.(api.getKillError())
  api.addCleanUp(() => asyncIterable.return?.());

  for await (const event of asyncIterable) {
    if (filter === undefined || filter?.(event)) {
      yield event;
    }
  }
  // get here via ctrl-c or `kill`
  throw api.getKillError();
}

/**
 * @param {NPC.RunArg} ctxt
 * @param {{ at: string | import('three').Vector3 | Geom.Vect }} [opts]
 */
export async function* look({ api, args, w }, opts = api.jsArg(args)) {
  api.addCleanUp(() => w.view.reject.look?.(Error('cancelled')));
  
  while (true) {
    try {
      return await Promise.race([
        w.e.lookAt(opts.at),
        api.throwOnPause('manual-pause', false),
      ]);
    } catch (e) {
      if (e === 'manual-pause') {
        w.view.resolve.look?.();
        await api.awaitResume();
        continue;
      }
      throw e;
    }
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
export async function* move({ api, args, w }, opts = api.jsArg(args)) {
  const npc = w.npc.getOrThrow(opts.npcKey);

  api.addCleanUp(() => npc.reject.move?.(Error('cancelled'))); 
  
  while (true) {
    try {
      return await Promise.race([
        npc.api.move(opts),
        api.throwOnPause('manual-pause', false),
      ]);
    } catch (e) {
      if (e === 'manual-pause') {
        npc.api.stopMoving();
        await api.awaitResume();
        continue;
      }
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
 * w 'x => x.crowd'`
 * w crowd
 * w e.toggleDoor g0d0
 * w gmGraph.findRoomContaining $( click 1 | map xz )
 * click 1 | map xz | w --stdin gmGraph.findRoomContaining
 * echo image/webp | w --stdin view.openSnapshot _ 0
 * ```
 *
 * ℹ️ can always `ctrl-c`, even without cleaning up ongoing computations
 * ℹ️ --stdin option assumes stdin arg is represented via `_` (hyphen breaks getopts)
 * 
 * @param {NPC.RunArg} ctxt
 */
export async function* w(ctxt) {
  const { api, args, w } = ctxt;
  const getHandleProm = () => new Promise((resolve, reject) => api.addCleanUp(
    () => reject("potential ongoing computation")
  ));

  // also support piped inputs via hyphen args -
  // e.g. `click 1 | map xz | w gmGraph.findRoomContaining -`
  // const { opts, operands } = api.getOpts(args);

  const stdinInputChar = "-";
  const stdin = args.slice(1).some(arg => arg === stdinInputChar);

  if (stdin !== true) {
    const func = api.generateSelector(
      api.parseFnOrStr(args[0]),
      args.slice(1).map(api.parseJsArg),
    );
    const v = func(w, ctxt);
    yield v instanceof Promise ? Promise.race([v, getHandleProm()]) : v;
  } else {
    /** @type {*} */ let datum;
    while ((datum = await api.read()) !== api.eof) {
      const func = api.generateSelector(
        api.parseFnOrStr(args[0]),
        args.slice(1).map(x => x === stdinInputChar ? datum : api.parseJsArg(x)),
      );
      try {
        const v = func(w, ctxt);
        yield v instanceof Promise ? Promise.race([v, getHandleProm()]) : v;
      } catch (e) {
        yield `${api.ansi.Cyan}${e}${api.ansi.Reset}`;
      }
    }
  }
}

/**
 * @param {NPC.RunArg} ctxt
 * @param {{ distance: number }} [opts]
 */
export async function* zoom({ api, args, w }, opts = api.jsArg(args)) {
  if (typeof opts.distance !== 'number') throw Error(`opts.distance must be numeric`);
  api.addCleanUp(() => w.view.reject.distance?.(Error('cancelled')));
  
  while (true) {
    try {
      return await Promise.race([
        w.view.tween({ distance: opts.distance }),
        api.throwOnPause('manual-pause', false),
      ]);
    } catch (e) {
      if (e === 'manual-pause') {
        w.view.resolve.distance?.();
        await api.awaitResume();
        continue;
      }
      throw e;
    }
  }
}
