// witch-brain.ts
// How rival witches move in a fight: hold a range that suits their class, circle instead of
// walking in a straight line, sidestep your casts, use healing spells mid-combat, and only
// retreat for a full heal before returning to surprise attack. Always keep their ghost close.

import { CLASS_BY_ID, type ClassId } from "./classes";
import { attackForm, attackRange, MOVE_BY_ID } from "./content";

type Brainy = {
  x: number; y: number; hp: number; max: number; classId?: string; kit?: string[];
  pref?: number; strafe?: number; strafeT?: number; dodgeT?: number; dodgeCd?: number; potT?: number;
  detourT?: number; detourA?: number; lastX?: number; lastY?: number; stallT?: number; facing?: number;
  retreat?: boolean; retreatT?: number; ghost?: any; gimmickT?: number;
};

function prefRange(m: Brainy): number {
  if (m.pref) return m.pref;
  const style = m.classId ? CLASS_BY_ID[m.classId as ClassId]?.fightStyle : undefined;
  const kit = (m.kit ?? []).map((id) => MOVE_BY_ID[id]).filter(Boolean);
  const ranged = kit.filter((mv) => attackForm(mv!) !== "melee");
  if (style === "melee" || ranged.length < kit.length / 2) m.pref = 40;
  else m.pref = Math.max(80, Math.min(150, Math.max(...ranged.map((mv) => attackRange(mv!))) * 0.7));
  return m.pref;
}

/** Moves an engaged witch for one frame. `g` is the engine (moveMob, castLock, float). */
export function witchSteer(g: any, m: Brainy, d: number, dx: number, dy: number, dt: number, hunting: boolean, agility: number): void {
  const ux = dx / Math.max(1, d), uy = dy / Math.max(1, d);
  m.potT = Math.max(0, (m.potT ?? 0) - dt);
  m.dodgeCd = Math.max(0, (m.dodgeCd ?? 0) - dt);
  m.retreatT = Math.max(0, (m.retreatT ?? 0) - dt);
  m.gimmickT = Math.max(0, (m.gimmickT ?? 0) - dt);

  // Prefer healing spells mid-combat. Potion only as backup; never flee just to potion.
  const hpPct = m.hp / Math.max(1, m.max);
  if (hpPct < 0.45 && m.potT <= 0 && m.hp > 0 && !m.retreat) {
    // Casting of heal is handled by higher AI; here we just top off if no spell ready soon.
    m.hp = Math.min(m.max, m.hp + m.max * 0.12);
    m.potT = 12;
    g.float(m.x, m.y - 50, "POTION", "#9ad8c8");
  }

  // Class ability (gimmick) usage is triggered by higher-level AI; keep a short cooldown marker.
  if (m.gimmickT <= 0 && hpPct < 0.6 && Math.random() < 0.15) {
    m.gimmickT = 18;
    g.float(m.x, m.y - 60, "ABILITY", "#fff1a8");
    // Actual gimmick effect applied by engine / turbz think when this flag is set.
    (m as any).useGimmick = true;
  }

  m.strafeT = (m.strafeT ?? 0) - dt;
  if (m.strafeT <= 0) { m.strafe = Math.random() < 0.5 ? -1 : 1; m.strafeT = 1.2 + Math.random() * 1.8; }

  // Sidestep a cast that is winding up at her.
  if ((g.castLock ?? 0) > 0 && m.dodgeCd <= 0 && d < 240 && Math.random() < 0.55) {
    m.dodgeT = 0.22;
    m.dodgeCd = 2.4 + Math.random() * 1.6;
    m.strafe = Math.random() < 0.5 ? -1 : 1;
  }

  const pref = prefRange(m);
  // No mid-combat flee for healing. Only full retreat when critically low and heals unavailable.
  const fleeing = !!m.retreat && m.retreatT > 0;
  let radial = fleeing ? -1.4 : Math.max(-1, Math.min(1, (d - pref) / 40));
  let tang = pref <= 40 ? (d > 90 ? 0.25 : 0.55) : 0.8;
  let sp = (hunting ? 150 : 96) * agility;
  if ((m.dodgeT ?? 0) > 0) { m.dodgeT! -= dt; radial = 0; tang = 1; sp = 340; }
  if (fleeing) sp *= 1.35;

  let vx = radial * ux + tang * (m.strafe ?? 1) * -uy;
  let vy = radial * uy + tang * (m.strafe ?? 1) * ux;

  // Stuck on a wall: swing 90° for a moment to find a way round.
  if ((m.detourT ?? 0) > 0) {
    m.detourT! -= dt;
    const c = Math.cos(m.detourA ?? 1.57), s = Math.sin(m.detourA ?? 1.57);
    [vx, vy] = [vx * c - vy * s, vx * s + vy * c];
  }
  const l = Math.hypot(vx, vy);
  if (l < 0.05) return;
  const want = sp * dt;
  const bx = m.x, by = m.y;
  g.moveMob(m, vx / l * want, vy / l * want);

  // Ensure direction tracks the intended movement vector so the sprite row updates even on tiny steps or wall nudges.
  if (typeof (m as any).direction !== "undefined") {
    const adx = vx, ady = vy;
    if (Math.hypot(adx, ady) > 0.05) {
      (m as any).direction = Math.abs(adx) >= Math.abs(ady) ? (adx < 0 ? "left" : "right") : (ady < 0 ? "up" : "down");
    }
  }
  const got = Math.hypot(m.x - bx, m.y - by);
  m.stallT = got < want * 0.3 ? (m.stallT ?? 0) + dt : 0;
  if (m.stallT > 0.35) { m.stallT = 0; m.detourT = 0.7; m.detourA = (Math.random() < 0.5 ? -1 : 1) * 1.57; m.strafe = -(m.strafe ?? 1); }
  m.facing = dx < 0 ? -1 : 1;

  // Keep personal ghost close if present.
  if (m.ghost && m.ghost.alive !== false) {
    const gd = Math.hypot((m.ghost.x ?? m.x) - m.x, (m.ghost.y ?? m.y) - m.y);
    if (gd > 40) {
      m.ghost.x = m.x + (m.ghost.x - m.x) * 0.85;
      m.ghost.y = m.y + (m.ghost.y - m.y) * 0.85;
    }
  }
}
