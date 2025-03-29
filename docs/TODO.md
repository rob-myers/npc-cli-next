# TODO

## Branch `clean-npc-shaders`

- ✅ create `human-0.blend`
  - ✅ move notes into docs/npc-shader-redo.md
  - ✅ copy `cuboid-man.blend` to `human-0.blend`
  - ✅ remove label-quad, selector-quad
- ✅ can see in World (profile-1)
  - ✅ export `public/3d/human-0.glb`
  - ✅ branch on specific npc key i.e. `temp-new-shader-npc`
  - ℹ️ `selectedNpcKey=temp-new-shader-npc`

- ❌ extend geometry at runtime with label-quad, selector-quad
  - ℹ️ we're already using hard-coded vertex indices to define shader,
       so might as well visually represent them in Blender
- ✅ human-0 has:
  - ✅ vertex ordering:
    -   head (8)
      < body (8)
      < head-overlay (8)
      < body-overlay (8)
      < breath-quad (4)
      < selector-quad (4)
      < label-quad (4)
  - ✅ label-quad as unit XY quad (three.js world coords)
  - ✅ selector-quad as unit XZ quad (three.js world coords)
  - ✅ scale, so can use scale `1`
  - ✅ overlay head (replaces/extends face)
  - ✅ overlay body (replaces/extends icon)
  - ❌ hands
- ✅ `human-0.tex.svg` texture layout
  - ℹ️ https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE
  - ℹ️ head dimension 0.5m³, body dimension 0.5m * 0.5m * 1m
  - ℹ️ head overlay scale: 1.05 (0.525m³)
  - ℹ️ body overlay scale: 1.05 (0.525m * 0.525m * 1.05m)
  - ✅ return to using non-unital scale (0.7) in code
    - ℹ️ otherwise our head/body dimension are not as nice
  - ✅ assets script generates WEBP skins
  - ✅ head same dim as body XZ
  - ✅ resize selector quad to "correct size" (1.2m side) i.e. not unit quad
  - ✅ define skin texture layout w.r.t to head, body, overlays etc.
    - ✅ example body layout
    - ✅ example head layout
    - ℹ️ overlays are just particular body/head layout
    - ℹ️ 2048 * 2048
    - ✅ use temp skin human-0-wip.tex.svg
    - ✅ skin template has transparency
    - ✅ remap head ✅ head overlay ✅
      - ℹ️ base head overlay could have face only
      - uv-map "base" head (cuboid edge look)
      - uv-map "base" head-overlay (face)
    - ✅ remap body ✅ and body overlay ✅
      - uv-map "base" body (cuboid edge look)
      - uv-map "base" body-overlay (jacket? icon?)
    - ✅ copy temp skin to human-0.tex.svg and remove human-0-wip.tex.svg
    - ✅ remap label quad
      - transparent 64x64 at top left
    - ✅ remap selector quad
    - ✅ remap breath quad
  - ✅ skins: supports non-nested group
    - collapses to e.g. `{groupName}-{groupName}-{leafName}
    - ℹ️ e.g. `base-body-front`
- ✅ skins: test WEBP in dev, use in prod
- ✅ human-0: "skins" DataTextureArray (one layer per skin)
  - ℹ️ temp include legacy skins e.g. cuboid-man
  - ✅ build texture array `w.texSkin`
- ✅ human-0: start custom shader
  - uniform "atlas" is `w.texSkin`
- ✅ new shader is hot-reloaded
- ✅ fix texture-naming convention
  - ℹ️ multiple models support same skin e.g. `human-{0,1,2}`
  - ✅ remove cuboid-pet
  - ✅ human-0.tex.svg -> human-skin-0.0.tex.svg
  - ✅ change texture sheet names
    - e.g. `human-skin-0.0.tex.svg` (sheet 0)
  - ✅ skin class e.g. `human-skin-0`
  - ✅ can iterate over (skinClassKey, sheetId)
  - ✅ npcClassToMeta[npcClassKey] has `skinClassKey`

- ✅ infer `texSkinId` from gltf texture filename
  - ℹ️ geomorphs.skins.texArrayId[skinClassKey][sheetId] where sheetId comes from texture filename
- ✅ pass `texSkinId` into shader
- ✅ compute "triangle -> uvKey" mapping
  - ℹ️ `w npc.skinTriMap | json`
  - ✅ provide geomorphs.skins.uvMap[uvKey].sheetId (relative to skinClassKey)
  - ✅ test triangle centers against "uv-keyed rectangles"
  - ✅ verify/fix lookup
  - ✅ label uv-mapped properly
- ✅ shader maps "triangle id" to "uv offset"
  - ℹ️ "provoking vertex id" is last id in `w.npc.skinTriMap[triId].vertexIds`
  - ✅ `w.texSkinUvs` DataTextureArray has 256 layers (one per npc)
  - ✅ shader receives uvReMap
  - ✅ hard-coded example re-map in shader overlay-head -> overlay-head
  - ✅ use triangle id instead of "provoking vertex id" because cannot assume (v0,v1,v2) -> v2 injective
    > https://discourse.threejs.org/t/blender-gltf-export-do-distinct-triangles-always-have-distinct-final-vertex/79507
  - ✅ HMR onchange npc.drawUvReMap
    - ℹ️ we always invoke on hot-reload npc
  - ✅ same hard-coded example but encoded in uvReMap
    - ✅ ensure uvReMap is being updated
  - ✅ move selector/breath/label quad up i.e. no 32-pixel-gap
    - requires changing UV map in Blender too
  - ✅ clarify re-map format
    - ✅ every uvRectKey has a skinPartKey
    - ℹ️ an atomic remapping amounts to `{ skinPartKey, dst: [uvRectKey: string, texArrayId: number] }`
    - ✅ `w.npc.initSkinMeta.map` -> `w.npc.initSkinMeta.triToKey`
    - ✅ `w.npc.initSkinMeta.partToUv` i.e. skinPartKey -> initial uvRectKey -> uvRect
    - ✅ `w.npc.initSkinMeta` -> `w.npc.skinInit`
    - ✅ support skin from other npcClass
      - `skinPartKey -> { prefix: string; npcClassKey?: string; }`
  - ✅ remove skinClassKey i.e. npcClassKey determines unique skin
    - ✅ `Key.SkinClass` -> `Key.NpcClass`
    - ✅ update SVG assets
    - ✅ regenerate PNG/WEBP
    - ✅ update in Blender
  - ✅ can handle negative uv offsets
    - ℹ️ TexArray supports type `THREE.FloatType` (default `THREE.UnsignedByteType`)
  - ✅ precompute shared object per npcClassKey so `changeUvMap` is cleaner
  - ✅ general approach
  - ✅ remove hard-coded `npc.uvReMap` and apply in profile-1 instead
    - ✅ can `w n.rob.skin | assign '{ foo: "bar" }'`
    - ✅ move hard-coding to profile-1
- ✅ can tint skinParts via "second row" of `w.texUvReMap`
  - ✅ call it `w.npcAuxTex` i.e. auxiliary DataTextureArray for npcs
  - ❌ permit prefixes of Key.SkinPart
  - ✅ move hard-coded tint into profile-1

- ❌ good examples of skin in profile-1
  - ✅ test-body_base-body
  - ✅ test-body-overlay_base-body-overlay

- ✅ improve human-0
  - ✅ smaller head
  - ✅ possibly red eyes
  - ✅ improve body icon
  - ℹ️ faces
    - `w n.rob.skin | assign '{ "head-overlay-front": { prefix: "base" } }' && w n.rob.applySkin`
    - `w n.rob.skin | assign '{ "head-overlay-front": { prefix: "confused" } }' && w n.rob.applySkin`
    - `w n.rob.skin | assign '{ "head-overlay-front": { prefix: "small-eyes" } }' && w n.rob.applySkin`
  - ✅ basic icons i.e. body-overlay-front
    - `w n.rob.skin | assign '{ "body-overlay-front": { prefix: "robot-icon" } }' && w n.rob.applySkin`
    - `w n.rob.skin | assign '{ "body-overlay-front": { prefix: "heart-icon" } }' && w n.rob.applySkin`
    - `w n.rob.skin | assign '{ "body-overlay-front": { prefix: "plus-icon" } }' && w n.rob.applySkin`
    - `w n.rob.skin | assign '{ "body-overlay-back": { prefix: "plus-icon", otherPart: "body-overlay-front" } }' && w n.rob.applySkin`
  - ✅ tinting
    - ℹ️ tint.{x,y,z} = diffuse.{x,y,z} + 0.25 * tint.{x,y,z}
    - `w n.rob.tint | assign '{ "body-overlay-front": [1, 0, 0, 0.8] }' && w n.rob.applyTint`
    - `w n.rob.tint | assign '{ "body-top": [1, 1, 0, 1] }' && w n.rob.applyTint`
  - ✅ better alt body

- ✅ can show/hide/tint selector
- ✅ can object-pick new npc

- ✅ represent label images as 256-layer DataTextureArray
  - ℹ️ requires bounds on max width/height of label
  - ✅ colour it red
  - ✅ position correctly
    - ℹ️ we're relying on dimensions set in Blender
  - ✅ render npc.key
  - ✅ try avoid label flicker via larger UV area
    - ✅ fix Blender UVs slight error
    - ✅ detect label min/max uvs
    - ❌ try modify attribute uv
      - ℹ️ decided against expanding label uvs (non-idempotent + hmr)
    - ✅ separate npc.skinAux into npc.sheetAux and npc.skinAux
    - ❌ larger label uv quad in human-0.tex and Blender
      - ℹ️ we're trying to keep things uniform i.e. label is like everything else
      - ℹ️ if really need to resolution can move label to own area on far right
    - ✅ forward uv label rect into npc shader to avoid hard-coding
      - ✅ remove width, height hard-coding
      - ✅ can offset along x-axis
      - ✅ can offset along y-axis
  - ✅ can show/hide/tint label
    - ℹ️ hide label `w n.rob.setLabel`
    - ℹ️ show label `w n.rob.setLabel foo`
    - ℹ️ hide label `w n.rob.showLabel`
    - ℹ️ show label `w n.rob.showLabel true`
    - can tint using e.g.
      ```ts
      npc.tint.label = [1, 0.5, 0.5, 1];
      npc.applyTint();
      ```
  - ✅ ensure label hidden during object-pick (seems it is in front of floor)
    - not why it works?
  - ✅ clarify label max length

- ✅ ensure we're doing partial texture updates e.g. when npc.applySkin
  - https://threejs.org/examples/webgl_materials_texture_partialupdate.html

- ✅ remove cuboid-man
- ✅ remove code from profile-awaitWorld and move to profile-1
- ✅ npc object-pick ignores selector quad
  - apply alpha from aux uniform (1st row)

- ✅ sometimes object-pick stops working for a bit
  - seems label was getting in the way (no longer rendered in object-pick)

- ✅ npc label positioning
  - ✅ npc labelHeight uniform is height off floor i.e. world y position
  - ✅ directly change npc labelHeight onchange animation
    - no need for render
  - ✅ use offsets animHeights[animKey] and modelLabelHeight

- ✅ npc speech bubble replaces label when present
  - ✅ same "position" as label (although label centred)
- ❌ npc speech bubble has larger font
- ✅ npc speech bubble prefixed with npc key e.g. `rob: foo bar baz`

- 🚧 fade context menu on spawn
  - ✅ can manually fade ContextMenu whilst not docked
  - ✅ ContextMenu tracks `{ npcKey, object3d, offset }`
  - 🚧 fade tracked npc fades non-docked ContextMenu
- fade speech bubble on spawn

- another model human-1

### Extras

- ✅ mobile ContextMenu touch issue
- ❌ npc should not stop so suddenly near doorway
- ✅ implement `+=` s.t. `c+=1` would increment if `c` numeric

- ✅ overload `+=` to work on JS objects
  - `x=$( expr { foo: 42 } ) && x+='{ bar: 1024 }' && x`
- ✅ less abrupt turn just after doorway
  - ✅ slow down turn during main offMesh seg
    - less abrupt but initial turn can be too slow
  - ❌ try initially turning before start moving
    - ℹ️ slow acceleration can trigger onTickDetectStuck
    - ℹ️ problem happens near offMeshConnection, where uniform velocity enforced
    - ℹ️ could set slow speed through door if start nearby

- ✅ more abrupt walk -> idle when collide

- 🚧 improve assets script
  - ✅ more measurements in assets script
  - ✅ fix `yarn clean-assets`
  - ✅ use loadImage of svgPath instead of data-url
  - 🚧 faster run onchange skin

- if lookAt while walking, eventually lookAt once stopMoving
- prevent intersection when two npcs move diagonally through doorway
  - forbid (src,dst)'s intersection
  - forbid dst's close to each other

- 🚧 cuboids have outlines via shader, using UVs
  - ✅ can see outlines on decor cuboids
  - ℹ️ box geometry has 12 triangles with ordering:
    > right x2, left x2, front x2, back x2, top x2, bottom x2
  - 🚧 fix scaling (non-trivial)

- ✅ fix `w npc.remove`
  - we were `w npc.remove rob_{0..7}` where later did not exist
  - we now always finally update
- ✅ fix spawn onto decor point orientation

- ✅ fix object-pick of door-light from certain angles
  - something to do with npc

- `w | json` crashed
- `w | pretty` is huge

- ✅ remove npc `<select>` from ContextMenu opts
- try to simplify walk smoothing "hacks"
- follow cam zoom should be centred on followed
- follow option should be tinted when in use

- ✅ improve ContextMenu 3d position when npc Lie

## Dev env

- ✅ Npc texture PNG -> WEBP
- ✅ HMR breaking on close/open laptop
  - ℹ️ works in Firefox but not in Chrome
  - ℹ️ seems next.js is using a WebSocket
    > https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/react-dev-overlay/utils/use-websocket.ts
  - ℹ️ https://issues.chromium.org/issues/361372969
  - ✅ reconnect websocket in patch

- ✅ BUG: geomorphs.skins.uvMap not being updated onchange file
  - ℹ️ needed to define canSkip over all sheets, not per sheet

- 🚧 generated decor/obstacles/skin png,webp distinct on different laptops
  - ✅ migrate `canvas` to `skia-canvas`
  - ✅ migrate `skia-canvas` to `@napi-rs/canvas`
  - 🚧 still seeing webp diff
    - personal laptop: `cwebp -version` is `1.3.0` `libsharpyuv: 0.2.0`
    - work laptop: `1.5.0 libsharpyuv: 0.4.1`
    - ❌ update personal laptop `brew install cwebp`
      - didn't work (apparently need to upgrade OSX 15)
    - ✅ manually added
      - https://developers.google.com/speed/webp/docs/precompiled
      - `cwebp -version` is `1.5.0 libsharpyuv: 0.4.1` 

- ✅ skins: support inherited transforms on `<g>`
  - ℹ️ we often make this mistake

- ✅ migrate `canvas` to `skia-canvas`
  - ℹ️ https://www.npmjs.com/package/skia-canvas
- ✅ migrate `skia-canvas` to `@napi-rs/canvas`
  - ℹ️ https://github.com/Brooooooklyn/canvas

- 🚧 `skia-canvas` issues:
  - fill pattern in human-0.1.tex not working 
    - https://github.com/samizdatco/skia-canvas/issues/219
    - ℹ️ `@napi-rs/canvas` has issue too
  - composite point light in human-0.0.tex not working 

- ✅ HMR of GLTF i.e. GLB
  - ✅ detect glb change and trigger code
  - ✅ provide npcClassKey -> glb hash in `geomorphs.json`
  - ✅ `<NPCs>` useGLTF hook refetches via url query param
  - ✅ for each npcClassKey do mesh normalization i.e. un-weld (for all)
  - ✅ for each skinClassKey recompute "triangleId -> [{ uvRectKey }, ...]"
    - ℹ️ `w npc.initSkinMeta | json`
  - ✅ geomorphs.sheet.skins -> geomorphs.skin
  - ✅ re-initialize npcs
    - ✅ can see new mesh on export GLB from Blender
    - ✅ fix animations
    - ✅ dispose previous

- ✅ avoid reference `NPC` namespace in `Geomorph` namespace
  - migrate to new namespace `Key.*`

- ✅ BUG: unmount `<Floor>` empties npcs
  - ℹ️ previously `<Floor>` was an earlier sibling, but no issue when later sibling

- ✅ images hash should be based on SVGs in case of skins

- support 

- warn if uv-map is not a grid (where rows/cols can have different size)

- Dev-only: Fix Emotion Hydration warning
  - Does not appear when `yarn dev-assets`
- HMR of MDX subcomponents
- HMR of npc models onchange const

- ✅ try `bun` https://bun.sh/
  - ℹ️ `yarn assets-bun` is failing due to `canvas` (node-canvas)
  - ℹ️ did not work with `skia-canvas`
  - ℹ️ worked with `@napi-rs/canvas`
  - ℹ️ a bit faster than sucrase-node

# Done

## Migrate from Gatsby

- ✅ next-mdx-remote
  - https://github.com/hashicorp/next-mdx-remote?tab=readme-ov-file
  - https://github.com/etuong/next-mdx/blob/main/pages/post/%5Bslug%5D.js
  - ℹ️ https://spacejelly.dev/posts/mdx-in-nextjs
  - ✅ frontmatter
  - ✅ use some components: Card, SideNote
  - ✅ sync tailwind config

- ✅ emotion ssr
  - https://emotion.sh/docs/ssr
  - https://github.com/emotion-js/emotion/issues/2978#issuecomment-2393603295
  - https://github.com/emotion-js/emotion/issues/2928#issuecomment-1293012737
  - ✅ compiler emotion: true in next.config.ts
  - ✅ emotion/css -> emotion/react
  - ✅ fix fontawesome css flash

- ✅ sync Root.tsx with `npc-cli` (not `npc-cli-next-old`)
  - ✅ migrate Nav, Main, Comments
  - ✅ migrate Viewer
    - ✅ finish migrating Tabs
    - ✅ migrate ViewerControls
  - ✅ migrate world/*
    - ✅ uncomment npc-cli/sh/src/game-generators.js
    - ✅ also npc-cli/tabs/tab-factory.ts
    - ✅ try fix assets e.g. app/api/dev-web-sockets.js
      - ℹ️ https://blog.logrocket.com/implementing-websocket-communication-next-js/
      - ℹ️ `GET http://localhost:8012/dev-assets/geomorphs.json?v=1740052354192`
      - ✅ `/geomorphs.json?v=1740052354192` resolves to `/public/geomorphs.json`
    - ✅ get Decor mounting
    - ✅ Web Worker working in webpack
    - ✅ Web Worker working in turbopack
    - ✅ Web Worker working in build
  - ✅ fix Floor/Ceiling colours

- ✅ avoid build minification of e.g. game-generators.js
  - ✅ turned off minification in next.config.ts
  - ✅ does import from public still minify? yes
  - ❌ try import at runtime from public
  - ❌ try patch node_modules/next/dist/build/webpack/plugins/minify-webpack-plugin/src/index.js
  - ✅ refine arrow function detection
- ✅ BUG: tty: option-arrow left/right not working
- ✅ patch-package + patches

- ✅ src/app -> app etc.
- ✅ deploy to netlify
- ✅ avoid crash on multiple terminals tty-1 and tty-2
  - turn off zustand/devtool on session.store

- ✅ fix "initial stress test" for useEffect in `<BaseTty>`
  - https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
  - ✅ set next.config.ts `reactStrictMode` as `false`

- ✅ fix ContextMenu
  - maybe need `@emotion/css` for `<Html3d>`

- ✅ asset.js script -> World communication
  - ℹ️ https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
  - ℹ️ https://github.com/vercel/next.js/discussions/48427#discussioncomment-5624604
  - ✅ can POST http://localhost:3000/send-dev-event in dev
    - next.config `output` cannot be `export` in dev
    - had to move `app/api` temporarily during build
  - ✅ can POST /send-dev-event in dev without moving files
    - use `export const dynamic = 'force-static';` in route.ts
  - ✅ POST http://localhost:3000/send-dev-event can send event to browser
    - ℹ️ https://github.com/vercel/next.js/discussions/48427#discussioncomment-9791770
    - ✅ can connect SSE via /api/connect-dev-events and send initial message to browser
  - ✅ implement POST http://localhost:3000/send-dev-event
  - ✅ can clean up connections
    - ✅ need some way to tell server we're finished
      - "static export" prevents /foo/[uid]/bar and query params,
      - however, maybe can send POST with JSON?
    - ✅ on reload page
    - ✅ on hmr: avoid by storing as `window.__DEV_EVENTS__EventSource__`
  - ✅ clean up our approach
  - ✅ browser reacts to server-sent event

- ✅ BUG: can change map via Viewer Tabs props without breaking component?
  - _fiber.refCleanup is not a function
  - need to fix various World subcomponent refs i.e. should be `ref={state.ref('foo')}`
- ✅ fix three-stdlib patch i.e. change the file next.js is using

- ✅ migrate assets.js script
  - ✅ store geomorphs.json in public
  - ✅ npm scripts
    ```json
    ✅ "ts-script": "ts-node -r tsconfig-paths/register -O '{ \"module\": \"commonjs\", \"isolatedModules\": false }'",
    ✅ "assets": "npm run ts-script scripts/assets -- --all",
    ✅ "assets-fast": "sucrase-node scripts/assets",
    ✅ "clean-assets": "rm static/assets/{assets.json,geomorphs.json} static/assets/2d/{obstacles,decor}.png{,.webp}",
    ✅ "cwebp": "npm run ts-script scripts/cwebp",
    ✅ "cwebp-fast": "sucrase-node scripts/cwebp",
    ✅ "get-pngs": "npm run ts-script scripts/get-pngs",
    ✅ "get-pngs-fast": "sucrase-node scripts/get-pngs",
    ✅ "watch-assets": "source scripts/watch-assets.sh",
    ✅ "watch-assets-nodemon": "sucrase-node scripts/assets-nodemon.js",
    ✅ "pre-push": "npm run assets-fast -- --prePush"
    ```
  - ✅ migrate enough media/* to get assets.js working
  - ✅ generate decor
  - ✅ cwebp-fast

- ✅ clean fetch-assets file

- ❌ try fix `yarn build` breaking `yarn dev`
  - https://github.com/vercel/next.js/issues/61228
- ❌ maybe move flexlayout-react/style/light.css "back" into layout.tsx
  - originally needed in Gatsby but we'll leave as is

## Branch `avoid-full-page-refresh`

- ✅ changing blog page should not remount
  - ℹ️ priority issue!
  - ✅ create two basic test pages `app/test/page{1,2}` Link between them without full-page-refresh
  - ✅ try adding Root to app/layout.tsx
    - ℹ️ this fixes the main issue!
  - ✅ somehow pass `data.frontmatter` into Root
    - ℹ️ to fix main issue we hard-coded Root's meta prop
    - ✅ use `<script id="frontmatter-json"/>` whose contents is stringified frontmatter

### Extras

- ✅ fix npc hot reloading
- ❌ do final strafe when final edge small and "angular"

- ✅ improve turning through door
  - ❌ turn npc using `dampLookAt` instead of `dampAngle`
  - ✅ can "lookahead" along 3 segment path
  - ✅ delay "look follows velocity" by hard-coded amount
    - ℹ️ RecastDetour believes the velocity matches `main` segment,
         meaning the npc may briefly turn in the wrong direction
  - ✅ issue when nextCorner ~ dst (when traverse either side of doorway)
    - nextUnit can be null

  - ✅ extend dtAgentAnimation with unitExitVel locally (recast-navigation-js)
  - ✅ can see `agentAnim.unitExitVel` locally
    - ℹ️ must use webpack i.e. `yarn dev-webpack`
  - ✅ overrideOffMeshConnectionAngle overrides `agentAnim.unitExitVel`
  - ✅ npc look overrides `agentAnim.unitExitVel`
  - ✅ publish to scoped npm module
  - ✅ use scoped npm module

## Branch `clean-npc-shaders`

### Extras

- ✅ npc's shouldn't turn towards nearest neighbour as much
- ❌ sometimes direction through door is wrong
  - ℹ️ maybe fixed by new approach
- ❌ `w.npc.remove` should trigger render while paused

- ✅ fix react-pro-sidebar
  - added patch
  ```js
  // node_modules/react-pro-sidebar/dist/index.es.js
      React__default.useEffect(function () {
          setTimeout(function () { return popperInstance === null || popperInstance === void 0 ? void 0 : popperInstance.update(); }, sidebarTransitionDuration);
          if (!collapsed && level === 0) {
              setOpenWhenCollapsed(false);
              // ? if its useful to close first level submenus on collapse sidebar uncomment the code below
              // setOpen(false);
          }
      }, [collapsed, level, rtl, sidebarTransitionDuration, popperInstance]);
  ```
- ✅ try zero velocity exit from offMesh into small room