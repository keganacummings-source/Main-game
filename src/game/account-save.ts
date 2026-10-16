/** Hunt, Hardcore, and Witch Circle keep separate saves, bundled on the signed-in account. */
import { mergeAccountMeta, newerSave } from "./account-progress";

const ARENA_KEY = "turbz-arena-v1";
const HARD_KEY = "turbz-hardcore-v1";
const META_KEY = "turbz-account-meta-v1";
const HUNT_KEY = "turbz-v3";

type Bundle = { kind: "turbz-bundle"; v: 3; hunt: unknown; arena: unknown; hardcore: unknown; meta: unknown };

let hunt: unknown = null;
let arena: unknown = null;
let hardcore: unknown = null;
let meta: unknown = null;
let ready = false;
/** Sends one bundle to the cloud. `urgent`: the page is closing (send it the cheapest way, at once). */
type Writer = (payload: string, urgent: boolean) => Promise<boolean> | boolean | void;
let writer: Writer | null = null;

export function bindCloud(fn: Writer): void {
  writer = fn;
}

export function cloudReady(): void {
  ready = true;
  flush();
}

/**
 * Cloud sync status, for the menu: "local" until the first upload, then "synced", "saving" or "failed".
 * Whatever the cloud does, every save is written to this device first and is never thrown away.
 */
export type SyncState = { state: "local" | "saving" | "synced" | "failed"; at: number; fails: number };
let sync: SyncState = { state: "local", at: 0, fails: 0 };
const syncListeners = new Set<(s: SyncState) => void>();
export function syncState(): SyncState {
  return sync;
}
export function onSync(fn: (s: SyncState) => void): () => void {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}
function setSync(next: Partial<SyncState>): void {
  sync = { ...sync, ...next };
  for (const fn of syncListeners) fn(sync);
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

/**
 * The ghost vault: when a witch dies (or is replaced by a new one), every ghost she had — party and Ghost Box —
 * is kept here on the account, per mode, and handed to the next witch of that mode. Ghosts are never lost to death.
 */
export type GhostVault = Partial<Record<"hunt" | "hardcore", unknown[]>>;

export function vaultGhosts(mode: "hunt" | "hardcore", ghosts: unknown[]): void {
  const prev = readAccountMeta() ?? {};
  const vault: GhostVault = { ...((prev.ghostVault as GhostVault) ?? {}) };
  vault[mode] = unionGhosts(vault[mode], ghosts);
  writeAccountMeta({ ...prev, ghostVault: vault });
}

/** Takes (and empties) this mode's vault. */
export function takeVaultGhosts(mode: "hunt" | "hardcore"): unknown[] {
  const prev = readAccountMeta();
  const vault = (prev?.ghostVault as GhostVault | undefined) ?? {};
  const out = Array.isArray(vault[mode]) ? vault[mode]! : [];
  if (prev && out.length) writeAccountMeta({ ...prev, ghostVault: { ...vault, [mode]: [] } });
  return out;
}

/** Joins ghost lists, keeping each uid once (first copy wins). */
export function unionGhosts(...lists: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const g of list) {
      const uid = (g as { uid?: unknown })?.uid;
      if (!g || typeof g !== "object" || typeof uid !== "string" || seen.has(uid)) continue;
      seen.add(uid);
      out.push(g);
    }
  }
  return out;
}

/** Account records that live beside the progress fields and must survive every progress write. */
const KEEP = ["ascensions", "shinies", "ghostVault"] as const;

export function writeAccountMeta(value: Record<string, unknown>): void {
  const prev = readAccountMeta();
  const kept: Record<string, unknown> = {};
  for (const k of KEEP) if (prev && prev[k] !== undefined && value[k] === undefined) kept[k] = prev[k];
  meta = { ...kept, ...value, savedAt: Date.now() };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
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

/** This device's own copies of both witches (used when the cloud cannot be read). */
export function localSaves(): { hunt: unknown; hardcore: unknown } {
  return { hunt: readHuntLocal(), hardcore: readHardLocal() };
}

function readHuntLocal(): unknown {
  try {
    const text = localStorage.getItem(HUNT_KEY);
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
    // The cloud copy can be behind this device (a write cut off when the tab closed, or a slow network):
    // keep whichever witch was saved last, and join the account records so no progress rolls back.
    const localMeta = readAccountMeta();
    hunt = newerSave(bundle.hunt ?? null, readHuntLocal());
    arena = bundle.arena ?? null;
    hardcore = newerSave(bundle.hardcore ?? null, readHardLocal());
    const merged = mergeAccountMeta(localMeta, bundle.meta);
    if (merged) meta = merged;
    try {
      if (arena) localStorage.setItem(ARENA_KEY, JSON.stringify(arena));
      else localStorage.removeItem(ARENA_KEY);
      if (hardcore) localStorage.setItem(HARD_KEY, JSON.stringify(hardcore));
      if (hunt) localStorage.setItem(HUNT_KEY, JSON.stringify(hunt));
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

/**
 * The bundle as it stands. A slot this session never heard about (the cloud could not be read, say) is
 * filled from this device instead of being sent empty, so a bad network day can never wipe a witch.
 */
function bundleJson(): string {
  return JSON.stringify({
    kind: "turbz-bundle",
    v: 3,
    hunt: hunt ?? readHuntLocal(),
    arena: arena ?? readArenaLocal(),
    hardcore: hardcore ?? readHardLocal(),
    meta: meta ?? readAccountMeta(),
  } satisfies Bundle);
}

/** Writes are gathered for a moment, then one upload goes out; a failed upload retries with back-off. */
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let again = false;
const GATHER_MS = 1500;

function flush(): void {
  if (!ready || !writer) return;
  if (timer) return;
  timer = setTimeout(() => { timer = null; void send(false); }, GATHER_MS);
}

async function send(urgent: boolean): Promise<void> {
  if (!writer) return;
  if (inFlight && !urgent) { again = true; return; }
  inFlight = true;
  again = false;
  setSync({ state: "saving" });
  let ok = false;
  try {
    const payload = await packCloud(bundleJson());
    ok = (await writer(payload, urgent)) !== false;
  } catch {
    ok = false;
  }
  inFlight = false;
  if (ok) setSync({ state: "synced", at: Date.now(), fails: 0 });
  else {
    setSync({ state: "failed", fails: sync.fails + 1 });
    // Back off: 5s, 10s, 20s ... up to 2 minutes. The save on this device is already safe.
    const wait = Math.min(120_000, 5000 * 2 ** Math.min(5, sync.fails - 1));
    if (!timer) timer = setTimeout(() => { timer = null; void send(false); }, wait);
  }
  if (again && ok) flush();
}

/** The page is closing: send the bundle now, skipping the gathering pause. */
export function flushNow(): void {
  if (!ready || !writer) return;
  if (timer) { clearTimeout(timer); timer = null; }
  void send(true);
}

/**
 * Cloud payloads are gzipped and base64-encoded ("gz1:" prefix) when the browser can: a whole account
 * shrinks about tenfold, stays far under the server's size limit, and fits a keep-alive upload when the
 * tab closes. Plain JSON (older uploads) still reads fine.
 */
export async function packCloud(json: string): Promise<string> {
  try {
    if (typeof CompressionStream === "undefined") return json;
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `gz1:${btoa(bin)}`;
  } catch {
    return json;
  }
}

export async function unpackCloud(text: string): Promise<string> {
  if (!text.startsWith("gz1:")) return text;
  const bin = atob(text.slice(4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

/**
 * Ascension: wipes every bit of account progress — the TurboHunt witch, the Hardcore witch, TurboCircle,
 * account level, perks, skills and Account Score — here and in the cloud. Only the number of times you
 * have ascended (and the Shiny collection, which is a record rather than power) carries over.
 */
export function wipeAccountProgress(): number {
  const prev = readAccountMeta();
  const ascensions = Math.max(0, Math.floor(Number(prev?.ascensions) || 0)) + 1;
  const shinies = prev?.shinies;
  hunt = null;
  arena = null;
  hardcore = null;
  meta = { ascensions, ...(shinies ? { shinies } : {}) };
  try {
    localStorage.removeItem(ARENA_KEY);
    localStorage.removeItem(HARD_KEY);
    localStorage.removeItem("turbz-v3");
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* private mode */
  }
  flushNow();
  return ascensions;
}

/** How many times this account has ascended. */
export function ascensionCount(): number {
  return Math.max(0, Math.floor(Number(readAccountMeta()?.ascensions) || 0));
}

// ── Shiny collection ────────────────────────────────────────────────────────

/** One shiny ghost this account has picked up. Kept forever (Ascension included): it is a record, not power. */
export type ShinyEntry = {
  uid: string;
  species: string;
  name: string;
  type: string;
  template: number;
  rarity: number;
  level: number;
  speed: number;
  max: number;
  look: unknown;
  at: number;
  mode: string;
  by: string;
  /** Shiny palette id (missing on older entries: the Prism rainbow). */
  palette?: string;
};
export const SHINY_MAX = 400;

export function readShinies(): ShinyEntry[] {
  const list = readAccountMeta()?.shinies;
  return Array.isArray(list) ? (list.filter((s) => s && typeof s === "object" && typeof (s as ShinyEntry).uid === "string") as ShinyEntry[]) : [];
}

/** Adds a shiny to the account's collection. Returns false if it was already there. */
export function noteShiny(entry: ShinyEntry): boolean {
  const list = readShinies();
  if (list.some((s) => s.uid === entry.uid)) return false;
  list.push(entry);
  if (list.length > SHINY_MAX) list.splice(0, list.length - SHINY_MAX);
  meta = { ...(readAccountMeta() ?? {}), shinies: list };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* private mode */
  }
  flush();
  return true;
}
