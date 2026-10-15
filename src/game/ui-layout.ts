import { useSyncExternalStore } from "react";
import { getLayout, subscribeLayout, type WinRect } from "./ui-layout-store";

export { isPinned, resetLayout, setWin, type WinRect } from "./ui-layout-store";

export function useLayout(): Record<string, WinRect> {
  return useSyncExternalStore(subscribeLayout, getLayout, getLayout);
}
