import type { ChatLine, FriendRow, GraveBody, GraveMode, GraveRow } from "./social-types";

// Chat and friends are not part of the live game (the lobby handles live play);
// these stay as inert stubs so existing callers keep working.
export async function ensureProfile(_username: string): Promise<void> {}
export async function postChat(_channel: "global" | "friends", _body: string): Promise<void> {}
export async function listChat(): Promise<ChatLine[]> {
  return [];
}
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
  const res = await fetch(`/api/graves?mode=${encodeURIComponent(mode)}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "The board is dark.");
  }
  return (await res.json()) as GraveRow[];
}
