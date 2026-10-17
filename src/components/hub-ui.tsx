import { useEffect, useRef, useState } from "react";
import { staticSignOut, useStaticAccount } from "@/lib/auth/static-account";
import { answerFriend, ensureProfile, listFriends, listGraves, requestFriend } from "@/game/social-client";
import type { FriendRow, GraveMode, GraveRow } from "@/game/social-types";
import type { TypeId } from "@/game/content";
import type { RaceId } from "@/game/content";
import { initActorSprites, tryDrawActorSprite } from "@/game/actor-sprites";
import { drawMonster } from "@/game/sprites";
import { drawGhostFx } from "@/game/ghost-fx";
import type { ActorDraw } from "@/game/sprites";
import { Chips, Empty, Screen, Tabs, Tile } from "./ui-kit";
import { ascensionCount, readShinies, type ShinyEntry } from "@/game/account-save";
import { drawShiny } from "@/game/shiny-gif";

const Q_NUM: Record<string, number> = {
  worn: 1,
  common: 2,
  fine: 3,
  rare: 4,
  epic: 5,
  legendary: 6,
};

const RACES: RaceId[] = ["vesper", "cinder", "tide", "thorn", "rime"];
const TYPES: TypeId[] = [
  "normal",
  "fire",
  "water",
  "earth",
  "air",
  "electric",
  "ice",
  "void",
  "light",
  "spirit",
  "ghoul",
];

function raceId(raw: string): RaceId {
  const k = raw.toLowerCase();
  return (RACES.find((r) => r === k || k.includes(r)) ?? "vesper") as RaceId;
}

function typeId(raw: string): TypeId {
  const k = raw.toLowerCase();
  return (TYPES.find((t) => t === k || k.includes(t)) ?? "normal") as TypeId;
}

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/** A live portrait of a fallen witch: her real gear, gear FX and set aura, with her ghosts circling. */
function GravePortrait({ row }: { row: GraveRow }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stop = false;
    let raf = 0;
    const canvas = ref.current;
    if (!canvas) return;
    const W = 160;
    const H = 170;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const look = row.look;
    // Graves from before the remake carry no look; rebuild an approximation from their gear list.
    const pieces: ActorDraw["pieces"] = look?.pieces?.length
      ? look.pieces.map((p) => ({ ...p, type: typeId(p.type) }))
      : row.gear.map((g, i) => ({
          slot: g.slot,
          style: (seedFrom(g.name + g.slot) % 6) + 1,
          type: typeId(g.type),
          fxSeed: seedFrom(g.name + String(i) + row.id),
          quality: Math.max(0, (Q_NUM[g.quality.toLowerCase()] ?? 2) - 1),
        }));
    const actor: ActorDraw = {
      x: W / 2,
      y: H - 30,
      race: raceId(look?.race ?? row.race),
      female: look ? look.female : seedFrom(row.name) % 2 === 0,
      hair: look?.hair ?? seedFrom(row.username) % 5,
      skin: look?.skin ?? seedFrom(row.name + row.race) % 5,
      tall: look?.tall,
      facing: 1,
      direction: "down",
      moving: true,
      walk: 0,
      attack: 0,
      hurt: 0,
      pieces,
      setFx: (look?.setFx as ActorDraw["setFx"]) ?? null,
      setOn: !!look?.setOn,
      setVariant: look?.setVariant ?? 0,
      scale: 1.9,
      classId: look?.classId,
      time: 0,
    };
    const ghosts = (row.ghosts ?? []).slice(0, 3);
    const t0 = performance.now();

    void initActorSprites()
      .catch(() => {})
      .finally(() => {
        const tick = (now: number) => {
          if (stop) return;
          const t = (now - t0) / 1000;
          actor.walk = (t * 2.2) % 4;
          actor.time = t;
          ctx.fillStyle = "#0c0a10";
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#1a1520";
          ctx.beginPath();
          ctx.ellipse(W / 2, H - 28, 52, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          const spots = [[-54, -8], [54, -8], [0, -78]];
          const orbit = ghosts.map((g, i) => ({
            g,
            x: W / 2 + spots[i]![0]! + Math.sin(t * 1.3 + i) * 4,
            y: H - 30 + spots[i]![1]! + Math.sin(t * 2.1 + i * 2) * 4,
            depth: i === 2 ? -1 : 1,
          }));
          const ghost = (o: (typeof orbit)[number]) => {
            const fx = { x: o.x, y: o.y, type: typeId(o.g.type), rarity: o.g.rarity, level: o.g.level, speed: 10 + o.g.level, max: 20 + o.g.level * 10, shiny: o.g.shiny, seed: `${row.id}-${o.g.name}` };
            drawGhostFx(ctx, fx, t, "back");
            drawMonster(ctx, { x: o.x, y: o.y, template: 0, type: typeId(o.g.type), facing: o.x < W / 2 ? 1 : -1, walk: t * 3, hurt: 0, boss: false, rarity: o.g.rarity, ghost: true, shiny: o.g.shiny, time: t });
            drawGhostFx(ctx, fx, t, "front");
          };
          for (const o of orbit) if (o.depth < 0) ghost(o);
          if (!tryDrawActorSprite(ctx, actor)) {
            ctx.fillStyle = "#6a5a70";
            ctx.fillRect(W / 2 - 10, H - 80, 20, 48);
          }
          for (const o of orbit) if (o.depth >= 0) ghost(o);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [row]);

  return (
    <canvas
      ref={ref}
      width={160}
      height={170}
      className="grave-portrait"
      style={{ imageRendering: "pixelated", width: 160, height: 170 }}
      aria-label={`${row.name}, as she fell`}
    />
  );
}


export function AccountChip() {
  const { user } = useStaticAccount();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-dim">{user.displayName}</span>
      <button type="button"
        className="px-btn ui-btn-sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void staticSignOut().finally(() => setBusy(false));
        }}
      >
        Logout
      </button>
    </span>
  );
}

export function Hub(props: {
  username: string;
  onHunt: () => void;
  onCircle: () => void;
  onLms: () => void;
  onTurbz: () => void;
  onHard: () => void;
  onBoards: () => void;
  onOptions: () => void;
  onDesigner: () => void;
  onShinies: () => void;
  onAscend: () => number;
}) {
  const [busy, setBusy] = useState(false);
  const [ascend, setAscend] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState("");
  const [asc, setAsc] = useState(() => ascensionCount());
  const shinyCount = readShinies().length;
  return (
    <Screen kicker={`V.2COMBAT · SIGNED IN · ${props.username}${asc ? ` · ASCENSION ${roman(asc)}` : ""}`} title="V.2COMBAT">
      <p className="text-dim">Pick a veil. The dead keep the score.</p>
      {ascend > 0 && (
        <div className="loot-overlay" role="dialog" aria-label="Ascension" data-testid="ascend-dialog">
          <div className="px-panel loot-panel ui-stack">
            <p className="font-display text-sm text-blood">⚠ ASCENSION</p>
            {ascend === 1 ? (
              <>
                <p>Ascending <span className="text-blood">wipes ALL of your account progress</span>, here and in the cloud:</p>
                <ul className="text-dim">
                  <li>· Your TurboHunt witch and your Hardcore witch</li>
                  <li>· Account level, perks, perk points and Account Score</li>
                  <li>· Every skill level, unlocked sets, gear, spirits and the Ghost Box</li>
                  <li>· Quest progress on every world, and your TurboCircle record</li>
                </ul>
                <p className="text-dim">Kept: your account, friends, maps you made, your Shiny collection, and the count of times you have ascended. This cannot be undone.</p>
                <div className="screen-actions">
                  <button type="button" className="px-btn" data-testid="ascend-cancel" onClick={() => setAscend(0)}>Keep my progress</button>
                  <button type="button" className="px-btn px-btn-blood" data-testid="ascend-next" onClick={() => { setTyped(""); setAscend(2); }}>I understand, continue</button>
                </div>
              </>
            ) : (
              <>
                <p>Last warning. Type <span className="font-display text-blood">ASCEND</span> to wipe everything and start over.</p>
                <input className="px-input font-display" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, 10))} placeholder="ASCEND" aria-label="Type ASCEND" data-testid="ascend-input" autoFocus />
                <div className="screen-actions">
                  <button type="button" className="px-btn" onClick={() => setAscend(0)}>Cancel</button>
                  <button type="button" className="px-btn px-btn-blood" data-testid="ascend-go" disabled={typed !== "ASCEND"} onClick={() => { setAsc(props.onAscend()); setAscend(0); }}>Ascend</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="tile-grid">
        <Tile primary title="TurboHunt" about="Explore the wilds, take bounties, climb the ladder." onClick={props.onHunt} />
        <Tile title="TURBZ" about="Hardcore wild. Level 1, no bounties. Other witches grind, craft and team up." onClick={props.onTurbz} badge="NEW" />
        <Tile title="Hardcore" about="Hunger, thirst, nights that get worse. One life." onClick={props.onHard} badge="HARD" />
        <Tile title="Last Man Standing" about="You and 99 rival witches from level 1. Always night, only ghosts. Be the last one alive." onClick={props.onLms} badge="NEW" />
        <Tile title="TurboCircle" about="Battle simulator: Classic 6v6, or War up to 100 vs 100." onClick={props.onCircle} />
        <Tile title="Leaderboards" about="Searchable ranks for Hunt and Hardcore." onClick={props.onBoards} />
        <Tile title="Designer Mode" about="Map Builder and Enemy Designer." onClick={props.onDesigner} />
        <Tile title="Shinys Seen" about={shinyCount ? `Your collection: ${shinyCount} shiny ghost${shinyCount === 1 ? "" : "s"}.` : "Every shiny you pick up is kept here."} onClick={props.onShinies} testid="shinies-tile" badge={shinyCount ? `✦ ${shinyCount}` : undefined} />
        <Tile title="Options" about="Account and friends." onClick={props.onOptions} />
        <Tile title="Ascension" about="Wipe all account progress and begin again. You will be warned first." onClick={() => setAscend(1)} testid="ascend-tile" badge={asc ? roman(asc) : undefined} />
      </div>
      <div className="screen-actions">
        <button type="button"
          className="px-btn ui-btn-sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void staticSignOut().finally(() => setBusy(false));
          }}
        >
          {busy ? "Signing out…" : "Logout"}
        </button>
      </div>
    </Screen>
  );
}

function roman(n: number): string {
  const r: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of r) while (n >= v) { out += s; n -= v; }
  return out || "0";
}

/** One shiny, animated. */
function ShinyCanvas({ s }: { s: ShinyEntry }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.fillStyle = "#241814";
      ctx.beginPath();
      ctx.ellipse(32, 52, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawShiny(ctx, s, 32, 42 + Math.sin(t * 2) * 2.5, t);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [s]);
  return <canvas ref={ref} width={128} height={120} className="w-full bg-ink" style={{ imageRendering: "pixelated" }} />;
}

/** Main menu: every shiny ghost this account has ever picked up. */
export function ShiniesScreen({ onBack, username }: { onBack: () => void; username: string }) {
  const [sort, setSort] = useState<"new" | "old" | "level" | "name">("new");
  const list = readShinies().slice().sort((a, b) => (sort === "new" ? b.at - a.at : sort === "old" ? a.at - b.at : sort === "level" ? b.level - a.level : a.name.localeCompare(b.name)));
  const species = new Set(list.map((s) => s.species)).size;
  return (
    <Screen kicker={`SHINYS SEEN · ${username}`} title={`✦ ${list.length} shiny ghost${list.length === 1 ? "" : "s"}`} wide>
      <p className="text-dim">Every shiny you have picked up on this account, in any mode. {list.length ? `${species} different kind${species === 1 ? "" : "s"}.` : ""} On Discord, <span className="text-kyo">/shiny {username}</span> shows this collection as a GIF.</p>
      <div className="flex flex-wrap gap-1">
        {(["new", "old", "level", "name"] as const).map((k) => (
          <button key={k} type="button" className={`px-btn ui-btn-sm ${sort === k ? "px-btn-kyo" : ""}`} onClick={() => setSort(k)}>{k === "new" ? "Newest" : k === "old" ? "Oldest" : k === "level" ? "Level" : "Name"}</button>
        ))}
      </div>
      {!list.length && <Empty>No shinies yet. Shiny ghosts are rare: catching skill, ghost jars and luck all raise the odds.</Empty>}
      <div className="ui-grid" style={{ "--min": "140px" } as React.CSSProperties} data-testid="shiny-grid">
        {list.slice(0, 200).map((s) => (
          <div key={s.uid} className="ui-card" title={`${s.name} · ${s.species}`}>
            <ShinyCanvas s={s} />
            <p className="text-kyo">✦ {s.name}</p>
            <p className="text-dim">Lv {s.level} · {s.type}{s.mode === "hardcore" ? " · Hardcore" : s.mode === "turbz" ? " · TURBZ" : ""}</p>
            <p className="text-dim">{s.by ? `${s.by}, ` : ""}{new Date(s.at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
      <div className="screen-actions">
        <button type="button" className="px-btn" data-testid="shinies-back" onClick={onBack}>Back</button>
      </div>
    </Screen>
  );
}

const BOARDS: { id: GraveMode; label: string }[] = [
  { id: "hunt", label: "Hunt" },
  { id: "hardcore", label: "Hardcore" },
  { id: "turbz", label: "TURBZ" },
];

type BoardSort = "score" | "level" | "account" | "recent";

const BOARD_SORTS: { id: BoardSort; label: string }[] = [
  { id: "score", label: "Best score" },
  { id: "level", label: "Highest level" },
  { id: "recent", label: "Newest" },
  { id: "account", label: "Account" },
];

function commas(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function fellOn(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso || "unknown day";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

function ago(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function agoDay(at: number | undefined, iso: string, now: number): string {
  if (!at) return fellOn(iso);
  const m = Math.floor(Math.max(0, now - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 14 ? `${d}d ago` : fellOn(iso);
}

/** "Killed by Sera Coil (tier 3 bounty, level 44) with Ember Lash." → "Sera Coil". */
function shortCause(cause: string | undefined): string {
  if (!cause) return "—";
  const m = cause.match(/(?:Killed by|Caught in) (.+?)(?: \(|'s Death Mark|\.|$)/);
  if (m) return cause.startsWith("Caught") ? `${m[1]}'s Death Mark` : m[1]!;
  return cause.replace(/\.$/, "");
}

export function Boards({ onBack, username }: { onBack: () => void; username?: string }) {
  const [mode, setMode] = useState<GraveMode>("hunt");
  const [rows, setRows] = useState<GraveRow[]>([]);
  const [pickId, setPickId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<BoardSort>("score");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const modeSeen = useRef(mode);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let stop = false;
    const switched = modeSeen.current !== mode;
    modeSeen.current = mode;
    if (switched) {
      setRows([]);
      setPickId(null);
      setLoading(true);
    }
    const load = (quiet: boolean) => {
      if (!quiet) setLoading(true);
      setRefreshing(true);
      setErr("");
      void listGraves(mode)
        .then((list) => {
          if (stop) return;
          setRows(list);
          setPickId((cur) => (cur != null && list.some((row) => row.id === cur) ? cur : (list[0]?.id ?? null)));
          setUpdatedAt(Date.now());
        })
        .catch((e) => {
          if (!stop) setErr(e instanceof Error ? e.message : "The board is dark.");
        })
        .finally(() => {
          if (stop) return;
          setLoading(false);
          setRefreshing(false);
        });
    };
    void load(!switched);
    const id = window.setInterval(() => load(true), 20000);
    const onVis = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mode, tick]);

  const you = (username ?? "").trim().toLowerCase();
  const ranks = new Map([...rows].sort((a, b) => b.score - a.score || a.id - b.id).map((row, i) => [row.id, i + 1]));
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((row) => {
    if (mine && row.username.toLowerCase() !== you) return false;
    if (!needle) return true;
    return [row.name, row.username, row.race, row.className ?? "", row.cause ?? "", row.place ?? "", ...(row.effects ?? [])].some((v) => v.toLowerCase().includes(needle));
  });
  shown.sort((a, b) => {
    if (sort === "level") return b.level - a.level || b.score - a.score || a.id - b.id;
    if (sort === "account") return b.accountScore - a.accountScore || b.score - a.score || a.id - b.id;
    if (sort === "recent") return b.id - a.id;
    return b.score - a.score || a.id - b.id;
  });
  const pick = shown.find((row) => row.id === pickId) ?? shown[0] ?? null;
  const myBest = rows.filter((r) => you && r.username.toLowerCase() === you).sort((a, b) => b.score - a.score)[0] ?? null;
  const status =
    loading && rows.length === 0
      ? "Opening the ledger…"
      : err && rows.length === 0
        ? "Could not load the board."
        : `${shown.length === rows.length ? `${rows.length} fallen` : `${shown.length} of ${rows.length}`}${updatedAt ? ` · updated ${ago(updatedAt, now)}` : ""}`;

  const step = (dir: number) => {
    if (!shown.length) return;
    const i = Math.max(0, shown.findIndex((r) => r.id === pick?.id));
    const next = shown[Math.max(0, Math.min(shown.length - 1, i + dir))]!;
    setPickId(next.id);
    listRef.current?.querySelector<HTMLElement>(`[data-row="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <Screen kicker="LEADERBOARDS" title="Fallen witches" wide roomy>
      <p className="text-dim">The best 100 lives in each mode, ranked by the score of that death. Click a witch (or use ↑ ↓) to see her as she fell: gear, effects, ghosts, skills and what killed her.</p>
      <div className="board-bar">
        <Tabs value={mode} onChange={setMode} tabs={BOARDS.map((b) => ({ id: b.id, label: b.label }))} label="Mode" />
        <span className="board-spacer" />
        {myBest && (
          <button className="px-btn" type="button" onClick={() => { setMine(false); setQ(""); setPickId(myBest.id); window.setTimeout(() => listRef.current?.querySelector<HTMLElement>(`[data-row="${myBest.id}"]`)?.scrollIntoView({ block: "center" }), 0); }}>
            My best · #{ranks.get(myBest.id)}
          </button>
        )}
        <button className="px-btn" type="button" disabled={refreshing} onClick={() => setTick((n) => n + 1)}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="board-bar">
        <input
          className="px-input board-search"
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 40))}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
            if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
          }}
          placeholder="Search name, player, class, killer, place or effect"
          aria-label="Search the leaderboard"
        />
        <Chips value={sort} onChange={setSort} options={BOARD_SORTS} label="Sort" />
        {you && (
          <label className="chip chip-check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine
          </label>
        )}
      </div>
      <p className="board-meta">{status}</p>
      {err && <p className="text-blood">{err}</p>}
      <div className="board-layout">
        <div
          className="board-scroll"
          role="table"
          aria-label={`${mode} leaderboard`}
          ref={listRef}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
            if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
          }}
        >
          <div className="board-head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Witch</span>
            <span className="board-col-race" role="columnheader">Killed by</span>
            <span className="board-lv" role="columnheader">Lv</span>
            <span className="board-score" role="columnheader">Score</span>
            <span className="board-col-keep board-score" role="columnheader">When</span>
          </div>
          {!loading && !err && rows.length === 0 && <p className="board-empty">A new season: the board was wiped clean. No one has fallen in this mode yet.</p>}
          {!loading && rows.length > 0 && shown.length === 0 && <p className="board-empty">No witch matches that.</p>}
          {shown.map((row) => {
            const rank = ranks.get(row.id) ?? 0;
            const isMine = you.length > 0 && row.username.toLowerCase() === you;
            const on = pick?.id === row.id;
            return (
              <button
                key={row.id}
                data-row={row.id}
                type="button"
                role="row"
                aria-pressed={on}
                className={`board-row ${on ? "board-row-on" : ""} ${isMine ? "board-row-you" : ""}`}
                onClick={() => setPickId(row.id)}
              >
                <span className={`board-rank ${rank > 0 && rank <= 3 ? `board-rank-${rank}` : ""}`} role="cell">
                  {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                </span>
                <span className="board-who" role="cell">
                  <span className="board-name">
                    <span className="board-name-text">{row.name}</span>
                    {isMine && <span className="board-you">you</span>}
                    {(row.ghosts ?? []).some((g) => g.shiny) && <span className="shiny-name" title="Had a shiny ghost">✦</span>}
                  </span>
                  <span className="board-user">{row.className ? `${row.className} · ` : ""}{row.username}</span>
                </span>
                <span className="board-col-race board-cause" role="cell" title={row.cause}>
                  {shortCause(row.cause)}
                </span>
                <span className="board-lv" role="cell">
                  {row.level}
                </span>
                <span className="board-score" role="cell">
                  {commas(row.score)}
                </span>
                <span className="board-col-keep board-when" role="cell">
                  {agoDay(row.at, row.createdAt, now)}
                </span>
              </button>
            );
          })}
        </div>
        {pick && <GraveCard row={pick} rank={ranks.get(pick.id) ?? 0} now={now} />}
      </div>
      <div className="screen-actions">
        <button className="px-btn" type="button" onClick={onBack}>
          Back to the veil
        </button>
      </div>
    </Screen>
  );
}

function GraveCard({ row, rank, now }: { row: GraveRow; rank: number; now: number }) {
  const [allSkills, setAllSkills] = useState(false);
  const trained = row.skills.filter((sk) => sk.level > 1).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  const skills = allSkills ? trained : trained.slice(0, 8);
  return (
    <aside className="board-detail" aria-label={`${row.name} details`}>
      <div className="board-detail-top">
        <GravePortrait row={row} />
        <div className="min-w-0">
          <p className="board-detail-rank">#{rank} · {row.mode === "turbz" ? "TURBZ" : row.mode === "hardcore" ? "Hardcore" : "Hunt"}</p>
          <h2>{row.name}</h2>
          <p>{row.className ? `${row.className} · ` : ""}{row.race} · level {row.level}</p>
          <p className="board-score-big">{commas(row.score)}</p>
          <p className="text-dim">life score · account {commas(row.accountScore)}</p>
          <p className="text-dim">Played by {row.username}</p>
        </div>
      </div>
      <h3>HOW SHE FELL</h3>
      <p className="board-cause-full">{row.cause || row.note || "Unknown."}</p>
      <p className="text-dim">{row.place ? `${row.place} · ` : ""}{agoDay(row.at, row.createdAt, now)}</p>
      {(row.effects ?? []).length > 0 && (
        <>
          <h3>EFFECTS</h3>
          <div className="board-chips">
            {row.effects!.map((e) => <span key={e} className={`board-chip ${e.startsWith("Shiny") ? "shiny-name" : ""}`}>{e}</span>)}
          </div>
        </>
      )}
      {(row.ghosts ?? []).length > 0 && (
        <>
          <h3>GHOSTS</h3>
          <ul className="board-skills">
            {row.ghosts!.map((g, i) => (
              <li key={`${g.name}-${i}`}>
                <span className={g.shiny ? "shiny-name" : `type-${typeId(g.type)}`}>{g.shiny ? "✦ " : ""}{g.name}</span>
                <b>{g.level}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>WORN</h3>
      {row.gear.length === 0 && <p className="text-dim">Buried in nothing.</p>}
      <div className="board-gear">
        {row.gear.map((g) => (
          <article key={`${g.slot}-${g.name}`} className={`q-${g.quality.toLowerCase()}`}>
            <p>
              <span className="board-slot">{g.slot}</span> {g.name}
            </p>
            <p className="text-dim">
              lv {g.level} · {g.quality} · {g.type}{g.fx ? ` · ${g.fx}` : ""}
            </p>
            {(g.enchants ?? []).length > 0 && <p className="text-dim">{g.enchants.map((e) => `${e.name} ${e.power}`).join(" · ")}</p>}
          </article>
        ))}
      </div>
      <h3>SKILLS</h3>
      {trained.length === 0 && <p className="text-dim">Nothing trained past 1.</p>}
      {trained.length > 0 && (
        <ul className="board-skills">
          {skills.map((sk) => (
            <li key={sk.name}>
              <span>{sk.name}</span>
              <b>{sk.level}</b>
            </li>
          ))}
        </ul>
      )}
      {trained.length > 8 && (
        <button type="button" className="px-btn ui-btn-sm" onClick={() => setAllSkills((v) => !v)}>
          {allSkills ? "Fewer skills" : `All ${trained.length} skills`}
        </button>
      )}
    </aside>
  );
}

export function Options({ username, onBack }: { username: string; onBack: () => void }) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  async function refresh() {
    try {
      setFriends(await listFriends());
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Friends are quiet.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Screen kicker="OPTIONS" title="The account">
        <p className="text-dim">
          Signed in as {username}.{" "}
          Your witch autosaves to this account, so you can pick up where you left off on any device.
        </p>
        <div className="mt-3"><AccountChip /></div>
        <div className="ui-card ui-stack-sm">
          <span className="ui-section-title">FRIENDS</span>
          <p className="text-dim">Ask by the name they signed in with. Accepted friends share the friends channel.</p>
          <form
            className="mt-2 grid grid-cols-[1fr_auto] gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void requestFriend(name)
                .then((msg) => {
                  setNote(msg);
                  setName("");
                  return refresh();
                })
                .catch((err) => setNote(err instanceof Error ? err.message : "No such witch."));
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              placeholder="Their username"
              aria-label="Friend username"
              className="w-full border-2 border-bone bg-ink px-2 py-1 text-bone outline-none"
            />
            <button className="px-btn px-btn-kyo" type="submit">
              Ask
            </button>
          </form>
          {note && <p className="mt-2">{note}</p>}
          <div className="mt-3 grid gap-2">
            {friends.length === 0 && <p className="text-dim">No friends yet.</p>}
            {friends.map((f) => (
              <div key={f.username} className="flex flex-wrap items-center justify-between gap-2 border-2 border-bone px-2 py-1">
                <span>
                  {f.username} <span className="text-dim">{f.status === "accepted" ? "friend" : f.status === "pending-in" ? "asks you" : "waiting"}</span>
                </span>
                <span className="flex gap-1">
                  {f.status === "pending-in" && (
                    <button className="px-btn px-btn-kyo" type="button" onClick={() => void answerFriend(f.username, true).then(refresh)}>
                      Accept
                    </button>
                  )}
                  <button className="px-btn" type="button" onClick={() => void answerFriend(f.username, false).then(refresh)}>
                    Drop
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-dim">Right-click in the wilds for more actions. In Hardcore, open Survival & Camp (H) for chopping, cooking, purified water and sleep.</p>
        <div className="screen-actions">
          <button className="px-btn" type="button" onClick={onBack}>
            Back to the veil
          </button>
        </div>
    </Screen>
  );
}

export function DuelBanner({
  duel,
}: {
  duel: { phase: "answer" | "yours"; attacker: string; move: string; about: string; beat: string };
}) {
  return (
    <div className="duel-banner px-panel">
      <p className="font-display text-xs text-blood">{duel.phase === "yours" ? "YOUR VERSE" : "THEY STRIKE FIRST"}</p>
      <p className="mt-1">{duel.beat}</p>
      {duel.phase === "answer" && duel.move && (
        <p className="text-kyo">
          {duel.attacker} · {duel.move}
        </p>
      )}
      {duel.about && <p className="text-dim">{duel.about}</p>}
      <p className="text-dim">Pick a verse below. Counters and steps can slip. A long roll can clear the blow. Spam and you trip.</p>
    </div>
  );
}
