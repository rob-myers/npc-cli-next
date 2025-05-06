# TODO

## Branch `start-blog`

### Site

- ✅ refactor Tabs
  - ✅ remove `tabset._${tabsKey}` tabsets
  - ✅ move restore from localStorage out of tabs
    - ℹ️ it is preventing us from overwriting tabs layout
    - ✅ move restore from localStorage out of Tabs and into site.store
      - ✅ useSite.api.tryRestoreLayout
      - ✅ hook up useSite.api.tryRestoreLayout
    - ✅ move save to localStorage out of Tabs and into site.store
      - ✅ `<Tabs>` onModelChange does not `storeModelAsJson(props.id, state.model)`
      - ✅ `<Viewer>` stores instead, using tabsKey
  - ✅ remember layout on reset
    - ✅ sync `tabset.current` with `tabs.model`
    - ℹ️ we'll lose its previous state, so need keys `_${tabsetKey}` after all
  - ✅ fix hard reset
    - ✅ try restore from `_${tabsetKey}`
  - ✅ localStorage includes `tabsets-meta` as `{ currentKey, allKeys }`
    - includes underscore keys
  - ✅ use `tabset-meta` on initially create site.store
  - ✅ fix HMR of Tabs related files
    - ✅ onchange site.store (HMR) reverts to initial layout
      - ✅ avoid Tabs remount
    - ✅ onchange site.store (HMR) breaks hard reset
      - `<Tabs>` useStateRef was references stale `props.
    - ✅ onchange tab-factory reverts to initial layout
      - ✅ avoid Tabs remount onchange tab-util
    - ✅ onchange Root (trigger `useSite.api.createTabset`) loses some state?
  - ❌ keep tabset.current immutable while using Tabs UI
    - we won't update per flexlayout-react update, but we will change on reset (ViewerControls)
  - ✅ can change tabs programmatically without unmount
    - we can directly change `tabset.current` without overwriting "original tabset"

- 🚧 write 1st blog (npc cli)
  - ✅ more content
  - ✅ add a carousel
  - 🚧 can somehow change tabs from blog
    - ✅ mechanism for links with href `/internal/...` to trigger code in `<Viewer>`
    - ✅ `tabset` has structure `{ key: string; def: TabDef[][]; }`
    - ✅ store lookup `tabset` and `tabset.current` in site.store
    - ✅ can set tabset by clicking link
    - ✅ avoid idempotence of fragment identifier?
      - e.g. `#/internal/set-tabs/empty` then `#/internal/noop`
    - ✅ can reset tabset by clicking link
    - ✅ can set restore point for tabsetKey
      - when ensureTabset can choose whether to `preserveRestore`
      - ℹ️ we now track all UI changes in `tabset[current.key]`
    - ✅ can add Viewer tab by clicking link
      - ✅ ensure hard-coded tab is in layout
      - ✅ ensure specific tab is selected
      - ✅ handle case where another tab maximised
      - ✅ remove hard-coding of tab
        - ✅ can open HelloWorld as hello-world-${opts.suffix}
        - ✅ can open Tty with `env={WORLD_KEY:"test-world-1",PROFILE:"awaitWorld"}`
        - ✅ can open World with `suffix=2&mapsKey=small-map-1}`
        - ✅ index.mdx link for tty tab with spaces in PROFILE
        - ✅ clean e.g. move to site.store
    - ✅ can remove Viewer tab by clicking link
    - 🚧 strategy for tabsets with added tabs
      - ℹ️ we'll add/remove tabs to our tabsets over time, so
      - ℹ️ validating tabset ids doesn't make much sense;
      - ℹ️ however it'll be useful to "hot reload" tabset layouts
      - ✅ `tabset` lookup has only 3 keys:
        - `current` provided as Prop to `<Tabs>` (rarely changes)
        - `synced` changes in sync with flexlayout-react
        - `restore` restore point
      - ✅ can change component tab props e.g. World mapKey
      - ✅ cleanup function on restore from localStorage
        - currently a noop
      - ✅ fix/clarify Tabs refresh after add/remove node
      - ✅ fix/clarify createOrRestoreJsonModel Error
        - removed it
      - ✅ localStorage remembers tabset, including resets
      - close tab should select some other tab in tabset
      - support HMR update tabset somehow
      - clean hard-coded initialization in `<Root>`
  - more content
  - mention Starship Geomorphs early
  - mention recent improvements in AI
    - NPC CLI could use them as tools

- 🚧 refine chosen carousel embla-carousel
  - ✅ carousel has labels
  - 🚧 improve images in first carousel
    - three images
    - improve second image
  - clean carousel css e.g. more css variables
  - auto png to webp in public/images

- start adding cypress
- basic help page
- basic about page
- write 1st dev blog
  - ℹ️ aligned to npc cli too i.e. focus on how various subsystems were built
- sketch 1st automata blog
  - ℹ️ nondeterministic automata language-theoretically
  - summary of pre-existing academic work
- Tabs: debug is global among Tab instances
  - defunct if we remove debug i.e. always paused when paused

### World

- 🚧 BUG: after multiple invokes of e.g. `w view.tween '{ fov: 30 }'`,
  agents stop moving, and start to animate very slowly
  - ℹ️ can fix by pausing that `w stopTick` then playing
  - ℹ️ seems both `w.onTick` and `w.onDebugTick` are running
  - ℹ️ `w view.tween '{ fov: 30 }'` was jerky when eps was 1

- ✅ BUG: testOffMeshDisjoint does not handle case where npcs face each
  - ✅ non-diagonal rectangle intersection

- 🚧 improve floor lighting
  - ✅ show hard-coded "light circle" in floor shader
  - ✅ light circle has basic gradient
  - ✅ light circle moves with camera
    - ✅ fix shader code i.e. edge geomorphs are not full-height
  - ✅ light circle scales up and down
  - ✅ light circle opacity can change
  - move Floor to separate shader
  - provide inverse matrices as uniform (more efficient)
  - remove post-processing
  - fix issue with npc target height 1.5 but floor light target should be 0
  - try radial gradient texture
  - npcs are lighter within light circle
  - ❌ try many fixed lights e.g. via DataTexture or DataArrayTexture
  - ❌ could try "light image" again where distinct light's rect's don't overlap

- ✅ profile-1 tweens continue when should be paused
  - `w view.tween '{ look: {x:0,y:0,z:0}, lookOpts: {smoothTime: 5} }'`
  - ℹ️ can continue whilst initially paused inside profile,
    BECAUSE tweens can run whilst paused too
  - ✅ can explicitly specify `permitPaused: false`

- `w`: support auto-cancel of promise-return-valued functions
  - e.g. `w view.tween '{ look: {x:0,y:0,z:0}, lookOpts: {smoothTime: 5} }'`
  - i.e. if return value is Promise can store reject in cleanups?

- fade ContextMenu and SpeechBubble (as before) on World resize
  - needed again because we now debounce render

- BUG: sit on chair, get off it, right click decor point: its meta should not be mutated
- BUG: profile-1: pause during initial tween ineffective

- ✅ doorway collision strategy:
  - ℹ️ no collision if other has same direction and is "more than a radius ahead"
  - ℹ️ no collision if other is "totally disjoint"
  - ✅ can test if other "more than a radius ahead"
  - ✅ can test if "totally disjoint"
  - ✅ hook em up
  - ℹ️ witnessed jerk on exit due to change staticSeparationWeight -> movingSeparationWeight
  - ✅ fix bad traversal onenter small room
    - `testOffMeshDisjoint` now checks if offMesh src's are too close
  - ℹ️ seems crowd agent radius was too large

- fix run through doorway

- clarify staticSeparationWeight = movingSeparationWeight = 0.5
  - probably don't want this in general
  - it avoids jerk onexit doorway "in parallel"

- ✅ BUG: flicker after two npcs go through door
  - offMeshConnection should have been cancelled, or npc should have slowed down
  - seems "ahead npc" was stopping because detected nearby npc, we turned off this test

- ✅ three more minecraft skin migrations (total 5)
  - ✅ medic-0
    - https://namemc.com/skin/194c3366860674c0
  - ✅ suit-0
    - https://namemc.com/skin/7271372bc0b9bc89
  - ✅ police-0
    - https://namemc.com/skin/c06caf409cd8427e

- 🚧 cleanup human-0 skin
  - ✅ Blender: overlay cuboids should be double-sided
    - then can remove `Side={THREE.DoubleSide}`
  - ✅ Blender: space out initial skin: separate head from body along x-axis
  - can redirect head-overlay and body-overlay to "empty"
  - base_head-overlay -> robot_head-overlay (with more detail)
  - base_body-overlay -> robot_body-overlay (with more detail)
  - small-eyes -> robot-face-0
  - confused -> robot-face-1

- 🚧 post-processing api
  - ✅ can manually load effects via `w view.extractPostEffects`
  - ✅ auto load effects via `w view.extractPostEffects`
  - ✅ can enable/disable post-processing
  - can animate post-processing i.e. set uniform on Vignette

- try "turn around before moving" via small acceleration initially
  - could also "pause before moving"
- profile-1 camera target y should always be 1.5?
- consider "hot keys" e.g. 1, 2, 3, also tapable
  - could use to change camera settings
  - could use to change input settings e.g. drag select
- ❌ move "x-ray" into PopUp opts?
- testOffMeshDisjoint: diagonal doors initially transform lineSegs


- ✅ shell should show debugs not errors
  - sometimes still show errors e.g. on mvdan-sh parse error
- avoid "speed up before collision" near door
  - seems related to enter offMeshConnection
- somehow additionally indicate npc is selected by ContextMenu when docked
- another model human-1
- tween: provide many examples
- if lookAt while walking, eventually lookAt once stopMoving
- onTickDetectStuck more general approach
  - saw fire when npc no longer stuck causing bad stop
  - maybe check if closest neighbour is in front too

- consider CSS vignette instead of post-processing
  - https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient

- ❌ when w.view.enableControls show "ui disabled icon"

- bug: sh
  - multi-line edit using Option+Enter not working (need repro)
  - paste multiline command and start Option-Deleting midway  (need repro)
  - ctrl + w while multiple input: goes back a line (need repro)

### Dev Env

- ✅ fix hmr of blogs
  - ❌ https://github.com/gaearon/overreacted.io/pull/797/files

- ✅ migrate back to standard next.js mdx solution
  - ℹ️ https://nextjs.org/docs/pages/building-your-application/configuring/mdx
  - ✅ /test/mdx works with hot-reloading
  - ✅ can statically export pages: /blog2/index
  - ✅ `export metadata` approach can replace frontmatter
  - ✅ /blog2 -> /blog1 and remove `next-remote-mdx`

- ❌ @napi-rs/canvas `&quot;` issue
  - https://github.com/Brooooooklyn/canvas/issues/1029
  - https://boxy-svg.com/bugs/431/bad-and-quot-s-broken-urls-and-svg-attributes
  - `skia-canvas` issues:
    - https://github.com/samizdatco/skia-canvas/issues/219
    - 🚧 possibly just an issue with `&quot;` inside url.
  - ✅ find a fix which removes them e.g. `url(&quot;#foo&quot;)` -> `url(#foo)`
    - `yarn test-svg-to-png media/debug/test-gradient-fill.svg`
  - ❌ prefer BoxySVG fix rather than apply our fix (for the moment)
  - apparently an upstream issue
    - https://skia.googlesource.com/skia/

- ✅ we should update PROFILE when "linked to file" e.g. profile-1.sh
  - ℹ️ we need PROFILE to update onchange profile-1.sh
  - ℹ️ currently can only force via `useSite.api.setTabset(..., { overwrite: true })`
  - ✅ tty expects profileKey

- BUG: why did adding a decor cuboid in fuel break Decor
  - also would like to use a cuboid instead of wall for fuel

- 🚧 improve assets script
  - ✅ more measurements in assets script
  - ✅ fix `yarn clean-assets`
  - ✅ use loadImage of svgPath instead of data-url
  - 🚧 faster run onchange skin

- 🚧 support transform + transform-box fill-box inside e.g. human-0.0.tex.svg
  - https://github.com/Automattic/node-canvas/issues/2507
  - could "do it ourselves" i.e. write node.js script,
    starting by extending parseUvRects to transform-origin at any level

- can we avoid re-request navmesh onchange skin?
  - maybe because assets.json is changing due to hash change?

- blog/index -> /blog/home
  - observed caching of local build sending /blog/index -> /blog/ and received 404
  - alternatively could handle /blog/

- get `<Image>`s working in local build
  - ℹ️ `npm run build && cd out && npx http-server`
  - image endpoint not available
    - e.g. `/_next/image?url=/_next/static/media/localhost_3000_blog_index_2.png.c9ed7e6c.webp&w=3840&q=75`

- warn if uv-map is not a grid (where rows/cols can have different size)

- Dev-only: Fix Emotion Hydration warning
  - ℹ️ Does not appear when `yarn dev-assets`
- ✅ HMR of MDX subcomponents

- HMR of npc models onchange const
- Changing `wallHeight` should somehow force update assets.json and geomorphs.json


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

- ✅ fade context menu on spawn
  - ✅ can manually fade ContextMenu whilst not docked
  - ✅ ContextMenu tracks `{ npcKey, object3d, offset }`
  - ✅ fade tracked npc fades non-docked ContextMenu
    - ℹ️ horrendous!

- ✅ fade speech bubble on spawn

- ✅ ContextMenu tracking npc should not fade while docked

- ✅ fix skin uv overflows

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

- ✅ on follow npc prevent both polar/azimuth delta
  - patching `@react-three-drei/three-stdlib`

- ✅ ContextMenu look stops follow and update UI

- ✅ can change camera height smoothly
  - ℹ️ `w.view.targetDistance`
  - ✅ async `w.view.tween`
    - e.g. `w view.tween '{ fov: 50 }'`
    - e.g. `w view.tween '{ distance: 20 }'`

- ✅ fix `w npc.remove`
  - we were `w npc.remove rob_{0..7}` where later did not exist
  - we now always finally update
- ✅ fix spawn onto decor point orientation

- ✅ fix object-pick of door-light from certain angles
  - something to do with npc

- ✅ remove npc `<select>` from ContextMenu opts

- ✅ try avoid npc flicker when zoomed out
  - ✅ less flickery skin with thicker "base" lines

- ✅ follow cam zoom should be centred on followed

- ✅ navigation bug in 301 at bridge right door
  - offMeshConnection didn't reach, had to edit walls

- ✅ follow option should be "selected" when in use
- ✅ toggle follow

- ✅ improve ContextMenu 3d position when npc Lie

- ✅ WorldView tween improvements
  - ✅ can await tween camera azimuthal/polar angle
  - ✅ initially tween camera angle into fixed angle
  - ✅ follow should persist after pan
  - ✅ rewrite `w.view.lookAt` in terms of `w.view.tween`
  - ✅ `w.view.dst` contains all tween destinations
  - ❌ `w.view.dstCount` is `Object.keys(w.view.dst).length`
  - ✅ `w.view.tween` can run whilst paused
  - ✅ simplify azimuth and polar e.g. `setAzimuthalAngle` once
  - ✅ fix follow after pan again


### Dev env

- ✅ Npc texture PNG -> WEBP
- ✅ HMR breaking on close/open laptop
  - ℹ️ works in Firefox but not in Chrome
  - ℹ️ seems next.js is using a WebSocket
    > https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/react-dev-overlay/utils/use-websocket.ts
  - ℹ️ https://issues.chromium.org/issues/361372969
  - ✅ reconnect websocket in patch

- ✅ BUG: geomorphs.skins.uvMap not being updated onchange file
  - ℹ️ needed to define canSkip over all sheets, not per sheet

- ✅ generated decor/obstacles/skin png,webp distinct on different laptops
  - ✅ migrate `canvas` to `skia-canvas`
  - ✅ migrate `skia-canvas` to `@napi-rs/canvas`
  - still seeing webp diff
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

- ✅ try `bun` https://bun.sh/
  - ℹ️ `yarn assets-bun` is failing due to `canvas` (node-canvas)
  - ℹ️ did not work with `skia-canvas`
  - ℹ️ worked with `@napi-rs/canvas`
  - ℹ️ a bit faster than sucrase-node


## Branch `start-blog`

### Site

- ❌ in small viewport, stop Viewer drag from sometimes causing blog to scroll
  - we'll rely on overflow flex-items algorithms

- ✅ clarify and clean site component styles
  - ✅ move Nav styles out of Root
  - ✅ clarify Nav styles
  - ✅ clarify Main styles
  - ✅ clarify ViewerControls styles

- ✅ cleanup Viewer
  - ❌ Viewer: HMR issue
    - full refresh happens if add/remove ref to `profile` (which uses raw-loader)
  - ✅ move tabsDefs into site.store
  - ✅ set initial tabsDefs somewhere
  - ✅ clarify Viewer styles


- ✅ try carousel
  - https://www.npmjs.com/package/react-multi-carousel
  - ✅ mount carousel
  - ✅ initial test pics after first `<Card>`
- ✅ try another carousel
  - https://www.npmjs.com/package/pure-react-carousel
  - ✅ patch carousel
  - ✅ mount carousel
  - ✅ initial test pics after first `<Card>`
- ✅ try yet another carousel
  - https://www.npmjs.com/package/embla-carousel
- ✅ remove prev Carousel (pure-react-carousel)

- ✅ fix desktop scroll of grey side area


### World

- ✅ sh: fix `echo What\'s`
  - braceOpts.keepQuotes true

- ✅ no longer need to fade Html3D on resize
  - seems to track well now

- ✅ pipe to json should not crash
  - ℹ️ `w | json` crashes
    - "Paused before potential out of memory crash"
    - 4.8 Gb
  - ℹ️ `expr window | json` takes about 10 secs to fail
  - ℹ️ `w | pretty` is huge

- ✅ bug: pause then reset should show interact message

- ✅ improve motion through doorways (offMeshConnection)
  - ✅ clarify deceleration from `u_0` to `u_1` in fixed distance `|src - dst|`.
    - may not actually use this, but worth working out
  - ✅ extend our recast-navigation-js branch with `agentAnim.tScale`
  - ✅ write code and test it
    - ✅ `npc.s.tScale.dst` is approached during offMeshConnection
    - ✅ `npc.setOffMeshExitSpeed`
      - ✅ should update (exit) speed too
      - ✅ update `offMesh.tToDist` as "new current speed"
    - ✅ trigger before "small room"
    - ✅ remove `npc.goSlowOffMesh`
    - ✅ trigger when will stop near offMeshConnection dst
      - on enter offMeshConnection test for target nearby exit
  - ✅ avoid dead-stop on enter small room
    - by slowing down inside doorway
  - ✅ try to simplify walk smoothing "hacks"
  - ❌ prevent intersection when two npcs move diagonally through doorway
    - ❌ forbid (src,dst)'s intersection
    - ❌ forbid dst's close to each other
  - ✅ simplify doorway multi-traversal approach
    - only permit traversal if every other traversal is in same direction and already half-way there
  - ✅ fix npc not turning correctly when two npcs traverse offMeshConnection
    - reset s.lookSecs on enter offMeshConnection
    - also simplify onTickTurnTarget

- ✅ remove "debug" mode from Tabs i.e. either paused or not
  - ✅ remove from World
  - ✅ remove from Tty

- ✅ distinguish paused some other way
  - ℹ️ World and Tty
  - ❌ inverted filter with modified door lights
  - ❌ post-processing effect
  - ✅ write "paused" in ViewerControls

- ✅ bug: after initial pause frameloop is still `always`
  - ℹ️ `w r3f.get | map 'x => x.frameloop'`
  - ℹ️ after move camera it changes to `demand`
  - ℹ️ because of "ongoing tweening"
    - maybe tween must be started whilst paused

- ✅ cleanup angle code
  - ✅ meta.orient clockwise from above from north
    - we were already using this convention
  - ✅ npc.angle clockwise from above from north
    - previously we were using "clockwise from above from east"
  - ✅ util for `atan2(dy, dx) + Math.PI/2` (clockwise from north)
  - ✅ fix offMeshConnection traversal
    - saw weirdness which disappeared on reset
  - ℹ️ npc.rotation.y anticlockwise from above from east
    - this is fixed i.e. property of Euler rotation
- ✅ IDEA load SVG using `canvas` and somehow convert it into `@napi-rs/canvas` (or `skia-canvas`) format
  - ℹ️ we're avoiding node-canvas _output_ because of nondeterminism
  - ℹ️ e.g. SVG -> `canvas` loadImage -> data url -> `@napi-rs/canvas` 
  - ✅ try importing and drawing using `canvas` first
  - ✅ try save as data-url and pass into `@napi-rs/canvas` 
  - ✅ clean up solution!
    - seems `canvas` now works with `bun`
    - unsure whether nondeterministic output behaviour persists in latest version of `canvas`
    - use `@napi-rs/canvas` to output, but make it easy to comment out, so we can test if nondet arises

- ❌ BUG: pause during profile load doesn't stop rendering

- ✅ BUG: while paused `kill --all; source PROFILE` gets stuck at `awaitWorld`
  - fixed by removing setTimeout from killProcesses
  - setTimeout apparently had something to do with `sleep`


- ✅ better skins based on minecraft skins
  - ✅ fix bug when do:
    ```sh
    w n.rob.skin | assign '{
      "body-overlay-front": { prefix: "base" },
      "body-overlay-back": { prefix: "base" },
      "body-overlay-left": { prefix: "base" },
      "body-overlay-right": { prefix: "base" },
      "body-overlay-top": { prefix: "base" },
      "body-overlay-bottom": { prefix: "base" },
    }'
    w n.rob.applySkin
    ```
    - ❌ not handling negatives properly?
    - ✅ inaccurate 0.00048827999853529036 ~ 1/2048
    - ✅ inaccuracy elsewhere (heart icon on front) was breaking things,
         based on our assumption of "perfect grids"
    - ℹ️ needs to change x ordinate 127 -> 128
  
  - ✅ more stable approach to skinning
    - ✅ report overlap of "x columns"
    - ✅ fallback to "test against every rectangle" approach

  - ✅ experiment with minecraft skin migration
    - https://namemc.com/skin/45461862ef51524e
    - ✅ temp: profile-1: apply test-head
    - test-body, test-body-overlay to rob
    - ✅ investigate support of `<image href="data:image/png` by `@napi-rs/canvas`
      - seems unsupported
    - ✅ try `skia-canvas` too
      - seems unsupported
    - ❌ try manually drawing head, using image as backdrop
      - too much work
    - ✅ move "node-canvas solution" into scripts/assets
    - ✅ try copy soldier head into test-head
      - head-left means from perspective of onlooker (not from character perspective)
      - boxy-svg try compositing > filter > pixelated (pixel size 18)
    - ✅ try copy soldier body into test-body
      - ❌ try direct copy
      - ✅ try sketch features onto "black body"
        - ✅ belt + back strap
        - ❌ trouser line
        - ✅ medal ribbon
    - ✅ try copy soldier overlay into test-head-overlay test-body-overlay
      - ✅ head overlay further out
        - currently `0.42 / 0.4` i.e. `1.05` larger
        - to match Minecraft use "half a pixel" i.e. `0.5 * (.4 / 8) = 0.025`
      - ✅ add test-head-overlay
      - ✅ copy over head-overlay
      - ✅ move belt and body into test-body-overlay
      - Blender: fix head-overlay-back uv
    - ✅ Blender: head overlay further out: `0.025`
    - head needs base, visible while lie
      - Blender: fix head-bottom uv
    - ❌ SVG shapes for head instead of minecraft pixels?
    - ✅ no need for body remap (only head, head-overlay, body-overlay)
    - ✅ rename test-{head,body,head-overlay} as soldier-0-*
  
  - ✅ more succinct skin specifications
    - brace-expansion of keys during `npc.normalizeSkin`
  
  - ✅ start another minecraft migration i.e. scientist-0
    - https://namemc.com/skin/7161dce64d6b12be
    - ✅ scientist-0-head
    - ✅ scientist-0-head-overlay
    - ✅ scientist-0-body-overlay
    - ✅ top-skin-only_body

  - ℹ️ hyper-casual examples
    - https://assetstore.unity.com/packages/3d/characters/hyper-casual-low-poly-simple-people-175599?srsltid=AfmBOoqLMjV7_LitkXfLkWOdi49sIoj9_IdWld-OwbKn__LueOGdZliU
- ✅ fix mobile pan conflict with ContextMenu

- ✅ BUG: agent using wrong angle when going through doorway if "click room again"
  - seems we `enter-off-mesh` but do not `enter-off-mesh-main`
  - seems we `clear-off-mesh` so that `npc.s.offMesh` is null
  - ✅ force re-invoke `onChangeAgentState`

- ✅ cuboids have outlines via shader, using UVs
  - ✅ can see outlines on decor cuboids
  - ✅ un-weld geometry i.e. 12 tris (as before) but 3 * 12 = 36 verts
    - in three.js this means `index` is [0..35]
  - ✅ infer face-ordering from vertices
    - `w decor.cuboidInst.geometry.attributes.position | map 'x => Array.from(x.array)'`
    - `a.reduce((agg,x,i) => (i % 3 === 2 && agg.push(a.slice(i - 2, i + 1)), agg), [])`
    - vertices:
      - [0.5,0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,-0.5], [0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5], [-0.5,0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,0.5], [-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5], [-0.5,0.5,-0.5],[-0.5,0.5,0.5],[0.5,0.5,-0.5], [-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5], [-0.5,-0.5,0.5],[-0.5,-0.5,-0.5],[0.5,-0.5,0.5], [-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5], [-0.5,0.5,0.5],[-0.5,-0.5,0.5],[0.5,0.5,0.5], [-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5], [0.5,0.5,-0.5],[0.5,-0.5,-0.5],[-0.5,0.5,-0.5], [0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5]
    - right-{upper,lower}, left-{upper,lower}, top-{back,front}, bottom-{front,back}, front-{top,bottom}, back-{top,bottom}
  - ✅ understand uvs too
    - `w decor.cuboidInst.geometry.attributes.uv | map 'x => Array.from(x.array)'`
    - `a.reduce((agg,x,i) => (i % 2 === 1 && agg.push(a.slice(i - 1, i + 1)), agg), [])`
    - uvs:
      - [0,1],[0,0],[1,1], [0,0],[1,0],[1,1], [0,1],[0,0],[1,1], [0,0],[1,0],[1,1], [0,1],[0,0],[1,1], [0,0],[1,0],[1,1], [0,1],[0,0],[1,1], [0,0],[1,0],[1,1], [0,1],[0,0],[1,1], [0,0],[1,0],[1,1], [0,1],[0,0],[1,1], [0,0],[1,0],[1,1]
    - Comparing uvs and respective vertices, we can infer the dimensions of uv-space:
      - [dz,dy], [dz,dy], [dz,dy], [dz,dy], [dx,dz], [dx,dz], [dx,dz], [dx,dz], [dx,dy], [dx,dy], [dx,dy], [dx,dy]
  - ✅ compute scale factors from instancedMatrix in vertex shader
  - ✅ send scaled uv dimensions e.g. `[sz, sy]` from vertex shader to fragment shader
