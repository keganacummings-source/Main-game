# Designer Mode and the first dungeon update

Open **Designer Mode** from the main menu, then choose **Map Builder** or **Weapon Designer**.

## Maps

- Choose Bossroom, Dungeon, or Full World; create a blank map from 4×4 to 512×512 tiles.
- Select supplied tiles by category or filename. Paint, erase, toggle collision, place the player start, and add enemy or boss spawns.
- Choose Pan map to move around using touch or pointer drag. Zoom and scroll are also available.
- Undo/redo retain the last 20 editing operations. New blank map is undoable.
- Save map / Load saved use this device's browser storage. Export JSON makes a portable backup; Import JSON restores or opens a design.
- Exports use `MapFile` version 1 and a fixed tile size of 32. Tiles preserve sprite paths and collision. Entity coordinates are world pixels; the player start uses tile coordinates.
- Exported designs are not automatically published into the game. Include reviewed files under `public/Maps/` in a future update; `map-format.ts` validates them and `mapToWorld` converts them for gameplay.

## Weapons and equipment

Weapon Designer edits a transparent 16×16 pixel image plus name, element, damage, speed, and range. Save/load use this device; JSON exports/imports use `WeaponDesign` version 1. These designs are content files for future updates.

Current gameplay equipment has fixed stats derived from slot, level, and quality; weapons add physical damage and armor reduces incoming ranged physical damage. Gear no longer grants abilities or random enchantments. Legacy rolls are retained in `previousEquipment` for migration recovery. Existing inventory, quality, element and set identities stay available.

## Character skill points

Each character level-up grants **3 skill points**. A new character starts with its class's three abilities. Unlocking an attack or spell costs 1 point; each rank upgrade costs 1 point, to rank 5. Each upgrade adds 15% damage, healing or shield strength. Hardcore healing and guarding also use ability upgrades.

Open **Menu → Attacks & Spells** to spend points. Unspent points and ranks are saved. Old characters receive 3 points for every historical level-up once; previously known abilities stay unlocked. A new body resets character ability progression, while existing account perks and practice skills retain their existing behavior.

## Timed dungeons

Every **600 seconds of active gameplay** opens a dungeon rift in the overworld. Paused/dead/title states and hidden tabs do not advance it. The saved timer is checkpointed every 30 seconds and at gameplay saves. Offline time does not spawn dungeons.

Find new rifts on **Menu → Map**. Track a rift, then interact near its entrance, or use Track / enter when already nearby. A rift has a reproducible seed, connected rooms and corridors, sprite terrain, and a world-boss variant in its last room.

Dungeon bosses use a 3× health multiplier instead of the standard 6.5×, zero rarity bonus, the dungeon's opening level, and 60% incoming attack strength. Defeated enemies remain defeated after leaving or reloading. Killing the boss clears the dungeon and disables re-entry; leave through the entrance exit. Dungeon variants do not increment standard world-boss kill counters.

Co-op hosts own dungeon timing and send portal state with world/travel messages; guests use the host's generated layout. Designer saves are local, independent of co-op and gameplay saves.
