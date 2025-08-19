import React from "react";
import * as THREE from "three";

import { Mat, Poly, Vect } from "../geom";
import { gmFloorExtraScale, instancedMeshName, worldToSguScale } from "../service/const";
import { pause } from "../service/generic";
import { drawPolygons } from "../service/dom";
import { geomorph } from "../service/geomorph";
import { InstancedAtlasMaterial } from "../service/glsl";
import { getTileTriangles } from "../service/recast-detour";
import { getQuadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Floor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    inst: /** @type {*} */ (null),
    navTris: /** @type {*} */ ({}),
    quad: getQuadGeometryXZ(`${w.key}-multi-tex-floor-xz`),

    addUvs() {
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const uvTextureIds = /** @type {number[]} */ ([]);
      /** `[0, 1, ..., maxGmId]` */
      const instanceIds = /** @type {number[]} */ ([]);

      for (const [gmId, gm] of w.gms.entries()) {
        uvOffsets.push(0, 0);
        // 🔔 edge geomorph 301 pngRect height/width ~ 0.5 (not equal)
        uvDimensions.push(1, geomorph.isEdgeGm(gm.key) ? (gm.pngRect.height / gm.pngRect.width) : 1);
        uvTextureIds.push(w.gmsData.getTextureId(gm.key));
        instanceIds.push(gmId);
      }

      state.inst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.inst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
      state.inst.geometry.setAttribute('uvTextureIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(uvTextureIds), 1),
      );
      state.inst.geometry.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(instanceIds), 1),
      );
    },
    async draw() {
      w.menu.measure('floor.draw');
      for (const [texId, gmKey] of w.gmsData.seenGmKeys.entries()) {
        state.drawGm(gmKey);
        w.texFloor.updateIndex(texId);
        await pause();
      }
      w.menu.measure('floor.draw');
    },
    drawGm(gmKey) {
      const { ct } = w.texFloor;
      const gm = w.geomorphs.layout[gmKey];

      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);

      // hull floor
      // drawPolygons(ct, gm.hullPoly.map(x => x.clone().removeHoles()), ['#ffff', null]);
      drawPolygons(ct, gm.hullPoly.map(x => x.clone().removeHoles()), ['#666', null]);

      // drop shadows, avoiding doubling
      const shadowPolys = Poly.union(gm.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(ct, shadowPolys, ['#0007', null]);

      // wall bases
      drawPolygons(ct, gm.walls, ['#0008', null]);

      // draw nav mesh
      const triangle = new Poly([new Vect(), new Vect(), new Vect()]);
      ct.lineJoin = 'round';
      ct.lineWidth = w.touchDevice ? 0.05 : 0.03;
      const fillStyle = '#999';
      const strokeStyle = w.touchDevice ? '#4448' : '#4448';
      
      const { inverseMatrix } = w.gms[w.gms.findIndex(x => x.key === gm.key)];
      state.navTris[gm.key].forEach(([positions, indices]) => {
        for (const index of indices) {
          const triVId = index % 3; // 0, 1, 2
          const vertId = indices[index];
          const { x, y } = inverseMatrix.transformPoint({ x: positions[3 * vertId], y: positions[3 * vertId + 2] })
          triangle.outline[triVId].set(x, y);
          // triangle.outline[triVId].set(positions[3 * vertId], positions[3 * vertId + 2]);
          if (triVId === 2) {
            drawPolygons(ct, [triangle], [fillStyle, strokeStyle]);
          }
        }
      });
      // 🚧 draw off mesh connections

      // 🚧 decals from gm.decor
      // 🚧 test decals -> real ones
      // const { decor } = w.geomorphs.sheet;
      // const decals = gm.decor.filter(x => x.type === 'decal');
      // for (const decal of decals) {
      //   const rect = decor[decal.meta.img];
      //   // drawPolygons(ct, [Poly.fromRect(decal.bounds2d)], ['#f00', null]);
      //   ct.save();
      //   ct.transform(...decal.transform);
      //   ct.drawImage(w.decorImgs[rect.sheetId], rect.x, rect.y, rect.width, rect.height, 0, 0, 1, 1);
      //   ct.restore();
      // }

    },
    positionInstances() {
      for (const [gmId, gm] of w.gms.entries()) {
        const mat = (new Mat([
          gm.pngRect.width, 0, 0, gm.pngRect.height, gm.pngRect.x, gm.pngRect.y,
        ])).postMultiply(gm.matrix);
        // if (mat.determinant < 0) mat.preMultiply([-1, 0, 0, 1, 1, 0])
        state.inst.setMatrixAt(gmId, geomorph.embedXZMat4(mat.toArray()));
      }
      state.inst.instanceMatrix.needsUpdate = true;
      state.inst.computeBoundingSphere();
    },
    preComputeNav(nav) {// 🚧 compute in worker
      // at most one per gmKey
      const seenGms = w.gmsData.seenGmKeys.map(x => w.gms[w.gms.findIndex(y => y.key === x)]);
      const gridRects = seenGms.map(x => x.gridRect);
      const seenGmKeyToTris = /** @type {{[ gmKey in Key.Geomorph ]: [number[], number[]][]}} */ ({});
      seenGms.forEach(gm => seenGmKeyToTris[gm.key] = []);
      
      // iterate over tiles
      const maxTiles = nav.getMaxTiles();
      for (let tileIndex = 0; tileIndex < maxTiles; tileIndex++) {
        const tile = nav.getTile(tileIndex);
        const header = tile.header();
        if (!header) continue;
        const point = { x: (header.bmin(0) + header.bmax(0)) * 0.5, y: (header.bmin(2) + header.bmax(2)) * 0.5 };
        const seenGmsId = gridRects.findIndex(x => x.contains(point));
        if (seenGmsId >= 0) {
          const { key } = seenGms[seenGmsId];
          seenGmKeyToTris[key].push(getTileTriangles(tile));
        } // otherwise in later geomorph instance
      }

      // console.log({seenGmKeyToTris, gridRects});
      state.navTris = seenGmKeyToTris;
    },
  }));

  w.floor = state;

  React.useEffect(() => {
    state.positionInstances();
    state.addUvs();
    state.preComputeNav(w.crowd.navMesh); // 🔔 crowd must exist
    state.draw().then(() => w.update());
  }, [w.texVs.floor, w.hash.sheets, w.crowd.navMesh]);

  return (
    <instancedMesh
      name={instancedMeshName.floor}
      ref={state.ref('inst')}
      args={[state.quad, undefined, w.gms.length]}
      renderOrder={-3} // 🔔 must render before other transparent e.g. npc drop shadow
      // visible={false}
    >
      {/* <meshBasicMaterial color="red" side={THREE.DoubleSide} /> */}
      <instancedFloorMaterial
        key={InstancedAtlasMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={w.texFloor.tex}
        depthWrite={false} // fix z-fighting
        diffuse={[1, 1, 1]}
        objectPickRed={2}
        alphaTest={0.5}
      />
    </instancedMesh>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>} inst
 * @property {{[gmKey in Key.Geomorph]: [number[], number[]][]}} navTris navTris[seenGmId][tileIndex] is [positions, indices]
 * @property {THREE.BufferGeometry} quad
 
 *
 * @property {() => void} addUvs
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Key.Geomorph) => void} drawGm
 * @property {(nav: import('@recast-navigation/core').NavMesh) => void} preComputeNav
 * @property {() => void} positionInstances
 */

const tmpMat1 = new Mat();
const worldToCanvas = worldToSguScale * gmFloorExtraScale;
