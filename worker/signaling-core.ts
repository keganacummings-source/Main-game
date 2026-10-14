/**
 * Pure, runtime-agnostic signaling state for one WebRTC room.
 *
 * Lobbies are player-hosted: a room only exists while its host is polling.
 * Guests can only join a room that currently has a live host, so nobody can
 * conjure a server-side lobby by typing a code, and there is no public list.
 *
 * Everything is ephemeral (30s / 60s TTL), so it lives in memory. No
 * Cloudflare imports here so it can be unit tested with plain `node --test`.
 */

export type SignalKind = "offer" | "answer" | "ice";
export type Role = "host" | "guest";
export type JoinError = "full" | "no-lobby" | "taken";

export const PEER_TTL_MS = 30_000;
export const SIGNAL_TTL_MS = 60_000;
/** Hard cap: a lobby never holds more than 3 players (host included). */
export const MAX_PEERS = 3;
export const MAX_SIGNALS_PER_PEER = 200;
export const MAX_SIGNALS_PER_ROOM = 2_000;
export const MAX_NAME_LENGTH = 64;

export interface PeerRow {
  id: string;
  name: string;
}

export interface SignalRow {
  id: number;
  from: string;
  kind: SignalKind;
  payload: unknown;
}

export interface PollResult {
  peers: PeerRow[];
  signals: SignalRow[];
}

export function isJoinError(r: PollResult | { error: JoinError }): r is { error: JoinError } {
  return "error" in r;
}

interface PeerEntry {
  id: string;
  name: string;
  lastSeen: number;
}

interface SignalEntry extends SignalRow {
  to: string;
  createdAt: number;
}

/** Strip control characters and clamp length; names are display-only. */
export function cleanName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, MAX_NAME_LENGTH);
}

export class RoomState {
  private peers = new Map<string, PeerEntry>();
  private signals: SignalEntry[] = [];
  private hostId: string | null = null;
  private lastId = 0;

  /**
   * Signal ids only need to be strictly increasing per room (clients poll with
   * `since=<last id seen>`). Seeding from the clock keeps them increasing even
   * if the Durable Object is evicted and the in-memory counter restarts.
   */
  private nextId(now: number): number {
    this.lastId = Math.max(this.lastId + 1, now);
    return this.lastId;
  }

  prune(now: number): void {
    for (const [id, p] of this.peers) {
      if (now - p.lastSeen > PEER_TTL_MS) this.peers.delete(id);
    }
    if (this.hostId && !this.peers.has(this.hostId)) this.hostId = null;
    this.signals = this.signals.filter((s) => now - s.createdAt <= SIGNAL_TTL_MS);
  }

  /**
   * Register/refresh a peer and return its roster + pending signals.
   *  - host:  opens the lobby (or keeps it open). "taken" if another live host owns the code.
   *  - guest: only allowed while the lobby has a live host. "no-lobby" otherwise.
   *  - "full" when MAX_PEERS players are already in.
   */
  poll(
    peer: string,
    name: string,
    since: number,
    role: Role,
    now: number,
  ): PollResult | { error: JoinError } {
    this.prune(now);
    if (role === "host") {
      if (this.hostId && this.hostId !== peer) return { error: "taken" };
    } else if (!this.hostId) {
      return { error: "no-lobby" };
    }
    if (!this.peers.has(peer) && this.peers.size >= MAX_PEERS) return { error: "full" };
    this.peers.set(peer, { id: peer, name: cleanName(name), lastSeen: now });
    if (role === "host") this.hostId = peer;
    const signals: SignalRow[] = [];
    for (const s of this.signals) {
      if (s.to !== peer || s.id <= since) continue;
      signals.push({ id: s.id, from: s.from, kind: s.kind, payload: s.payload });
      if (signals.length >= 200) break;
    }
    return { peers: this.roster(now), signals };
  }

  signal(from: string, to: string, kind: SignalKind, payload: unknown, now: number): void {
    this.prune(now);
    if (this.signals.length >= MAX_SIGNALS_PER_ROOM) this.signals.shift();
    // Cap each mailbox: drop that peer's oldest entry once it is full.
    let inbox = 0;
    let oldest = -1;
    for (let i = 0; i < this.signals.length; i++) {
      if (this.signals[i].to !== to) continue;
      if (oldest < 0) oldest = i;
      inbox++;
    }
    if (inbox >= MAX_SIGNALS_PER_PEER && oldest >= 0) this.signals.splice(oldest, 1);
    this.signals.push({ id: this.nextId(now), from, to, kind, payload, createdAt: now });
  }

  /** Leaving as host closes the lobby to newcomers; players already linked keep playing. */
  leave(peer: string): void {
    this.peers.delete(peer);
    if (this.hostId === peer) this.hostId = null;
    this.signals = this.signals.filter((s) => s.to !== peer);
  }

  roster(now: number): PeerRow[] {
    const rows: PeerRow[] = [];
    for (const p of this.peers.values()) {
      if (now - p.lastSeen <= PEER_TTL_MS) rows.push({ id: p.id, name: p.name });
    }
    rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return rows.slice(0, MAX_PEERS);
  }

  hasHost(now: number): boolean {
    this.prune(now);
    return this.hostId !== null;
  }
}
