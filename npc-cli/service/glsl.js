import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import { wallHeight } from "./const";
import { defaultQuadUvs, emptyDataArrayTexture } from "./three";

/** Monochrome */
const instancedWallsShader = {
  Vert: /*glsl*/`

  attribute uint instanceIds;
  uniform float opacity;
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

    // 🚧 remove hard-coded 25.0f
    vOpacityScale = opacity == 1.0 ? 1.0 : (modelViewPosition.z * -1.0) / 25.0f;
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

/**
 * - Shade color `diffuse` by light whose direction is always the camera's direction.
 * - Supports instancing.
 * - Supports a single texture.
 * - We're using this as a guide:
 *   - https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshphong.glsl.js
 *   - https://ycw.github.io/three-shaderlib-skim/dist/#/latest/basic/vertex
 */
export const instancedFlatShader = {
  Vert: /*glsl*/`

  varying float dotProduct;
  varying vec3 vColor;
  flat varying uint vInstanceId;

  attribute uint instanceIds;

  #include <common>
  #include <uv_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    #include <uv_vertex>
    vInstanceId = instanceIds;

    vec3 objectNormal = vec3(normal);
    vec3 transformed = vec3(position);
    vec4 mvPosition = vec4(transformed, 1.0);

    mvPosition = instanceMatrix * mvPosition;
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;

    vec3 transformedNormal = objectNormal;
    mat3 im = mat3( instanceMatrix );
    transformedNormal = im * transformedNormal;
    transformedNormal = normalMatrix * transformedNormal;

    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor.xyz *= instanceColor.xyz;
    #endif

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

  flat varying uint vInstanceId;
	varying float dotProduct;
  varying vec3 vColor;

  #include <common>
  #include <uv_pars_fragment>
  #include <map_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  void main() {
    vec4 diffuseColor = vec4(diffuse, 1);
    #include <logdepthbuf_fragment>
    #include <map_fragment>

    // gl_FragColor = vec4(vColor * diffuse * (0.1 + 0.7 * dotProduct), 1);
    gl_FragColor = vec4(vColor * vec3(diffuseColor) * (0.1 + 0.7 * dotProduct), diffuseColor.a * opacity);

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

export const humanZeroShader = {
  Vert: /*glsl*/`

  uniform float labelHeight;
  uniform int labelTriIds[2];
  varying float dotProduct;
  flat varying int triangleId;
  varying vec2 vUv;

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

    vec3 transformed = vec3(position);
    #include <skinning_vertex>
    vec4 mvPosition;

    if (triangleId == labelTriIds[0] || triangleId == labelTriIds[1]) {

      // label quad is above head and faces camera
      mvPosition = modelViewMatrix * vec4(0.0, labelHeight, 0.0, 1.0);
      mvPosition.xy += transformed.xy;
      
    } else {// everything else

      mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  
      // compute dot product for flat shading
      vec3 transformedNormal = normalize(normalMatrix * vec3(objectNormal));
      vec3 lightDir = -normalize(mvPosition.xyz);
      dotProduct = dot(transformedNormal, lightDir);
  
    }
    
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
  `,
  Frag: /*glsl*/`
  
  // skins 2048 * 2048 * numSkinSheets
  uniform sampler2DArray atlas;

  // 1st row: uv re-mapping (dx, dy, atlasId), and object-pick alpha
  // 2nd row: skin tints
  // depth is max number of npcs
  uniform sampler2DArray aux;
  
  // 🔔 label must be a quad i.e. two triangles
  uniform sampler2DArray label;
  uniform int labelTriIds[2];

  uniform vec3 diffuse;
  uniform float opacity;
  uniform bool objectPick;
  uniform int uid;

  varying float dotProduct;
  flat varying int triangleId;
  varying vec2 vUv;

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
      gl_FragColor.a *= texture(aux, vec3(float(triangleId) / 128.0, 0.0, uid)).a;
      return;
    }

    // tinting (DataArrayTexture has width 128)
    vec4 tint = texture(aux, vec3(float(triangleId) / 128.0, 1.0, uid));
    tint *= vec4(diffuse, opacity);

    vec4 texel;
    
    if (triangleId == labelTriIds[0] || triangleId == labelTriIds[1]) {// label quad

      // 🚧 avoid hard-coding
      texel = texture(
        label,
        vec3(vUv.x * (1.0 / 0.0625), 1.0 - (1.0 - vUv.y) * (1.0 / 0.015625), uid)
      );

    } else {// everything else

      tint *= vec4(vec3(0.1 + 0.7 * dotProduct), 1.0); // flat shading

      // skinning
      vec4 uvOffset = texture(aux, vec3(float(triangleId) / 128.0, 0.0, uid));
      float atlasId = uvOffset.z;

      texel = texture(atlas, vec3(vUv.x + uvOffset.x, vUv.y + uvOffset.y, atlasId));
      
    }

    gl_FragColor = texel * tint;
    #include <logdepthbuf_fragment>

    if (gl_FragColor.a < 0.1) {
      discard; // comment out to debug label dimensions
    }
  }
  `,
};

export const instancedMultiTextureShader = {
  Vert: /* glsl */`

    attribute vec2 uvDimensions;
    attribute vec2 uvOffsets;
    attribute uint uvTextureIds;
    // e.g. can be used to infer gmId
    attribute uint instanceIds;
  
    varying vec3 vColor;
    varying vec2 vUv;
    flat varying uint vTextureId;
    flat varying uint vInstanceId;

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

    uniform float alphaTest;
    uniform bool objectPick;
    uniform bool colorSpace;
    uniform int objectPickRed;
    uniform sampler2DArray atlas;
    uniform vec3 diffuse;
    uniform float opacity;

    varying vec3 vColor;
    varying vec2 vUv;
    flat varying uint vTextureId;
    flat varying uint vInstanceId;

    #include <common>
    #include <logdepthbuf_pars_fragment>
  
    void main() {
      gl_FragColor = texture(atlas, vec3(vUv, vTextureId)) * vec4(vColor * diffuse, opacity);

      if (gl_FragColor.a < alphaTest) {
        discard; // stop transparent pixels taking precedence
      }

      if (objectPick == true) {
        gl_FragColor = vec4(
          float(objectPickRed) / 255.0,
          float((int(vInstanceId) >> 8) & 255) / 255.0,
          float(int(vInstanceId) & 255) / 255.0,
          1
        );
      }
      
      if (colorSpace == true) {
        #include <colorspace_fragment>
      }

      #include <logdepthbuf_fragment>
    }
  
  `,
};

export const InstancedWallsShader = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.5, 0.5),
    objectPick: false,
    opacity: 1,
  },
  instancedWallsShader.Vert,
  instancedWallsShader.Frag,
);

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
 * - Ceiling
 * - Decor quads
 * - Doors
 * - Obstacles
 * - Floor
 */
export const InstancedMultiTextureMaterial = shaderMaterial(
  {
    alphaTest: 0.5,
    atlas: emptyDataArrayTexture,
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    // 🔔 map, mapTransform required else can get weird texture
    // map: null,
    // mapTransform: new THREE.Matrix3(),
    colorSpace: false,
    objectPick: false,
    objectPickRed: 0,
    opacity: 1,
  },
  instancedMultiTextureShader.Vert,
  instancedMultiTextureShader.Frag,
);

/**
 * Instanced Flat Shading
 * - Decor cuboids
 * - Door lights
 */
export const InstancedFlatMaterial = shaderMaterial(
  {
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    // 🔔 map, mapTransform required else can get weird texture
    map: null,
    mapTransform: new THREE.Matrix3(),
    objectPick: false,
    objectPickRed: 0,
    opacity: 1,
  },
  instancedFlatShader.Vert,
  instancedFlatShader.Frag,
);

export const HumanZeroMaterial = shaderMaterial(
  {
    atlas: emptyDataArrayTexture,
    aux: emptyDataArrayTexture,
    diffuse: new THREE.Vector3(1, 0.9, 0.6),
    label: emptyDataArrayTexture,
    labelHeight: 0,
    labelTriIds: [],
    objectPick: false,
    opacity: 1,
    uid: 0,
  },
  humanZeroShader.Vert,
  humanZeroShader.Frag,
);

/**
 * @see glsl.d.ts
 */
extend({
  InstancedMonochromeShader: InstancedWallsShader,
  InstancedLabelsMaterial,
  InstancedMultiTextureMaterial,
  InstancedFlatMaterial,
  HumanZeroMaterial,
});
