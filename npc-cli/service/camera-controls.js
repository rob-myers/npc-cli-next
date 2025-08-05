// import { EventDispatcher } from "node_modules/@react-three/drei/node_modules/three-stdlib/controls/EventDispatcher";
import * as THREE from "three";
import { EventDispatcher, PerspectiveCamera } from "three";
import { deltaAngle } from "maath/misc";


/**
 * 🚧
 * Based on:
 * > https://github.com/pmndrs/three-stdlib/blob/main/src/controls/OrbitControls.ts
 */
export class CameraControls extends EventDispatcher {
  /** @type {PerspectiveCamera} */
  object;
  /** @type {HTMLElement} */
  domElement;
  /** Set to false to disable this control */
  enabled = true;
  /** "target" sets the location of focus, where the object orbits around */
  target = new THREE.Vector3();
  /** How far you can dolly in and out ( PerspectiveCamera only ) */
  minDistance = 0;
  maxDistance = Infinity;
  /** How far you can zoom in and out ( OrthographicCamera only ) */
  minZoom = 0;
  maxZoom = Infinity;
  /** How far you can orbit vertically, upper and lower limits.
   * Range is 0 to Math.PI radians. */
  minPolarAngle = 0;
  maxPolarAngle = Math.PI;
  /** How far you can orbit horizontally, upper and lower limits.
   * If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI ) */
  minAzimuthAngle = -Infinity;
  maxAzimuthAngle = Infinity;
  // /** Set to true to enable damping (inertia)
  //  * If damping is enabled, you must call controls.update() in your animation loop */
  // enableDamping = true;
  dampingFactor = 0.05;
  /**
   * This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
   * Set to false to disable zooming.
   */
  enableZoom = true;
  zoomSpeed = 1.0;
  /** Set to false to disable rotating */
  enableRotate = true;
  rotateSpeed = 1.0;
  /** Set to false to disable panning */
  enablePan = true;
  panSpeed = 1.0;
  /** if false, pan orthogonal to world-space direction camera.up */
  screenSpacePanning = true;
  keyPanSpeed = 7.0;
  zoomToCursor = false;

  target0 = new THREE.Vector3();
  position0 = new THREE.Vector3();
  zoom0 = 1;

  spherical = new THREE.Spherical();
  sphericalDelta = new THREE.Spherical();

  STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_PAN: 4,
    TOUCH_DOLLY_PAN: 5,
    TOUCH_DOLLY_ROTATE: 6,
  };

  state = this.STATE.NONE;

  /** Update state */
  u = {
    offset: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    quat: new THREE.Quaternion(),
    quatInverse: new THREE.Quaternion(),
    lastPosition: new THREE.Vector3(),
    lastQuaternion: new THREE.Quaternion(),
  };

  /**
   * @param {PerspectiveCamera} object 
   * @param {HTMLElement} domElement 
   */
  constructor(object, domElement) {
    super();

    this.object = object;
    this.domElement = domElement;

    this.target0.copy(this.target);
    this.position0.copy(this.object.position);
    this.zoom0 = this.object.zoom;

    this.u.quat.setFromUnitVectors(this.object.up, this.u.up);
    this.u.quatInverse.copy(this.u.quat).invert();
  }

  getAzimuthalAngle() {
    return this.spherical.theta;
  }

  getDistance() {
    return this.object.position.distanceTo(this.target);
  }

  getPolarAngle() {
    return this.spherical.phi;
  }

  reset() {
    this.target.copy(this.target0);
    this.object.position.copy(this.position0);
    this.object.zoom = this.zoom0;
    this.object.updateProjectionMatrix();

    this.dispatchEvent({ type: 'change' });
    
    this.update();

    this.state = this.STATE.NONE;
  }

  saveState() {
    this.target0.copy(this.target);
    this.position0.copy(this.object.position);
    this.zoom0 = this.object.zoom;
  }

  /** @param {number} angle */
  setAzimuthalAngle(angle) {
    this.sphericalDelta.phi = deltaAngle(this.spherical.phi, angle);
    this.update();
  }

  /** @param {number} angle */
  setPolarAngle(angle) {
    this.sphericalDelta.theta = deltaAngle(this.spherical.theta, angle);
    this.update();
  }

  // 🚧
  update() {
    const u = this.u;
    const object = this.object;;
    const position = object.position;

    u.quat.setFromUnitVectors(object.up, this.u.up);
    u.quatInverse.copy(u.quat).invert();

    u.offset.copy(position).sub(this.target);

    // 🚧
    // rotate offset to "y-axis-is-up" space
    u.offset.applyQuaternion(u.quat);
    // angle from z-axis around y-axis
    this.spherical.setFromVector3(u.offset);

    this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
    this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;

    // restrict theta to be between desired limits
  }
}
