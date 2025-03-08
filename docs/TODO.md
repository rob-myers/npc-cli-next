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
- 🚧 `human-0.tex.svg` texture layout
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
- skins texture should be 
  - visible via custom shader
  - DataTextureArray (one layer per skin)
  - hot-reloaded
- need "npc uvs" DataTextureArray
  - one layer per pickId i.e. 256?
  - small layers i.e. just enough to remap overlays
- represent label images as 256-layer DataTextureArray
  - requires bounds on max width/height of label

### Extras

- 🚧 mobile touch issues
  - ✅ ContextMenu fixed
  - Logger PopUp?
- prevent intersection when two npcs move diagonally through doorway
  - forbid (src,dst)'s intersection
  - forbid dst's close to each other

## Dev env

- ✅ Npc texture PNG -> WEBP
- ✅ HMR breaking on close/open laptop
  - ℹ️ works in Firefox but not in Chrome
  - ℹ️ seems next.js is using a WebSocket
    > https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/react-dev-overlay/utils/use-websocket.ts
  - ℹ️ https://issues.chromium.org/issues/361372969
  - ✅ reconnect websocket in patch
- HMR of MDX subcomponents
- HMR of npc models onchange const
- try `bun` https://bun.sh/
  - ℹ️ `yarn assets-bun` is failing due to `canvas` (node-canvas)
  - try https://www.npmjs.com/package/skia-canvas


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