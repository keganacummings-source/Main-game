/**
 * The world chart the hunter is currently in, and how much of it she has seen.
 *
 * The chart is 25 MB of typed arrays and the fog is a bitset. Neither belongs in
 * the snapshot the UI re-reads every frame, so they live here and the chart menu
 * reads them directly when it opens.
 *
 * The engine owns both: it calls `setActiveChart` when a world is entered and
 * `noteVisited` as the hunter moves. Everything else — the chart menu, the
 * export — only reads.
 */
import type { WorldChart } from "./world-chart";
import { freshExplored, packExplored, reveal, unpackExplored, type Explored, type ExploredSave } from "./explored";

/** How far around the hunter the fog lifts, in chart tiles. */
export const SIGHT = 26;

type Active = { chart: WorldChart; explored: Explored } | null;

let active: Active = null;
let hunter: { tx: number; ty: number } | null = null;
const listeners = new Set<() => void>();
const emit = () => { for (const fn of listeners) fn(); };

export function onChart(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const activeChart = (): WorldChart | null => active?.chart ?? null;
export const activeExplored = (): Explored | null => active?.explored ?? null;
/** Where the hunter is standing on the chart, in tiles. Null before she has moved. */
export const hunterAt = (): { tx: number; ty: number } | null => (active ? hunter : null);

/**
 * Enter a world.
 *
 * `savedFog` is whatever the save had, which may be from a different world or
 * simply absent; `unpackExplored` turns anything that does not fit into a clean
 * blank fog rather than loading it crooked.
 */
export function setActiveChart(chart: WorldChart, savedFog?: unknown): void {
  active = { chart, explored: unpackExplored(savedFog, chart.w, chart.h) };
  hunter = null;
  emit();
}

export function clearActiveChart(): void {
  if (!active && !hunter) return;
  active = null;
  hunter = null;
  emit();
}

/**
 * The hunter is standing here. Returns how many new cells that uncovered, so a
 * caller can skip the redraw — and the save — when nothing changed, which is
 * almost every step.
 */
export function noteVisited(tx: number, ty: number, sight = SIGHT): number {
  if (!active) return 0;
  const moved = !hunter || hunter.tx !== tx || hunter.ty !== ty;
  hunter = { tx, ty };
  const fresh = reveal(active.explored, tx, ty, sight);
  if (fresh || moved) emit();
  return fresh;
}

/** The fog, ready to go into a save. Null when there is no world. */
export function fogForSave(): ExploredSave | null {
  return active ? packExplored(active.explored) : null;
}

/** Only for tests: forget everything. */
export function resetChartStore(): void {
  active = null;
  hunter = null;
  listeners.clear();
}

/** A blank fog for a chart, for callers that want one without entering a world. */
export const blankFogFor = (chart: WorldChart): Explored => freshExplored(chart.w, chart.h);
