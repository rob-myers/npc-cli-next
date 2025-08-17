import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { geomorphGridMeters, gmFloorExtraScale, instancedMeshName, worldToSguScale } from "../service/const";
import { pause } from "../service/generic";
import { getGridPattern, drawPolygons, drawRadialFillCustom, getCanvas } from "../service/dom";
import { geomorph } from "../service/geomorph";
import { InstancedAtlasMaterial } from "../service/glsl";
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
    largeGrid: getGridPattern(geomorphGridMeters * worldToCanvas, 'rgba(0, 0, 0, 0.2)'),
    radialTex: new THREE.CanvasTexture(getCanvas(`${w.key}-floor-radial-1`)),
    showLights: true,
    smallGrid: getGridPattern(1/5 * geomorphGridMeters * worldToCanvas, 'rgba(0, 0, 0, 0.2)'),
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
        state.drawGmLight(gmKey);
        w.texFloor.updateIndex(texId);
        w.texFloorLight.updateIndex(texId);
        await pause();
      }
      // w.texFloor.update();
      // w.texFloorLight.update();
      w.menu.measure('floor.draw');
    },
    drawGm(gmKey) {
      const { ct } = w.texFloor;
      const gm = w.geomorphs.layout[gmKey];

      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);

      // hull floor
      drawPolygons(ct, gm.hullPoly.map(x => x.clone().removeHoles()), ['#333d', null]);
      // drawPolygons(ct, gm.hullPoly.map(x => x.clone().removeHoles()), ['#141414', null]);

      // navigable floor
      const triangles = gm.navDecomp.tris.map(tri => new Poly(tri.map(i => gm.navDecomp.vs[i])));
      const navPoly = Poly.union(triangles.concat(gm.doors.map(x => x.computeDoorway())));
      // drawPolygons(ct, navPoly, ['#3339', '#000', 0.04]);
      drawPolygons(ct, navPoly, ['#333f', '#000', 0.04]);
      // drawPolygons(ct, navPoly, ['#0009', '#000', 0.04]);

      // 🚧 decals from gm.decor
      const { decor } = w.geomorphs.sheet;
      const decals = gm.decor.filter(x => x.type === 'decal');
      for (const decal of decals) {
        const rect = decor[decal.meta.img];
        // drawPolygons(ct, [Poly.fromRect(decal.bounds2d)], ['#f00', null]);
        ct.save();
        ct.transform(...decal.transform);
        ct.drawImage(
          w.decorImgs[rect.sheetId],
          rect.x, rect.y, rect.width, rect.height,
          0, 0, 1, 1,
        );
        ct.restore();
      }

      // grids
      ct.setTransform(1, 0, 0, 1, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);
      ct.fillStyle = state.smallGrid;
      ct.fillRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.fillStyle = state.largeGrid;
      ct.fillRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);

      // drop shadows, avoiding doubling
      const shadowPolys = Poly.union(gm.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(ct, shadowPolys, ['#000d', null]);

      // wall bases
      drawPolygons(ct, gm.walls, ['#000', null]);
    },
    drawGmLight(gmKey) {
      const { ct } = w.texFloorLight;
      const gm = w.geomorphs.layout[gmKey];
      
      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);

      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);

      const { image }  = state.radialTex;
      const lights = gm.unsorted.filter(x => x.meta.light === true);
      // ct.globalCompositeOperation = 'exclusion';
      // ct.globalCompositeOperation = 'difference';
      for (const light of lights) {
        const { x, y, width, height } = light.rect;
        ct.globalAlpha = typeof light.meta.opacity === 'number' ? light.meta.opacity : 1;
        ct.drawImage(image, x, y, width, height);
      }
      ct.globalAlpha = 1;
      ct.globalCompositeOperation = 'source-over';
    },
    drawRadialLight() {
      const canvas = /** @type {HTMLCanvasElement} */ (state.radialTex.image);
      const ct = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      
      // 🚧 recreate texture onresize ?
      // canvas.width = canvas.height = 512;
      canvas.width = canvas.height = 1024;
      
      ct.clearRect(0, 0, canvas.width, canvas.height);
      drawRadialFillCustom(ct);
      
      state.radialTex.needsUpdate = true;
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

  }), { reset: { smallGrid: true, largeGrid: true } });

  w.floor = state;

  React.useEffect(() => {
    state.positionInstances();
    state.addUvs();
    state.drawRadialLight();
    state.draw().then(() => w.update());
  }, [w.texVs.floor, w.hash.sheets]);

  return (
    <instancedMesh
      name={instancedMeshName.floor}
      ref={state.ref('inst')}
      args={[state.quad, undefined, w.gms.length]}
      renderOrder={-3} // 🔔 must render before other transparent e.g. npc drop shadow
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

        lightAtlas={w.texFloorLight.tex}
        showLights={w.crowd === null || state.showLights === true}
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
 * @property {CanvasPattern} smallGrid
 * @property {CanvasPattern} largeGrid
 * @property {THREE.BufferGeometry} quad
 * @property {boolean} showLights Show static lights?
 * @property {THREE.CanvasTexture} radialTex
 *
 * @property {() => void} addUvs
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Key.Geomorph) => void} drawGm
 * @property {(gmKey: Key.Geomorph) => void} drawGmLight
 * @property {() => void} drawRadialLight
 * @property {() => void} positionInstances
 */

const tmpMat1 = new Mat();
const worldToCanvas = worldToSguScale * gmFloorExtraScale;
