import type { FriendRow, GraveBody, GraveMode, GraveRow } from "./social-types";

// There is no live multiplayer: friends stay as inert stubs so existing callers keep working.
export async function ensureProfile(_username: string): Promise<void> {}
export async function requestFriend(_username: string): Promise<string> {
  return "Local hunt has no veil.";
}
export async function answerFriend(_username: string, _accept: boolean): Promise<void> {}
export async function listFriends(): Promise<FriendRow[]> {
  return [];
}

export async function postGrave(body: GraveBody): Promise<void> {
  const res = await fetch("/api/graves", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "Could not record the grave");
  }
}

export async function listGraves(mode: GraveMode): Promise<GraveRow[]> {
  const res = await fetch(`/api/graves?mode=${encodeURIComponent(mode)}`, { cache: "no-store" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "The board is dark.");
  }
  return (await res.json()) as GraveRow[];
}
