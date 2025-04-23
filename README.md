## Getting Started

First, run the development server:

```sh
turbo dev
# or one of these:
npm run dev
yarn dev
pnpm dev
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development dependencies

```sh
# cwebp e.g. https://developers.google.com/speed/webp/docs/precompiled
# must be version 1.5.0 libsharpyuv: 0.4.1

# ImageMagick
brew install imagemagick
```

```sh
# fix `npm install` of npm module `canvas`
# https://github.com/Automattic/node-canvas/issues/1825#issuecomment-1090125736
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

## Starship Symbols Source PNGs

Symbol PNGs should be unzipped in /media
- [SymbolsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/SymbolsHighRes.zip)
- [SmallCraftHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/SmallCraftHighRes.zip)

Geomorph PNGs (background in hull symbols) should be unzipped in /media
- [Geomorphs.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Geomorphs.zip)

Related resources (less/more resolution)
- [Symbols.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/Symbols.zip)
- [GeomorphsHighRes.zip](http://ericbsmith.no-ip.org/zip/Geomorphs/GeomorphsHighRes.zip)

Then you can run the various scripts (as needed) found inside `scripts/get-pngs.js`.

## Gotchas

1. npm module `canvas` (a.k.a. node-canvas) loadImage does not handle `<path>` such as:

  ```xml
  <path d="M 1088 192 L 1088 128 L 1040 192 L 1088 192 Z" style="fill: rgb(216, 216, 216); stroke: rgb(0, 0, 0); transform-box: fill-box; transform-origin: 50% 50%;" transform="matrix(-1, 0, 0, -1, 0, 0)">
    <bx:title>_debug-path-transform</bx:title>
  </path>
  ```

  In BoxySVG we can `Object > transform > Reduce Transform`


## Development only routes

These are removed in production via next.config output `export`.

```sh
curl --silent localhost:3000/api/connect/myFunUid/dev-events
curl --silent -XPOST localhost:3000/api/send-dev-event
curl --silent -XPOST localhost:3000/api/close-dev-events -d'{ "clientUid": 1234 }'
```

## Example NPC-CLI shell commands

```sh
c=0
while true; do
  spawn "rob_${c}" $( click 1 )
  w e.grantNpcAccess "rob_${c}" .
  c+=1
done

# commands work while paused via prefix `ptags=no-pause;`
ptags=no-pause events

# reset or save control state i.e. current view
w view.controls.reset
w view.controls.saveState

# this command does not exit until the World is enabled
test $( w disabled ) &&
  events '({ key }) => key === "enabled"' | take 1

# modify npc rob's skin
w n.rob.skin | assign '{ "body-overlay-front": { prefix: "plus-icon" }}'
w n.rob.applySkin

# reset npc rob's skin
w n.rob.resetSkin

# - tell npc rob to change speed by factor `dst` onenter next offMeshConnection
# - onexit speed will suddenly increase unless we set agent maxSpeed whilst traversing
w n.rob.s | assign '{ tScale: { start: 0, dst: 0.1 } }'

# pass from Vector3 to Vect for an internal function which only supports the latter
click | map xz | w n.rob.getLookAngle -
```

## Working with a branch of `recast-navigation-js`

Follow instructions here:
> https://github.com/rob-myers/recast-navigation-js/blob/main/DEVELOPMENT.md

```sh
brew install cmake

# at repo root
git checkout feat/expose-all-mesh-anim
# yarn build does not work, but we can:
# might have to manually delete packages/recast-navigation-wasm/{build,dist}
yarn build:packages2
```

## Bits and bobs

### `patch-package`

We can also patch `package1/node_modules/package2`
> https://www.npmjs.com/package/patch-package#nested-packages

This permits us to patch `three-stdlib` inside `@react-three/drei`.
```sh
npx patch-package @react-three/drei/three-stdlib
```


### Bump versions in our branch of recast-navigation-js

Currently tsconfig.json paths only works in webpack (`yarn dev-webpack`) not turbopack (`yarn dev`),
see https://github.com/vercel/next.js/issues/72346.
This means that in dev we'll uncomment tsconfig paths and use webpack,
but after publishing we should re-comment these paths and use turbopack.

#### At `recast-navigation-js` repo root

1. Manually bump versions
  - search for current patch e.g. `0.39.2` and replace with next e.g. `0.39.3`
  - do not include yarn.lock, files should be:
    > packages/recast-navigation{,-core,-generators,-playcanvas,-three,-wasm}

1. Run `yarn`

1. Commit and push e.g. to branch `feat/expose-off-mesh-anim`

1. Run `yarn publish`
    - 🔔 may have to wait a bit for registry to update

#### At `npc-cli-next` repo root

1. Bump package.json versions, e.g.

```json
  "@recast-navigation/core": "npm:@rob-myers/recast-navigation__core@0.39.2",
  "@recast-navigation/generators": "npm:@rob-myers/recast-navigation__generators@0.39.2",
  "@recast-navigation/three": "npm:@rob-myers/recast-navigation__three@0.39.2",
  "@recast-navigation/wasm": "npm:@rob-myers/recast-navigation__wasm@0.39.2",
```

1. Run `npm install`


### Debug on mobile hotspot

```sh
yarn dev

# get local ip address for mobile development
ipconfig getifaddr en0

# navigate to http://${ipAddress}:3000
```

### Fix VSCode push button error

> NPM module canvas was compiled against a different Node.js version

Following [this answer](https://stackoverflow.com/a/67935178/2917822) we can start VSCode in a terminal whose node version matches the repo's node version.

```sh
cd $REPO_ROOT
nvm use
code .
```

### Avoid nested transforms in SVGs

We don't support transforms applied to `<g>`s, for example in skin SVGs.
> 🔔 maybe we should...

In BoxySVG, you can avoid introducing transforms on `<g>`s by
- selecting all of its children (rather than the Group)
- e.g. Geometry > change Y.

In BoxySVG, if your `<g>` already has a transform you can use this trick:
> - drag contents outside Group
> - remove transform from Group (e.g. via elements panel E)
> - drag contents back into Group

### Convert to MP4 or GIF

```sh
# if necessary
brew install ffmpeg

# Convert mov to mp4
cd ~/Desktop
ffmpeg -i ~/Desktop/html-3d-example.mov -qscale 0 html-3d-example.mp4
ffmpeg -i ~/Desktop/html-3d-example.mov -filter_complex "[0:v] fps=10" -b:v 0 -crf 25 html-3d-example.mp4
ffmpeg -i ~/Desktop/html-3d-example.mov -filter_complex "[0:v] fps=60" -b:v 0 -crf 25 html-3d-example.mp4
```

### Deceleration in terms of time

> We originally calculated the following in order to simulate slow-down inside offMeshConnections.
> However we decided upon a simpler approach
> i.e. add time scaling factor `tScale` to `dtCrowdAnimation` and tween it.

- Suppose move in 1D with:
  - init/final position `x(0) := 0`, `x(t_1) := x_1` where `t_1` unknown.
  - init/final velocity `v(0) := u_0`, `v(t_1) := u_1`.
- Suppose we constantly decelerate i.e. `dv/dt = a ≤ 0` from speed `u_0` to `u_1` at time `t_1`

It follows that:
- `v(t) = u_0 + a . t` for all `t ≥ 0`
- `x(t) = u_0 . t + a/2 . t^2` for all `t ≥ 0`.
- `v(t_1) = u_1` hence `t_1 = (u_0 - u_1) / |a|`
- `x(t_1) = x_1` hence `x_1 = ((u_0 - u_1) / |a|). ( u_0 - (u_0 - u_1) / 2 )`
  i.e. `x_1 = (1 / 2|a|) . (u_0 - u_1). (u_0 + u_1)`

Sanity check: if `u_0 = u_1` then `t_1 = x_1 = 0` i.e. immediate.
Sanity check: if `u_1 = 0` then `x_1 = 0.5 . 1/|a| . u_0^2`

Then we know:
- the deceleration `|a| = 0.5 . (1 / x_1) . (u_0 - u_1) . (u_0 + u_1)`.
- the time `t_1 = (u_0 - u_1) / |a| = 2 * x_1 * (1 / (u_0 + u_1))`

## Towards better skins

We'll try to re-map publicly available Minecraft Skins.

- https://namemc.com/minecraft-skins/tag/soldier
  - https://namemc.com/skin/45461862ef51524e
- https://namemc.com/minecraft-skins/tag/scientist
  - https://namemc.com/skin/7161dce64d6b12be
  - https://namemc.com/skin/3a335a2ec786efdb
- https://namemc.com/minecraft-skins/tag/general
- https://namemc.com/minecraft-skins/tag/medic
- https://namemc.com/minecraft-skins/tag/suit
- https://namemc.com/minecraft-skins/tag/engineer
- https://namemc.com/minecraft-skins/tag/assassin
- https://namemc.com/minecraft-skins/tag/politician
- https://namemc.com/minecraft-skins/tag/monk
- https://namemc.com/minecraft-skins/tag/priest
