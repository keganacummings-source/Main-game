# Tile Builder (Designer Mode → Camp & Tile Asset Builder)

Paint camp pieces, map tiles and Power block art. Everything saves on this device and is live in your games straight away.
Export a pack to ship pieces in a game update.

## Making a piece

1. Pick **New camp piece**, **New map tile** or **New power texture**, or click one of the five **Power blocks** at the top of the list
   (it opens with the art the game ships, ready to touch up).
2. Paint. The **Preview in game** panel shows the piece at game size on a real floor, and a repeating 3×3 so you can check a floor tile for seams.
3. **Save** keeps you in the editor; **Save & close** returns to the list. Leaving with unsaved changes asks first.

## Tools

| Key | Tool |
| --- | --- |
| P / B | Pencil (right-click erases) |
| E | Eraser |
| G | Fill |
| L / R / O | Line / Box / Oval (turn on **Filled shapes** for solid ones) |
| I | Colour picker (Alt+click works with any tool) |
| H / V | Mirror left-right / up-down while drawing |
| Q | Pixel grid |
| [ ] | Brush size |
| Arrow keys | Shift the art one pixel (wraps round, good for seamless tiles) |
| Ctrl+Z / Ctrl+Y | Undo / redo (100 steps) |

Also: flip, rotate 90°, zoom, hex colour box, recent colours, colours already in the art, and a palette taken from the game's own art.
Changing the canvas size (16 / 32 / 64) re-samples your art instead of stretching it. The game draws pieces at 32×32.

## Power blocks

HellStone Generator, Battery, Wire, XP Producer and Duplicator. The game ships default art for each
(`public/MapAssets/NewTex/<id>.png`). If you save a **Live** texture for a block, the newest one wins. Turn Live off on a piece to keep it as a draft.

## Map tiles

A tile can **replace** a pack tile everywhere in game (set the *Replaces* path, turn on *Live*). **Load tile to edit** pulls the current art
of the replaced tile into the canvas so you can touch it up. Solid, decoration, hold, spawn and walk-on settings are stored in the pack for
the systems that read them.

## Packs

- **Export pack** downloads every piece as JSON; **Import pack** merges a pack in (same id replaces, everything else is added).
- **Import built-in art** adds the shipped power art to your pack so you can edit and re-export it.
- Each piece also exports as a PNG, and PNGs import into the canvas.
- Browsers keep about 5 MB per site; the **Storage** figure shows how full the pack is.
