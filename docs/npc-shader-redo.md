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

