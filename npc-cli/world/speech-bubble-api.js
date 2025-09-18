import * as THREE from 'three';
import { npcSpeechBubbleOpacityCssVar } from './NpcSpeechBubbles';

/**
 * 🔔 Avoid function-valued properties: our HMR strategy doesn't handle them,
 * in particular they won't be overwritten when the function is changed.
 */
export class SpeechBubbleApi {

  /** For violating React.memo */
  epochMs = 0;
  
  /** @type {import('../components/Html3d').State} */
  html3d = /** @type {*} */ (null);
  
  position = new THREE.Vector3();
  tracked = /** @type {undefined | import('../components/Html3d').TrackedObject3D} */ (undefined);
  offset = { x: 0, y: 0, z: 0 };

  /** Can hide non-empty options */
  hideOptions = false;
  options = /** @type {string[]} */ ([]);
  speech = /** @type {string | null} */ (null);

  get visible() {
    return (
      this.speech !== null
      || (this.hideOptions === false && this.options.length > 0) 
    );
  }

  /**
   * @param {string} key
   * @param {import('./World').State} w
   */
  constructor(key, w) {
    /** @type {string} */
    this.key = key;
    /** @type {import('./World').State} */
    this.w = w;
    /** @type {string} */
    this.selectElName = `${key}-bubble-options`;
  }

  dispose() {
    this.tracked = undefined;
    this.update = noop;
    // @ts-ignore
    this.w = null;
    this.html3dRef(null);
  }

  /**
   * @param {React.WheelEvent} e
   */
  forwardWheelEvents(e) {
    e.stopPropagation();
    this.w.view.canvas.dispatchEvent(new WheelEvent(e.nativeEvent.type, e.nativeEvent));
  }

  /** @param {null | import('../components/Html3d').State} html3d */
  html3dRef(html3d) {
    html3d !== null
      ? this.html3d = html3d // @ts-ignore
      : delete this.html3d;
  }

  /**
   * @param {React.ChangeEvent<HTMLSelectElement>} e
   */
  onChangeSelect(e) {
    const selected = e.currentTarget.value;
    if (selected === '') {
      return;
    }
    this.w.events.next({ key: 'select-option', npcKey: this.key, option: selected });
  }

  /** @param {number} opacityDst */
  setOpacity(opacityDst) {
    this.html3d.rootDiv.style.setProperty(npcSpeechBubbleOpacityCssVar, `${opacityDst}`);
  }

  /**
   * ```js
   * // e.g.
   * setOptions('foo', 'bar')
   * setOptions(opts => [...opts, 'baz'])
   * ```
   * @param {...string | ((prev: string[]) => string[])} inputs
   */
  setOptions(...inputs) {
    this.options = inputs.flatMap(input =>
      typeof input === 'function' ? input(this.options) : input
    );
    this.update();
    return this.options;
  }

  /**
   * @param {import('../components/Html3d').TrackedObject3D} [tracked] 
   */
  setTracked(tracked) {
    this.tracked = tracked;
  }

  update = noop

  updateNpcLabel() {// shown iff this isn't
    const npc = this.w.n[this.key];
    npc.showLabel(!this.visible);
    this.w.update(); // render while paused
  }
}

function noop() {};
