/** Request validation for the worker's /api routes. */
import { MAX_NAME_LENGTH, type Role, type SignalKind } from "./signaling-core.ts";

const ID = /^[a-zA-Z0-9_-]{1,64}$/;
export const MAX_BODY_BYTES = 40_000;
export const MAX_PAYLOAD_CHARS = 32_768;

export type PollQuery = { room: string; peer: string; name: string; since: number; role: Role };

export type PostBody =
  | { op: "signal"; room: string; from: string; to: string; kind: SignalKind; payload: unknown }
  | { op: "leave"; room: string; peer: string };

export function isId(v: unknown): v is string {
  return typeof v === "string" && ID.test(v);
}

export function parsePoll(params: URLSearchParams): PollQuery | null {
  const room = params.get("room");
  const peer = params.get("peer");
  const name = params.get("name") ?? "";
  const sinceRaw = params.get("since") ?? "0";
  const roleRaw = params.get("role") ?? "guest";
  if (!isId(room) || !isId(peer)) return null;
  if (name.length > MAX_NAME_LENGTH) return null;
  if (roleRaw !== "host" && roleRaw !== "guest") return null;
  if (!/^\d{1,16}$/.test(sinceRaw)) return null;
  const since = Number(sinceRaw);
  if (!Number.isSafeInteger(since)) return null;
  return { room, peer, name, since, role: roleRaw };
}

export function parsePost(body: unknown): PostBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.op === "leave") {
    return isId(b.room) && isId(b.peer) ? { op: "leave", room: b.room, peer: b.peer } : null;
  }
  if (b.op === "signal") {
    if (!isId(b.room) || !isId(b.from) || !isId(b.to)) return null;
    if (b.kind !== "offer" && b.kind !== "answer" && b.kind !== "ice") return null;
    if (!("payload" in b) || b.payload === undefined) return null;
    const size = JSON.stringify(b.payload)?.length ?? 0;
    if (size > MAX_PAYLOAD_CHARS) return null;
    return { op: "signal", room: b.room, from: b.from, to: b.to, kind: b.kind, payload: b.payload };
  }
  return null;
}

// ── accounts ────────────────────────────────────────────────────────────────

const USERNAME = /^[a-zA-Z0-9_]{3,16}$/;
export const MAX_ACCOUNT_BODY_BYTES = 2_000;
export const MAX_SAVE_BODY_BYTES = 2_100_000;
export const MAX_SAVE_CHARS = 1_500_000;

export type Credentials = { username: string; password: string };

export function parseCredentials(body: unknown): Credentials | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request." };
  const { username, password } = body as Record<string, unknown>;
  if (typeof username !== "string" || !USERNAME.test(username)) {
    return { error: "Username is 3–16 letters, numbers, or _." };
  }
  if (typeof password !== "string" || password.length < 8) return { error: "Password needs 8 characters." };
  if (password.length > 128) return { error: "Password is too long (128 max)." };
  return { username, password };
}

/** A save is a JSON document, sent as a string, bounded in chars and UTF-8 bytes. */
export function parseSave(body: unknown, maxBytes: number): string | null {
  if (!body || typeof body !== "object") return null;
  const payload = (body as Record<string, unknown>).payload;
  if (typeof payload !== "string" || payload.length < 2 || payload.length > MAX_SAVE_CHARS) return null;
  if (new TextEncoder().encode(payload).length > maxBytes) return null;
  try {
    JSON.parse(payload);
  } catch {
    return null;
  }
  return payload;
}

/** Extract `<user>.<token>` from the session cookie. */
export function parseSessionCookie(header: string | null): { user: string; token: string } | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k !== "turbz_session") continue;
    const v = rest.join("=");
    const dot = v.indexOf(".");
    if (dot < 3) return null;
    const user = v.slice(0, dot);
    const token = v.slice(dot + 1);
    if (!USERNAME.test(user) || user !== user.toLowerCase() || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
    return { user, token };
  }
  return null;
}
