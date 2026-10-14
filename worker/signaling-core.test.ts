import test from "node:test";
import assert from "node:assert/strict";
import {
  RoomState,
  MAX_PEERS,
  MAX_SIGNALS_PER_PEER,
  PEER_TTL_MS,
  SIGNAL_TTL_MS,
  cleanName,
  isJoinError,
  type PollResult,
} from "./signaling-core.ts";
import { parsePoll, parsePost } from "./validate.ts";

const T0 = 1_800_000_000_000;

/** Open a lobby: host registers first, guests can then join. */
function lobby(): RoomState {
  const r = new RoomState();
  const res = r.poll("host", "Host", 0, "host", T0);
  assert.ok(!isJoinError(res));
  return r;
}
const ok = (r: ReturnType<RoomState["poll"]>): PollResult => {
  assert.ok(!isJoinError(r), `unexpected ${JSON.stringify(r)}`);
  return r;
};

test("a guest cannot create a lobby: no host, no room", () => {
  const r = new RoomState();
  assert.deepEqual(r.poll("g", "G", 0, "guest", T0), { error: "no-lobby" });
  assert.equal(r.hasHost(T0), false);
});

test("the host opens a lobby and guests can then join it", () => {
  const r = lobby();
  const res = ok(r.poll("guest", "Guest", 0, "guest", T0 + 1));
  assert.deepEqual(res.peers.map((p) => p.id), ["guest", "host"]);
});

test("a second host cannot take over a live lobby code", () => {
  const r = lobby();
  assert.deepEqual(r.poll("other", "X", 0, "host", T0 + 1), { error: "taken" });
  // the real host can keep polling as host
  assert.ok(!isJoinError(r.poll("host", "Host", 0, "host", T0 + 2)));
});

test("the lobby closes to newcomers once the host expires or leaves, and can be re-hosted", () => {
  const r = lobby();
  ok(r.poll("guest", "G", 0, "guest", T0 + 1));
  r.leave("host");
  assert.deepEqual(r.poll("late", "L", 0, "guest", T0 + 2), { error: "no-lobby" });
  assert.ok(!isJoinError(r.poll("newhost", "H", 0, "host", T0 + 3))); // code is free again

  const r2 = lobby();
  assert.deepEqual(r2.poll("late", "L", 0, "guest", T0 + PEER_TTL_MS + 5), { error: "no-lobby" });
});

test("lobbies hold at most 3 players, host included", () => {
  assert.equal(MAX_PEERS, 3);
  const r = lobby();
  ok(r.poll("g1", "", 0, "guest", T0));
  ok(r.poll("g2", "", 0, "guest", T0));
  assert.deepEqual(r.poll("g3", "", 0, "guest", T0), { error: "full" });
  assert.ok(!isJoinError(r.poll("g1", "", 0, "guest", T0 + 1))); // members keep polling
});

test("signals are delivered once per cursor and ids strictly increase", () => {
  const r = lobby();
  ok(r.poll("b", "B", 0, "guest", T0));
  r.signal("host", "b", "offer", { sdp: "x" }, T0 + 1);
  r.signal("host", "b", "ice", { c: 1 }, T0 + 1);
  r.signal("host", "b", "ice", { c: 2 }, T0 + 1);
  const first = ok(r.poll("b", "B", 0, "guest", T0 + 2));
  assert.deepEqual(first.signals.map((s) => s.kind), ["offer", "ice", "ice"]);
  const ids = first.signals.map((s) => s.id);
  assert.ok(ids[0] < ids[1] && ids[1] < ids[2]);
  assert.equal(ok(r.poll("b", "B", ids[2], "guest", T0 + 3)).signals.length, 0);
  assert.equal(ok(r.poll("host", "Host", 0, "host", T0 + 3)).signals.length, 0);
});

test("ids keep increasing across a simulated restart (clock-seeded)", () => {
  const before = lobby();
  before.signal("a", "b", "offer", 1, T0);
  ok(before.poll("b", "B", 0, "guest", T0));
  const cursor = ok(before.poll("b", "B", 0, "guest", T0)).signals[0].id;
  const after = lobby();
  after.signal("a", "b", "offer", 2, T0 + 5_000);
  ok(after.poll("b", "B", 0, "guest", T0 + 5_000));
  assert.equal(ok(after.poll("b", "B", cursor, "guest", T0 + 5_001)).signals.length, 1);
});

test("stale signals expire", () => {
  const r = lobby();
  r.signal("host", "b", "offer", {}, T0);
  const res = r.poll("host", "H", 0, "host", T0 + SIGNAL_TTL_MS - 1000);
  assert.ok(!isJoinError(res));
  ok(r.poll("b", "B", 0, "guest", T0 + 2000)); // b joins (host still alive)
  assert.equal(ok(r.poll("b", "B", 0, "guest", T0 + 3000)).signals.length, 1);
  r.poll("host", "H", 0, "host", T0 + SIGNAL_TTL_MS + 1);
  assert.equal(ok(r.poll("b", "B", 0, "guest", T0 + SIGNAL_TTL_MS + 2)).signals.length, 0);
});

test("leave removes the peer and its inbox", () => {
  const r = lobby();
  ok(r.poll("b", "B", 0, "guest", T0));
  r.signal("host", "b", "offer", {}, T0);
  r.leave("b");
  assert.deepEqual(r.roster(T0).map((p) => p.id), ["host"]);
  assert.equal(ok(r.poll("b", "B", 0, "guest", T0 + 1)).signals.length, 0);
});

test("per-peer mailbox drops the oldest signal when full", () => {
  const r = lobby();
  for (let i = 0; i < MAX_SIGNALS_PER_PEER + 5; i++) r.signal("host", "b", "ice", { i }, T0 + i);
  ok(r.poll("b", "B", 0, "guest", T0 + 1));
  const got = ok(r.poll("b", "B", 0, "guest", T0 + 1_000)).signals;
  assert.equal(got.length, MAX_SIGNALS_PER_PEER);
  assert.equal((got[0].payload as { i: number }).i, 5);
});

test("cleanName strips control chars and clamps length", () => {
  assert.equal(cleanName("a\nb\u0000c"), "abc");
  assert.equal(cleanName("x".repeat(200)).length, 64);
});

test("parsePoll mirrors the zod schema and adds role", () => {
  const ok = parsePoll(new URLSearchParams({ room: "tzAB12", peer: "p-1", name: "Kyo", since: "42", role: "host" }));
  assert.deepEqual(ok, { room: "tzAB12", peer: "p-1", name: "Kyo", since: 42, role: "host" });
  assert.equal(parsePoll(new URLSearchParams({ room: "bad room", peer: "p" })), null);
  assert.equal(parsePoll(new URLSearchParams({ room: "r", peer: "p", since: "-1" })), null);
  assert.equal(parsePoll(new URLSearchParams({ room: "r", peer: "p", role: "admin" })), null);
  assert.equal(parsePoll(new URLSearchParams({ room: "r", peer: "p", name: "n".repeat(65) })), null);
  assert.deepEqual(parsePoll(new URLSearchParams({ room: "r", peer: "p" })), { room: "r", peer: "p", name: "", since: 0, role: "guest" });
});

test("parsePost validates signal and leave bodies", () => {
  assert.ok(parsePost({ op: "signal", room: "r", from: "a", to: "b", kind: "offer", payload: { sdp: "x" } }));
  assert.ok(parsePost({ op: "signal", room: "r", from: "a", to: "b", kind: "ice", payload: null }));
  assert.ok(parsePost({ op: "leave", room: "r", peer: "a" }));
  assert.equal(parsePost({ op: "signal", room: "r", from: "a", to: "b", kind: "nope", payload: 1 }), null);
  assert.equal(parsePost({ op: "signal", room: "r", from: "a", to: "b", kind: "offer" }), null);
  assert.equal(parsePost({ op: "signal", room: "r", from: "a", to: "b", kind: "offer", payload: "x".repeat(40_000) }), null);
  assert.equal(parsePost({ op: "wat" }), null);
  assert.equal(parsePost(null), null);
});
