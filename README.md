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
```

## Development only routes

These are removed in production by temporarily moving `app/api` into `public`.

```sh
curl -XPOST localhost:3000/api/send-dev-event -d'{ "are": "you out there" }'
```
