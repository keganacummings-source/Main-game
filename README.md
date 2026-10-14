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

## Quest Board

Ten randomly generated contracts (kill any foe, an element, a named monster or a boss; mine, chop,
pick mushrooms, fish, befriend spirits, craft). The board refreshes every 30 minutes, a finished
contract is replaced by a new random one, and "New board" rerolls everything for kyo. Count and pay
scale with your level and a random difficulty tier. Logic is in `src/game/quest-board.ts`
(tested in `scripts/quest-board.test.mjs`); the state lives on the save as `save.board`.

## Known issues carried over from V5

- 3 tests in `scripts/game-content.test.mjs` fail (fixed equipment stats, equipment
  migration, campfire recipes).
- Black Market is still a runtime patch (`src/game/black-market.ts`) rather than part of the engine class.

## Hardcore: day, night and building

- Day and night are 30 minutes each (Hardcore only; Standard has no night). At night foes have 2x health and deal 2x damage, and give 3x XP. Sleeping at night skips to dawn.
- Press F to build. A Log (Timber) places one solid log tile. Click a placed log to take it back.
- A campfire makes a 15x15 tile safe zone. Foes cannot enter or attack inside it. Use "Hold followers" in the Survival panel to send spirits and companions to wait there.

## Verses

Nine verses can be equipped at once (keys 1-9). Unlock more in Unlock & Upgrade and swap them on the Equip tab. Casting, auto-battle and autogrind only use equipped verses.

## Map Builder (Designer Mode)

Build whole maps up to 512x512 with the supplied tile pack: terrain (paint, rectangle, fill, overlay layers, collision), portals, start tile, enemies, bosses, spawn zones, resource nodes, NPCs, bounty boards, arenas, shrines, hearths and doors, plus an opening story and a quest editor (talk, bring, defeat, travel and gather steps, chained quests, kyo/XP/item rewards and NPC dialogue). "Check map" finds broken quests before you share. Save, then enter the map from the in-game Map panel; export/import JSON to share.
