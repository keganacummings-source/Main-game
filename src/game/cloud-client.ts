/**
 * Cloud save: the worker stores one save bundle per account at /api/save,
 * authorised by the HttpOnly session cookie.
 */
import { unpackCloud } from "./account-save";

/**
 * The cloud copy, decoded. Throws when the server could not be read (so the caller knows the cloud state
 * is unknown and keeps this device's saves), and returns null only when there truly is no cloud save.
 */
export async function loadCloudSave(): Promise<string | null> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/save", { cache: "no-store" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`cloud save ${res.status}`);
      const body = (await res.json()) as { payload?: string | null };
      return typeof body.payload === "string" ? await unpackCloud(body.payload) : null;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("cloud save unreachable");
}

/** Uploads one bundle. `urgent` (the tab is closing) uses a keep-alive request when it is small enough. */
export async function writeCloudSave(args: { data: string; urgent?: boolean }): Promise<boolean> {
  try {
    const body = JSON.stringify({ payload: args.data });
    const res = await fetch("/api/save", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
      keepalive: !!args.urgent && body.length < 60_000,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Uploads the Shiny collection (and its GIF, for the Discord bot's /shiny command). */
export async function writeShinies(list: unknown[], gif: string | null): Promise<boolean> {
  try {
    const res = await fetch("/api/shinies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ list, gif }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Tells the game server a shiny dropped for this player, so the Discord bot can post it. */
export async function postShinySeen(body: { name: string; species: string; level: number; type: string; witch: string; place: string; mode: string; gif: string | null }): Promise<boolean> {
  try {
    const res = await fetch("/api/shiny-seen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}
