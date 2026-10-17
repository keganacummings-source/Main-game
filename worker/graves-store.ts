export type GraveMode = "hunt" | "arena" | "hardcore" | "turbz";

export type GraveBody = {
  mode: GraveMode;
  score: number;
  name: string;
  race: string;
  level: number;
  accountScore: number;
  skills: { name: string; level: number }[];
  gear: unknown[];
  note: string;
  /** Added with the leaderboard remake (season 2). Older rows simply lack them. */
  className?: string;
  cause?: string;
  place?: string;
  effects?: string[];
  ghosts?: unknown[];
  /** Exactly how she looked, so the board can draw her in her real gear and FX. */
  look?: unknown;
};

/** Bump to wipe the board once on the next deploy. Season 2: the leaderboard remake. */
export const BOARD_SEASON = 2;
export type DiscordChannel = { guildId: string; channelId: string };

export type GraveRow = GraveBody & {
  id: number;
  username: string;
  createdAt: string;
  /** Milliseconds since epoch. */
  at?: number;
};

export interface SqlLike {
  exec(query: string, ...bindings: unknown[]): { toArray(): any[] };
}

/** Global leaderboard storage. One Durable Object for all graves. */
export class GravesStore {
  private readonly sql: SqlLike;

  constructor(sql: SqlLike) {
    this.sql = sql;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS graves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        mode TEXT NOT NULL,
        score INTEGER NOT NULL,
        name TEXT NOT NULL,
        race TEXT NOT NULL,
        level INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_graves_mode_score ON graves(mode, score DESC, id ASC)`);
    sql.exec(`DELETE FROM graves WHERE mode = 'arena'`);
    sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS discord_channels (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, set_by TEXT NOT NULL, at INTEGER NOT NULL)`);
    // A new season wipes every grave once.
    const season = Number(sql.exec(`SELECT v FROM meta WHERE k = 'season'`).toArray()[0]?.v ?? 0);
    if (season < BOARD_SEASON) {
      sql.exec(`DELETE FROM graves`);
      sql.exec(`INSERT OR REPLACE INTO meta (k, v) VALUES ('season', ?)`, String(BOARD_SEASON));
    }
  }

  /** /turbzhere: one death channel per Discord server. */
  setChannel(guildId: string, channelId: string, by: string, now: number): void {
    this.sql.exec(`INSERT OR REPLACE INTO discord_channels (guild_id, channel_id, set_by, at) VALUES (?, ?, ?, ?)`, guildId, channelId, by, now);
  }

  channels(): DiscordChannel[] {
    return this.sql.exec(`SELECT guild_id, channel_id FROM discord_channels`).toArray().map((r) => ({ guildId: String(r.guild_id), channelId: String(r.channel_id) }));
  }

  dropChannel(channelId: string): void {
    this.sql.exec(`DELETE FROM discord_channels WHERE channel_id = ?`, channelId);
  }

  list(mode: GraveMode, limit = 100): GraveRow[] {
    if (mode === "arena") return [];
    const rows = this.sql
      .exec(
        `SELECT id, username, mode, score, name, race, level, payload, created_at
         FROM graves WHERE mode = ? ORDER BY score DESC, id ASC LIMIT ?`,
        mode,
        limit,
      )
      .toArray();
    return rows.map((row) => {
      let body: Partial<GraveBody> = {};
      try {
        body = JSON.parse(row.payload) as Partial<GraveBody>;
      } catch {
        /* ignore */
      }
      return {
        id: Number(row.id),
        username: String(row.username),
        mode: mode,
        score: Number(row.score),
        name: String(row.name),
        race: String(row.race),
        level: Number(row.level),
        accountScore: Number(body.accountScore ?? 0),
        skills: Array.isArray(body.skills) ? body.skills : [],
        gear: Array.isArray(body.gear) ? body.gear : [],
        note: String(body.note ?? ""),
        className: typeof body.className === "string" ? body.className : "",
        cause: typeof body.cause === "string" ? body.cause : "",
        place: typeof body.place === "string" ? body.place : "",
        effects: Array.isArray(body.effects) ? body.effects : [],
        ghosts: Array.isArray(body.ghosts) ? body.ghosts : [],
        look: body.look ?? null,
        createdAt: new Date(Number(row.created_at)).toISOString().slice(0, 10),
        at: Number(row.created_at),
      };
    });
  }

  post(username: string, body: GraveBody, now: number): void {
    if (body.mode === "arena") return;
    // Simple rate limit: max 8 graves per user in last 20s
    const recent = this.sql
      .exec(
        `SELECT COUNT(*) as n FROM graves WHERE username = ? AND created_at > ?`,
        username,
        now - 20_000,
      )
      .toArray()[0];
    if (Number(recent?.n ?? 0) >= 8) throw new Error("The ledger needs a breath.");

    this.sql.exec(
      `INSERT INTO graves (username, mode, score, name, race, level, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      username,
      body.mode,
      body.score,
      body.name,
      body.race,
      body.level,
      JSON.stringify(body),
      now,
    );
  }
}
