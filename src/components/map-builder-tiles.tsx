import { useEffect, useMemo, useState } from "react";
import { FLOOR_COLOR } from "@/game/map-format";
import { loadTileCatalog, tileImage, type AtlasTile, type TileCatalog } from "@/game/tile-atlas";

export type Brush =
  | { mode: "floor"; floor: number }
  | { mode: "sprite"; tile: AtlasTile; liquid: boolean };

const FLOOR_NAMES = ["Grass", "Wall", "Water", "Stone", "Dirt", "Snow", "Bog", "Void", "Bone", "Ash", "Sand", "Lava"];
const PAGE = 120;

/** Colour swatches (plain floors) and the supplied tile pack, with search. */
export function TilePalette({ brush, onBrush }: { brush: Brush; onBrush: (b: Brush) => void }) {
  const [catalog, setCatalog] = useState<TileCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    let live = true;
    loadTileCatalog().then((c) => { if (!live) return; if (c) { setCatalog(c); setCat(c.categories[0]?.id ?? ""); } else setFailed(true); });
    return () => { live = false; };
  }, []);
  const category = catalog?.categories.find((c) => c.id === cat);
  const list = useMemo(() => {
    if (!catalog) return [] as { tile: AtlasTile; liquid: boolean }[];
    const needle = q.trim().toLowerCase();
    const src = needle ? catalog.categories : category ? [category] : [];
    const out: { tile: AtlasTile; liquid: boolean }[] = [];
    for (const c of src) for (const t of c.tiles) if (!needle || t.file.toLowerCase().includes(needle)) out.push({ tile: t, liquid: c.liquid });
    return out;
  }, [catalog, category, q]);
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  return (
    <div className="grid gap-2" data-testid="tile-palette">
      <p className="font-display text-xs text-kyo">PLAIN GROUND</p>
      <div className="flex flex-wrap gap-1">
        {FLOOR_NAMES.map((name, i) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            className={`h-8 w-8 border-2 ${brush.mode === "floor" && brush.floor === i ? "border-kyo" : "border-bone"}`}
            style={{ background: FLOOR_COLOR[i] }}
            onClick={() => onBrush({ mode: "floor", floor: i })}
          />
        ))}
      </div>
      <p className="font-display text-xs text-kyo">TILE PACK</p>
      {failed && <p className="text-blood">The tile pack could not load. Plain ground still works.</p>}
      {!catalog && !failed && <p className="text-dim">Loading tiles…</p>}
      {catalog && (
        <>
          <div className="flex flex-wrap gap-1">
            <select className="border-2 border-bone bg-ink px-1" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); setQ(""); }} aria-label="Tile category">
              {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.count})</option>)}
            </select>
            <input className="min-w-0 flex-1 border-2 border-bone bg-ink px-1" placeholder="Search all tiles…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1" style={{ maxHeight: 280, overflow: "auto" }}>
            {shown.map(({ tile, liquid }) => (
              <button
                key={tile.id}
                type="button"
                title={`${tile.file}${tile.solid ? " (solid)" : ""}${liquid ? " (liquid)" : ""}`}
                className={`relative h-9 border-2 bg-ink p-0 ${brush.mode === "sprite" && brush.tile.id === tile.id ? "border-kyo" : tile.solid ? "border-blood/60" : "border-bone/40"}`}
                onClick={() => onBrush({ mode: "sprite", tile, liquid })}
              >
                <img src={tileImage(tile.path).src} alt="" loading="lazy" className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-dim">
            <button type="button" className="px-btn ui-btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
            <span>{page + 1} / {pages} · {list.length} tiles</span>
            <button type="button" className="px-btn ui-btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>›</button>
          </div>
          <p className="text-dim">Red border = solid (blocks walking). Liquid tiles slow you and allow fishing.</p>
        </>
      )}
    </div>
  );
}
