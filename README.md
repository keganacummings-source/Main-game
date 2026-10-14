# TURBZ V6

Production build of TURBZ (dreamdaw.com): a static Vite + React game served by a
Cloudflare Worker that provides accounts, cloud saves, graves and lobby signaling.

V6 is V5 with the old Grok-preview scaffolding removed (Better Auth, PGLite/Postgres,
TanStack Start routes, Vercel output, base64 build step). All game source is now real
source files; nothing is generated at build time.

## Run

```bash
npm install
npm run dev          # game on :8080 (no backend; account/cloud features need the worker)
npm run dev:worker   # build + run the Cloudflare worker locally (full stack)
npm test
npm run deploy       # build + wrangler deploy
```

Pushing to `main` deploys via `.github/workflows/deploy-cloudflare.yml`
(needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets).

## Layout

- `src/components/` game UI (turbz-app is the main screen)
- `src/game/` engine, content, world, combat FX, sprites
- `src/lib/` static account client + P2P multiplayer
- `worker/` Cloudflare Worker (accounts, saves, graves, lobby signaling)
- `public/` sprites, beasts, MapAssets tile catalog
- `docs/` design notes

## Known issues carried over from V5

- Quest Board panel is empty: `src/game/quest-board.ts` was never wired in (see header).
- 3 tests in `scripts/game-content.test.mjs` fail (fixed equipment stats, equipment
  migration, campfire recipes).
- Black Market is still a runtime patch (`src/game/black-market.ts`) rather than part of the engine class.
