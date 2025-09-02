import { Rect, Vect } from "../geom";
import { decorGridSize } from "./const";

/**
 * @param {Geomorph.Decor} item 
 * @param {Geomorph.DecorGrid} grid 
 */
export function addToDecorGrid(item, grid) {
  const rect = item.bounds2d;
  const [mx, my] = coordToDecorGrid(rect.x, rect.y);
  const [Mx, My] = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  // const max = coordToDecorGridSupremum(rect.x + rect.width, rect.y + rect.height);
  // For easy deletion
  item.meta.gridMin = [mx, my];
  item.meta.gridMax = [Mx, My];
  for (let i = mx; i <= Mx; i++)
    for (let j = my; j <= My; j++)
      (grid[`${i},${j}`] ??= new Set()).add(item);
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
 * - Returns colliders and points intersecting rect
 * - Can filter by room i.e. `grKey`.
 * @param {Geomorph.DecorGrid} grid
 * @param {Geom.RectJson} rect 
 * @param {Geomorph.GmRoomKey} [grKey]
 * @returns {Geomorph.Decor[]}
 */
export function queryDecorGridIntersect(grid, rect, grKey) {
  const decor = /** @type {{ [decorId: string]: Geomorph.Decor }} */ ({});
  const [mx, my] = coordToDecorGrid(rect.x, rect.y);
  const [Mx, My] = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  const testRect = tmpRect1.copy(rect);

  for (let i = mx; i <= Mx; i++) {
    for (let j = my; j <= My; j++) {
      grid[`${i},${j}`]?.forEach(x => {
        if (testRect.intersects(x.bounds2d) === true) {
          decor[x.key] = x
        }
      });
    }
  }
  
  return grKey === undefined
    ? Object.values(decor)
    : Object.values(decor).filter(({ meta }) => meta.grKey === grKey)
  ;
};

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
