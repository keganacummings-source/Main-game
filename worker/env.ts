import type { UserAccount } from "./account.ts";
import type { GravesBoard } from "./graves.ts";

export interface Env {
  /** Static build output (dist-static). */
  ASSETS: Fetcher;
  /** One Durable Object per username: password hash, sessions, cloud save. */
  ACCOUNTS: DurableObjectNamespace<UserAccount>;
  /** Global leaderboard of graves (one instance). Also keeps the Discord death channels. */
  GRAVES: DurableObjectNamespace<GravesBoard>;
  /** Discord application (not secret, set in wrangler.toml [vars]). */
  DISCORD_APP_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
  /** Discord bot token (secret: `wrangler secret put DISCORD_BOT_TOKEN`, done by the deploy workflow). */
  DISCORD_BOT_TOKEN?: string;
}
