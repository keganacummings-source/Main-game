# TURBZ — V7

A browser action-RPG. Everything the V6 updates added is now in the base game — no `legacy_*` perks, no deprecated map readers, no `_old` tile fallbacks that nothing refers to.

- **Play:** `npm install && npm run dev` (then open `http://localhost:8080`).
- **Build:** `npm run build` → static bundle in `dist/`.
- **Deploy:** `npm run deploy` (Wrangler, Cloudflare Workers).
- **Edit the game:** see **[docs/EDITING.md](docs/EDITING.md)**.

## What V7 is

V7 is a cleanup release. It should play identically to V6 (except where noted) but is smaller and easier to hack on.

### Promoted to base
- The old class "signature" passives, previously exposed as `Legacy · ClassName` perks, are now searchable in the full perk pool as `<ClassName>'s Signature`. The Crying Girl's builder still sees them. Old saves get a one-way remap: `legacy_<classId>` → `base_<classId>`.
- Every V6 QOL + bugfix + gameplay-update patch note (previously in `docs/designer-and-dungeons.md`, `docs/survival-and-worlds.md`, `docs/qol-and-bugfixes.md`) is base behaviour, not an "update". Those documents remain for the historical record.

### Removed
- `legacyMoveFx` — unused engine FX fallback (~45 lines).
- `legacyMaps()` migration — one-time move of pre-V5 designer maps from `localStorage` into IndexedDB. If you had maps saved before IndexedDB was added, re-import them from a `.json` export.
- `LegacyNpcQuest` + the inline `MapNpc.quest` field — ancient map-file quest shape. Quests belong on `MapFile.quests` with `giver` set.
- `migrateEquipment` + `previousEquipment` field — renamed to `sanitizeGear` and no longer tries to restore old enchantment rolls. Modern gear carries its own `enchants`.
- 47 orphan tiles under `public/MapAssets/` + 2 orphan sprites + 1 orphan music track (`YUYUYU.ogg`). `public/` dropped from 29 MB to 21 MB.

### Save compatibility
- Perk IDs are remapped automatically.
- Character gear uses the same shape, minus the dead `previousEquipment` field.
- Designer maps stored in IndexedDB load unchanged. Maps stored only in old-shape `localStorage` need re-importing.

## Layout

```
src/
  components/   React UI (HUD, menus, Map Builder)
  game/         Game logic (engine, content, maps, FX, sound)
  lib/          Shared helpers
public/         Static assets served as-is
scripts/        Node tests + wiki builder
worker/         Cloudflare Worker (accounts, Discord relay)
docs/           This file, EDITING.md, and the V6 update notes
```

See **[docs/EDITING.md](docs/EDITING.md)** for the full "I want to change X" lookup.
