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
    call 'x => x.home.c++'
  done
  ```

## Bits and bobs

We can also patch `package1/node_modules/package2`
> https://www.npmjs.com/package/patch-package#nested-packages

This permits us to patch `three-stdlib` inside `@react-three/drei`.
