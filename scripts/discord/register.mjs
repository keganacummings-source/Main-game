#!/usr/bin/env node
/**
 * Sets the Discord bot's slash commands to exactly the TURBZ ones (/turbzhere, /shiny, /turbzboard). Every other global
 * command is removed, and every server-level command (old copies, /tm…) is cleared.
 *
 *   DISCORD_BOT_TOKEN=... node scripts/discord/register.mjs
 *
 * It never fails the deploy: problems are printed as warnings with Discord's own error message.
 */
import { readFileSync } from "node:fs";

const API = "https://discord.com/api/v10";
const token = (process.env.DISCORD_BOT_TOKEN ?? "").trim().replace(/^Bot\s+/i, "");
const warn = (msg) => console.log(`::warning::${msg}`);
if (!token) { warn("DISCORD_BOT_TOKEN is empty; skipping Discord setup."); process.exit(0); }

const toml = readFileSync(new URL("../../wrangler.toml", import.meta.url), "utf8");
const configured = toml.match(/^DISCORD_APP_ID\s*=\s*"(\d+)"/m)?.[1] ?? "";

const COMMANDS = [
  { name: "turbzhere", description: "Post TURBZ deaths and shiny ghost sightings (with GIFs) in this channel.", default_member_permissions: "32", dm_permission: false },
  { name: "shiny", description: "Show a TURBZ player's Shiny collection as a GIF.", options: [{ type: 3, name: "username", description: "Their TURBZ username", required: true, min_length: 3, max_length: 16 }] },
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

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { ok: res.ok, status: res.status, json, text };
}

try {
  const me = await call("GET", "/oauth2/applications/@me");
  if (!me.ok) {
    warn(`Discord refused the bot token (HTTP ${me.status}: ${me.text.slice(0, 200)}). Copy a fresh token from Developer Portal → Bot → Reset Token into the DISCORD_BOT_TOKEN secret.`);
    process.exit(0);
  }
  const app = String(me.json.id);
  console.log(`Bot token belongs to application ${app} (${me.json.name}).`);
  if (configured && configured !== app) warn(`wrangler.toml has DISCORD_APP_ID ${configured} but the token is for ${app}. The Interactions Endpoint and public key must belong to the same app as the token.`);

  const global = await call("GET", `/applications/${app}/commands`);
  if (!global.ok) { warn(`Could not list commands (HTTP ${global.status}: ${global.text.slice(0, 200)}).`); process.exit(0); }
  console.log(`Global commands before: ${global.json.map((c) => "/" + c.name).join(", ") || "none"}`);

  // The bot keeps only the TURBZ commands: overwrite the global list with exactly these.
  const put = await call("PUT", `/applications/${app}/commands`, COMMANDS);
  if (put.ok) console.log(`Global commands set to: ${COMMANDS.map((c) => "/" + c.name).join(", ")}.`);
  else warn(`Could not set the commands (HTTP ${put.status}: ${put.text.slice(0, 300)}).`);

  // Server-level commands (old copies, /tm, etc.) are all removed.
  const guilds = await call("GET", "/users/@me/guilds");
  if (guilds.ok) {
    for (const g of guilds.json) {
      const list = await call("GET", `/applications/${app}/guilds/${g.id}/commands`);
      if (!list.ok || !list.json.length) continue;
      const clear = await call("PUT", `/applications/${app}/guilds/${g.id}/commands`, []);
      console.log(clear.ok ? `Removed ${list.json.length} server command(s) from "${g.name}": ${list.json.map((c) => "/" + c.name).join(", ")}.` : `Could not clear server commands in "${g.name}" (HTTP ${clear.status}).`);
    }
  }
  const after = await call("GET", `/applications/${app}/commands`);
  if (after.ok) console.log(`Global commands now: ${after.json.map((c) => "/" + c.name).join(", ")}`);
} catch (error) {
  warn(`Discord setup failed: ${error instanceof Error ? error.message : error}`);
}
