# Build-menu cleanup

Both build menus (the floating `BuildBar` and the campfire panel's **Build** tab) now share one piece-definition registry and one piece-button component. Adding a new build piece is a one-object edit.

## What moved where

| Change | File |
|---|---|
| One flat `BUILD_PIECE_DEFS` list; every other export derived from it | `src/game/building.ts` |
| New shared `<BuildPieceButton>` + compact material cost chips | `src/components/build-piece-button.tsx` |
| `BuildBar` rewritten to use the shared button; Power split into sub-columns | `src/components/build-bar.tsx` |
| Campfire build tab rewritten against the shared button | `src/components/game-panels.tsx` |
| New styles: `.build-bar-column`, `.build-card*`, upgraded `.cost-chip` | `src/styles.css` |

## Adding a new build piece

Edit one file: `src/game/building.ts`.

```ts
// 1. Add the id to the BuildPiece union.
export type BuildPiece = ... | "myNewMachine";

// 2. Add one object to BUILD_PIECE_DEFS.
{
  id: "myNewMachine",
  group: "power.machines",          // or "walls", "floors", "doors", "furniture",
                                    //    "power.gen", "power.store", "power.wiring"
  name: "My New Machine",
  cost: { rock_ore: 4, wire: 2 },
  requires: "turbz+newtex",         // optional — leave off for base-game pieces
  about: "What it does, in one sentence.",
  preview: tex("my_new_machine.png"), // optional — only shown with New Textures on
  // kind: "wood",                   // only for structural tiles
  // singleton: true,                // only one per world (ghostbox, chest)
}
```

Both menus pick it up automatically. The hotkey (if any), the mode gate, the groups, the "placed" state, the cost chips, and the preview art are all derived from this one object.

## What changed in the UI

- **Power group split** into Generators / Storage / Wiring / Machines. These render side-by-side as one column cluster in the floating bar, and as separate sections in the campfire panel. Keeps the toolbar legible as Power expands past a dozen pieces.
- **Compact cost chips.** `HELL×4 LOG×4` short-code chips coloured by material, with the full material name on hover. Lets a piece with three materials still fit a toolbar button.
- **Hotkey badge** now only shows for digits 1–9 (the ones you can actually press). Previously the campfire panel printed "15" on pieces that couldn't be hotkeyed.
- **Preview art** was defined inside `build-bar.tsx`; it's now on each piece def and appears in both menus when New Textures is on.
- **Singleton check** for Ghost Box / Storage Chest was hardcoded by id in two components; it's now a `singleton: true` flag on the def plus one helper (`isSingleton`).

## Backwards compatibility

Every pre-existing export from `building.ts` is kept (as a derived value where appropriate):

`BUILD_PIECES`, `BUILD_PIECE_IDS`, `BUILD_GROUPS`, `BUILD_HOTKEY_ORDER`, `TURBZ_ONLY_PIECES`, `NEWTEX_ONLY_PIECES`, `BLOCK_PIECE_IDS`, `buildHotkeyPiece`, `pieceNameForKind` — all still there with the same shapes. `engine.ts` compiles unchanged.

New helpers you can use for future work: `isPieceAvailable(id, mode)`, `isSingleton(id)`, `piecePreview(id)`, `BUILD_PIECE_DEFS`, `BuildPieceDef`, `BuildGroup`, `BuildRequires`.
