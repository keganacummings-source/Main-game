import { useEffect, useRef, useState } from "react";
import { staticSignOut, useStaticAccount } from "@/lib/auth/static-account";
import { answerFriend, ensureProfile, listChat, listFriends, listGraves, postChat, requestFriend } from "@/game/social-client";
import type { ChatLine, FriendRow, GraveMode, GraveRow } from "@/game/social-types";
import type { TypeId } from "@/game/content";
import type { RaceId } from "@/game/content";
import { initActorSprites, tryDrawActorSprite } from "@/game/actor-sprites";
import type { ActorDraw } from "@/game/sprites";
import { Screen, Tabs, Tile } from "./ui-kit";

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
        <Tile title="Leaderboards" about="The grave ledger of fallen witches." onClick={props.onBoards} />
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

export function Boards({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<GraveMode>("hunt");
  const [rows, setRows] = useState<GraveRow[]>([]);
  const [pick, setPick] = useState<GraveRow | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    setErr("");
    void listGraves(mode)
      .then((list) => {
        if (stop) return;
        setRows(list);
        setPick(list[0] ?? null);
      })
      .catch((e) => {
        if (!stop) setErr(e instanceof Error ? e.message : "The board is dark.");
      });
    return () => {
      stop = true;
    };
  }, [mode]);

  return (
    <Screen kicker="GRAVE LEDGER" title="Only the dead are counted" wide>
        <p className="text-dim">A global score of fallen witches. Open a name to see the body, kit, enchants and the account that wore them.</p>
        <Tabs value={mode} onChange={setMode} tabs={BOARDS.map((b) => ({ id: b.id, label: b.label }))} />
        {err && <p className="mt-2 text-blood">{err}</p>}
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="grave-list">
            {rows.length === 0 && <p className="text-dim">No corpses on this board yet. Die gloriously.</p>}
            {rows.map((row, i) => (
              <button key={row.id} type="button" className={`grave-row ${pick?.id === row.id ? "grave-row-on" : ""}`} onClick={() => setPick(row)}>
                <span className="font-display text-xs text-kyo">#{i + 1}</span>
                <span className="block text-bone">
                  {row.name} · {row.score}
                </span>
                <span className="block text-dim">
                  {row.username} · lv {row.level} {row.race}
                </span>
              </button>
            ))}
          </div>
          {pick && (
            <div className="border-2 border-bone p-3">
              <div className="flex flex-wrap items-start gap-3">
                <GravePortrait row={pick} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xs text-kyo">{pick.name}</p>
                  <p>
                    {pick.race} · level {pick.level} · score {pick.score}
                  </p>
                  <p className="text-dim">Account {pick.username}</p>
                  <p className="text-dim">Keeper score {pick.accountScore}</p>
                  <p className="mt-2">{pick.note}</p>
                </div>
              </div>
              <p className="mt-3 font-display text-xs">Skills</p>
              {pick.skills.length === 0 && <p className="text-dim">No skill record.</p>}
              {pick.skills.map((sk) => (
                <p key={sk.name}>
                  {sk.name} <span className="text-kyo">{sk.level}</span>
                </p>
              ))}
              <p className="mt-3 font-display text-xs">Worn</p>
              {pick.gear.length === 0 && <p className="text-dim">Buried in nothing.</p>}
              {pick.gear.map((g) => (
                <div key={`${g.slot}-${g.name}`} className="mt-2 border-t border-bone/40 pt-2">
                  <p>
                    {g.slot} · {g.name}
                  </p>
                  <p className="text-dim">
                    lv {g.level} · {g.quality} · {g.type}
                  </p>
                  <p className="text-dim">{g.enchants.length ? g.enchants.map((e) => `${e.name} ${e.power}`).join(" · ") : "No enchants"}</p>
                  {g.moves.length > 0 && <p>{g.moves.join(" · ")}</p>}
                </div>
              ))}
              <p className="mt-2 text-dim">{pick.createdAt}</p>
            </div>
          )}
        </div>
        <div className="screen-actions">
          <button className="px-btn" type="button" onClick={onBack}>
            Back to the veil
          </button>
        </div>
    </Screen>
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
