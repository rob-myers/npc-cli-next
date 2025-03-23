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

    // 🚧 remove
    cuboidManMaterial: ThreeElement<typeof import('three').ShaderMaterial> & {
      uNpcUid?: number;
      diffuse?: Vector3Input;
      opacity?: number;

      showLabel?: boolean;
      labelHeight?: number;
      showSelector?: boolean;
      selectorColor?: Vector3Input;

      uBaseTexture: import('three').Texture;
      uLabelTexture: import('three').Texture;
      uAlt1Texture: import('three').Texture;

      uFaceTexId?: number;
      uIconTexId?: number;
      uLabelTexId?: number;

      uFaceUv?: Vector2Input[];
      uIconUv?: Vector2Input[];
      uLabelUv?: Vector2Input[];

      uLabelDim?: Vector2Input;
    } & SupportsObjectPick;

    humanZeroShader: ThreeElement<typeof import('three').ShaderMaterial> & {
      atlas: import('three').DataArrayTexture;
      aux: import('three').DataArrayTexture;
      label: import('three').DataArrayTexture;
      labelTriIds: number[];
      opacity?: number;
      uid: number;
    };

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
