/**
 * Mobile UI mode.
 *
 * The game has always had a few touch affordances — a move stick under `@media (pointer: coarse)`,
 * a handful of narrow-screen rules — but the interface itself was the desktop one, shrunk. Twelve
 * menu buttons in a toolbar, floating windows you drag by a title bar, hover cards, keyboard badges
 * on everything.
 *
 * Mobile mode replaces that wholesale rather than squeezing it. It is a setting rather than a media
 * query on purpose: a phone-sized browser window on a desktop is not a phone, a tablet with a
 * keyboard often wants the full interface, and someone playing on a big touchscreen may want either.
 * The player decides, from the main menu, and the choice sticks.
 *
 * The one piece of automation is the FIRST answer: with no stored choice, a device that cannot
 * hover and has a narrow screen starts in mobile mode. After that, whatever the player picked wins
 * forever.
 *
 * Everything else reads this one of two ways:
 *   - script:  isMobileUi() / onMobileUi(fn)
 *   - styles:  html[data-mobile-ui="1"], which this module keeps in step
 */

const KEY = "turbz.mobileUi";
const ATTR = "data-mobile-ui";

type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();

/** Would this device start in mobile mode if nobody had ever chosen? */
export function guessMobile(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) <= 820;
    return coarse && narrow;
  } catch {
    return false;
  }
}

function stored(): boolean | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "1" ? true : raw === "0" ? false : null;
  } catch {
    return null;        // private mode, or storage blocked
  }
}

let on: boolean = (() => {
  const saved = stored();
  return saved === null ? guessMobile() : saved;
})();

/** Keep the document in step, so the stylesheet can switch the whole interface at once. */
function paint(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (on) root.setAttribute(ATTR, "1");
  else root.removeAttribute(ATTR);
}
paint();

export function isMobileUi(): boolean {
  return on;
}

/** Has the player ever chosen for themselves, or is this still the guess? */
export function mobileUiChosen(): boolean {
  return stored() !== null;
}

export function setMobileUi(next: boolean): void {
  if (next === on) return;
  on = next;
  try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* the setting just will not survive a reload */ }
  paint();
  for (const fn of listeners) fn(on);
}

export function toggleMobileUi(): boolean {
  setMobileUi(!on);
  return on;
}

/** Subscribe to changes. Returns the unsubscribe. */
export function onMobileUi(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Only for tests: forget the choice and re-read the environment. */
export function resetMobileUi(value = false): void {
  on = value;
  try { localStorage.removeItem(KEY); } catch { /* nothing stored anyway */ }
  paint();
  for (const fn of listeners) fn(on);
}
