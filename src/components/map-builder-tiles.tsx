import { useEffect, useState } from "react";
import { tileImage, setTileOverrides, type AtlasTile, type TileOverride } from "@/game/tile-atlas";
import { loadPack, groupOf, TILE_CATEGORIES, playsAnimation, frameTwo, animFpsOf, type Asset } from "@/game/camp-assets";

export type Brush =
  | { mode: "sprite"; tile: AtlasTile; liquid: boolean };

// ─── Curated tile catalogue ────────────────────────────────────────────────

type CuratedTile = {
  label: string;
  path: string;
  solid?: boolean;
  liquid?: boolean;
  alt?: { label: string; path: string };
};

type CuratedSection = {
  id: string;
  label: string;
  icon: string;
  tiles: CuratedTile[];
};

const CURATED: CuratedSection[] = [
  {
    id: "floor",
    label: "Floor Tiles",
    icon: "▦",
    tiles: [
      { label: "Stone Floor",   path: "/MapAssets/01_Floor_and_Ground_Tiles/cobalt_stone_1.png" },
      { label: "Dirt",          path: "/MapAssets/01_Floor_and_Ground_Tiles/dirt_0_new.png" },
      {
        label: "Grass",
        path: "/MapAssets/01_Floor_and_Ground_Tiles/grass_0_new.png",
        alt: { label: "Flowers", path: "/MapAssets/01_Floor_and_Ground_Tiles/grass_flowers_blue_1_new.png" },
      },
      { label: "Sand",          path: "/MapAssets/01_Floor_and_Ground_Tiles/sand_1.png" },
      { label: "Ice",           path: "/MapAssets/01_Floor_and_Ground_Tiles/ice_0_new.png" },
      { label: "Lava",          path: "/MapAssets/01_Floor_and_Ground_Tiles/lava_0.png",            liquid: true },
      { label: "Shallow Water", path: "/MapAssets/03_Water_and_Liquid_Tiles/shallow_water.png",     liquid: true },
      { label: "Deep Water",    path: "/MapAssets/03_Water_and_Liquid_Tiles/deep_water.png",         liquid: true },
      { label: "Swamp / Bog",   path: "/MapAssets/01_Floor_and_Ground_Tiles/bog_green_0_new.png",   liquid: true },
      { label: "Wood Floor",    path: "/MapAssets/01_Floor_and_Ground_Tiles/sandstone_floor_0.png" },
    ],
  },
  {
    id: "wall",
    label: "Wall Tiles",
    icon: "▪",
    tiles: [
      { label: "Stone Wall",  path: "/MapAssets/02_Walls_and_Cliffs/stone_brick_1.png",        solid: true },
      { label: "Brick Wall",  path: "/MapAssets/02_Walls_and_Cliffs/brick_brown_0.png",         solid: true },
      { label: "Dirt Wall",   path: "/MapAssets/02_Walls_and_Cliffs/sandstone_wall_0.png",      solid: true },
      { label: "Wood Wall",   path: "/MapAssets/02_Walls_and_Cliffs/marble_wall_1.png",          solid: true },
      { label: "Ice Wall",    path: "/MapAssets/02_Walls_and_Cliffs/crystal_wall_lightblue.png", solid: true },
      { label: "Hell Wall",   path: "/MapAssets/02_Walls_and_Cliffs/volcanic_wall_0.png",        solid: true },
    ],
  },
  {
    id: "door",
    label: "Doors",
    icon: "🚪",
    tiles: [
      { label: "Door (Closed)", path: "/MapAssets/05_Doors_and_Entrances/closed_door.png", solid: true },
      { label: "Door (Open)",   path: "/MapAssets/05_Doors_and_Entrances/open_door.png" },
    ],
  },
  {
    id: "stairs",
    label: "Stairs & Portals",
    icon: "⬆",
    tiles: [
      { label: "Stairs Up",   path: "/MapAssets/06_Gates_and_Portals/rock_stairs_up.png" },
      { label: "Stairs Down", path: "/MapAssets/06_Gates_and_Portals/rock_stairs_down.png" },
      { label: "Portal",      path: "/MapAssets/06_Gates_and_Portals/portal.png" },
    ],
  },
  {
    id: "trees",
    label: "Trees & Plants",
    icon: "🌲",
    tiles: [
      {
        label: "Tree",
        path: "/MapAssets/04_Trees_and_Vegetation/tree_1_lightred.png",
        solid: true,
        alt: { label: "Tree 2", path: "/MapAssets/04_Trees_and_Vegetation/tree_2_lightred.png" },
      },
      { label: "Mangrove / Shrub", path: "/MapAssets/04_Trees_and_Vegetation/mangrove_1.png", solid: true },
    ],
  },
  {
    id: "misc",
    label: "Map Objects",
    icon: "⚱",
    tiles: [
      { label: "Altar",    path: "/MapAssets/07_Altars_and_Shrines/altar_new.png",             solid: true },
      { label: "Chest",    path: "/MapAssets/12_Dungeon_Tiles_Other/chest.png",                 solid: true },
      { label: "Fountain", path: "/MapAssets/12_Dungeon_Tiles_Other/sparkling_fountain.png",    solid: true },
      { label: "Trap",     path: "/MapAssets/09_Traps_and_Hazards/trap_mechanical.png" },
      { label: "Shop",     path: "/MapAssets/10_Shops_and_Buildings/enter_shop.png",            solid: true },
    ],
  },
];

// Synthetic path prefix for camp-asset tiles so tileImage() resolves them via overrides
const CAMP_PATH_PREFIX = "camp-asset://";

function campPath(a: Asset): string {
  return `${CAMP_PATH_PREFIX}${a.id}`;
}

function makeFakeTile(label: string, path: string, solid = false): AtlasTile {
  return { id: path, file: label, path, category: "curated", solid, slow: 0 };
}

function makeCampTile(a: Asset): AtlasTile {
  const path = campPath(a);
  return { id: path, file: a.name, path, category: "camp", solid: a.solid ?? false, slow: 0 };
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TileBtn({
  path,
  label,
  solid,
  liquid,
  selected,
  small,
  onClick,
}: {
  path: string;
  label: string;
  solid?: boolean;
  liquid?: boolean;
  selected: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  const sz = small ? "h-7 w-7" : "h-10 w-10";
  const ring = selected
    ? "border-kyo shadow-[0_0_0_1px_var(--kyo)]"
    : solid
    ? "border-blood/60"
    : liquid
    ? "border-blue-400/50"
    : "border-bone/25";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={`relative ${sz} shrink-0 border-2 bg-ink/60 p-0 transition-transform hover:scale-110 ${ring}`}
      onClick={onClick}
    >
      <img
        src={tileImage(path).src}
        alt=""
        loading="lazy"
        className="h-full w-full object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </button>
  );
}

function TileCell({
  ct,
  brush,
  onBrush,
}: {
  ct: CuratedTile;
  brush: Brush;
  onBrush: (b: Brush) => void;
}) {
  const tile = makeFakeTile(ct.label, ct.path, ct.solid);
  const isSelected = brush.tile.id === tile.id;
  const altTile = ct.alt ? makeFakeTile(ct.alt.label, ct.alt.path, ct.solid) : null;
  const altSelected = altTile ? brush.tile.id === altTile.id : false;
  return (
    <div className="flex items-end gap-0.5">
      <div className="flex flex-col items-center gap-0.5">
        <TileBtn
          path={ct.path}
          label={ct.label}
          solid={ct.solid}
          liquid={ct.liquid}
          selected={isSelected}
          onClick={() => onBrush({ mode: "sprite", tile, liquid: ct.liquid ?? false })}
        />
        <span className="text-dim text-center leading-none" style={{ fontSize: 9, maxWidth: 42 }}>
          {ct.label}
        </span>
      </div>
      {altTile && ct.alt && (
        <div className="flex flex-col items-center gap-0.5">
          <TileBtn
            path={ct.alt.path}
            label={ct.alt.label}
            solid={ct.solid}
            liquid={ct.liquid}
            selected={altSelected}
            small
            onClick={() => onBrush({ mode: "sprite", tile: altTile, liquid: ct.liquid ?? false })}
          />
          <span className="text-dim leading-none" style={{ fontSize: 8 }}>alt</span>
        </div>
      )}
    </div>
  );
}

// ─── Camp tile section ─────────────────────────────────────────────────────

function CampSection({ brush, onBrush }: { brush: Brush; onBrush: (b: Brush) => void }) {
  const [campAssets, setCampAssets] = useState<Asset[]>([]);
  const [campFilter, setCampFilter] = useState<string>("all");

  // Load camp assets and register their pixels as tileOverrides so the map renderer sees them
  useEffect(() => {
    const pack = loadPack();
    const tiles = pack.filter((a) => groupOf(a) === "tile");
    setCampAssets(tiles);
    // Register data URLs so tileImage(campPath(a)) resolves. An animated tile registers both
    // frames, so it loops here in the builder exactly as it will in game.
    const overrides: Record<string, TileOverride> = {};
    for (const a of tiles) overrides[campPath(a)] = playsAnimation(a) ? { a: a.pixels, b: frameTwo(a), fps: animFpsOf(a) } : a.pixels;
    setTileOverrides(overrides);
  }, []);

  if (campAssets.length === 0) {
    return (
      <div className="grid gap-1">
        <p className="font-display text-xs text-kyo tracking-wider">🎨 CAMP TILES</p>
        <p className="text-dim" style={{ fontSize: 10 }}>
          No custom tiles yet. Use the Camp &amp; Tile Asset Builder to draw your own.
        </p>
      </div>
    );
  }

  // Collect unique TILE_CATEGORIES present in the pack
  const presentCats = Array.from(new Set(campAssets.map((a) => a.category)));
  const catLabel = (id: string) =>
    TILE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  const visible =
    campFilter === "all" ? campAssets : campAssets.filter((a) => a.category === campFilter);

  return (
    <div className="grid gap-2">
      <p className="font-display text-xs text-kyo tracking-wider">🎨 CAMP TILES ({campAssets.length})</p>
      {/* Category mini-filter */}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={`px-1.5 py-0.5 border text-xs transition-colors ${campFilter === "all" ? "border-kyo text-kyo" : "border-bone/40 text-dim hover:border-bone"}`}
          onClick={() => setCampFilter("all")}
        >
          All
        </button>
        {presentCats.map((c) => (
          <button
            key={c}
            type="button"
            className={`px-1.5 py-0.5 border text-xs transition-colors ${campFilter === c ? "border-kyo text-kyo" : "border-bone/40 text-dim hover:border-bone"}`}
            onClick={() => setCampFilter(c)}
          >
            {catLabel(c)}
          </button>
        ))}
      </div>
      {/* Tile grid */}
      <div className="flex flex-wrap gap-1">
        {visible.map((a) => {
          const ct = makeCampTile(a);
          const isSelected = brush.tile.id === ct.id;
          const isLiquid = a.category === "water" || a.category === "lava";
          return (
            <div key={a.id} className="flex flex-col items-center gap-0.5">
              <TileBtn
                path={campPath(a)}
                label={a.name}
                solid={a.solid}
                liquid={isLiquid}
                selected={isSelected}
                onClick={() => onBrush({ mode: "sprite", tile: ct, liquid: isLiquid })}
              />
              <span className="text-dim text-center leading-none" style={{ fontSize: 9, maxWidth: 42 }}>
                {a.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────

type SectionId = (typeof CURATED)[number]["id"] | "camp";

const ALL_SECTIONS: { id: SectionId; icon: string; label: string }[] = [
  ...CURATED.map((s) => ({ id: s.id as SectionId, icon: s.icon, label: s.label })),
  { id: "camp", icon: "🎨", label: "Camp Tiles" },
];

export function TilePalette({
  brush,
  onBrush,
}: {
  brush: Brush;
  onBrush: (b: Brush) => void;
}) {
  const [activeSection, setActiveSection] = useState<SectionId | "all">("all");

  return (
    <div className="grid gap-3" data-testid="tile-palette">
      {/* Section tabs */}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={`px-2 py-0.5 border text-xs transition-colors ${activeSection === "all" ? "border-kyo text-kyo" : "border-bone/40 text-dim hover:border-bone"}`}
          onClick={() => setActiveSection("all")}
        >
          All
        </button>
        {ALL_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`px-2 py-0.5 border text-xs transition-colors ${activeSection === s.id ? "border-kyo text-kyo" : "border-bone/40 text-dim hover:border-bone"}`}
            onClick={() => setActiveSection(activeSection === s.id ? "all" : s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Curated sections */}
      {CURATED.filter((s) => activeSection === "all" || activeSection === s.id).map((section) => (
        <div key={section.id} className="grid gap-1">
          <p className="font-display text-xs text-kyo tracking-wider">
            {section.icon} {section.label.toUpperCase()}
          </p>
          <div className="flex flex-wrap gap-1">
            {section.tiles.map((ct) => (
              <TileCell key={ct.path} ct={ct} brush={brush} onBrush={onBrush} />
            ))}
          </div>
        </div>
      ))}

      {/* Camp tiles section */}
      {(activeSection === "all" || activeSection === "camp") && (
        <CampSection brush={brush} onBrush={onBrush} />
      )}

      {/* Legend */}
      <p className="text-dim" style={{ fontSize: 10 }}>
        <span className="text-blood/70">■</span> solid ·{" "}
        <span className="text-blue-400/70">■</span> liquid
      </p>
    </div>
  );
}
