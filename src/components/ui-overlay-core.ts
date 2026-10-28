/**
 * The parts of the hover/menu overlay that are not React: the one-at-a-time store and the
 * placement maths.
 *
 * They live apart from ui-overlay.tsx so they can be tested without a browser or a React runtime —
 * the clamping in particular is the thing most likely to break quietly, since a card that lands
 * off-screen simply looks like a card that never opened.
 */

import type { ReactNode } from "react";

export type MenuAction = {
  id: string;
  label: ReactNode;
  about?: string;
  onPick: () => void;
  disabled?: boolean;
  /** Destructive or expensive: drawn in the danger colour and always placed last. */
  danger?: boolean;
};

export type UiMenu = { title: ReactNode; lines?: ReactNode[]; actions: MenuAction[] };
export type HintContent = { title?: ReactNode; body: ReactNode; foot?: ReactNode; wide?: boolean };

export type HintState = (HintContent & { x: number; y: number }) | null;
export type MenuState = (UiMenu & { x: number; y: number }) | null;

const state: { hint: HintState; menu: MenuState } = { hint: null, menu: null };
const listeners = new Set<() => void>();

const emit = () => { for (const fn of listeners) fn(); };

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const readHint = (): HintState => state.hint;
export const readMenu = (): MenuState => state.menu;

/** Opening a menu closes any hint: the two stacked on each other are unreadable. */
export function openMenu(menu: UiMenu, x: number, y: number): void {
  state.hint = null;
  state.menu = { ...menu, x, y };
  emit();
}

export function closeMenu(): void {
  if (!state.menu) return;
  state.menu = null;
  emit();
}

/** A hint never opens over a menu — the menu is the thing being used. */
export function openHint(content: HintContent, x: number, y: number): void {
  if (state.menu) return;
  state.hint = { ...content, x, y };
  emit();
}

export function closeHint(): void {
  if (!state.hint) return;
  state.hint = null;
  emit();
}

/** Move an open hint with the cursor. Does nothing when no hint is up, so it cannot open one. */
export function moveHint(x: number, y: number): void {
  if (!state.hint) return;
  state.hint = { ...state.hint, x, y };
  emit();
}

/** Only for tests: drop everything. */
export function resetOverlay(): void {
  state.hint = null;
  state.menu = null;
  emit();
}

/**
 * Where a floating card goes, given the cursor and the card's measured size.
 *
 * Down and to the right of the cursor by preference, flipped to the other side when it would run
 * off that edge, and never closer than `pad` to any edge. A card bigger than the viewport is
 * pinned to the top-left rather than pushed off the far side.
 */
export function place(
  x: number, y: number, w: number, h: number,
  vw: number, vh: number, pad = 10,
): { left: number; top: number } {
  let left = x + 14;
  let top = y + 16;
  if (left + w > vw - pad) left = x - w - 14;
  if (top + h > vh - pad) top = y - h - 16;
  return { left: Math.max(pad, left), top: Math.max(pad, top) };
}
