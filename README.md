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
# cwebp
brew install webp

# ImageMagick
brew install imagemagick
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


## Development only routes

These are removed in production by temporarily moving `app/api` into `public`.

```sh
curl --silent localhost:3000/api/connect/myFunUid/dev-events
curl --silent -XPOST localhost:3000/api/send-dev-event
curl --silent -XPOST localhost:3000/api/close-dev-events -d'{ "clientUid": 1234 }'
```

## Example shell commands

  ```sh
  c=0
  while true; do
    spawn "rob_${c}" $( click 1 )
    w e.grantNpcAccess "rob_${c}" .
    call 'x => x.home.c++'
  done
  ```

## Bits and bobs

### `patch-package`

We can also patch `package1/node_modules/package2`
> https://www.npmjs.com/package/patch-package#nested-packages

This permits us to patch `three-stdlib` inside `@react-three/drei`.


### Bump versions in our branch of recast-navigation-js

Currently tsconfig.json paths only works in webpack (`yarn dev-webpack`) not turbopack (`yarn dev`),
see https://github.com/vercel/next.js/issues/72346.
This means that in dev we'll uncomment tsconfig paths and use webpack,
but after publishing we should re-comment these paths and use turbopack.

#### At `recast-navigation-js` repo root

1. Manually bump versions
  - search for current patch e.g. 0.39.1 and replace with next e.g. 0.39.2
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
