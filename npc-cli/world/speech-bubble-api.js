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
  /** @type {import('../components/PopUp').State} */
  popUp = /** @type {*} */ (null);
  
  position = new THREE.Vector3();
  tracked = /** @type {null | import('../components/Html3d').TrackedObject3D} */ (null);
  offset = { x: 0, y: 0, z: 0 };

  /** Can hide non-empty options */
  hideOptions = false; // 🚧 remove
  options = /** @type {string[]} */ ([]); // 🚧 remove
  speech = /** @type {string | null} */ (null);
  thought = /** @type {{ [key: string]: NPC.BubbleThought }} */ ({});

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
    this.tracked = null;
    this.update = noop;
    // @ts-ignore
    this.w = null;
    this.html3dRef(null);
  }

  /**
   * @param {string} thoughtKey 
   */
  forget(thoughtKey) {
    delete this.thought[thoughtKey];
    this.update();
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
    if (html3d !== null) {
      this.html3d = html3d;
    } else {// @ts-ignore
      delete this.html3d;
    }
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

  /** @param {null | import('@/npc-cli/components/PopUp').State} popUp */
  popUpRef(popUp) {
    if (popUp !== null) {
      this.popUp = popUp;
    } else {// @ts-ignore
      delete this.popUp;
    }
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
   * @param {import('../components/Html3d').TrackedObject3D} tracked
   */
  setTracked(tracked) {
    this.tracked = tracked;
  }

  /** Show label iff this isn't shown */
  syncNpcLabel() {
    const npc = this.w.n[this.key];
    npc.showLabel(!this.visible);
    this.w.update(); // render while paused
  }

  /**
   * Add thought
   * @param {string} thoughtKey 
   * @param {...string} parts
   */
  think(thoughtKey, ...parts) {
    this.thought[thoughtKey] = {
      key: thoughtKey,
      def: parts.join(' '),
      // e.g. ['get in', ['bed'], 'right now']
      parts: parts.reduce((acc, x) => {
        if (x.startsWith('[')) acc.push([x.slice(1, -1)]);
        else if (typeof acc.at(-1) === 'string') acc[acc.length - 1] += ` ${x}`;
        else acc.push(x);
        return acc;
      }, /** @type {(string | [string])[]} */ ([])),
    };
    this.update();
  }

  update = noop
}

function noop() {};
