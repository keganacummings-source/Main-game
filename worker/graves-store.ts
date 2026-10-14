export type GraveMode = "hunt" | "arena" | "hardcore";

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
};

export type GraveRow = GraveBody & {
  id: number;
  username: string;
  createdAt: string;
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
  }

  list(mode: GraveMode, limit = 40): GraveRow[] {
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
        createdAt: new Date(Number(row.created_at)).toISOString().slice(0, 10),
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
