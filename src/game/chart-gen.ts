/**
 * Getting a world chart without freezing the game.
 *
 * `ensureChart(seed)` builds the chart in a worker and resolves when it is
 * ready; `cachedChart(seed)` is the synchronous read the engine uses once it is.
 * The engine never waits on a chart in the middle of a frame: it asks for one
 * when a character is made or loaded, shows a "charting" screen, and carries on
 * from `cachedChart` when the promise resolves.
 *
 * Where there is no Worker (tests, very old browsers) the chart is built in
 * place. That is slow but correct, which matters more than being fast: a world
 * with the wrong shape under a hunter's feet is a worse failure than a pause.
 */
import { generateChart, type WorldChart } from "./world-chart";

/** Charts kept ready. Each is about 25 MB, and a hunter is only ever in one world. */
const KEEP = 2;

const ready = new Map<number, WorldChart>();
const pending = new Map<number, Promise<WorldChart>>();
let worker: Worker | null = null;
const waiting = new Map<number, { ok: (c: WorldChart) => void; fail: (e: Error) => void }>();

function remember(seed: number, chart: WorldChart): WorldChart {
  ready.delete(seed);
  ready.set(seed, chart);
  while (ready.size > KEEP) {
    const oldest = ready.keys().next().value as number | undefined;
    if (oldest === undefined) break;
    ready.delete(oldest);
  }
  return chart;
}

/** The chart for a seed if it has been built, else null. Never builds one. */
export const cachedChart = (seed: number): WorldChart | null => ready.get(seed) ?? null;

/** Whether a chart for this seed is on its way. */
export const chartPending = (seed: number): boolean => pending.has(seed);

function workerFor(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    const w = new Worker(new URL("./chart-worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ seed: number; chart?: WorldChart; error?: string }>) => {
      const job = waiting.get(e.data.seed);
      if (!job) return;
      waiting.delete(e.data.seed);
      if (e.data.chart) job.ok(e.data.chart);
      else job.fail(new Error(e.data.error ?? "The chart could not be built."));
    };
    w.onerror = () => {
      // A worker that cannot start or has died: let every waiting job fall back to building in place.
      const jobs = [...waiting.values()];
      waiting.clear();
      worker = null;
      for (const j of jobs) j.fail(new Error("worker"));
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Builds the chart in place. Only for when there is no worker to do it. */
export function buildChartNow(seed: number): WorldChart {
  return remember(seed, generateChart({ seed }));
}

export function ensureChart(seed: number): Promise<WorldChart> {
  const have = ready.get(seed);
  if (have) return Promise.resolve(remember(seed, have));
  const already = pending.get(seed);
  if (already) return already;

  const inPlace = () => new Promise<WorldChart>((resolve) => setTimeout(() => resolve(buildChartNow(seed)), 0));
  const w = workerFor();
  const job = w
    ? new Promise<WorldChart>((ok, fail) => {
        waiting.set(seed, { ok, fail });
        w.postMessage({ seed });
      }).then((c) => remember(seed, c), () => inPlace())
    : inPlace();
  const tracked = job.finally(() => { pending.delete(seed); });
  pending.set(seed, tracked);
  return tracked;
}

/** The chart for a seed, building it in place if it is not ready. The engine's safety net, not its plan. */
export function chartNow(seed: number): WorldChart {
  return cachedChart(seed) ?? buildChartNow(seed);
}

/** Only for tests: forget everything. */
export function resetChartCache(): void {
  ready.clear();
  pending.clear();
  waiting.clear();
}
