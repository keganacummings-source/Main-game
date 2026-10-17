// class-gimmicks.ts
// One real playstyle trick per class (R), plus the class perk hooks. The engine calls in at a
// handful of points: tick, input, damage dealt/taken, kills, movement speed and drawing.

import { CLASS_BY_ID, classGimmick, classPerks, GIMMICKS, type GimmickDef, type PerkHook } from "./classes";
import type { Move, TypeId } from "./content";
import { drawMonster } from "./sprites";

type Pt = { x: number; y: number };
export type BossTrophy = { key: string; name: string; template: number; type: TypeId; species?: string; look?: unknown; rarity: number; level: number };
export type GimmickView = {
  id: string; name: string; about: string; cd: number; cdMax: number; left: number; dur: number; active: boolean;
  catalog: { key: string; name: string; level: number }[]; pick: string | null;
};

const FORM_KINDS = new Set(["cat", "rabbit", "bossform", "phase", "flight"]);
const AUTO_OK = new Set(["bastion", "overload", "spiritlead", "volley", "flurry", "bossform", "tether", "trail", "pyre", "pool", "cyclone", "beam", "halo", "totem", "rain", "banner", "bloodmoon", "tempo", "oath", "blades", "decree", "tearstorm", "leap", "iaido"]);

let catImg: HTMLImageElement | null = null;
let rabbitImg: HTMLImageElement | null = null;
function img(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  const i = new Image();
  i.src = src;
  return i;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export class Gimmicks {
  // The engine is plain JS-ish (untyped fields), so it is held loosely here.
  g: any;
  id = "";
  t = 0;
  cd = 0;
  cdMax = 0;
  dur = 0;
  tick0 = 0;
  data: any = {};
  inGim = false;
  pounce = 0;
  hopT = 0;
  hookCache = { key: "", sums: {} as Partial<Record<PerkHook, number>> };

  constructor(g: any) { this.g = g; }

  def(): GimmickDef | null { return classGimmick(this.g.save?.classId); }
  active(kind?: string): boolean { return this.t > 0 && (!kind || this.id === kind); }
  hook(kind: PerkHook): number {
    const key = `${this.g.save?.classId}|${classPerks(this.g.save?.classId).map((p) => p.id).join(",")}`;
    if (this.hookCache.key !== key) {
      const sums: Partial<Record<PerkHook, number>> = {};
      for (const p of classPerks(this.g.save?.classId)) if (p.hook) sums[p.hook.kind] = (sums[p.hook.kind] ?? 0) + p.hook.v;
      this.hookCache = { key, sums };
    }
    return this.hookCache.sums[kind] ?? 0;
  }
  chan(id: string): number { return Math.max(0, this.g.chan?.(id) ?? 0); }
  transformed(): boolean { return this.t > 0 && FORM_KINDS.has(this.id); }
  power(): number { return 1 + (this.hook("gimmickPower") + this.chan("gimmick_power")) / 100; }
  mouse(): Pt { return this.data.aim ?? this.g.mouseWorld ?? { x: this.g.save.x + this.g.facing * 60, y: this.g.save.y }; }
  me(): Pt { return { x: this.g.save.x, y: this.g.save.y }; }
  say(t: string, c = "#e6c15a") { this.g.float(this.g.save.x, this.g.save.y - 70, t, c); }

  /** A gimmick hit runs through the normal hit maths, so element, crits and kills all agree. */
  hit(mob: any, power: number, type: TypeId, effect = "none", opts: { form?: string; crit?: boolean; mult?: number } = {}) {
    if (!mob?.alive) return;
    const mv: Move = { id: `gm_${this.id}`, name: GIMMICKS[this.id]?.name ?? "Gimmick", type, power, accuracy: 100, crit: 6, priority: 1, effect, anim: [], range: 60, about: "", form: (opts.form ?? "spell") as Move["form"], tactic: "strike" };
    this.inGim = true;
    try { this.g.resolveHit(mv, mob, false, (opts.mult ?? 1) * this.power(), { child: true, forceCrit: !!opts.crit }); } finally { this.inGim = false; }
  }
  foes(p: Pt, r: number): any[] { return this.g.foesNear(p.x, p.y, r); }
  mote(p: Pt, c: string, type: TypeId, n = 6, spread = 50) { for (let i = 0; i < n; i++) this.g.cfx?.mote(p.x, p.y, c, type, spread, 0.5); }

  // ---------------- activation ----------------
  activate(aim?: Pt): boolean {
    const d = this.def();
    const save = this.g.save;
    if (!d || !save || this.g.dead) return false;
    if (this.t > 0 && FORM_KINDS.has(d.id)) { this.cd = Math.min(this.cd, this.cdMax); this.end(); return true; }
    if (this.cd > 0) { this.say(`${d.name} ${Math.ceil(this.cd)}s`, "#9a8a7a"); return false; }
    this.data = { aim: aim ?? null };
    const at = this.mouse();
    const haste = Math.min(0.5, (this.hook("gimmickHaste") + this.chan("gimmick_haste")) / 100);
    let dur = d.dur * (1 + (this.hook("gimmickTime") + this.chan("afterimage")) / 100);
    if (d.id === "spiritlead" && !(this.g.activeSpirits?.() ?? []).some((sp: any) => sp.hp > 0)) { this.say("No spirits out to lead (G)", "#c9a6e8"); return false; }
    if (d.id === "bossform") {
      const cat: BossTrophy[] = save.bossCatalog ?? [];
      const pick = cat.find((b) => b.key === save.bossForm) ?? cat[cat.length - 1];
      if (!pick) { this.say("No trophies yet: slay a boss first", "#c9a6e8"); return false; }
      this.data.boss = pick;
      dur *= 1 + this.hook("bossPower") / 120;
      this.g.say(`You wear the skin of ${pick.name}.`);
    }
    this.id = d.id;
    this.t = dur;
    this.dur = dur;
    this.cdMax = d.cd * (1 - haste);
    this.cd = this.cdMax + (dur > 1 ? dur : 0);
    this.tick0 = 0;
    this.g.cfx?.nova(save.x, save.y - 14, 46, ((CLASS_BY_ID as Record<string, { type: TypeId }>)[save.classId]?.type ?? "light"));
    this.start(d.id, at);
    this.g.shake = Math.max(this.g.shake ?? 0, 3);
    this.say(d.name.toUpperCase(), "#fff1a8");
    return true;
  }

  start(id: string, at: Pt) {
    const me = this.me();
    if (id === "blink") { this.blinkTo(at, 99999); this.t = 0; this.cd = this.cdMax; }
    if (id === "leap" || id === "iaido" || id === "grapple") {
      const ang = Math.atan2(at.y - me.y, at.x - me.x);
      const reach = Math.min(dist(me, at), id === "leap" ? 320 : id === "iaido" ? 260 : 280);
      const to = this.g.openSpot(me.x + Math.cos(ang) * reach, me.y + Math.sin(ang) * reach);
      if (id === "grapple") {
        const foe = this.foes(at, 44)[0];
        if (foe) {
          const pull = this.g.openSpot(me.x + Math.cos(ang) * 30, me.y + Math.sin(ang) * 30);
          this.g.cfx?.link(me.x, me.y - 14, foe.x, foe.y - 14, "water");
          foe.x = pull.x; foe.y = pull.y;
          this.g.applyMobStatus(foe, "sleep", 1.6);
          this.hit(foe, 34, "water", "soak", { form: "melee" });
          this.t = 0;
          return;
        }
      }
      this.data.from = me; this.data.to = to;
    }
    if (id === "tether") this.data.chain = this.foes(me, 170).slice(0, 4).map((m: any) => m.id);
    if (id === "pool" || id === "totem" || id === "rain") this.data.at = { ...at };
    if (id === "banner") this.data.at = { ...me };
    if (id === "trail") this.data.pts = [];
    if (id === "oath") this.data.stored = 0;
    if (id === "decree") {
      this.data.marked = new Set();
      for (const m of this.foes(me, 170)) { this.g.applyMobStatus(m, "sleep", 3); this.data.marked.add(m.id); }
      this.g.cfx?.nova(me.x, me.y - 10, 170, "light");
    }
    if (id === "phase") this.g.say("Wraith Veil: only ghosts can touch you now, and only ghosts can be touched.");
  }

  blinkTo(p: Pt, max: number) {
    const me = this.me();
    const ang = Math.atan2(p.y - me.y, p.x - me.x);
    const r = Math.min(max, dist(me, p));
    const to = this.g.openSpot(me.x + Math.cos(ang) * r, me.y + Math.sin(ang) * r);
    this.mote(me, "#9a6cff", "void", 14, 70);
    this.g.save.x = to.x; this.g.save.y = to.y;
    this.g.dest = null;
    this.g.cam.x = to.x; this.g.cam.y = to.y;
    this.mote(to, "#c9a6ff", "void", 14, 70);
    this.g.cfx?.nova(to.x, to.y - 12, 36, "void");
  }

  /** Double-click on the map: Phasewalker teleports there. */
  dblclick(p: Pt) {
    if (this.def()?.id !== "blink" || this.g.dead) return;
    if (this.cd > 0) { this.say(`Rift ${this.cd.toFixed(1)}s`, "#9a8a7a"); return; }
    this.id = "blink";
    this.cdMax = GIMMICKS.blink.cd * (1 - Math.min(0.5, (this.hook("gimmickHaste") + this.chan("gimmick_haste")) / 100));
    this.cd = this.cdMax;
    this.blinkTo(p, 99999);
    const echo = this.hook("gimmickHaste") > 0;
    if (echo) for (const m of this.foes(p, 60)) this.hit(m, 22, "void", "gloom");
  }

  end() {
    const id = this.id;
    this.t = 0;
    if (id === "cat") { this.pounce = 4; this.say("CAT STRIKE READY", "#c9a6ff"); }
    if (id === "oath" && this.data.stored > 0) {
      const me = this.me();
      for (const m of this.foes(me, 120)) this.g.applyMobDamage(m, Math.floor(this.data.stored * 2 * this.power()), true);
      this.g.cfx?.nova(me.x, me.y - 12, 120, "light");
      this.say(`RETRIBUTION ${Math.floor(this.data.stored * 2)}`, "#fff1a8");
    }
    if (id === "flight") {
      const at = this.g.openSpot(this.g.save.x, this.g.save.y);
      this.g.save.x = at.x; this.g.save.y = at.y;
    }
    if (FORM_KINDS.has(id)) this.mote(this.me(), "#fff1a8", "light", 16, 80);
  }

  autoUse(foe: any) {
    const d = this.def();
    if (!d || this.cd > 0 || this.t > 0 || !foe || !AUTO_OK.has(d.id)) return false;
    if (d.id === "bossform" && !(this.g.save.bossCatalog ?? []).length) return false;
    if (d.id === "halo" && this.g.save.hp > this.g.maxHp() * 0.45) return false;
    return this.activate({ x: foe.x, y: foe.y });
  }

  // ---------------- per frame ----------------
  tick(dt: number) {
    const save = this.g.save;
    if (!save) return;
    if (this.def()?.id !== this.id && this.t > 0) this.end();
    this.cd = Math.max(0, this.cd - dt);
    this.pounce = Math.max(0, this.pounce - dt);
    if (this.t <= 0) return;
    this.t -= dt;
    this.tick0 += dt;
    const me = this.me();
    const id = this.id;
    const every = (s: number) => {
      this.data.acc = (this.data.acc ?? 0) + dt;
      if (this.data.acc < s) return false;
      this.data.acc -= s;
      return true;
    };
    const k = Math.min(1, this.tick0 / Math.max(0.05, this.dur));
    if (id === "leap" || id === "iaido" || (id === "grapple" && this.data.to)) {
      const f = this.data.from, to = this.data.to;
      save.x = f.x + (to.x - f.x) * k; save.y = f.y + (to.y - f.y) * k;
      this.g.dest = null;
      if (id === "iaido") this.mote(me, "#ff8a4a", "fire", 2, 20);
      if (this.t <= 0) {
        if (id === "leap") { for (const m of this.foes(to, 92)) this.hit(m, 60, "earth", "root", { form: "melee" }); this.g.cfx?.nova(to.x, to.y - 6, 92, "earth"); this.g.shake = 8; }
        if (id === "iaido") for (const m of this.g.mobs.filter((m: any) => m.alive && segDist(m, f, to) < 28)) this.hit(m, 70, "fire", "burn", { form: "melee", crit: true });
      }
    }
    if (id === "spiritlead" && every(0.5)) for (const at of this.g.mates ?? []) { const m = this.foes(at, 46)[0]; if (m) { this.hit(m, 24, "spirit", "gloom"); this.mote(at, "#c9f0ff", "spirit", 4, 30); } }
    if (id === "volley" && every(0.5)) {
      const aim = this.mouse();
      const m = this.g.mobs.filter((x: any) => x.alive && dist(x, me) < 320).sort((a: any, b: any) => dist(a, aim) - dist(b, aim))[0];
      if (m) { this.g.cfx?.link(me.x, me.y - 16, m.x, m.y - 14, "air"); this.hit(m, 30, "air", "none", { form: "ranged" }); }
    }
    if (id === "flurry" && every(0.1)) { for (const m of this.foes(me, 58)) this.hit(m, 9, "normal", "none", { form: "melee" }); this.mote({ x: me.x + (Math.random() - 0.5) * 50, y: me.y - 16 }, "#fff1a8", "normal", 2, 10); }
    if (id === "tether" && every(0.5)) for (const mid of this.data.chain ?? []) {
      const m = this.g.mobs.find((x: any) => x.id === mid && x.alive);
      if (!m || dist(m, me) > 260) continue;
      const amt = Math.max(2, Math.floor(m.max * 0.012 + save.level * 0.8) * this.power());
      this.g.applyMobDamage(m, amt, false);
      save.hp = Math.min(this.g.maxHp(), save.hp + amt * 0.7);
    }
    if (id === "trail") {
      if (every(0.12)) this.data.pts.push({ x: me.x, y: me.y, t: 3.2 });
      for (const p of this.data.pts) p.t -= dt;
      this.data.pts = this.data.pts.filter((p: any) => p.t > 0);
      this.data.hitAcc = (this.data.hitAcc ?? 0) + dt;
      if (this.data.hitAcc > 0.4) {
        this.data.hitAcc = 0;
        for (const m of this.g.mobs) if (m.alive && this.data.pts.some((p: any) => dist(p, m) < 18)) this.hit(m, 18, "ice", "root", { form: "melee" });
      }
    }
    const aura = (r: number, pw: number, type: TypeId, eff: string, gap: number, heal = 0) => {
      if (!every(gap)) return;
      const hit = this.foes(me, r);
      for (const m of hit) this.hit(m, pw, type, eff);
      if (heal && hit.length) save.hp = Math.min(this.g.maxHp(), save.hp + this.g.maxHp() * heal * hit.length);
    };
    if (id === "pyre") aura(84, 20, "fire", "burn", 0.5);
    if (id === "tearstorm") aura(110, 16, "water", "soak", 0.6, 0.01);
    if (id === "bloodmoon") aura(70, 12, "ghoul", "leech", 0.7);
    if (id === "cyclone") aura(42, 16, "air", "none", 0.25);
    if (id === "blades") {
      const ang = this.tick0 * 6;
      this.data.hitT = this.data.hitT ?? {};
      for (let i = 0; i < 3; i++) {
        const b = { x: me.x + Math.cos(ang + i * 2.09) * 50, y: me.y - 10 + Math.sin(ang + i * 2.09) * 30 };
        for (const m of this.foes(b, 18)) {
          if ((this.data.hitT[m.id] ?? 0) > this.tick0) continue;
          this.data.hitT[m.id] = this.tick0 + 0.4;
          this.hit(m, 20, "spirit", "gloom", { form: "melee" });
        }
      }
    }
    if (id === "pool") {
      const at = this.data.at;
      if (dist(me, at) < 72) save.hp = Math.min(this.g.maxHp(), save.hp + this.g.maxHp() * 0.04 * dt);
      if (every(1)) for (const m of this.foes(at, 72)) this.hit(m, 14, "water", "soak");
    }
    if (id === "totem" && every(1)) for (const m of this.foes(this.data.at, 112)) this.hit(m, 16, "spirit", "gloom");
    if (id === "rain" && every(0.22)) {
      const list = this.foes(this.data.at, 84);
      const m = list[Math.floor(Math.random() * list.length)];
      if (m) this.hit(m, 14 + Math.min(40, (save.kyo ?? 0) / 250), "normal", "none", { form: "ranged" });
      this.mote({ x: this.data.at.x + (Math.random() - 0.5) * 120, y: this.data.at.y - 40 }, "#e6c15a", "normal", 1, 10);
    }
    if (id === "beam" && every(0.2)) {
      const aim = this.mouse();
      const ang = Math.atan2(aim.y - me.y, aim.x - me.x);
      const end = { x: me.x + Math.cos(ang) * 260, y: me.y + Math.sin(ang) * 260 };
      this.data.end = end;
      for (const m of this.g.mobs) if (m.alive && segDist(m, me, end) < 20) this.hit(m, 18, "light", "expose");
    }
    if (id === "tempo" && every(1.6)) for (const m of this.foes(me, 220)) this.g.applyMobStatus(m, "root", 1.1);
    if (id === "rabbit") {
      this.hopT += dt;
      if (this.hopT > 0.55) {
        this.hopT = 0;
        const aim = this.g.mouseWorld;
        if (aim && dist(aim, me) > 36 && !this.g.autoplay) this.g.dest = { x: aim.x, y: aim.y };
        if (this.g.moving) { for (const m of this.foes(me, 60)) this.hit(m, 18, "air", "none", { form: "melee" }); this.mote(me, "#e8f0ff", "air", 6, 40); }
      }
    }
    if (this.t <= 0) this.end();
  }

  // ---------------- hooks ----------------
  speedMult(): number {
    let k = 1;
    if (this.g.combat > 0) k *= 1 + this.hook("combatSpeed") / 100;
    if (this.t <= 0) return k;
    const form = 1 + this.hook("formSpeed") / 100;
    if (this.id === "cat") return k * 4 * form;
    if (this.id === "rabbit") return k * 2 * form;
    if (this.id === "cyclone") return k * 2;
    if (this.id === "flight") return k * 1.6 * form;
    if (this.id === "bossform") return k * 0.9;
    if (this.id === "bastion" || this.id === "flurry") return 0;
    if (this.id === "leap" || this.id === "iaido") return 0;
    return k;
  }
  flying(): boolean { return this.active("flight"); }
  leading(): boolean { return this.active("spiritlead"); }
  cdRate(): number { return this.active("tempo") ? 2 : 1; }
  leadGhost(at: any, i: number, dt: number) {
    const m = this.g.mouseWorld ?? this.me();
    const n = Math.max(1, (this.g.mates ?? []).length);
    const ang = this.tick0 * 1.4 + (i / n) * Math.PI * 2;
    const tx = m.x + Math.cos(ang) * 28, ty = m.y + Math.sin(ang) * 16;
    const k = 1 - Math.exp(-dt * 7);
    const px = at.x;
    at.x += (tx - at.x) * k; at.y += (ty - at.y) * k;
    if (Math.abs(at.x - px) > 0.05) at.facing = at.x > px ? 1 : -1;
  }
  isGhost(m: any): boolean { return !!(m?.ghost || m?.enemyGhost || m?.bountySpirit); }

  /** Multiplier on damage you deal to `mob`. 0 means the hit cannot land. */
  dealMult(mob: any): number {
    const save = this.g.save;
    let k = 1;
    if (this.active("phase") && !this.isGhost(mob)) return 0;
    if (this.isGhost(mob)) k *= 1 + this.hook("ghostPower") / 100;
    if (mob.hp >= mob.max) k *= 1 + this.hook("firstStrike") / 100;
    if (mob.hp < mob.max * 0.35) k *= 1 + this.hook("execute") / 100;
    if (mob.boss || mob.dungeonBoss) k *= 1 + this.hook("bossPower") / 100;
    if (save.hp < this.g.maxHp() * 0.4) k *= 1 + this.hook("lowHpPower") / 100;
    if (dist(mob, save) > 120) k *= 1 + this.hook("farPower") / 100;
    if (this.transformed()) k *= 1 + this.chan("form_fury") / 100;
    if (this.active("bossform")) k *= 1.35 + (this.data.boss?.level ?? 0) * 0.004;
    if (this.active("banner") && dist(save, this.data.at) < 130) k *= 1.3;
    if (this.active("decree") && this.data.marked?.has(mob.id)) k *= 1.3;
    if (this.pounce > 0 && !this.inGim) { k *= 2; this.pounce = 0; this.g.float(mob.x, mob.y - 52, "CAT STRIKE ×2", "#c9a6ff"); }
    return k;
  }
  onHit(mob: any, dmg: number, crit: boolean) {
    const save = this.g.save;
    const roll = (v: number) => v > 0 && Math.random() * 100 < v;
    if (crit) {
      if (this.hook("critHeal")) save.hp = Math.min(this.g.maxHp(), save.hp + this.g.maxHp() * this.hook("critHeal") / 100);
      if (this.hook("critHaste")) this.cd = Math.max(0, this.cd - this.cdMax * this.hook("critHaste") / 100);
    }
    if (this.hook("hitHaste")) for (const id of Object.keys(this.g.cds)) this.g.cds[id] = Math.max(0, this.g.cds[id] - this.hook("hitHaste") / 100);
    for (const [kind, st] of [["rootOnHit", "root"], ["burnOnHit", "burn"], ["soakOnHit", "soak"], ["gloomOnHit", "gloom"]] as const) if (roll(this.hook(kind))) this.g.applyMobStatus(mob, st, 3);
    if (roll(this.hook("kyoOnHit"))) { const n = 1 + Math.floor(Math.random() * 3); save.kyo = (save.kyo ?? 0) + n; this.g.float(mob.x, mob.y - 58, `+${n} kyo`, "#e6c15a"); }
    if (this.active("bloodmoon")) save.hp = Math.min(this.g.maxHp(), save.hp + dmg * 0.4);
    if (this.inGim) return;
    if (roll(this.hook("echoHit"))) this.g.later(0.14, () => { if (mob.alive) this.g.applyMobDamage(mob, Math.max(1, Math.floor(dmg * 0.5)), false); });
    if (this.active("overload")) {
      const near = this.foes(mob, 140).filter((m: any) => m !== mob).slice(0, 2);
      for (const m of near) { this.g.cfx?.link(mob.x, mob.y - 14, m.x, m.y - 14, "electric"); this.g.applyMobDamage(m, Math.max(1, Math.floor(dmg * 0.45 * this.power())), false); }
    }
  }
  /** Before a foe's hit lands: may refuse it entirely. */
  allowHit(m: any, form: string): boolean {
    const save = this.g.save;
    this.data.attacker = m;
    if (this.active("phase") && !this.isGhost(m)) { this.g.float(save.x, save.y - 36, "PHASED", "#9ad8ff"); return false; }
    if (this.active("flight") && form === "melee") { this.g.float(save.x, save.y - 36, "AIRBORNE", "#fff1a8"); return false; }
    if (this.active("cyclone") && Math.random() < 0.35) { this.g.float(save.x, save.y - 36, "SWEPT", "#e7d9ff"); return false; }
    if (Math.random() * 100 < this.hook("dodge")) { this.g.float(save.x, save.y - 36, "SLIP", "#9ad8c8"); return false; }
    if (Math.random() * 100 < this.hook("sparkBack")) this.g.applyMobStatus(m, "spark", 3);
    return true;
  }
  /** Scales damage you are about to take. */
  hurtMult(amount: number): number {
    const save = this.g.save;
    let k = 1;
    if (!this.g.moving) k *= 1 - this.hook("standStill") / 100;
    if (save.hp < this.g.maxHp() * 0.4) k *= 1 - this.hook("lowHpGuard") / 100;
    if (this.transformed()) k *= 1 - this.chan("form_fury") / 200;
    if (this.t > 0) {
      if (this.id === "bastion") {
        k *= 0.2;
        const a = this.data.attacker;
        if (a?.alive) this.g.applyMobDamage(a, Math.max(1, Math.floor(amount * 0.5)), false);
      }
      if (this.id === "bossform") k *= 0.7;
      if (this.id === "banner" && dist(save, this.data.at) < 130) k *= 0.75;
      if (this.id === "oath") { this.data.stored += amount; k *= 0.5; }
      if (this.id === "halo") { k *= 0.5; save.hp = Math.min(this.g.maxHp(), save.hp + amount * 0.5); }
    }
    return Math.max(0, k);
  }
  afterHurt(dmg: number) {
    const v = this.hook("thorns");
    if (v > 0) {
      const foe = this.g.nearestMob(this.g.save.x, this.g.save.y, 200);
      if (foe?.alive) this.g.applyMobDamage(foe, Math.max(1, Math.floor(dmg * v / 100)), false);
    }
  }
  saveFromDeath(): boolean { return this.active("halo"); }
  onKill(mob: any) {
    const save = this.g.save;
    if (!save) return;
    if (this.hook("killHeal")) save.hp = Math.min(this.g.maxHp(), save.hp + this.g.maxHp() * this.hook("killHeal") / 100);
    if (this.hook("killShield")) this.g.shield = (this.g.shield ?? 0) + this.g.maxHp() * this.hook("killShield") / 100;
    if (mob.boss || mob.dungeonBoss) {
      const key = String(mob.bossId ?? mob.species ?? mob.name);
      save.bossCatalog = save.bossCatalog ?? [];
      const was = save.bossCatalog.find((b: BossTrophy) => b.key === key);
      const row: BossTrophy = { key, name: mob.name, template: mob.template ?? 0, type: mob.type, species: mob.enemyGhost ? undefined : mob.species, look: mob.look ?? null, rarity: mob.rarity ?? 0, level: mob.level ?? 1 };
      if (was) Object.assign(was, { level: Math.max(was.level, row.level) });
      else {
        save.bossCatalog.push(row);
        if (this.def()?.id === "bossform") this.g.say(`Trophy taken: ${mob.name} joins your catalog of skins.`);
      }
    }
  }
  pickBoss(key: string) { if (this.g.save) this.g.save.bossForm = key; }

  view(): GimmickView | null {
    const d = this.def();
    const save = this.g.save;
    if (!d || !save) return null;
    const c = this.g.save.classId;
    return {
      id: d.id, name: d.name, about: (CLASS_BY_ID as Record<string, { passive: string }>)[c]?.passive ?? "", cd: Math.ceil(this.cd * 10) / 10, cdMax: Math.round(d.cd), left: Math.max(0, Math.ceil(this.t * 10) / 10),
      dur: Math.round(this.dur), active: this.t > 0,
      catalog: (save.bossCatalog ?? []).map((b: BossTrophy) => ({ key: b.key, name: b.name, level: b.level })), pick: save.bossForm ?? null,
    };
  }

  // ---------------- drawing ----------------
  /** Draws the player's transformed body. Returns false when the normal actor should be drawn. */
  drawForm(ctx: CanvasRenderingContext2D, a: { x: number; y: number; direction: string; moving: boolean; walk: number; facing: number; hurt: number; time: number }): boolean {
    if (this.t <= 0) return false;
    const left = a.direction === "left" || (a.direction !== "right" && a.facing < 0);
    if (this.id === "cat") {
      catImg = catImg ?? img("/sprites/form_cat.png");
      if (!catImg?.complete || !catImg.naturalWidth) return false;
      const f = a.moving ? Math.floor(a.walk * 1.5) % 6 : 0;
      const row = a.moving ? 0 : 1;
      ctx.save();
      ctx.translate(Math.round(a.x), Math.round(a.y));
      if (left) ctx.scale(-1, 1);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(-24, -3, 48, 6);
      ctx.drawImage(catImg, f * 40, row * 34, 40, 34, -38, -64, 76, 65);
      ctx.restore();
      return true;
    }
    if (this.id === "rabbit") {
      rabbitImg = rabbitImg ?? img("/sprites/form_rabbit.png");
      if (!rabbitImg?.complete || !rabbitImg.naturalWidth) return false;
      const row = a.direction === "up" ? 0 : a.direction === "down" ? 2 : 1;
      const f = a.moving ? Math.floor(a.walk) % 4 : 0;
      const hop = a.moving ? Math.abs(Math.sin(this.hopT / 0.55 * Math.PI)) * 12 : 0;
      ctx.save();
      ctx.translate(Math.round(a.x), Math.round(a.y));
      this.ring(ctx, 0, 0, 44 + Math.sin(a.time * 4) * 3, "rgba(220,230,255,.6)");
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(-18 + hop / 4, -3, 36 - hop / 2, 6);
      if (row === 1 && left) ctx.scale(-1, 1);
      ctx.drawImage(rabbitImg, f * 36, row * 36, 36, 36, -34, -68 - hop, 68, 68);
      ctx.restore();
      return true;
    }
    if (this.id === "bossform" && this.data.boss) {
      const b = this.data.boss as BossTrophy;
      drawMonster(ctx, { x: a.x, y: a.y, template: b.template, type: b.type, facing: left ? -1 : 1, walk: a.walk, hurt: a.hurt, boss: true, rarity: b.rarity, species: b.species, look: b.look as never, time: a.time } as never);
      return true;
    }
    return false;
  }
  ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
    ctx.fillStyle = c;
    for (let i = 0; i < 28; i++) {
      const t = (i / 28) * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r * 0.45), 2, 2);
    }
  }
  /** World-space effects under the actors. */
  drawUnder(ctx: CanvasRenderingContext2D, clock: number) {
    if (this.t <= 0 || !this.g.save) return;
    const me = this.me();
    const id = this.id;
    const pulse = 1 + Math.sin(clock * 6) * 0.06;
    if (id === "pool") this.ring(ctx, this.data.at.x, this.data.at.y, 72 * pulse, "rgba(90,170,255,.7)");
    if (id === "totem") { this.ring(ctx, this.data.at.x, this.data.at.y, 112, "rgba(200,170,255,.55)"); ctx.fillStyle = "#e6c15a"; ctx.fillRect(this.data.at.x - 3, this.data.at.y - 22, 6, 8); ctx.fillStyle = "#3a2a1a"; ctx.fillRect(this.data.at.x - 1, this.data.at.y - 14, 2, 14); }
    if (id === "banner") { this.ring(ctx, this.data.at.x, this.data.at.y, 130, "rgba(220,60,50,.55)"); ctx.fillStyle = "#3a2a1a"; ctx.fillRect(this.data.at.x - 1, this.data.at.y - 40, 2, 40); ctx.fillStyle = "#c4302a"; ctx.fillRect(this.data.at.x + 1, this.data.at.y - 40, 14, 9); }
    if (id === "rain") this.ring(ctx, this.data.at.x, this.data.at.y, 84, "rgba(230,193,90,.6)");
    if (id === "pyre") this.ring(ctx, me.x, me.y, 84 * pulse, "rgba(255,120,40,.6)");
    if (id === "tearstorm") this.ring(ctx, me.x, me.y, 110 * pulse, "rgba(120,190,255,.55)");
    if (id === "bloodmoon") this.ring(ctx, me.x, me.y, 70 * pulse, "rgba(170,20,40,.6)");
    if (id === "tempo") this.ring(ctx, me.x, me.y, 220, "rgba(180,220,255,.35)");
    if (id === "bastion") this.ring(ctx, me.x, me.y, 26, "rgba(255,241,168,.8)");
    if (id === "spiritlead" && this.g.mouseWorld) this.ring(ctx, this.g.mouseWorld.x, this.g.mouseWorld.y, 30 * pulse, "rgba(200,240,255,.7)");
    if (id === "trail") for (const p of this.data.pts ?? []) { ctx.fillStyle = `rgba(190,235,255,${Math.min(0.8, p.t / 2)})`; ctx.fillRect(Math.round(p.x) - 6, Math.round(p.y) - 2, 12, 4); }
  }
  /** World-space effects over the actors. */
  drawOver(ctx: CanvasRenderingContext2D, clock: number) {
    if (!this.g.save) return;
    const me = this.me();
    if (this.pounce > 0) this.ring(ctx, me.x, me.y - 2, 16, "rgba(200,160,255,.8)");
    if (this.t <= 0) return;
    const id = this.id;
    if (id === "beam" && this.data.end) {
      ctx.fillStyle = "rgba(255,241,168,.75)";
      const e = this.data.end, n = 26;
      for (let i = 0; i < n; i++) ctx.fillRect(Math.round(me.x + (e.x - me.x) * i / n) - 2, Math.round(me.y - 16 + (e.y - me.y) * i / n) - 2, 5, 5);
    }
    if (id === "tether") for (const mid of this.data.chain ?? []) {
      const m = this.g.mobs.find((x: any) => x.id === mid && x.alive);
      if (!m) continue;
      ctx.fillStyle = "rgba(90,210,120,.8)";
      for (let i = 0; i < 12; i++) ctx.fillRect(Math.round(me.x + (m.x - me.x) * i / 12), Math.round(me.y - 14 + (m.y - me.y) * i / 12 + Math.sin(clock * 10 + i) * 2), 2, 2);
    }
    if (id === "blades") {
      const ang = this.tick0 * 6;
      for (let i = 0; i < 3; i++) {
        const x = me.x + Math.cos(ang + i * 2.09) * 50, y = me.y - 10 + Math.sin(ang + i * 2.09) * 30;
        ctx.fillStyle = "#1a1014"; ctx.fillRect(Math.round(x) - 4, Math.round(y) - 2, 9, 5);
        ctx.fillStyle = "#e7d9ff"; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 1, 7, 3);
      }
    }
    if (id === "cyclone") for (let i = 0; i < 10; i++) { const t = clock * 9 + i; ctx.fillStyle = "rgba(230,240,255,.7)"; ctx.fillRect(Math.round(me.x + Math.cos(t) * (8 + i * 2)), Math.round(me.y - 4 - i * 3 + Math.sin(t) * 3), 3, 2); }
    if (id === "flight") { ctx.fillStyle = "rgba(255,255,255,.85)"; const f = Math.sin(clock * 12) * 4; ctx.fillRect(Math.round(me.x) - 18, Math.round(me.y) - 34 + f, 10, 3); ctx.fillRect(Math.round(me.x) + 8, Math.round(me.y) - 34 + f, 10, 3); }
    if (id === "phase") this.ring(ctx, me.x, me.y - 18, 20 + Math.sin(clock * 5) * 2, "rgba(150,220,255,.6)");
    if (id === "overload") for (let i = 0; i < 3; i++) { ctx.fillStyle = "#fff36a"; ctx.fillRect(Math.round(me.x + Math.cos(clock * 8 + i * 2) * 14), Math.round(me.y - 30 + Math.sin(clock * 8 + i * 2) * 8), 2, 2); }
    if (id === "halo") { ctx.fillStyle = "#fff1a8"; ctx.fillRect(Math.round(me.x) - 7, Math.round(me.y) - 64, 14, 2); }
  }
}
