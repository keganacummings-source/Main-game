/**
 * Builds a world chart off the main thread.
 *
 * A 2500 x 2500 chart takes about nine seconds to generate. On the main thread
 * that is a frozen tab; here it is a progress screen. The chart is typed arrays
 * only, so the result goes back to the page by transfer rather than by copy.
 */
import { generateChart } from "./world-chart";

type Scope = {
  onmessage: ((e: { data: { seed: number } }) => void) | null;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
};
const scope = self as unknown as Scope;

scope.onmessage = (e) => {
  const seed = e.data.seed;
  try {
    const chart = generateChart({ seed });
    scope.postMessage({ seed, chart }, [
      chart.biome.buffer, chart.elev.buffer, chart.moist.buffer, chart.temp.buffer, chart.land.buffer,
    ] as Transferable[]);
  } catch (err) {
    scope.postMessage({ seed, error: String((err as Error)?.message ?? err) });
  }
};
