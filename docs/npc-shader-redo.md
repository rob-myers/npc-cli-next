# Scratchpad

- improve npc svg textures
- two characters: `human-0` and `pet-0`
- auto-extend geometry with label quad and selector quad
- use single DataTextureArray for npc labels and their uvs
- use single DataTextureArray for npc textures and their uvs
- unified material `npcMaterial` (if possible)

- overall setup + plan
  - Npcs.jsx `<Npcs>`
    - loads npc textures into lookup `state.tex`
    - loads npc gltfs into lookup `state.gltf`
  - Npcs.jsx `<Npc>` `<cuboidManMaterial>`
    - keep uNpcUid (pick id)
    - keep labelHeight
    - keep showSelector
    - keep selectorColor + support opacity (`vec4`)
    - add uNpcsDataTex
    - add uLabelsDataTex (pointer is uNpcUid)
    - add uSkin i.e. `vec4` (faceId / 255, iconId / 255, unused, unused)
      - support ≤ 256 faces/icons
  - npc.js
    - remove forceUpdate
    - change setFace
    - change setIcon
    - support setFace/Icon whilst paused?
    - remove setLabel (must equal npc.key)
    - setSelectorRgb supports opacity
  - uv.js
    - store npc label uvs inside DataTextureArray uNpcsDataTex
    - store npc texture uvs inside DataTextureArray uLabelsDataTex
    - maybe represent npc.def.pickId -> {uvData}
  - glsl.js
    - ✅ instancedMonochromeShader -> instancedWallsShader
    - add HumanZeroMaterial
    - add PetZeroMaterial
    - remove CuboidManMaterial


## About UV Mapping

Blender GLTF export replaces each vertex of a cuboid with three copies (one per quad face).

It doesn't do this for the quads (no need).

Can import GLTF and export as OBJ to verify https://threejs.org/editor/

🔔 WebGL2 provoking vertex is LAST by default
  - https://forum.babylonjs.com/t/webgpu-flat-in-out-shader-variable/41171/10

- know part of body via vertex-order
  - head (3 * 8)
    < body (3 * 8)
    < head-overlay (3 * 8)
    < body-overlay (3 * 8)
    < breath quad (1 * 4)
    < selector quad (1 * 4)
    < label quad (1 * 4)
  - 108 vertices in total
  - get npc "temp-npc" triangle indices
    - `w n.temp-npc.m.mesh.geometry.index.array | map 'a => Array.from(a).reduce((agg,x,i) => (i % 3 === 0 ? agg.push([x]) : agg.at(-1).push(x), agg), [])'`
  - de-duped triangle indices
    - `w n.temp-npc.m.mesh.geometry.index.array | map 'a => Array.from(a).map(x => Math.floor(x/3)).reduce((agg,x,i) => (i % 3 === 0 ? agg.push([x]) : agg.at(-1).push(x), agg), [])'`
  - head-front:
    - (0, 1, 4, 5) in Blender
    - de-duping `mesh.geometry.index` we see `[4, 0, 1]`, `[4, 1, 5]` (6th and 7th)
    - looking up 6th and 7th in non-de-duped yields `[12,0,3]` `[12,3,15]`
    - so need to check `3 * 1` and `3 * 5` ✅
  - head-top:
    - (0, 1, 2, 3) in Blender
    - de-duped `[0, 2, 3]` (0th) and `[0, 3, 1]` (1th)
    - non-de-duped `[1,7,10]` `[1,10,4]`
    - so check `3 * 3 + 1` and `3 * 1 + 1` ✅
  - body-front
    - (8, 9, 12, 13) in Blender
    - `[12, 8, 9]` (18th) `[12, 9, 13]` (19th)
    - `[36, 25, 28]` and `[36, 28, 39]`
    - so check `28` and `39` ✅
  - body-left
    - 9, 11, 13, 15
    - 22th, 23th i.e. `[47, 41, 29]` and `[47, 29, 35]`
    - so check `29` and `35` ✅
  - body-right
    - 8, 12, 14, 26
  - head-overlay-front
    - 16, 17, 20, 21
  - body-overlay-front
    - 24, 25, 28, 29 
- know initial uv offset
  - read 'uv' attribute (aligned to 'position')
  - use vertex-ordering to infer e.g. face top-left (careful about uv coords y up)
- know desired uv offset
  - specify via uvKeys
  - infer (u, v) and sheetIndex
- populate "uvs" DataTextureArray for specific npc
  - so can offset vUv in fragment shader
