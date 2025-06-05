import { type ThreeElement } from '@react-three/fiber'
declare module '@react-three/fiber' {
  
  interface SupportsObjectPick {
    objectPick?: boolean;
  }
  type Vector4Input = import('three').Vector4Tuple | import('three').Vector4Like;
  type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;
  type Vector2Input = import('three').Vector2Tuple | import('three').Vector2;

  interface ThreeElements {
    humanZeroMaterial: (
      ThreeElement<typeof import('three').ShaderMaterial>
      & HumanZeroMaterialProps
    );
    
    instancedAtlasMaterial: (
      ThreeElement<typeof import('three').ShaderMaterial>
      & InstancedAtlasProps
    );
    
    instancedFlatMaterial: (
      ThreeElement<typeof import('three').ShaderMaterial>
      & InstancedFlatProps
    );

    instancedFloorMaterial: (
      ThreeElement<typeof import('three').ShaderMaterial>
      & InstancedFloorProps
    );

    instancedLabelsMaterial: ThreeElement<typeof import('three').ShaderMaterial> & {
      map: import('three').CanvasTexture;
      diffuse?: Vector3Input;
    };
    
    instancedWallsMaterial: (
      ThreeElement<typeof import('three').ShaderMaterial>
      & InstancedWallsProps
    );
  }
}

type Vector4Input = import('three').Vector4Tuple | import('three').Vector4Like;
type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;

export interface HumanZeroMaterialProps {
  atlas: import('three').DataArrayTexture;
  aux: import('three').DataArrayTexture;
  globalAux: import('three').DataArrayTexture;

  diffuse: Vector3Input;
  label: import('three').DataArrayTexture;
  labelY: number;
  /* A default value must be provided for object-pick to work */
  objectPick?: boolean;
  opacity: number;
  uid: number;

  // 🚧 move to w.texAux
  breathTriIds: number[];
  labelTriIds: number[];
  selectorTriIds: number[];
  labelUvRect4: Vector4Input;
}

export interface InstancedAtlasProps {
  alphaTest: number;
  atlas: import('three').DataArrayTexture;
  diffuse: Vector3Input;
  objectPick?: boolean;
  objectPickRed?: number;
  opacity?: number;
  /** Use value `0` to disable */
  opacityCloseDivisor?: number;
}

export type InstancedAtlasKeys = keyof InstancedAtlasProps;

export interface InstancedFlatProps {
  diffuse?: Vector3Input;
  /** Assuming model is built of quads, each with uvs covering [0, 1]x[0, 1] */
  quadOutlines?: boolean;
  opacity?: number;
  objectPick?: boolean;
  objectPickRed?: number;
}

export interface InstancedFloorProps extends InstancedAtlasProps {
  lightAtlas: import('three').DataArrayTexture;
  showLights?: boolean;
  /** (radius, intensity, opacity) */
  torchData: import('three').Vector3;
  torchTarget: import('three').Vector3;
  torchTexture: import('three').CanvasTexture;
}

export type InstancedFloorKeys = keyof InstancedFloorProps;
export type InstancedFloorUniforms = Record<
  InstancedFloorKeys,
  { value: any }
>;

export interface InstancedWallsProps {
  alphaTest: number;
  diffuse: Vector3Input;
  objectPick?: boolean;
  objectPickRed?: number;
  opacity?: number;
  /** Use value `0` to disable */
  opacityCloseDivisor?: number;
}

/** From node_modules/@react-three/drei/core/shaderMaterial.d.ts */
export interface ShaderMaterialArg {
  [name: string]: import('three').CubeTexture | import('three').Texture | Int32Array | Float32Array | import('three').Matrix4 | import('three').Matrix3 | import('three').Quaternion | import('three').Vector4 | import('three').Vector3 | import('three').Vector2 | import('three').Color | MeshBVHUniformStruct | number | boolean | Array<any> | null;
}
