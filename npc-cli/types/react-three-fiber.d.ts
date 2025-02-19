import { Object3D } from "three";
import { Object3DNode, ThreeElements } from "@react-three/fiber";

declare global {
  namespace React.JSX {
    interface IntrinsicElements extends ThreeElements {
      /** `object` assumed to extend `THREE.Object3D` */
      primitive: Object3DNode<Object3D, typeof Object3D> & { object: Object3D };
    }
  }
}
