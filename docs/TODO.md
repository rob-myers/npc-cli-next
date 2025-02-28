# TODO

## Branch `clean-npc-shaders`

- 🚧 overall setup + plan
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
  - 🚧 glsl.js
    - ✅ instancedMonochromeShader -> instancedWallsShader
    - add HumanZeroMaterial
    - add PetZeroMaterial
    - remove CuboidManMaterial

- improve npc svg textures
- two characters: `human-0` and `pet-0`
- auto-extend geometry with label quad and selector quad
- use single DataTextureArray for npc labels and their uvs
- use single DataTextureArray for npc textures and their uvs
- unified material `npcMaterial` (if possible)

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


## Dev env

- HMR of MDX subcomponents
- HMR of npc models onchange const
- 🚧 try `bun` https://bun.sh/
  - ℹ️ `yarn assets-bun` is failing due to `canvas` (node-canvas)
  - 🚧 try https://www.npmjs.com/package/skia-canvas


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
