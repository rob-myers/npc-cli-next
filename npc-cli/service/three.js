/**
 * Also used by web worker.
 */
import * as THREE from "three";
import { LineMaterial } from "three-stdlib";
import { damp } from "maath/easing";

import { skinsTextureDimension } from "./const";
import { range, warn } from "./generic";
import { Rect, Vect } from "../geom";
import packRectangles from "./rects-packer";

/** Unit quad extending from (0, 0, 0) to (1, 0, 1) */
const quadGeometryXZ = new THREE.BufferGeometry();
const xzVertices = new Float32Array([0,0,0, 1,0,0, 1,0,1, 0,0,1]);
const xzUvs = new Float32Array([0,0, 1,0, 1,1, 0,1]);
const xzIndices = [2, 1, 0, 0, 3, 2];
const xzNormals = [0,1,0, 0,1,0, 0,1,0, 0,1,0]; // For shadows
quadGeometryXZ.setAttribute("position", new THREE.BufferAttribute(xzVertices.slice(), 3));
quadGeometryXZ.setAttribute("uv", new THREE.BufferAttribute(xzUvs.slice(), 2));
quadGeometryXZ.setAttribute("normal", new THREE.Float32BufferAttribute( xzNormals.slice(), 3 ) );
quadGeometryXZ.setIndex(xzIndices.slice());

const centeredQuadGeometryXZ = quadGeometryXZ.clone();
centeredQuadGeometryXZ.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
  -0.5,0,-0.5, 0.5,0,-0.5, 0.5,0,0.5, -0.5,0,0.5
]), 3));

/** Cache to avoid re-creation on HMR */
const quadXZLookup = /** @type {Record<string, THREE.BufferGeometry>} */ ({});

const colorLookup = /** @type {Record<string, THREE.Color>} */ ({});

const rotMatLookup = /** @type {Record<string, THREE.Matrix4>} */ ({});

/**
 * Clone to avoid overwriting attributes used by custom shaders
 * @param {string} key
 */
export function getQuadGeometryXZ(key, centered = false) {
  return quadXZLookup[key] ??= (centered ? centeredQuadGeometryXZ : quadGeometryXZ).clone();
}

/**
 * @param {string | number} colorRep 
 */
export function getColor(colorRep) {
  return colorLookup[colorRep] ??= new THREE.Color(colorRep);
}

/**
 * Get a matrix which rotates around unit vector.
 * 🔔 May be mutated for "rotation around a point",
 * @see getRotAxisMatrix
 * @param {number} ux unit vector x
 * @param {number} uy unit vector y
 * @param {number} uz unit vector z
 * @param {number} degrees 
 */
export function getRotAxisMatrix(ux, uy, uz, degrees) {
  const key = `${ux} ${uy} ${uz} ${degrees}`;
  return rotMatLookup[key] ??= new THREE.Matrix4().makeRotationAxis(
    tmpVectThree1.set(ux, uy, uz),
    degrees * (Math.PI / 180),
  );
}

/**
 * Mutate matrix `mat` so that:
 * > `mat := translate(cx, cy, cz) . mat . translate(-cx, -cy, -cz)`
 * @param {THREE.Matrix4} mat 
 * @param {number} cx
 * @param {number} cy
 * @param {number} cz
 * @returns {THREE.Matrix4}
 */
export function setRotMatrixAboutPoint(mat, cx, cy, cz) {
  const me = mat.elements;
  mat.elements[12] = (me[0] * -cx + me[4] * -cy + me[8 ] * -cz) + cx;
  mat.elements[13] = (me[1] * -cx + me[5] * -cy + me[9 ] * -cz) + cy;
  mat.elements[14] = (me[2] * -cx + me[6] * -cy + me[10] * -cz) + cz;
  return mat;
}

/** Unit quad extending from (0, 0, 0) to (1, 1, 0) */
const quadGeometryXY = new THREE.BufferGeometry();
const xyVertices = new Float32Array([0,0,0, 0,1,0, 1,1,0, 1,0,0]);
const xyUvs = new Float32Array([0,1, 0,0, 1,0, 1,1]); // flipY false, Origin at topLeft of image
const xyIndices = [2, 1, 0, 0, 3, 2];
const xyNormals = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
quadGeometryXY.setAttribute("position", new THREE.BufferAttribute(xyVertices.slice(), 3));
quadGeometryXY.setAttribute("uv", new THREE.BufferAttribute(xyUvs.slice(), 2));
quadGeometryXZ.setAttribute( 'normal', new THREE.Float32BufferAttribute( xyNormals.slice(), 3 ) );
quadGeometryXY.setIndex(xyIndices.slice());

const centeredQuadGeometryXY = quadGeometryXY.clone();
centeredQuadGeometryXY.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
  -0.5,-0.5,0, -0.5,0.5,0, 0.5,0.5,0, 0.5,-0.5,0
]), 3));

/** Cache to avoid re-creation on HMR */
const quadXYLookup = /** @type {Record<string, THREE.BufferGeometry>} */ ({});

/**
 * Clone to avoid overwriting attributes used by custom shaders
 * @param {string} key
 */
export function getQuadGeometryXY(key, centered = false) {
  return quadXYLookup[key] ??= (centered ? centeredQuadGeometryXY : quadGeometryXY).clone();
}

export const tmpBufferGeom1 = new THREE.BufferGeometry();

/**
 * @param {Geom.Poly[]} polys
 * @param {Object} opts
 * @param {boolean} [opts.reverse]
 * @returns {THREE.BufferGeometry}
 */
export function polysToXZGeometry(polys, { reverse = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  const { vertices, indices, uvs } = polysToXZAttribs(polys);
  reverse && indices.reverse();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}

/**
 * @param {Geom.Triangulation} decomp
 * @param {Object} opts
 * @param {boolean} [opts.reverse]
 * @returns {THREE.BufferGeometry}
 */
export function decompToXZGeometry(decomp, { reverse = false } = {}) {
  const geometry = new THREE.BufferGeometry();
  const { vertices, indices, uvs } = decompToXZAttribs(decomp);
  reverse && indices.reverse();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}

/**
 * @param {Geom.Poly[]} polys
 */
function polysToXZAttribs(polys) {
  const vertices = /** @type {number[]} */ ([]);
  const indices = /** @type {number[]} */ ([]);
  const uvs = /** @type {number[]} */ ([]);
  let offset = 0;
  for (const poly of polys) {
    const { tris, vs } = poly.cleanFinalReps().qualityTriangulate();
    const rect = poly.rect;
    vertices.push(...vs.flatMap(({ x, y }) => [x, 0, y]));
    indices.push(...tris.flatMap((x) => x).map((x) => x + offset));
    uvs.push(...vs.flatMap(({ x, y }) => [(x - rect.x) / rect.width, (y - rect.y) / rect.height]));
    offset += vs.length;
  }
  return { vertices, indices, uvs };
}

/**
 * @param {Geom.Triangulation} decomp
 */
function decompToXZAttribs(decomp) {
  const vertices = decomp.vs.flatMap(v => [v.x, 0, v.y]);
  const indices = decomp.tris.flatMap(t => t);
  const bounds = Rect.fromPoints(...decomp.vs);
  const uvs = decomp.vs.flatMap(({ x, y }) => [(x - bounds.x) / bounds.width, (y - bounds.y) / bounds.height]);
  return { vertices, indices, uvs };
}

export const redWireFrameMat = new THREE.MeshStandardMaterial({
  wireframe: true,
  color: "red",
});

export const tmpVectThree1 = new THREE.Vector3();
export const tmpVectThree2 = new THREE.Vector3();
export const tmpVectThree3 = new THREE.Vector3();
export const tmpEulerThree = new THREE.Euler();
export const tmpMatFour1 = new THREE.Matrix4();
export const tmpMesh1 = new THREE.Mesh();
export const tmpBox1 = new THREE.Box3();

export const imageLoader = new THREE.ImageLoader();
export const textureLoader = new THREE.TextureLoader();
export const emptyTexture = new THREE.Texture();
export const emptyDataArrayTexture = new THREE.DataArrayTexture();
// console.log('cache enabled', THREE.Cache.enabled); // false

const navPathColor = 0x00aa00;
const navNodeColor = 0x777777;
export const navMeta = {
  pathColor: navPathColor,
  nodeColor: navNodeColor,
  groundOffset: 0.01,
  lineMaterial: new LineMaterial({
    color: navPathColor,
    linewidth: 1,
    // vertexColors: true,
  }),
  nodeMaterial: new THREE.MeshBasicMaterial({ color: navNodeColor }),
  nodeGeometry: new THREE.SphereGeometry(0.01),
};

/**
 * Collects nodes and materials from a THREE.Object3D.
 * @param {THREE.Object3D} object 
 * @returns {import("@react-three/fiber").ObjectMap}
 */
export function buildObject3DLookup(object) {
  /** @type {import("@react-three/fiber").ObjectMap} */
  const data = { nodes: {}, materials: {}, meshes: {} };
  if (object) {
    object.traverse(/** @param {THREE.Object3D & { material?: THREE.Material }} obj */ obj => {
      if (typeof obj.name == 'string') {
        data.nodes[obj.name] = obj;
      }
      if (typeof obj.material?.name === 'string' && !data.materials[obj.material.name]) {
        data.materials[obj.material.name] = obj.material; // 1st with name
      }
    });
  }
  return data;
}

/**
 * - Pre un-weld:
 *   - 24 vertices
 *   - 12 triangles: right x2, left x2, front x2, back x2, top x2, bottom x2.
 * - Post un-weld:
 *   - 34 vertices (12 * 3)
 *   - 12 triangles: right-{upper,lower}, left-{upper,lower}, top-{back,front}, bottom-{front,back}, front-{top,bottom}, back-{top,bottom}
 */
export const boxGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).toNonIndexed();

/** @param {string} key */
export function getBoxGeometry(key) {
  return boxGeomLookup[key] ??= boxGeometry.clone();
}

const boxGeomLookup = /** @type {Record<string, THREE.BufferGeometry>} */ ({});

export const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1);

/**
 * @param {THREE.Vector3Like} position
 * @param {THREE.Vector3Like} halfExtent
 */
export function createDebugBox(position, halfExtent) {
  const mesh = new THREE.Mesh(boxGeometry, redWireFrameMat)
  mesh.position.copy(position);
  mesh.scale.set(halfExtent.x * 2, halfExtent.y * 2, halfExtent.z * 2);
  return mesh;
}

/**
 * @param {THREE.Vector3Like} position
 * @param {number} radius
 * @param {number} height
 */
export function createDebugCylinder(position, radius, height) {
  const mesh = new THREE.Mesh(cylinderGeometry, redWireFrameMat)
  mesh.position.copy(position);
  mesh.scale.set(radius, height, radius);
  return mesh;
}

/**
 * Expects possibly empty (a) rects lookup, (b) texture,
 * where it will write the output.
 * 
 * We cannot "extend" an existing sprite-sheet because maxrect-packer
 * does not support this i.e. it won't necessarily respect constraints (x, y).
 * Consequently we must re-create every time.
 * 
 * @param {string[]} labels Assumed to be duplicate-free.
 * @param {LabelsSheetAndTex} sheet The sprite-sheet we'll create/mutate.
 * @param {{ fontHeight: number; }} opts
 */
export function createLabelSpriteSheet(labels, sheet, { fontHeight }) {
  if (labels.length === sheet.count && labels.every(label => label in sheet.lookup)) {
    return; // Avoid re-computation
  }

  // Create sprite-sheet
  const canvas = /** @type {HTMLCanvasElement} */ (sheet.tex.image);
  const ct = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ct.font = `${fontHeight}px 'Courier new'`;

  const strokeWidth = 5;

  const rects = labels.map(label => ({
    width: ct.measureText(label).width + 2 * strokeWidth,
    height: fontHeight + 2 * strokeWidth,
    data: { label },
  }));

  const { bins: [bin] } = packRectangles(rects, { logPrefix: 'w.extendLabels', packedPadding: 2 });

  sheet.lookup = bin.rects.reduce((agg, r) => {
    agg[r.data.label] = { x: r.x, y: r.y, width: r.width, height: r.height };
    return agg;
  }, /** @type {LabelsSheetAndTex['lookup']} */ ({}));
  sheet.count = labels.length;
  
  // Draw sprite-sheet
  if (canvas.width !== bin.width || canvas.height !== bin.height) {
    sheet.tex.dispose();
    canvas.width = bin.width;
    canvas.height = bin.height;
    sheet.tex = new THREE.CanvasTexture(canvas);
    sheet.tex.flipY = false;
  }
  ct.clearRect(0, 0, bin.width, bin.height);
  // ct.strokeStyle = ct.fillStyle = 'white';
  ct.strokeStyle = 'black';
  ct.fillStyle = 'white';
  ct.lineWidth = strokeWidth;
  ct.font = `${fontHeight}px 'Courier new'`;
  ct.textBaseline = 'top';
  bin.rects.forEach(rect => {
    ct.strokeText(rect.data.label, rect.x + strokeWidth, rect.y + strokeWidth);
    ct.fillText(rect.data.label, rect.x + strokeWidth, rect.y + strokeWidth);
  });

  sheet.tex.needsUpdate = true;
}

export const unitXVector3 = new THREE.Vector3(1, 0, 0);

export const emptyGroup = new THREE.Group();

export const emptyAnimationMixer = new THREE.AnimationMixer(emptyGroup);

export const emptyShaderMaterial = new THREE.ShaderMaterial();

export const emptySkinnedMesh = new THREE.SkinnedMesh();

/**
 * @typedef CanvasTexMetaDef
 * @property {number} width 
 * @property {number} height 
 * @property {object} [opts]
 * @property {boolean} [opts.willReadFrequently]
 * @property {number} [opts.texId]
 */

/**
 * @typedef CanvasTexMeta
 * @property {CanvasRenderingContext2D} ct
 * @property {THREE.CanvasTexture} tex
 * @property {HTMLCanvasElement} canvas
 * @property {null | number} texId
 */

/**
 * This is the 1x1 pixel render target we use to do object picking.
 */
export const pickingRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
});

/**
 * @typedef LabelsSheetAndTex
 * @property {{ [label: string]: Geom.RectJson }} lookup
 * @property {number} count
 * @property {THREE.CanvasTexture} tex
 */

/**
 * - clones `THREE.Vector3`
 * - `{ x, y, z }` -> `new THREE.Vector3(x, y, z)`
 * - `{ x, y }` -> `new THREE.Vector3(x, 0, y)`
 * @param {Geom.VectJson | THREE.Vector3Like} input 
 * @returns {THREE.Vector3}
 */
export function toV3(input) {
  if ('z' in input) {
    return input instanceof THREE.Vector3 ? input.clone() : new THREE.Vector3().copy(input);
  } else {
    return new THREE.Vector3(input.x, 0, input.y);
  }
}

/**
 * - `{ x, y, z }` -> `{ x, y: z }`
 * - `THREE.Vector3` -> `{ x, y: z }`
 * - `{ x, y }` -> `{ x, y }` (fresh)
 * @param {Geom.VectJson | THREE.Vector3Like} input 
 * @returns {Geom.VectJson}
 */
export function toXZ(input) {
  if ('z' in input) {
    return { x: input.x, y: input.z };
  } else {
    return { x: input.x, y: input.y };
  }
}

/**
 * Mutates vector
 * @param {THREE.Vector3} v 
 * @param {number} precision 
 */
export function v3Precision(v, precision = 4) {
  return v.set(
    Number(v.x.toPrecision(precision)),
    Number(v.y.toPrecision(precision)),
    Number(v.z.toPrecision(precision)),
  );
}

export const defaultQuadUvs = [...Array(4)].map(_ => new THREE.Vector2());

/**
 * - precision 6
 * @param {THREE.BufferGeometry} geometry 
 */
export function getGeometryUvs(geometry) {
  const attribute = /** @type {THREE.BufferAttribute} */ (geometry.getAttribute('uv'));
  const flat = attribute.toJSON().array;
  const vectors = flat.reduce((agg, x, i, xs) =>
    (i % 2 === 1 && agg.push(new Vect(xs[i - 1], x).precision(8)), agg)
  , /** @type {Geom.Vect[]} */ ([]));
  return vectors;
}

/**
 * @param {THREE.Object3D[]} objs 
 * @returns {THREE.Bone[]}
 */
export function getRootBones(objs) {
  return objs.filter(/** @returns {x is THREE.Bone} */ (x) =>
    x instanceof THREE.Bone && !(x.parent instanceof THREE.Bone)
  );
}

/**
 * @template {{ material: THREE.Material }} T
 * @param {T} o
 * @returns {o is (T & { material: THREE.ShaderMaterial })}
 */
export function hasObjectPickShaderMaterial(o) {
  return (
    o.material instanceof THREE.ShaderMaterial
    && 'objectPick' in o.material.uniforms
  );
}

const tempInstanceMesh = new THREE.Mesh();
// 🚧 remove THREE.DoubleSide when e.g. all decor quads face correct way
// tempInstanceMesh.material = new THREE.MeshBasicMaterial();
tempInstanceMesh.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const tempInstanceLocalMatrix = new THREE.Matrix4();
const tempInstanceWorldMatrix = new THREE.Matrix4();

/**
 * @param {THREE.InstancedMesh} inst 
 * @param {number} instanceId 
 */
export function getTempInstanceMesh(inst, instanceId) {
  if (inst.boundingSphere === null) inst.computeBoundingSphere();
  const matrixWorld = inst.matrixWorld;
  tempInstanceMesh.geometry = inst.geometry;
  // tempInstanceMesh.material = inst.material;
  inst.getMatrixAt(instanceId, tempInstanceLocalMatrix);
  tempInstanceMesh.matrixWorld = tempInstanceWorldMatrix.multiplyMatrices(matrixWorld, tempInstanceLocalMatrix);
  return tempInstanceMesh;
}

const v3d = new THREE.Vector3();
let resX = false, resY = false, resZ = false, dx = 0, dz = 0, dMax = 0;
/**
 * Based on https://github.com/pmndrs/maath/blob/626d198fbae28ba82f2f1b184db7fcafd4d23846/packages/maath/src/easing.ts#L229
 * - Tries to sync x,z arrival time.
 * @param {THREE.Vector3} current 
 * @param {THREE.Vector3} target 
 * @param {number} [smoothTime] 
 * @param {number} [deltaMs] 
 * @param {number} [maxSpeed] 
 * @param {number} [y] override target.y (originally `easing`)
 * @param {number} [eps]
 * @returns 
 */
export function dampXZ(current, target, smoothTime, deltaMs, maxSpeed = Infinity, y, eps = 0.001) {
  v3d.copy(target);
  dx = Math.abs(current.x - target.x);
  dz = Math.abs(current.z - target.z);
  dMax = Math.max(dx, dz);
  resX = dMax < eps ? false : damp(current, "x", v3d.x, smoothTime, deltaMs, maxSpeed * (dx / dMax), undefined, eps);
  resY = y === undefined ? false : damp(current, "y", y, smoothTime, deltaMs, maxSpeed, undefined, eps);
  resZ = dMax < eps ? false : damp(current, "z", v3d.z, smoothTime, deltaMs, maxSpeed * (dz / dMax), undefined, eps);
  return resX || resY || resZ;
}

/**
 * Compute:
 * - mapping from SkinnedMesh's triangles to uv rectangles.
 * - base mapping from skin part to uv rect.
 * - the two triangle ids corresponding to the label
 * @param {import('three').SkinnedMesh} skinnedMesh
 * @param {Geomorph.UvRectLookup} uvMap
 * @param {number} initSheetId Which sheet was used when we exported from Blender
 * @returns {{
 *  triToUvKeys: NPC.TriToUvKeys;
 *  partToUvRect: NPC.SkinPartToUvRect;
 *  breathTriIds: number[];
 *  labelTriIds: number[];
 *  selectorTriIds: number[];
 * }}
 */
export function computeMeshUvMappings(skinnedMesh, uvMap, initSheetId) {
  const triToUvKeys = /** @type {NPC.TriToUvKeys} */ ([]);
  const partToUvRect = /** @type {NPC.SkinPartToUvRect} */ ({});

  // For fallback approach
  const seenUvRects = /** @type {Geomorph.UvRect[]} */ ([]);
  const currRect = new Rect();

  if (skinnedMesh.geometry.index !== null) {
    // geometry must be un-welded i.e. triangles pairwise-disjoint,
    // so we can detect current triangleId in fragment shader
    throw Error(`${'computeMeshUvMappings'}: ${skinnedMesh.name}: expected \`geometry.index === null\``);
  }
  
  // 🔔 arrange uvMap as sorted list-of-lists for fast-querying
  // - this requires uv rects to be arranged as non-overlapping columns
  // - if the columns overlap, we warn and fall back to a slower procedure
  // - it's worth satisfying the constraint because it keeps the data clean
  const mapping = Object.values(uvMap).reduce((agg, uvRect) => {
    const { key: uvRectKey, x, width, y, height, sheetId } = uvRect;
    if (sheetId === initSheetId) {
      (agg[x] ??= [x, x + width, []])[2].push([y + height, uvRectKey]);
      seenUvRects.push(uvRect);
    }
    return agg;
  }, /** @type {Record<number, [minX: Number, maxX: number, [maxY: number, uvRectKey: string][]]>} */ ([]));
  
  const sorted = Object.values(mapping).sort((a, b) => a[1] < b[1] ? -1 : 1);
  
  // Check if uv rects are arranged as non-overlapping columns
  const colOverlapId = sorted.findIndex(([_minX, maxX], i) => sorted[i + 1]?.[0] < maxX);
  const colsOverlap = colOverlapId !== -1;

  if (colsOverlap) {
    warn(`${'computeMeshUvMappings'}: ${skinnedMesh.name}: uv-map columns overlap: ${
      JSON.stringify({
        col1: {
          mx: sorted[colOverlapId][0] * skinsTextureDimension,
          Mx: sorted[colOverlapId][1] * skinsTextureDimension,
        },
        col2: {
          mx: sorted[colOverlapId + 1][0] * skinsTextureDimension,
          Mx: sorted[colOverlapId + 1][1] * skinsTextureDimension,
        },
      })
    } 🔔 falling back to slower algorithm`);
  } else {// also sort inners for fast lookup to work
    sorted.forEach(([ , , inner]) => inner.sort((a, b) => a[0] < b[0] ? -1 : 1));
  }
  
  const uvs = getGeometryUvs(skinnedMesh.geometry);
  const numVerts = skinnedMesh.geometry.getAttribute('position').count;
  const tris = range(numVerts / 3).map(i => [3 * i, 3 * i + 1, 3 * i + 2])
  /** Centre of mass of each UV-triangle (it's inside triangle) */
  const centers = tris.map(vIds => Vect.average(vIds.map(vId => uvs[vId])));
  
  const breathTriIds = /** @type {number[]} */ ([]);
  const labelTriIds = /** @type {number[]} */ ([]);
  const selectorTriIds = /** @type {number[]} */ ([]);
  
  // find uvRect fast or via fallback,
  // also compute labelTriIds and label uv min/max
  for (const [triId, center] of centers.entries()) {
    
    /** @type {string | undefined} */
    let uvRectKey = undefined;
    
    if (colsOverlap === true) {// slow fallback method (search all rects)
      uvRectKey = seenUvRects.find(uvRect => currRect.copy(uvRect).contains(center))?.key;
    } else {// fast method (stratified rects)
      const inner = sorted.find(([, maxX]) => center.x < maxX);
      uvRectKey = inner === undefined ? undefined : inner[2].find(([maxY]) => center.y < maxY)?.[1];
    }

    const vertexIds = tris[triId];
    if (uvRectKey === undefined) {
      warn(`triangle not contained in any uv-rect: ${JSON.stringify({ triId, vertexIds })}`);
      continue;
    }
    const skinPartKey = /** @type {Key.SkinPart} */ (uvRectKey.split('_')[1]);
    triToUvKeys[triId] = { uvRectKey, skinPartKey };
    partToUvRect[skinPartKey] = uvMap[uvRectKey];

    if (uvRectKey === 'default_label') {
      labelTriIds.push(triId);
    } else if (uvRectKey === 'default_selector') {
      selectorTriIds.push(triId);
    } else if (uvRectKey === 'default_breath') {
      breathTriIds.push(triId);
    }
  }
  
  if (labelTriIds.length !== 2) {
    warn(`expected exactly 2 triangles inside uv-rect ${'default_label'}: ${JSON.stringify(labelTriIds)}`);
  }

  return {
    triToUvKeys,
    partToUvRect,
    breathTriIds,
    labelTriIds,
    selectorTriIds,
  };
}
