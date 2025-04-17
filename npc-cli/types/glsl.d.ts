import { type ThreeElement } from '@react-three/fiber'
declare module '@react-three/fiber' {
  
  interface SupportsObjectPick {
    objectPick?: boolean;
  }
  type Vector4Input = import('three').Vector4Tuple | import('three').Vector4Like;
  type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;
  type Vector2Input = import('three').Vector2Tuple | import('three').Vector2;

  interface ThreeElements {

    instancedFlatMaterial: ThreeElement<typeof import('three').ShaderMaterial> & {
      diffuse?: Vector3Input;
      /** Assuming model is built of quads, each with uvs covering [0, 1]x[0, 1] */
      quadOutlines?: boolean;
      opacity?: number;
      objectPickRed?: number;
    } & SupportsObjectPick;

    humanZeroMaterial: (
      ThreeElement<typeof import('three').ShaderMaterial>
      & HumanZeroMaterialProps
    );

    instancedLabelsMaterial: ThreeElement<typeof import('three').ShaderMaterial> & {
      map: import('three').CanvasTexture;
      diffuse?: Vector3Input;
    };

    instancedMonochromeShader: ThreeElement<typeof import('three').ShaderMaterial> & {
      diffuse?: Vector3Input;
      opacity?: number;
    } & SupportsObjectPick;

    instancedMultiTextureMaterial: ThreeElement<typeof import('three').ShaderMaterial> & {
      alphaTest?: number;
      diffuse?: Vector3Input;
      atlas: import('three').DataArrayTexture;
      /** Red component in [0..255] used by objectPick rgba */
      objectPickRed?: number;
      opacity?: number;
    } & SupportsObjectPick;

  }
}

type Vector4Input = import('three').Vector4Tuple | import('three').Vector4Like;
type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;

// 🚧 migrate all custom shaders
export interface HumanZeroMaterialProps {
  atlas: import('three').DataArrayTexture;
  aux: import('three').DataArrayTexture;
  diffuse: Vector3Input;
  label: import('three').DataArrayTexture;
  labelY: number;
  labelTriIds: number[];
  labelUvRect4: Vector4Input;
  /* A default value must be provided for object-pick to work */
  objectPick?: boolean;
  opacity: number;
  uid: number;
}

/** From node_modules/@react-three/drei/core/shaderMaterial.d.ts */
export interface ShaderMaterialArg {
  [name: string]: import('three').CubeTexture | import('three').Texture | Int32Array | Float32Array | import('three').Matrix4 | import('three').Matrix3 | import('three').Quaternion | import('three').Vector4 | import('three').Vector3 | import('three').Vector2 | import('three').Color | MeshBVHUniformStruct | number | boolean | Array<any> | null;
}
