/**
 * Accounts for the static (dreamdaw.com) build. The worker in /worker owns
 * sign-up, sign-in and the cloud save; this is the browser side: a tiny store
 * plus fetch helpers. The session itself is an HttpOnly cookie, so no token
 * ever touches JavaScript.
 */
import { useEffect, useSyncExternalStore } from "react";

export type StaticUser = { id: string; displayName: string };
type State = { user: StaticUser | null; pending: boolean };

/** Local game saves that belong to whoever last signed in on this browser. */
/** The account record (level, perks, skills) is per player too, so another player's never merges into yours. */
const LOCAL_SAVE_KEYS = ["turbz-v3", "turbz-hardcore-v1", "turbz-arena-v1", "turbz-account-meta-v1"];
const LAST_USER_KEY = "turbz-last-user";

let state: State = { user: null, pending: true };
let started = false;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

function clearLocalSaves() {
  try {
    for (const k of LOCAL_SAVE_KEYS) localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}

/**
 * The browser caches saves in localStorage. If a different account signs in on
 * the same browser, drop the previous player's cache so their witch can't leak
 * into (or be overwritten onto) the new account. The very first sign-in keeps
 * any pre-existing local save, so early players can bring their progress along.
 */
function adopt(user: StaticUser | null) {
  if (user) {
    try {
      const last = localStorage.getItem(LAST_USER_KEY);
      if (last && last !== user.id) clearLocalSaves();
      localStorage.setItem(LAST_USER_KEY, user.id);
    } catch {
      /* storage unavailable */
    }
  }
  set({ user, pending: false });
}

/**
 * Where the worker is not deployed (this build), accounts fall back to the browser so the game
 * still opens. Sign-up/sign-in then keep the player on this device only.
 */
const LOCAL_USER_KEY = "turbz-local-user";

function readLocalUser(): StaticUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as StaticUser;
    return u && typeof u.id === "string" && typeof u.displayName === "string" ? u : null;
  } catch {
    return null;
  }
}

function writeLocalUser(user: StaticUser | null) {
  try {
    if (user) localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(LOCAL_USER_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** No worker on this host: the request never reached an API (network error or a non-JSON reply). */
function offline(error: unknown) {
  return error instanceof TypeError || error instanceof SyntaxError;
}

function localAccount(username: string): StaticUser {
  const key = username.trim().toLowerCase();
  const user = { id: `local:${key}`, displayName: username.trim() };
  writeLocalUser(user);
  return user;
}

async function refresh() {
  try {
    const res = await fetch("/api/account/me", { cache: "no-store" });
    const body = (await res.json()) as { user?: StaticUser | null };
    adopt(body.user ?? null);
  } catch {
    const local = readLocalUser();
    if (local) adopt(local);
    else set({ user: null, pending: false });
  }
}

async function post(path: string, body: unknown): Promise<StaticUser> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { user?: StaticUser; error?: string };
  if (!res.ok || !json.user) throw new Error(json.error || "TURBZ API refused that");
  return json.user;
}

export async function staticSignUp(username: string, password: string): Promise<void> {
  try {
    adopt(await post("/api/account/signup", { username, password }));
  } catch (error) {
    if (!offline(error)) throw error;
    adopt(localAccount(username));
  }
}

export async function staticSignIn(username: string, password: string): Promise<void> {
  try {
    adopt(await post("/api/account/signin", { username, password }));
  } catch (error) {
    if (!offline(error)) throw error;
    adopt(localAccount(username));
  }
}

export async function staticSignOut(): Promise<void> {
  try {
    await fetch("/api/account/signout", { method: "POST" });
  } finally {
    clearLocalSaves();
    writeLocalUser(null);
    try {
      localStorage.removeItem(LAST_USER_KEY);
    } catch {
      /* storage unavailable */
    }
    // Fresh page = fresh game state; nothing of the old witch stays in memory.
    window.location.reload();
  }
}

export function useStaticAccount(): State {
  useEffect(() => {
    if (started) return;
    started = true;
    void refresh();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}