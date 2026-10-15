/** Window layout store (no React, so the engine can read it). */

export type WinRect = { x: number; y: number; w: number; h?: number; pinned?: boolean; collapsed?: boolean };
type Layout = Record<string, WinRect>;

const KEY = "turbz-ui-layout-v1";
let layout: Layout = readLocal();
const listeners = new Set<() => void>();

function readLocal(): Layout {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    /* storage full */
  }
}

export function setWin(id: string, patch: Partial<WinRect>, base: WinRect) {
  layout = { ...layout, [id]: { ...base, ...layout[id], ...patch } };
  emit();
  persist();
}

export function resetLayout() {
  layout = {};
  emit();
  persist();
}

export function subscribeLayout(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLayout(): Layout {
  return layout;
}

export function isPinned(id: string): boolean {
  return !!layout[id]?.pinned;
}
