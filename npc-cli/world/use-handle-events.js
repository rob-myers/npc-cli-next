import React from "react";
import * as THREE from "three";

import { Vect, Rect } from "../geom";
import { defaultDoorCloseMs } from "../service/const";
import { pause, warn, removeDups } from "../service/generic";
import { geom } from "../service/geom";
import { globalLoggerLinksRegex } from "../terminal/Logger";
import { npcToBodyKey } from "../service/rapier";
import { toV3 } from "../service/three";
import { helper } from "../service/helper";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {import('./World').State} w
 */
export default function useHandleEvents(w) {

  const state = useStateRef(/** @returns {State} */ () => ({
    doorToAccess: {},
    doorToNearbyNpcs: {},
    doorToOffMesh: {},
    externalNpcs: new Set(),
    followedNpcKey: null,
    npcToAccess: {},
    npcToDoors: {},
    npcToRoom: new Map(),
    pressMenuPrevent: {},
    roomMeta: {},
    roomToNpcs: [],
    
    applyImprovedOffMesh(npc, improved) {
      const npcPoint = npc.point;
      const { src: newSrc, dst: newDst } = improved;

      // 🤔 could use last known speed and speed up via tScale
      const speed = npc.getMaxSpeed();

      // adjust RecastDetour dtCrowdAgentAnimation
      const anim = /** @type {import("./npc").dtCrowdAgentAnimation} */ (npc.agentAnim);
      anim.set_initPos(0, npcPoint.x);
      anim.set_initPos(2, npcPoint.y);
      anim.set_startPos(0, newSrc.x);
      anim.set_startPos(2, newSrc.y);
      anim.set_endPos(0, newDst.x);
      anim.set_endPos(2, newDst.y);

      const delta = tmpVect1.copy(newDst).sub(newSrc);
      const tmid = npcPoint.distanceTo(newSrc) / speed;
      const tmax = tmid + (delta.length / speed);

      anim.set_t(0);
      anim.set_tmid(tmid);
      anim.set_tmax(tmax);

      delta.normalize();
      anim.set_unitExitVel(0, delta.x);
      anim.set_unitExitVel(1, 0);
      anim.set_unitExitVel(2, delta.y);
    },
    canCloseDoor(door) {
      const closeNpcs = state.doorToNearbyNpcs[door.gdKey];
      if (closeNpcs === undefined) {
        return true;
      } else if (state.doorToOffMesh[door.gdKey]?.length > 0) {
        return false; // nope: npc(s) using doorway
      } else if (closeNpcs.size === 0) {
        return true;
      } else if (door.auto === true && door.locked === false) {
        return false; // nope: npc(s) trigger sensor
      }
      return true;
    },
    clearOffMesh(npc) {
      // 🔔 offMeshConnection can happen when `npc.offMesh === null`
      // e.g. npc without access near door
      npc.agentAnim?.set_active(false);
      npc.agentAnim?.set_tScale(1);

      if (npc.offMesh === null) {
        return;
      }

      const { orig, seg } = npc.offMesh;
      npc.offMesh = null;

      if (seg === 0) {// 🔔 throttle `move` to fix repeated offMesh attempts
        npc.offMeshCoolDown = Date.now() + 300;
      }
      
      state.doorToOffMesh[orig.gdKey] = state.doorToOffMesh[orig.gdKey].filter(x => x.npcKey !== npc.key);
      (state.npcToDoors[npc.key] ??= { inside: null, nearby: new Set() }).inside = null;
    },
    findDoPointUnder(input) {
      const height = 'z' in input ? input.y : 0.1; // above ground by default
      const point = helper.toXZ(input);
      const decors = w.decor.query(point, 0.1).filter(
        /** @returns {d is Geomorph.DecorPoint} */ d => d.type === 'point' && d.meta.do === true
      );
      const closest = { index: -1, diff: Infinity };
      for (const [index, d] of decors.entries()) {
        const diff = height - (d.meta.y ?? 0);
        if (0 < diff && diff < closest.diff) {
          closest.index = index;
          closest.diff = diff;
        }
      }
      return decors[closest.index] ?? null;
    },
    findOtherBlockingNearDoor(npc, offMesh) {
      const npcsNearbyDoor = state.doorToNearbyNpcs[offMesh.gdKey] ?? [];
      const gmRoomId = /** @type {Geomorph.GmRoomId} */ (state.npcToRoom.get(npc.key));

      for (const otherNpcKey of npcsNearbyDoor) {
        if (otherNpcKey === npc.key) {
          continue;
        }

        const other = w.n[otherNpcKey];
        if (
          state.npcToRoom.get(other.key)?.grKey !== gmRoomId.grKey // wrong room
          || other.target !== null // handled elsewhere (?)
        ) {
          continue;
        }

        const otherIntersectsMainSeg = geom.lineSegCoordsIntersectsCircle(
          // try avoid needless blocking
          // maybe only need to block when npc enters around a corner
          offMesh.src.x + 0 * (offMesh.dst.x - offMesh.src.x), offMesh.src.z + 0 * (offMesh.dst.z - offMesh.src.z),
          offMesh.dst.x, offMesh.dst.z,
          other.point.x, other.point.y,
          0.1,
        );
        
        if (otherIntersectsMainSeg === false) {
          continue; // other is not close enough to offMesh connection
        }
  
        if (geom.lineSegCoordsIntersectsCircle(
          npc.point.x,
          npc.point.y,
          offMesh.src.x, offMesh.src.z,
          // offMesh.dst.x, offMesh.dst.z,
          other.point.x, other.point.y,
          .25,
        ) === true) {
          return otherNpcKey;
        }
      }
  
      return null;
    },
    findOtherBlockingOppositeDir(offMesh, src, dst) {
      for (const tr of state.doorToOffMesh[offMesh.gdKey] ?? []) {
        if (tr.orig.srcGrKey === offMesh.srcGrKey) {
          continue;
        }
        if (state.testOffMeshDisjoint(tr, src, dst) === false) {
          return tr.npcKey;
        }
      }
      return null;
    },
    followNpc(npcKey, opts = { smoothTime: 0.4, maxDistance: undefined }) {
      const npc = w.n[npcKey];
      w.view.followObject3D(npc.m.group, { height: helper.defaults.height, ...opts });
      state.followedNpcKey = npcKey;
      w.events.next({ key: 'started-following', npcKey });
    },
    getGrKey(npcKey) {
      return state.npcToRoom.get(npcKey)?.grKey;
    },
    getNpcMeta(npcKey) {
      const npc = w.n[npcKey];
      const grId = state.npcToRoom.get(npc.key) ?? null;
      return {
        room: grId === null ? null : w.e.roomMeta[grId.grKey],
      };
    },
    /**
     * Given ids of rooms in gmGraph, provide "adjacency data".
     * - We do include rooms adjacent via a door or window.
     * - We handle dup roomIds e.g. via double doors.
     * - We don't ensure input roomIds are output.
     *   However they're included if they're adjacent to another such input roomId.
     * @param {Geomorph.GmRoomId[]} gmRoomIds
     * @param {(opts: { gmId: number } & (
    *   | { type: 'door'; doorId: number }
    *   | { type: 'window'; windowId: number }
    * )) => boolean} [canAccess]
    * @returns {Graph.GmRoomsAdjData}
    */
    getRoomIdsAdjData(gmRoomIds, canAccess = () => true) {
      const output = /** @type {Graph.GmRoomsAdjData} */ ({});

      for (const { gmId, roomId } of gmRoomIds) {
        const gm = w.gms[gmId];
        const { roomGraph } = w.gmsData[gm.key];

        // Non-hull doors or windows induce an adjacent room
        !output[gmId] && (output[gmId] = { gmId, roomIds: [], windowIds: [] });
        output[gmId].roomIds.push(...roomGraph.getAdjRoomIds(roomId, (opts) => canAccess({ gmId, ...opts })));
        output[gmId].windowIds.push(...roomGraph.getAdjacentWindows(roomId).flatMap(x => gm.windows[x.windowId].meta.frosted ? [] : x.windowId));
        // Connected hull doors induce room in another geomorph
        // 🔔 ignoring hull windows 
        const hullDoorIds = roomGraph.getAdjacentHullDoorIds(gm, roomId);
        hullDoorIds
          .filter(({ hullDoorId }) => !w.gmGraph.isHullDoorSealed(gmId, hullDoorId))
          .forEach(({ hullDoorId }) => {
            const ctxt = /** @type {Graph.GmAdjRoomCtxt} */ (w.gmGraph.getAdjacentRoomCtxt(gmId, hullDoorId));
            !output[ctxt.adjGmId] && (output[ctxt.adjGmId] = { gmId: ctxt.adjGmId, roomIds: [], windowIds: [] });
            output[ctxt.adjGmId].roomIds.push(ctxt.adjRoomId);
          });
      }

      Object.values(output).forEach(x => x.roomIds = removeDups(x.roomIds));
      return output;
    },
    grantAccess(regexDef, ...npcKeys) {
      for (const npcKey of npcKeys) {
        (state.npcToAccess[npcKey] ??= new Set()).add(regexDef);
      }
    },
    async handleEvents(e) {
      // debug('useHandleEvents', e);

      if ('npcKey' in e) {// 🔔 if key present, assume value truthy
        return state.handleNpcEvents(e);
      }

      switch (e.key) {
        case "controls-start":
          w.menu.setPreventDraggable(true);
          w.cm.draggable.el.style.pointerEvents = 'none';
          break;
        case "controls-end":
          w.menu.setPreventDraggable(false);
          w.cm.draggable.el.style.pointerEvents = 'auto';
          break;
        case "updated-gm-decor":
          // NOOP e.g. physics.worker rebuilds entire world onchange geomorphs
          break;
        case "long-pointerdown": { // toggle ContextMenu
          const { lastDown } = w.view;
          if (lastDown?.meta === undefined) {
            return; // should be unreachable
          }
          for (const preventer of Object.values(state.pressMenuPrevent)) {
            if (preventer(lastDown.meta)) {
              return; // prevent ContextMenu
            }
          }
          if (w.view.isPointerEventDrag(e) === true) {
            return;
          }
          state.showContextMenu();
          break;
        }
        case "nav-updated": {
          // 🚧 clear state.doorToOffMesh
          break;
        }
        case "pointerdown":
          w.cm.hide(true); // unless pinned
          break;
        case "pointerup":
          !e.touch && state.onPointerUpMenuDesktop(e);
          w.view.handlePausedClick(e.screenPoint); // step world whilst paused
          break;
        case "pre-request-nav": {
          // ℹ️ (re)compute npcToRoom and roomToNpcs
          // ℹ️ dev should handle partial correctness e.g. by pausing

          w.menu.measure('pre-request-nav');
          const prevRoomToNpcs = state.roomToNpcs;
          const prevExternalNpcs = state.externalNpcs;
          state.roomToNpcs = w.gms.map((_, gmId) => 
            e.changedGmIds[gmId] === false ? prevRoomToNpcs[gmId] : []
          );
          state.externalNpcs = new Set();

          for (const [gmId, byRoom] of prevRoomToNpcs.entries()) {
            if (e.changedGmIds[gmId] === false) {
              continue;
            } // else `true` (changed) or `undefined` (gmId no longer exists)
            
            // We'll recompute every npc previously in this gmId
            const npcs = Object.values(byRoom).flatMap(npcKeys =>
              Array.from(npcKeys).map(npcKey => w.n[npcKey])
            );

            for (const [i, npc] of npcs.entries()) {
              if (i > 0 && i % 5 === 0) await pause(); // batching
              state.tryPutNpcIntoRoom(npc);
            }
          }

          // try fix previous external npcs
          for (const npcKey of prevExternalNpcs) {
            const npc = w.n[npcKey];
            state.tryPutNpcIntoRoom(npc);
          }
          w.menu.measure('pre-request-nav');
          break;
        }
        case "pre-setup-physics":
          // ℹ️ dev should handle partial correctness e.g. by pausing
          state.doorToNearbyNpcs = {};
          state.doorToOffMesh = {};
          state.npcToDoors = {};
          break;
        case "removed-npcs": {
          w.physics.worker.postMessage({
            type: 'remove-bodies',
            bodyKeys: e.npcKeys.map(npcToBodyKey),
          });

          state.removeFromSensors(...e.npcKeys);

          for (const npcKey of e.npcKeys) {
            const gmRoomId = state.npcToRoom.get(npcKey);
            if (gmRoomId !== undefined) {
              state.npcToRoom.delete(npcKey);
              state.roomToNpcs[gmRoomId.gmId][gmRoomId.roomId].delete(npcKey);
            } else {
              state.externalNpcs.delete(npcKey);
            }
  
            // npc might have been inside a doorway
            const gdKey = state.npcToDoors[npcKey]?.inside;
            if (typeof gdKey === 'string') {
              state.npcToDoors[npcKey].inside = null;
              state.doorToOffMesh[gdKey] = (state.doorToOffMesh[gdKey] ?? []).filter(
                x => x.npcKey !== npcKey
              );
            }
  
            w.bubble.delete(npcKey);

            if (state.followedNpcKey === npcKey) {
              state.stopFollowing();
            }
          }

          w.update();
          break;
        }
        case "spawned-many": {
          // 🚧 compute gmRoomIds
          const workerNpcs = /** @type {WW.NpcDef[]} */ ([]);
          for (const npcKey of e.npcKeys) {
            const npc = w.n[npcKey];
            if (npc.spawns === 1) {// 1st spawn
              const { x, y, z } = npc.position;
              workerNpcs.push({ npcKey, position: { x, y, z } });
              npc.setLabel(npcKey);
            }
          }
          break;
        }
        case "try-close-door":
          state.tryCloseDoor(e.gmId, e.doorId, e.meta);
          break;
        case "locked-door":
          if (e.meta.hull === true) {// sync other door
            const adj = w.gmGraph.getAdjacentRoomCtxt(e.gmId, e.doorId);
            adj?.adjGdKey && state.toggleLock(adj.adjGdKey, { lock: true, access: true });
          }
          break;
        case "unlocked-door":
          if (e.meta.hull === true) {// sync other door
            const adj = w.gmGraph.getAdjacentRoomCtxt(e.gmId, e.doorId);
            adj?.adjGdKey && state.toggleLock(adj.adjGdKey, { unlock: true, access: true });
          }
          break;
      }
    },
    handleNpcEvents(e) {
      const npc = w.n[e.npcKey];

      switch (e.key) {
        case "clear-off-mesh":
          state.clearOffMesh(npc);
          break;
        case "enter-collider":
          if (e.type === 'nearby') {
            state.onEnterDoorCollider(e);
          }
          break;
        case "exit-collider":
          if (e.type === 'nearby') {
            state.onExitDoorCollider(e);
          }
          break;
        case "try-off-mesh": // enter init segment
          npc.slowBegin = null;
          state.onTryOffMeshConnection(e, npc);
          break;
        case "enter-off-mesh-main": // enter main segment
          state.onEnterOffMeshConnectionMain(e, npc);
          break;
        case "exit-off-mesh": // exit main segment
          state.onExitOffMeshConnection(e, npc);
          break;
        case "enter-door": {
          // 🔔 enter room as soon as enter door, so
          // technically `npc.point` needn't be inside room/geomorph polygon
          const { npcKey, src, dst } = e;
          state.roomToNpcs[src.gmId][src.roomId]?.delete(e.npcKey);
          state.npcToRoom.set(npcKey, {...dst});
          (state.roomToNpcs[dst.gmId][dst.roomId] ??= new Set()).add(npcKey);
          break;
        }
        case "exit-door": {
          break;
        }
        case "fade-npc":
          if (w.cm.tracked !== undefined && w.cm.tracked.npcKey === npc.key) {
            w.cm.setNonDockedOpacity(e.opacityDst);
          }
          const bubble = w.bubble.byKey[npc.key];
          bubble?.setOpacity(e.opacityDst);
          break;
        case "spawned": {
          if (npc.spawns === 1) {// 1st spawn
            const { x, y, z } = npc.position;
            w.physics.worker.postMessage({
              type: 'add-npcs',
              npcs: [{ npcKey: e.npcKey, position: { x, y, z } }],
            });
            npc.setLabel(e.npcKey);
          } else {// Respawn
            const prevGrId = state.npcToRoom.get(npc.key);
            if (prevGrId !== undefined) {
              state.roomToNpcs[prevGrId.gmId][prevGrId.roomId]?.delete(npc.key);
            }
          }

          state.npcToRoom.set(npc.key, {...e.gmRoomId});
          (state.roomToNpcs[e.gmRoomId.gmId][e.gmRoomId.roomId] ??= new Set()).add(e.npcKey);

          if (w.disabled === true) {
            // 🔔 must tick to change initial pose e.g. when spawn lie
            w.npc.tickOnceSpawn();
          }
          break;
        }
        case "speech":
          if (e.speech !== '') {
            w.menu.say(e.npcKey, e.speech);
          }
          if (w.disabled === true) {
            w.npc.tickOnceDebug();
          }
          break;
        case "started-moving": {
          // 🔔 avoid initially incorrect offMeshConnection traversal, by
          // replanning immediately before 1st updateRequestMoveTarget.
          const agent = /** @type {NPC.CrowdAgent} */ (npc.agent);
          agent.raw.set_targetReplan(true);

          if (e.showNavPath === true) {
            const path3d = w.npc.findPath(npc.point, /** @type {Geom.Vect} */ (npc.target));
            w.debug.setNavPath(path3d ?? []);
          }

          break;
        }
        case "stopped-moving": {
          break;
        }
      }
    },
    improveOffMeshSrcDst(npc, offMesh) {
      const door = w.d[offMesh.gdKey];
      const npcPoint = npc.point;
      const nextCorner = npc.getCornerAfterOffMesh(offMesh);

      // Entrances are aligned to offMeshConnections
      // - entrance segment (en), exit segment (ex)
      // - they border the connector joining the rooms.
      let en = door.entrances[offMesh.aligned === true ? 0 : 1];
      const ex = door.entrances[offMesh.aligned === true ? 1 : 0];

      // Compute agent segment i.e. npcPoint --> nextCorner
      // - extend in both directions so intersects with entrance/exit segment
      // - offMeshConnections are slightly away from doorway 
      const agSrc = {
        x: npcPoint.x - (nextCorner.x - npcPoint.x),
        y: npcPoint.y - (nextCorner.y - npcPoint.y),
      };
      const agDst = {
        x: nextCorner.x + (nextCorner.x - npcPoint.x),
        y: nextCorner.y + (nextCorner.y - npcPoint.y),
      };

      const enLambda = geom.getClosestOnSegToSeg(en.src, en.dst, agSrc, agDst);
      let newSrc = {
        x: en.src.x + enLambda * (en.dst.x - en.src.x),
        y: en.src.y + enLambda * (en.dst.y - en.src.y),
      };
      /** @type {Geom.VectJson} */
      let newDst;

      // if newSrc --> corner intersects exit segment, use it (avoid turn)
      const exIota = geom.getLineSegsIntersection(ex.src, ex.dst, newSrc, nextCorner);
      
      if (exIota === null) {
        const exLambda = geom.getClosestOnSegToSeg(ex.src, ex.dst, agSrc, agDst);
        newDst = { 
          x: ex.src.x + exLambda * (ex.dst.x - ex.src.x),
          y: ex.src.y + exLambda * (ex.dst.y - ex.src.y),
        };
        
        if (exLambda === 0 || exLambda === 1) {// if "turning around corner"
          // if npcPoint --> newDst intersects entrance segment, use it (avoid turn)
          const enIota = geom.getLineSegsIntersection(en.src, en.dst, npcPoint, newDst);
          if (enIota !== null) {
            newSrc = { 
              x: en.src.x + enIota * (en.dst.x - en.src.x),
              y: en.src.y + enIota * (en.dst.y - en.src.y),
            };
          }
        }
      } else {
        newDst = { 
          x: ex.src.x + exIota * (ex.dst.x - ex.src.x),
          y: ex.src.y + exIota * (ex.dst.y - ex.src.y),
        };
      }

      // 🔔 move towards npc to ensure on navmesh (else jerk @60fps)
      const delta = tmpVect1.copy(newSrc).sub(npc.point);
      const deltaLen = delta.length;
      if (deltaLen > 0.2) {
        newSrc.x -= delta.x * (0.2 / deltaLen);
        newSrc.y -= delta.y * (0.2 / deltaLen);
      }

      // we slow down if final target is close to doorway exit,
      // in which case, we exit further away to avoid blocking the door
      const slowDown = (
        npc.lastTarget.distanceTo(newDst) < 0.4
        && npc.pendingTargets.length === 0
      );

      if (slowDown === true) {
        const sign = offMesh.aligned === true ? -1 : 1;
        const farDelta = door.farDeltas[offMesh.aligned === true ? 1 : 0];
        newDst.x += sign * farDelta.x;
        newDst.y += sign * farDelta.y;
      }

      return {
        src: newSrc,
        dst: newDst,
        nextCorner,
        slowDown,
      };
    },
    isFollowingNpc(npcKey) {
      const npc = w.n[npcKey];
      return npc !== undefined && w.view.dst.look === npc.m.group;
    },
    async lookAt(input, lookAtOpts = { maxDistance: 5 }) {
      if (typeof input === 'string') {
        const npcKey = input;
        // 🚧 look is independent of follow and overrides it
        if (w.e.isFollowingNpc(npcKey)) return;
        input = w.n[npcKey].position;
        lookAtOpts.height = helper.defaults.height;
      }
      w.e.stopFollowing();
      await w.view.lookAt(toV3(input), lookAtOpts);
    },
    npcCanAccess(npcKey, gdKey) {
      if (state.doorToAccess[gdKey]?.size) {// check special access
        for (const regexDef of state.doorToAccess[gdKey]) {
          if (state.npcToAccess[npcKey]?.has(regexDef)) {
            return true;
          }
        }
      } else {// check standard access
        for (const regexDef of state.npcToAccess[npcKey] ?? []) {
          if ((regexCache[regexDef] ??= new RegExp(regexDef)).test(gdKey)) {
            return true;
          }
        }
      }
      return false;
    },
    onBlockedDoorway(npc, otherNpcKey) {
      npc.stopMoving({ type: 'stop-reason', key: 'blocked-doorway', otherNpcKey, rest: npc.getRemainingPath() });
      // teleport to prevent ongoing offMesh traversal
      const agent = /** @type {NPC.CrowdAgent} */ (npc.agent);
      agent.teleport(npc.position); 
      agent.requestMoveTarget(npc.position);
    },
    onEnterDoorCollider(e) {// e.type === 'nearby'
      (state.npcToDoors[e.npcKey] ??= { nearby: new Set(), inside: null }).nearby.add(e.gdKey);
      (state.doorToNearbyNpcs[e.gdKey] ??= new Set()).add(e.npcKey);
      
      const door = w.d[e.gdKey];
      if (door.open === true) {
        return; // door already open
      }

      if (door.auto === true && door.locked === false) {
        // only auto-open doors which are auto and unlocked
        state.toggleDoor(e.gdKey, { open: true, npcKey: e.npcKey });
        return;
      }
    },
    onEnterOffMeshConnectionMain(e, npc) {// maybe cancel
      const offMesh = /** @type {NPC.OffMeshState} */ (npc.offMesh);

      for (const tr of state.doorToOffMesh[offMesh.orig.gdKey] ?? []) {
        if (
          tr.npcKey === e.npcKey
          || tr.seg === 0
          || state.testOffMeshDisjoint(offMesh, tr.src, tr.dst) === true
        ) {
          continue;
        }

        const other = w.n[tr.npcKey];

        // 🔔 slow down when another in doorway,
        // avoids jerk when other slows down in doorway
        // 🚧 speed up when all others leave?
        npc.agentAnim?.set_tScale(0.5);
        offMesh.tScale = 0.5;
        offMesh.tScaleDst = null;

        if (// traversal same direction, other far enough ahead
          tr.orig.srcGrKey === offMesh.orig.srcGrKey
          // - prevent jerk other on leave connection
          // && tr.tScaleDst === null
          // - prevent moving thru each other diagonally
          // - prevent jerk other on leave connection
          && npc.getOtherDoorwayLead(other) >= 0.3
        ) {
          continue;
        }

        state.onBlockedDoorway(npc, tr.npcKey); // STOP

        // 🔔 Wrap to fix bizarre TurboPack error i.e.
        // helper not defined after loop
        if (true) {
          return;
        }
      }

      if (offMesh.orig.dstRoomMeta.small === true) {// small room
        const { gmId, roomId } = helper.getGmRoomId(offMesh.orig.dstGrKey);

        for (const otherNpcKey of state.roomToNpcs[gmId][roomId] ?? []) {
          const { point } = w.n[otherNpcKey];
          if (
            Math.abs(point.x - offMesh.dst.x) < 0.25
            && Math.abs(point.y - offMesh.dst.y) < 0.25
          ) {
            return state.onBlockedDoorway(npc, otherNpcKey); // STOP
          }
        }
      }

      w.events.next({
        key: 'enter-door', npcKey: e.npcKey, ...helper.getGmDoorId(offMesh.orig.gdKey),
        src: helper.getGmRoomId(offMesh.orig.srcGrKey),
        dst: helper.getGmRoomId(offMesh.orig.dstGrKey),
      });
    },
    onExitDoorCollider(e) {// e.type === 'nearby'
      const door = w.door.byKey[e.gdKey];

      state.npcToDoors[e.npcKey].nearby.delete(e.gdKey);
      const closeNpcs = state.doorToNearbyNpcs[e.gdKey];
      closeNpcs.delete(e.npcKey);

      // ℹ️ try close door under conditions
      if (door.open === true) {
        return;
      } else if (door.locked === true) {
        state.tryCloseDoor(door.gmId, door.doorId)
      } else if (door.auto === true && closeNpcs.size === 0) {
        // if auto and none nearby, try close 
        state.tryCloseDoor(door.gmId, door.doorId);
      }
    },
    onExitOffMeshConnection(e, npc) {
      state.clearOffMesh(npc);
      
      if (npc.agent === null || npc.target === null) {
        // e.g. npc without access near door
        // e.g. npc collided near door
        return; 
      }

      const offMesh = e.offMesh;

      if (
        offMesh.nextUnit === null // target too close to offMesh.dst
        && npc.pendingTargets.length === 0 // no other targets
        && offMesh.tScaleDst !== 1 // not speeding up after changing target
      ) {
        npc.stopMoving({ type: 'stop-reason', key: 'arrived' });
      }

      w.events.next({
        key: 'exit-door', npcKey: e.npcKey, ...helper.getGmDoorId(offMesh.orig.gdKey),
        src: helper.getGmRoomId(offMesh.orig.srcGrKey),
        dst: helper.getGmRoomId(offMesh.orig.dstGrKey),
      });
    },
    onPointerUpMenuDesktop(e) {
      if (e.rmb && e.distancePx <= 5) {
        state.showContextMenu();
      }
    },
    onTryOffMeshConnection(e, npc) {
      const { offMesh } = e;
      const door = w.d[offMesh.gdKey];
      
      if (// cancel if cannot open door
        door.open === false &&
        state.toggleDoor(offMesh.gdKey, { open: true, npcKey: e.npcKey }) === false
      ) {
        npc.stopMoving({ type: 'stop-reason', key: 'locked-door', rest: npc.getRemainingPath() });
        npc.lookAngleDst = npc.getLookAngle(offMesh.dst);
        return;
      }

      npc.setRun(false); // do not run through doorways

      // improve offMesh by aligning src/dst to agent
      // 🔔 do not reuse from earlier else yank when other blocks
      const improved = state.improveOffMeshSrcDst(npc, offMesh);
      const target = /** @type {Geom.Vect} */ (npc.target);
      const entryDist = npc.point.distanceTo(improved.src);

      // if too small (0.2) can jerk when replan near door (replan avoids bad paths after door)
      // if too large the agent is less flexible near door because already entered offMesh
      if (entryDist > 0.5) {// entry too far
        const newTarget = improved.src;
        npc.adjustTargets(newTarget, target, ...npc.pendingTargets);
        npc.exitOffMeshFor(newTarget);
        return;
      }
      
      if (// too close with angle too large
        entryDist < 0.2 && (Math.abs(npc.getAngleTo(improved.dst)) > Math.PI/2 + 0.2)
      ) {
        const newTarget = null;
        npc.adjustTargets(newTarget, target, ...npc.pendingTargets);
        npc.exitOffMeshFor(npc.position, false);
        // npc.startAnimation('Idle');
        npc.lookSecs = 0.18;
        npc.lookAngleDst = npc.getLookAngle(improved.dst);
        return;
      }

      const blockingNpcKey = (
        state.findOtherBlockingOppositeDir(offMesh, improved.src, improved.dst)
        || state.findOtherBlockingNearDoor(npc, offMesh)
      );

      if (typeof blockingNpcKey === 'string') {
        const lookAngleDst = npc.getLookAngle(improved.src);
        npc.stopMoving({
          type: 'stop-reason', key: 'blocked-doorway', otherNpcKey: blockingNpcKey, rest: npc.getRemainingPath()
        }, lookAngleDst);
        return;
      }

      // 🔔 enter agent-aligned dtCrowdAgentAnimation
      state.applyImprovedOffMesh(npc, improved);

      /**
       * `nextUnit` is desired direction after offMeshConnection.
       * - It should be `null` iff we intend to slow down to stop inside doorway.
       * - We also want to avoid flicker when target is just round corner of a doorway.
       */
      const nextUnitNull = improved.slowDown;

      // register improved traversal
      npc.offMesh = {
        npcKey: e.npcKey,
        orig: offMesh,
        seg: 0,
        src: improved.src,
        dst: improved.dst,

        initPos: npc.point.json,
        initUnit: tmpVect1.set(improved.src.x - npc.point.x, improved.src.y - npc.point.y ).normalize().json,
        mainUnit: tmpVect1.set(improved.dst.x - improved.src.x, improved.dst.y - improved.src.y).normalize().json,
        nextUnit: nextUnitNull === true ? null : tmpVect1.copy(improved.nextCorner).sub(improved.dst).normalize().json,
        tToDist: npc.getMaxSpeed(), // distSoFar / timeSoFar = npc.getMaxSpeed()
        
        tScale: 1, // 🔔 slow down in doorway if target near offMesh exit
        tScaleDst: nextUnitNull === true && npc.pendingTargets.length === 0 ? 0.25 : null,
        tScaleSmoothTime: 0.3,
      };
      (state.doorToOffMesh[offMesh.gdKey] ??= []).push(npc.offMesh);
      (state.npcToDoors[e.npcKey] ??= { inside: null, nearby: new Set() }).inside = offMesh.gdKey;

      // force open door (open longer)
      w.door.toggleDoorRaw(door, { open: true, access: true });

      if (door.hull === true) {// sync other door
        const adj = w.gmGraph.getAdjacentRoomCtxt(door.gmId, door.doorId);
        adj !== null && w.e.toggleDoor(adj.adjGdKey, { open: true, access: true });
      }

      w.events.next({ key: 'enter-off-mesh', npcKey: npc.key, offMesh: npc.offMesh });
    },
    removeBubble(...npcKeys) {
      w.bubble.delete(...npcKeys);
    },
    removeFromSensors(...npcKeys) {
      for (const npcKey of npcKeys) {
        const closeDoors = state.npcToDoors[npcKey];
        for (const gdKey of closeDoors?.nearby ?? []) {// npc may never have been close to any door
          const door = w.door.byKey[gdKey];
          state.onExitDoorCollider({ key: 'exit-collider', type: 'nearby', gdKey, gmId: door.gmId, doorId: door.doorId, npcKey });
        }
        state.npcToDoors[npcKey]?.nearby.clear();
      }
    },
    revokeAccess(regexDef, npcKey) {
      (state.npcToAccess[npcKey] ??= new Set()).delete(regexDef);
    },
    async say({ npcKey, words }) {
      if (typeof words !== 'string') {
        throw Error('opts.words must be a string');
      }

      if (words === '') {
        const bubble = w.bubble.byKey[npcKey];
        if (bubble === undefined) {
          // NOOP
        } else if (bubble.isThoughtBubbleEmpty() === false) {
          bubble.setSpeech(null);
        } else {
          state.removeBubble(npcKey);
        }
        return;
      }

      const bubble = w.bubble.ensure(npcKey);
      const speechWithLinks = (words ?? '').trim();
      const speechSansLinks = speechWithLinks.replace(globalLoggerLinksRegex, '$1');
      bubble.setSpeech(speechSansLinks || null);

      w.n[npcKey].showLabel(false);

      w.events.next({ key: 'speech', npcKey, speech: speechWithLinks });
    },
    showContextMenu() {
      const { lastDown } = w.view;
      if (lastDown === undefined) {
        return;
      } else if (typeof lastDown.meta.npcKey === 'string') {
        const { npcKey } = lastDown.meta;
        w.cm.setTracked(npcKey);
        w.debug.setPickIndicator();
        w.cm.setContext(lastDown);
        w.cm.show();
      } else {
        w.cm.setTracked();
        w.debug.setPickIndicator(lastDown);
        w.cm.setContext(lastDown);
        w.cm.show();
      }
    },
    someNpcNearDoor(gdKey) {
      return state.doorToNearbyNpcs[gdKey]?.size > 0;
    },
    stopFollowing() {
      const npcKey = state.followedNpcKey;
      if (npcKey === null) return;
      state.followedNpcKey = null;
      w.view.stopFollowing();
      w.events.next({ key: 'stopped-following', npcKey });
    },
    testOffMeshDisjoint(offMesh1, src, dst, radius = helper.defaults.radius * 0.8) {
      // 🚧 handle diagonal doors
      const rect1 = tmpRect1.setFromPoints(offMesh1.src, offMesh1.dst).outset(radius);
      const rect2 = tmpRect2.setFromPoints(src, dst).outset(radius);
      return rect1.intersects(rect2) === false;
    },
    toggleDoor(gdKey, opts = {}) {
      const door = w.door.byKey[gdKey];

      // clear if already closed and offMeshConnection free
      opts.clear = door.open === false || !(state.doorToOffMesh[gdKey]?.length > 0);

      opts.access ??= (
        opts.npcKey === undefined
        || (door.auto === true && door.locked === false)
        || state.npcCanAccess(opts.npcKey, gdKey)
      );

      return w.door.toggleDoorRaw(door, opts);
    },
    toggleLock(gdKey, opts = {}) {
      const door = w.door.byKey[gdKey];

      if (opts.point === undefined || opts.npcKey === undefined) {
        // e.g. game master i.e. no npc
        return w.door.toggleLockRaw(door, opts);
      }

      const npcPoint = w.n[opts.npcKey].point;
      if (npcPoint.distanceTo(opts.point) > 1.5) {
        return false; // e.g. button not close enough
      }

      opts.access ??= state.npcCanAccess(opts.npcKey, gdKey);

      return w.door.toggleLockRaw(door, opts);
    },
    tryCloseDoor(gmId, doorId, eventMeta) {
      const door = w.door.byGmId[gmId][doorId];
      w.door.cancelClose(door);
      door.closeTimeoutId = window.setTimeout(() => {
        if (w.disabled === true) {
          // do not close whilst paused; recheck in {ms}
          state.tryCloseDoor(gmId, doorId);
        } else if (door.open === true) {
          w.door.toggleDoorRaw(door, {
            clear: state.canCloseDoor(door) === true,
          });
          state.tryCloseDoor(gmId, doorId); // recheck in {ms}
        } else {// closed
          delete door.closeTimeoutId;
        }
      }, defaultDoorCloseMs);
    },
    tryPutNpcIntoRoom(npc) {
      const grId = w.npc.findRoomContaining(npc.point, true);
      if (grId !== null) {
        state.npcToRoom.set(npc.key, grId);
        state.externalNpcs.delete(npc.key);
        (state.roomToNpcs[grId.gmId][grId.roomId] ??= new Set()).add(npc.key);
      } else {// Erase stale info and warn
        state.npcToRoom.delete(npc.key);
        state.externalNpcs.add(npc.key);
        warn(`${npc.key}: no longer inside any room`);
      }
    },
  }));
  
  w.e = state; // e for 'events state'

  React.useEffect(() => {
    // 🔔 internal because it can synchronously invoke `w.events.next`
    const sub = w.events.subscribe({ next: state.handleEvents }, { internal: true });
    return () => {
      sub.unsubscribe();
    };
  }, []);
}

/**
 * @typedef State
 * @property {{ [gdKey: Geomorph.GmDoorKey]: Set<string> }} doorToAccess
 * - Relates `Geomorph.GmDoorKey` to access keys (`regexDef`) an npc must have.
 * - Use this to refine `npcToAccess` e.g. lock a toilet even when `npcToAccess[npcKey] = ['.']`.
 * @property {{ [gdKey: Geomorph.GmDoorKey]: Set<string> }} doorToNearbyNpcs
 * Relates `Geomorph.GmDoorKey` to nearby/inside `npcKey`s
 * @property {{ [gdKey: Geomorph.GmDoorKey]: NPC.OffMeshState[] }} doorToOffMesh
 * Mapping from doors to in-progress offMeshConnection traversals.
 * @property {Set<string>} externalNpcs
 * @property {null | string} followedNpcKey
 * `npcKey`s not inside any room
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Relates `npcKey` to strings defining RegExp's matching `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: { inside: null | Geomorph.GmDoorKey; nearby: Set<Geomorph.GmDoorKey> }}} npcToDoors
 * Relate `npcKey` to (a) doorway we're inside, (b) nearby `Geomorph.GmDoorKey`s
 * @property {Map<string, Geomorph.GmRoomId>} npcToRoom npcKey to gmRoomId
 * Relates `npcKey` to current room, unless in a doorway (offMeshConnection)
 * @property {{ [key: string]: (lastDownMeta: Meta) => boolean}} pressMenuPrevent
 * Prevent ContextMenu on long press if any of these return `true`.
 * @property {Record<Geomorph.GmRoomKey, Meta<{ label?: string }>>} roomMeta
 * @property {{[roomId: number]: Set<string>}[]} roomToNpcs
 * The "inverse" of npcToRoom i.e. `roomToNpc[gmId][roomId]` is a set of `npcKey`s
 *
 * @property {(npc: NPC.NPC, improved: NPC.ImprovedOffMeshSrcDst) => void} applyImprovedOffMesh
 * @property {(door: Geomorph.DoorState) => boolean} canCloseDoor
 * @property {(npc: NPC.NPC) => void} clearOffMesh
* @property {(input: NPC.GroundPoint) => null | Geomorph.DecorPoint} findDoPointUnder
* @property {(npc: NPC.NPC, offMesh: NPC.OffMeshLookupValue) => null | string} findOtherBlockingNearDoor
 * offMesh early-exit-test i.e. test for some other npc which:
 * - is idle and in the way
 * - is very close to main segment of offMesh connection
 * @property {(offMesh: NPC.OffMeshLookupValue, src: Geom.VectJson, dst: Geom.VectJson) => null | string} findOtherBlockingOppositeDir
 * @property {(npcKey: string, opts?: Pick<NPC.LookAtOpts, 'smoothTime' | 'maxDistance'>) => void} followNpc
 * Larger `smoothTime` takes longer to focus on npc
 * @property {(npcKey: string) => Geomorph.GmRoomKey | undefined} getGrKey
 * @property {(npcKey: string) => { room: null | Meta<{ label?: string }>  }} getNpcMeta
 * @property {(gmRoomIds: Geomorph.GmRoomId[], canAccess?: (opts: { gmId: number } & (
 *   | { type: 'door'; doorId: number }
 *   | { type: 'window'; windowId: number }
 * )) => boolean) => Graph.GmRoomsAdjData} getRoomIdsAdjData
 * @property {(regexDef: string, ...npcKeys: string[]) => void} grantAccess
 * @property {(e: NPC.Event) => void} handleEvents
 * @property {(e: Extract<NPC.Event, { npcKey?: string }>) => void} handleNpcEvents
 * @property {(npc: NPC.NPC, offMesh: NPC.OffMeshLookupValue) => NPC.ImprovedOffMeshSrcDst} improveOffMeshSrcDst
 * Compute improved offMeshConnection src/dst, leading to a more natural walking angle.
 * @property {(npcKey: string) => boolean} isFollowingNpc
 * @property {(input: string | THREE.Vector3 | Vect, lookAtOpts?: NPC.LookAtOpts) => Promise<void>} lookAt
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcCanAccess
 * @property {(npc: NPC.NPC, otherNpcKey: string) => void} onBlockedDoorway
 * @property {(e: Extract<NPC.Event, { key: 'enter-collider'; type: 'nearby' }>) => void} onEnterDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'enter-off-mesh-main' }>, npc: NPC.NPC) => void} onEnterOffMeshConnectionMain
 * @property {(e: Extract<NPC.Event, { key: 'exit-collider'; type: 'nearby' }>) => void} onExitDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'exit-off-mesh' }>, npc: NPC.NPC) => void} onExitOffMeshConnection
 * @property {(e: NPC.PointerUpEvent) => void} onPointerUpMenuDesktop
 * @property {(e: Extract<NPC.Event, { key: 'try-off-mesh' }>, npc: NPC.NPC) => void} onTryOffMeshConnection
 * @property {(...npcKeys: string[]) => void} removeBubble
 * Remove speech bubble(s) from npc(s)
 * @property {(...npcKeys: string[]) => void} removeFromSensors
 * @property {(regexDef: string, npcKey: string) => void} revokeAccess
 * @property {(opts: { npcKey: string, words?: string }) => Promise<void>} say
 * @property {() => void} showContextMenu
 * Default context menu, unless clicked on an npc
 * @property {(gdKey: Geomorph.GmDoorKey) => boolean} someNpcNearDoor
 * @property {() => void} stopFollowing
 * @property {(offMesh: NPC.OffMeshState, src: Geom.VectJson, dst: Geom.VectJson, radius?: number) => boolean} testOffMeshDisjoint
 * Are these disjoint?
 * - main `offMesh` segment outset by `radius`
 * - (`src`, `dst`) outset by `radius`
 * @property {(gdKey: Geomorph.GmDoorKey, opts?: { npcKey?: string; } & Geomorph.ToggleDoorOpts) => boolean} toggleDoor
 * Returns `true` iff successful.
 * @property {(gdKey: Geomorph.GmDoorKey, opts: { npcKey?: string; point?: Geom.VectJson; } & Geomorph.ToggleLockOpts) => boolean} toggleLock
 * Returns `true` iff successful.
 * @property {(gmId: number, doorId: number, eventMeta?: Meta) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {(npc: NPC.NPC) => void} tryPutNpcIntoRoom
 */

/** e.g. `'^g0'` -> `/^g0/` */
const regexCache = /** @type {Record<string, RegExp>} */ ({});
const tmpVect1 = new Vect();
const tmpRect1 = new Rect();
const tmpRect2 = new Rect();
