/**
 * Discord bot for TURBZ deaths.
 *
 *  - /api/discord/interactions is the bot's Interactions Endpoint URL. Discord signs every request
 *    with Ed25519; we verify it against DISCORD_PUBLIC_KEY before doing anything.
 *  - /turbzhere (needs Manage Server) makes the channel it is used in the server's death channel.
 *  - When a witch dies, the game uploads a GIF of her and we post it with her level, class, cause
 *    of death and effects to every registered channel, as the bot (DISCORD_BOT_TOKEN).
 *  - /shiny username answers with a GIF of every shiny ghost that account has ever picked up.
 *  - Whenever a shiny ghost drops for a player, a "Shiny Ghost Seen" GIF is posted with who saw it.
 */
import type { Env } from "./env.ts";

const API = "https://discord.com/api/v10";

export const TURBZ_COMMANDS = [
  {
    name: "turbzhere",
    description: "Post TURBZ deaths and shiny ghost sightings (with GIFs) in this channel.",
    default_member_permissions: "32", // Manage Server
    dm_permission: false,
  },
  {
    name: "shiny",
    description: "Show a TURBZ player's Shiny collection as a GIF.",
    options: [{ type: 3, name: "username", description: "Their TURBZ username", required: true, min_length: 3, max_length: 16 }],
  },
  {
    name: "turbzboard",
    description: "Show the top of a leaderboard. Defaults to the TURBZ mode.",
    options: [{
      type: 3,
      name: "mode",
      description: "Which board",
      required: false,
      choices: [
        { name: "TURBZ", value: "turbz" },
        { name: "Hunt", value: "hunt" },
        { name: "Hardcore", value: "hardcore" },
      ],
    }],
  },
];

/** What /shiny shows for one account. */
export type ShinyCard = { display: string; count: number; names: string[]; gif: Uint8Array | null };

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Ed25519 check of Discord's signature over timestamp + body. */
export async function verifyDiscord(publicKeyHex: string, signatureHex: string, timestamp: string, body: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(publicKeyHex) || !/^[0-9a-f]{128}$/i.test(signatureHex) || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hexToBytes(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hexToBytes(signatureHex), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

function reply(content: string, ephemeral = false): Response {
  return new Response(JSON.stringify({ type: 4, data: { content, flags: ephemeral ? 64 : 0, allowed_mentions: { parse: [] } } }), {
    headers: { "content-type": "application/json" },
  });
}

type BoardLine = { name: string; username: string; level: number; score: number; className?: string };

type ChannelStore = {
  setChannel(guildId: string, channelId: string, by: string): Promise<void> | void;
  /** Looks up an account's Shiny collection by username (null: no such account). */
  shinies?(username: string): Promise<ShinyCard | null> | ShinyCard | null;
  /** Top of one leaderboard, best score first. */
  board?(mode: string): Promise<BoardLine[]> | BoardLine[];
};

/** The /shiny answer: an embed with the collection GIF attached (multipart), or a plain line. */
export function shinyReply(name: string, card: ShinyCard | null): Response {
  if (!card) return reply(`No TURBZ account called **${name.slice(0, 16)}**.`, true);
  if (!card.count) return reply(`**${card.display}** has not caught a shiny yet. ✦`);
  const embed = {
    title: `✦ ${card.display}'s Shiny collection ✦`,
    description: `${card.count} shiny ghost${card.count === 1 ? "" : "s"} picked up.`,
    color: 0xff7ae0,
    fields: [{ name: "Newest", value: card.names.slice(0, 12).join(" · ").slice(0, 1000) || "—", inline: false }],
    ...(card.gif ? { image: { url: "attachment://shinies.gif" } } : {}),
    footer: { text: "TURBZ · dreamdaw.com" },
  };
  const data = { embeds: [embed], allowed_mentions: { parse: [] }, ...(card.gif ? { attachments: [{ id: 0, filename: "shinies.gif" }] } : {}) };
  if (!card.gif) return new Response(JSON.stringify({ type: 4, data }), { headers: { "content-type": "application/json" } });
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ type: 4, data }));
  form.append("files[0]", new Blob([card.gif], { type: "image/gif" }), "shinies.gif");
  return new Response(form);
}

export async function handleInteraction(request: Request, env: Env, store: ChannelStore): Promise<Response> {
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await request.text();
  const ok = await verifyDiscord(env.DISCORD_PUBLIC_KEY ?? "", request.headers.get("x-signature-ed25519") ?? "", request.headers.get("x-signature-timestamp") ?? "", body);
  if (!ok) return new Response("invalid request signature", { status: 401 });
  let msg: any;
  try {
    msg = JSON.parse(body);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (msg.type === 1) return new Response(JSON.stringify({ type: 1 }), { headers: { "content-type": "application/json" } });
  if (msg.type === 2 && msg.data?.name === "turbzhere") {
    if (!msg.guild_id || !msg.channel_id) return reply("Use /turbzhere in a server channel.", true);
    const by = msg.member?.user?.username ?? msg.user?.username ?? "someone";
    await store.setChannel(String(msg.guild_id), String(msg.channel_id), String(by));
    const warn = env.DISCORD_BOT_TOKEN ? "" : "\n(The bot token is not set up on the game server yet, so posts start once it is.)";
    return reply(`🪦 Deaths will be posted here, tagged Hunt, Hardcore, or TURBZ. Every witch who falls shows up with a GIF, her level and her effects. /turbzboard shows the board.${warn}`);
  }
  if (msg.type === 2 && msg.data?.name === "shiny") {
    const opt = (msg.data?.options ?? []).find((o: { name?: string }) => o?.name === "username");
    const name = String(opt?.value ?? "").trim();
    if (!name) return reply("Usage: /shiny username", true);
    const card = store.shinies ? await store.shinies(name) : null;
    return shinyReply(name, card);
  }
  if (msg.type === 2 && msg.data?.name === "turbzboard") {
    const opt = (msg.data?.options ?? []).find((o: { name?: string }) => o?.name === "mode");
    const mode = opt?.value === "hunt" || opt?.value === "hardcore" || opt?.value === "turbz" ? opt.value : "turbz";
    const rows = store.board ? await store.board(mode) : [];
    return boardReply(mode, rows);
  }
  if (msg.type === 2 && msg.data?.name === "tm") return reply("TURBZ global chat is closed right now; live play happens in lobbies inside the game.", true);
  return reply("Unknown command.", true);
}

export type DeathPost = {
  mode: string;
  name: string;
  username: string;
  className: string;
  race: string;
  level: number;
  score: number;
  cause: string;
  place: string;
  effects: string[];
  ghosts: { name: string; level: number; shiny: boolean }[];
  topSkills: { name: string; level: number }[];
  gear: { slot: string; name: string; quality: string }[];
};

const QUALITY_COLOR: Record<string, number> = { legendary: 0xffa53a, epic: 0xb46aff, rare: 0x4aa8ff, fine: 0x6ecf6a };

export function modeLabel(mode: string): string {
  if (mode === "turbz") return "TURBZ";
  if (mode === "hardcore") return "Hardcore";
  return "Hunt";
}

export function boardReply(mode: string, rows: BoardLine[]): Response {
  const label = modeLabel(mode);
  const color = mode === "turbz" ? 0x7a5cff : mode === "hardcore" ? 0xc4473a : 0xe6c15a;
  if (!rows.length) return reply(`The **${label}** board is empty. No one has fallen there yet.`);
  const lines = rows.slice(0, 10).map((r, i) => {
    const who = `${r.className ? `${r.className} · ` : ""}**${r.name}** Lv ${r.level} · ${r.score.toLocaleString("en-US")} · ${r.username}`;
    return `**${i + 1}.** ${who}`;
  });
  const embed = {
    title: `${label} leaderboard`,
    description: lines.join("\n").slice(0, 4000),
    color,
    footer: { text: "TURBZ · dreamdaw.com" },
  };
  return new Response(JSON.stringify({ type: 4, data: { embeds: [embed], allowed_mentions: { parse: [] } } }), {
    headers: { "content-type": "application/json" },
  });
}

export function deathEmbed(d: DeathPost, hasGif: boolean): Record<string, unknown> {
  const best = d.gear.find((g) => g.quality.toLowerCase() === "legendary") ?? d.gear.find((g) => g.quality.toLowerCase() === "epic") ?? d.gear[0];
  const color = d.mode === "turbz" ? 0x7a5cff : d.mode === "hardcore" ? 0xc4473a : QUALITY_COLOR[best?.quality.toLowerCase() ?? ""] ?? 0xe6c15a;
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Level", value: String(d.level), inline: true },
    { name: "Class", value: `${d.className || "Witch"} · ${d.race}`, inline: true },
    { name: "Score", value: d.score.toLocaleString("en-US"), inline: true },
    { name: "Mode", value: modeLabel(d.mode), inline: true },
  ];
  if (d.cause) fields.push({ name: "Cause of death", value: d.cause.slice(0, 200), inline: false });
  if (d.place) fields.push({ name: "Fell in", value: d.place.slice(0, 100), inline: true });
  if (d.effects.length) fields.push({ name: "Effects", value: d.effects.slice(0, 10).join(" · ").slice(0, 1000), inline: false });
  if (d.ghosts.length) fields.push({ name: "Ghosts", value: d.ghosts.slice(0, 6).map((g) => `${g.shiny ? "✦ " : ""}${g.name} Lv ${g.level}`).join(" · ").slice(0, 1000), inline: false });
  if (d.gear.length) fields.push({ name: "Wore", value: d.gear.slice(0, 6).map((g) => `${g.name} (${g.quality})`).join("\n").slice(0, 1000), inline: false });
  if (d.topSkills.length) fields.push({ name: "Best skills", value: d.topSkills.slice(0, 5).map((s) => `${s.name} ${s.level}`).join(" · ").slice(0, 1000), inline: false });
  return {
    title: `🪦 ${d.name} has fallen`,
    description: `**${modeLabel(d.mode)}** · Played by **${d.username}**`,
    color,
    fields,
    ...(hasGif ? { image: { url: "attachment://death.gif" } } : {}),
    footer: { text: "TURBZ · dreamdaw.com" },
    timestamp: new Date().toISOString(),
  };
}

/** Posts the death to every channel set up with /turbzhere. Channels the bot lost access to are dropped. */
export async function postDeath(env: Env, channels: { channelId: string }[], d: DeathPost, gif: Uint8Array | null, drop: (channelId: string) => Promise<void> | void): Promise<void> {
  const token = env.DISCORD_BOT_TOKEN;
  if (!token || !channels.length) return;
  const embed = deathEmbed(d, !!gif);
  await Promise.all(channels.map(async ({ channelId }) => {
    try {
      const form = new FormData();
      form.append("payload_json", JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] }, ...(gif ? { attachments: [{ id: 0, filename: "death.gif" }] } : {}) }));
      if (gif) form.append("files[0]", new Blob([gif], { type: "image/gif" }), "death.gif");
      const res = await fetch(`${API}/channels/${channelId}/messages`, { method: "POST", headers: { authorization: `Bot ${token}` }, body: form });
      if (res.status === 403 || res.status === 404) await drop(channelId);
      else if (!res.ok) console.error("[discord] post failed", res.status, (await res.text()).slice(0, 300));
    } catch (error) {
      console.error("[discord] post error", error);
    }
  }));
}

/** Decodes the GIF the game uploads (base64, at most ~2 MB). */
export function decodeGif(b64: unknown): Uint8Array | null {
  if (typeof b64 !== "string" || b64.length < 20 || b64.length > 2_800_000) return null;
  try {
    const bin = atob(b64.replace(/^data:image\/gif;base64,/, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    // GIF87a / GIF89a header.
    if (out[0] !== 0x47 || out[1] !== 0x49 || out[2] !== 0x46) return null;
    return out;
  } catch {
    return null;
  }
}

export type ShinySeenPost = { username: string; witch: string; name: string; species: string; level: number; type: string; place: string; mode: string };

export function shinySeenEmbed(d: ShinySeenPost, hasGif: boolean): Record<string, unknown> {
  return {
    title: `✦ Shiny Ghost Seen: ${d.name} ✦`,
    description: `**${d.witch}** (played by **${d.username}**) just saw a shiny ${d.name} drop${d.place ? ` in ${d.place}` : ""}.`,
    color: 0xff7ae0,
    fields: [
      { name: "Level", value: String(d.level), inline: true },
      ...(d.type ? [{ name: "Element", value: d.type.slice(0, 16), inline: true }] : []),
      { name: "Mode", value: modeLabel(d.mode), inline: true },
    ],
    ...(hasGif ? { image: { url: "attachment://shiny.gif" } } : {}),
    footer: { text: "TURBZ · dreamdaw.com" },
    timestamp: new Date().toISOString(),
  };
}

/** Posts a "Shiny Ghost Seen" card (with the ghost's GIF) to every channel set up with /turbzhere. */
export async function postShinySeen(env: Env, channels: { channelId: string }[], d: ShinySeenPost, gif: Uint8Array | null, drop: (channelId: string) => Promise<void> | void): Promise<void> {
  const token = env.DISCORD_BOT_TOKEN;
  if (!token || !channels.length) return;
  const embed = shinySeenEmbed(d, !!gif);
  await Promise.all(channels.map(async ({ channelId }) => {
    try {
      const form = new FormData();
      form.append("payload_json", JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] }, ...(gif ? { attachments: [{ id: 0, filename: "shiny.gif" }] } : {}) }));
      if (gif) form.append("files[0]", new Blob([gif], { type: "image/gif" }), "shiny.gif");
      const res = await fetch(`${API}/channels/${channelId}/messages`, { method: "POST", headers: { authorization: `Bot ${token}` }, body: form });
      if (res.status === 403 || res.status === 404) await drop(channelId);
      else if (!res.ok) console.error("[discord] shiny post failed", res.status, (await res.text()).slice(0, 300));
    } catch (error) {
      console.error("[discord] shiny post error", error);
    }
  }));
}
