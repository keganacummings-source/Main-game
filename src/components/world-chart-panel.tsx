/**
 * The chart menu (M).
 *
 * A world is 2500 x 2500 tiles and the hunter will never see most of it. So
 * this does not draw the world — it draws what she has FOUND, and the rest
 * stays dark. Walking somewhere new is the only way anything appears, which is
 * what makes a finished chart worth keeping.
 *
 * From here a world can be taken out of the game two ways: as a picture of the
 * chart as it stands, or as the world's own data — seed, continents, biomes and
 * every place discovered — which is a few kilobytes rather than the 25 MB the
 * chart itself occupies, because the seed rebuilds the rest exactly.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { activeChart, activeExplored, onChart } from "@/game/chart-store";
import { chartPixels, discoveredPlaces, exportName, exportWorld } from "@/game/chart-export";
import { FOG_CELL, exploredShare } from "@/game/explored";
import { BIOME_BY_ID, biomeCensus } from "@/game/world-chart";
import { Empty, Section, usePref } from "./ui-kit";
import { targetProps } from "./ui-overlay";

const FAV_KEY = "turbz.chartFavourites";

function readFavourites(seed: number): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(FAV_KEY) ?? "{}");
    const mine = all?.[String(seed)];
    return Array.isArray(mine) ? mine.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeFavourites(seed: number, ids: string[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(FAV_KEY) ?? "{}");
    localStorage.setItem(FAV_KEY, JSON.stringify({ ...(all && typeof all === "object" ? all : {}), [String(seed)]: ids }));
  } catch {
    /* per-viewer convenience only */
  }
}

/** Hand the browser a file without leaving a blob URL behind. */
function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const WorldChartPanel = memo(function WorldChartPanel() {
  const [, bump] = useState(0);
  useEffect(() => onChart(() => bump((n) => n + 1)), []);

  const chart = activeChart();
  const fog = activeExplored();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = usePref("turbz-chart-zoom", ["1", "2", "3"] as const, "1");
  const [picked, setPicked] = useState<string | null>(null);
  const [favs, setFavs] = useState<string[]>(() => (chart ? readFavourites(chart.seed) : []));

  useEffect(() => { if (chart) setFavs(readFavourites(chart.seed)); }, [chart?.seed]);

  const found = useMemo(() => (chart ? discoveredPlaces(chart, fog) : []), [chart, fog, chart?.seed]);
  const share = fog ? exploredShare(fog) : 0;

  // Draw the chart whenever the fog moves or the view changes.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !chart) return;
    const pix = chartPixels(chart, fog);
    el.width = pix.w;
    el.height = pix.h;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    // Built through createImageData rather than `new ImageData(...)`: the latter
    // does not typecheck across TypeScript versions that made typed arrays
    // generic over their buffer, and this needs no cast.
    const img = ctx.createImageData(pix.w, pix.h);
    img.data.set(pix.rgba);
    ctx.putImageData(img, 0, 0);
  }, [chart, fog, share]);

  if (!chart) {
    return <Empty>No world charted yet. Step outside and the map fills in as you go.</Empty>;
  }

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    writeFavourites(chart.seed, next);
  };

  const savePng = () => {
    const el = canvas.current;
    if (!el) return;
    el.toBlob((blob) => { if (blob) download(exportName(chart, "png"), blob); });
  };

  const saveJson = () => {
    const data = exportWorld(chart, fog, favs);
    download(exportName(chart, "json"), new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  };

  const census = biomeCensus(chart);
  const scale = Number(zoom);
  const sorted = [...found].sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)) || a.name.localeCompare(b.name));

  return (
    <div className="ui-stack" data-testid="chart-panel">
      <div className="ui-row">
        <span>World <span className="text-kyo">{chart.seed}</span> · {chart.w}×{chart.h}</span>
        <span className="text-dim" data-testid="chart-explored">{(share * 100).toFixed(share < 1 ? 2 : 1)}% charted</span>
      </div>

      <div className="chart-wrap">
        <canvas
          ref={canvas}
          className="chart-canvas"
          data-testid="chart-canvas"
          style={{ width: `${Math.ceil(chart.w / FOG_CELL) * scale}px`, imageRendering: "pixelated" }}
          aria-label="The world you have charted"
        />
      </div>

      <div className="menu-toolbar">
        <span className="text-dim">Zoom</span>
        {(["1", "2", "3"] as const).map((z) => (
          <button key={z} type="button" className={`px-btn ui-btn-sm ${zoom === z ? "px-btn-kyo" : ""}`} onClick={() => setZoom(z)}>×{z}</button>
        ))}
        <button type="button" className="px-btn ui-btn-sm" data-testid="chart-png" onClick={savePng}>Export chart (PNG)</button>
        <button type="button" className="px-btn ui-btn-sm" data-testid="chart-json" onClick={saveJson}>Export world (JSON)</button>
      </div>

      <Section title={`PLACES FOUND · ${found.length} of ${chart.places.length}`}>
        {found.length === 0 ? (
          <Empty>Nowhere named yet. Travel and they will appear here.</Empty>
        ) : (
          <ul className="chart-places" data-testid="chart-places">
            {sorted.map((p) => {
              const fav = favs.includes(p.id);
              const biome = BIOME_BY_ID[chart.biome[p.ty * chart.w + p.tx] ?? 0];
              return (
                <li
                  key={p.id}
                  className={`chart-place ui-has-menu ${picked === p.id ? "chart-place-on" : ""}`}
                  data-testid={`chart-place-${p.id}`}
                  {...targetProps({
                    title: p.name,
                    lines: [`${biome?.label ?? p.biome} · ${p.tx}, ${p.ty}`],
                    actions: [
                      { id: "fav", label: fav ? "Remove from favourites" : "Mark as favourite", onPick: () => toggleFav(p.id) },
                      { id: "show", label: "Show on the chart", onPick: () => setPicked(p.id) },
                    ],
                  }, {
                    title: p.name,
                    body: (
                      <>
                        <span>{biome?.label ?? p.biome}</span>
                        <span className="text-dim">{biome?.about}</span>
                        <span className="text-dim">Chart {p.tx}, {p.ty}</span>
                      </>
                    ),
                    foot: "Right-click to favourite",
                  })}
                >
                  <button type="button" className={`chart-star ${fav ? "chart-star-on" : ""}`} aria-pressed={fav} aria-label={fav ? `Unfavourite ${p.name}` : `Favourite ${p.name}`} onClick={() => toggleFav(p.id)}>★</button>
                  <span className="chart-place-name">{p.name}</span>
                  <span className="text-dim chart-place-where">{biome?.label ?? p.biome} · {p.tx}, {p.ty}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="LANDS">
        <ul className="chart-lands">
          {chart.continents.slice(0, 8).map((c) => (
            <li key={c.id} className="ui-row">
              <span>{c.name}{c.island ? <span className="text-dim"> · isle</span> : null}</span>
              <span className="text-dim">{c.tiles.toLocaleString()} tiles</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="GROUND">
        <ul className="chart-census">
          {census.filter((b) => b.share > 0.001).map((b) => (
            <li key={b.key} className="ui-row">
              <span><i className="chart-swatch" style={{ background: b.colour }} /> {b.label}</span>
              <span className="text-dim">{(b.share * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
});
