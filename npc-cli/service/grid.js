import { Rect, Vect } from "../geom";
import { decorGridSize, gmIdGridDim } from "./const";


/**
 * - Add item to grid.
 * - We extend the "reach" of decor points/quads whose center resides in decor
 *   such that `decor.meta['apply-reach'] === true`.
 * @param {Geomorph.Decor} item 
 * @param {Geomorph.DecorGrid} grid 
 */
export function addToDecorGrid(item, grid) {
  const rect = item.bounds2d;
  const [mx, my] = coordToDecorGrid(rect.x, rect.y);
  const [Mx, My] = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  const isApplyReach = item.meta['apply-reach'] === true;
  
  // For easy deletion
  item.meta.gridMin = [mx, my];
  item.meta.gridMax = [Mx, My];

  for (let i = mx; i <= Mx; i++)
    for (let j = my; j <= My; j++) {
      const tile = grid[`${i},${j}`] ??= new Set();
      
      if (item.type === 'point' || item.type === 'quad') {
        const parent = findApplyReachContaining(item, tile);
        if (parent !== null) {
          applyReach(item, parent, grid);
          return;
        }
      } else if (isApplyReach === true) {
        const queryRect = tmpRect1.copy(rect);
        for (const other of tile) {
          if ((
            other.type === 'point' && queryRect.contains(other) === true
            || other.type === 'quad' && queryRect.contains(other.center) === true
          )) {
            applyReach(other, item, grid)
          }
        }
      }

      tile.add(item);
    }
}

/**
 * - Apply parent gridMin, gridMax to item.
 * - Store parent bounds2d as item.meta.reachRect
 * @param {Geomorph.DecorPoint | Geomorph.DecorQuad} item 
 * @param {Geomorph.Decor} parent
 * @param {Geomorph.DecorGrid} grid
 */
function applyReach(item, parent, grid) {
  const [omx, omy] = /** @type {[number, number]} */ (parent.meta.gridMin);
  const [oMx, oMy] = /** @type {[number, number]} */ (parent.meta.gridMax);
  for (let x = omx; x <= oMx; x++)
    for (let y = omy; y <= oMy; y++)
      (grid[`${x},${y}`] ??= new Set()).add(item);
  
  item.meta.gridMin = [omx, omy];
  item.meta.gridMax = [oMx, oMy];
  item.meta.reachRect = tmpRect1.copy(parent.bounds2d).precision(2).tuple;
}

/**
 * @param {Geomorph.LayoutInstance[]} gms 
 * @returns {Geomorph.GmIdGrid}
 */
export function createGmIdGrid(gms) {
  const gmIdGrid = /** @type {Geomorph.GmIdGrid} */ ({});

  for (const [gmId, { gridRect: { x: gx, y: gy, right, bottom } }] of gms.entries()) {
    for (let x = Math.floor(gx / gmIdGridDim); x < Math.floor(right / gmIdGridDim); x++)
      for (let y = Math.floor(gy / gmIdGridDim); y < Math.floor(bottom / gmIdGridDim); y++)
        gmIdGrid[`${x},${y}`] = gmId;
  }

  return gmIdGrid;
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {[x: number, y: number]}
 */
export function coordToDecorGrid(x, y) {
  return [
    Math.floor(x / decorGridSize),
    Math.floor(y / decorGridSize),
  ];
}

/**
 * @param {Geomorph.DecorPoint | Geomorph.DecorQuad} item 
 * @param {Set<Geomorph.Decor>} tile
 */
function findApplyReachContaining(item, tile) {
  const point = item.type === 'point' ? item : item.center;
  for (const other of tile) {
    if (other.meta['apply-reach'] === true && tmpRect1.copy(other.bounds2d).contains(point) === true) {
      return other;
    }
  }
  return null;
}

/**
 * - Returns colliders and points intersecting rect
 * - Can filter by room i.e. `grKey`.
 * - Can use larger `d.meta.reachRect` if exists.
 * @param {Geomorph.DecorGrid} grid
 * @param {Geom.RectJson} rect 
 * @param {Geomorph.DecorGridQueryOpts} [opts]
 * @returns {Geomorph.Decor[]}
 */
export function queryDecorGridRect(grid, rect, { grKey, reachRect } = {}) {
  const decor = /** @type {{ [decorId: string]: Geomorph.Decor }} */ ({});
  const [mx, my] = coordToDecorGrid(rect.x, rect.y);
  const [Mx, My] = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  const queryRect = tmpRect1.copy(rect);

  for (let i = mx; i <= Mx; i++) {
    for (let j = my; j <= My; j++) {
      grid[`${i},${j}`]?.forEach(d => {
        if (
          reachRect === true && Array.isArray(d.meta.reachRect)
            ? queryRect.intersectsArgs(.../** @type {[number, number, number, number]} */ (d.meta.reachRect))
            : queryRect.intersects(d.bounds2d)
        ) {
          decor[d.key] = d;
        }
      });
    }
  }

  return grKey === undefined
    ? Object.values(decor)
    : Object.values(decor).filter(({ meta }) => meta.grKey === grKey)
  ;
}

/** @type {Set<Geomorph.Decor>} */
const foundDecor = new Set;

/**
 * - Returns decor in same tiles as line
 * - Does not filter by gmRoomId
 * @param {Geom.Vect} p 
 * @param {Geom.Vect} q 
 * @param {Geomorph.DecorGrid} grid
 * @returns {Geomorph.Decor[]}
 */
export function queryDecorGridLine(p, q, grid) {  
  const tau = tmpVec1.copy(q).sub(p);
  /** Single horizontal step */
  const dx = Math.sign(tau.x);
  /** Single vertical step */
  const dy = Math.sign(tau.y);

  /** `p`'s grid coords */
  const [gpx, gpy] = coordToDecorGrid(p.x, p.y);
  // /** `q`'s grid coords */
  // const gq = coordToDecorGrid(q.x, q.y);

  foundDecor.clear();
  grid[`${gpx},${gpy}`]?.forEach(d => foundDecor.add(d));
  if (dx !== 0 || dy !== 0) {
    /**
     * Those λ ≥ 0 s.t. p + λ.tau on a vertical grid line.
     * Initially minimum such, then the subsequent ones.
     * - General form λ := ((decorGridSize * dx * n) - p.x) / tau.x where n in ℤ
     * - λ ≥ 0 yields n := Math.ceil(± p.x / decorGridSize) 
     */
    let lambdaV = tau.x === 0 ? Infinity : tau.x > 0
        ? ((decorGridSize *  1 * Math.ceil( p.x / decorGridSize)) - p.x) / tau.x
        : ((decorGridSize * -1 * Math.ceil(-p.x / decorGridSize)) - p.x) / tau.x;
    /**
     * Those λ ≥ 0 s.t. p + λ.tau on a horizontal grid line.
     * Initially the minimum such, then the subsequent ones.
     * - General form λ := ((decorGridSize * dy * n) - p.y) / tau.y where n in ℤ
     * - λ ≥ 0 yields n := Math.ceil(± p.y / decorGridSize) 
     */
    let lambdaH = tau.y === 0 ? Infinity : tau.y > 0
      ? ((decorGridSize *  1 * Math.ceil( p.y / decorGridSize)) - p.y) / tau.y
      : ((decorGridSize * -1 * Math.ceil(-p.y / decorGridSize)) - p.y) / tau.y;
    
    let cx = gpx, cy = gpy;

    do {
      if (lambdaV <= lambdaH) {
        cx += dx; // Hit vert grid line 1st, so move horizontal
        lambdaV += (decorGridSize * dx) / tau.x; // Next vert line
      } else {
        cy += dy; // Hit horizontal 1st, so move vert
        lambdaH += (decorGridSize * dy) / tau.y; // Next horizontal line
      }
      grid[`${cx},${cy}`]?.forEach(d => foundDecor.add(d));

      // 🤔 (cx, cy) may not reach `max` in diagonal case?
      // } while ((cx !== max.x) && (cy !== max.y))
    } while (Math.min(lambdaH, lambdaV) <= 1)
  }

  return Array.from(foundDecor);
}

/**
 * Returns `gmId` containing `point` or `null`.
 * @param {Geomorph.GmIdGrid} grid
 * @param {Geom.VectJson} point
 * @returns {number | null} gmId
 */
export function queryGmIdGrid(grid, point) {
  return grid[`${Math.floor(point.x / gmIdGridDim)},${Math.floor(point.y / gmIdGridDim)}`] ?? null;
}

/**
 * @param {Geomorph.Decor} d 
 * @param {Geomorph.DecorGrid} grid 
 */
export function removeFromDecorGrid(d, grid) {
  const [mx, my] = /** @type {[number, number]} */ (d.meta.gridMin);
  const [Mx, My] = /** @type {[number, number]} */ (d.meta.gridMax);
  for (let i = mx; i <= Mx; i++)
    for (let j = my; j <= My; j++)
      grid[`${i},${j}`]?.delete(d);
}

const tmpRect1 = new Rect();
const tmpVec1 = new Vect();
