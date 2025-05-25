/**
 * @param {import('./').RunArg} ctxt
 */
export const changeAngleOnKeyDown = ({ w }) => {
  w.view.keyDowns.changeAngle = async (e) => {
    const key = e.key.toLowerCase();

    // if (key === 'w') {
    //   return await w.view.tween({
    //     polar: Math.abs(w.lib.deltaAngle(w.view.controls.getPolarAngle(), 0)) < 0.1 ? Math.PI/4 : 0
    //   });
    // }
    
    const angle = w.lib.radRange(w.view.controls.getAzimuthalAngle());
    const delta = Math.PI * 0.5;
    const ratio = angle / delta; // [0..4)
    switch (key) {
      case "w": {
        await w.view.tween({
          azimuthal: Math.round(ratio) * delta,
          polar: Math.abs(w.lib.deltaAngle(w.view.controls.getPolarAngle(), 0)) < 0.1 ? Math.PI/4 : 0,
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
 * ```sh
 * events | handleContextMenu
 * ```
 * @param {import('./').RunArg<NPC.Event>} ctxt
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
 * e.g. events | handleLoggerLinks
 * @param {import('./').RunArg<NPC.Event>} ctxt
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
 * ```sh
 * initCamAndLights rob # initially look at rob
 * ```
 * @param {import('./').RunArg} ctxt
 */
export async function* initCamAndLights({ api, args, w }) {

  const [npcKey] = args;

  // turn off "tween while paused" so can pause profile
  w.view.canTweenPaused = false;
  w.floor.showTorch = false;
  w.floor.showLights = true;
  w.update();
  
  await w.view.tween({
    azimuthal: 0,
    polar: w.smallViewport ? Math.PI / 8 : Math.PI/5,
  }).catch(() => {});

  // if (w.smallViewport) {
  //   w.view.ctrlOpts.minAzimuthAngle = 0;
  //   w.view.ctrlOpts.maxAzimuthAngle = 0;
  //   w.view.ctrlOpts.maxDistance = 25;
  // }
  w.view.ctrlOpts.maxPolarAngle = Math.PI/5;
  
  w.view.canTweenPaused = true;

  if (npcKey in w.n) {
    w.view.lockDistance(); // prevent zoom-in while look
    await w.e.lookAt(npcKey).finally(() => w.view.unlockDistance());
    await w.view.tween({ distance: 12 });
  }

}

/**
 * Supports Ctrl+C and process suspend/resume
 * ```sh
 * move npcKey:rob to:$( click 1 ) arriveAnim:none
 * ```
 * @param {import('./').RunArg} ctxt
 */
export async function* move({ api, args, w }) {
  const opts = /** @type {{ npcKey: string } & NPC.MoveOpts} */ (api.parseArgsAsJs(args));
  const npc = w.n[opts.npcKey];
  if (!npc) {
    throw Error(`npcKey invalid: ${opts.npcKey}`)
  }

  const ctrlCError = Error('cancelled');
  api.addCleanUp(() => npc.reject.move?.(ctrlCError)); 
  
  while (true) {
    try {
      return await Promise.race([
        npc.api.move(opts),
        new Promise((_, rej) => api.addSuspend(() => rej('paused'))),
      ]);
    } catch (e) {
      if (e === 'paused') {// via `ps` or Tabs
        npc.api.stopMoving();
        await /** @type {Promise<void>} */ (new Promise((res, rej) => (
          api.addCleanUp(() => rej(ctrlCError)),
          api.addResume(res)
        )));
        continue;
      }
      throw e;
    }

  }

}

/**
 * ```sh
 * moveCycle npcKey:rob to:"$( click 5 )"
 * moveCycle npcKey:rob to:"$( click 5 | sponge )"
 * moveCycle npcKey:rob to:"$( points )"
 * ```
 * @param {import('./').RunArg} ctxt
 */
export async function* moveCycle(ctxt) {
  const { api, args } = ctxt;

  // 🚧 should keep trying to reach point (possibly optionally)
  // 🚧 change type of `to`
  // 🚧 provide opts directly (not args)

  const opts = /** @type {{ npcKey: string; to: NPC.ClickOutput[] }} */ (
    api.parseArgsAsJs(args, { to: 'array' })
  );
  
  while (true) {
    for (const to of opts.to) {
      try {
        // ctxt.args = [`npcKey:${opts.npcKey}`, `to:${JSON.stringify(to)}`, `arriveAnim:none`];
        ctxt.args = [`npcKey:${opts.npcKey}`, `to:${JSON.stringify(to)}`];
        yield* ctxt.lib.move(ctxt);
        await api.sleep(0.8);
      } catch (e) {
        if (/** @type {NPC.StopReason} */ (e)?.type === 'stop-reason') {
          await api.sleep(0.8);
          continue;
        }
        throw e;
      }
      
    }
  }

}

/**
 * Make a single hard-coded polygon non-navigable,
 * and also indicate it via debug polygon.
 * ```sh
 * selectPolysDemo [{queryFilterType}=0]
 * ```
 * @param {import('./').RunArg} ctxt
 */
export async function* selectPolysDemo({ w, args }) {
    const queryFilterType = Number(args[0]) || 0;
    const { polyRefs } = w.crowd.navMeshQuery.queryPolygons(
      { x: 3.5 * 1.5, y: 0, z: 7 * 1.5 },
      { x: 0.01, y: 0.1, z: 0.01 },
      { maxPolys: 1 },
    );
    console.log({ polyRefs });

    const filter = w.crowd.getFilter(queryFilterType);
    const { navPolyFlag } = w.lib;
    // by default all polys should not match this bitmask:
    filter.excludeFlags = navPolyFlag.unWalkable;
    polyRefs.forEach(polyRef => w.nav.navMesh.setPolyFlags(polyRef, navPolyFlag.unWalkable));
    w.debug.selectNavPolys(...polyRefs); // display via debug
}

/**
 * 🔔 "export const" uses `call` rather than `map`
 * @param {import('./').RunArg} ctxt
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
 * @param {import('./').RunArg} ctxt
 */
export const setupOnSlowNpc = ({ w, args }) => {

  w.npc.onStuckCustom = (npc, agent) => {
    // console.warn(`${npc.key}: going slow`);
    switch (args[0]) {
      case 'noop': // do nothing
        break;
      default: // both stop
        npc.api.stopMoving({ type: 'stop-reason', key: 'stuck' });
        break;
    }
  };

}
