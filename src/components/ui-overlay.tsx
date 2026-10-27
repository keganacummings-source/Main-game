/**
 * Hover hints and right-click menus, for the whole interface.
 *
 * Both of these existed before, but only on the canvas and only for the world: right-clicking a
 * patch of grass opened a card, while right-clicking a sword in your bag did nothing, and every
 * panel in the game fell back to the browser's own `title=` tooltip — slow to appear, unstyled,
 * and truncated exactly when the text mattered.
 *
 * So there is one mechanism here and everything uses it:
 *
 *   hoverProps(content)   spread onto any element to give it a real hint card
 *   menuProps(menu)       spread onto any element to give it its own right-click menu
 *   <UiOverlay />         rendered once, near the root, and draws whichever is open
 *
 * Both are module-level rather than React context on purpose. The panels that need them are spread
 * across half a dozen files that are not wrapped in a common provider, and threading one through
 * would have meant touching every one of them just to get at a tooltip.
 *
 * Touch devices get the menu through a long press and no hints at all — a hint you cannot hover is
 * just a card that appears when you try to tap something.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  closeHint, closeMenu as closeCore, moveHint, openHint, openMenu, place, readHint, readMenu, resetOverlay, subscribe,
  type HintContent, type MenuAction, type MenuState, type HintState, type UiMenu,
} from "./ui-overlay-core";

export { resetOverlay };
export type { MenuAction, UiMenu, HintContent };

export function openUiMenu(menu: UiMenu, x: number, y: number): void {
  openMenu(menu, x, y);
}
export function closeUiMenu(): void {
  closeCore();
}
/** True on a device that cannot hover, where a hint card would fight with tapping. */
function touchOnly(): boolean {
  try { return window.matchMedia("(hover: none)").matches; } catch { return false; }
}

// ---------------------------------------------------------------------------
// The two prop helpers. These are what panels actually use.
// ---------------------------------------------------------------------------

const HINT_DELAY = 110;          // long enough not to flicker while the cursor crosses a list
let hintTimer = 0;

/**
 * Give an element a hint card. Spread the result onto it:
 *
 *   <button {...hoverProps({ title: g.name, body: <CompareTable … /> })}>
 *
 * Passing null is allowed and does nothing, so a caller can decide per row without branching.
 */
export function hoverProps(content: HintContent | null) {
  if (!content) return {};
  const open = (x: number, y: number) => {
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => openHint(content, x, y), HINT_DELAY);
  };
  const close = () => { window.clearTimeout(hintTimer); closeHint(); };
  return {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse" || touchOnly()) return;
      open(e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => {
      // Follow the cursor only while the card is already up, so it does not jitter on the way in.
      if (e.pointerType !== "mouse") return;
      moveHint(e.clientX, e.clientY);
    },
    onPointerLeave: close,
    onPointerDown: close,
    // Keyboard users get the same card, pinned to the element rather than the cursor.
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      openHint(content, r.left + r.width / 2, r.bottom);
    },
    onBlur: close,
  };
}

const LONG_PRESS = 450;

/**
 * Give an element its own right-click menu. Spread the result onto it:
 *
 *   <li {...menuProps({ title: g.name, actions: [...] })}>
 *
 * Touch gets the same menu from a long press, since there is no right button to click.
 */
export function menuProps(menu: UiMenu | null) {
  if (!menu || !menu.actions.length) return {};
  let timer = 0;
  let from = { x: 0, y: 0 };
  const cancel = () => { window.clearTimeout(timer); timer = 0; };
  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();       // the nearest menu wins, not the panel behind it
      openUiMenu(menu, e.clientX, e.clientY);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      from = { x: e.clientX, y: e.clientY };
      const { clientX, clientY } = e;
      timer = window.setTimeout(() => { timer = 0; openUiMenu(menu, clientX, clientY); }, LONG_PRESS);
    },
    // A press that turns into a scroll is a scroll, not a long press.
    onPointerMove: (e: React.PointerEvent) => {
      if (!timer) return;
      if (Math.abs(e.clientX - from.x) > 8 || Math.abs(e.clientY - from.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
}

/**
 * Both at once, merged properly.
 *
 * `hoverProps` and `menuProps` both want `onPointerDown` and `onPointerMove` — one to dismiss the
 * hint and one to time a long press — so spreading them side by side silently drops whichever came
 * first and breaks long-press on touch. Anything that wants a hint AND a menu uses this instead.
 */
export function targetProps(menu: UiMenu | null, hint: HintContent | null) {
  const m = menuProps(menu) as Record<string, ((e: never) => void) | undefined>;
  const h = hoverProps(hint) as Record<string, ((e: never) => void) | undefined>;
  const both: Record<string, (e: never) => void> = {};
  for (const key of new Set([...Object.keys(m), ...Object.keys(h)])) {
    const a = m[key];
    const b = h[key];
    both[key] = a && b ? ((e: never) => { a(e); b(e); }) : (a ?? b)!;
  }
  return both;
}

// ---------------------------------------------------------------------------
// The layer. Rendered once.
// ---------------------------------------------------------------------------

/** The viewport the cards are clamped inside. */
function viewport(): [number, number] {
  return typeof window === "undefined" ? [1024, 768] : [window.innerWidth, window.innerHeight];
}
const at = (x: number, y: number, w: number, h: number) => place(x, y, w, h, ...viewport());

function useStore(): { hint: HintState; menu: MenuState } {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((n) => n + 1)), []);
  return { hint: readHint(), menu: readMenu() };
}

export function UiOverlay() {
  const { hint, menu } = useStore();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);
  const [menuBox, setMenuBox] = useState({ w: 240, h: 180 });
  const [hintBox, setHintBox] = useState({ w: 280, h: 120 });

  // Measure once the card is in the document, so the clamp uses the real size.
  useEffect(() => {
    const el = menuRef.current;
    if (el) setMenuBox({ w: el.offsetWidth, h: el.offsetHeight });
  }, [menu]);
  useEffect(() => {
    const el = hintRef.current;
    if (el) setHintBox({ w: el.offsetWidth, h: el.offsetHeight });
  }, [hint]);

  // A menu closes on Escape, on a click anywhere else, and when the page moves under it.
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeUiMenu(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ?? []);
      if (!items.length) return;
      e.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at <= 0 ? items.length : at) - 1;
      items[next]?.focus();
    };
    const away = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      closeUiMenu();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("wheel", closeUiMenu, { passive: true });
    window.addEventListener("resize", closeUiMenu);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("wheel", closeUiMenu);
      window.removeEventListener("resize", closeUiMenu);
    };
  }, [menu]);

  // Open a menu and the first item is under the keyboard straight away.
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled)")?.focus();
  }, [menu]);

  return (
    <>
      {hint && (
        <div
          ref={hintRef}
          className={`ui-hint px-panel ${hint.wide ? "ui-hint-wide" : ""}`}
          role="tooltip"
          data-testid="ui-hint"
          style={at(hint.x, hint.y, hintBox.w, hintBox.h)}
        >
          {hint.title && <p className="ui-hint-title">{hint.title}</p>}
          <div className="ui-hint-body">{hint.body}</div>
          {hint.foot && <p className="ui-hint-foot">{hint.foot}</p>}
        </div>
      )}

      {menu && (
        <div
          ref={menuRef}
          className="ui-menu px-panel"
          role="menu"
          aria-label={typeof menu.title === "string" ? menu.title : "Actions"}
          data-testid="ui-menu"
          style={at(menu.x, menu.y, menuBox.w, menuBox.h)}
        >
          <p className="ui-menu-title">{menu.title}</p>
          {(menu.lines ?? []).map((line, i) => <p key={i} className="ui-menu-line">{line}</p>)}
          <div className="ui-menu-items">
            {[...menu.actions].sort((a, b) => Number(!!a.danger) - Number(!!b.danger)).map((a) => (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                data-testid={`ui-menu-${a.id}`}
                className={`ui-menu-item ${a.danger ? "ui-menu-item-danger" : ""}`}
                disabled={a.disabled}
                onClick={() => { closeUiMenu(); a.onPick(); }}
              >
                <span className="ui-menu-label">{a.label}</span>
                {a.about && <span className="ui-menu-about">{a.about}</span>}
              </button>
            ))}
          </div>
          <p className="ui-menu-foot">Esc to close</p>
        </div>
      )}
    </>
  );
}
