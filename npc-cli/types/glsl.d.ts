import { type ThreeElement } from '@react-three/fiber'
declare module '@react-three/fiber' {
  
  interface SupportsObjectPick {
    objectPick?: boolean;
  }
  type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;
  type Vector2Input = import('three').Vector2Tuple | import('three').Vector2;

  interface ThreeElements {

    cameraLightMaterial: ThreeElement<typeof import('three').ShaderMaterial> & {
      diffuse?: Vector3Input;
      opacity?: number;
      objectPickRed?: number;
    };

    humanZeroShader: ThreeElement<typeof import('three').ShaderMaterial> & {
      atlas: import('three').DataArrayTexture;
      aux: import('three').DataArrayTexture;
      diffuse?: Vector3Input;
      label: import('three').DataArrayTexture;
      labelHeight: number;
      labelTriIds: number[];
      opacity?: number;
      uid: number;
    } & SupportsObjectPick;

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
      colorSpace?: boolean;
      diffuse?: Vector3Input;
      atlas: import('three').DataArrayTexture;
      /** Red component in [0..255] used by objectPick rgba */
      objectPickRed?: number;
      opacity?: number;
    } & SupportsObjectPick;

  }
}
