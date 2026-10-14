import { useSyncExternalStore } from "react";

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

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, () => layout, () => layout);
}

export function isPinned(id: string): boolean {
  return !!layout[id]?.pinned;
}
