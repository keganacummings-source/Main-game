# Patch Notes

## Two-frame animation, Tile and Enemy editor QOL, new class skins

- **Enemies animate.** Every drawn enemy is now two frames and plays both — there is no toggle, enemies simply move from here on. Enemies made before two-frame art existed, including the twenty shipped with the game, get a second frame generated for them (a one-pixel breath that keeps the top row and the bottom row exactly as drawn, so no head is clipped and no feet float), so your whole roster starts moving without being repainted. A frame 2 you paint yourself is always kept as-is.
- **Tiles can animate.** Every tile and camp piece now has a second frame too, but a tile only loops when you turn **Animate** on — a tile drawn as a still picture stays a still picture. Loop speed is yours to set, 1 to 12 frames per second. Animated tiles are painted over the cached terrain rather than baked into it, so a loop never forces the world to redraw and costs nothing on maps that do not use one.
- **Enemy Designer QOL:** Frame 1 / Frame 2 tabs with a separate undo history each; **Onion** skin showing the other frame faintly underneath; **Auto idle** and **Copy 1 → 2** and **Swap** for building frame 2; a **fill** tool, a colour **picker** that takes a colour off the canvas, **nudge** to shift the whole sprite a pixel in any direction, and **redo** alongside undo. The preview plays the enemy exactly as the game will.
- **Tile Builder QOL:** the same Frame 1 / Frame 2 tabs and per-frame undo, **Copy frame 1 → 2**, **Swap frames** and **Clear frame 2**, a speed slider, and a preview that loops at the real game speed. The builder's tile palette animates too, so a live animated tile moves while you are laying out a map.
- **New class skins** ship as the default: the painted Ruin Mage, Radiant and Gravemage skins are joined by **Crying Girl** and **Pathfinder**. A skin you painted yourself still wins over the shipped one.

## Super Ghost fixes, shiny rebalance, TURBZ2 battlefield

- **Super Ghost revives.** It lived outside the party's heal loop, so once it fell it stayed at 0 HP forever and never rejoined you. It now regenerates out of combat like your other ghosts, scaled to its larger health pool, and recovers to full in roughly 30-60 seconds.
- **Super Ghost slot is fully clickable.** Its card used to be a dead static panel. Click it for the full detail view — portrait, stats, abilities and a Verses tab — the same as a normal spirit. The slot also stays visible while downed, showing "Downed — reviving out of combat…" instead of blanking out.
- **Re-ready Super Ghost verses,** at a higher cap than a normal spirit, since it was fused from many.
- **Shiny odds lowered.** Base shiny rate is now **1/500** (was 1/100) and the boss shiny rate is **1/200** (was 1/50) — still rarer-but-better than base.
- **TURBZ2 is a free-for-all battlefield.** One continent, no sides: every witch fights for herself and hunts other witches as readily as she hunts you, so the wild is a constant brawl instead of everyone converging on the player. Around 60 battlefield witches are kept alive across the continent and topped up every few seconds as they cut each other down, spawned off-screen. Cities remain on the map as landmarks. A witch now only engages you at close range, as she would any other witch; hunter witches still pursue relentlessly. The old team/nation war is preserved behind the `TURBZ2_FREE_FOR_ALL` flag in `src/game/turbz-mode.ts`.

## Tile Builder rebuild, power block art, Mining XP (TURBZ, New Texture Mode)

- **Mining XP.** Every block you break now trains your **Mining** skill: 16 for hell stone, 10 for other stone, 6 for sandstone, 5 for wood, 3 for dirt, plus 6 more when the block drops an ore. A "+N Mining xp" pops up with the drop.
- **Power blocks have art.** The HellStone Generator, Battery, Wire, XP Producer and Duplicator now ship with their own New Texture art, shown on the placed block and in the build bar. Anything you paint in the Tile Builder still wins.
- **Tile Builder rebuilt** (Designer Mode → Camp & Tile Asset Builder): pencil, eraser, fill, line, box, oval and colour picker; undo and redo; mirror drawing; brush sizes; flip, rotate and wrapping shift; zoom and a pixel grid; a game palette plus recent and in-art colours; PNG import and export; a preview on in-game floors and a repeating 3×3 preview with a seam check. The library has search, filters, copy, per-piece Live toggles, pack import that merges, and a storage meter. See `docs/tile-builder.md`.
- **Fixed:** checkboxes in the old builder could not be toggled, painting lost strokes while dragging, Live tile replacements only applied after a reload, and changing the canvas size stretched your art.

## Duplicator (TURBZ, New Texture Mode)

- **Duplicator** is a Power block. Build it from the Power group (6 Hell Ore, 6 Vein Ore, 6 Logs), wire it to a Battery, and press **E**.
- Load **any bag item** — Ghost Jars, Drinking Water, ores, logs, Hell Ore, and the rest. The original stays in the machine.
- Every **5 seconds** it spends **2 Power** and stores one copy (up to 999). Take the copies out, or take the original back to stop it.
- Paint its art in Designer Mode → Camp & Tile Asset Builder → Power → Duplicator (it ships with default art). A Live texture shows on the placed block.

## Mining update (TURBZ, New Texture Mode)

- **Break blocks.** Click a solid block twice to break it. It turns into its matching floor tile, or dirt when it has none.
- **New drops:** 25% **Hell Ore** from stone in hell biomes, 25% **Rock Ore** from other stone, **Dirt Ore** from dirt and sandstone, **Logs** from wood. The three ores are collect-and-sell only for now.

## Ghost update, healing rework, verse rank rebalance

- **Ghost QOL:**
  - **Auto-keep** caught ghosts: Ask me, Shinies, Rare+, Epic+ or Keep all. Auto-kept ghosts join your party, or the Ghost Box when the party is full, with no walking back to them.
  - **Keep all lingering** ghosts on the map in one tap.
  - **Send all out** and **Call all back** for the party, and **Box the idle ones** at the Ghost Box.
- **Witch ghosts look like ghosts.** A witch's ghost used to draw as a solid witch. Now she is see-through and washed in her element colour (or her shiny palette), with the ghost glow, rarity aura, hover and gleam, in the world, in your party and in portraits.
- **Ten new ghost aid verses:**
  - **Wisp Bloom:** regenerate 3% a second for 5 s.
  - **Wellspring:** refills mana and stamina.
  - **Time Wisp:** every cooldown 1.5 s shorter.
  - **Veil Bulwark:** 25% less damage taken.
  - **Ghost Pact:** your hits heal you for 10% of the damage.
  - **War Chant:** +15% damage and sharper crits.
  - **Last Light:** survive one killing blow at 25% health.
  - **Hunter's Mark:** Exposes nearby foes.
  - **Grave Chill:** Soaks nearby foes.
  - **Soul Tether:** your ghost takes a third of the damage you take.
  
  Ghosts choose them when they fit the moment. Every ghost you already own learns one.
- **Healing reworked.** Heal verses restored a flat 40–60 health and were useless at high level. They now heal **9% of your max health + 0.1% per point of power**, times the rank bonus. Wards and ghost heals scale with your health pool too.
- **Maxing one verse no longer breaks balance.** Past rank 5, each rank adds less, toward **×3** at the new top rank, **60**. One verse used to reach ×70 or more. Points above rank 60 on existing saves are refunded.
- **TURBZ Ghost Box fix:** after dying and relighting your camp, the game said you had a Ghost Box but it could not be seen. It now always comes back beside your campfire.

## Witch sprites cleaned up

- **Every class sprite** (all 40) got a clean-up pass:
  - Pale classes have crisp dark edges now instead of soft grey ones that blurred into light ground. This covers the Spirit Caller, Absolver, Seraph, Moonhopper, Vanguard, Nightlord and others.
  - Stray specks are removed.
- **The ten casters** now have their own boots and leggings in their colours, and the same soft foot shadow as every other class.
  - Their weapons are gripped in the hand, and staff heads are joined to their shafts. The scythe was rebuilt.
  - Hats sit on the head in every facing.
  - The Ruinmage's horns were redone.

## New looks for the ten casters

The ten caster classes were recolours of older classes. Each now has an original design, with its own silhouette in every facing:

- **Embermage:** flame hair and a fire orb.
- **Tidewitch:** a fin crest and a trident.
- **Stonecaller:** stone pauldrons, a gem circlet and orbiting boulders.
- **Stormwitch:** a storm-swept crest with a lightning streak, a streaming scarf and a crescent rod.
- **Frostweaver:** an ice-shard tiara, a fur collar and a floating crystal.
- **Radiant:** a great sun disc and a sun sceptre.
- **Gravemage:** a pointed hood, a skull mask and a scythe.
- **Arcanist:** a scholar's cap, spectacles and a floating tome.
- **Ruinmage:** a horned cowl, burning eyes, a tattered hem and a void orb.
- **Veilsinger:** a sheer veil, a moon-flower and a lyre.

## Economy rebalance, Quest Board revamp, Black Market and Bag

- **Economy rebalanced.** Money came in far too fast, mostly from selling armor.
  - Gear is worth much less: **10 + 2 × level × quality value + 3 × enchant power** (Legendary ×6). It sells for **40%** of that, about a quarter of what it used to.
  - A typical drop now sells for one to a few kills' kyo, and a Legendary at your level for about ten.
  - Kill kyo is down about 30% (2 + 0.7 × level).
  - Trading's sell bonus now bends toward +50% instead of climbing forever.
  - Market prices scale with your level. See [Economy](Economy).
- **Quests revamped.** The Quest Board is now the only quest system. Story quests and quest givers on the map are gone, and the Map Builder's Quests tab was removed.
  - **Up to three contracts at once.** Each has **one to three objectives** that all count at the same time.
  - **New objectives:** rare-or-better foes, clearing a dungeon, and rival witches.
  - **Conditions:** at night, or inside a dungeon. They pay extra.
  - **Five tiers** up to **Legend**.
  - **Rewards are worth it now:** 10 to a few hundred kills' worth of kyo, a share of a level's XP, Big Potions and Ghost Jars. Hard pays a Rare+ gear piece, Elite an Epic+ piece and an enchantment, Legend a Legendary and two enchantments.
  - The HUD tracks every accepted contract. Rerolling keeps what you accepted. Old boards are replaced automatically. See [Quests](Quests).
- **Black Market revamp:**
  - Tabs for Sell, Gear, Items, Enchants, Spirits and the new **Buyback** (your last 10 sold pieces, until the next restock).
  - Search, sorting (including biggest upgrade), slot and quality filters, and "I can afford it".
  - ▲/▼ shows how stall gear compares with what you wear.
  - **Restock now** for kyo.
  - 10 gear pieces and 6 enchantments per stock. Enchantment power now rolls at your level, so bought enchants keep up with your gear.
- **Bag touch-up:**
  - Status chips (item count and what it is all worth).
  - Search and sort by name, count, price or stack value.
  - Filters for Usable, Food & water and Materials.
  - A list view, sell prices on every item, and **Sell materials** in one tap.

## TURBZ: any class, full XP, eat and sleep; menus touched up

- **TURBZ: play any class.** The Crying Lady is no longer forced, and the −50% XP for other classes is gone. Every class levels at the full rate.
- **TURBZ Crying Lady builder:** the TURBZ start screen now uses the full builder: perks, borrowed passives, elements and a trait. The every-50-levels rebuild also lets you change her perks and passives.
- **TURBZ: eat, drink and sleep.** There is still no hunger or thirst, but meals and drinking water now give experience. Sleeping at a campfire or bed after dusk skips the night and you wake **well rested** with bonus XP. The Camp menu (H) shows what each does in TURBZ.
- **TURBZ camp fixes:**
  - Boxed ghosts always come back with a Ghost Box, even if you had packed the box on its own.
  - The Ghost Box, Storage Chest and beds land on the nearest open tile if the new site has a tree, rock, water or wall where they used to stand.
  - Ghosts boxed since the camp was packed are kept, not overwritten.
- **Menus touched up** to match the Character sheet and Build bar: status chips, search, sorting, filters and remembered tabs.
  - **Skills (K):** search; sort perks by invested or closest to max; filter by in progress, not started or maxed. Skills sort by level or by closest to the next level.
  - **Quests (Q):** your contract is pinned at the top with its progress. Filter by tier and kind, sort by pay, hardness or speed. Map quests and Story have their own tabs.
  - **Spirits (G):** search and sort your party and Ghost Box by level, rarity, element or name.
  - **Crafting (X):** search by recipe, result or ingredient, a Can-make filter, how many you can make, and **×5** and **All** brew buttons.
  - **Storage Chest:** search, sort, Take or Store 10, **Store materials**, **Store everything** and **Take everything**.
  - **Pause (Esc):** tabs for Menus (shortcuts to every window), Audio, searchable Controls and Worlds.

## Class passives, Crying Girl builder, Trophy Skins, music and fixes

- **Every class has its own passive.** 39 new always-on passives, one per class, shown on the select screen and in the Character sheet (C). See [Classes](Classes). Highlights:
  - **Phasewalker, Rift Step:** blink verses have no cooldown.
  - **Pathfinder, Hybrid Arrows:** every verse is half physical, half magic: armor and spell resistance each stop only their own half.
  - **Bloodrager, Hunting Cat:** a pet cat follows you and harvests nearby trees, ore and plants for you.
  - **Bulwark, Shield Wall:** 40% less damage from foes in front of you.
  - **Ronin, Iaijutsu:** your first hit on each foe is always a critical hit.
  - **Dreadknight, Grave Bargain:** survive a killing blow once every 90 s and heal 30% over 3 s.
  - The **Spirit Caller** keeps its six spirits.
- **The ten caster classes are finished.** Embermage, Tidewitch, Stonecaller, Stormwitch, Frostweaver, Radiant, Gravemage, Arcanist, Ruinmage and Veilsinger had no class perks, and their gimmick (R) did nothing. Each now has two class perks and a working gimmick:
  - **Immolation Loop:** every spell adds a second burn ring.
  - **Tidal Surge:** waves push foes back and soak them.
  - **Earthen Throne:** a ring of roots, and you are planted with 30% less damage taken.
  - **Storm Crown:** auto-firing air bolts.
  - **Shatter:** frozen foes break for triple damage.
  - **Luminary:** every spell hits twice.
  - **Grave Hunger:** cursed foes are drained and you heal.
  - **Arcane Font:** no spell cooldowns, half mana cost, and mana back on every hit.
  - **Cataclysm:** all your mana goes into one blast.
  - **Resonant Verse:** your two longest cooldowns reset, and your next spells hit 40% harder.
- **Every class retuned** so its numbers match what it claims to be:
  - **Ruinmage:** the most Arcana in the veil (+60%) and the smallest health pool (−40%).
  - **Arcanist:** the second-most Arcana.
  - **Bulwark:** the most Guard. **Vanguard:** the most health. **Bloodrager:** the most Might. **Nightblade:** the most crit. **Ironpalm:** the most Haste. **Outrider:** the most speed.
  - Drawbacks sit where each class's identity says they should.
  - The Ruinmage's and Veilsinger's passives are renamed **Gathering Ruin** and **Harmonics**, so they no longer share names with their gimmicks.
- **Crying Girl builder:** she now borrows up to **2 passives from other classes**, picked from a new Borrowed Passives grid in her builder.
- **Trophy Skins (Bloodrager R) reworked:** twice your size, double health, double damage, half damage taken, while it lasts.
- **Character select:** class portraits are larger, no longer squished, and show the plain class with no gear FX. Each class lists its passive and its gimmick.
- **Music:** a third song, **Track4**, joins the rotation. A new song starts every 10 minutes.
- **Set banner fix:** the "set complete" banner now shows when you finish **collecting** a set, not every time you equip one.
- **Witches face where they walk.** TURBZ witches used to stay facing forward while walking sideways, so their blades and axes pointed the wrong way. They now turn with their steps, and their lunges go the way they face.
- **The ten caster classes** each have their own sprite.
- **Colour accents.** Classes that looked alike are easier to tell apart: the **Oathkeeper** wears steel and silver, the **Absolver**'s robes have a faint mint tint, and the **Crying Girl** is tear-teal.
- **Fixes:** every failing test fixed, two missing spell animations (fork and orbit) added, and three duplicate verse ids renamed. A Gravemage save holding the old *Grave Ward* verse now loads the Spirit Caller's version.

## Menus: Camp, Build, Gear and Character sheet

- **Camp menu (H)** now has tabs:
  - **Needs:** meters, eat, drink, sleep, gathering and your materials.
  - **Camp:** campfire, Pack up camp, build mode, followers, the Storage Chest, and a count of every wall, floor, door, bed, Ghost Box and chest in your camp.
  - **Build:** every piece, grouped, with its cost and hotkey.
  - **Cooking:** search, filters for Can make and Missing items, sorting, how many you can make, and **Make ×N**.
  - A status bar shows night, camp, safe zone and warnings.
- **Build mode (F)** has a toolbar along the bottom: pieces in Walls, Floors, Doors and Furniture with hotkeys **1–8**, a **Remove** tool (**X**), and a line that says what clicking the tile under your cursor will do, or why it can't.
- **Gear (I):**
  - **Upgrades only** filter and **Wear all upgrades**, with ▲ on any worn slot that has an upgrade in your bag.
  - **Group by** slot, quality, set, element or use, and a **List** view.
  - A **compare table** against what you wear, stat by stat and enchant by enchant.
  - Worn totals (score, damage, armor, average level, enchants) and **Clear filters**.
- **Character sheet (C):**
  - Your numbers are grouped into Offense, Defense and Utility. Click one to see where it comes from.
  - Real numbers has search and Expand or Collapse all.
  - Bonuses, Skills and Verses can be searched and sorted, including verses by damage per second.
  - Gear is coloured by quality, with a button to open the Gear menu.
- Each menu remembers the tab and view you last used.
- **Fix:** the Publish Wiki job failed on every update. The wiki builds again.

## V.3 UGONCRY — TURBZ is the main game, persistent camps, board reset

- **TURBZ is the main game.** It is the big tile at the top of the menu, marked **MAIN GAME**. The menu is now titled **V.3 UGONCRY**.
- **Leaderboards reset.** Season 3: every board (Hunt, Hardcore and TURBZ) starts empty for V.3.
- **Your TURBZ camp is permanent.** You keep one camp, and only out on the wild. Dying, or the new **Pack up camp** button in the Camp menu (H), folds the campfire and every wall, floor, door, bed, the Ghost Box and the Storage Chest into one bundle. Lighting a campfire anywhere drops it back with the exact same layout. Chest items and boxed ghosts stay inside.
- **Fixes:** dying again before you relit a fire used to delete your packed camp. A camp with only a chest or Ghost Box never came back. A camp still standing when you started a new run (without dying) was lost. All three now keep the camp.
- **No more click-to-pick-up campfires.** Clicking the fire in build mode no longer lifts it (it only lays a floor under it). Use **Pack up camp** (TURBZ) or **Pick up campfire** (Hardcore) instead.

## Dungeon layouts and TURBZ witches

- **Four dungeon layouts.** Rifts, the Tiny Crypt and the Ash Kiln now roll a layout each day: classic **Halls**, **Isles** (islands in water or lava joined by causeways, each isle with its own tribe of foes), a two-storey **Manor** (rooms, doors, stairs) and a **Portal maze** (sealed chambers linked only by portal pads, each a different plane). See [Bosses and Dungeons](Bosses-and-Dungeons).
- **Way home.** Isles, manors and portal mazes put an EXIT sigil in the guardian's room. Pads glow and are labelled; autoplay and click-to-walk path through them.
- **TURBZ witches bring their own ghosts.** One ghost, a second from level 20, a third from 40 (Crying Ladies bring one more, up to three). Ghosts follow their witch, flank you from the other side, heal and ward her, fight whatever she is fighting, and fade when she falls. She calls a fresh one about 40 s after one is destroyed.
- **TURBZ witches fight smarter.** They re-read the fight five times a second, circle and weave instead of walking straight at you, back off when a caster is crowded, **dash sideways** when you wind up a heavy cast or lunge (a real dodge: hits during the dash miss), roll a dodge chance against incoming hits, **lead their shots** to where you are running (one in four is fired straight), and chain spells about twice as fast.
- **Fix:** the overgrown-brick wall art pointed at files that were never shipped, so Sunken dungeons and some town houses drew blank walls.

## V7 — Cleanup, original Crying Girl sprite, visible set bonuses

- **No more "legacy" content.** Every V6 update is now base behaviour. The old `legacy_*` perks are promoted into the main perk pool as "`<ClassName>'s Signature`" and listed alongside new perks (no separate tab). Old saves that stored `legacy_<classId>` are remapped automatically.
- **Dead compatibility paths removed:** `legacyMoveFx` (unused engine FX), `legacyMaps()` (pre-IndexedDB map migration), `LegacyNpcQuest` (ancient map-file quest shape), `migrateEquipment` + `previousEquipment` (V5 enchantment restoration). Modern gear carries its own enchantments.
- **Lighter repo.** 49 orphan assets dropped (one unused music track, one unused sprite, 47 unreferenced `MapAssets` tiles). `public/` went from 29 MB to 21 MB.
- **Crying Girl is back on her original sprite.** The Lidia paper-doll and the per-piece armor silhouettes are removed. She draws from `warrior:cryinggirl` like the other classes. Gear FX and the full-set aura still play on her.
- **Set bonuses are visible everywhere.** Previously the set-bonus text was hidden in a `title=` hover tooltip and inside a collapsed `<details>` disclosure. Now the active set's bonus is pinned under the WORN block, each gear card shows its own set's bonus as a visible line, and every set-progress row shows the bonus side by side with the name.
- **Editing guide.** `docs/EDITING.md` is a lookup table: "I want to change X, where do I go?" (classes, perks, enemies, items, bosses, music, sprites, map builder, …). Top-of-file guide comments on `engine.ts` and `content.ts` point to data files rather than making you dig through the 12.5k-line engine.
- **Version bumped to 7.0.0.**

## Class Rebuild — gimmicks, perks, 64 new verses

- **Every class has a real playstyle gimmick on R.** Phasewalker double-clicks the map to teleport. Nightblade turns into a black cat at 4x speed. Moonhopper becomes a hopping moon rabbit. Hexbinder phases into ghost mode for 20s (she can only hurt enemy ghosts, and only enemy ghosts can hurt her). Bloodrager wears the skins of bosses it has slain and keeps a catalog of them. Spirit Caller's Choir Lead makes her spirits follow your mouse. Every other class has its own: Iron Bastion, Overload, Hawk Volley, Hundred Fists, Grave Tether, Glacier Path, Living Pyre, Tide Pool, Cyclone Ride, Meteor Leap, Sun Lance, Halo of Mercy, Night Watch Lantern, Coin Rain, Grapple Hook, War Banner, Blood Moon, Tempo Shift, Oath of Retribution, Iaido Dash, Skyborne, Blade Waltz and Royal Decree.
- **Old class passives became signature perks.** Each class gained two new perks built around its gimmick. The old passive and stat package live on as that class's `base_<classId>` **Signature perk** in the main perk pool — originally shown as "Legacy perks" in V6, promoted into base in V7.
- **New class: Crying Girl.** She builds her own loadout: pick any 4 perks from the full pool (classics and signatures alike). Her gimmick is Tearstorm. Choosing ranged stretches her melee verses out to a real shot; choosing melee pulls her attacks in close.
- **64 new complex verses.** Two signature verses per class plus the Crying Girl's kit: multi-hit strings (Eightfold Cut, Jackpot, Dragon Combo), chains, rings, echoes and verses that leave you Swift or Shelled. Each class starts with its two.
- **New gear enchants:** Combo Core, Trickster, Showstopper, Shapeshifter and Afterimage boost multi-hit verses and class gimmicks.
- **Verses library sorting.** You can now combine filters for role (melee, ranged, magic, support, movement), effect and shape (multi-hit, area, chain, echo, self-buff), and filter by your class or the signature batch. You can also sort by damage per second, cooldown, reach, accuracy or crit, flip the order, or reset everything at once. The class picker also filters by fight style and gimmick tag.
- **Revamped sprites.** Every class sprite has sharper rim lighting and a contact shadow. Melee classes now carry their weapons (sword, axe, hammer, katana, cutlass, daggers, gauntlets) and wear shoulder plates.
- **Smarter rival witches.** They keep a range that suits their class, circle you, sidestep your casts, drink a potion when low and find their way around walls.
- **Smarter autoplay.** Casters kite and strafe, everyone steps off telegraphed blows (and rolls or dashes when they can), it stops targeting foes behind walls, avoids packs, flees from the middle of a pack, fights back when cornered, and uses the class gimmick in real fights.

## Close Quarters Update — melee vs ranged

- **Melee only works within 2 tiles (64 px) or less.** The old 1–4 tile melee reach is gone. Melee verses (strikes, heavies, blinks, lunges) can no longer start from across the screen, and the extra casting slack melee used to get is removed.
- **Ranged verses and spells now sit clearly beyond melee**, at 96 px (3 tiles) minimum. Short-reach signature ranged verses were pulled out to that floor, so the two forms never overlap.
- **Verse tags show the band:** "melee · within 2 tiles" and "ranged / spell · 3+ tiles".
- **Ghosts** now only dart in with melee verses from 2 tiles, down from about 4. Foe melee (62 px) is unchanged.
- **Starter verses refreshed.** 24 of the 29 classes now start with the new melee verses (the Reaver batch) or the newer spells and ranged verses, so each kit sits clearly in one band: melee classes fight within 2 tiles, casters and marksmen from 3+ tiles. Signature verses and every class's movement verse are unchanged.

## Reaver Update — melee ignores all armor

- **Melee now ignores 100% of armor and defenses** (it used to ignore half). Armor, physical resist, Ward, Guard, the Warded enchant and the Shell status do nothing against a melee hit, whoever swings it: you, foes, ghosts, Last Man Standing rivals and arena fighters. Dodges, evade windows and Echo Guard still work. Spells already skipped armor; ranged hits still face all of it.
- **Foes no longer "adapt" to your armor against melee.** The ×0.65 to ×1.35 swing from freshly changed armor only applies to ranged hits now.
- **30 new melee verses (the Reaver batch).** 20 strikes, 6 heavies and 4 lunges across all 11 elements, from Coffin Nail and Reed Slash up to Barrow Maul and Null Cleave. Some cleave (Ember Cleave, Wind Scythe), chain (Arc Hook), hit everyone around you (Censer Swing) or rake twice (Double Rake). Find them all in [Verses](Verses).
- **Shiny alert.** When a shiny ghost drops, a large **✦ SHINY DROPPED ✦** pops up near the top of your screen for about two seconds. It never blocks clicks.
- **Gear FX:** two new wing styles (Moth and Void) and 8 new patterns. See [Gear FX](Gear-FX).

## V6.2 — UI Remake

Every screen except the Character Sheet was rebuilt on one shared kit (`src/components/ui-kit.tsx`).

- **HUD:** vitals top-left, target frame top-centre while fighting, foldable tracker top-right (day/night, survival, bounties, Bounty Stars, map quest, lobby), bottom dock with verse bar and all menu buttons.
- **Windows:** Skills & Perks, Verses, Quests, Map, Spirits, Crafting, Survival & Camp, Lobby, Menu, NPC talk, right-click menu and death screen all share one card/tab/meter/chip system.
- **Gear split:** Gear Inventory (I) is now separate from the Bag (B, items only). Gear Inventory has purpose filters, quality/element/slot filters, search, sort by power, Sets tab and Stash tab.
- **Phones:** HUD restacks for narrow screens; the menu row scrolls sideways.
- **Performance:** fast HUD fields refresh every 120 ms; everything else only on a real change or once per second. Each window subscribes only to the data it shows.

## V6.1 — Balance Patch

- **Foes track you live.** Enemy stats re-read your power 4 times per second.
- **Base damage up ~40%:** normal 6%→8.5%, boss 7.5%→10.5%, witch 6.5%→9%, bounty 5%→7%, hunter 3%→4.2%, animal 3.5%→5%, minion 2.5%→3.5%.
- **Burning** lasts 15 s, no longer self-refreshes.
- **Potions** heal a % of max health (Potion 15%, Big Potion ~37%) — scale with you forever.

## V6 — World, Overmax & Camps

- **Veilreach is the overworld** (both modes). Classic sites moved to Hearthmere.
- **Every new life gets its own 500×500 world** from a random seed. Keep Current World toggle on the death screen.
- **Overmax stats:** levels, skills, account level, verse ranks and perks have no cap. Chance and reduction stats bend past old knees instead of hard-stopping.
- **32 skills** (up from 15): six activity skills and 11 element masteries added.
- **Last Man Standing** mode added.
- **TurboCircle Classic and War** replace the old TurboCircle modes.
- **Multiplayer removed.** Accounts, saves, leaderboards and the Discord bot remain.
- **New sounds:** all effects synthesised in `sfx-bank.ts`; old `fx1–fx7` files removed. FET master bus.
- **Gear purpose system:** each piece rolls a purpose (Gatherer's, Lucky, Farshot, Warded, Spirit-bound, Wanderer's).
- **Auras** added (13 aura verses, each toggleable, costs % of max health).
- **Enchantment categories:** Combat, Defense, Reach, Gathering, Fortune, Spirits, Travel. New enchantments: Reach, Aura Ease, Quick Hands, Prospector, Lumberjack, Forager, Spirit Bond, Wayfarer.

## V5 → V6 Migration

- All Grok-preview scaffolding removed (Better Auth, PGLite/Postgres, TanStack Start routes, Vercel output, base64 build step).
- All game source is now real source files — nothing generated at build time.
- Ghost slot system removed. Points refunded.
