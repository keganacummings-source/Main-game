/**
 * One player's account: password record, login sessions and the cloud save.
 * Storage-agnostic (anything with a synchronous `exec`) so it can run inside a
 * SQLite-backed Durable Object in production and on node:sqlite in tests.
 */
import {
  hashPassword,
  randomToken,
  sha256Hex,
  verifyPassword,
} from "./auth-crypto.ts";

export interface SqlLike {
  exec(query: string, ...bindings: unknown[]): { toArray(): any[] };
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SESSIONS = 10;
export const MAX_FAILS = 5;
export const LOCK_MS = 60_000;
/** SQLite rows top out at 2 MB; leave headroom for the other columns. */
export const MAX_SAVE_BYTES = 1_900_000;

export type SignupResult = { ok: true; token: string; display: string } | { ok: false; error: "taken" };
export type SigninResult =
  | { ok: true; token: string; display: string }
  | { ok: false; error: "bad" }
  | { ok: false; error: "locked"; retryAfter: number };

export class AccountStore {
  private readonly sql: SqlLike;

  constructor(sql: SqlLike) {
    this.sql = sql;
    sql.exec(
      `CREATE TABLE IF NOT EXISTS account (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         display TEXT NOT NULL,
         salt TEXT NOT NULL,
         hash TEXT NOT NULL,
         iterations INTEGER NOT NULL,
         created_at INTEGER NOT NULL,
         fails INTEGER NOT NULL DEFAULT 0,
         locked_until INTEGER NOT NULL DEFAULT 0
       )`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS sessions (
         token_hash TEXT PRIMARY KEY,
         expires_at INTEGER NOT NULL
       )`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS save (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         payload TEXT NOT NULL,
         updated_at INTEGER NOT NULL
       )`,
    );
  }

  private account(): {
    display: string;
    salt: string;
    hash: string;
    iterations: number;
    locked_until: number;
  } | null {
    return this.sql.exec(`SELECT display, salt, hash, iterations, locked_until FROM account WHERE id = 1`).toArray()[0] ?? null;
  }

  private async newSession(now: number): Promise<string> {
    const token = randomToken();
    const hash = await sha256Hex(token);
    this.sql.exec(`DELETE FROM sessions WHERE expires_at < ?`, now);
    this.sql.exec(`INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)`, hash, now + SESSION_TTL_MS);
    // Keep only the newest MAX_SESSIONS logins.
    this.sql.exec(
      `DELETE FROM sessions WHERE token_hash NOT IN (
         SELECT token_hash FROM sessions ORDER BY expires_at DESC LIMIT ?
       )`,
      MAX_SESSIONS,
    );
    return token;
  }

  async signup(display: string, password: string, now: number): Promise<SignupResult> {
    if (this.account()) return { ok: false, error: "taken" };
    const rec = await hashPassword(password);
    // The hash awaits, so another signup may have won: re-check before the (synchronous) insert.
    if (this.account()) return { ok: false, error: "taken" };
    this.sql.exec(
      `INSERT INTO account (id, display, salt, hash, iterations, created_at) VALUES (1, ?, ?, ?, ?, ?)`,
      display,
      rec.salt,
      rec.hash,
      rec.iterations,
      now,
    );
    return { ok: true, token: await this.newSession(now), display };
  }

  async signin(password: string, now: number): Promise<SigninResult> {
    const acct = this.account();
    if (!acct) {
      await hashPassword(password); // same cost as a real attempt: no timing oracle for "no such user"
      return { ok: false, error: "bad" };
    }
    if (acct.locked_until > now) {
      return { ok: false, error: "locked", retryAfter: Math.ceil((acct.locked_until - now) / 1000) };
    }
    const ok = await verifyPassword(password, acct);
    if (!ok) {
      this.sql.exec(`UPDATE account SET fails = fails + 1 WHERE id = 1`);
      const fails = this.sql.exec(`SELECT fails FROM account WHERE id = 1`).toArray()[0]?.fails ?? 0;
      if (fails >= MAX_FAILS) {
        this.sql.exec(`UPDATE account SET fails = 0, locked_until = ? WHERE id = 1`, now + LOCK_MS);
      }
      return { ok: false, error: "bad" };
    }
    this.sql.exec(`UPDATE account SET fails = 0, locked_until = 0 WHERE id = 1`);
    return { ok: true, token: await this.newSession(now), display: acct.display };
  }

  async verify(token: string, now: number): Promise<{ display: string } | null> {
    const hash = await sha256Hex(token);
    const row = this.sql.exec(`SELECT expires_at FROM sessions WHERE token_hash = ?`, hash).toArray()[0];
    if (!row) return null;
    if (row.expires_at < now) {
      this.sql.exec(`DELETE FROM sessions WHERE token_hash = ?`, hash);
      return null;
    }
    const acct = this.account();
    return acct ? { display: acct.display } : null;
  }

  async signout(token: string): Promise<void> {
    this.sql.exec(`DELETE FROM sessions WHERE token_hash = ?`, await sha256Hex(token));
  }

  getSave(): { payload: string; updatedAt: number } | null {
    const row = this.sql.exec(`SELECT payload, updated_at FROM save WHERE id = 1`).toArray()[0];
    return row ? { payload: row.payload, updatedAt: row.updated_at } : null;
  }

  putSave(payload: string, now: number): void {
    this.sql.exec(
      `INSERT INTO save (id, payload, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      payload,
      now,
    );
  }
}
