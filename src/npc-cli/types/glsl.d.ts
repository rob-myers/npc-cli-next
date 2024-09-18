declare global {
  namespace JSX {

    type BaseExtendedShaderMaterial<T = {}> = import('@react-three/fiber').Object3DNode<
      import('three').ShaderMaterial,
      typeof THREE.ShaderMaterial
    > & T;

    type Vector3Input = import('three').Vector3Tuple | import('three').Vector3Like;
    
    interface IntrinsicElements {
      instancedMonochromeShader: BaseExtendedShaderMaterial<{
        diffuse?: Vector3Input;
        objectPicking?: boolean;
      }>;
      instancedSpriteSheetMaterial: BaseExtendedShaderMaterial<{
        map: import('three').CanvasTexture;
        diffuse?: Vector3Input;
      }>;
      cameraLightMaterial: BaseExtendedShaderMaterial<{
        diffuse?: Vector3Input;
      }>;
      testCharacterMaterial: BaseExtendedShaderMaterial<{
        map?: import('three').Texture;
        diffuse?: Vector3Input;
        showLabel?: boolean;
        showSelector?: boolean;
        selectorColor?: Vector3Input;
      }>;
    }
  }
}

export {}; // Required
