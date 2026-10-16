import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { TYPES, type GhostLook, type TypeId } from "@/game/content";
import { drawMonster } from "@/game/sprites";
import { drawGhostFx, ghostFxLabel } from "@/game/ghost-fx";
import { rarityStyle, shinyPalette } from "@/game/ghost-style";
import type { GhostDetail } from "@/game/engine";
import { Empty, Meter, Tabs } from "./ui-kit";

/** Shared pieces for every window that shows a ghost: the Spirits window and the lingering-ghost window. */

const typeClass = (t: TypeId) => `type-${t}`;

/** A live, animated portrait of a ghost in its rarity colours or shiny palette. */
export const GhostPortrait = memo(function GhostPortrait({ g, size = 112 }: { g: Pick<GhostDetail, "uid" | "type" | "template" | "rarity" | "shiny" | "palette" | "look" | "level" | "speed" | "max">; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      // The ghost body is about 32px tall: fill most of the frame with it.
      const s = canvas.width / 44;
      ctx.scale(s, s);
      const fx = { x: 22, y: 38, type: g.type, rarity: g.rarity, level: g.level, speed: g.speed, max: g.max, shiny: g.shiny, seed: g.uid, palette: g.palette };
      try {
        drawGhostFx(ctx, fx, t, "back");
        drawMonster(ctx, { x: 22, y: 38, template: g.template, type: g.type, facing: 1, walk: t * 2, hurt: 0, boss: false, rarity: g.rarity, ghost: true, shiny: g.shiny, palette: g.palette, look: (g.look as GhostLook | null) ?? null, time: t });
        drawGhostFx(ctx, fx, t, "front");
      } catch {
        /* a portrait never breaks the window */
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [g.uid, g.type, g.template, g.rarity, g.shiny, g.palette, g.look, g.level, g.speed, g.max]);
  const st = rarityStyle(g.rarity);
  return <canvas ref={ref} className="ghost-portrait" width={size * 2} height={size * 2} style={{ width: size, height: size, ["--rc" as string]: st.color }} aria-label="Ghost portrait" />;
});

export function RarityBadge({ rarity }: { rarity: number }) {
  const st = rarityStyle(rarity);
  return <span className="ghost-badge" style={{ ["--rc" as string]: st.color }} data-testid="rarity-badge">{st.name}</span>;
}

export function PaletteBadge({ palette }: { palette: string | null }) {
  const p = shinyPalette(palette);
  return <span className={`ghost-badge ghost-badge-shiny ${p.kind === "rainbow" ? "shiny-name" : ""}`} style={{ ["--rc" as string]: p.badge }} data-testid="palette-badge">✦ {p.name}</span>;
}

/** Name line: element colour (or palette colour for shinies) and level. */
export function GhostName({ g, children }: { g: Pick<GhostDetail, "name" | "type" | "shiny" | "palette" | "level">; children?: ReactNode }) {
  const pal = g.shiny ? shinyPalette(g.palette) : null;
  return (
    <span className={`ghost-name ${pal ? (pal.kind === "rainbow" ? "shiny-name" : "") : typeClass(g.type)}`} style={pal && pal.kind !== "rainbow" ? { color: pal.badge } : undefined}>
      {g.shiny ? "✦ " : ""}{g.name} <span className="text-dim">Lv {g.level}</span>{children}
    </span>
  );
}

const WHERE_NOTE: Record<GhostDetail["where"], string> = {
  out: "Out with you: its abilities are working.",
  tagged: "Tagged tiny follower: its abilities are working.",
  party: "In the party: send it out to switch its abilities on.",
  task: "Away on a task: its abilities are off until it comes back out.",
  box: "In the Ghost Box: tag it as a tiny follower to switch its abilities on.",
  wild: "Keep it, then send it out or tag it to switch its abilities on.",
};

export function AbilityList({ g }: { g: Pick<GhostDetail, "abilities" | "abilitiesOn" | "where"> }) {
  if (!g.abilities.length) return <Empty>No abilities.</Empty>;
  return (
    <div className="ui-stack-sm" data-testid="ghost-abilities">
      <p className={g.abilitiesOn ? "text-good" : "text-dim"}>{g.abilitiesOn ? "● " : "○ "}{WHERE_NOTE[g.where]}</p>
      {g.abilities.map((a) => (
        <div key={a.id} className={`ui-card ${g.abilitiesOn ? "ui-card-hl" : ""}`}>
          <span className="ui-row">
            <span className={a.shiny ? "shiny-name" : "text-kyo"}>{a.shiny ? "✦ " : ""}{a.name}</span>
            <span className="text-dim">{a.kind === "timed" ? `Timed · ${a.cd}s` : "Passive"} · {a.tag}</span>
          </span>
          <span>{a.text}</span>
          <span className="ui-row text-dim">
            <span>Quality {a.quality}%</span>
            <span>{a.unit === "dmg" ? `Grows with level` : a.unit === "block" ? "One hit" : `All ghosts together: up to ${a.cap}${a.unit === "pct-hp" ? "% health" : a.unit === "%" ? "" : ""}`}</span>
          </span>
          <Meter value={a.quality} max={100} small kind="void" />
        </div>
      ))}
    </div>
  );
}

export function GhostStats({ g }: { g: GhostDetail }) {
  const rows: [string, string][] = [
    ["Element", TYPES[g.type]?.name ?? g.type],
    ["Kind", g.species || "Ghost"],
    ["Rarity", g.rarityName],
    ["Speed", String(g.speed)],
    ["Hit", `×${g.hitMult.toFixed(2)}`],
    ["Crit", `+${g.critBonus}%`],
    ["Recharge", `×${g.cdMult.toFixed(2)}`],
    ["Max level", `${g.levelCap}`],
  ];
  if (g.shiny) rows.splice(3, 0, ["Palette", g.paletteName]);
  return (
    <div className="ghost-stats" data-testid="ghost-stats">
      {rows.map(([k, v]) => (
        <span key={k} className="ghost-stat"><span className="text-dim">{k}</span><span>{v}</span></span>
      ))}
    </div>
  );
}

export function GhostMoves({ g, onToggle }: { g: Pick<GhostDetail, "moves">; onToggle?: (id: string) => void }) {
  if (!g.moves.length) return <Empty>No verses.</Empty>;
  return (
    <div className="ui-stack-sm">
      <p className="text-dim">{g.moves.filter((m) => m.slotted).length}/3 readied · {g.moves.length} known{onToggle ? " · tap a verse to ready it" : ""}</p>
      <div className="ui-grid" style={{ "--min": "180px" } as React.CSSProperties}>
        {g.moves.map((m) => {
          const body = (
            <>
              <span className={typeClass(m.type)}>{m.slotted ? "● " : "○ "}{m.name}</span>
              <span className="text-dim">{m.player ? "Aids you" : `Strikes foes · Pow ${m.power}`}</span>
            </>
          );
          return onToggle ? (
            <button key={m.id} type="button" className={`ui-card verse-pick ${m.slotted ? "ui-card-hl" : ""}`} title={m.about} onClick={() => onToggle(m.id)}>{body}</button>
          ) : (
            <div key={m.id} className={`ui-card ${m.slotted ? "ui-card-hl" : ""}`} title={m.about}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}

export type DetailTab = "overview" | "abilities" | "moves" | "tasks";

/**
 * The full card for one ghost: portrait, badges, health and XP, then tabs for its stats, abilities and
 * verses (plus Tasks when the caller passes them). `actions` sits under the tabs.
 */
export function GhostDetailCard({ g, onClose, onToggleMove, tasks, actions, head, testid }: {
  g: GhostDetail; onClose?: () => void; onToggleMove?: (id: string) => void; tasks?: ReactNode; actions?: ReactNode; head?: ReactNode; testid?: string;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  useEffect(() => { if (tab === "tasks" && !tasks) setTab("overview"); }, [tasks, tab]);
  const st = rarityStyle(g.rarity);
  const tabs: { id: DetailTab; label: ReactNode }[] = [
    { id: "overview", label: "Overview" },
    { id: "abilities", label: `Abilities ${g.abilities.length}` },
    { id: "moves", label: `Verses ${g.moves.length}` },
  ];
  if (tasks) tabs.push({ id: "tasks", label: "Tasks" });
  return (
    <div className="gear-detail ghost-detail" style={{ ["--rc" as string]: st.color }} data-testid={testid ?? "ghost-detail"}>
      <div className="ghost-detail-top">
        <GhostPortrait g={g} />
        <div className="ui-stack-sm ghost-detail-info">
          <div className="gear-detail-head">
            <div className="ui-stack-sm">
              {head ?? <p><GhostName g={g} /></p>}
              <span className="ui-row-gap">
                <RarityBadge rarity={g.rarity} />
                {g.shiny && <PaletteBadge palette={g.palette} />}
                <span className={`ghost-badge ${typeClass(g.type)}`}>{TYPES[g.type]?.name ?? g.type}</span>
                <span className={`ghost-badge ${g.abilitiesOn ? "ghost-badge-on" : ""}`}>{g.abilitiesOn ? "Abilities on" : "Abilities off"}</span>
              </span>
            </div>
            {onClose && <button type="button" className="float-win-btn" aria-label="Close" onClick={onClose}>×</button>}
          </div>
          <Meter value={g.hp} max={g.max} kind="good" label="Health" detail={`${g.hp}/${g.max}`} />
          <Meter value={g.level >= g.levelCap ? g.xpNeed : g.xp} max={g.xpNeed} kind="xp" label="XP" detail={g.level >= g.levelCap ? `Lv ${g.level} · at cap` : `${g.xp}/${g.xpNeed} → Lv ${g.level + 1}`} />
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={tabs} label="Ghost details" />
      {tab === "overview" && (
        <div className="ui-stack-sm">
          <GhostStats g={g} />
          <p className="text-dim" data-testid="ghost-fx-label">{ghostFxLabel({ type: g.type, rarity: g.rarity, level: g.level, speed: g.speed, max: g.max, seed: g.uid, shiny: g.shiny, palette: g.palette })}</p>
          {g.abilities.length > 0 && <p className="text-dim">Abilities: {g.abilities.map((a) => a.name).join(", ")}</p>}
        </div>
      )}
      {tab === "abilities" && <AbilityList g={g} />}
      {tab === "moves" && <GhostMoves g={g} onToggle={onToggleMove} />}
      {tab === "tasks" && tasks}
      {actions}
    </div>
  );
}

/** A small card for lists: rarity stripe, name, badges and a line underneath. */
export function GhostCard({ g, on, selected, onClick, children, testid }: {
  g: Pick<GhostDetail, "name" | "type" | "shiny" | "palette" | "level" | "rarity">; on?: boolean; selected?: boolean; onClick?: () => void; children?: ReactNode; testid?: string;
}) {
  const st = rarityStyle(g.rarity);
  const inner = (
    <>
      <span className="ui-row"><GhostName g={g} /></span>
      <span className="ui-row-gap"><RarityBadge rarity={g.rarity} />{g.shiny && <PaletteBadge palette={g.palette} />}</span>
      {children}
    </>
  );
  const cls = `ui-card spirit-card ghost-card ${on ? "ui-card-hl" : ""} ${selected ? "gear-card-on" : ""}`;
  return onClick ? (
    <button type="button" className={cls} style={{ ["--rc" as string]: st.color }} data-testid={testid} onClick={onClick}>{inner}</button>
  ) : (
    <div className={cls} style={{ ["--rc" as string]: st.color }} data-testid={testid}>{inner}</div>
  );
}
