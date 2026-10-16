# TURBZ V6

Production build of TURBZ (dreamdaw.com): a static Vite + React game served by a
Cloudflare Worker that provides accounts, cloud saves, graves (leaderboards), the Shiny collection and the Discord bot. There is no live multiplayer.

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
- `src/lib/` static account client
- `worker/` Cloudflare Worker (accounts, saves, graves, shinies, Discord bot)
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
- **Sleep in your beds (Hardcore).** Walk up to a bed you built and press E, click it, or use Survival & Camp → Sleep in bed. You climb in under the blanket and rest refills 1.5× as fast; sleeping through the night still skips to dawn and regrows the land.

## Last Man Standing, Circle War and smarter autoplay

- **Last Man Standing** (new main-menu mode). You and 99 rival witches start at level 1, spread evenly over the 500×500 Veilreach map with its townsfolk and quests removed. Hardcore rules, one life, and a night that never ends: the world holds only ghosts. Pick a class and step in as the challenger. Rivals play like you do: they grind ghosts, gather, cook, brew potions, spend skill points (a heal first, then a ward, a dodge, then attacks and ranks), gear up from drops, and once they hold a full set at level 14+ they hunt other witches (after 18 minutes everyone hunts). In a fight they kite at their best range, heal and ward when hurt, drink potions, dodge your strikes and flee to recover. A fallen rival drops a loot chest. The match HUD shows who is left, your kills, the time, how many are hunting and the nearest rival. Rivals far from you are simulated in coarse steps so a full lobby stays at 60 fps. A typical match runs 30–40 minutes. Code: `src/game/lms.ts`, `lmsWorldFile` in `builtin-maps.ts`, hooks in `engine.ts`, `LmsHud` in `turbz-app.tsx`.
- **TurboCircle modes are now Classic and War.** Classic is 6 v 6. War is two armies of 10 to 100 a side (slider) on the new large Battlefield map (groves, a muddy ford, traps). Armies march in formation behind a captain, then break into fights and spread their targets. 100 v 100 runs at about 40 fps.
- **TurboHunt autoplay** looks after itself: drinks a potion when hurt, backs off and rests until healthy, spends skill points on its equipped verses, picks foes it can beat that are worth the trip (skipping bosses), and casters keep their distance instead of standing in melee.
- **Verse ranks show their numbers.** The Loadout and Library show each verse's power (or heal / ward amount) at its current rank with the rank multiplier, plus what the next rank gives. Ranking up says the new value.
- **Ghosts linger.** When a fallen foe's ghost would stay, it now stands where it fell for 5 minutes instead of joining at once, so you can finish the fight first. Press E or click it to look: health, speed, rarity, element, FX and every move it knows. Rename it, add it to your party (it follows if fewer than 3 are out), send it to your Ghost Box, or dismiss it. Unclaimed ghosts fade after 5 minutes (they blink in the last 30 seconds). Autoplay still keeps ghosts on the spot.

## World generator 3, shinies, Ascension & death screen

- **World generator 3** (`src/game/map-gen.ts`). Every seed is a new main world.
  - Lands come in different shapes (round, long, twin-lobed), each with its own climate shuffled from the seed, patches of a second climate inland, its own ruggedness, lakes, and rivers (lava in the Ashen lands) with bridges where the roads cross.
  - Ten kinds of settlement: capitals, towns, harbours, villages, hamlets, forts, abbeys, market towns, mining camps and infested ruins. Each is laid out in one of five street plans (crossroads, grid, ring-walled, high street, scattered) and filled with houses, shops, inns, smithies, temples, manors, warehouses, barracks and huts, plus wells, statues, stalls, gardens, farm fields, orchards and graveyards. Roads branch between towns instead of all running to the capital.
  - Sixteen kinds of landmark (ruins, standing stones, watchtowers, crystal spires, graveyards, huts, old gates, dragon bones, obelisks, shipwrecks, craters, groves, statue galleries…) and scattered scenery: boulders, ponds, bones, blooms. Anything that blocks keeps a free ring around it, so it never cuts a path.
  - **Resource nodes are placed one at a time.** No more grids or forest blocks: each node needs two clear tiles around it, and what grows depends on the ground (trees in wet green country, ore by the hills, mushrooms in bog, bone and void, fishing spots on shores).
  - Quest XP is now a real share of a level, and new quests come from forts, abbeys, markets, mines, hamlets and foragers.
  - Veilreach has been rebuilt with the new generator. Hunters on the old map wake at the hearth once.
- **Quests are checked to be finishable** (`src/game/quest-check.ts`): reachable givers and targets, foes that really spawn, enough nodes for gather steps. The generator repairs everything before it hands the map over. The Map Builder's Quests tab has **Check quests** and **Fix quests**, and Check map lists any quest that cannot be done.
- **Map Builder: New main world, Surprise me, Play this map as main world.** A generated (or hand-made) world can replace Veilreach as the overworld on this device; Back to Veilreach undoes it.
- **Quest XP boost.** Map quest XP is doubled plus 15% of your current level bar; bounty-board contracts and classic quests now give XP too.
- **Classes revamped.** Every class has one Focus (Defense, Spell Power, Summoning, Critical Hits, Tempo, Raw Power, Lifesteal, Endurance, Speed, Healing, Fortune, Insight…) carried by one big stat. The element is a side note (+5% Affinity with its verses). Renamed: Frostguard → Vanguard, Emberheart → Channeler, Tideshaper → Wellspring, Galeborn → Outrider, Radiant → Beacon, Umbral → Phasewalker.
- **Overworld foes:** 45% of camp and spawn-point foes roll a random kind instead of their set one. Bosses, dungeons and rifts keep theirs.
- **Ascension** (main menu): wipes every bit of account progress, locally and in the cloud, after two warnings (the second asks you to type ASCEND). The ascension count and the Shiny collection are kept.
- **Shinys Seen** (main menu): every shiny ghost the account has ever picked up, animated. Shinies are recorded on pickup (old ones in your party or Ghost Box are added on load) and synced to the account (`/api/shinies`).
- **Discord bot:** `/shiny username` answers with a GIF of that player's Shiny collection, and every shiny that drops for a player is posted to the /turbzhere channels as a "Shiny Ghost Seen" GIF saying who saw it. Run `scripts/discord/register.mjs` (the deploy does) to add the command.
- **Sound:** dying plays `public/sfx/you-died` and shows a **YOU DIED** screen with the witch's stats, then **Play again** or **Go to menu**.
- **Ghosts float on their own:** spirits pick their own spots around you, drift there on momentum, trail when you walk and catch up. Shinies are restless little sparks that zip and loop but stay close.
- **Tiny followers:** tag up to 20 Ghost Box ghosts (Spirits → Tiny followers) to float with you at a quarter size, on your shoulders or over your head. Cosmetic only: no stats, no attacks.
- Resource nodes no longer have labels; walk up to one to see "E Chop / Mine / Forage".

## A world for every life, random elements, no multiplayer

- **Every new life gets its own 500×500 world.** Making a character, or starting again after a death, rolls a new world from a random seed. The number of lands, towns, islands and everything else comes from that seed. The seed is saved with the character, and the built world is cached on the device (`src/game/life-world.ts`, IndexedDB store `worlds`). Leaving, logging out or coming back opens the same world, and it is never re-rolled on load. Another device rebuilds the identical world from the seed.
- **Keep Current World.** The YOU DIED screen (and the next-witch screen) has a toggle that keeps the current world for the next life instead of rolling a new one. A new world clears what was pinned to the old ground: campfires, logs, rifts, a placed Ghost Box (refunded in TurboHunt; the ghosts inside are kept) and that world's quest progress.
- Characters from before this update stay on Veilreach until they die. Last Man Standing still uses Veilreach. In the Map Builder, **Use for my next life** queues a saved world for your next new life instead of a random roll.
- **Random elements:** on top of the 45% random-kind roll, half of all overworld foes roll a random element. It shows in their name ("Fire Kusa"), and their moves, colours and the ghost they drop all follow it.
- **Multiplayer removed.** No lobbies, P2P play, party chat or player trading. The `/api/rtc` route and the signaling Durable Object are gone (wrangler migration `v4` deletes `SignalingRoom`). Accounts, cloud saves, leaderboards, the Shiny collection and the Discord bot stay.
- **Ghost Box in TurboHunt:** Spirits (G) → Ghost Box has **Place Ghost Box here** (4 timber + 4 ore) and **Buy & place** (150 kyo). Once placed, **Move Ghost Box here** brings it to you from anywhere in the overworld. Right-clicking the ground also offers Place / Move Ghost Box here.
- Sound effects were later replaced by the synthesised bank (see **Moves, auras, gear and sound** below).

## Moves, auras, gear and sound

- **Move ranges and cooldowns vary much more.** Every verse has a shape: melee jabs (36–72 reach), lunges and blinks (120–250), spells (140–290), volleys, reloads and long shots (130–340). Longer reach costs a longer cooldown (`moveCdFactor` in `content.ts`), and each verse gets its own ±20% twist so no two feel alike. Signature verses have hand-set reach and cooldown. The Verses panel shows each verse's live reach and cooldown. Foes can never reach past 240, so nothing snipes you from off screen.
- **Auras** (13, e.g. Aegis, Thorns, Bloom, Fury, Farsight, Spirit Lure, Harvest, Gold): slot one on the bar and cast it to switch it on or off. While on, it holds back a share of your max health (8–18% each; total capped at 60%). Up to 3 at once. They cover shields, damage, longer reach, more ghosts caught, gathering, kyo and more. The Aura Ease enchant cuts the cost by up to half.
- **Enchantments have categories:** Combat, Defense, Reach, Gathering, Fortune, Spirits and Travel. New ones: Reach, Aura Ease, Quick Hands (faster gathering), Prospector (ore), Lumberjack (timber), Forager (mushrooms), Spirit Bond (your ghosts hit harder) and Wayfarer (out-of-combat speed).
- **Gear has a purpose.** Each piece rolls one (shown in its name: *Gatherer's*, *Lucky*, *Farshot*, *Warded*, *Spirit-bound*, *Wanderer's*) and draws most of its enchantments from it, so some gear is for farming and some is for fighting.
- **Gear Inventory (I)** is its own window, separate from the Bag (B, items only). Filter by purpose (with counts), quality, element, slot, worn or locked; search covers set and enchantment names; sort by power for any purpose. The **Sets** tab groups set pieces and can wear the best piece of each slot. The stash is there too.
- **New sounds.** Every effect except the You Died sting is now synthesised in `src/game/sfx-bank.ts` when audio starts (hits, thuds, slams, booms, magic swells, chimes, reward arpeggios, a fanfare, gathering taps, clicks, chest rattles, cast whooshes). Nothing downloads and every sound is level-matched. The old `fx1`–`fx7` files are gone.
- **FET master bus.** All audio (effects, music and You Died) runs through one FET-style compressor (8:1, ~1 ms attack, 90 ms release, hard knee), light saturation, makeup gain and a limiter, so the mix is even and never clips.

## Ghost rarity, abilities, Starfall verses and full enemy coverage

- **Ghost rarity: Common to Mythic.** Every ghost wears its rarity: a colour wash over the body, a glow underneath, its own opacity, and from Rare up a gleam that sweeps across it (`src/game/ghost-style.ts`). Epic ghosts can climb to Legendary and Legendary to Mythic (bosses far more often, and a shiny gets one more try).
- **Twelve shiny palettes.** Shinies roll Ember, Tidal, Verdant, Rosequartz, Frostbite, Gilded, Toxic, Abyssal, Sunset, Aurora, Eclipse or Prism (the old rainbow). Rarer ghosts lean towards the rarer palettes. Shinies from before keep Prism.
- **Ghost abilities.** 20 abilities (18 for any ghost, 2 shiny-only: Shiny Charm and Radiant Surge) in `src/game/ghost-abilities.ts`. Ghosts roll 1 at Common/Uncommon, 2 at Rare/Epic and 3 at Legendary/Mythic, each with a quality roll; strength grows with level and rarity. Passives feed the same totals gear and auras do; timed ones (Spirit Guard blocks a hit every 60s, Soul Bomb, Soul Mend, Second Wind, Radiant Surge) run on shared timers. Many ghosts stack up to each ability's cap. Abilities work while a ghost is **out with you or tagged**, and timed ones start on a full cooldown when they switch on.
- **Ghosts level from kills.** Ghosts out with you (60%) and tagged tiny followers (35%) earn XP from every kill, and can grow up to 10 levels past you. Go Leveling uses the same cap.
- **Every foe can leave a ghost:** animals, witches, hunters, bounty marks, shrine foes and summoned foes now roll the catch chance too. Bosses leave a ghost half the time, and always when the shiny roll hits. Shiny odds are ×1.3 at night (Hardcore).
- **New Spirits window.** Party / Ghost Box / Bonuses tabs; every ghost opens to a live portrait, rarity and palette badges, health and XP bars, full stats, and its abilities with exact numbers and whether they are on. Ghost Box ghosts can be inspected and tagged from anywhere. The lingering-ghost window shows the same details.
- **The Starfall batch: 17 new verses with animations of their own** — Starfall (meteor), Chain Bolt (leaping lightning), Gale Vortex, Sun Pillar, Frost Obelisk, Grave Nova, Ember Ring, Moon and Bone Boomerangs, Hail Barrage, Rift Fissure, Hex Sigil, Phantom Hands, Grave Grasp, Undertow (a rolling wave), Thorn Bloom and Prism Bloom. Many hit more than one foe: **splash** around the target, **nova** around you, **chain** from foe to foe, or a **boomerang**'s second cut. Ghosts and foes of the element can roll them too. Filter them with **✦ Starfall** in the Library.
- **Camps everywhere.** World generation adds a monster camp to any reachable land more than 18 tiles from one (`ensureEnemyCoverage` in `map-gen.ts`), borrowing kinds and levels from the nearest camp. Generated 500×500 worlds went from 50–150 camps to about 240–290 (590–770 foes). Cached life worlds and Veilreach are topped up the same way when they load. The zone limit is now 1500.
- **UI tidy-up.** Tab bars, small buttons, empty states and meters across the Character sheet, Gear Inventory, Map Builder and menus use the shared kit; Map Builder deletes use the two-tap confirm.
- **Wiki** sections that had fallen out of step (All verses, Monsters, Animals, every class, Perks, The Bag, Disenchanting) are back, so `npm run wiki:check` passes again; Spirits and Verses document the new systems.

## Saves that hold, account perks that last, Space-bar items

- **Saves work no matter what.** Every save goes to this device first (plus an autosave every 8 s of play and on closing the tab). The cloud copy is gzipped (`gz1:` payloads, about a tenth the size, accepted by the worker), uploads are gathered and retried with back-off, and a failed upload never loses anything. On load the newer of this device's and the cloud's witch wins (`savedAt`), and the account record is merged field by field, so a stale cloud copy can no longer roll progress back. If the cloud can't be read, you play on from this device and nothing in the cloud is overwritten with an empty slot. The pause menu shows the sync state and has **Save now**.
- **Account perks last.** Perk points are now worked out from your account level (**5 per level**) minus the perks you bought, so they can't be lost or doubled between TurboHunt and Hardcore. Account level and XP merge as a pair. Another player signing in on the same browser no longer inherits your account record. New perks: Shiny Charm, Ghost Mentor (ghost XP), Spirit Resonance (ghost ability strength), Wide Arc (splash / nova / chain / boomerang damage), plus Swift Step, Thorns, Focus, Aura Ease and Leech. The perk list has categories and shows points earned and spent; Ghostkeeping now also speeds ghost XP and strengthens ghost abilities.
- **Potions are useful, and work in Hardcore** (at ¾ strength). Heals are a share of max health: Potion 28% + 12% over 6 s, Big Potion 50% + 20% over 8 s, Spirit Candy and Spirit Lamp also mend your ghosts; meals heal a little and trickle more. Potions share a 4 s cooldown. Trail rations and cooked meat now work in TurboHunt too.
- **Space-bar items.** In the Bag, **Set to Space** and **Queue** line up to 3 items; Space uses the first and, when it runs out, the next one takes over. The verse bar shows the Space slot. New witches start with Potions on Space.

## Loot piles, readable chests, dungeon instances, ghosts kept through death

- **Chests merge.** In Hardcore a drop within 3 tiles of an existing chest goes into it (`chest-loot.ts`: `chestToJoin`, `mergeChestInto`), and chests already on the ground fold together once a second. A fight now leaves one pile with a count badge instead of a carpet of chests.
- **Chests show what is inside.** Plain chest = supplies only; a beam and ground ring in the best gear's quality colour (grey, white, green, blue, purple, orange; taller for better gear) = gear; gold sparkles = boss loot. Labels read `SUPPLIES · 4m`, `EPIC GEAR ×3 · 4m`, `BOSS LOOT · 4m`, red in the last 30 s. The chest window shows the same summary and a **Reading chests** key.
- **Dungeons are instances.** Foes in the Tiny Crypt, the Ash Kiln and rifts no longer respawn while you are inside (`respawn.ts: isInstanceMap`). Who you killed is saved (`save.dungeons.inside`), so reloading inside doesn't refill it; walking out and back in starts a fresh instance.
- **Ghosts survive death in every mode.** On death the whole party and Ghost Box are banked on the account (`ghostVault`, per mode), and the next witch of that mode inherits them, whether she is made on the death screen or as a brand-new witch from the title screen.


## Melee rework and truthful tooltips

- **Melee reach is fixed by the verse.** Every melee verse reaches 1–4 tiles (32–128 px, `MELEE_MIN_REACH`/`MELEE_MAX_REACH` in `content.ts`). Long Reach, Far Sight and other range bonuses only stretch ranged verses and spells now.
- **Melee ignores armor and defenses, everywhere** (half at first; now all of it, see *Reaver update* below). `balance.ts: MELEE_ARMOR_PIERCE` / `defenseVs()` cut the target's armor, physical resist, Ward and Guard against any melee hit: you on foes (armor now applies to melee at half instead of not at all), foes on you, ghosts, Last Man Standing rivals and arena fighters. Beasts always count as melee.
- **Text that lied, fixed.** Item descriptions now say what each item actually does and where it comes from (no more "Crownfall will buy this" ore); the Bag always shows the description, with the reason you can't use something underneath, and hides Use on materials. World hover info for ore, trees, mushrooms, dungeon doors and shrines matches regrowth, instances and Hardcore healing. Story quests point at places that exist in every world (Tide land, Ashen land, the Tiny Crypt), classic NPC lines no longer name places that aren't there, skill lines match their formulas (Hunting, Physical, Adventuring), Armored/Spellward say what they do, and death and mode screens mention that ghosts carry over and how Hardcore healing works. The old Hardcore duel tip is gone.


## Reaver update: melee ignores all armor, plus 30 melee verses

- **Melee ignores 100% of armor and defenses.** `balance.ts: MELEE_ARMOR_PIERCE` is now `1`, so `defenseVs("melee", x)` is `0` everywhere it is used: your hits on foes (`engine.ts: damageParts`, `resolveHit`), foes on you (`foeHitRaw`, `incomingOf`, ward and guard), Last Man Standing rivals and arena fighters. Armor, physical resist, Ward and Guard are ignored; so are the **Warded** foe enchant (`resolveHit` gives the 15% back before `applyMobDamage` takes it), your **Shell** status against melee, and the arena shield cut. Armor Crack has nothing to remove from a melee hit. Dodges, evade windows, Echo Guard and shields as a health pool are unchanged, because they stop a hit instead of reducing it.
- **No armor adaptation against melee.** `enemyHitDamage` skips the ×0.65 to ×1.35 smoothed-armor swing for melee, since armor no longer matters to it.
- **The Reaver batch (`content.ts: REAVER_BATCH`).** 30 new melee verses: 20 strikes, 6 heavies and 4 lunges, covering all 11 elements (Normal 4, Fire 3, Water 2, Earth 3, Air 3, Electric 2, Ice 2, Void 3, Light 3, Spirit 2, Ghoul 3). They use the existing verse mechanics only: `splash` (Ember Cleave, Tidebreaker, Wind Scythe, Null Cleave), `chain` (Arc Hook), `nova` (Censer Swing) and `echo` (Double Rake). All reaches sit in the 32–128 px melee band. Foes, ghosts, rivals and the Library pick them up automatically from `MOVES`.
- **Text and tests.** Verse tags read `melee · ignores all armor`; the character sheet and Armored foe enchant text match. `balance.test.mjs` checks the new pierce, and `game-content.test.mjs` checks the batch. Wiki pages Damage and Formulas, Defense and Evasion, Verses, Enemies and Patch Notes are updated; the verse tables are generated from the game data.
- **Shiny alert.** `engine.ts: announceShiny` (every shiny drop, autoplay included) bumps `snap.shinyAlert`; `ShinyDropAlert` in `turbz-app.tsx` shows a click-through "SHINY DROPPED" banner for 2.4 s (`.shiny-drop-alert` in `styles.css`, with a reduced-motion fallback). It re-triggers if a second shiny drops while it is showing. Not shown in Last Man Standing.
