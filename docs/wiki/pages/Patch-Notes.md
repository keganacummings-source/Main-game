# Patch Notes

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
