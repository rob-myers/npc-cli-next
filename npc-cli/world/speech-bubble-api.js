import * as THREE from 'three';
import { npcSpeechBubbleOpacityCssVar, speechBubbleBaseScale } from './NpcSpeechBubbles';

/**
 * 🔔 Avoid `foo = (...bar) => baz` because incompatible with our approach to class HMR.
 */
export class SpeechBubbleApi {

  baseScale = /** @type {undefined | number} */ (speechBubbleBaseScale);
  /** For violating React.memo */
  epochMs = 0;
  
  /** @type {import('../components/Html3d').State} */
  html3d = /** @type {*} */ (null);
  
  position = new THREE.Vector3();
  tracked = /** @type {undefined | import('../components/Html3d').TrackedObject3D} */ (undefined);
  offset = { x: 0, y: 0, z: 0 };

  /** @type {BubbleOption[]} */
  options = [];
  /** Can hide non-empty options */
  hideOptions = false;
  visible = true;

  /**
   * @param {string} key
   * @param {import('./World').State} w
   */
  constructor(key, w) {
    /** @type {string} */
    this.key = key;
    /** @type {import('./World').State} */
    this.w = w;
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

  /** @param {React.WheelEvent} e */
  forwardWheelEvents = (e) => {
    e.stopPropagation();
    this.w.view.canvas.dispatchEvent(new WheelEvent(e.nativeEvent.type, e.nativeEvent));
  }

  /** @param {null | import('../components/Html3d').State} html3d */
  html3dRef(html3d) {
    html3d !== null
      ? this.html3d = html3d // @ts-ignore
      : delete this.html3d;
  }

  /** @param {number} opacityDst */
  setOpacity(opacityDst) {
    this.html3d.rootDiv.style.setProperty(npcSpeechBubbleOpacityCssVar, `${opacityDst}`);
  }

  /** @param {BubbleOption[] | ((prev: BubbleOption[]) => BubbleOption[])} input */
  setOptions(input) {
    this.options = typeof input === 'function' ? input(this.options) : input;
    this.update();
  }

  /**
   * @param {import('../components/Html3d').TrackedObject3D} [tracked] 
   */
  setTracked(tracked) {
    this.tracked = tracked;
  }

  update = noop

}

function noop() {};

/**
 * @typedef {{ key: string; label: string; }} BubbleOption
 */