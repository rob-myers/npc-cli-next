import React from "react";
import * as THREE from "three";

import { Vect, Rect } from "../geom";
import { defaultDoorCloseMs, wallHeight } from "../service/const";
import { pause, warn, testNever, removeDups } from "../service/generic";
import { geom } from "../service/geom";
import { globalLoggerLinksRegex } from "../terminal/Logger";
import { npcToBodyKey } from "../service/rapier";
import { getTempInstanceMesh, toV3 } from "../service/three";
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
    npcToAccess: {},
    npcToDoors: {},
    npcToRoom: new Map(),
    pressMenuPrevent: {},
    roomToNpcs: [],

    applyImprovedOffMesh(npc, improved) {
      const npcPoint = npc.point;
      const { src: newSrc, dst: newDst } = improved;

      // 🤔 could use last known speed and speed up via tScale
      const speed = npc.api.getMaxSpeed();

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
      // const tmax = anim.tmid + (delta.length / speed);
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
      // 🔔 offMeshConnection can happen when `npc.s.offMesh === null`
      // e.g. npc without access near door
      npc.agentAnim?.set_active(false);
      npc.agentAnim?.set_tScale(1);

      if (npc.s.offMesh === null) {
        return;
      }

      const { orig, seg } = npc.s.offMesh;
      npc.s.offMesh = null;

      if (seg === 0) {// 🔔 throttle `move` to fix repeated offMesh attempts
        npc.s.offMeshCoolDown = Date.now() + 300;
      }
      
      state.doorToOffMesh[orig.gdKey] = state.doorToOffMesh[orig.gdKey].filter(x => x.npcKey !== npc.key);
      (state.npcToDoors[npc.key] ??= { inside: null, nearby: new Set() }).inside = null;
    },
    decodeObjectPick(r, g, b, a) {
      if (r === 1) {// wall
        const instanceId = (g << 8) + b;
        const decoded = w.wall.decodeInstanceId(instanceId);
        return {
          picked: 'wall',
          ...decoded,
          instanceId,
        };
      }

      if (r === 2) {// floor
        const instanceId = (g << 8) + b;
        return {
          picked: 'floor',
          gmId: instanceId,
          floor: true,
          instanceId,
        };
      }

      if (r === 3) {// ceiling
        const instanceId = (g << 8) + b;
        return {
          picked: 'ceiling',
          gmId: instanceId,
          ceiling: true,
          height: wallHeight,
          instanceId,
        };
      }

      if (r === 4) {// door
        const instanceId = (g << 8) + b;
        const decoded = w.door.decodeInstance(instanceId);
        return {
          picked: 'door',
          door: true,
          ...decoded,
          instanceId,
        };
      }

      if (r === 5) {// decor quad
        const instanceId = (g << 8) + b;
        const quad = w.decor.quads[instanceId];
        return {
          picked: 'quad',
          ...quad.meta,
          instanceId,
        };
      }

      if (r === 6) {// obstacle
        const instanceId = (g << 8) + b;
        const decoded = w.obs.decodeInstanceId(instanceId);
        return {
          picked: 'obstacle',
          obstacle: true,
          ...decoded,
          instanceId,
        };
      }

      if (r === 7) {// decor cuboid
        const instanceId = (g << 8) + b;
        const cuboid = w.decor.cuboids[instanceId];
        return {
          picked: 'cuboid',
          ...cuboid.meta,
          instanceId,
        };
      }

      if (r === 8) {// npc
        const npcUid = (g << 8) + b;
        const npcKey = w.npc.idToKey.get(npcUid);
        return {
          picked: 'npc',
          npcKey,
          npcUid,
          npc: true,
          instanceId: npcUid, // not really an instance
        };
      }

      if (r === 9) {// lock-light
        const instanceId = (g << 8) + b;
        const decoded = w.door.decodeInstance(instanceId);
        return {
          picked: 'lock-light',
          'lock-light': true,
          ...decoded,
          instanceId,
        };
      }

      // warn(`${'decodeObjectPick'}: failed to decode: ${JSON.stringify({ r, g, b, a })}`);
      return null;
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
          || other.s.target !== null // handled elsewhere (?)
        ) {
          continue;
        }

        const otherIntersectsMainSeg = geom.lineSegCoordsIntersectsCircle(
          offMesh.src.x + 0.1 * (offMesh.dst.x - offMesh.src.x), offMesh.src.z + 0.1 * (offMesh.dst.z - offMesh.src.z),
          offMesh.dst.x, offMesh.dst.z,
          other.point.x, other.point.y,
          0.25, // 🚧
        );
        
        if (otherIntersectsMainSeg === false) {
          // other is not close enough to offMesh connection
          continue;
        }
  
        const door = w.d[offMesh.gdKey];
        if (geom.lineSegCoordsIntersectsCircle(
          npc.point.x, npc.point.y,
          door.center.x, door.center.y,
          other.point.x, other.point.y,
          0.4,
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
    followNpc(npcKey) {
      const npc = w.n[npcKey];
      w.view.followPosition(npc.position, { height: helper.defaults.height });
    },
    getGrKey(npcKey) {
      return state.npcToRoom.get(npcKey)?.grKey;
    },
    getRaycastIntersection(e, decoded) {// 🚧 move to WorldView
      /** @type {THREE.Mesh} */
      let mesh;

      // handle fractional device pixel ratio e.g. 2.625 on Pixel
      const glPixelRatio = w.r3f.gl.getPixelRatio();
      const { left, top } = (/** @type {HTMLElement} */ (e.target)).getBoundingClientRect();

      const normalizedDeviceCoords = new THREE.Vector2(
        -1 + 2 * (((e.clientX - left) * glPixelRatio) / w.view.canvas.width),
        +1 - 2 * (((e.clientY - top) * glPixelRatio) / w.view.canvas.height),
      );
      w.view.raycaster.setFromCamera(normalizedDeviceCoords, w.r3f.camera);

      switch (decoded.picked) {
        case 'floor': mesh = getTempInstanceMesh(w.floor.inst, decoded.instanceId); break;
        case 'wall': mesh = getTempInstanceMesh(w.wall.inst, decoded.instanceId); break;
        case 'npc': mesh = w.n[decoded.npcKey].m.mesh; break;
        case 'door': mesh = getTempInstanceMesh(w.door.inst, decoded.instanceId); break;
        case 'quad': mesh = getTempInstanceMesh(w.decor.quadInst, decoded.instanceId); break;
        case 'obstacle': mesh = getTempInstanceMesh(w.obs.inst, decoded.instanceId); break;
        case 'ceiling': mesh = getTempInstanceMesh(w.ceil.inst, decoded.instanceId); break;
        case 'cuboid': mesh = getTempInstanceMesh(w.decor.cuboidInst, decoded.instanceId); break;
        case 'lock-light': mesh = getTempInstanceMesh(w.door.lockSigInst, decoded.instanceId); break;
        default: throw testNever(decoded.picked);
      }

      const [intersection] = w.view.raycaster.intersectObject(mesh);

      if (intersection !== undefined) {
        return { intersection, mesh }; // provide temp mesh
      } else {
        return null;
      }
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
          state.showDefaultContextMenu();
          break;
        }
        case "nav-updated": {
          // const excludeDoorsFilter = w.crowd.getFilter(helper.queryFilterType.excludeDoors);
          // excludeDoorsFilter.includeFlags = 2 ** 1; // walkable only, not unwalkable
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
          }

          w.update();
          break;
        }
        case "spawned-many": {
          // 🚧 compute gmRoomIds
          const workerNpcs = /** @type {WW.NpcDef[]} */ ([]);
          for (const npcKey of e.npcKeys) {
            const npc = w.n[npcKey];
            if (npc.s.spawns === 1) {// 1st spawn
              const { x, y, z } = npc.position;
              workerNpcs.push({ npcKey, position: { x, y, z } });
              npc.api.setLabel(npcKey);
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
        case "enter-off-mesh": // enter init segment
          npc.s.slowBegin = null;
          state.onEnterOffMeshConnection(e, npc);
          break;
        case "enter-off-mesh-main": // enter main segment
          state.onEnterOffMeshConnectionMain(e, npc);
          break;
        case "exit-off-mesh": // exit main segment
          state.onExitOffMeshConnection(e, npc);
          break;
        case "enter-room": {
          const { npcKey, gmId, roomId, grKey } = e;
          state.npcToRoom.set(npcKey, { gmId, roomId, grKey });
          (state.roomToNpcs[gmId][roomId] ??= new Set()).add(npcKey);
          break;
        }
        case "exit-room": {
          state.npcToRoom.delete(e.npcKey);
          state.roomToNpcs[e.gmId][e.roomId]?.delete(e.npcKey);
          break;
        }
        case "fade-npc":
          if (w.cm.tracked !== undefined && w.cm.tracked.npcKey === npc.key) {
            w.cm.setNonDockedOpacity(e.opacityDst);
          }
          w.bubble.lookup[npc.key]?.setOpacity(e.opacityDst);
          break;
        case "spawned": {
          if (npc.s.spawns === 1) {// 1st spawn
            const { x, y, z } = npc.position;
            w.physics.worker.postMessage({
              type: 'add-npcs',
              npcs: [{ npcKey: e.npcKey, position: { x, y, z } }],
            });
            npc.api.setLabel(e.npcKey);
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
          /**
           * 🔔 avoid initial incorrect offMeshConnection traversal, by
           *   replanning immediately before 1st updateRequestMoveTarget.
           * 🚧 better fix e.g. inside Recast-Detour
           */
          const agent = /** @type {NPC.CrowdAgent} */ (npc.agent);
          agent.raw.set_targetReplan(true);

          if (e.showNavPath === true) {
            const path3d = w.npc.findPath(npc.point, /** @type {Geom.Vect} */ (npc.s.target));
            w.debug.setNavPath(path3d ?? []);
          }
          break;
        }
        case "stopped-moving": {
          if (state.npcToDoors[e.npcKey]?.nearby.size > 0) {
            // 🔔 try mitigate jerk onenter offMesh at maxSpeed
            const npc = w.n[e.npcKey];
            npc.agent?.raw.params.set_separationWeight(0.5);
          }
          break;
        }
      }
    },
    improveOffMeshSrcDst(npc, offMesh) {
      const door = w.d[offMesh.gdKey];
      const npcPoint = npc.point;
      const nextCorner = npc.api.getCornerAfterOffMesh(offMesh);

      // Entrances are aligned to offMeshConnections
      // - entrance segment (enSrc, enDst)
      // - exit segment (exSrc, exDst)
      // They border the connector joining the rooms.
      const { src: enSrc, dst: enDst } = door.entrances[offMesh.aligned === true ? 0 : 1];
      const { src: exSrc, dst: exDst } = door.entrances[offMesh.aligned === true ? 1 : 0];

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

      const enLambda = geom.getClosestOnSegToSeg(enSrc, enDst, agSrc, agDst);
      let newSrc = {
        x: enSrc.x + enLambda * (enDst.x - enSrc.x),
        y: enSrc.y + enLambda * (enDst.y - enSrc.y),
      };
      /** @type {Geom.VectJson} */
      let newDst;

      // if newSrc --> corner intersects exit segment, use it (avoid turn)
      const exIota = geom.getLineSegsIntersection(exSrc, exDst, newSrc, nextCorner);
      
      if (exIota === null) {
        const exLambda = geom.getClosestOnSegToSeg(exSrc, exDst, agSrc, agDst);
        newDst = { 
          x: exSrc.x + exLambda * (exDst.x - exSrc.x),
          y: exSrc.y + exLambda * (exDst.y - exSrc.y),
        };
        
        if (exLambda === 0 || exLambda === 1) {// if "turning around corner"
          // if npcPoint --> newDst intersects entrance segment, use it (avoid turn)
          const enIota = geom.getLineSegsIntersection(enSrc, enDst, npcPoint, newDst);
          if (enIota !== null) {
            newSrc = { 
              x: enSrc.x + enIota * (enDst.x - enSrc.x),
              y: enSrc.y + enIota * (enDst.y - enSrc.y),
            };
          }
        }
      } else {
        newDst = { 
          x: exSrc.x + exIota * (exDst.x - exSrc.x),
          y: exSrc.y + exIota * (exDst.y - exSrc.y),
        };
      }

      // 🚧 issue with `slowDown` caching in npc.s.offMeshImprove
      
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
      return npc !== undefined && w.view.dst.look === npc.position;
    },
    async lookAt(input, lookAtOpts = {}) {
      if (typeof input === 'string') {// npcKey
        input = w.n[input].position;
        lookAtOpts.height = helper.defaults.height;
      }
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
      npc.api.stopMoving({ type: 'stop-reason', key: 'blocked-doorway', otherNpcKey, rest: npc.api.getRemainingPath() });
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
    onEnterOffMeshConnection(e, npc) {
      const { offMesh } = e;
      const door = w.d[offMesh.gdKey];
      
      // cancel if cannot open door
      if (
        door.open === false &&
        state.toggleDoor(offMesh.gdKey, { open: true, npcKey: e.npcKey }) === false
      ) {
        npc.api.stopMoving({ type: 'stop-reason', key: 'locked-door', rest: npc.api.getRemainingPath() });
        npc.s.lookAngleDst = npc.api.getLookAngle(offMesh.dst);
        return;
      }

      // improve offMesh by aligning src/dst to agent
      // 🔔 do not reuse from earlier else yank when other blocks
      const improved = state.improveOffMeshSrcDst(npc, offMesh);
      const target = /** @type {Geom.Vect} */ (npc.s.target);

      const entryDist = npc.point.distanceTo(improved.src);
      const entryTooFar = entryDist > 0.2;
      const angleTooLarge = Math.abs(npc.api.getAngleTo(improved.dst)) > Math.PI/2 + 0.2;

      if (
        entryTooFar === true
        || angleTooLarge === true
      ) {

        let newTarget = /** @type {null | Geom.VectJson} */ (null);
        let pendingTargets = /** @type {Geom.VectJson[]} */ ([]);

        if (entryTooFar === true) {
          if (angleTooLarge === true) {
            newTarget = null; // turn on spot
            pendingTargets = [improved.src, target, ...npc.pendingTargets];
          } else {
            newTarget = improved.src;
            pendingTargets = [target, ...npc.pendingTargets];
          }
        } else {// only angleTooLarge true (we're close to entry)
          newTarget = null;
          pendingTargets = [target, ...npc.pendingTargets];
        }

        npc.api.adjustTargets(newTarget, ...pendingTargets);

        if (newTarget !== null) {
          npc.api.exitOffMeshFor(newTarget);
        } else {
          npc.api.exitOffMeshFor(npc.position, false);
          npc.s.lookSecs = 0.2;
          npc.s.lookAngleDst = npc.api.getLookAngle(
            entryTooFar === true ? improved.src : improved.dst
          );
        }

        return;
      }

      const blockingNpcKey = (
        // prevent pass-through other around door corner
        state.findOtherBlockingNearDoor(npc, offMesh)
        // avoid yank via early-exit
        || state.findOtherBlockingOppositeDir(offMesh, improved.src, improved.dst)
      );

      if (blockingNpcKey !== null) {
        const lookAngleDst = npc.api.getLookAngle(improved.src);
        npc.api.stopMoving({
          type: 'stop-reason', key: 'blocked-doorway', otherNpcKey: blockingNpcKey, rest: npc.api.getRemainingPath()
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
      npc.s.offMesh = {
        npcKey: e.npcKey,
        orig: offMesh,
        seg: 0,
        src: improved.src,
        dst: improved.dst,

        initPos: npc.point.json,
        initUnit: tmpVect1.set(improved.src.x - npc.point.x, improved.src.y - npc.point.y ).normalize().json,
        mainUnit: tmpVect1.set(improved.dst.x - improved.src.x, improved.dst.y - improved.src.y).normalize().json,
        nextUnit: nextUnitNull === true ? null : tmpVect1.copy(improved.nextCorner).sub(improved.dst).normalize().json,
        tToDist: npc.api.getMaxSpeed(), // distSoFar / timeSoFar = npc.getMaxSpeed()

        // 🚧 clean
        tScale: 1,
        tScaleDst: nextUnitNull === true && npc.pendingTargets.length === 0
          ? door.hull === true ? 0.25 : 0.1
          : null,
        tScaleSmoothTime: 0.5,
      };
      (state.doorToOffMesh[offMesh.gdKey] ??= []).push(npc.s.offMesh);
      (state.npcToDoors[e.npcKey] ??= { inside: null, nearby: new Set() }).inside = offMesh.gdKey;

      // force open door (open longer)
      w.door.toggleDoorRaw(door, { open: true, access: true });

      if (door.hull === true) {// sync other door
        const adj = w.gmGraph.getAdjacentRoomCtxt(door.gmId, door.doorId);
        adj !== null && w.e.toggleDoor(adj.adjGdKey, { open: true, access: true });
      }
    },
    onEnterOffMeshConnectionMain(e, npc) {// maybe cancel
      const offMesh = /** @type {NPC.OffMeshState} */ (npc.s.offMesh);

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
          && npc.api.getOtherDoorwayLead(other) >= 0.3
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

      w.events.next({ key: 'exit-room', npcKey: e.npcKey, ...helper.getGmRoomId(offMesh.orig.srcGrKey) });
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
      const offMesh = /** @type {NPC.OffMeshState} */ (npc.s.offMesh);

      state.clearOffMesh(npc);
      
      if (npc.agent === null || npc.s.target === null) {
        // e.g. npc without access near door
        // e.g. npc collided near door
        return; 
      }

      if (
        offMesh.nextUnit === null // target too close to offMesh.dst
        && npc.pendingTargets.length === 0 // no other targets
        && offMesh.tScaleDst !== 1 // not speeding up after changing target
      ) {
        npc.api.stopMoving({ type: 'stop-reason', key: 'arrived' });
      } else if (e.offMesh.dstRoomMeta.small !== true) {
        if (npc.s.run === true) {
          npc.api.startAnimation('Run');
        }
      }

      w.events.next({ key: 'enter-room', npcKey: e.npcKey, ...helper.getGmRoomId(e.offMesh.dstGrKey) });
    },
    onPointerUpMenuDesktop(e) {
      if (e.rmb && e.distancePx <= 5) {
        state.showDefaultContextMenu();
      }
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
    say({ npcKey, words}) {// ensure/change/delete
      if (typeof words !== 'string') {
        throw Error('opts.words must be a string');
      }

      const cm = w.bubble.get(npcKey) || w.bubble.create(npcKey);
      const speechWithLinks = words ?? '';
      const speechSansLinks = speechWithLinks.replace(globalLoggerLinksRegex, '$1');

      /** Otherwise, stop saying */
      const startSaying = speechWithLinks !== '';
      
      const npc = w.n[npcKey];
      npc.api.showLabel(!startSaying);

      if (startSaying === true) {
        cm.speech = speechSansLinks;
        cm.update();
      } else {
        w.bubble.delete(npcKey);
      }

      w.events.next({ key: 'speech', npcKey, speech: speechWithLinks });
    },
    showDefaultContextMenu() {
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
 * `npcKey`s not inside any room
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Relates `npcKey` to strings defining RegExp's matching `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: { inside: null | Geomorph.GmDoorKey; nearby: Set<Geomorph.GmDoorKey> }}} npcToDoors
 * Relate `npcKey` to (a) doorway we're inside, (b) nearby `Geomorph.GmDoorKey`s
 * @property {Map<string, Geomorph.GmRoomId>} npcToRoom npcKey to gmRoomId
 * Relates `npcKey` to current room, unless in a doorway (offMeshConnection)
 * @property {{ [key: string]: (lastDownMeta: Meta) => boolean}} pressMenuPrevent
 * Prevent ContextMenu on long press if any of these return `true`.
 * @property {{[roomId: number]: Set<string>}[]} roomToNpcs
 * The "inverse" of npcToRoom i.e. `roomToNpc[gmId][roomId]` is a set of `npcKey`s
 *
 * @property {(npc: NPC.NPC, improved: NPC.ImprovedOffMeshSrcDst) => void} applyImprovedOffMesh
 * @property {(door: Geomorph.DoorState) => boolean} canCloseDoor
 * @property {(npc: NPC.NPC) => void} clearOffMesh
 * @property {(r: number, g: number, b: number, a: number) => null | NPC.DecodedObjectPick} decodeObjectPick
 * @property {(npc: NPC.NPC, offMesh: NPC.OffMeshLookupValue) => null | string} findOtherBlockingNearDoor
 * offMesh early-exit-test i.e. test for some other npc which:
 * - is idle and in the way
 * - is very close to main segment of offMesh connection
 * @property {(offMesh: NPC.OffMeshLookupValue, src: Geom.VectJson, dst: Geom.VectJson) => null | string} findOtherBlockingOppositeDir
 * @property {(npcKey: string) => void} followNpc
 * @property {(npcKey: string) => Geomorph.GmRoomKey | undefined} getGrKey
 * @property {(e: PointerEvent, decoded: NPC.DecodedObjectPick) => null | { intersection: THREE.Intersection; mesh: THREE.Mesh }} getRaycastIntersection
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
 * @property {(input: string | THREE.Vector3 | Vect, lookAtOpts?: import("./WorldView").LookAtOpts) => Promise<void>} lookAt
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} npcCanAccess
 * @property {(npc: NPC.NPC, otherNpcKey: string) => void} onBlockedDoorway
 * @property {(e: Extract<NPC.Event, { key: 'enter-collider'; type: 'nearby' }>) => void} onEnterDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'enter-off-mesh' }>, npc: NPC.NPC) => void} onEnterOffMeshConnection
 * @property {(e: Extract<NPC.Event, { key: 'enter-off-mesh-main' }>, npc: NPC.NPC) => void} onEnterOffMeshConnectionMain
 * @property {(e: Extract<NPC.Event, { key: 'exit-collider'; type: 'nearby' }>) => void} onExitDoorCollider
 * @property {(e: Extract<NPC.Event, { key: 'exit-off-mesh' }>, npc: NPC.NPC) => void} onExitOffMeshConnection
 * @property {(e: NPC.PointerUpEvent) => void} onPointerUpMenuDesktop
 * @property {(...npcKeys: string[]) => void} removeFromSensors
 * @property {(regexDef: string, npcKey: string) => void} revokeAccess
 * @property {(opts: { npcKey: string, words?: string }) => void} say
 * @property {() => void} showDefaultContextMenu
 * Default context menu, unless clicked on an npc
 * @property {(gdKey: Geomorph.GmDoorKey) => boolean} someNpcNearDoor
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
