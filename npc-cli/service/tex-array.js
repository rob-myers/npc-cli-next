import * as THREE from 'three';
import { getContext2d } from './dom';

/**
 * Based on:
 * https://discourse.threejs.org/t/how-can-i-color-the-plane-with-different-colors-as-squares-in-the-same-face/53418/8
 */
export class TexArray {
  
  /** @type {TexArrayOpts} */
  opts;
  /** @type {CanvasRenderingContext2D} */
  ct;
  /** @type {THREE.DataArrayTexture} */
  tex;

  /**
   * @param {TexArrayOpts} opts
   */
  constructor(opts) {
    if (opts.numTextures === 0) {
      throw Error(`${'TexArray'}: numTextures cannot be 0`);
    }

    this.opts = opts;
    this.ct = getContext2d(opts.ctKey, { willReadFrequently: true });
    this.ct.canvas.width = opts.width;
    this.ct.canvas.height = opts.height;
    
    const data = opts.type === THREE.FloatType
      ? new Float32Array(opts.numTextures * 4 * opts.width * opts.height)
      : new Uint8Array(opts.numTextures * 4 * opts.width * opts.height)
    ;
    this.tex = new THREE.DataArrayTexture(data, opts.width, opts.height, opts.numTextures);
    this.tex.format = THREE.RGBAFormat;
    this.tex.type = opts.type ?? THREE.UnsignedByteType;
  }

  dispose() {
    // We don't `this.ct.canvas.{width,height} = 0`,
    // because context is cached under `opts.ctKey`.
    this.tex.dispose();
  }

  /**
   * Resize if needed i.e. if "dimension" or "number of textures" has changed.
   * @param {Omit<TexArrayOpts, 'ctKey'>} opts
   */
  resize(opts) {
    if (this.ct.canvas.width !== 0 && opts.width === this.opts.width && opts.height === this.opts.height && opts.numTextures === this.opts.numTextures) {
      return; // resize not needed
    }

    Object.assign(this.opts, opts);

    this.ct.canvas.width = opts.width;
    this.ct.canvas.height = opts.height;
    
    this.tex.dispose();

    const data = opts.type === THREE.FloatType
      ? new Float32Array(opts.numTextures * 4 * opts.width * opts.height)
      : new Uint8Array(opts.numTextures * 4 * opts.width * opts.height)
    ;
    this.tex = new THREE.DataArrayTexture(data, opts.width, opts.height, opts.numTextures);
    this.tex.format = THREE.RGBAFormat;
    this.tex.type = opts.type ?? THREE.UnsignedByteType;
  }

  update() {
    this.tex.needsUpdate = true;
  }

  /**
   * @param {number} index
   * @param {Uint8Array | Float32Array} [data]
   */
  updateIndex(index, data, rowOffset = 0) {
    const offset = index * (4 * this.opts.width * this.opts.height) + rowOffset * 4 * this.opts.width;
    const imageData = data ?? this.ct.getImageData(0, 0, this.opts.width, this.opts.height).data;
    /** @type {Uint8Array | Float32Array} */ (this.tex.image.data).set(imageData, offset);
    
    // ℹ️ three.js clears these layers after next render
    this.tex.addLayerUpdate(index);
    this.tex.needsUpdate = true; // 🚧

  }
}

/**
 * @typedef {{ tex: THREE.CanvasTexture; ct: CanvasRenderingContext2D }} TextureItem
 */

/**
 * @typedef TexArrayOpts
 * @property {number} opts.numTextures
 * @property {number} opts.width
 * @property {number} opts.height
 * @property {string} opts.ctKey key for cached canvas context
 * @property {THREE.UnsignedByteType | THREE.FloatType} [opts.type]
 */

export const emptyTexArray = new TexArray({ ctKey: 'empty', width: 0, height: 0, numTextures: 1 });
