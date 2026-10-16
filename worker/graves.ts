import { DurableObject } from "cloudflare:workers";
import { GravesStore, type DiscordChannel, type GraveBody, type GraveMode, type GraveRow } from "./graves-store.ts";
import type { Env } from "./env.ts";

/** Global leaderboard. One instance for the whole game. */
export class GravesBoard extends DurableObject<Env> {
  private store: GravesStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new GravesStore(ctx.storage.sql);
  }

  list(mode: GraveMode): GraveRow[] {
    return this.store.list(mode);
  }

  post(username: string, body: GraveBody): void {
    this.store.post(username, body, Date.now());
  }

  setChannel(guildId: string, channelId: string, by: string): void {
    this.store.setChannel(guildId, channelId, by, Date.now());
  }

  channels(): DiscordChannel[] {
    return this.store.channels();
  }

  dropChannel(channelId: string): void {
    this.store.dropChannel(channelId);
  }
}
