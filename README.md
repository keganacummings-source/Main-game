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

- Day is 10 minutes and night is 15 minutes (Hardcore only; Standard has no night). At night foes have 2x health and deal 2x damage, and give 3x XP. Sleeping at night skips to dawn.
- Press F to build. A Log (Timber) places one solid log tile. Click a placed log to take it back.
- A campfire makes a 15x15 tile safe zone. Foes cannot enter or attack inside it. Use "Hold followers" in the Survival panel to send spirits and companions to wait there.

## Verses

Nine verses can be equipped at once (keys 1-9). Unlock more in Unlock & Upgrade and swap them on the Equip tab. Casting, auto-battle and autogrind only use equipped verses.

## Map Builder (Designer Mode)

Designer Mode has two tools: the Map Builder and the Enemy Designer (below).

Build whole maps up to 512x512 with the supplied tile pack: terrain (paint, rectangle, fill, overlay layers, collision), portals, start tile, enemies, bosses, spawn zones, resource nodes, NPCs, bounty boards, arenas, shrines, hearths and doors, plus an opening story and a quest editor (talk, bring, defeat, travel and gather steps, chained quests, kyo/XP/item rewards and NPC dialogue). "Check map" finds broken quests before you share. Save, then enter the map from the in-game Map panel; export/import JSON to share.

## Balance patch (V6.1)

All numbers live in `src/game/balance.ts` (tested in `scripts/balance.test.mjs`).

- **Foes track you, live.** Every foe re-reads your power four times a second and resizes: never below your level, health measured in *your* average hits, damage measured as a share of *your* health. A foe that spawned at level 3 is still a fight at level 300. Foes read a smoothed copy of your power that climbs in a minute or two (faster in Hardcore) and falls slowly, so an upgrade feels great for a moment, then the world catches up.
- **Hardcore gets the biggest buff.** More health, harder hits, higher levels, and it keeps growing with your level, nights survived and bounty tier (up to 2.5x).
- **Every foe is its own.** Each rolls a stat line from its element and species, 0-8 enchantments (Vampiric, Thorned, Warded, Frenzied, Swift, Brutal, Regenerating, Evasive, Armored, Spellward, Giant) and a 1-4 move kit it picks from in a fight. Right-click a foe to read it.
- **Gear starts at your level.** Every drop (mobs, bosses, bounties, hunters, shrines, market, crafting) is rolled at your current level; quality, the source and luck push it up a bounded amount. Nothing compounds off what you already wear. Long bounty ladders are the road to level-1000 gear.
- **Bounties.** Three marks are posted at once; each kill posts a stronger one. On a kill the game pauses: their kyo and full bag are yours, and you pick one of their six gear pieces. After your first bounty, kills can earn Bounty Stars; at 10 a price is put on you and squads of 5 hunters stronger than you keep coming (Hardcore: every 60 s, Standard: every 90 s) until you clear your name at a board.
- **Burning** lasts 15 seconds and takes 5% of max health each second. It no longer refreshes itself. Cleanse Salt puts it out.
- **Potions** heal a share of max health so they stay useful late (Potion 15%, Big Potion 37%).
- **Bag (B)** rebuilt: worn slots, slot filters, sort, compare arrows, lock, and **Sell all unequipped** (locked and worn gear is kept). The **Black Market (T)** opens on a Sell tab for gear and bag items.
- **Crypt and Kiln** use real wall and floor tile art and are drawn live, so walls are never invisible.
- Rifts above level 50 are no longer deleted on load.

## The Green Cave (Hardcore, level 30+)

A built-in designer map (`src/game/maps/greencave.json`, loaded by `src/game/builtin-maps.ts`). It is not listed under Designer Maps. In Hardcore at level 30+, the Black Market sometimes stocks a **Green Mushroom** (about 40% of refreshes). Eat it from the Bag and you are sent to a fresh instance of the cave: the map, foes, nodes and its quest are rebuilt every time. Foes are never below the zone levels set in the map (35-50) and still scale up with you. Leave through the "Wake up" door at the arrival point (added automatically when the map has no exit) or Menu → Return to the overworld. To update the cave, export it again from the Map Builder and replace the JSON file.

## UI remake (V6.2)

Every screen except the Character Sheet was rebuilt on one shared kit (`src/components/ui-kit.tsx`) in the Bag's style.

- **HUD:** vitals top-left, a target frame top-centre while you fight (level, HP, enchantments, whose turn), a foldable tracker top-right (day/night, survival, bounties, Bounty Stars, map quest, lobby), and one bottom dock with the verse bar and every menu (keys shown on each button). Chat (party, global, friends) is one foldable window.
- **Windows:** Skills & Perks, Verses (loadout slots + searchable library), Quests, Map, Spirits, Crafting, Survival & Camp, Lobby, Menu, NPC talk, right-click menu and the death screen all use the same cards, tabs, meters and chips. Rebuilt windows use new layout keys so old cramped sizes do not carry over.
- **Menus:** login, hub, title, character creation, leaderboards, options and Designer Mode share one screen layout.
- **Phones:** the HUD restacks for narrow screens; the menu row scrolls sideways.
- **Performance:** the engine refreshes fast HUD fields every 120 ms and everything else only on a real change or once a second; the Character Sheet is only built while it is open; unchanged data keeps its identity, and each window subscribes only to the fields it shows (`src/components/use-snap.ts`), so the page no longer re-renders as a whole several times a second.

## Enemy Designer

Designer Mode → Enemy Designer (`src/components/enemy-designer.tsx`, data in `src/game/enemy-design.ts`).

- Make a **new enemy** (it spawns in the biomes you tick, how often you choose, and can be placed in Map Builder spawn zones) or **replace a built-in enemy** everywhere it appears.
- Sprite: pick any cell of the creature sheet or draw 16×16 pixels (palette, mirror, undo), size 1-3×.
- Identity: name, element, behaviour (hunts you / only if provoked / flees like a beast), boss, description.
- Combat: health, damage, turn speed, crit, dodge, physical and spell resist, levels above you, fixed enchantments plus random extras, and 1-4 moves. A live readout shows how many of your hits it takes and how hard it hits in Standard and Hardcore.
- Loot: kyo and gear-drop multiplier.
- Designs save on this device and are live in your games. **Export all** and put the file at `src/game/enemies/custom-enemies.json` to ship them to every player.
- The old Weapon Designer was removed (its designs were never used by the game).

## Gear FX & set unlock update

- **FX genes.** Every gear piece now rolls its own FX gene, which sets 16 patterns (orbit, comet, helix, sigil, shards, halo, wisps, petals, spiral, pulse…), 8 particle shapes, an optional accent element colour, speed, spin direction, size, density, height and a flare. Each Fine+ piece you wear draws its own pattern, so two pieces of the same element rarely look alike. Old gear gets a stable gene from its id. The Bag's detail panel shows each piece's FX.
- **Set auras.** All 100 sets now have their own aura variant (tint, size, spin, mirror and one of 7 crests), plus their own proc burst shape, colour and sound.
- **Starter sets per character.** Collecting all 5 pieces (helm, raiment, skirt, boots, relic) of a set unlocks it for the class you were playing. When that witch dies, the rebirth screen opens on the same class and offers the set as level-1 spawn gear with its full set bonus. Any race's set works. Class cards show how many sets each class has, and the Bag lists this class's set progress. Old saves keep their finished sets.

## Combat text & enemy info update

- **Combat numbers** use the pixel fonts with hard outlines and are drawn in screen space, so they stay sharp at any zoom. Damage, crits (bigger, with a burst and a CRIT tag), damage you take, heals, misses and status words each have their own style. Text spawned on the same spot fans out in lanes instead of piling up.
- **Enemy nameplates** show for every foe on screen, not just close ones:
  - a danger-coloured level badge (green below you, gold even, orange +3, red +6);
  - the name and an element dot;
  - BOSS / ★ BOUNTY / HUNTER / WITCH tags;
  - short trait chips (VAMP, THRN, SWFT…);
  - a segmented health bar with a lag trail that shows each hit.
  - Far plates fade, and crowded ordinary foes collapse to a slim bar so the important plates stay readable. The hovered foe and your target also show exact HP.
- **Mouse-over card** follows the cursor. It shows the foe's level, element, HP bar, what hits it harder, every trait with what it does, its moves and bounty details. Other things (NPCs, nodes, water) get a short card too. The top target panel was restyled to match.

## Status immunity & move signatures update

- **No more control chains.** Effects never stack: a second copy refreshes the first.
  - Sleep, root and silence are capped short (2.5 s / 2.5 s / 3 s) and cannot be extended while active.
  - When they end (run out, broken or cleansed), the target is **immune** to that effect for a while: 7 s sleep, 5 s root, 6 s silence. The HUD shows "Sleep immune" and similar, and attempts float "RESIST".
  - Bosses, bounties, witches and hunters shake control off twice as fast.
- **Counters.**
  - Any hit wakes a sleeper.
  - Mashing keys shakes off sleep and roots faster.
  - Blink still breaks roots.
  - Blinks, dashes and mends work while silenced.
  - Cleanse (verse or Cleanse Salt) clears everything and grants immunity.
- **Bug fixes.**
  - Enemy hits used to apply their effect twice.
  - Your own sleep verses were removed the instant they landed.
  - Silence did nothing to enemies; now silenced foes cannot cast spells.
- **Move signatures.** Every verse keeps its existing animation and gains its own layer on top:
  - a cast flourish and an impact flourish (pillar, shockwave, shards, cross, sigil, implosion, spike crown);
  - an accent colour, plus a per-verse projectile size and trail tint;
  - on some projectiles, a companion that spirals around the shot;
  - a status overlay showing what it does: sleep Zs, rising roots, silence rune, flame ring, splash, gloom smoke, exposed reticle, sparks, drain motes streaming back to the caster.

## Veilreach world & Map Builder 2

- **Veilreach**, a new 500×500 world built with the Map Builder: seven continents split by sea, plus islands.
  - Hearthmere (levels 1–12, the start), Saltmire, Frostmarch, Emberwaste, Hollowdeep, Bonereach, and Crownfall Isle (75–90) in the middle.
  - 41 towns: walled capitals, towns and ports, plus villages, with shops, plazas and NPCs, joined by roads.
  - Mines, woods, fisheries and mushroom groves; ruins, barrows, altars and watchstones; about 200 enemy camps and a boss on every continent.
  - **Ferries.** Step onto the end of a pier to sail to the next port. The ports form a ring that links every continent.
  - **Main story, "The Sundered Crown".** It sends you to each continent's capital for a shard. Every chapter has you talk to people in sister towns, gather, fight and visit landmarks, then ends on Crownfall Isle.
  - Every town also has three side quests.
  - Enter it from Menu → **Worlds & Designer Maps**. Walking into a named area announces it and gives a little Adventuring XP the first time. Quests now say "Travel to *place*" instead of coordinates.
  - Rebuild it with `node --import ./scripts/wiki/register.mjs scripts/maps/build-veilreach.mjs` (it writes `public/Maps/veilreach.json`). The generator lives in `src/game/map-gen.ts`.
- **Map Builder 2.**
  - **Open a copy of Veilreach** (Files → Built-in worlds) to make your own edits. Saving it under the id `veilreach` replaces the built-in world on your device.
  - **Generate a world** (Files) builds a whole map for you, using your choice of size, continents, cities per continent, islands, seed and an optional main story.
  - **Areas tab.** Draw named areas (continent, city, resource, landmark, dungeon, water), each with a description and a level range. They are announced in game and shown on the map.
  - **New tools:**
    - **Line**, for roads, rivers and walls;
    - **Scatter**, to sprinkle trees or rocks over a rectangle at a set density;
    - **Copy / Stamp**, to clone a house or a whole town block;
    - **Mix variants**, which paints random siblings of a tile so ground does not look stamped.
  - **Minimap** with click or drag to jump.
  - **Find** box, to jump to any area, NPC, quest or zone.
  - **Zoom** out to a whole-map overview.
  - **Storage.** Maps are now kept in IndexedDB, so 500×500 maps save. Older maps are moved over automatically.
  - Ferry portals that point to the same map count as a path in "Check map".

