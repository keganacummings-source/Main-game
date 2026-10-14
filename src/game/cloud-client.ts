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
