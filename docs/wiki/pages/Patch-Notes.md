# Patch Notes

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
