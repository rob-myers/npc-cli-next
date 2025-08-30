import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { Poly } from "../geom/poly";
import { decorGridSize, decorIconRadius, fallbackDecorImgKey, gmLabelHeightSgu, instancedMeshName, precision, sguToWorldScale, spriteSheetDecorExtraScale, spriteSheetLabelExtraScale, wallHeight } from "../service/const";
import { isDevelopment, pause, removeDups, testNever, toPrecision, warn } from "../service/generic";
import { geom, tmpMat1, tmpRect1, tmpVec1 } from "../service/geom";
import { getCanvas } from "../service/dom";
import { geomorph } from "../service/geomorph";
import { addToDecorGrid, removeFromDecorGrid } from "../service/grid";
import { createLabelSpriteSheet, getBoxGeometry, getColor, getQuadGeometryXY, getQuadGeometryXZ, getRotAxisMatrix, setRotMatrixAboutPoint, tmpMatFour1 } from "../service/three";
import * as glsl from "../service/glsl";
import { helper } from "../service/helper";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/** @param {Props} props */
export default function Decor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    byKey: {},
    byGrid: [],
    byRoom: [],
    cuboidGeom: getBoxGeometry(`${w.key}-decor-cuboid`),
    cuboids: [],
    cuboidInst: /** @type {*} */ (null),
    group: {},
    invert: { cuboids: false },
    labels: [],
    labelInst: /** @type {*} */ (null),
    label: {
      count: 0,
      lookup: {},
      tex: new THREE.CanvasTexture(getCanvas(`${w.key}-decor-labels`)),
    },
    labelQuad: getQuadGeometryXY(`${w.key}-decor-labels-xy`, true),
    quads: [],
    quad: getQuadGeometryXZ(`${w.key}-decor-xz`),
    quadInst: /** @type {*} */ (null),
    queryStatus: 'pending',
    registeredAt: 0,
    rmKeys: new Set(),
    seenHash : /** @type {*} */ (null),
    labelsShown: false,

    addGm(gmId) {
      const gm = w.gms[gmId];
      state.register(gm.decor.map(d => state.instantiateDecor(d, gmId, gm))
        // Don't re-instantiate explicitly removed
        // .filter(d => !state.rmKeys.has(d.key) && (d.meta.roomId >= 0 ||
        .filter(d => (d.meta.roomId >= 0 ||
          warn(`decor "${d.key}" cannot be instantiated: not in any room`, d)
        )
      ), false);
    },
    addCuboidAttributes() {
      const instanceIds = state.cuboids.map((_, instanceId) => instanceId);
      state.cuboidGeom.deleteAttribute('instanceIds');
      state.cuboidGeom.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(instanceIds), 1),
      );
      const outlineShades = state.cuboids.map(({ meta }) => typeof meta.outline === 'number' ? meta.outline : 0.25);
      state.cuboidGeom.deleteAttribute('outlineShade');
      state.cuboidGeom.setAttribute('outlineShade',
        new THREE.InstancedBufferAttribute(new Float32Array(outlineShades), 1),
      );
    },
    addLabelUvs() {
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const { lookup: sheet, tex } = state.label;
      const { width: sheetWidth, height: sheetHeight } = /** @type {HTMLCanvasElement} */ (tex.image);

      for (const d of state.labels) {
        const { x, y, width, height } = sheet[d.meta.label];
        uvOffsets.push(x / sheetWidth, y / sheetHeight);
        uvDimensions.push(width / sheetWidth, height / sheetHeight);
      }

      state.labelQuad.deleteAttribute('uvOffsets');
      state.labelQuad.deleteAttribute('uvDimensions');
      state.labelQuad.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.labelQuad.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
    },
    addQuadUvs() {
      const { decor: sheet, maxDecorDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const uvTextureIds = /** @type {number[]} */ ([]);
      const instanceIds = /** @type {number[]} */ ([]);
      
      for (const [instanceId, d] of state.quads.entries()) {
        if (d.type === 'point') {
          const { x, y, width, height, sheetId } = sheet[
            helper.isDecorImgKey(d.meta.img) ? d.meta.img : fallbackDecorImgKey.point
          ];
          uvTextureIds.push(sheetId);

          uvOffsets.push(x / maxDecorDim.width, y / maxDecorDim.height);
          uvDimensions.push(width / maxDecorDim.width, height / maxDecorDim.height);
        } else {
          const { x, y, width, height, sheetId } = sheet[
            helper.isDecorImgKey(d.meta.img) ? d.meta.img : fallbackDecorImgKey.quad
          ];
          uvTextureIds.push(sheetId);
          
          if (d.det < 0) {// fix "flipped" decor quads
            uvOffsets.push((x + width) / maxDecorDim.width, y / maxDecorDim.height);
            uvDimensions.push(-width / maxDecorDim.width, height / maxDecorDim.height);
          } else {
            uvOffsets.push(x / maxDecorDim.width,  y / maxDecorDim.height);
            uvDimensions.push(width / maxDecorDim.width, height / maxDecorDim.height);
          }
        }

        instanceIds.push(instanceId);
      }

      state.quad.deleteAttribute('uvOffsets');
      state.quad.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.quad.deleteAttribute('uvDimensions');
      state.quad.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
      state.quad.deleteAttribute('uvTextureIds');
      state.quad.setAttribute('uvTextureIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(uvTextureIds), 1),
      );
      state.quad.deleteAttribute('instanceIds');
      state.quad.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(instanceIds), 1),
      );
    },
    create(def) {
      /** @type {Geomorph.Decor} */ let d;
      const meta = /** @type {Meta<Geomorph.GmRoomId>} */ (def.meta ?? {});
      meta.decor = true;

      switch (def.type) {
        case 'circle': {
          d = {
            type: 'circle',
            key: def.key,
            meta: Object.assign(meta, { circle: true }),
            bounds2d: { x: def.center.x - def.radius, y: def.center.y - def.radius, width: def.radius * 2, height: def.radius * 2 },
            radius: def.radius,
            center: def.center,
          };
          break;
        }
        case 'cuboid': {
          const transform = def.transform ?? [1, 0, 0, 1, 0, 0];
          const matrix = tmpMat1.feedFromArray(transform);
          const poly = Poly.fromRect(def).applyMatrix(matrix);
          const center2d = poly.center;
          d = {
            type: 'cuboid',
            key: def.key,
            meta: Object.assign(meta, { cuboid: true, h: def.height3d, y: def.baseY }),
            bounds2d: poly.rect.precision(precision).json,
            center: geom.toPrecisionV3({ x: center2d.x, y: def.baseY + def.height3d/2, z: center2d.y }),
            transform,
          };
          break;
        }
        case 'quad': {
          const transform = def.transform ?? [1, 0, 0, 1, 0, 0];
          // scale must be represented inside transform
          transform[0] *= def.width;
          transform[1] *= def.width;
          transform[2] *= def.height;
          transform[3] *= def.height;
          // translation must be represented inside transform
          transform[4] += def.x;
          transform[5] += def.y;
          const matrix = tmpMat1.feedFromArray(transform);
          const poly = Poly.fromRect({ x:0, y:0, width: def.width, height: def.height }).applyMatrix(matrix);

          if (!helper.isDecorImgKey(def.img)) {
            warn(`${'Decor.create'}: def.img not a DecorImgKey, using "icon--warn"`);
            def.img = 'icon--warn';
          }

          d = {
            type: 'quad',
            key: def.key,
            meta: Object.assign(meta, {
              quad: true,
              color: def.color,
              img: def.img,
              y: def.y3d,
            }),
            bounds2d: poly.rect.precision(precision).json,
            transform,
            center: poly.center.precision(3).json,
            det: matrix.a * matrix.d - matrix.b * matrix.c,
          };
          break;
        }
        case 'rect': {
          const poly = geom.angledRectToPoly({ baseRect: tmpRect1.setFromJson(def), angle: def.angle ?? 0 })
          d = {
            type: 'rect',
            key: def.key,
            meta: Object.assign(meta, { rect: true }),
            bounds2d: poly.rect.json,
            points: poly.outline.map(x => x.json),
            center: poly.center.precision(3).json,
            angle: def.angle ?? 0,
          };
          break;
        }
        case 'point':
        default: {
          const center = tmpVec1.copy(def).precision(precision);
          const radius = decorIconRadius + 2;
          const bounds2d = tmpRect1.set(center.x - radius, center.y - radius, 2 * radius, 2 * radius).precision(precision).json;

          if ('img' in def && !helper.isDecorImgKey(def.img)) {
            warn(`${'Decor.create'}: def.img not a DecorImgKey, using "icon--warn"`);
            def.img = 'icon--warn';
          }

          d = {
            type: 'point',
            key: def.key,
            meta: Object.assign(meta, {
              point: true,
              y: def.y3d,
              ...def.img !== undefined && { img: def.img },
              ...meta.do === true && { doPoint: {...center} },
            }),
            bounds2d,
            x: center.x,
            y: center.y,
            orient: def.orient ?? 0,
          };
          break;
        }
      }

      state.ensureGmRoomId(d);
      state.register([d]);
      return d;
    },
    createCuboidMatrix4(d) {
      tmpMat1.feedFromArray(d.transform);
      return geomorph.embedXZMat4(tmpMat1.toArray(), {
        mat4: tmpMatFour1,
        yHeight: d.meta.y + (d.meta.h / 2),
        yScale: d.meta.h, // scaling centred unit cuboid
      }).multiply(centreUnitQuad);
    },
    createLabelMatrix4(d) {
      const { width, height } = state.label.lookup[d.meta.label];
      // scale down after earlier scale up in fontSize
      const scale = sguToWorldScale * (1 / spriteSheetLabelExtraScale) * 0.25;
      const transform = [width * scale, 0, 0, height * scale, d.x, d.y];
      return tmpMatFour1.set(
        transform[0], 0, 0, transform[4],
        0, transform[3], 0, 2.2, // 🚧 remove hard-coded height
        0, 0, 1, transform[5],
        0, 0, 0, 1
      );
    },
    createQuadMatrix4(d) {
      if (d.type === 'point') {
        // move to center, scale, possibly rotate
        const radians = d.orient * (Math.PI / 180);
        if (radians !== 0) {
          tmpMat1.feedFromArray([1, 0, 0, 1, -0.5, -0.5])
            .postMultiply([
              decorIconRadius * 2 * Math.cos(radians),
              decorIconRadius * 2 * Math.sin(radians),
              decorIconRadius * 2 * -Math.sin(radians),
              decorIconRadius * 2 * Math.cos(radians),
              d.x,
              d.y,
            ]);
        } else {
          tmpMat1.feedFromArray([
            decorIconRadius * 2, 0, 0, decorIconRadius * 2,
            d.x - decorIconRadius, d.y - decorIconRadius,
          ]);
        }

        return geomorph.embedXZMat4(tmpMat1.toArray(), {
          mat4: tmpMatFour1,
          yHeight: d.meta.y,
        });
      
      } else {// d.type === 'quad'

        const mat4 = geomorph.embedXZMat4(d.transform, {
          mat4: tmpMatFour1,
          yHeight: d.meta.y,
        });
        
        if (d.meta.tilt === true) {
          const [a, b] = d.transform
          const vecLen = Math.sqrt(a ** 2 + b ** 2); // remove scale to get local x unit vector
          const rotMat = getRotAxisMatrix(a / vecLen, 0, b / vecLen, 90);
          setRotMatrixAboutPoint(rotMat, d.center.x, d.meta.y, d.center.y);
          mat4.premultiply(rotMat); // 🔔 premultiply means post-rotate
        }

        return mat4;
      }
    },
    ensureGmRoomId(decor) {
      if (!(decor.meta.gmId >= 0 && decor.meta.roomId >= 0)) {
        const decorOrigin = state.getDecorOrigin(decor);
        const gmRoomId = w.gmGraph.findRoomContaining(decorOrigin);
        return gmRoomId === null ? null : Object.assign(decor.meta, gmRoomId);
      } else {
        decor.meta.grKey ??= helper.getGmRoomKey(decor.meta.gmId, decor.meta.roomId);
        return decor.meta;
      }
    },
    getDecorOrigin(decor) {
      return decor.type === 'point' ? decor : decor.center;
    },
    instantiateDecor(d, gmId, gm) {
      /** @type {Geomorph.Decor} */
      let instance;
      /** @type {Geomorph.BaseDecor} */
      const base = {
        key: '', // computed below
        meta: { ...d.meta, gmId }, // 🔔 must not mutate d.meta
        bounds2d: tmpRect1.copy(d.bounds2d).applyMatrix(gm.matrix).json,
        src: gm.key,
      };

      switch (d.type) {
        case 'circle':
          instance = { ...d, ...base,
            center: gm.matrix.transformPoint({ ...d.center }),
          };
          break;
        case "cuboid": {
          const center = gm.matrix.transformPoint({ x: d.center.x, y: d.center.z });
          instance = { ...d, ...base,
            center: { x: center.x, y: d.center.y, z: center.y },
            transform: tmpMat1.setMatrixValue(gm.matrix).preMultiply(d.transform).toArray(),
          };
          break;
        }
        case "point": {
          /**
           * +90° converts:
           * - "clockwise from above from east" (SVG symbol coords) to
           * - "clockwise from above from north" (easier for users)
           * 
           * This also aligns sprite-sheet icons/text correctly, i.e.
           * decor-arrow points from bottom-to-top of icons/text.
           */
          const orient = (gm.matrix.transformDegrees(d.orient) + 90) % 360;
          instance = gm.matrix.transformPoint(/** @type {Geomorph.DecorPoint} */ ({ ...d, ...base, orient }));
          instance.x = toPrecision(instance.x);
          instance.y = toPrecision(instance.y);
          instance.meta.orient = orient; // update `meta` too
          if (base.meta.do === true) {
            instance.meta.doPoint = { x: instance.x, y: instance.y };
          }
          break;
        }
        case "rect":
          instance = { ...d, ...base,
            center: gm.matrix.transformPoint({ ...d.center }),
            points: d.points.map(p => gm.matrix.transformPoint({ ...p })),
          };
          break;
        case "quad":
        case "decal":
          instance = { ...d, .../** @type {Geomorph.DecorQuad}} */ (base),
            center: gm.matrix.transformPoint({ ...d.center }),
            transform: tmpMat1.setMatrixValue(gm.matrix).preMultiply(d.transform).toArray(),
            det: tmpMat1.a * tmpMat1.d - tmpMat1.b * tmpMat1.c,
          };
          if (typeof d.meta.switch === 'number') {
            instance.meta.doorId = d.meta.switch;
            instance.meta.gdKey = `g${gmId}d${d.meta.switch}`;
          }
          break;
        default:
          throw testNever(d);
      }
      instance.key = geomorph.getDerivedDecorKey(instance);
      return /** @type {typeof d} */ (instance);
    },
    /** @returns {d is Geomorph.DecorPoint | Geomorph.DecorQuad} */
    isDecorQuad(d) {// 🚧 clean and rename
      return d.type === 'point' && (
        typeof d.meta.img === 'string'
        // these fallback to icon--info
        || d.meta.do === true || d.meta.button === true
      ) || d.type === 'quad' && (
        typeof d.meta.img === 'string' 
      );
    },
    positionCuboids() { 
      const { cuboidInst } = state;
      
      const defaultCuboidColor = '#ddd'; // 🚧 move to const
      for (const [instId, d] of state.cuboids.entries()) {
        const mat4 = state.createCuboidMatrix4(d);
        cuboidInst.setMatrixAt(instId, mat4);
        cuboidInst.setColorAt(instId, getColor(d.meta.color ?? defaultCuboidColor));
      }
    
      cuboidInst.instanceMatrix.needsUpdate = true;
      if (cuboidInst.instanceColor !== null) {
        cuboidInst.instanceColor.needsUpdate = true;
      }
      cuboidInst.computeBoundingSphere();   
    },
    positionInstances() { 
      state.positionCuboids();
      state.positionQuads();
      state.positionLabels();
    },
    positionLabels() {
      const { labelInst } = state;
      for (const [instId, d] of state.labels.entries()) {
        const mat4 = state.createLabelMatrix4(d);
        labelInst.setMatrixAt(instId, mat4);
      }
    
      labelInst.instanceMatrix.needsUpdate = true;
      labelInst.computeBoundingSphere();
    },
    positionQuads() {
      const { quadInst } = state;
      const defaultQuadColor = 'white'; // 🚧 move to const
      for (const [instId, d] of state.quads.entries()) {
        const mat4 = state.createQuadMatrix4(d);
        quadInst.setMatrixAt(instId, mat4);
        quadInst.setColorAt(instId, getColor(d.meta.color ?? defaultQuadColor));
      }

      quadInst.instanceMatrix.needsUpdate = true;
      if (quadInst.instanceColor !== null) {
        quadInst.instanceColor.needsUpdate = true;
      }
      quadInst.computeBoundingSphere();
    },
    register(ds, removeExisting = true) {
      const addable = ds.filter((d) => state.ensureGmRoomId(d) !== null ||
        void warn(`decor "${d.key}" cannot be added: not in any room`, d)
      );

      if (addable.length === 0) {
        return;
      }

      const grouped = addable.reduce((agg, d) => {
        (agg[d.meta.grKey] ??= { meta: d.meta, add: [], remove: [] }).add.push(d);
        
        const prev = state.byKey[d.key];
        if (prev !== undefined) {// Add pre-existing decor to removal group
          d.updatedAt = Date.now();
          (agg[prev.meta.grKey] ??= { meta: prev.meta, add: [], remove: [] }).remove.push(prev);
        }

        return agg;
      }, /**
          * @type {Record<Geomorph.GmRoomKey, {
          *   add: Geomorph.Decor[];
          *   remove: Geomorph.Decor[];
          *   meta: Meta<Geomorph.GmRoomId>;
          * }>}
          */ ({})
      );

      if (removeExisting === true) {
        Object.values(grouped).forEach(({ meta, remove }) =>
          state.removeFromRoom(meta.gmId, meta.roomId, remove)
        );
      }

      Object.values(grouped).forEach(({ meta, add }) =>
        state.registerInRoom(meta.gmId, meta.roomId, add)
      );

      state.updateDecorLists();
      w.events.next({ key: 'decors-added', decors: ds });

      state.registeredAt = Date.now();
      update();
    },
    registerInRoom(gmId, roomId, ds) {
      const atRoom = state.byRoom[gmId][roomId];

      for (const d of ds) {
        if (d.key in state.byKey) {
          continue;
        }
        addToDecorGrid(d, state.byGrid);
        state.byKey[d.key] = d;
        atRoom.add(d);
        state.rmKeys.delete(d.key);
      }
    },
    rememberInGroup(groupName, ...decorKeys) {
      (state.group[groupName] ??= []).push(...decorKeys);
    },
    remove(...decorKeys) {
      const ds = decorKeys.map(x => state.byKey[x]).filter(Boolean);
      if (ds.length === 0) {
        return;
      }

      const grouped = ds.reduce((agg, d) => {
        (agg[d.meta.grKey] ??= { meta: d.meta, ds: [] }).ds.push(d);
        return agg;
      }, /** @type {Record<Geomorph.GmRoomKey, { meta: Meta<Geomorph.GmRoomId> } & { ds: Geomorph.Decor[] }>} */ ({}));

      for (const { meta, ds } of Object.values(grouped)) {
        state.removeFromRoom(meta.gmId, meta.roomId, ds)
      }

      state.updateDecorLists();
      w.events.next({ key: 'decors-removed', decors: ds });
      update();
    },
    removeAllInstantiated() {
      for (const d of Object.values(state.byKey)) {
        d.src !== undefined && delete state.byKey[d.key];
      }
      for (const byRoomId of state.byRoom) {
        for (const decorSet of byRoomId) {
          decorSet.forEach(d => d.src !== undefined && decorSet.delete(d));
        }
      }
      for (const byY of state.byGrid) {
        for (const decorSet of byY ?? []) {
          // array can contain `undefined` (untouched by decor)
          decorSet?.forEach(d => d.src !== undefined && decorSet.delete(d));
        }
      }
    },
    removeFromRoom(gmId, roomId, ds) {
      const atRoom = state.byRoom[gmId][roomId];

      for (const d of ds) {
        if (!(d.key in state.byKey)) {
          continue;
        }
        delete state.byKey[d.key];
        atRoom.delete(d);
        state.rmKeys.add(d.key);
      }

      ds.forEach(d => removeFromDecorGrid(d, state.byGrid));
    },
    removeGm(gmId) {
      const byRoomId = state.byRoom[gmId];
      for (const ds of byRoomId) {
        ds.forEach(d => d.src !== undefined && ds.delete(d) && delete state.byKey[d.key]);
      }
      const { gridRect } = w.gms[gmId]; // clear gmId's part of the decor grid
      const { x, right, y, bottom } = tmpRect1.copy(gridRect).scale(1 / decorGridSize).integerOrds();
      for (let i = x; i < right; i++) {
        const inner = state.byGrid[i];
        if (inner === undefined) continue;
        for (let j = y; j < bottom; j++) {
          inner[j]?.forEach(d => d.src !== undefined && inner[j].delete(d));
        }
      }
    },
    removeGroup(groupName) {
      const decorKeys = state.group[groupName];
      state.remove(...decorKeys ?? []);
      delete state.group[groupName];
    },
    showLabels(shouldShow = !state.labelsShown) {
      state.labelsShown = shouldShow;
      w.update();
    },
    updateDecorLists() {
      state.cuboids = Object.values(state.byKey).filter(geomorph.isDecorCuboid);
      state.quads = Object.values(state.byKey).filter(state.isDecorQuad);
    },
    updateInvert(partial) {
      Object.assign(state.invert, partial);
      w.update();
    },
  }));

  w.decor = state;
  
  // instantiate geomorph decor
  const query = useQuery({
    queryKey: [
      'decor',
      w.key,
      w.hash.mapDecor,
      w.hash.sheets,
    ],

    async queryFn() {
      if (module.hot?.active === false) {
        return false; // Avoid query from disposed module
      }

      const justHmr = query.data === false;
      const prev = state.seenHash ?? {};
      const next = w.hash;
      const mapChanged = prev.map !== next.map;
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale * 2;

      state.labels = w.gms.flatMap((gm, gmId) => gm.labels.map(d => state.instantiateDecor(d, gmId, gm)));
      createLabelSpriteSheet(
        removeDups(state.labels.map(x => /** @type {string} */ (x.meta.label))),
        state.label,
        { fontHeight },
      );
      state.addLabelUvs();

      w.menu.measure('decor.addGm');

      if (mapChanged === true || justHmr === true) {
        // Re-instantiate all cleanly
        state.removeAllInstantiated();
        for (const [gmId, gm] of w.gms.entries()) {
          state.byRoom[gmId] ??= gm.rooms.map(_ => new Set());
          gm.rooms.forEach((_, roomId) => state.byRoom[gmId][roomId] ??= new Set());
        };
        await pause();

        for (const [gmId] of w.gms.entries()) {
          state.addGm(gmId);
          await pause();
        }
        w.events.next({ key: 'updated-gm-decor', type: 'all' });
      } else {
        // Only re-instantiate changed geomorphs
        for (const [gmId, gm] of w.gms.entries()) {
          if (prev[gm.key] === next[gm.key]) {
            continue;
          }
          state.removeGm(gmId);
          state.addGm(gmId);
          await pause();
        }
        w.events.next({
          key: 'updated-gm-decor',
          type: 'partial',
          gmIds: w.gms.flatMap((gm, gmId) =>
            prev[gm.key].decor !== next[gm.key].decor ? gmId : []
          ),
        });
      }

      w.menu.measure('decor.addGm');
      // 🔔 must clone for diff detection
      state.seenHash = { ...w.hash, mapGmHashes: w.hash.mapGmHashes.slice() };
      update();
      return true;
    },
    // refetchOnMount: false,
    // refetchOnReconnect: false,
    // staleTime: Infinity,
    // 👆 all above stopped hmr
    refetchOnWindowFocus: false,
    retry: false, // fix dup invokes
    gcTime: 0,
    throwOnError: isDevelopment(),
    networkMode: isDevelopment() ? 'always' : 'online',
  });

  state.queryStatus = query.status;
  const labels = state.labelsShown ? state.labels : [];

  React.useEffect(() => {
    if (query.data === true) {
      state.addQuadUvs();
      state.addCuboidAttributes();
      state.positionInstances();
      update();
    } else if (query.data === false && query.isRefetching === false) {
      query.refetch(); // hmr
    }
    
  }, [
    query.data,
    state.cuboids.length,
    state.quads.length,
    labels.length,
    state.registeredAt,
  ]);

  const update = useUpdate();
  const ready = !!state.seenHash;

  return <>
    <instancedMesh // cuboids
      name={instancedMeshName.decorCuboids}
      key={`${state.cuboids.length} cuboids`}
      ref={state.ref('cuboidInst')}
      args={[state.cuboidGeom, undefined, state.cuboids.length]}
      // frustumCulled={false}
      renderOrder={1}
      visible={ready}
    >
      {/* <meshBasicMaterial color="red" side={THREE.DoubleSide} /> */}
      {ready && <instancedFlatMaterial
        key={glsl.InstancedFlatMaterial.key}
        side={THREE.DoubleSide} // fix flipped gm
        diffuse={[1, 1, 1]}
        invert={state.invert.cuboids}
        objectPickRed={7}
        // opacity={query.status === 'success' ? 1 : 0}
        quadOutlines
        transparent
      />}
    </instancedMesh>

    <instancedMesh //quads
      name={instancedMeshName.decorQuads}
      key={`${state.quads.length} quads`}
      ref={state.ref('quadInst')}
      args={[state.quad, undefined, state.quads.length]}
      frustumCulled={false}
      renderOrder={-1}
      visible={ready}
    >
      {/* <meshBasicMaterial color="red" /> */}
      {ready && <instancedAtlasMaterial
        key={glsl.InstancedAtlasMaterial.key}
        atlas={w.texDecor.tex}
        alphaTest={0.5}
        diffuse={[0.7, 0.7, 0.7]}
        objectPickRed={5}
        opacity={query.status === 'success' ? 1 : 0}
        side={THREE.DoubleSide}
        transparent
      />}
    </instancedMesh>

    <instancedMesh // labels
      name={instancedMeshName.decorLabels}
      key={`${labels.length} labels`}
      ref={state.ref('labelInst')}
      args={[state.labelQuad, undefined, labels.length]}
      frustumCulled={false}
      renderOrder={-4}
    >
      {/* <meshBasicMaterial color="red" /> */}
      <instancedLabelsMaterial
        key={glsl.InstancedLabelsMaterial.key}
        // side={THREE.DoubleSide}
        map={state.label.tex}
        transparent
        opacity={0.8}
        diffuse={new THREE.Vector3(1, 1, 1)}
      />
    </instancedMesh>
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {Geomorph.DecorGrid} byGrid
 * Decor in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {Record<string, Geomorph.Decor>} byKey
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {THREE.BufferGeometry} cuboidGeom
 * @property {Geomorph.DecorCuboid[]} cuboids
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {number} registeredAt
 * The epoch we last registered; used to force length-preserving updates
 * @property {{ [decorKeysGroupName: string]: string[] }} group
 * @property {{ cuboids: boolean }} invert
 * @property {Geomorph.DecorPoint[]} labels
 * @property {THREE.InstancedMesh} labelInst
 * @property {import("../service/three").LabelsSheetAndTex} label
 * @property {THREE.BufferGeometry} labelQuad
 * @property {(Geomorph.DecorPoint | Geomorph.DecorQuad)[]} quads
 * This is `Object.values(state.byKey)`
 * @property {THREE.BufferGeometry} quad
 * @property {THREE.InstancedMesh} quadInst
 * @property {import("@tanstack/react-query").QueryStatus} queryStatus
 * @property {Set<string>} rmKeys decorKeys manually removed via `removeDecorFromRoom`,
 * but yet added back in. This is useful e.g. so can avoid re-instantiating geomorph decor
 * @property {Geomorph.GeomorphsHash} seenHash Clone of last seen value of `w.hash`
 * @property {(shouldShow?: boolean) => void} showLabels Set or toggle
 * @property {boolean} labelsShown
 *
 * @property {(ds: Geomorph.Decor[], removeExisting?: boolean) => void} register
 * Can manually `removeExisting` e.g. during re-instantiation of geomorph decor
 * @property {() => void} addLabelUvs
 * @property {() => void} addQuadUvs
 * @property {() => void} addCuboidAttributes
 * @property {(def: Geomorph.DecorDef) => Geomorph.Decor} create
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} registerInRoom
 * @property {(d: Geomorph.DecorCuboid) => THREE.Matrix4} createCuboidMatrix4
 * @property {(d: Geomorph.DecorPoint | Geomorph.DecorQuad) => THREE.Matrix4} createQuadMatrix4
 * @property {(d: Geomorph.DecorPoint) => THREE.Matrix4} createLabelMatrix4
 * @property {(d: Geomorph.Decor) => Geomorph.GmRoomId | null} ensureGmRoomId
 * @property {(d: Geomorph.Decor) => Geom.VectJson} getDecorOrigin
 * @property {<T extends Geomorph.Decor>(d: T, gmId: number, gm: Geomorph.LayoutInstance) => T} instantiateDecor
 * @property {(d: Geomorph.Decor) => d is Geomorph.DecorPoint | Geomorph.DecorQuad} isDecorQuad
 * @property {(gmId: number) => void} addGm
 * @property {() => void} positionCuboids
 * @property {() => void} positionInstances
 * @property {() => void} positionLabels
 * @property {() => void} positionQuads
 * @property {(groupName: string, ...decorKeys: string[]) => void} rememberInGroup
 * @property {(...decorKeys: string[]) => void} remove
 * @property {() => void} removeAllInstantiated
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} removeFromRoom
 * @property {(gmId: number) => void} removeGm
 * @property {(groupName: string) => void} removeGroup
 * @property {() => void} updateDecorLists
 * @property {(partial: Partial<State['invert']>) => void} updateInvert
 */

const centreUnitQuad = new THREE.Matrix4().makeTranslation(-(-0.5), 0, -(-0.5));
