/** Request validation for the worker's /api routes. */
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

/** Compressed saves: "gz1:" then gzip as base64 (the game sends these; they are about a tenth the size). */
const GZ_SAVE = /^gz1:[A-Za-z0-9+/]+={0,2}$/;

/** A save is a JSON document (or a gzipped one, see GZ_SAVE), sent as a string, bounded in chars and UTF-8 bytes. */
export function parseSave(body: unknown, maxBytes: number): string | null {
  if (!body || typeof body !== "object") return null;
  const payload = (body as Record<string, unknown>).payload;
  if (typeof payload !== "string" || payload.length < 2 || payload.length > MAX_SAVE_CHARS) return null;
  if (new TextEncoder().encode(payload).length > maxBytes) return null;
  if (payload.startsWith("gz1:")) return GZ_SAVE.test(payload) && payload.length > 8 ? payload : null;
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
