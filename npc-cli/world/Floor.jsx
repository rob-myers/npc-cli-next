import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { geomorphGridMeters, gmFloorExtraScale, instancedMeshName, worldToSguScale } from "../service/const";
import { pause } from "../service/generic";
import { getGridPattern, drawPolygons, getContext2d, drawRadialFillCustom } from "../service/dom";
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
    grid: getGridPattern(1/5 * geomorphGridMeters * worldToCanvas, 'rgba(100, 100, 100, 0.1)'),
    inst: /** @type {*} */ (null),
    largeGrid: getGridPattern(geomorphGridMeters * worldToCanvas, 'rgba(120, 120, 120, 0.25)'),
    lit: {
      circle4: new THREE.Vector4(),
      static: false,
      target: false,
      testCt: getContext2d(`${w.key}-lit-canvas-${'test'}`, {
        width: 400,
        height: 400,
      }),
    },
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
      w.texFloor.update();
      w.menu.measure('floor.draw');
    },
    drawGm(gmKey) {
      const { ct } = w.texFloor;
      const gm = w.geomorphs.layout[gmKey];

      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);

      // floor
      drawPolygons(ct, gm.hullPoly.map(x => x.clone().removeHoles()), ['#191919', null]);
      // drawPolygons(ct, gm.hullPoly.map(x => x.clone().removeHoles()), ['#141414', null]);
      // nav
      const triangles = gm.navDecomp.tris.map(tri => new Poly(tri.map(i => gm.navDecomp.vs[i])));
      const navPoly = Poly.union(triangles.concat(gm.doors.map(x => x.computeDoorway())));
      drawPolygons(ct, navPoly, ['#00000055', '#445', 0.02]);

      // grids
      ct.setTransform(1, 0, 0, 1, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);
      ct.fillStyle = state.grid;
      ct.fillRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.fillStyle = state.largeGrid;
      ct.fillRect(0, 0, ct.canvas.width, ct.canvas.height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);

      // drop shadows (avoid doubling e.g. bunk bed, overlapping tables)
      const shadowPolys = Poly.union(gm.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(ct, shadowPolys, ['#000', null]);

      // walls
      // drawPolygons(ct, gm.walls, ['#000', null]);
      const walls2 =  gm.walls.reduce((agg, x) => (agg[x.meta.broad === true || x.meta.hull === true ? 0 : 1].push(x), agg), /** @type {[Poly[],Poly[]]} */ ([[], []]));
      drawPolygons(ct, walls2[0], ['#000', null]);
      drawPolygons(ct, walls2[1], ['#555', null]);
    },
    drawGmLight(gmKey) {// 🚧

      const { ct } = w.texFloorLight;
      const gm = w.geomorphs.layout[gmKey];
      
      // 🚧
      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);

      // ct.fillStyle = 'rgba(255, 0, 0, 1)';
      // ct.fillStyle = 'rgba(255, 255, 255, 1)';
      // ct.fillStyle = 'rgba(0, 0, 0, 1)';
      ct.fillStyle = 'rgba(50, 50, 50, 1)';
      ct.fillRect(0, 0, ct.canvas.width, ct.canvas.height);

      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -gm.pngRect.x * worldToCanvas, -gm.pngRect.y * worldToCanvas);

      const { testCt } = state.lit;
      const { width, height } = gm.pngRect;
      const radius = width / 10;

      // 🚧
      for (let x = 0; x < width; x+= 2 * width / 5) {
        for (let y = 0; y < height; y+= 2 * height / 5) {
          // ct.globalAlpha = 0.5;
          ct.drawImage(testCt.canvas, x, y, radius * 2, radius * 2);
        }
      }


    },
    onUpdateMaterial(material) {
      /** @type {import("../types/glsl").InstancedFloorKeys} */
      const uniformKey = 'litCircle';
      (material.uniforms)[uniformKey].value = state.lit.circle4;
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
  }), { reset: { grid: false, largeGrid: false } });

  w.floor = state;

  React.useEffect(() => {
    state.positionInstances();
    state.addUvs();
    // cache radial fill
    drawRadialFillCustom(state.lit.testCt);

  }, [w.mapKey, w.hash.full]);
  
  React.useEffect(() => {
    state.draw().then(() => w.update());
  }, [w.texVs.floor]);

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
        litCircle={state.lit.circle4}
        staticLights={state.lit.static}
        targetLight={state.lit.target}
        onUpdate={state.onUpdateMaterial}
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
 * @property {CanvasPattern} grid
 * @property {CanvasPattern} largeGrid
 * @property {Lit} lit
 * @property {THREE.BufferGeometry} quad
 *
 * @property {() => void} addUvs
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Key.Geomorph) => void} drawGm
 * @property {(gmKey: Key.Geomorph) => void} drawGmLight
 * @property {(material: THREE.ShaderMaterial) => void} onUpdateMaterial
 * @property {() => void} positionInstances
 */

const tmpMat1 = new Mat();
const worldToCanvas = worldToSguScale * gmFloorExtraScale;

/**
 * @typedef Lit
 * @property {THREE.Vector4} circle4 Shader uniform `(cx, cz, radius, opacity)`
 * @property {boolean} static Show static lights?
 * @property {boolean} target Show moving target light?
 * @property {CanvasRenderingContext2D} testCt 🚧
 */
