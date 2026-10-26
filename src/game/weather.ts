/**
 * Battlefield conditions.
 *
 * A verse can change the weather instead of simply hitting something. Rain soaks everything caught
 * in it and feeds Water while it smothers Fire; a sandstorm scours the field and spoils everyone's
 * aim; a Void blackout puts the lights out and gnaws at what it covers; confusion leaves foes
 * swinging at the air.
 *
 * Conditions are deliberately NOT free damage. Each one is a trade: the element that calls it gets
 * stronger while it holds, its opposite gets weaker, and most of them touch you as well as them.
 * Calling rain to feed your tide verses also soaks you, and standing in your own sandstorm costs
 * you the same accuracy it costs everything else.
 *
 * One holds at a time. A new one replaces the old, so a fight can turn more than once.
 */
import type { TypeId } from "./content";

export type WeatherId = "rain" | "sandstorm" | "blackout" | "confusion" | "heatwave" | "gale";

export type WeatherDef = {
  id: WeatherId;
  name: string;
  /** Said once when it rolls in. */
  arrives: string;
  about: string;
  /** How long it holds, in seconds. */
  seconds: number;
  /** Verses of this element hit harder while it holds. */
  boost?: TypeId;
  /** Verses of this element are smothered while it holds. */
  damp?: TypeId;
  /** How much the boost and damp are worth. */
  boostMult: number;
  dampMult: number;
  /** A status pressed onto everything caught in it, every `every` seconds. */
  lay?: { status: string; t: number; every: number; /** false: foes only */ witchToo: boolean };
  /** Damage a second to everything caught in it, as a fraction of max health. */
  chip?: number;
  /** Points of accuracy everything loses while it holds. */
  blind?: number;
  /** Foes lose track of what they were doing and strike at nothing. */
  confuse?: boolean;
  /** Overlay colour. */
  colour: string;
};

export const WEATHER: readonly WeatherDef[] = [
  {
    id: "rain", name: "Rain", arrives: "Rain sweeps in across the field.",
    about: "Everything caught in it is soaked. Water runs strong; fire struggles to hold.",
    seconds: 30, boost: "water", damp: "fire", boostMult: 1.25, dampMult: 0.7,
    lay: { status: "soak", t: 3.5, every: 2.2, witchToo: true }, colour: "#8fd0ff",
  },
  {
    id: "sandstorm", name: "Sandstorm", arrives: "Sand comes up off the ground and takes the sky.",
    about: "Scours everything caught in it and spoils every aim, yours included. Earth bites; air cannot find a line.",
    seconds: 26, boost: "earth", damp: "air", boostMult: 1.25, dampMult: 0.72,
    lay: { status: "expose", t: 3, every: 3, witchToo: false },
    chip: 0.004, blind: 14, colour: "#e0c08a",
  },
  {
    id: "blackout", name: "Void Blackout", arrives: "The light goes out of the air. Something is eating it.",
    about: "Gnaws at everything under it and leaves it gloomed. The void grows; light is smothered.",
    seconds: 24, boost: "void", damp: "light", boostMult: 1.3, dampMult: 0.65,
    lay: { status: "gloom", t: 4, every: 2.6, witchToo: true },
    chip: 0.003, blind: 8, colour: "#b4a6ff",
  },
  {
    id: "confusion", name: "Confusion", arrives: "The field stops making sense. Nothing is quite where it was.",
    about: "Foes lose the thread and strike at nothing. Spirit reads the muddle; normal sense does not.",
    seconds: 18, boost: "spirit", damp: "normal", boostMult: 1.2, dampMult: 0.8,
    confuse: true, blind: 10, colour: "#c9a6e8",
  },
  {
    id: "heatwave", name: "Heatwave", arrives: "The air thickens and starts to shimmer.",
    about: "Burns everything standing in it. Fire roars; ice cannot keep its shape.",
    seconds: 26, boost: "fire", damp: "ice", boostMult: 1.28, dampMult: 0.68,
    lay: { status: "burn", t: 3, every: 3.2, witchToo: true }, colour: "#ff8a4a",
  },
  {
    id: "gale", name: "Gale", arrives: "A wind gets up that nobody is going to stand straight in.",
    about: "Everything caught in it is thrown open. Air carries; earth is pinned down by it.",
    seconds: 22, boost: "air", damp: "earth", boostMult: 1.25, dampMult: 0.74,
    lay: { status: "expose", t: 2.8, every: 2.4, witchToo: true },
    blind: 6, colour: "#cfe8ff",
  },
];

export const WEATHER_BY_ID: Record<string, WeatherDef> = Object.fromEntries(WEATHER.map((w) => [w.id, w]));
export const WEATHER_IDS: readonly WeatherId[] = WEATHER.map((w) => w.id);

/** A condition in play: which one, and how much of it is left. */
export type WeatherState = { id: WeatherId; t: number; lay: number };

export function startWeather(id: WeatherId): WeatherState | null {
  const def = WEATHER_BY_ID[id];
  return def ? { id, t: def.seconds, lay: 0 } : null;
}

/** The definition in play right now, or null when the sky is clear. */
export function weatherDef(state: WeatherState | null | undefined): WeatherDef | null {
  return state && state.t > 0 ? WEATHER_BY_ID[state.id] ?? null : null;
}

/**
 * What a verse of `type` is worth under this condition: more for the element it feeds, less for the
 * one it smothers, unchanged for everything else.
 */
export function weatherDamage(state: WeatherState | null | undefined, type: string): number {
  const def = weatherDef(state);
  if (!def) return 1;
  if (def.boost === type) return def.boostMult;
  if (def.damp === type) return def.dampMult;
  return 1;
}

/** Accuracy everything loses while this holds. */
export function weatherBlind(state: WeatherState | null | undefined): number {
  return weatherDef(state)?.blind ?? 0;
}

/** Should foes be swinging at nothing? */
export function weatherConfuses(state: WeatherState | null | undefined): boolean {
  return !!weatherDef(state)?.confuse;
}

/**
 * Moves a condition on. Returns what the caller should do this tick: whether to press the
 * condition's status onto everything, and whether it has just run out.
 */
export function tickWeather(state: WeatherState, dt: number): { lay: boolean; ended: boolean } {
  const def = WEATHER_BY_ID[state.id];
  if (!def) return { lay: false, ended: true };
  state.t -= dt;
  if (state.t <= 0) return { lay: false, ended: true };
  if (!def.lay) return { lay: false, ended: false };
  state.lay -= dt;
  if (state.lay > 0) return { lay: false, ended: false };
  state.lay = def.lay.every;
  return { lay: true, ended: false };
}
