import type { SignalingRoom } from "./room.ts";
import type { UserAccount } from "./account.ts";
import type { GravesBoard } from "./graves.ts";

export interface Env {
  /** Static build output (dist-static). */
  ASSETS: Fetcher;
  /** WebRTC signaling rooms, one per lobby code. */
  ROOMS: DurableObjectNamespace<SignalingRoom>;
  /** One Durable Object per username: password hash, sessions, cloud save. */
  ACCOUNTS: DurableObjectNamespace<UserAccount>;
  /** Global leaderboard of graves (one instance). */
  GRAVES: DurableObjectNamespace<GravesBoard>;
}
