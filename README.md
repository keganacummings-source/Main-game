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
  - It is now the overworld (see below). Walking into a named area announces it and gives a little Adventuring XP the first time. Quests now say "Travel to *place*" instead of coordinates.
  - Rebuild it with `node --import ./scripts/wiki/register.mjs scripts/maps/build-veilreach.mjs` (it writes `src/game/maps/veilreach.json`, which is embedded in the game). The generator lives in `src/game/map-gen.ts`.
- **Map Builder 2.**
  - **Open a copy of Veilreach** (Files → Built-in worlds) to make your own edits. Save it under a new id to play it as a designer map; the overworld is always the embedded Veilreach.
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


## Combat pace, free movement & smoother worlds

- **Proximity spawning.** Foes from a map's spawn points are only created when you come near: about a screen away, and never less than 900 px. They are packed away again when you are far off and they are not fighting. Time away still counts toward respawns. Bosses, witches, bounties and hunters are always live. Veilreach runs about 20 live foes instead of 530.
- **Foes hit harder.** Base damage per hit (share of your max health) is up about 40%:
  - normal 6% → 8.5%;
  - boss 7.5% → 10.5%;
  - witch 6.5% → 9%;
  - bounty 5% → 7%;
  - hunter 3% → 4.2%;
  - animal 3.5% → 5%;
  - minion 2.5% → 3.5%.
  
  Rarity, bounty-tier and wanted caps rise to match.
- **Foes attack at the verse's own rate.** A foe's time between attacks is now the same base cooldown a hunter gets for that verse. Each move in its kit goes on that cooldown. Swift and enraged foes are 15% faster.
- **Free movement verses.** Blink, lunge and dash go where you steer (movement keys or stick). With nothing held, they follow your click-to-move path or the way you face. They no longer snap onto a foe. Blink travels 96 px and can hop a wall, then hits the nearest foe within 72 px of where you land. Lunge travels 104 px, then strikes whatever is within 64 px. Auto-battle still aims them toward its target.
- **Verses menu.** Tapping an equipped verse opens **Upgrade**, **Move**, **Unequip** and **Cancel**. Move, then tap another key slot: if that slot holds a verse, the two swap. You can also drag slots to reorder them.

## Veilreach is the world & new map

- **Veilreach replaces both old overworlds** (TurboHunt and Hardcore). New hunters wake in Hearthmere's capital. Older saves on the old world wake at the new hearth once. Their campfires, logs and open rifts on the old world are cleared, because those spots no longer exist. Progress made on Veilreach while it was a separate map carries over.
- **Classic sites moved to Hearthmere.** The hearth folk, taverns and bounty boards, the five shrines, the Tiny Crypt and Ash Kiln, and the Tide Tyrant, Void Cantor and Marrow Saint now stand on Hearthmere. Each keeps its old bearing from the hearth, snapped to open, reachable ground (`src/game/main-world.ts`). Rifts, witches, bounties, hunters and survival all work as before.
- **New map window (M).**
  - Drag to pan; wheel, pinch, double-click or the − and + buttons to zoom.
  - **Me** follows you; **Whole map** shows everything.
  - Hover to read areas, levels, people and places.
  - Click to pin a spot. A red arrow by your hunter points to the pin with the distance.
  - Find any town, place or person by name.
  - Layer toggles: areas, people, places, foes, resources.
  - Quest goals pulse gold, and edge arrows point to anything off-screen.

## Hardcore respawn & fast travel

- **Hardcore wakes you at the world's starting point.** A new witch no longer starts in a random tavern: she wakes at the hearth in Hearthmere's capital. TurboHunt still wakes you at a random tavern.
- **Fast travel from the map (M), Hardcore only.** Towns you have walked into (plus the starting capital) get a white ring. Click one, then **Travel** to jump there. **Pin instead** drops a pin as before.
  - Overworld only, and not while in a fight or a duel.
  - Visited towns are kept when a witch dies.
  - Free, no cooldown.
- Every town you stand in is now remembered, even when a smaller landmark area sits inside it.
- Code: `rebirth()`, `fastTravelTowns()`, `fastTravelTo()` in `src/game/engine.ts`; the click prompt is in `MapPanel` (`src/components/game-panels.tsx`).

## Skill update: Wayfinding, Survival and Cooking

Three new account-wide skills (15 in total), built on the map and Hardcore camp mechanics. They keep through death like the others.

- **Wayfinding:** +0.075% movement speed per level (about +30% at level 400), in both modes. Trained by walking (1 XP per 10 tiles), and by a first visit to a town (+30) or continent (+20). Fast travel, ferries and portals give nothing, so it cannot be farmed by hopping.
- **Survival (Hardcore):** hunger, thirst and rest drain 0.2% slower per level, capped at 50%. Trained by eating or drinking (+3), collecting water (+3), building a campfire (+12), waking rested (+15) and living through a night (+40).
- **Cooking (Hardcore):** 0.15% chance per level (cap 50%) that a campfire recipe makes a second portion. Cook meat (+8), cook fish (+10) and purify water (+6) train it.
- Explorer classes (Adventuring aptitude 1.3 or more) also learn Wayfinding faster.
- Old saves get the new skills at level 1. Nothing is lost or moved.
- Fixed: walking into a town no longer risks being recorded as visited before its first-visit XP is paid.
- Code: `SKILLS` and `skillLine()` in `content.ts`, `advanceSurvival(…, drain)` and the recipe `skill` fields in `survival.ts`, hooks in `engine.ts`. Tests are in `scripts/survival-night.test.mjs`.

## Overmax stats and Hardcore respawn

- **Overworld foes come back.** Dying in a rift, crypt or cave and returning no longer leaves the overworld empty. The map rebuilds its camps when you come back to it.
- **Hardcore overworld respawn is 2 minutes** for ordinary foes and world bosses, including time spent out of sight. Rifts, shrines, bounties, witches and hunter squads still do not respawn. Other modes keep their zone timer, or 22s / 70s.
- **Levels, skills, account level, verse ranks and perks are not capped.** Ranks 1–5 stay +15% each (rank 5 = ×1.6). Later ranks add +8% each. Perks can be bought past their old maximum and still add their effect.
- **Chance and reduction stats bend past the old knee** instead of slamming into a wall. Dodge, resists, ward, guard, haste, echo guard, thorns, cooldowns, shop prices and similar bonuses keep stacking but never reach immunity, a free shop, or a zero-second cooldown. Damage, health, sell price and wayfinding stay linear.
- Code: `src/game/overmax.ts`, `src/game/respawn.ts`, hooks in `engine.ts`, `balance.ts`, `content.ts`, `ability-progression.ts`.

## Camps, ghosts, chests and skills update

- **Veilreach is the base map.** The 500×500 world is embedded in the game (`src/game/maps/veilreach.json`) instead of fetched at startup, and the old generated overworld is no longer used. Fixed: leaving to the main menu and rejoining used to load the old map.
- **32 skills.** Six new activity skills (Building, Ghostkeeping, Evasion, Bounty Hunting, Skinning, Looting) and one Mastery per element (11), trained by casting that element's verses (+0.6% damage per level and a small cooldown cut for that element, yours and your ghosts').
- **Resource nodes regrow in place.** A gathered tree, vein or patch is used up where it stands and comes back in the same spot when you finish a sleep or a new day dawns (Hardcore), or once per in-game day (TurboHunt). No more relocating or duplicating trees. Used-up nodes are saved (`save.nodesTaken`).
- **Camp building (Hardcore).** Wooden Wall (2 logs, 1 ore), Brick Wall (1 log, 3 ore), Bed (3 hide, 2 logs) and Ghost Box (4 logs, 4 ore). Beds and the Ghost Box go inside a camp. "Send followers to bed" parks ghosts and companions on the camp's beds until you call them back.
- **Ghosts.** 3 out at once, 6 in the party, the rest in the Ghost Box (store, take, swap, release while standing by it). Ghost slots are removed and their skill points refunded. Ghosts now fight on the player's system: per-verse cooldowns (1.5×), range checks and real strikes, at the ghost's own level and rarity. **Shiny ghosts** (1 in 100) get lava-lamp colours, circle you and move with more character.
- **Enemy witches and bounties** bring real ghosts (ghost kits, aid verses that heal and ward her, the same shiny roll) instead of random monsters.
- **Bounties are deadly.** Higher base damage (12% of your health per clean hit, climbing with tier) and a telegraphed **Death Mark** every few seconds that you must dodge, blink, roll or ward. Enraged bounties get more health, damage, speed, crit and dodge on top of the usual enrage.
- **Hardcore loot chests.** Every drop lands in a chest where the foe fell (bounties and world bosses included; the bounty pick-one pause is TurboHunt only). Open with E or a click; the world keeps running. Click to inspect, Shift+click to take. Chests vanish after 5 minutes or when empty. Hardcore never auto-equips; double-click gear in the Bag to wear it (works in both modes).
- Code: `building.ts` (pieces), `survival.ts` (beds), `content.ts` (skills), `balance.ts` (bounty numbers), `creature-sprites.ts` (ghost and shiny drawing), chest/ghost/node systems in `engine.ts`, `ChestPanel` in `inventory-ui.tsx`, Spirits and camp UI in `game-panels.tsx`.

## Gear FX, ghost FX and uncapped skills

- **Gear FX spread out.** Each slot owns a part of the body, and ordinary pieces show a small pattern at their own spot instead of all orbiting the chest. Only Epic+ outfits get one quiet ground ring.
- **Signatures.** Rare (45%), Epic (75%) and Legendary (always) pieces roll their slot's signature, in the piece's element and accent: chest → wings (feathered, demon, crystal, spirit), legs → a tail (demon, flame whip, wisp, orb chain), feet → a trail (afterimages, footprints, ribbon, spark wake), head → a crown (halo, horns, shard crown, third eye), relic → a familiar (orb, star, moon), weapon → an imbue that adds a layer to every verse you cast (echo twin, extra burst, sigils, comet copy). The Bag names each piece's FX. Code: `fxTrait` in `fx-gene.ts`, `gear-fx.ts`, `imbueLayer` in `combat-fx.ts`.
- **Ghost FX** (`ghost-fx.ts`), for your ghosts and enemy witches' ghosts, read from the ghost itself: element particles, rarity (count, crest, glow), level (spread), speed (pace and a speed streak), health (a guard ring) and shiny (rainbow). Rare+ and shiny ghosts imbue their own verses. The Spirits window describes each ghost's FX.
- **Skills have no caps.** Every bend on skill bonuses is gone. Extra-roll chances go past 100% (each full 100% is a guaranteed extra), speed-ups are rates that improve forever (+100% = twice as fast), catching past 100% raises shiny odds and ghost health, and Evasion is a rating. Helpers: `procs`, `rateMult`, `ratingChance` in `overmax.ts`.

