import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { emptyDataArrayTexture } from "./three";

const humanZeroShader = {
  Vert: /*glsl*/`

  uniform float labelY;
  uniform int breathTriIds[2];
  uniform int labelTriIds[2];
  uniform int selectorTriIds[2];
  varying float vDotProduct;
  flat varying int triangleId;
  varying vec2 vUv;
  // higher in [0, 1] is lighter
  varying float vHeightShade;
  // label=0, body=1, breath=2, selector=3
  flat varying int vType;

  #include <common>
  #include <uv_pars_vertex>
  #include <skinning_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    #include <uv_vertex>
    #include <skinbase_vertex>
    #include <beginnormal_vertex>
    #include <skinnormal_vertex>

    // since unwelded via geometry.toNonIndexed()
    triangleId = int(gl_VertexID / 3);
    vUv = uv;
    vHeightShade = 1.0;
    
    if (triangleId == labelTriIds[0] || triangleId == labelTriIds[1]) {
      vType = 0; // label
    } else if (triangleId == breathTriIds[0] || triangleId == breathTriIds[1]) {
      vType = 2; // breath
    } else if (triangleId == selectorTriIds[0] || triangleId == selectorTriIds[1]) {
      vType = 3; // selector
    } else {
      vType = 1; // body
      vHeightShade = min(max(pow(position.y / labelY, .75) + 0.1, 0.4), 1.0);
    }
    
    vec3 transformed = vec3(position);
    #include <skinning_vertex>
    vec4 mvPosition;

    if (vType == 0) {// label quad

      // label quad is above head and faces camera
      mvPosition = modelMatrix[3]; // translation
      mvPosition.y = labelY;
      mvPosition = viewMatrix * mvPosition;
      mvPosition.xy += transformed.xy;
      
    } else {// everything else

      mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  
      // 🌞 compute dot product for flat shading
      vec3 transformedNormal = normalize(normalMatrix * vec3(objectNormal));
      vec3 lightDir = -normalize(mvPosition.xyz);
      vDotProduct = dot(transformedNormal, lightDir);
    }
    
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
  `,
  Frag: /*glsl*/`
  
  // skins: 2048 * 2048 * numSkinSheets
  uniform sampler2DArray atlas;

  // 1st row: uv re-mapping (dx, dy, atlasId), and object-pick alpha
  // 2nd row: skin tints
  // depth is max number of npcs
  uniform sampler2DArray aux;
  
  // 0 ~ invert ([0, 0, 0, 0] or [1, 1, 1, 1])
  // ...
  uniform sampler2DArray globalAux;
  
  // 🔔 label must be a quad i.e. two triangles
  uniform sampler2DArray label;
  uniform int labelTriIds[2];
  uniform vec4 labelUvRect4;

  uniform vec3 diffuse;
  uniform float opacity;
  uniform bool objectPick;
  uniform int uid;

  varying float vDotProduct;
  flat varying int triangleId;
  varying vec2 vUv;
  varying float vHeightShade;
  flat varying int vType;

  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  vec4 encodeNpcObjectPick() {
    return vec4(// 8.0 is object-pick identifier
      8.0, float((uid >> 8) & 255), float(uid & 255), 255.0
    ) / 255.0;
  }

  void main() {

    if (objectPick == true) {
      gl_FragColor = encodeNpcObjectPick();
      // hide some triangles e.g. selector, label, breath
      gl_FragColor.a *= texture(aux, vec3(float(triangleId) / 128.0, 0.0, uid)).a;
      #include <logdepthbuf_fragment>
      return;
    }

    bool invert = texture(globalAux, vec3(0.0, 0.0, 0.0)).x == 1.0;

    // tinting (DataArrayTexture has width 128)
    // tint factor is 0.5
    vec4 tint = texture(aux, vec3(float(triangleId) / 128.0, 1.0, uid));
    tint.x = 0.5 * diffuse.x + 0.5 * tint.x;
    tint.y = 0.5 * diffuse.y + 0.5 * tint.y;
    tint.z = 0.5 * diffuse.z + 0.5 * tint.z;
    tint.a *= opacity;

    vec4 texel;
    
    if (vType == 0) {// label=0

      texel = texture(
        label,
        vec3(
          (vUv.x - labelUvRect4.x) * (1.0 / labelUvRect4.z),
          (vUv.y - labelUvRect4.y) * (1.0 / labelUvRect4.a),
          uid
        )
      );

    } else {// body=1, breath=2, selector=3

      if (!invert) {
        // 🌞 flat shading via vDotProduct
        float ambientLight = 0.2;
        tint *= vec4(vec3((ambientLight + 0.8 * vDotProduct) * vHeightShade), 1.0);
      } else {// invert, making selector more visible
        tint = vec4(vec3(vType == 3 ? 4.0 : 0.8), tint.a);
      }

      // skinning
      vec4 uvOffset = texture(aux, vec3(float(triangleId) / 128.0, 0.0, uid));
      float atlasId = uvOffset.z;

      texel = texture(atlas, vec3(vUv.x + uvOffset.x, vUv.y + uvOffset.y, atlasId));

    }

    if (invert) {
      texel.xyz = 1.0 - texel.xyz;
    }

    gl_FragColor = texel * tint;
    #include <logdepthbuf_fragment>

    if (gl_FragColor.a < 0.1) {
      discard; // comment out to debug label dimensions
    }
  }
  `,
};

/** @type {import('@/npc-cli/types/glsl').HumanZeroMaterialProps} */
const humanZeroMaterialDefaultProps = {
  atlas: emptyDataArrayTexture,
  aux: emptyDataArrayTexture,
  globalAux: emptyDataArrayTexture,
  diffuse: new THREE.Vector3(1, 0.9, 0.6),
  label: emptyDataArrayTexture,
  labelY: 0,
  breathTriIds: [],
  labelTriIds: [],
  selectorTriIds: [],
  labelUvRect4: new THREE.Vector4(),
  objectPick: false,
  opacity: 1,
  uid: 0,
};

export const HumanZeroMaterial = shaderMaterial(
  /** @type {import('@/npc-cli/types/glsl').ShaderMaterialArg} */ (
    humanZeroMaterialDefaultProps
  ),
  humanZeroShader.Vert,
  humanZeroShader.Frag,
);

const instancedAtlasShader = {
  Vert: /* glsl */`

  // e.g. can be used to infer gmId
  attribute uint instanceIds;
  attribute vec2 uvDimensions;
  attribute vec2 uvOffsets;
  attribute uint uvTextureIds;

  uniform float opacity;
  uniform float opacityCloseDivisor;

  varying vec3 vColor;
  flat varying uint vInstanceId;
  flat varying vec4 vLitCircle; // (uv.x, uv.y, r, opacity)
  varying float vOpacityScale;
  flat varying uint vTextureId;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    // vUv = uv;
    vUv = (uv * uvDimensions) + uvOffsets;
    vTextureId = uvTextureIds;
    vInstanceId = instanceIds;
    
    vec4 modelViewPosition = vec4(position, 1.0);
    modelViewPosition = instanceMatrix * modelViewPosition;
    modelViewPosition = modelViewMatrix * modelViewPosition;
    gl_Position = projectionMatrix * modelViewPosition;

    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz *= instanceColor.xyz;
    #endif

    #include <logdepthbuf_vertex>

    if (opacityCloseDivisor != 0.0) {
      vOpacityScale = opacity == 1.0 ? 1.0 : (modelViewPosition.z * -1.0) / opacityCloseDivisor;
    } else {
      vOpacityScale = 1.0;
    }
  }
  `,

  Frag: /* glsl */`

  uniform bool lit;
  uniform vec4 litCircle;
  uniform float alphaTest;
  uniform bool objectPick;
  uniform int objectPickRed;
  uniform sampler2DArray atlas;
  uniform vec3 diffuse;
  uniform float opacity;

  varying vec3 vColor;
  flat varying uint vInstanceId;
  flat varying vec4 vLitCircle;
  varying float vOpacityScale;
  flat varying uint vTextureId;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main() {

    vec4 texel = texture(atlas, vec3(vUv, vTextureId));

    if (objectPick == true) {
      if (texel.a < alphaTest) discard;

      gl_FragColor = vec4(
        float(objectPickRed) / 255.0,
        float((int(vInstanceId) >> 8) & 255) / 255.0,
        float(int(vInstanceId) & 255) / 255.0,
        1
      );
    } else {
      if (texel.a * opacity < alphaTest) discard;
      
      gl_FragColor = texel * vec4(vColor * diffuse, opacity * vOpacityScale);
    }

    #include <logdepthbuf_fragment>
  }
  
  `,
};

/** @type {Required<import('@/npc-cli/types/glsl').InstancedAtlasProps>} */
const instancedAtlasDefaultProps = {
  alphaTest: 0.5,
  atlas: emptyDataArrayTexture,
  diffuse: new THREE.Vector3(1, 0.9, 0.6),
  objectPick: false,
  objectPickRed: 0,
  opacity: 1,
  opacityCloseDivisor: 0,
  // 🔔 map, mapTransform required else can get weird texture
  // map: null,
  // mapTransform: new THREE.Matrix3(),
};

/**
 * - Ceiling
 * - Decor quads
 * - Doors
 * - Obstacles
 */
export const InstancedAtlasMaterial = shaderMaterial(
  /** @type {import('@/npc-cli/types/glsl').ShaderMaterialArg} */ (
    instancedAtlasDefaultProps
  ),
  instancedAtlasShader.Vert,
  instancedAtlasShader.Frag,
);

/**
 * Used by cuboids i.e. Decor and Lock-Lights
 * 
 * - Shade color `diffuse` by light whose direction is always the camera's direction.
 * - Assumes InstancedMesh and supports USE_INSTANCING_COLOR
 */
const instancedFlatShader = {
  Vert: /*glsl*/`
  
  attribute uint instanceIds;
  attribute float outlineShade;

  uniform bool quadOutlines;

  varying float dotProduct;
  varying vec3 vColor;
  flat varying uint vInstanceId;
  varying float vOutlineShade;
  varying vec2 vUv;
  varying vec2 vUvScale;

  #include <common>
  #include <uv_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    
    vInstanceId = instanceIds;
    vOutlineShade = outlineShade;
    vUv = uv;

    if (quadOutlines == true) {
      float edgeWidth = 0.025; // relative to unit cuboid
      int triangleId = int(gl_VertexID / 3);
      if (triangleId < 4) {// [dz, dy]
        vUvScale.x = edgeWidth * (1.0 / length(instanceMatrix[2]));
        vUvScale.y = edgeWidth * (1.0 / length(instanceMatrix[1]));
      } else if (triangleId < 8) {// [dx,dz]
        vUvScale.x = edgeWidth * (1.0 / length(instanceMatrix[0]));
        vUvScale.y = edgeWidth * (1.0 / length(instanceMatrix[2]));
      } else {// [dx, dy]
        vUvScale.x = edgeWidth * (1.0 / length(instanceMatrix[0]));
        vUvScale.y = edgeWidth * (1.0 / length(instanceMatrix[1]));
      }
    }

    vec3 objectNormal = vec3(normal);
    vec3 transformed = vec3(position);
    
    vec4 mvPosition = vec4(transformed, 1.0);
    mvPosition = instanceMatrix * mvPosition;
    mvPosition = modelViewMatrix * mvPosition;

    gl_Position = projectionMatrix * mvPosition;

    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz *= instanceColor.xyz;
    #endif

    vec3 transformedNormal = objectNormal;
    mat3 im = mat3(instanceMatrix);
    transformedNormal = im * transformedNormal;
    transformedNormal = normalMatrix * transformedNormal;

    vec3 lightDir = -normalize(mvPosition.xyz);
    dotProduct = dot(normalize(transformedNormal), lightDir);

    #include <logdepthbuf_vertex>
  }
  `,

  Frag: /*glsl*/`

  uniform vec3 diffuse;
  uniform bool objectPick;
  uniform int objectPickRed;
  uniform float opacity;
  uniform bool quadOutlines;

  flat varying uint vInstanceId;
  varying float vOutlineShade;
  varying vec2 vUv;
  varying vec2 vUvScale;
	varying float dotProduct;
  varying vec3 vColor;

  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    vec3 diffuseColor = diffuse;
    #include <logdepthbuf_fragment>
    #include <map_fragment>

    float ambientLight = 0.1;
    float normalLight = 0.7;

    diffuseColor = vColor * diffuseColor;

    if (quadOutlines == true) {
      float dx = vUvScale.x, dy = vUvScale.y;
      if (
        vUv.x <= dx
        || vUv.x >= 1.0 - dx
        || vUv.y <= dy
        || vUv.y >= 1.0 - dy
      ) {
        diffuseColor = vec3(vOutlineShade);
      }
    }

    gl_FragColor = vec4(
      diffuseColor * (ambientLight + normalLight * dotProduct),
      opacity
    );

    if (objectPick == true) {
      gl_FragColor = vec4(
        float(objectPickRed) / 255.0,
        float((int(vInstanceId) >> 8) & 255) / 255.0,
        float(int(vInstanceId) & 255) / 255.0,
        gl_FragColor.a
      );
    }
  }
  `,
};

/** @type {Required<import('@/npc-cli/types/glsl').InstancedFlatProps>} */
const instancedFlatDefaultProps = {
  diffuse: new THREE.Vector3(1, 0.9, 0.6),
  // map: null,
  // mapTransform: new THREE.Matrix3(),
  objectPick: false,
  objectPickRed: 0,
  opacity: 1,
  quadOutlines: false,
};


/**
 * Instanced Flat Shading
 * - Decor cuboids
 * - Door lights
 * - Optional quadOutlines (geometry dependent)
 */
export const InstancedFlatMaterial = shaderMaterial(
  /** @type {import('@/npc-cli/types/glsl').ShaderMaterialArg} */ (
    instancedFlatDefaultProps
  ),
  instancedFlatShader.Vert,
  instancedFlatShader.Frag,
);

const instancedFloorShader = {
  Vert: /* glsl */`

    uniform vec3 torchData;
    uniform vec3 torchTarget;

    attribute vec2 uvDimensions;
    attribute vec2 uvOffsets;
    attribute uint uvTextureIds;
    // e.g. can be used to infer gmId
    attribute uint instanceIds;
  
    varying vec3 vColor;
    varying vec2 vUv;
    flat varying uint vTextureId;
    flat varying uint vInstanceId;

    flat varying vec3 vTorchData;
    // uvs pointing into torchTexture
    // 🤔 could add extra varying per additional torch
    varying vec2 vTorchUv;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      // vUv = uv;
      vUv = (uv * uvDimensions) + uvOffsets;
      vTextureId = uvTextureIds;
      vInstanceId = instanceIds;
      
      vec4 modelViewPosition = vec4(position, 1.0);
      modelViewPosition = instanceMatrix * modelViewPosition;
      modelViewPosition = modelViewMatrix * modelViewPosition;
      gl_Position = projectionMatrix * modelViewPosition;

      vColor = vec3(1.0);
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz *= instanceColor.xyz;
      #endif

      #include <logdepthbuf_vertex>
    }
  `,

  Frag: /* glsl */`

    uniform sampler2DArray lightAtlas;
    uniform bool showLights;
    uniform vec3 torchTarget;
    uniform sampler2D torchTexture;

    uniform float alphaTest;
    uniform sampler2DArray atlas;
    uniform vec3 diffuse;
    uniform bool objectPick;
    uniform int objectPickRed;
    uniform float opacity;

    varying vec3 vColor;
    varying vec2 vUv;
    flat varying uint vTextureId;
    flat varying uint vInstanceId;
    flat varying vec3 vTorchData; // (radius, intensity, opacity)
    varying vec2 vTorchUv;

    #include <common>
    #include <logdepthbuf_pars_fragment>
  
    void main() {

      vec4 texel = texture(atlas, vec3(vUv, vTextureId));

      //#region object-pick 
      if (objectPick == true) {
        if (texel.a < alphaTest) discard;

        gl_FragColor = vec4(
          float(objectPickRed) / 255.0,
          float((int(vInstanceId) >> 8) & 255) / 255.0,
          float(int(vInstanceId) & 255) / 255.0,
          1
        );

        #include <logdepthbuf_fragment>
        
        return;
      }
      //#endregion

      if (texel.a * opacity < alphaTest) discard;
      
      float lighter = 1.0;

      if (showLights == true) {
        vec4 lightTexel = texture(lightAtlas, vec3(vUv, vTextureId));
        lighter *= clamp(4.0 * lightTexel.w, 1.0, 3.0);

        gl_FragColor = texel * vec4(vColor * diffuse * lighter, opacity) * 0.8;
      } else {
        gl_FragColor = texel * vec4(vColor * diffuse * lighter, opacity) * 1.0;
      }
      
      #include <logdepthbuf_fragment>
    }
  
  `,
};

/** @type {Required<import('@/npc-cli/types/glsl').InstancedFloorProps>} */
const instancedFloorDefaultProps = {
  ...instancedAtlasDefaultProps,
  lightAtlas: emptyDataArrayTexture,
  showLights: false,
  torchData: new THREE.Vector3(),
  torchTarget: new THREE.Vector3(),
  torchTexture: /** @type {*} */ (null), // THREE.CanvasTexture
};

/**
 * Floor only
 */
export const InstancedFloorMaterial = shaderMaterial(
  /** @type {import('@/npc-cli/types/glsl').ShaderMaterialArg} */ (
    instancedFloorDefaultProps
  ),
  instancedFloorShader.Vert,
  instancedFloorShader.Frag,
);

/**
 * Use with centered XY quad.
 */
const instancedLabelsShader = {
  Vert: /*glsl*/`

  attribute vec2 uvDimensions;
  attribute vec2 uvOffsets;
  varying vec3 vColor;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    // vUv = uv;
    vUv = (uv * uvDimensions) + uvOffsets;

    // Quad faces the camera
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += position.xy * vec2(instanceMatrix[0][0], instanceMatrix[1][1]);
    gl_Position = projectionMatrix * mvPosition;

    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz *= instanceColor.xyz;
    #endif

    #include <logdepthbuf_vertex>
  }

  `,

  Frag: /*glsl*/`

  varying vec3 vColor;
  varying vec2 vUv;
  uniform sampler2D map;
  uniform vec3 diffuse;
  uniform float opacity;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main() {
    gl_FragColor = texture2D(map, vUv) * vec4(vColor * diffuse, opacity);
    if (gl_FragColor.a < 0.1) {
      discard;
    }
    #include <logdepthbuf_fragment>
  }
  `,
};

export const InstancedLabelsMaterial = shaderMaterial(
  {
    map: null,
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    opacity: 0.6,
    alphaTest: 0.5,
  },
  instancedLabelsShader.Vert,
  instancedLabelsShader.Frag,
);

/**
 * - Monochrome instanced walls.
 * - More transparent the closer you get.
 */
const instancedWallsShader = {
  Vert: /*glsl*/`

  attribute uint instanceIds;

  uniform float opacity;
  uniform float opacityCloseDivisor;

  flat varying uint vInstanceId;
  varying float vOpacityScale;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vInstanceId = instanceIds;

    vec4 modelViewPosition = vec4(position, 1.0);
    modelViewPosition = instanceMatrix * modelViewPosition;
    modelViewPosition = modelViewMatrix * modelViewPosition;

    gl_Position = projectionMatrix * modelViewPosition;
    #include <logdepthbuf_vertex>

    if (opacityCloseDivisor != 0.0) {
      vOpacityScale = opacity == 1.0 ? 1.0 : (modelViewPosition.z * -1.0) / opacityCloseDivisor;
    } else {
      vOpacityScale = 1.0;
    }
  }

  `,

  Frag: /*glsl*/`

  uniform vec3 diffuse;
  uniform bool objectPick;
  uniform float opacity;

  flat varying uint vInstanceId;
  varying float vOpacityScale;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  /**
   * - 1 means wall
   * - vInstanceId in 0..65535: (msByte, lsByte)
   */
  vec4 encodeWallObjectPick() {
    return vec4(
      1.0,
      float((int(vInstanceId) >> 8) & 255),
      float(int(vInstanceId) & 255),
      255.0
    ) / 255.0;
  }

  void main() {

    if (objectPick == true) {
      gl_FragColor = encodeWallObjectPick();
      #include <logdepthbuf_fragment>
      return;
    }
    
    gl_FragColor = vec4(diffuse, opacity * vOpacityScale);
    #include <logdepthbuf_fragment>
  }
  `,
};

/** @type {Required<import('@/npc-cli/types/glsl').InstancedWallsProps>} */
const instancedWallsDefaultProps = {
  alphaTest: 0,
  diffuse: new THREE.Vector3(1, 0.9, 0.6),
  objectPick: false,
  objectPickRed: 0,
  opacity: 1,
  opacityCloseDivisor: 0,
};

export const InstancedWallsMaterial = shaderMaterial(
  /** @type {import('@/npc-cli/types/glsl').ShaderMaterialArg} */ (
    instancedWallsDefaultProps
  ),
  instancedWallsShader.Vert,
  instancedWallsShader.Frag,
);

/**
 * @see glsl.d.ts
 */
extend({
  HumanZeroMaterial,
  InstancedAtlasMaterial,
  InstancedFloorMaterial,
  InstancedFlatMaterial,
  InstancedLabelsMaterial,
  InstancedWallsMaterial,
});
