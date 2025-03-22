import * as THREE from 'three';

/**
 * 🔔 Avoid `foo = (...bar) => baz` because incompatible with our approach to class HMR.
 */
export class SpeechBubbleApi {

  baseScale = /** @type {undefined | number} */ (undefined);
  /** For violating React.memo */
  epochMs = 0;
  
  position = new THREE.Vector3();
  tracked = /** @type {undefined | import('../components/Html3d').TrackedObject3D} */ (undefined);
  offset = { x: 0, y: 0, z: 0 };
  
  open = false;

  /** @type {import('../components/Html3d').State} */
  html3d = /** @type {*} */ (null);

  /**
   * @param {string} key
   * @param {import('./World').State} w
   */
  constructor(key, w) {
    /** @type {string} */ this.key = key;
    /** @type {import('./World').State} */ this.w = w;
  }

  /** @type {string | undefined} */
  speech = undefined;

  dispose() {
    this.tracked = undefined;
    this.update = noop;
    // @ts-ignore
    this.w = null;
    this.html3dRef(null);
  }

  /** @param {null | import('../components/Html3d').State} html3d */
  html3dRef(html3d) {
    html3d !== null
      ? this.html3d = html3d // @ts-ignore
      : delete this.html3d;
  }

  /**
   * @param {import('../components/Html3d').TrackedObject3D} [tracked] 
   */
  setTracked(tracked) {
    this.tracked = tracked;
  }

  update = noop

  // 🚧 depends on number of lines of text
  updateOffset() {
    const npc = this.w.n[this.key];

    switch (npc.s.act) {
      case 'Idle':
      case 'Run':
      case 'Walk':
        this.offset.y = 1.5 + 0.1;
        break;
      case 'Lie':
        this.offset.y = 0.9;
        break;
      case 'Sit':
        this.offset.y = 1.6;
        break;
    }
  }
}

function noop() {};
