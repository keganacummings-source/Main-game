/** Hunt, Hardcore, and Witch Circle keep separate saves, bundled on the signed-in account. */

const ARENA_KEY = "turbz-arena-v1";
const HARD_KEY = "turbz-hardcore-v1";
const META_KEY = "turbz-account-meta-v1";

type Bundle = { kind: "turbz-bundle"; v: 3; hunt: unknown; arena: unknown; hardcore: unknown; meta: unknown };

let hunt: unknown = null;
let arena: unknown = null;
let hardcore: unknown = null;
let meta: unknown = null;
let ready = false;
let writer: ((json: string) => void) | null = null;

export function bindCloud(fn: (json: string) => void): void {
  writer = fn;
}

export function cloudReady(): void {
  ready = true;
  flush();
}

export function noteHunt(save: unknown): void {
  hunt = save;
  flush();
}

export function noteHardcore(save: unknown): void {
  hardcore = save;
  try {
    if (save) localStorage.setItem(HARD_KEY, JSON.stringify(save));
    else localStorage.removeItem(HARD_KEY);
  } catch {
    /* private mode */
  }
  flush();
}

export function noteArena(save: unknown | null): void {
  arena = save;
  try {
    if (save) localStorage.setItem(ARENA_KEY, JSON.stringify(save));
    else localStorage.removeItem(ARENA_KEY);
  } catch {
    /* private mode */
  }
  flush();
}

/** Skills, account level, and permanent bonuses. Shared by Hunt and Hardcore, and kept across death. */
export function readAccountMeta(): Record<string, unknown> | null {
  if (meta && typeof meta === "object") return meta as Record<string, unknown>;
  try {
    const text = localStorage.getItem(META_KEY);
    meta = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    meta = null;
  }
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
}

export function writeAccountMeta(value: Record<string, unknown>): void {
  meta = value;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(value));
  } catch {
    /* private mode */
  }
  flush();
}

export function readArenaLocal(): unknown {
  try {
    const text = localStorage.getItem(ARENA_KEY);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

export function readHardLocal(): unknown {
  try {
    const text = localStorage.getItem(HARD_KEY);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

/** Old accounts stored a bare hunt save. A bundle keeps every mode, plus the shared skill record. */
export function ingestCloud(raw: unknown): { hunt: unknown; arena: unknown; hardcore: unknown } {
  if (raw && typeof raw === "object" && (raw as { kind?: string }).kind === "turbz-bundle") {
    const bundle = raw as Bundle & { v?: number };
    hunt = bundle.hunt ?? null;
    arena = bundle.arena ?? null;
    hardcore = bundle.hardcore ?? readHardLocal();
    if (bundle.meta && typeof bundle.meta === "object") meta = bundle.meta;
    try {
      if (arena) localStorage.setItem(ARENA_KEY, JSON.stringify(arena));
      else localStorage.removeItem(ARENA_KEY);
      if (hardcore) localStorage.setItem(HARD_KEY, JSON.stringify(hardcore));
      if (meta && typeof meta === "object") localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* ignore */
    }
    return { hunt, arena, hardcore };
  }
  hunt = raw ?? null;
  arena = readArenaLocal();
  hardcore = readHardLocal();
  return { hunt, arena, hardcore };
}

function flush(): void {
  if (!ready || !writer) return;
  const json = JSON.stringify({
    kind: "turbz-bundle",
    v: 3,
    hunt: hunt ?? null,
    arena: arena ?? null,
    hardcore: hardcore ?? null,
    meta: meta ?? readAccountMeta(),
  } satisfies Bundle);
  writer(json);
}
