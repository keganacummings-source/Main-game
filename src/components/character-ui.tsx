import { useEffect, useRef, useState } from "react";
import { MOVE_BY_ID, SKILLS, TYPES, moveTactic, type TypeId } from "@/game/content";
import { CLASSES, CLASS_BY_ID, CLASS_RACE, ROLES, TRAITS, buffLines, classGendered, type ClassId, type Role } from "@/game/classes";
import { actorSpritesReady } from "@/game/actor-sprites";
import type { Sheet, TurbzGame } from "@/game/engine";

const MOVEMENT = new Set(["blink", "lunge", "roll", "dash", "surge"]);
const typeClass = (t: TypeId) => `type-${t}`;

export function ClassCanvas({ classId, game, active, female }: { classId: ClassId; game: TurbzGame | null; active: boolean; female: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !game) return;
    canvas.width = 120;
    canvas.height = 110;
    let frame = 0;
    const draw = () => {
      game.preview(canvas, CLASS_RACE[classId], classId, female);
      if (active || !actorSpritesReady()) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [classId, game, active, female]);
  return <canvas ref={ref} width={120} height={110} className="h-20 w-full bg-ink" />;
}

function Lines({ buffs, debuffs }: { buffs: string[]; debuffs: string[] }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <div>
        <p className="font-display text-[9px] text-kyo">BUFFS</p>
        {buffs.map((b) => <p key={b} className="stat-up">▲ {b}</p>)}
        {!buffs.length && <p className="text-dim">None</p>}
      </div>
      <div>
        <p className="font-display text-[9px] text-blood">DEBUFFS</p>
        {debuffs.map((b) => <p key={b} className="stat-down">▼ {b}</p>)}
        {!debuffs.length && <p className="text-dim">None</p>}
      </div>
    </div>
  );
}

export type Pick = { classId: ClassId; traitId: string | null; female: boolean };

export function ClassPicker({ pick, setPick, game }: { pick: Pick; setPick: (p: Pick) => void; game: TurbzGame | null }) {
  const [role, setRole] = useState<Role | "All">("All");
  const c = CLASS_BY_ID[pick.classId];
  const lines = buffLines(c.stats, (c as { immune?: readonly string[] }).immune as never);
  const list = CLASSES.filter((x) => role === "All" || x.role === role);
  return (
    <div className="grid gap-3" data-testid="class-picker">
      <div className="flex flex-wrap gap-1">
        {(["All", ...ROLES] as const).map((r) => (
          <button key={r} type="button" data-testid={`role-filter-${r.toLowerCase()}`} className={`px-btn !min-h-9 !py-1 !text-lg ${role === r ? "px-btn-kyo" : ""}`} onClick={() => setRole(r)}>
            {r}
          </button>
        ))}
      </div>
      <div className="class-grid">
        {list.map((x) => (
          <button
            key={x.id}
            type="button"
            data-testid={`class-card-${x.id}`}
            className={`class-card ${pick.classId === x.id ? "class-card-on" : ""}`}
            onClick={() => setPick({ ...pick, classId: x.id })}
          >
            <ClassCanvas classId={x.id} game={game} active={pick.classId === x.id} female={pick.female} />
            <span className="mt-1 block text-lg leading-tight">{x.name}</span>
            <span className={`block text-base ${typeClass(x.type)}`}>{TYPES[x.type].name} · {x.role}</span>
          </button>
        ))}
      </div>
      <div className="sheet-box grid gap-2" data-testid="class-details">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-xs text-kyo" data-testid="class-details-name">{c.name}</p>
          <p className={typeClass(c.type)}>{TYPES[c.type].name} · {c.role}</p>
        </div>
        <p>{c.blurb} <span className="text-dim">{c.specialty}.</span></p>
        <p className="text-kyo">Passive: <span className="text-bone">{c.passive}</span></p>
        <Lines buffs={lines.buffs} debuffs={lines.debuffs} />
        <div>
          <p className="font-display text-[9px] text-kyo">MOVESET</p>
          <div className="flex flex-wrap">
            {c.starterMoves.map((id) => {
              const m = MOVE_BY_ID[id]!;
              const tac = moveTactic(m);
              return (
                <span key={id} className={`chip ${typeClass(m.type)}`} title={m.about}>
                  {id === c.signature ? "★ " : MOVEMENT.has(tac) ? "» " : ""}{m.name} · {tac}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <p className="font-display text-[9px] text-kyo">SKILL APTITUDES</p>
          <div className="flex flex-wrap">
            {Object.entries(c.aptitudes).map(([id, mult]) => (
              <span key={id} className={`chip ${Number(mult) >= 1 ? "stat-up" : "stat-down"}`}>
                {SKILLS.find((s) => s.id === id)?.name} ×{Number(mult).toFixed(1)}
              </span>
            ))}
          </div>
        </div>
        {classGendered(pick.classId) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-dim">Body</span>
            <button type="button" data-testid="body-feminine" className={`px-btn !min-h-9 !py-1 ${pick.female ? "px-btn-kyo" : ""}`} onClick={() => setPick({ ...pick, female: true })}>Feminine</button>
            <button type="button" data-testid="body-masculine" className={`px-btn !min-h-9 !py-1 ${!pick.female ? "px-btn-kyo" : ""}`} onClick={() => setPick({ ...pick, female: false })}>Masculine</button>
          </div>
        )}
      </div>
      <div className="sheet-box" data-testid="trait-picker">
        <p className="font-display text-[9px] text-kyo">PICK ONE CHARACTER TRAIT</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {TRAITS.map((t) => {
            const l = buffLines(t.stats, ("immune" in t ? t.immune : []) as never);
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`trait-${t.id}`}
                className={`class-card ${pick.traitId === t.id ? "class-card-on" : ""}`}
                onClick={() => setPick({ ...pick, traitId: pick.traitId === t.id ? null : t.id })}
              >
                <span className="block text-lg">{t.name}</span>
                <span className="block text-base text-dim">{t.about}</span>
                <span className="block text-base">
                  {l.buffs.map((b) => <span key={b} className="stat-up">▲ {b} </span>)}
                  {l.debuffs.map((b) => <span key={b} className="stat-down">▼ {b} </span>)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CharacterSheet({ sheet }: { sheet: Sheet | null }) {
  if (!sheet) return <p className="text-dim">No character yet.</p>;
  const s = sheet;
  return (
    <div className="grid gap-3" data-testid="character-sheet">
      <div className="sheet-box">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-xs text-kyo" data-testid="sheet-name">{s.name}</p>
          <p className={typeClass(s.type)} data-testid="sheet-class">{s.className} · {TYPES[s.type].name} · {s.role}</p>
        </div>
        <p className="text-dim">{s.blurb} {s.specialty}.</p>
        <p className="text-kyo">Passive: <span className="text-bone">{s.passive}</span></p>
        <p>Trait: <span className="text-kyo" data-testid="sheet-trait">{s.trait ? s.trait.name : "None"}</span>{s.trait && <span className="text-dim"> · {s.trait.about}</span>}</p>
        <div className="sheet-grid mt-2">
          <div>
            <div className="sheet-row"><span>Level</span><span data-testid="sheet-level">{s.level}</span></div>
            <div className="sheet-row"><span>XP</span><span>{s.xp}/{s.xpNeed}</span></div>
            <div className="sheet-row"><span>Health</span><span data-testid="sheet-hp">{s.hp}/{s.maxHp}</span></div>
            <div className="sheet-row"><span>Shield</span><span>{s.shield}</span></div>
          </div>
          <div>
            <div className="sheet-row"><span>Kyo</span><span>{s.kyo}</span></div>
            <div className="sheet-row"><span>Skill points</span><span>{s.skillPoints}</span></div>
            <div className="sheet-row"><span>Account</span><span>Lv {s.account.level} · {s.account.perks} perks</span></div>
            <div className="sheet-row"><span>Score</span><span>{s.account.score}</span></div>
          </div>
        </div>
      </div>
      <div className="sheet-box" data-testid="sheet-stats">
        <p className="font-display text-[9px] text-kyo">ATTRIBUTES</p>
        <div className="sheet-grid mt-1">
          {s.stats.map((st) => (
            <div key={st.id} className="sheet-row" title={st.about}>
              <span>{st.name}</span>
              <span className={st.mod > 0 ? "stat-up" : st.mod < 0 ? "stat-down" : "text-dim"}>{st.value}</span>
            </div>
          ))}
        </div>
        <div className="sheet-grid mt-2 border-t-2 border-bone pt-2">
          {s.combat.map((row) => (
            <div key={row.label} className="sheet-row"><span className="text-dim">{row.label}</span><span>{row.value}</span></div>
          ))}
        </div>
      </div>
      <div className="sheet-box">
        <Lines buffs={s.buffs} debuffs={s.debuffs} />
      </div>
      <div className="sheet-box" data-testid="sheet-effects">
        <p className="font-display text-[9px] text-kyo">ACTIVE EFFECTS</p>
        {!s.effects.length && <p className="text-dim">Nothing is affecting you right now.</p>}
        {s.effects.map((e) => (
          <p key={e.id} className={e.good ? "stat-up" : "stat-down"}>{e.good ? "▲" : "▼"} {e.label}{e.t ? ` · ${e.t}s` : ""}</p>
        ))}
      </div>
      <div className="sheet-box" data-testid="sheet-skills">
        <p className="font-display text-[9px] text-kyo">SKILLS & APTITUDE</p>
        <div className="sheet-grid mt-1">
          {s.aptitudes.map((a) => (
            <div key={a.id} className="sheet-row">
              <span>{a.name} {a.level}</span>
              <span className={a.mult > 1 ? "stat-up" : a.mult < 1 ? "stat-down" : "text-dim"}>{a.mult > 1 ? "Excels" : a.mult < 1 ? "Weak" : "Normal"} ×{a.mult.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="sheet-box" data-testid="sheet-moves">
        <p className="font-display text-[9px] text-kyo">VERSES · ★ signature · » movement</p>
        {s.moves.map((m) => (
          <div key={m.id} className="sheet-row" title={m.about}>
            <span className={typeClass(m.type)}>{m.signature ? "★ " : m.movement ? "» " : ""}{m.name}</span>
            <span className="text-dim">{m.tactic} · {m.rank ? `rank ${m.rank}/5` : "locked"}</span>
          </div>
        ))}
      </div>
      <div className="sheet-box" data-testid="sheet-gear">
        <p className="font-display text-[9px] text-kyo">EQUIPMENT</p>
        {s.gear.map((g) => (
          <div key={g.slot} className="sheet-row">
            <span className="text-dim capitalize">{g.slot}</span>
            <span>{g.name}{g.quality ? ` · ${g.quality}` : ""}{g.stat ? ` · ${g.stat}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LobbyPanel({ lobby, game, inGame }: { lobby: { code: string; role: string; net: string; members: { id: string; name: string; className: string; level: number; hp: number; max: number; map: string; self: boolean; host: boolean }[] }; game: TurbzGame | null; inGame: boolean }) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  if (!lobby.code) {
    return (
      <div className="grid gap-2" data-testid="lobby-panel">
        <p>Play together. One player hosts: create a lobby and share its code. Friends join with that code, up to 3 witches in all. A lobby only exists while its host is online.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="CODE"
          aria-label="Lobby code"
          data-testid="lobby-code-input"
          className="px-input font-display text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <button className="px-btn px-btn-kyo" data-testid="lobby-create-btn" disabled={!inGame} onClick={() => game?.hostLobby(code || makeLobbyCode())}>Create lobby</button>
          <button className="px-btn" data-testid="lobby-join-btn" disabled={!inGame || code.length < 3} onClick={() => game?.joinLobby(code)}>Join</button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2" data-testid="lobby-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-xs text-kyo" data-testid="lobby-code">LOBBY {lobby.code}</p>
        <button
          className="px-btn !min-h-9 !py-1"
          data-testid="lobby-copy-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(lobby.code).then(() => setCopied(true)).catch(() => {});
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <p className="text-dim" data-testid="lobby-status">{lobby.role === "host" ? "You are hosting." : "You joined as a guest."} {lobby.net}</p>
      <div className="grid gap-1" data-testid="lobby-members">
        {lobby.members.map((m) => (
          <div key={m.id} className="sheet-box sheet-row" data-testid={`lobby-member-${m.self ? "self" : m.id}`}>
            <span>{m.host ? "♛ " : ""}{m.name}{m.self ? " (you)" : ""}</span>
            <span className="text-dim">{m.className}{m.level ? ` · lv ${m.level}` : ""}{m.max ? ` · ${m.hp}/${m.max}` : ""}</span>
          </div>
        ))}
        {lobby.members.length <= 1 && <p className="text-dim">Waiting for others. Share the code {lobby.code}.</p>}
      </div>
      <button className="px-btn" data-testid="lobby-leave-btn" onClick={() => game?.leaveLobby()}>Leave lobby</button>
    </div>
  );
}

export function makeLobbyCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
