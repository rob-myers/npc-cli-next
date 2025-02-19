declare global {
  namespace React.JSX {

    type BaseExtendedShaderMaterial<T = {}> = import('@react-three/fiber').Object3DNode<
      import('three').ShaderMaterial,
      typeof THREE.ShaderMaterial
    > & T;

    type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;
    type Vector2Input = import('three').Vector2Tuple | import('three').Vector2;
    
    type Texture = import('three').Texture;

    interface SupportsObjectPick {
      objectPick?: boolean;
    }

    interface IntrinsicElements {
      instancedMonochromeShader: BaseExtendedShaderMaterial<{
        diffuse?: Vector3Input;
        opacity?: number;
      } & SupportsObjectPick>;

      // instancedUvMappingMaterial: BaseExtendedShaderMaterial<{
      //   map: import('three').CanvasTexture;
      // }>;

      instancedLabelsMaterial: BaseExtendedShaderMaterial<{
        map: import('three').CanvasTexture;
        // ...
      }>;

      instancedMultiTextureMaterial: BaseExtendedShaderMaterial<{
        alphaTest?: number;
        colorSpace?: boolean;
        diffuse?: Vector3Input;
        atlas: import('three').DataArrayTexture;
        /** Red component in [0..255] used by objectPick rgba */
        objectPickRed?: number;
        opacity?: number;
      } & SupportsObjectPick>;

      cameraLightMaterial: BaseExtendedShaderMaterial<{
        diffuse?: Vector3Input;
        opacity?: number;
      }>;

      cuboidManMaterial: BaseExtendedShaderMaterial<{
        uNpcUid?: number;
        diffuse?: Vector3Input;
        opacity?: number;

        showLabel?: boolean;
        labelHeight?: number;
        showSelector?: boolean;
        selectorColor?: Vector3Input;

        uBaseTexture: Texture;
        uLabelTexture: Texture;
        uAlt1Texture: Texture;

        uFaceTexId?: number;
        uIconTexId?: number;
        uLabelTexId?: number;

        uFaceUv?: Vector2Input[];
        uIconUv?: Vector2Input[];
        uLabelUv?: Vector2Input[];

        uLabelDim?: Vector2Input;
      } & SupportsObjectPick>;
    }
  }
}

export {}; // Required
