/**
 * dreamdaw.com worker.
 *
 *  - Static game files are served by Workers Static Assets *without* invoking this
 *    script (see `run_worker_first` in wrangler.toml), so asset traffic is free.
 *  - /api/account/* + /api/save: username/password accounts and one cloud save
 *    per account, each account being its own SQLite-backed Durable Object.
 *  - /api/rtc: WebRTC signaling for player-hosted lobbies (same wire contract as
 *    src/lib/multiplayer/signaling.server.ts, plus a host/guest role).
 */
import type { Env } from "./env.ts";
import {
  MAX_ACCOUNT_BODY_BYTES,
  MAX_BODY_BYTES,
  MAX_SAVE_BODY_BYTES,
  parseCredentials,
  parsePoll,
  parsePost,
  parseSave,
  parseSessionCookie,
} from "./validate.ts";
import { MAX_SAVE_BYTES } from "./account-store.ts";
import { isJoinError } from "./signaling-core.ts";

export { SignalingRoom } from "./room.ts";
export { UserAccount } from "./account.ts";
export { GravesBoard } from "./graves.ts";

const COOKIE = "turbz_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: h });
}

/** Browsers always send Origin on cross-site writes; reject ones that aren't ours. */
function crossOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== url.host;
  } catch {
    return true;
  }
}

/** Read a bounded JSON body. Returns a Response on failure. */
async function readJson(request: Request, limit: number): Promise<unknown | Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit) return json({ error: "payload too large" }, 413);
  const text = await request.text();
  if (text.length > limit) return json({ error: "payload too large" }, 413);
  try {
    return JSON.parse(text);
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
}

// ── signaling ───────────────────────────────────────────────────────────────

async function handleRtc(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    if (request.method === "GET") {
      const q = parsePoll(url.searchParams);
      if (!q) return json({ error: "invalid query" }, 400);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(q.room));
      const result = await stub.poll(q.peer, q.name, q.since, q.role);
      if (isJoinError(result)) return json({ error: result.error }, result.error === "no-lobby" ? 404 : 409);
      return json(result);
    }

    if (request.method === "POST") {
      if (crossOrigin(request, url)) return json({ error: "forbidden" }, 403);
      const raw = await readJson(request, MAX_BODY_BYTES);
      if (raw instanceof Response) return raw;
      const msg = parsePost(raw);
      if (!msg) return json({ error: "invalid request" }, 400);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(msg.room));
      if (msg.op === "signal") await stub.signal(msg.from, msg.to, msg.kind, msg.payload);
      else await stub.leave(msg.peer);
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}

// ── accounts + saves ────────────────────────────────────────────────────────

function sessionCookie(user: string, token: string, url: URL): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${user}.${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

function clearCookie(url: URL): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

function accountStub(env: Env, user: string) {
  return env.ACCOUNTS.get(env.ACCOUNTS.idFromName(user));
}

/** The signed-in user for this request, or null. */
async function currentUser(request: Request, env: Env) {
  const s = parseSessionCookie(request.headers.get("cookie"));
  if (!s) return null;
  const who = await accountStub(env, s.user).verify(s.token);
  return who ? { id: s.user, displayName: who.display, token: s.token } : null;
}

async function handleAccount(request: Request, env: Env, url: URL): Promise<Response> {
  const route = url.pathname.slice("/api/account/".length);
  try {
    if (route === "me" && request.method === "GET") {
      const me = await currentUser(request, env);
      return json({ user: me ? { id: me.id, displayName: me.displayName } : null });
    }

    if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
    if (crossOrigin(request, url)) return json({ error: "forbidden" }, 403);

    if (route === "signout") {
      const s = parseSessionCookie(request.headers.get("cookie"));
      if (s) await accountStub(env, s.user).signout(s.token);
      return json({ ok: true }, 200, { "set-cookie": clearCookie(url) });
    }

    if (route === "signup" || route === "signin") {
      const raw = await readJson(request, MAX_ACCOUNT_BODY_BYTES);
      if (raw instanceof Response) return raw;
      const creds = parseCredentials(raw);
      if ("error" in creds) return json({ error: creds.error }, 400);
      const key = creds.username.toLowerCase();
      const stub = accountStub(env, key);

      if (route === "signup") {
        const res = await stub.signup(creds.username, creds.password);
        if (!res.ok) return json({ error: "That name is taken." }, 409);
        return json({ user: { id: key, displayName: res.display } }, 200, {
          "set-cookie": sessionCookie(key, res.token, url),
        });
      }

      const res = await stub.signin(creds.password);
      if (!res.ok) {
        if (res.error === "locked") {
          return json({ error: `Too many tries. Wait ${res.retryAfter}s and try again.` }, 429, {
            "retry-after": String(res.retryAfter),
          });
        }
        return json({ error: "Wrong name or password." }, 401);
      }
      return json({ user: { id: key, displayName: res.display } }, 200, {
        "set-cookie": sessionCookie(key, res.token, url),
      });
    }

    return json({ error: "not found" }, 404);
  } catch (error) {
    console.error("[account] error:", error);
    return json({ error: "Account service failed. Try again." }, 500);
  }
}

async function handleSave(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    const me = await currentUser(request, env);
    if (!me) return json({ error: "sign in required" }, 401);
    const stub = accountStub(env, me.id);

    if (request.method === "GET") {
      const save = await stub.getSave();
      return json({ payload: save?.payload ?? null, updatedAt: save?.updatedAt ?? null });
    }

    if (request.method === "PUT") {
      if (crossOrigin(request, url)) return json({ error: "forbidden" }, 403);
      const raw = await readJson(request, MAX_SAVE_BODY_BYTES);
      if (raw instanceof Response) return raw;
      const payload = parseSave(raw, MAX_SAVE_BYTES);
      if (!payload) return json({ error: "bad save" }, 400);
      await stub.putSave(payload);
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[save] error:", error);
    return json({ error: "Save failed. Try again." }, 500);
  }
}

function gravesStub(env: Env) {
  return env.GRAVES.get(env.GRAVES.idFromName("global"));
}

async function handleGraves(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    const stub = gravesStub(env);

    if (request.method === "GET") {
      const modeRaw = url.searchParams.get("mode") ?? "hunt";
      if (modeRaw !== "hunt" && modeRaw !== "hardcore") {
        return json([]);
      }
      const rows = await stub.list(modeRaw);
      return json(rows);
    }

    if (request.method === "POST") {
      if (crossOrigin(request, url)) return json({ error: "forbidden" }, 403);
      const me = await currentUser(request, env);
      if (!me) return json({ error: "sign in required" }, 401);
      const raw = await readJson(request, 60_000);
      if (raw instanceof Response) return raw;
      if (!raw || typeof raw !== "object") return json({ error: "bad grave" }, 400);
      const body = raw as Record<string, unknown>;
      const mode = body.mode === "hunt" || body.mode === "hardcore" ? body.mode : null;
      if (body.mode === "arena") return json({ ok: true });
      if (!mode) return json({ error: "unknown board" }, 400);
      const name = String(body.name ?? "").slice(0, 24).trim();
      if (!name) return json({ error: "nameless grave" }, 400);
      const score = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(body.score) || 0)));
      const level = Math.max(1, Math.min(400, Math.floor(Number(body.level) || 1)));
      const race = String(body.race ?? "Unknown").slice(0, 24);
      const grave = {
        mode,
        score,
        name,
        race,
        level,
        accountScore: Math.max(0, Math.floor(Number(body.accountScore) || 0)),
        skills: Array.isArray(body.skills) ? body.skills.slice(0, 16) : [],
        gear: Array.isArray(body.gear) ? body.gear.slice(0, 8) : [],
        note: String(body.note ?? "").slice(0, 180),
      };
      await stub.post(me.displayName || me.id, grave);
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[graves] error:", error);
    const msg = error instanceof Error ? error.message : "Leaderboard failed";
    return json({ error: msg }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/rtc") return handleRtc(request, env, url);
    if (url.pathname.startsWith("/api/account/")) return handleAccount(request, env, url);
    if (url.pathname === "/api/save") return handleSave(request, env, url);
    if (url.pathname === "/api/graves") return handleGraves(request, env, url);
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    // Normally unreachable (assets are served before the worker runs), but keeps
    // `wrangler dev` and any future run_worker_first change working.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
