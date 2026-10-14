import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";

/** Rooms re-report every ~15s while occupied; anything older than this is dead. */
const STALE_MS = 45_000;
const MAX_LISTED = 20;

export interface OpenRoom {
  code: string;
  players: number;
  names: string;
}

/**
 * Singleton index of occupied public lobbies (rooms whose id starts with "tz"),
 * powering the "Open lobbies" browser (`GET /api/rtc?list=1`).
 */
export class LobbyRegistry extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS lobbies (
         room TEXT PRIMARY KEY,
         players INTEGER NOT NULL,
         names TEXT NOT NULL,
         updated_at INTEGER NOT NULL
       )`,
    );
  }

  async report(room: string, players: number, names: string): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT INTO lobbies (room, players, names, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(room) DO UPDATE SET players = excluded.players, names = excluded.names, updated_at = excluded.updated_at`,
      room,
      players,
      names,
      Date.now(),
    );
  }

  async remove(room: string): Promise<void> {
    this.ctx.storage.sql.exec(`DELETE FROM lobbies WHERE room = ?`, room);
  }

  async list(): Promise<OpenRoom[]> {
    const sql = this.ctx.storage.sql;
    sql.exec(`DELETE FROM lobbies WHERE updated_at < ?`, Date.now() - STALE_MS);
    const rows = sql
      .exec<{ room: string; players: number; names: string }>(
        `SELECT room, players, names FROM lobbies WHERE players > 0 ORDER BY updated_at DESC LIMIT ?`,
        MAX_LISTED,
      )
      .toArray();
    return rows.map((r) => ({ code: r.room.slice(2).toUpperCase(), players: r.players, names: r.names }));
  }
}
