import assert from "node:assert/strict";
import test from "node:test";
import { decodeGif, deathEmbed, handleInteraction, verifyDiscord } from "./discord.ts";

const hex = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("hex");

async function keys() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = hex(await crypto.subtle.exportKey("raw", pair.publicKey));
  const sign = async (ts: string, body: string) => hex(await crypto.subtle.sign("Ed25519", pair.privateKey, new TextEncoder().encode(ts + body)));
  return { pub, sign };
}

test("Discord signatures are checked with Ed25519", async () => {
  const { pub, sign } = await keys();
  const body = JSON.stringify({ type: 1 });
  const sig = await sign("123", body);
  assert.equal(await verifyDiscord(pub, sig, "123", body), true);
  assert.equal(await verifyDiscord(pub, sig, "124", body), false, "wrong timestamp");
  assert.equal(await verifyDiscord(pub, sig, "123", body + " "), false, "tampered body");
  assert.equal(await verifyDiscord("zz", sig, "123", body), false, "bad key");
});

test("PING is answered, /turbzhere stores the channel, unsigned requests are refused", async () => {
  const { pub, sign } = await keys();
  const env = { DISCORD_PUBLIC_KEY: pub } as any;
  const saved: string[][] = [];
  const store = { setChannel: (g: string, c: string, by: string) => { saved.push([g, c, by]); } };
  const req = async (payload: unknown, good = true) => {
    const body = JSON.stringify(payload);
    const sig = good ? await sign("99", body) : "00".repeat(64);
    return new Request("https://x/api/discord/interactions", { method: "POST", body, headers: { "x-signature-ed25519": sig, "x-signature-timestamp": "99" } });
  };
  const ping = await handleInteraction(await req({ type: 1 }), env, store);
  assert.deepEqual(await ping.json(), { type: 1 });
  const bad = await handleInteraction(await req({ type: 1 }, false), env, store);
  assert.equal(bad.status, 401);
  const cmd = await handleInteraction(await req({ type: 2, data: { name: "turbzhere" }, guild_id: "g1", channel_id: "c1", member: { user: { username: "kegan" } } }), env, store);
  const out = (await cmd.json()) as any;
  assert.equal(out.type, 4);
  assert.deepEqual(saved, [["g1", "c1", "kegan"]]);
});

test("death embeds carry level, class, cause and effects; GIF uploads are checked", () => {
  const e = deathEmbed({ mode: "hardcore", name: "Vell", username: "kegan", className: "Bulwark", race: "Vesper", level: 42, score: 1234, cause: "Killed by Sera Coil", place: "Hearthmere", effects: ["Demon Wings"], ghosts: [{ name: "Onibi", level: 40, shiny: true }], topSkills: [{ name: "Mining", level: 9 }], gear: [{ slot: "chest", name: "Robe", quality: "Legendary" }] }, true) as any;
  assert.match(e.title, /Vell/);
  assert.ok(e.fields.some((f: any) => f.name === "Level" && f.value === "42"));
  assert.ok(e.fields.some((f: any) => f.name === "Effects" && /Demon Wings/.test(f.value)));
  assert.equal(e.image.url, "attachment://death.gif");
  const turbz = deathEmbed({ mode: "turbz", name: "Vell", username: "kegan", className: "Bulwark", race: "Vesper", level: 12, score: 800, cause: "Killed by a witch", place: "TURBZ", effects: [], ghosts: [], topSkills: [], gear: [] }, false) as any;
  assert.match(turbz.description, /TURBZ/);
  assert.equal(turbz.color, 0x7a5cff);
  assert.ok(turbz.fields.some((f: any) => f.name === "Mode" && f.value === "TURBZ"));
  assert.equal(decodeGif(Buffer.from("GIF89a-not-really-but-header-ok").toString("base64"))?.[0], 0x47);
  assert.equal(decodeGif(Buffer.from("PNG nope nope nope nope").toString("base64")), null);
});

test("the new season wipes every old grave once, and death channels are kept per server", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { GravesStore } = await import("./graves-store.ts");
  const db = new DatabaseSync(":memory:");
  const sql = {
    exec(q: string, ...b: unknown[]) {
      const stmt = db.prepare(q);
      if (/^\s*select/i.test(q)) { const rows = stmt.all(...(b as any[])); return { toArray: () => rows as any[] }; }
      stmt.run(...(b as any[]));
      return { toArray: () => [] };
    },
  };
  // An old board (season 1, no meta table) with graves on it.
  db.exec(`CREATE TABLE graves (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, mode TEXT NOT NULL, score INTEGER NOT NULL, name TEXT NOT NULL, race TEXT NOT NULL, level INTEGER NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  db.exec(`INSERT INTO graves (username, mode, score, name, race, level, payload, created_at) VALUES ('a','hunt',5,'Old','Vesper',3,'{}',1)`);
  const s1 = new GravesStore(sql);
  assert.equal(s1.list("hunt").length, 0, "wiped");
  s1.post("kegan", { mode: "hunt", score: 9, name: "New", race: "Vesper", level: 4, accountScore: 0, skills: [], gear: [], note: "", cause: "Killed by a boar" }, 10_000);
  const s2 = new GravesStore(sql);
  const rows = s2.list("hunt");
  assert.equal(rows.length, 1, "only wiped once");
  assert.equal(rows[0]!.cause, "Killed by a boar");
  s2.setChannel("g1", "c1", "kegan", 1);
  s2.setChannel("g1", "c2", "kegan", 2);
  assert.deepEqual(s2.channels(), [{ guildId: "g1", channelId: "c2" }], "one channel per server, latest wins");
  s2.dropChannel("c2");
  assert.deepEqual(s2.channels(), []);
  s2.post("kegan", { mode: "turbz", score: 40, name: "Mira", race: "Vesper", level: 6, accountScore: 0, skills: [], gear: [], note: "Died in TURBZ.", className: "Bulwark" }, 20_000);
  const board = s2.list("turbz");
  assert.equal(board.length, 1);
  assert.equal(board[0]!.name, "Mira");
  assert.equal(s2.list("hunt").length, 1, "TURBZ does not land on the Hunt board");
});

test("/shiny username answers with the collection GIF, or says who has none", async () => {
  const { pub, sign } = await keys();
  const env = { DISCORD_PUBLIC_KEY: pub } as any;
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2, 3]);
  const store = {
    setChannel: () => {},
    shinies: (name: string) => (name === "kegan" ? { display: "Kegan", count: 2, names: ["Onibi Lv 4", "Yuki Lv 9"], gif } : name === "empty" ? { display: "Empty", count: 0, names: [], gif: null } : null),
  };
  const ask = async (username: string) => {
    const body = JSON.stringify({ type: 2, data: { name: "shiny", options: [{ name: "username", type: 3, value: username }] } });
    return handleInteraction(new Request("https://x/api/discord/interactions", { method: "POST", body, headers: { "x-signature-ed25519": await sign("7", body), "x-signature-timestamp": "7" } }), env, store);
  };
  const ok = await ask("kegan");
  const form = await ok.formData();
  const payload = JSON.parse(String(form.get("payload_json")));
  assert.equal(payload.type, 4);
  assert.match(payload.data.embeds[0].title, /Kegan/);
  assert.equal(payload.data.embeds[0].image.url, "attachment://shinies.gif");
  const file = form.get("files[0]") as Blob;
  assert.equal(new Uint8Array(await file.arrayBuffer())[0], 0x47);
  assert.match(((await (await ask("empty")).json()) as any).data.content, /not caught a shiny/);
  assert.match(((await (await ask("nobody")).json()) as any).data.content, /No TURBZ account/);
});

test("/turbzboard lists the TURBZ board, and defaults to it", async () => {
  const { pub, sign } = await keys();
  const env = { DISCORD_PUBLIC_KEY: pub } as any;
  const store = {
    setChannel: () => {},
    board: (mode: string) => mode === "turbz" ? [{ name: "Mira", username: "kegan", level: 8, score: 420, className: "Bulwark" }] : [],
  };
  const ask = async (mode?: string) => {
    const data: { name: string; options?: { name: string; type: number; value: string }[] } = { name: "turbzboard" };
    if (mode) data.options = [{ name: "mode", type: 3, value: mode }];
    const body = JSON.stringify({ type: 2, data });
    return handleInteraction(new Request("https://x/api/discord/interactions", { method: "POST", body, headers: { "x-signature-ed25519": await sign("8", body), "x-signature-timestamp": "8" } }), env, store);
  };
  const top = (await (await ask()).json()) as any;
  assert.match(top.data.embeds[0].title, /TURBZ/);
  assert.match(top.data.embeds[0].description, /Mira/);
  assert.match(top.data.embeds[0].description, /420/);
  const empty = (await (await ask("hardcore")).json()) as any;
  assert.match(empty.data.content, /Hardcore/);
  assert.match(empty.data.content, /empty/);
});

test("a shiny sighting embed says who saw which ghost, with its GIF", async () => {
  const { shinySeenEmbed } = await import("./discord.ts");
  const e = shinySeenEmbed({ username: "kegan", witch: "Mira", name: "Onibi", species: "onibi", level: 12, type: "fire", place: "Hearthmere", mode: "hunt" }, true) as any;
  assert.match(e.title, /Shiny Ghost Seen: Onibi/);
  assert.match(e.description, /Mira/);
  assert.match(e.description, /kegan/);
  assert.equal(e.image.url, "attachment://shiny.gif");
});
