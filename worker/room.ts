import { DurableObject } from "cloudflare:workers";
import {
  RoomState,
  type JoinError,
  type PollResult,
  type Role,
  type SignalKind,
} from "./signaling-core.ts";
import type { Env } from "./env.ts";

/**
 * One Durable Object per room code. Holds the roster and SDP/ICE mailbox in
 * memory — all of it expires within a minute, and clients re-register on their
 * next poll, so nothing needs to survive eviction.
 */
export class SignalingRoom extends DurableObject<Env> {
  private state = new RoomState();

  async poll(
    peer: string,
    name: string,
    since: number,
    role: Role,
  ): Promise<PollResult | { error: JoinError }> {
    return this.state.poll(peer, name, since, role, Date.now());
  }

  async signal(from: string, to: string, kind: SignalKind, payload: unknown): Promise<void> {
    this.state.signal(from, to, kind, payload, Date.now());
  }

  async leave(peer: string): Promise<void> {
    this.state.leave(peer);
  }
}
