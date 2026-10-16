/**
 * Day / night cycle (Hardcore only).
 *
 * One full cycle is 25 active minutes: 10 minutes of day followed by 15 minutes of night.
 * "Active" matches the rest of the game (dungeon rifts, hardcore survival): paused, dead,
 * title-screen and hidden-tab time does not advance the clock.
 *
 * Night rules (change them in NIGHT below):
 *   - foes have 2x health and deal 2x damage
 *   - foes give 3x experience
 *
 * Sleeping at night fast-forwards the clock to dawn (see SLEEP_SKIP_RATE).
 * Standard mode has no day/night cycle at all. It stays the easy mode.
 */
export const DAY_SECONDS = 10 * 60;
export const NIGHT_SECONDS = 15 * 60;
export const CYCLE_SECONDS = DAY_SECONDS + NIGHT_SECONDS;

export const NIGHT = {
  /** Foe max health and damage dealt are multiplied by this at night. */
  strength: 2,
  /** Experience from kills is multiplied by this at night. */
  xp: 3,
} as const;

/** Standard mode stays the easy mode: no day/night cycle there. Only Hardcore has nights. */
export const NIGHT_IN_STANDARD_MODE = false;

export type DayNightState = {
  /** Seconds into the current 25 minute cycle. 0 = dawn, DAY_SECONDS = dusk. */
  t: number;
  /** Counts finished nights so the UI can say "Night 3". */
  nights: number;
};

export function freshDayNight(): DayNightState {
  return { t: 0, nights: 0 };
}

export function normalizeDayNight(raw?: Partial<DayNightState> | null): DayNightState {
  const t = Number(raw?.t);
  const n = Number(raw?.nights);
  return {
    t: Number.isFinite(t) ? ((t % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS : 0,
    nights: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
  };
}

export function isNight(s: DayNightState): boolean {
  return s.t >= DAY_SECONDS;
}

/** Seconds until the next dawn (night) or dusk (day). */
export function secondsToChange(s: DayNightState): number {
  return isNight(s) ? CYCLE_SECONDS - s.t : DAY_SECONDS - s.t;
}

/** Moves the clock forward. Returns "dusk" or "dawn" when the phase flips during this call. */
export function advanceDayNight(s: DayNightState, dt: number): "dusk" | "dawn" | null {
  if (!Number.isFinite(dt) || dt <= 0) return null;
  const wasNight = isNight(s);
  s.t += dt;
  let flipped: "dusk" | "dawn" | null = null;
  if (s.t >= CYCLE_SECONDS) {
    s.t %= CYCLE_SECONDS;
    s.nights += 1;
    flipped = "dawn";
  }
  if (!wasNight && isNight(s)) flipped = "dusk";
  return flipped;
}

/** Clock speed while sleeping at night: a whole 15 minute night passes in about 14 real seconds. */
export const SLEEP_SKIP_RATE = 64;

export function skipRate(s: DayNightState, sleeping: boolean): number {
  return sleeping && isNight(s) ? SLEEP_SKIP_RATE : 1;
}

export function clockLabel(s: DayNightState): { phase: "day" | "night"; label: string; left: string } {
  const night = isNight(s);
  const left = Math.ceil(secondsToChange(s));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return { phase: night ? "night" : "day", label: night ? `Night ${s.nights + 1}` : `Day ${s.nights + 1}`, left: `${mm}:${ss}` };
}

/** 0 (bright) to 1 (darkest). Smooth dusk and dawn so the screen tint never snaps. */
export function darkness(s: DayNightState): number {
  const FADE = 90;
  if (s.t < DAY_SECONDS - FADE) return 0;
  if (s.t < DAY_SECONDS + FADE) return (s.t - (DAY_SECONDS - FADE)) / (FADE * 2);
  if (s.t < CYCLE_SECONDS - FADE) return 1;
  return Math.max(0, (CYCLE_SECONDS - s.t) / FADE);
}
