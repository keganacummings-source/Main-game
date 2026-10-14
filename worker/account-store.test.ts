import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { AccountStore, LOCK_MS, MAX_FAILS, MAX_SESSIONS, SESSION_TTL_MS, type SqlLike } from "./account-store.ts";
import { hashPassword, verifyPassword } from "./auth-crypto.ts";
import { parseCredentials, parseSave, parseSessionCookie } from "./validate.ts";

const T0 = 1_800_000_000_000;

function store(): AccountStore {
  const db = new DatabaseSync(":memory:");
  const sql: SqlLike = {
    exec(q, ...b) {
      const stmt = db.prepare(q);
      if (/^\s*select/i.test(q)) {
        const rows = stmt.all(...(b as any[]));
        return { toArray: () => rows as any[] };
      }
      stmt.run(...(b as any[]));
      return { toArray: () => [] };
    },
  };
  return new AccountStore(sql);
}

test("password hashing round-trips and rejects wrong passwords", async () => {
  const rec = await hashPassword("correct horse", 1000);
  assert.ok(await verifyPassword("correct horse", rec));
  assert.equal(await verifyPassword("wrong horse", rec), false);
  const again = await hashPassword("correct horse", 1000);
  assert.notEqual(rec.salt, again.salt);
  assert.notEqual(rec.hash, again.hash);
});

test("signup creates the account once; the name is then taken", async () => {
  const s = store();
  const a = await s.signup("Kyo_01", "hunter2hunter2", T0);
  assert.ok(a.ok && a.display === "Kyo_01" && a.token.length >= 40);
  assert.deepEqual(await s.signup("Kyo_01", "another-pass", T0), { ok: false, error: "taken" });
});

test("concurrent signups: exactly one wins", async () => {
  const s = store();
  const [a, b] = await Promise.all([s.signup("Racer", "password-one", T0), s.signup("Racer", "password-two", T0)]);
  assert.equal([a, b].filter((r) => r.ok).length, 1);
});

test("signin accepts the right password, rejects the wrong one, and never reveals which names exist", async () => {
  const s = store();
  await s.signup("Mira", "swordfish-1", T0);
  const good = await s.signin("swordfish-1", T0 + 1);
  assert.ok(good.ok && good.display === "Mira");
  assert.deepEqual(await s.signin("nope-nope-nope", T0 + 2), { ok: false, error: "bad" });
  assert.deepEqual(await store().signin("anything-at-all", T0), { ok: false, error: "bad" }); // no such account
});

test("five wrong passwords lock the account for a minute, then it recovers", async () => {
  const s = store();
  await s.signup("Lock", "right-password", T0);
  for (let i = 0; i < MAX_FAILS; i++) assert.deepEqual(await s.signin("bad-password", T0 + i), { ok: false, error: "bad" });
  const locked = await s.signin("right-password", T0 + 10);
  assert.ok(!locked.ok && locked.error === "locked" && locked.retryAfter > 0 && locked.retryAfter <= 60);
  assert.ok((await s.signin("right-password", T0 + LOCK_MS + 100)).ok);
});

test("sessions verify, expire, and sign out", async () => {
  const s = store();
  const { token } = (await s.signup("Sess", "a-good-password", T0)) as { token: string };
  assert.deepEqual(await s.verify(token, T0 + 1000), { display: "Sess" });
  assert.equal(await s.verify("not-a-real-token", T0 + 1000), null);
  assert.equal(await s.verify(token, T0 + SESSION_TTL_MS + 1), null);
  const again = (await s.signin("a-good-password", T0 + 2000)) as { token: string };
  assert.ok(await s.verify(again.token, T0 + 3000));
  await s.signout(again.token);
  assert.equal(await s.verify(again.token, T0 + 3000), null);
});

test("only the newest sessions are kept", async () => {
  const s = store();
  await s.signup("Many", "a-good-password", T0);
  const tokens: string[] = [];
  for (let i = 0; i < MAX_SESSIONS + 3; i++) tokens.push(((await s.signin("a-good-password", T0 + i * 1000)) as { token: string }).token);
  assert.equal(await s.verify(tokens[0], T0 + 60_000), null);
  assert.ok(await s.verify(tokens[tokens.length - 1], T0 + 60_000));
});

test("the cloud save round-trips and overwrites", async () => {
  const s = store();
  await s.signup("Saver", "a-good-password", T0);
  assert.equal(s.getSave(), null);
  s.putSave('{"kind":"turbz-bundle","v":2,"hunt":{"level":3}}', T0 + 1);
  assert.deepEqual(s.getSave(), { payload: '{"kind":"turbz-bundle","v":2,"hunt":{"level":3}}', updatedAt: T0 + 1 });
  s.putSave('{"hunt":{"level":4}}', T0 + 2);
  assert.equal(s.getSave()?.payload, '{"hunt":{"level":4}}');
});

test("parseCredentials enforces the same rules as the sign-in form", () => {
  assert.deepEqual(parseCredentials({ username: "Abc_123", password: "12345678" }), { username: "Abc_123", password: "12345678" });
  for (const bad of [
    { username: "ab", password: "12345678" },
    { username: "has space", password: "12345678" },
    { username: "x".repeat(17), password: "12345678" },
    { username: "okname", password: "short" },
    { username: "okname", password: "x".repeat(129) },
    { username: 5, password: "12345678" },
    null,
  ]) assert.ok("error" in parseCredentials(bad as any), JSON.stringify(bad));
});

test("parseSave accepts JSON strings within bounds only", () => {
  assert.equal(parseSave({ payload: '{"a":1}' }, 1000), '{"a":1}');
  assert.equal(parseSave({ payload: "not json" }, 1000), null);
  assert.equal(parseSave({ payload: "{}" + " ".repeat(2000) }, 1000), null);
  assert.equal(parseSave({ payload: { a: 1 } }, 1000), null);
  assert.equal(parseSave({}, 1000), null);
});

test("parseSessionCookie only accepts well-formed lowercase user.token", () => {
  const tok = "A".repeat(43);
  assert.deepEqual(parseSessionCookie(`x=1; turbz_session=kyo_01.${tok}; y=2`), { user: "kyo_01", token: tok });
  assert.equal(parseSessionCookie(`turbz_session=KYO.${tok}`), null);
  assert.equal(parseSessionCookie(`turbz_session=kyo.short`), null);
  assert.equal(parseSessionCookie("other=1"), null);
  assert.equal(parseSessionCookie(null), null);
});
