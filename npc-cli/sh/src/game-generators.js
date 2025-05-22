/**
 * @param {import('./').RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY } }) {
  api.info(`awaiting ${api.ansi.White}${WORLD_KEY}`);

  while (api.getCached(WORLD_KEY)?.isReady(api.meta.sessionKey) !== true) {
    await api.sleep(0.05);
  }
}

/**
 * ```sh
 * click
 * click 1
 * click --right
 * click --any
 * click 5 '({ meta }) => meta.nav'
 * click 5 meta.nav
 * ```
 * @param {import('./').RunArg} ctxt
 */
export async function* click({ api, args, w }) {
  const { opts, operands } = api.getOpts(args, {
    boolean: ["left", "right", "any", "long"],
    // --left (left only) --right (right only) --any (either)
    // --long (long-press only)
  });

  if (!opts["left"] && !opts["right"] && !opts["any"]) {
    opts.left = true; // default to left clicks only
  }

  let numClicks = Number(operands[0] || Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(numClicks)) {
    throw new Error("format: \`click [{numberOfClicks}]\`");
  }

  const clickId = operands[0] ? api.getUid() : undefined;
  if (clickId !== undefined) {
    api.addCleanUp(() => w.lib.removeFirst(w.view.clickIds, clickId));
  }

  const filter = operands[1] ? api.generateSelector(
    api.parseFnOrStr(operands[1]),
    []
  ) : undefined;

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
 * @param {import('./').RunArg} ctxt
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
 * @param {import('./').RunArg} ctxt
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
        api.info(`${e}`);
      }
    }
  }
}
