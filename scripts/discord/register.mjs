#!/usr/bin/env node
/**
 * Registers the TURBZ slash command(s) for the Discord bot, without touching any other command
 * the bot already has, and removes server-level copies of commands that also exist globally
 * (those copies are why a command can show up twice in Discord's / menu).
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
  { name: "turbzhere", description: "Post TURBZ deaths (with a GIF of the fallen witch) in this channel.", default_member_permissions: "32", dm_permission: false },
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

  // Create or update only our commands (POST with an existing name updates it in place).
  for (const cmd of COMMANDS) {
    const r = await call("POST", `/applications/${app}/commands`, cmd);
    if (r.ok) console.log(`Registered /${cmd.name}.`);
    else warn(`Could not register /${cmd.name} (HTTP ${r.status}: ${r.text.slice(0, 300)}).`);
  }

  // Server-level copies of global commands show up twice in the / menu: remove those copies.
  const names = new Set([...global.json.map((c) => c.name), ...COMMANDS.map((c) => c.name)]);
  const guilds = await call("GET", "/users/@me/guilds");
  if (guilds.ok) {
    for (const g of guilds.json) {
      const list = await call("GET", `/applications/${app}/guilds/${g.id}/commands`);
      if (!list.ok) continue;
      for (const c of list.json) {
        if (!names.has(c.name)) continue;
        const d = await call("DELETE", `/applications/${app}/guilds/${g.id}/commands/${c.id}`);
        console.log(d.ok ? `Removed duplicate /${c.name} from server "${g.name}".` : `Could not remove duplicate /${c.name} in "${g.name}" (HTTP ${d.status}).`);
      }
    }
  }
  const after = await call("GET", `/applications/${app}/commands`);
  if (after.ok) console.log(`Global commands now: ${after.json.map((c) => "/" + c.name).join(", ")}`);
} catch (error) {
  warn(`Discord setup failed: ${error instanceof Error ? error.message : error}`);
}
