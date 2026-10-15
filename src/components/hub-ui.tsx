import { useEffect, useRef, useState } from "react";
import { staticSignOut, useStaticAccount } from "@/lib/auth/static-account";
import { answerFriend, ensureProfile, listChat, listFriends, listGraves, postChat, requestFriend } from "@/game/social-client";
import type { ChatLine, FriendRow, GraveMode, GraveRow } from "@/game/social-types";
import type { TypeId } from "@/game/content";
import type { RaceId } from "@/game/content";
import { initActorSprites, tryDrawActorSprite } from "@/game/actor-sprites";
import type { ActorDraw } from "@/game/sprites";
import { Chips, Screen, Tabs, Tile } from "./ui-kit";

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

/** Canvas portrait of a fallen witch — body + animated gear FX (not a real GIF file). */
function GravePortrait({ row }: { row: GraveRow }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stop = false;
    let raf = 0;
    const canvas = ref.current;
    if (!canvas) return;

    const W = 120;
    const H = 140;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pieces: ActorDraw["pieces"] = row.gear.map((g, i) => ({
      slot: g.slot,
      style: (seedFrom(g.name + g.slot) % 6) + 1,
      type: typeId(g.type),
      fxSeed: seedFrom(g.name + String(i) + row.id),
      quality: Q_NUM[g.quality.toLowerCase()] ?? Math.max(1, Math.min(6, parseInt(g.quality, 10) || 2)),
    }));

    const actor: ActorDraw = {
      x: W / 2,
      y: H - 18,
      race: raceId(row.race),
      female: seedFrom(row.name) % 2 === 0,
      hair: seedFrom(row.username) % 5,
      skin: seedFrom(row.name + row.race) % 5,
      facing: 1,
      direction: "down",
      moving: true,
      walk: 0,
      attack: 0,
      hurt: 0,
      pieces,
      setFx: null,
      setOn: false,
      scale: 3.2,
      classId: undefined,
      time: 0,
    };

    const t0 = performance.now();

    void initActorSprites()
      .catch(() => {})
      .finally(() => {
        const tick = (now: number) => {
          if (stop) return;
          const t = (now - t0) / 1000;
          actor.walk = (t * 2.2) % 4;
          actor.time = t;
          actor.moving = true;

          ctx.fillStyle = "#0c0a10";
          ctx.fillRect(0, 0, W, H);
          // soft ground plate
          ctx.fillStyle = "#1a1520";
          ctx.fillRect(W * 0.15, H - 22, W * 0.7, 10);

          const drew = tryDrawActorSprite(ctx, actor);
          if (!drew) {
            // procedural fallback silhouette while sheets load
            ctx.fillStyle = "#6a5a70";
            ctx.fillRect(W / 2 - 10, H - 70, 20, 48);
            ctx.fillStyle = "#c4a890";
            ctx.fillRect(W / 2 - 8, H - 86, 16, 16);
          }

          // score ribbon
          ctx.fillStyle = "#e8a020";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`score ${row.score}`, W / 2, 14);

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
      width={120}
      height={140}
      className="grave-portrait border-2 border-bone bg-ink"
      style={{ imageRendering: "pixelated", width: 120, height: 140 }}
      aria-label={`${row.name} fallen portrait`}
    />
  );
}

export function ChatDock({ username, playing, bare }: { username: string; playing: boolean; bare?: boolean }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"global" | "friends">("global");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) return;
    void ensureProfile(username).catch(() => {});
  }, [username]);

  useEffect(() => {
    let stop = false;
    const pull = () => {
      void listChat()
        .then((rows) => {
          if (!stop) setLines(rows);
        })
        .catch(() => {});
    };
    pull();
    const id = window.setInterval(pull, 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setErr("");
    try {
      await postChat(channel, body);
      setText("");
      setLines(await listChat());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The veil refused that.");
    }
  }

  return (
    <div className={bare ? "" : `veil-chat px-panel ${playing ? "veil-chat-play" : ""}`}>
      <button className="px-btn w-full" type="button" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide veil chat" : "Veil chat"}
      </button>
      {open && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <button className={`px-btn ${channel === "global" ? "px-btn-kyo" : ""}`} type="button" onClick={() => setChannel("global")}>
              Global
            </button>
            <button className={`px-btn ${channel === "friends" ? "px-btn-kyo" : ""}`} type="button" onClick={() => setChannel("friends")}>
              Friends
            </button>
          </div>
          <div className="veil-log mt-2">
            {lines.filter((line) => channel === "global" || line.channel === "friends").length === 0 && (
              <p className="text-dim">The channel is quiet.</p>
            )}
            {lines
              .filter((line) => (channel === "global" ? line.channel === "global" : line.channel === "friends"))
              .slice(-12)
              .map((line) => (
                <p key={line.id}>
                  <span className={line.mine ? "text-kyo" : "text-blood"}>{line.username}</span>
                  <span className="text-dim"> · </span>
                  {line.body}
                </p>
              ))}
          </div>
          <form
            className="mt-2 grid grid-cols-[1fr_auto] gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 160))}
              placeholder={channel === "global" ? "Speak to every witch" : "Friends only"}
              aria-label="Veil chat"
              className="w-full border-2 border-bone bg-ink px-2 py-1 text-bone outline-none"
            />
            <button className="px-btn px-btn-kyo" type="submit">
              Send
            </button>
          </form>
          {err && <p className="text-blood">{err}</p>}
        </>
      )}
    </div>
  );
}

/** Static build: who is signed in, plus a sign-out button. */
export function AccountChip() {
  const { user } = useStaticAccount();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-dim">{user.displayName}</span>
      <button
        className="px-btn !min-h-9 !py-1"
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
  onHard: () => void;
  onBoards: () => void;
  onOptions: () => void;
  onDesigner: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Screen kicker={`SIGNED IN · ${props.username}`} title="Pick a veil">
      <p className="text-dim">The dead keep the score.</p>
      <div className="tile-grid">
        <Tile primary title="TurboHunt" about="Explore the wilds, take bounties, climb the ladder." onClick={props.onHunt} />
        <Tile title="Hardcore" about="Hunger, thirst, nights that get worse. One life." onClick={props.onHard} badge="HARD" />
        <Tile title="TurboCircle" about="Battle simulator: plant teams, watch them fight." onClick={props.onCircle} />
        <Tile title="Leaderboards" about="Searchable ranks for Hunt and Hardcore." onClick={props.onBoards} />
        <Tile title="Designer Mode" about="Map Builder and Enemy Designer." onClick={props.onDesigner} />
        <Tile title="Options" about="Account and friends." onClick={props.onOptions} />
      </div>
      <div className="screen-actions">
        <button
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

const BOARDS: { id: GraveMode; label: string }[] = [
  { id: "hunt", label: "Hunt" },
  { id: "hardcore", label: "Hardcore" },
];

type BoardSort = "score" | "level" | "account" | "recent";

const BOARD_SORTS: { id: BoardSort; label: string }[] = [
  { id: "score", label: "Score" },
  { id: "level", label: "Level" },
  { id: "account", label: "Account" },
  { id: "recent", label: "Newest" },
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

export function Boards({ onBack, username }: { onBack: () => void; username?: string }) {
  const [mode, setMode] = useState<GraveMode>("hunt");
  const [rows, setRows] = useState<GraveRow[]>([]);
  const [pickId, setPickId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<BoardSort>("score");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const modeSeen = useRef(mode);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let stop = false;
    const switched = modeSeen.current !== mode;
    modeSeen.current = mode;
    if (switched) {
      setRows([]);
      setPickId(null);
      setQ("");
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

  const ranks = new Map([...rows].sort((a, b) => b.score - a.score || a.id - b.id).map((row, i) => [row.id, i + 1]));
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((row) => {
    if (!needle) return true;
    return row.name.toLowerCase().includes(needle) || row.username.toLowerCase().includes(needle) || row.race.toLowerCase().includes(needle);
  });
  shown.sort((a, b) => {
    if (sort === "level") return b.level - a.level || b.score - a.score || a.id - b.id;
    if (sort === "account") return b.accountScore - a.accountScore || b.score - a.score || a.id - b.id;
    if (sort === "recent") return b.id - a.id;
    return b.score - a.score || a.id - b.id;
  });
  const pick = shown.find((row) => row.id === pickId) ?? shown[0] ?? null;
  const you = (username ?? "").trim().toLowerCase();
  const status =
    loading && rows.length === 0
      ? "Opening the ledger…"
      : err && rows.length === 0
        ? "Could not load the board."
        : `${shown.length === rows.length ? `${rows.length} fallen` : `${shown.length} of ${rows.length}`}${updatedAt ? ` · updated ${ago(updatedAt, now)}` : ""}`;

  return (
    <Screen kicker="LEADERBOARDS" title="Fallen witches" wide roomy>
      <p className="text-dim">Top 100 lives, ranked by the score of that death. Account is the keeper's running total. The list reloads on its own.</p>
      <div className="board-bar">
        <Tabs value={mode} onChange={setMode} tabs={BOARDS.map((b) => ({ id: b.id, label: b.label }))} label="Mode" />
        <span className="board-spacer" />
        <button className="px-btn" type="button" disabled={refreshing} onClick={() => setTick((n) => n + 1)}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="board-bar">
        <input
          className="px-input board-search"
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 40))}
          placeholder="Find a witch, race, or keeper"
          aria-label="Search the leaderboard"
        />
        <Chips value={sort} onChange={setSort} options={BOARD_SORTS} label="Sort" />
      </div>
      <p className="board-meta">{status}</p>
      {err && <p className="text-blood">{err}</p>}
      <div className="board-layout">
        <div className="board-scroll" role="table" aria-label={`${mode} leaderboard`}>
          <div className="board-head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Witch</span>
            <span className="board-col-race" role="columnheader">Race</span>
            <span className="board-lv" role="columnheader">Lv</span>
            <span className="board-score" role="columnheader">Score</span>
            <span className="board-col-keep board-score" role="columnheader">Account</span>
          </div>
          {!loading && !err && rows.length === 0 && <p className="board-empty">No one has fallen in this mode yet.</p>}
          {!loading && rows.length > 0 && shown.length === 0 && <p className="board-empty">No witch matches that.</p>}
          {shown.map((row) => {
            const rank = ranks.get(row.id) ?? 0;
            const mine = you.length > 0 && row.username.toLowerCase() === you;
            const on = pick?.id === row.id;
            return (
              <button
                key={row.id}
                type="button"
                role="row"
                aria-pressed={on}
                className={`board-row ${on ? "board-row-on" : ""} ${mine ? "board-row-you" : ""}`}
                onClick={() => setPickId(row.id)}
              >
                <span className={`board-rank ${rank > 0 && rank <= 3 ? `board-rank-${rank}` : ""}`} role="cell">
                  {rank}
                </span>
                <span className="board-who" role="cell">
                  <span className="board-name">
                    <span className="board-name-text">{row.name}</span>
                    {mine && <span className="board-you">you</span>}
                  </span>
                  <span className="board-user">{row.username}</span>
                </span>
                <span className="board-col-race" role="cell">
                  {row.race}
                </span>
                <span className="board-lv" role="cell">
                  {row.level}
                </span>
                <span className="board-score" role="cell">
                  {commas(row.score)}
                </span>
                <span className="board-col-keep board-score" role="cell">
                  {commas(row.accountScore)}
                </span>
              </button>
            );
          })}
        </div>
        {pick && <GraveCard row={pick} rank={ranks.get(pick.id) ?? 0} />}
      </div>
      <div className="screen-actions">
        <button className="px-btn" type="button" onClick={onBack}>
          Back to the veil
        </button>
      </div>
    </Screen>
  );
}

function GraveCard({ row, rank }: { row: GraveRow; rank: number }) {
  const trained = row.skills.filter((sk) => sk.level > 1).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  return (
    <aside className="board-detail" aria-label={`${row.name} details`}>
      <div className="board-detail-top">
        <GravePortrait row={row} />
        <div className="min-w-0">
          <p className="board-detail-rank">#{rank}</p>
          <h2>{row.name}</h2>
          <p>
            {row.race} · level {row.level}
          </p>
          <p className="board-score-big">{commas(row.score)}</p>
          <p className="text-dim">life score</p>
          <p className="text-dim">Keeper {row.username}</p>
          <p className="text-dim">Account {commas(row.accountScore)}</p>
          <p className="text-dim">Fell {fellOn(row.createdAt)}</p>
          {row.note && <p className="board-note">{row.note}</p>}
        </div>
      </div>
      <h3>Trained skills</h3>
      {trained.length === 0 && <p className="text-dim">Nothing trained past 1.</p>}
      {trained.length > 0 && (
        <ul className="board-skills">
          {trained.map((sk) => (
            <li key={sk.name}>
              <span>{sk.name}</span>
              <b>{sk.level}</b>
            </li>
          ))}
        </ul>
      )}
      <h3>Worn</h3>
      {row.gear.length === 0 && <p className="text-dim">Buried in nothing.</p>}
      <div className="board-gear">
        {row.gear.map((g) => (
          <article key={`${g.slot}-${g.name}`}>
            <p>
              <span className="board-slot">{g.slot}</span> {g.name}
            </p>
            <p className="text-dim">
              lv {g.level} · {g.quality} · {g.type}
            </p>
            <p className="text-dim">{(g.enchants ?? []).length ? g.enchants.map((e) => `${e.name} ${e.power}`).join(" · ") : "No enchants"}</p>
            {(g.moves ?? []).length > 0 && <p className="board-moves">{g.moves.join(" · ")}</p>}
          </article>
        ))}
      </div>
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
