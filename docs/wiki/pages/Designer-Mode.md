# Designer Mode

From the hub, **Designer Mode** opens two tools for making your own content.

## Map Builder

Paint your own maps, up to 512×512 tiles:

- tiles, walls and decorations;
- spawn zones (which monsters, what levels, how fast they respawn);
- resource nodes, NPCs with dialogue, a story and quests;
- doors, portals and a spawn point;
- named **areas** (continents, towns, groves, dungeons).

The builder checks your map for problems before you save. Saved maps can be entered from the game (see [World and Regions](World-and-Regions#designer-maps)). The **Green Cave** is a built-in designer map.

### Tools

| Tool | What it does |
|---|---|
| Paint, Rectangle, Fill | Lay the chosen tile with a brush, over a dragged rectangle, or across a connected patch. |
| Line | Drag a straight line with the brush. Good for roads, rivers and walls. |
| Overlay, Peel | Add a decoration layer on top (up to 4), or remove the top one. |
| Scatter | Drag a rectangle to sprinkle the brush tile as decoration. The **Density** slider sets how much. Solid tiles and water are skipped. |
| Mix variants | When ticked, painting picks a random sibling of the chosen tile (grass 0, grass 1…), so big areas do not look stamped. |
| Copy, Stamp | Drag a rectangle to copy it, then click to paste it. The click is the top-left corner. One undo removes a stamp. |
| Block, Open | Make tiles solid or walkable without changing how they look. |
| Portal | Link a tile to another map, or to another spot on the same map (a **ferry**). |
| Area | Drag a rectangle to name a part of the map. |

Other helpers:

- **Minimap.** Click or drag it to jump anywhere.
- **Find.** Type a name to list matching areas, NPCs, quests and spawn zones, then click one to go there.
- **Zoom.** Zoom far out for a whole-map overview.
- **Undo and redo:** Ctrl+Z and Ctrl+Y.

### Areas

Areas are named rectangles. Each has a kind (region, city, resource, landmark, dungeon or water), an optional arrival line and a level range.

- In game, walking into an area shows its name, level range and line.
- The first visit gives a little Adventuring XP.
- Where areas overlap, the smallest one wins, so a town inside a continent shows the town.
- Quests that send you somewhere say "Travel to *area*" instead of coordinates.
- Continents and towns are drawn on the in-game map.

### Worlds

- **Open a copy to edit** (Files → Built-in worlds) loads [Veilreach](World-and-Regions#veilreach) into the builder. Save it under a new File ID to play your version as a designer map. The overworld itself is always the Veilreach built into the game.
- **Generate a world** (Files) builds a full map from your settings: size, number of continents (2–8), cities per continent (1–5), islands, seed, and optionally a main story that visits every continent. It includes continents split by sea, mountains, lakes, walled towns with shops, ports with ferries, roads, resource groves, enemy camps, NPCs and side quests. The same seed always gives the same world.

Maps are stored in your browser's IndexedDB, which has room for several large worlds. Use **Export** to keep a file copy or share one.

## Enemy Designer

Create brand-new enemies, or **replace** built-in ones everywhere they spawn:

| Setting | What it does |
| --- | --- |
| **Name, description, element** | Who it is |
| **Sprite and scale** | Its look (1×–3× size) |
| **Temperament** | Hunt (comes for you), Drift (ignores you until hit) or Flee (never fights) |
| **Boss** | Treat it as a boss |
| **Stats** | Health, damage and speed multipliers; crit, dodge and resist chances |
| **Fixed traits** | Traits it always has, plus 0–4 random extras per spawn |
| **Moves** | Up to 4 verses it uses |
| **Level bonus** | Extra levels above the normal scaling |
| **Loot multiplier** | More (or less) kyo and drop chance |
| **Biomes** | Where a new enemy spawns |

Designed enemies still follow the normal [scaling rules](Enemies): designer stats multiply on top. Caps still apply: dodge 35%, crit 45%, resists 55%.
