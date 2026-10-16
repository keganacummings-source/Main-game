/**
 * Cloud save: the worker stores one save bundle per account at /api/save,
 * authorised by the HttpOnly session cookie.
 */
export async function loadCloudSave(): Promise<string | null> {
  const res = await fetch("/api/save", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { payload?: string | null };
  return typeof body.payload === "string" ? body.payload : null;
}

export async function writeCloudSave(args: { data: string }): Promise<boolean> {
  const res = await fetch("/api/save", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload: args.data }),
    keepalive: args.data.length < 60_000,
  });
  return res.ok;
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
