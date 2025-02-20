# TODO

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

- 🚧 sync Root.tsx with `npc-cli` (not `npc-cli-next-old`)
  - ✅ migrate Nav, Main, Comments
  - ✅ migrate Viewer
    - ✅ finish migrating Tabs
    - ✅ migrate ViewerControls
  - 🚧 migrate world/*
    - ✅ uncomment npc-cli/sh/src/game-generators.js
    - ✅ also npc-cli/tabs/tab-factory.ts
    - 🚧 try fix assets e.g. app/api/dev-web-sockets.js
      - ℹ️ https://blog.logrocket.com/implementing-websocket-communication-next-js/
      - ℹ️ `GET http://localhost:8012/dev-assets/geomorphs.json?v=1740052354192`
      - ✅ `/geomorphs.json?v=1740052354192` resolves to `/public/geomorphs.json`
      - check build works
    - 🚧 get Decor mounting
    - Web Worker syntax

- ✅ src/app -> app etc.
- ✅ deploy to netlify
- websocket server for `asset.js` script -> `World` communication
- cleanup fetch-assets

- maybe need `@emotion/css` for `<Html3d>`
- maybe move flexlayout-react/style/light.css "back" into layout.tsx

- 🚧 fix "initial stress test" for useEffect in `<BaseTty>`
  - https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
  - ✅ set next.config.ts `reactStrictMode` as `false`

- 🚧 migrate assets.js script
  - 🚧 store geomorphs.json in public
  - npm scripts
    ```json
    "ts-script": "ts-node -r tsconfig-paths/register -O '{ \"module\": \"commonjs\", \"isolatedModules\": false }'",
    "assets": "npm run ts-script src/scripts/assets -- --all",
    "assets-fast": "sucrase-node src/scripts/assets",
    "clean-assets": "rm static/assets/{assets.json,geomorphs.json} static/assets/2d/{obstacles,decor}.png{,.webp}",
    "cwebp": "npm run ts-script src/scripts/cwebp",
    "cwebp-fast": "sucrase-node src/scripts/cwebp",
    "get-pngs": "npm run ts-script src/scripts/get-pngs",
    "get-pngs-fast": "sucrase-node src/scripts/get-pngs",
    "watch-assets": "source src/scripts/watch-assets.sh",
    "watch-assets-nodemon": "sucrase-node src/scripts/assets-nodemon.js",
    "ws-server": "sucrase-node src/scripts/ws-server.js",
    "pre-push": "npm run assets-fast -- --prePush"
    ```
  - 🚧 generate decor

- tty: option-arrows not working
- patch-package + patches
