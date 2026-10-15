import { useRef, useSyncExternalStore } from "react";
import { getSnap, subscribe } from "@/game/engine";

export type Snap = ReturnType<typeof getSnap>;

/**
 * Subscribe to just the snapshot fields a component uses. It re-renders only when one of
 * those fields changes identity (the engine keeps unchanged fields' identity between updates).
 */
export function useSnapPick<K extends keyof Snap>(keys: readonly K[]): Pick<Snap, K> {
  const ref = useRef<Pick<Snap, K> | null>(null);
  const read = () => {
    const s = getSnap();
    const prev = ref.current;
    if (prev && keys.every((k) => prev[k] === s[k])) return prev;
    const next = {} as Pick<Snap, K>;
    for (const k of keys) next[k] = s[k];
    ref.current = next;
    return next;
  };
  return useSyncExternalStore(subscribe, read, read);
}

/** One snapshot field. */
export function useSnapValue<K extends keyof Snap>(key: K): Snap[K] {
  const read = () => getSnap()[key];
  return useSyncExternalStore(subscribe, read, read);
}
