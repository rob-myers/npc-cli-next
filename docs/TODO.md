# TODO

## Branch `get-blog-ready`

### Site

- 🚧 redo images in first carousel
  - ℹ️ https://squoosh.app/editor | size?
    - webp quality 70
  - ✅ can spawn with various skins easily
  - ✅ can spawn facing angle easily
    - `spawn npcKey:foo at:$( click 1 ) look:$( click 1)`
  - ✅ extend 301 with more decor
    - ✅ add some crates
    - ✅ add a cuboid with a decor quad e.g. computer screen
      - ℹ️ `decor quad tilt` tilts around center
    - ✅ try use nodeCanvas for decor svg detail
  - 🚧 three images
    - ℹ️ screenshot of node `.tabs-container`
    - 🚧 1st ✅ 2nd 🚧 3rd 🚧
    - desktop and mobile (?)

- ❌ refine chosen carousel embla-carousel
  - ✅ carousel has labels
  - ❌ clean carousel css e.g. more css variables
  - ❌ auto png to webp in public/images

- 🚧 lead into "basic behaviour list"
  - ✅ need `<Code>`
    - ✅ can copy line-by-line
    - ✅ can copy all
  - 🚧 mobile tty has textarea disabled option
  - ✅ default profile is `default-profile`
    - includes standard imports: `util.{,js.}sh` `game.{,js.}sh`
    - `awaitWorld`
  - step through spawning and removing an npc
  - step through making an npc walk back-and-forth
  - next time we'll implement "selection"

- mention Starship Geomorphs early
- mention recent improvements in AI
  - NPC CLI could use them as tools

- basic help page
- basic about page
- write 1st dev blog
  - ℹ️ aligned to npc cli too i.e. focus on how various subsystems were built
- sketch 1st automata blog
  - ℹ️ nondeterministic automata language-theoretically
  - summary of pre-existing academic work
- Tabs: debug is global among Tab instances
  - defunct if we remove debug i.e. always paused when paused
- start adding cypress

### World

- 🚧 "global vars" DataArrayTexture nx1x1 (1 pixel per texture)
  - ✅ invert npc (when WorldMenu invert on)
  - torch radius/opacity
  - breathTriIds (one per classKey)
  - ...

- ✅ manage tabs
  - ✅ can close tab
  - ✅ can open new tab
  - ✅ create tab needn't select it
  - ✅ close tab needn't select it
  - ✅ can specify props when open new tab
    - ✅ get all mapKeys somehow
    - ✅ directly import deserialized geomorphs
    - ✅ world: can specify mapKey
    - ✅ tty: can specify
      - ✅ profileKey
      - ✅ worldKey
  - ✅ fix select on remove i.e. should not switch away from manage
  - ✅ tab grey if disabled (e.g. never mounted)
    - ℹ️ TTY tabs not disabled in background, others are
    - ✅ should not set background tab enabled when Tabs enabled
    - ✅ site.store has tabset.tabs derived from tabset.synced
    - ✅ ensure keys are removed from Tabs.tabsState
    - ✅ expose Viewer tabs disabled
    - ✅ style when disabled
    - ✅ style when unmounted
  - ✅ select tab on click
  - ✅ ongoing restyle
    - ✅ clean
    - ✅ paused represented via icon
    - ✅ unmounted represented via icon
    - ✅ use many onClick rather than "one for many"
  - ❌ "create tab" labelled with next id
    - might be confusing
  - ✅ enforce tab id format i.e. `${Key.TabClassPrefix}-${number}`
  - ✅ can change world mapKey
    - ✅ works when World tab in foreground
    - ✅ fix background tab
      - ℹ️ `door[useEffect]` not invoked while bg because `useEffect`
      - nav.worker should be re-triggered in background
  - ✅ create tty worldKey is numeric
    - if invalid, env.WORLD_KEY won't be defined
  - ❌ can change tty worldKey (numeric)
    - must use tty
  - ✅ tty worldKey reflects home.WORLD_KEY onclick
  - ✅ "open tab" long-press should select it

- 🚧 iOS 18.5 not working, probably when recast (WASM) is loaded
  - https://discussions.unity.com/t/webgl-is-not-working-on-safari-after-ios-18-4-update/1628007/29
  - https://bugs.webkit.org/show_bug.cgi?id=291677
  - ℹ️ this works: https://recast-navigation-js.isaacmason.com/?path=/story/crowd-crowd-with-multiple-agents--crowd-with-multiple-agents
  - ℹ️ `small-map-1` works, so could restrict in case of iOS
  - ✅ restrict layout-preset-0 and Manage `<select>` to mapKeys containing "small"
  - 🚧 check iPad

- ✅ fix overrideOffMeshConnectionAngle when agent starts/ends after/before endpoints
  - ℹ️ previously we made offMeshConnection half depths larger to avoid bad nextCorner when
    wrap around "nav-deformed" corner
  - ✅ Connector entrances have smaller half-depth then offMeshConnection half-length

- ✅ Draggable: towards resizable via corner
  - ✅ remove controls from PopUp
  - ✅ can resize
  - ✅ ContextMenu and Logger work
  - ✅ ContextMenu: only forward scroll even not scrollable
    - test `innerRoot.scrollHeight` vs `innerRoot.clientHeight` (we don't show horizontal scroll)

- ✅ selectively `source /etc/foo` with HMR tracking
  - ℹ️ currently every js-induced-file is auto-sourced and tracked
  - ℹ️ instead, profiles will start with e.g. `source /etc/game-generators.sh`
  - ✅ RunArg -> NPC.RunArg
  - ✅ sh/src/index.js -> sh/src/profiles.js
  - ✅ shorter names for src/sh/*.{js,sh}
    - js generators -> sh with extension `jsh` (avoid collision)
  - ✅ separate jsFunctions by filename key (e.g. `game`, `gameWip`)
  - ✅ mechanism for communication between `source` and hmr-sourcing
    - ✅ send test message from `source`
  - ✅ "external" message triggers auto-HMR
    - ✅ mutate lookup in `<Tty>` and adjust useEffect

- ❌ jsArg: `["to:{x1,y1}", "{x2,y2}"]` -> [`to:{x1,y1} {x2,y2}`]
  - wanted to fix `tour npcKey:rob to:$( click 2 )` i.e. when missing double-quotes
  - these non-quoted versions work:
    - `tour npcKey:rob to:$( click 2 | sponge )`
    - `points=$( click 2 ); tour npcKey:rob to:$( points )`

- ✅ can `tour npcKey:rob to:$( click 2 )`
  - ✅ command substitution outputs (jsStringified) js array if multiple values
  - 🔔 `fnFoo $( click 2 )` won't have $1 and $2 but only $1 i.e. `[...]`

- ✅ BUG: pausing whilst PROFILE running was not working
  - ℹ️ `spawn` was setting `process.status` `ProcessStatus.Running` for leading process
  - ❌ spawned process should inherit status?
    - a paused/dead process should never spawn another
  - ✅ process pauses before `spawn` if paused
    - currently we only suspend/resume process on read/write to device
  - ✅ distinguish: auto-pasted lines from PROFILE, interactively specified command

- ❌ BUG: cannot pause `w foo`
- ✅ BUG: ctrl-c profile works with exitCode `130`

- ✅ manage: change map while paused sometimes doesn't work 
  - hide World behind other tab, then select it via manage, then change
  - presumably thinks its "in background"

- ✅ BUG: CONT is showing when it should not

- ✅ manage: open tty tab while paused is now enabled (so can see actual terminal)

- ✅ `<Tty>` should receive disabled like other tabs, but handles differently
  - ✅ can boot while disabled
  - ✅ on open tty tab while paused, tty profile should not pause initially
    - can test `nextPid > 1`
  - ✅ if `<Tabs>` disabled then background processes without `'always' in ptags` start suspended (in sync)
    - ℹ️ ttyShell.bgSuspendUnless := 'always'
  - ✅ `<Tty>` resumeRunningProcesses resumes all suspended processes sans tag `always`
  - ✅ CONT not shown during profile

- ✅ CONT/STOP ui new approach:
  - ✅ CONT visible whenever interactive process suspended
  - ✅ STOP visible whenever interactive process running
  - ✅ while Tab paused only one click needed:
    - ✅ `ptags=always; move npcKey:rob to:$( click 1 ) &`
    - ✅ `ptags=always; echo $( click 1 ) &`
  - ✅ STOP continues, showing CONT
    - `interactive-paused`
    - `interactive-resumed`
  - ✅ CONT continues, showing STOP

- ✅ re-source /etc/foo cannot be put to sleep during profile run

- 🚧 tty: mobile textarea disabled by default
  - clarify enable/disable prompt button

- manage: show tty profile key

- ✅ manage: clean and clarify actions

- ✅ if pause while interactive process still running, show CONT UI
  - ✅ also hide on Ctrl-C

- ✅ BUG: fix `echo "...$( echo foo; echo bar; echo baz )"`
  - parent of CmdSubst can be Word or DblQuoted

- 🚧 how to resolve basic while loop `tour` when other npc is in the way?
  - ℹ️ improved behaviour when `sleep 1` in while (handles case where `move` throws)
  - ✅ BUG where rob passed through other
    - seems `npc.s.offMesh` is `null` despite offMeshConnection existing
    - we async null it when `npc.s.offMesh.seg` is `0`.
```sh
points=[{x:5.322,y:0,z:9.746,meta:{picked:"floor",gmId:0,floor:true,instanceId:0,roomId:9,grKey:"g0r9",nav:true},xz:{x:5.322,y:9.746}},{x:2.436,y:0,z:10.02,meta:{picked:"floor",gmId:0,floor:true,instanceId:0,roomId:3,grKey:"g0r3",nav:true},xz:{x:2.436,y:10.02}}]
while true; do
  tour npcKey:rob to:$( points )
  sleep 1
done
```

- easier ctrl-c on mobile?

- for debugging, it would be better if we directly yielded e.g. `jsFunc.gameWip.tour`
  - ℹ️ want to set a breakpoint in e.g. `game-wip.js`
  - ℹ️ do this instead: `run ({ ... }) { yield* jsFunc.foo(...);  }`
  - ℹ️ currently, could write `debugger;`

- ✅ BUG: Tabs: fix maximize

- wasd camera controls does not work with follow
  - ℹ️ need to start porting to our own camera controller
  - related to w.view.controls.update(true);
- ❌ bug: sh: support $@ deeply inside double quotes
  - not a bug: e.g. `foo() { echo "foo bar $( bar ${@} )"; }` behaves like bash
- sometimes spawned npc is not "pinned to spawn point" i.e. lacks target

- doors can be further secured by "full match" e.g. `.*` vs `.`

- can show navMesh via cli

- Ctrl-C "failure" unclear while paused
- tty: run `spawn bar $( click 1 )` then pause... cannot click
  - provide UI `cont` interactive process

- fade ContextMenu and SpeechBubble (as before) on World resize
  - needed again because we now debounce render

- BUG: sit on chair, get off it, right click decor point: its meta should not be mutated

- can scroll ContextMenu on mobile
  - on hold i.e. user can resize instead

- fix run through doorway

- clarify staticSeparationWeight = movingSeparationWeight = 0.5
  - probably don't want this in general
  - it avoids jerk onexit doorway "in parallel"

- try "turn around before moving" via small acceleration initially
  - could also "pause before moving"

- Tty: could debounce/cancel CONT/STOP

- tty: command-by-command mode by setting leading process `ProcessStatus.Suspended` after each run

- ✅ support decor cuboid meta `max-height` e.g. cuboid under obstacle

- 🚧 cleanup human-0 skin
  - ✅ Blender: overlay cuboids should be double-sided
    - then can remove `Side={THREE.DoubleSide}`
  - ✅ Blender: space out initial skin: separate head from body along x-axis
  - can redirect head-overlay and body-overlay to "empty"
  - base_head-overlay -> robot_head-overlay (with more detail)
  - base_body-overlay -> robot_body-overlay (with more detail)
  - small-eyes -> robot-face-0
  - confused -> robot-face-1

- ❌ profile-1 camera target y should always be 1.5?
- consider "hot keys" e.g. 1, 2, 3, also tapable
  - could use to change camera settings
  - could use to change input settings e.g. drag select
- testOffMeshDisjoint: diagonal doors initially transform lineSegs

- sh: can exit tty
- avoid "speed up before collision" near door
  - seems related to enter offMeshConnection
- somehow additionally indicate npc is selected by ContextMenu when docked
- another model human-1
- tween: provide many examples
- if lookAt while walking, eventually lookAt once stopMoving
- onTickDetectStuck more general approach
  - saw fire when npc no longer stuck causing bad stop
  - maybe check if closest neighbour is in front too
- torch: provide inverse matrices as uniform (more efficient)
- npc is lit by static lighting 
  - provide inverse-matrix-per-gmId as uniform
  - provide gmId as uniform
- ✅ floor torch: more efficient approach
  - use single varying vec2 vFoo i.e. uvs into radial light fill texture

- sh: strategy for stale `ps` after Tabs pause
- bug: sh
  - multi-line edit using Option+Enter not working (need repro)
  - paste multiline command and start Option-Deleting midway  (need repro)
  - ctrl + w while multiple input: goes back a line (need repro)

### Dev Env

- 🚧 BUG: on add decor image i.e. decor spritesheet out-of-sync
  - w.geomorphs.sheet.decor is synced
  - `<Decor>` was not but fixed by editing its query

- 🚧 Boxy SVG: sporadic slow save (or at least, triggering of our file mon)
  - https://boxy-svg.com/bugs/370/intermittent-slow-saving

- seeing `/etc/util.sh: failed to run (see console)` during hmr
  - maybe on pause profile we're pausing the respective `spawn`

- ✅ node-canvas: is it still nondeterministic onchange decor pngs?
  - seems ok

- ✅ hmr: Viewer should not reset onchange image import
  - do not import image, instead directly `url(/images/foo.webp)`
  - https://nextjs.org/docs/pages/api-reference/components/image

- BUG: why did adding a decor cuboid in fuel break Decor
  - also would like to use a cuboid instead of wall for fuel

- ❌ BUG: hmr offMeshConnectionHalfDepth does not update navmesh

- 🚧 improve assets script
  - ✅ more measurements in assets script
  - ✅ fix `yarn clean-assets`
  - ✅ use loadImage of svgPath instead of data-url
  - 🚧 faster run onchange skin

- 🚧 support transform + transform-box fill-box inside e.g. human-0.0.tex.svg
  - https://github.com/Automattic/node-canvas/issues/2507
  - could "do it ourselves" i.e. write node.js script,
    starting by extending parseUvRects to transform-origin at any level

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

- ✅ towards 1st blog (npc cli)
  - ✅ more content
  - ✅ add a carousel
  - ✅ can somehow change tabs from blog
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
    - ✅ strategy for tabsets with added tabs
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
      - ✅ close tab should select some other tab in tabset
        - ℹ️ repro by programmatic open, then select, then programmatic close
      - ✅ support HMR update tabset somehow
        - we sync PROFILE via profileKey
      - ✅ clean hard-coded initialization in `<Root>`


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


- ✅ BUG: after multiple invokes of e.g. `w view.tween '{ fov: 30 }'`,
  agents stop moving, and start to animate very slowly
  - ℹ️ can fix by pausing that `w stopTick` then playing
  - ℹ️ seems both `w.onTick` and `w.onDebugTick` are running
  - ℹ️ `w view.tween '{ fov: 30 }'` was jerky when eps was 1

- ✅ sh: given `home.foo === undefined` we should not get `foo: not found`

- ✅ BUG: testOffMeshDisjoint does not handle case where npcs face each
  - ✅ non-diagonal rectangle intersection

- ✅ profile-1 tweens continue when should be paused
  - `w view.tween '{ look: {x:0,y:0,z:0}, lookOpts: {smoothTime: 5} }'`
  - ℹ️ can continue whilst initially paused inside profile,
    BECAUSE tweens can run whilst paused too
  - ✅ can explicitly specify `permitPaused: false`

- ❌ `w`: support auto-cancel of promise-return-valued functions
  - e.g. `w view.tween '{ look: {x:0,y:0,z:0}, lookOpts: {smoothTime: 5} }'`
  - i.e. if return value is Promise can store reject in cleanups?

- ✅ BUG: profile-1: pause during initial tween ineffective
  - use w.view.canTweenPaused

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

- ❌ post-processing api
  - ✅ can manually load effects via `w view.extractPostEffects`
  - ✅ auto load effects via `w view.extractPostEffects`
  - ✅ can enable/disable post-processing
  - can animate post-processing i.e. set uniform on Vignette

- ❌ move "x-ray" into PopUp opts?


- ✅ shell should show debugs not errors
  - sometimes still show errors e.g. on mvdan-sh parse error

- ❌ when w.view.enableControls show "ui disabled icon"

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


## Branch `light-and-blog`

### World

- ✅ improve floor lighting
  - ✅ show hard-coded "light circle" in floor shader
  - ✅ light circle has basic gradient
  - ✅ light circle moves with camera
    - ✅ fix shader code i.e. edge geomorphs are not full-height
  - ✅ light circle scales up and down
  - ✅ light circle opacity can change

- ✅ geomorph lighting
  - ✅ debug tag shows radial gradient
    - https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient
  - ✅ texture atlas for light maps
  - ✅ move Floor to separate shader
  - ✅ test light map
    - ✅ apply test light map to Floor shader (simple mul)
    - ✅ `w.floor.lit.target` for moving target light
    - ✅ `w.floor.lit.static` for static lights
    - ✅ floor shader has uniforms for target/static
    - ✅ draw a bunch of radial gradients into map
      - `w update 'w => w.floor.lit.static = true'`
  - ✅ controls target light -> torch with general target
    - e.g. npc.position
  - ✅ geomorph layout symbol induces light map
    - ✅ svg lights `<circle>` induce static lights
      - 🔔 `<ellipse>` are not supported
    - ✅ torch uses texture rather than abstract function
    - ✅ fix static lights i.e. lightAtlas
    - ✅ torch + static light combination
    - ✅ add lights to every geomorph
      - 301 ✅ 302 ✅ 303 ✅ 101 ✅ 102 ✅ 103 ✅ 
    - ✅ improve lightsAtlas composite approach
    - ✅ lights should not overlap geomorph edges
    - ❌ light supports `intensity`
    - ❌ selector "too light" when surrounded by torch?
      - we won't use torch by default

- ✅ extend 303
  - ✅ add galley-and-mess-halls--006--2x4
  - ❌ fix obstacle outline bug
    - not a bug: background symbol `<img>` was wrong size when dragged into BoxySVG,
      so had to manually resize

- ✅ try fix jerk on collide just before offMeshConnection
  - ✅ use `const preOffMeshCloseDist = helper.defaults.radius * 1`
  - ✅ but permit smaller radius if npc -> offMesh.src does not intersect

- ✅ improve floor lighting
  - ✅ remove post-processing
  - ✅ fix issue with npc target height 1.5 but floor light target should be 0
    - lookAt target always satisfies y = 0
  - ✅ try radial gradient texture
  - ❌ try many fixed lights e.g. via DataTexture or DataArrayTexture
  - ❌ could try "light image" again where distinct light's rect's don't overlap
  - ❌ npcs are lighter within light circle


- ✅ look/follow npc at their height i.e. controls.target.y > 0
  - ℹ️ controls.minDistance measured from controls.target

- ✅ top-skin-only -> plain-0
- ✅ skin shortcuts
  - ℹ️ e.g. `spawn '{ npcKey: "rob", skin: "soldier-0" }' $( click 1 )`
    - `"soldier-0"`
    - `"soldier-0/scientist-0/plain-0/police-0"` ->
      - head `soldier-0`
      - body `scientist-0`
      - head-overlay `plain-0`
      - body-overlay `police-0`
    - `"soldier-0/-/-/-"` only changes head
- ✅ what about skin prefix `scientist-0` lacking `body`?
  - ℹ️ or `scientist-1` only having `body`
  - ✅ in expandSkin could check against
    - `w.npc.sheetAux[w.n.rob.def.classKey].uvMap`
  - ❌ could precompute skinShortcut -> { head, body, headOverlay, bodyOverlay }
- ✅ can `spawn foo@soldier-0 $( click 1)`

- ✅ plain-0-body <-> base-0-body

- ✅ improve base skin yet again: base-body too basic

- ✅ consider having WASD for e.g.
  - `w view.tween '{ azimuthal: Math.PI/2 }`

- ✅ blender: head-overlay-bottom uvs flipped vertically
  - fix beard on base skin

- ✅ bug: tty: `echo --` is empty
  - probably related to `getopts`

- ✅ sh: generic args approach for `spawn`
  - e.g. `spawn npcKey:foo skin:scientist-0 at:"$( click 1 )" look:"$( click 1 )"`
  - ℹ️ more generally, avoid "args order dependency" in game shell functions

- ✅ can spawn-and-look
  - `spawn npcKey:rob at:$( click 1 ) look:$( click 1 )`

- ✅ bug: sh: cannot type hash: #

- ✅ sh: `move` command?
  - ✅ npc.move has single arg
  - ✅ cleanUp will move.reject
  - ✅ Ctrl-C working for single move
    - `move npcKey:rob arriveAnim:none to:$( click 1 )`
  - ✅ Ctrl-C working for while
    - `move` needs non-zero exit code on Ctrl-C
  - ✅ onSleep will pin to current position (default behaviour after)
  - ✅ onResume will replan
  - ✅ cleanUp also stops whilst paused

- ✅ split game-generators.js into 2 files
  - game-generators.js
  - game-generators-wip.js

- ✅ could pause/resume move via maxSpeed
  - `w n.rob.agent.raw.params.set_maxSpeed 0`
  - `w n.rob.agent.raw.params.set_maxSpeed 1.5`
  - ℹ️ while World paused also need to `w crowd.update`
  - ℹ️ not actually using this as yet

- ✅ sh: support initially-overwriting-append e.g. `click 2 &>> foo`

- ✅ sh: `echo foo >&2` goes to stderr
  - ℹ️ e.g. `{ echo foo >&2 ; echo bar; } >baz`
  - ℹ️ permits debug messaging

- ✅ can invoke `move` generator from another generator e.g. `moveCycle`
  - ✅ pass generators into session.lib
  - ✅ create `moveCycle` and invoke `move`
  - ✅ implement `moveCycle`
  - ✅ `move` should work onchange `npc.js`
    - breaks if pause Tabs then change `npc.js`

- ✅ refine `moveCycle` aka `tour`
  - ❌ keeps trying by default?
  - ✅ avoid send args to `move`
  - ✅ `moveCycle` -> `tour`
  - ✅ simplify: no loop, but can:
  - ✅ clean i.e. add to basic behaviour list

- ✅ `spawn` can specify access e.g. `spawn npcKey:rob at:$( click 1 ) grant:.`

- ✅ sh: support `click {filter}` (currently only `click {n} {filter}`)

- ✅ only mutate `npc` i.e. do not re-instantiate on hmr
  - ℹ️ idea: npc.api is a class instance which we replace on hmr
  - ✅ implement `createNpc` function with hot-replaceable api (not connected yet)
  - ✅ new hmr strategy
    - ✅ detect change of function `createBaseNpc`
    - ✅ detect change of class `NpcApi`
    - ✅ simplify strategy: even if function didn't change, its make contain stale refs
    - ✅ baseNpc: copy in new, delete old, also for `s`
    - ✅ NpcApi: replace it
  - ✅ try replace `Npc`
  - ✅ tidy

- ✅ improve ctrl-c error log for `move`
  - works when Tabs not paused
  - issue happens whilst paused i.e. error is `true`

- ✅ locked doors should not open on accessible npc enter collider

- ✅ BUG: sh: can redirect error messages to /dev/null 
  - `call '() => { throw "oh no!"; }' 2>/dev/null`

- ✅ do not rely on stuck detection to fix "cannot get close enough to arrive"
  - ℹ️ can repro when another npc nearby-ish (`separationWeight`)
  - ✅ add slow down radius param to recastnavigation repo
  - ✅ expose slow down radius in recast-navigation-js repo
    - expose wasm interface
  - ✅ can see in npc-cli-next while connected by tsconfig paths
  - ✅ can change in npc-cli-next and see difference
    - 0.05 fixes issue
  - ✅ try slower transition Walk -> Idle
  - ✅ publish and bump
  - ℹ️ related to separation weight of idle vs moving
  - ✅ onSlowNpcCustom has a default

- ❌ moveCycle: what if npc keeps getting blocked from leaving room
  - ❌ e.g. npc near door has higher weight (more accommodating)
  - ❌ e.g. blocking npc tweens separationWeight
  - ℹ️ won't solve yet

- ❌ better approach to js to shell function naming?
  - ℹ️ want to permit mutually inconsistent files (only source one)
  - ℹ️ want to optionally exclude certain files
  - ℹ️ want to avoid special names to avoid collisions
  - ✅ extendable approach
  - ❌ can specify functions to auto-source
    - maybe auto track after `source /etc/foo`
    - better names i.e. not game-generators-wip
    - maybe can specify initially sourced via prop
  - ❌ session.jsFuncs should only contain respective functions too
    - provide keyed lookup `jsFunctions`
    - but how to fix types? need to separate to avoid collisions
  - ℹ️ seems too complicated

- ✅ avoid Tabs reload on edit service/const
  - ✅ fix Viewer, ViewerControls

- ✅ replace soldier-0 head, head-overlay
  - https://namemc.com/skin/5556dc93d001adea

- ✅ replace police-0 -> robot-0
  - ✅ replace head, head-overlay
  - ✅ replace body
  - ✅ replace body-overlay
    - put in second sheet (overwrite bare-0)
  - ✅ rename police-0 -> robot-0

  - ✅ rename astronaut-0 -> robot-1
  - ✅ soldier-0 should be lighter

- ✅ on collide look towards neighbour should be optional callback
  - ✅ optional callback `w.npc.onTickIdleTurn`
  - ✅ provide example
    - `setupOnTickIdleTurn`

- ❌ can only close tab after hover for a while
  - to avoid accidental closure
  - ℹ️ Tabs will have "manage" tab instead

- ✅ Tabs has manage tab
  - ✅ cannot close tabs directly 
  - ✅ manage tab component exists
  - ✅ ensure manage tab in all layouts
  - ✅ move links into manage tab
    - use `#/internal` link
    - remove `/internal/...` -> `#/internal/...` transformer in markdown
  - ✅ manage tab has ui

- ✅ avoid "final quick turn around" when move npc to "small gap between boxes"
  - e.g. via larger `npc.s.lookSecs` when nearly arrived

- ✅ soldier-0 needs more hair
- ✅ change robot-0
  - mixture of two skins
- ✅ change robot-1

- ✅ sh: should yield to stdout or stderr rather than `writeMsgCleanly`
  - ✅ `choice` yields
  - ✅ eliminate other usages except for `ps` replace line when scrolled back

- ✅ remove torch

- ✅ `<Code>` improvements
  - ✅ supports copy all
  - ✅ copy all has visual feedback
  - ✅ supports copy line
  - ✅ copy line has visual feedback

- ✅ cannot enter small room if other npc is nearby offMesh.dst
  - ℹ️ this would avoid jerkiness due to lack of leeway for other
- ✅ stopped-moving reason has otherNpcKey
  - ✅ blocked-doorway
  - ✅ collided

- ❌ rehype: example of dynamic ansi-output highlighting 
  - https://rehype-pretty.pages.dev/#ansi-highlighting
  - would like to highlight shell functions

### Dev Env

- ✅ avoid re-request navmesh onchange skin
- ✅ avoid re-request navmesh onchange lights
  - maybe because assets.json is changing due to hash change?
