// class-gimmicks.ts
// One real playstyle trick per class (R), plus the class perk hooks. The engine calls in at a
// handful of points: tick, input, damage dealt/taken, kills, movement speed and drawing.

import { CLASS_BY_ID, classGimmick, classPerks, GIMMICKS, hasPassive, type GimmickDef, type PerkHook } from "./classes";
import type { Move, TypeId } from "./content";
import { drawMonster } from "./sprites";

type Pt = { x: number; y: number };
export type BossTrophy = { key: string; name: string; template: number; type: TypeId; species?: string; look?: unknown; rarity: number; level: number };
export type GimmickView = {
  id: string; name: string; about: string; cd: number; cdMax: number; left: number; dur: number; active: boolean;
  catalog: { key: string; name: string; level: number }[]; pick: string | null;
};

const FORM_KINDS = new Set(["cat", "rabbit", "bossform", "phase", "flight"]);
const AUTO_OK = new Set(["bastion", "overload", "spiritlead", "volley", "flurry", "bossform", "tether", "trail", "pyre", "pool", "cyclone", "beam", "halo", "totem", "rain", "banner", "bloodmoon", "tempo", "oath", "blades", "decree", "tearstorm", "leap", "iaido", "loop", "surge", "throne", "crown", "shatter", "luminary", "hunger", "font", "cataclysm", "resonance", "overclock"]);
const CURSES = ["gloom", "burn", "soak", "expose", "spark", "leech", "root"];

let catImg: HTMLImageElement | null = null;
/** Running state for the class passives (classes.ts CLASS_PASSIVES). Reset when the class changes. */
type PassiveState = {
  cls: string; spells: number; slipT: number; bargainCd: number; healT: number; healPer: number; wardT: number; wardUp: boolean;
  vengeT: number; firstHit: Set<string>; wingsCd: number; critNext: boolean; momN: number; momT: number; kills: number;
  soulN: number; soulT: number; cataT: number;
  cat: { x: number; y: number; t: number; target: string | null; walk: number; facing: number; moving: boolean } | null;
};
const freshPassive = (cls: string): PassiveState => ({
  cls, spells: 0, slipT: 0, bargainCd: 0, healT: 0, healPer: 0, wardT: 0, wardUp: true, vengeT: 0, firstHit: new Set(), wingsCd: 0,
  critNext: false, momN: 0, momT: 0, kills: 0, soulN: 0, soulT: 0, cataT: 0, cat: null,
});
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
  ps: PassiveState = freshPassive("");

  constructor(g: any) { this.g = g; }
  /** Does the player have this class passive on (their own, or one the Crying Girl borrowed)? */
  pas(id: string): boolean { return hasPassive(this.g.save?.classId, id); }
  /** Passive state, reset whenever the class changes. */
  st(): PassiveState {
    const cls = this.g.save?.classId ?? "";
    if (this.ps.cls !== cls) this.ps = freshPassive(cls);
    return this.ps;
  }
  /** Max-health multiplier from forms (Trophy Skins doubles it). */
  hpMult(): number { return this.active("bossform") ? 2 : 1; }
  /** Passives that force a crit on this hit (Iaijutsu's first hit, Lunar Grace after a slip). Consumes the charge. */
  forceCrit(mob: any): boolean {
    const p = this.st();
    let force = false;
    if (this.pas("iaijutsu") && mob?.id && !p.firstHit.has(mob.id)) { p.firstHit.add(mob.id); force = true; }
    if (this.pas("lunar_grace") && p.critNext) { p.critNext = false; force = true; }
    if (p.firstHit.size > 400) p.firstHit.clear();
    return force;
  }
  /** Rift Step: blink verses come straight back. */
  freeBlink(): boolean { return this.pas("rift_step"); }
  /** Mana Font: spell cooldowns 15% faster. */
  spellCdMult(): number { return this.active("font") ? 0 : this.pas("mana_font") ? 0.85 : 1; }
  /** Arcane Font halves spell mana costs while it runs. */
  spellCostMult(): number { return this.active("font") || this.pas("mana_font") ? 0.5 : 1; }
  /** Hybrid Arrows: every verse is half physical, half magic. */
  hybrid(): boolean { return this.pas("hybrid_arrows"); }
  /** Perfect Aim: verses never miss and cannot be dodged. */
  trueAim(): boolean { return this.pas("perfect_aim"); }

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
  /** Like hook(), but perks tied to an attack form (melee, spell) only count for hits of that form. */
  hookFor(kind: PerkHook, form?: string): number {
    let v = 0;
    for (const p of classPerks(this.g.save?.classId)) if (p.hook?.kind === kind && (!p.hook.form || p.hook.form === form)) v += p.hook.v;
    return v;
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
      this.g.say(`You wear the skin of ${pick.name}: twice your size, twice your strength.`);
    }
    // Trophy Skins doubles max health while worn, so double what you have too (and halve it back on the way out).
    const wasMax = this.g.maxHp();
    this.id = d.id;
    this.t = dur;
    this.dur = dur;
    if (d.id === "bossform") save.hp = Math.min(this.g.maxHp(), Math.round(save.hp * (this.g.maxHp() / Math.max(1, wasMax))));
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
    if (id === "throne") {
      // Six stone pillars in a ring around the aim point; each roots what it lands on.
      this.data.at = { ...at };
      this.data.pts = Array.from({ length: 6 }, (_, i) => ({ x: at.x + Math.cos(i * Math.PI / 3) * 52, y: at.y + Math.sin(i * Math.PI / 3) * 34 }));
      const struck = new Set<any>();
      for (const pt of this.data.pts) { this.g.cfx?.nova(pt.x, pt.y - 6, 30, "earth"); for (const m of this.foes(pt, 30)) struck.add(m); }
      for (const m of this.foes(at, 52)) struck.add(m); // anything caught inside the ring is crushed too
      for (const m of struck) { this.g.applyMobStatus(m, "root", 2); this.hit(m, 42, "earth", "root"); }
      this.g.shake = Math.max(this.g.shake ?? 0, 6);
    }
    if (id === "shatter") {
      // Freeze everything near the aim point, then shatter it. Already-frozen foes break for triple.
      let n = 0;
      for (const m of this.foes(at, 110)) {
        const frozen = (m.status ?? []).some((x: any) => x.id === "root" && x.t > 0);
        this.g.applyMobStatus(m, "root", 2);
        this.hit(m, 40, "ice", "root", { mult: frozen ? 3 : 1.5 });
        n++;
      }
      this.g.cfx?.nova(at.x, at.y - 8, 110, "ice");
      this.say(n ? `SHATTER ×${n}` : "SHATTER", "#bfefff");
      this.t = 0;
    }
    if (id === "cataclysm") {
      // Every point of mana goes into one blast: more mana spent, wider and heavier.
      const pools = this.g.pools;
      const spend = pools ? Math.max(0, pools.mana) : 40 + (this.g.save.level ?? 1) * 2;
      if (pools) { pools.mana = 0; pools.manaSlow = Math.max(pools.manaSlow ?? 0, 2); }
      const r = Math.min(220, 60 + spend * 0.6);
      const pw = Math.min(260, 30 + spend * 0.5);
      for (const m of this.foes(at, r)) this.hit(m, pw, "void", "gloom");
      this.g.cfx?.nova(at.x, at.y - 8, r, "void");
      this.g.cfx?.nova(at.x, at.y - 8, r * 0.55, "fire");
      this.g.shake = Math.max(this.g.shake ?? 0, 10);
      this.say(`CATACLYSM ${Math.round(spend)} MANA`, "#ff5a4a");
      this.t = 0;
    }
    if (id === "resonance") { this.data.amp = 0; this.data.resT = 0; }
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
    const bigMax = id === "bossform" ? this.g.maxHp() : 0;
    this.t = 0;
    if (id === "bossform" && this.g.save) this.g.save.hp = Math.max(1, Math.min(this.g.maxHp(), Math.round(this.g.save.hp * (this.g.maxHp() / Math.max(1, bigMax)))));
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
    this.tickPassives(dt);
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
    // Overclock: the grid runs hot and so does the air around her. The machine side of this lives
    // in the engine (machineMult reads this gimmick); here it is just the arc that comes off her.
    if (id === "overclock") aura(96, 22, "electric", "spark", 0.45);
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
    if (id === "surge" && every(1)) {
      for (const m of this.foes(me, 120)) {
        this.hit(m, 16, "water", "soak");
        const d = Math.max(1, dist(m, me));
        if (!m.boss && !m.dungeonBoss) { m.x += ((m.x - me.x) / d) * 26; m.y += ((m.y - me.y) / d) * 26; }
      }
      this.g.cfx?.nova(me.x, me.y - 6, 120, "water");
    }
    if (id === "throne" && every(1)) {
      for (const pt of this.data.pts ?? []) this.mote(pt, "#b08a5a", "earth", 3, 16);
      for (const m of this.foes(this.data.at, 60)) this.hit(m, 14, "earth", "root");
    }
    if (id === "crown" && every(0.4)) {
      const m = this.g.mobs.filter((x: any) => x.alive && dist(x, me) < 320).sort((a: any, b: any) => dist(a, me) - dist(b, me))[0];
      if (m) { this.g.cfx?.link(me.x, me.y - 30, m.x, m.y - 14, "air"); this.hit(m, 14, "air", "none"); }
    }
    if (id === "hunger" && every(1)) {
      for (const m of this.foes(me, 300)) {
        if (!(m.status ?? []).some((x: any) => CURSES.includes(x.id) && x.t > 0)) continue;
        const amt = Math.max(2, Math.floor(Math.min(m.max * 0.06, 40 + save.level * 6) * this.power()));
        this.g.applyMobDamage(m, amt, false);
        save.hp = Math.min(this.g.maxHp(), save.hp + amt * 0.5);
        this.g.cfx?.link(m.x, m.y - 14, me.x, me.y - 16, "ghoul");
      }
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

  // ---------------- class passives (per frame) ----------------
  tickPassives(dt: number) {
    const save = this.g.save;
    const p = this.st();
    const max = this.g.maxHp();
    const heal = (n: number) => { save.hp = Math.min(this.g.maxHp(), save.hp + n); };
    p.slipT = Math.max(0, p.slipT - dt);
    p.vengeT = Math.max(0, p.vengeT - dt);
    p.wingsCd = Math.max(0, p.wingsCd - dt);
    p.bargainCd = Math.max(0, p.bargainCd - dt);
    p.momT = Math.max(0, p.momT - dt); if (p.momT <= 0) p.momN = 0;
    p.soulT = Math.max(0, p.soulT - dt); if (p.soulT <= 0) p.soulN = 0;
    if (p.healT > 0) { p.healT -= dt; heal(p.healPer * dt); }
    if (this.g.dead) return;
    if (this.pas("last_stand") && save.hp < max * 0.3) heal(max * 0.03 * dt);
    if (this.pas("tidal_rest") && (this.g.combat ?? 0) <= 0 && save.hp < max) heal(max * 0.05 * dt);
    if (this.pas("watchful_ward") && !p.wardUp) { p.wardT += dt; if (p.wardT >= 8) { p.wardT = 0; p.wardUp = true; this.g.float(save.x, save.y - 60, "WARD READY", "#fff1a8"); } }
    if (this.pas("cataclysm") && p.cataT < 12) { p.cataT += dt; if (p.cataT >= 12) this.g.float(save.x, save.y - 62, "RUIN READY", "#ff7a7a"); }
    if (this.pas("hunting_cat")) this.tickCat(dt); else p.cat = null;
  }
  /** Hunting Cat: a pet that trots after you and harvests nodes near you. */
  tickCat(dt: number) {
    const save = this.g.save;
    const p = this.st();
    const c = p.cat ?? (p.cat = { x: save.x - 30, y: save.y + 10, t: 3, target: null, walk: 0, facing: 1, moving: false });
    // Pulled back to you after a teleport, a door or a map change.
    if (Math.hypot(c.x - save.x, c.y - save.y) > 420) { c.x = save.x - 30; c.y = save.y + 10; c.target = null; }
    c.t -= dt;
    const nodes = (this.g.world?.spawns ?? []).filter((n: any) => n.kind === "node" && n.node !== "fish");
    let goal = { x: save.x - 30 * (this.g.facing ?? 1), y: save.y + 12 };
    const node = c.target ? nodes.find((n: any) => n.id === c.target) : null;
    if (!node) c.target = null;
    if (!c.target && c.t <= 0 && !(this.g.combat > 0) && !this.g.dead) {
      c.t = 2;
      const near = nodes.filter((n: any) => Math.hypot(n.x - save.x, n.y - save.y) < 170).sort((a: any, b: any) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      if (near) c.target = near.id;
    }
    if (node) {
      goal = { x: node.x, y: node.y + 6 };
      if (Math.hypot(node.x - c.x, node.y + 6 - c.y) < 12) {
        c.target = null;
        c.t = 6;
        this.g.float(node.x, node.y - 30, "THE CAT FETCHES", "#e6c15a");
        this.g.harvestNow?.(node.id, node.node);
      }
    }
    const dx = goal.x - c.x, dy = goal.y - c.y, d = Math.hypot(dx, dy);
    c.moving = d > 6;
    if (c.moving) {
      const sp = Math.min(d * 4, node ? 170 : 150) * dt;
      c.x += (dx / d) * sp; c.y += (dy / d) * sp;
      c.walk += dt * 8;
      if (Math.abs(dx) > 1) c.facing = dx < 0 ? -1 : 1;
    }
  }
  /** The Hunting Cat passive's pet, drawn with the actors. */
  drawPet(ctx: CanvasRenderingContext2D) {
    const c = this.ps.cat;
    if (!c || !this.pas("hunting_cat")) return;
    catImg = catImg ?? img("/sprites/form_cat.png");
    if (!catImg?.complete || !catImg.naturalWidth) return;
    const f = c.moving ? Math.floor(c.walk) % 6 : 0;
    ctx.save();
    ctx.translate(Math.round(c.x), Math.round(c.y));
    if (c.facing > 0) ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(-12, -2, 24, 4);
    ctx.drawImage(catImg, f * 40, (c.moving ? 0 : 1) * 34, 40, 34, -19, -33, 38, 33);
    ctx.restore();
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
    if (this.id === "leap" || this.id === "iaido" || this.id === "throne") return 0;
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
  dealMult(mob: any, crit = false, form?: string, fromPet = false): number {
    const save = this.g.save;
    let k = 1;
    if (this.active("phase") && !this.isGhost(mob)) return 0;
    if (fromPet) return this.pas("royal_guard") ? 1.35 : 1;
    k *= this.passiveDeal(mob, crit, form);
    if (this.isGhost(mob)) k *= 1 + this.hook("ghostPower") / 100;
    if (mob.hp >= mob.max) k *= 1 + this.hook("firstStrike") / 100;
    if (mob.hp < mob.max * 0.35) k *= 1 + this.hook("execute") / 100;
    if (mob.boss || mob.dungeonBoss) k *= 1 + this.hook("bossPower") / 100;
    if (save.hp < this.g.maxHp() * 0.4) k *= 1 + this.hook("lowHpPower") / 100;
    if (dist(mob, save) > 120) k *= 1 + this.hook("farPower") / 100;
    if (this.transformed()) k *= 1 + this.chan("form_fury") / 100;
    if (crit && classPerks(save.classId).some((p) => p.id === "arc_memory")) k *= 1.15;
    if (this.active("bossform")) k *= 2 + (this.data.boss?.level ?? 0) * 0.002;
    if (this.active("banner") && dist(save, this.data.at) < 130) k *= 1.3;
    if (this.active("resonance") && form === "spell" && this.data.amp > 0 && !this.inGim) { k *= 1.4; this.data.amp--; }
    if (this.active("decree") && this.data.marked?.has(mob.id)) k *= 1.3;
    if (this.pounce > 0 && !this.inGim) { k *= 2; this.pounce = 0; this.g.float(mob.x, mob.y - 52, "CAT STRIKE ×2", "#c9a6ff"); }
    return k;
  }
  /** Damage multipliers from class passives. Some consume a charge (Vengeance, Cataclysm, Shatter Point). */
  passiveDeal(mob: any, crit: boolean, form?: string): number {
    const save = this.g.save;
    const p = this.st();
    const has = (id: string) => (mob?.status ?? []).some((x: any) => x.id === id && x.t > 0);
    let k = 1;
    if (this.inGim) return k;
    if (crit && this.pas("killing_edge")) k *= 1.5;
    if (this.pas("smoulder") && has("burn")) k *= 1.2;
    if (this.pas("slipstream") && this.g.moving) k *= 1.25;
    if (this.pas("searing_light") && has("expose")) k *= 1.15;
    if (this.pas("plunder") && (has("root") || has("sleep") || has("soak"))) k *= 1.4;
    if (this.pas("battle_rhythm")) k *= 1 + 0.06 * Math.min(5, this.foes(save, 150).length);
    if (this.pas("vengeance") && p.vengeT > 0) { k *= 1.6; p.vengeT = 0; this.g.float(mob.x, mob.y - 58, "VENGEANCE", "#fff1a8"); }
    if (this.pas("momentum")) k *= 1 + 0.05 * Math.min(10, p.momN);
    if (this.pas("crushing_weight") && has("root")) k *= 1.6;
    if (this.pas("shatter_point") && has("root")) {
      k *= 1.8;
      mob.status = (mob.status ?? []).filter((x: any) => x.id !== "root");
      this.g.float(mob.x, mob.y - 58, "SHATTER", "#bfefff");
    }
    if (this.pas("soul_harvest")) k *= 1 + 0.08 * p.soulN;
    if (this.pas("rising_tide") && form === "spell" && has("soak")) k *= 1.25;
    if (this.pas("cataclysm") && form === "spell" && p.cataT >= 12) { k *= 3; p.cataT = 0; this.g.float(mob.x, mob.y - 62, "RUIN ×3", "#ff5a4a"); this.g.shake = Math.max(this.g.shake ?? 0, 7); }
    return k;
  }
  onHit(mob: any, dmg: number, crit: boolean, form?: string, fromPet = false, moveId?: string) {
    const save = this.g.save;
    if (!fromPet && !this.inGim) this.passiveHit(mob, dmg, crit, form, moveId);
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
    if (!fromPet && form === "spell" && this.t > 0) this.spellGimmickHit(mob, dmg);
    if (roll(this.hookFor("echoHit", form))) this.g.later(0.14, () => { if (mob.alive) this.g.applyMobDamage(mob, Math.max(1, Math.floor(dmg * 0.5)), false); });
    if (this.active("overload")) {
      const near = this.foes(mob, 140).filter((m: any) => m !== mob).slice(0, 2);
      for (const m of near) { this.g.cfx?.link(mob.x, mob.y - 14, m.x, m.y - 14, "electric"); this.g.applyMobDamage(m, Math.max(1, Math.floor(dmg * 0.45 * this.power())), false); }
    }
  }
  /** Caster gimmicks that ride on every spell you land. */
  spellGimmickHit(mob: any, dmg: number) {
    const id = this.id;
    if (id === "loop") {
      // A second burn ring: 30% of the hit again over 3 seconds. Stacks with itself.
      if (mob.alive) this.g.applyMobStatus(mob, "burn", 3);
      const per = Math.max(1, Math.floor(dmg * 0.1 * this.power()));
      for (let i = 1; i <= 3; i++) this.g.later?.(i, () => { if (mob.alive) this.g.applyMobDamage(mob, per, false); });
    }
    if (id === "luminary") this.g.later?.(0.12, () => { if (mob.alive) { this.g.cfx?.nova(mob.x, mob.y - 14, 18, "light"); this.g.applyMobDamage(mob, Math.max(1, Math.floor(dmg * 0.6 * this.power())), false); } });
    if (id === "font") { const p = this.g.pools; if (p) p.mana = Math.min(p.maxMana, p.mana + 15); }
    if (id === "resonance" && (this.data.resT ?? 0) <= this.tick0) {
      this.data.resT = this.tick0 + 0.5;
      const cds = this.g.cds ?? {};
      const top = Object.keys(cds).filter((k) => cds[k] > 0).sort((a, b) => cds[b] - cds[a]).slice(0, 2);
      for (const k of top) cds[k] = 0;
      if (top.length) { this.data.amp = 2; this.say("RESONANCE", "#c9a6ff"); }
    }
  }
  /** What a landed hit does for the class passives (procs, heals, stacks). Never re-enters onHit. */
  passiveHit(mob: any, dmg: number, crit: boolean, form?: string, moveId?: string) {
    const save = this.g.save;
    const p = this.st();
    const has = (id: string) => (mob?.status ?? []).some((x: any) => x.id === id && x.t > 0);
    const heal = (n: number) => { save.hp = Math.min(this.g.maxHp(), save.hp + n); };
    const spell = form === "spell";
    if (this.pas("storm_chain") && spell && ++p.spells % 4 === 0) {
      for (const m of this.foes(mob, 150).filter((x: any) => x !== mob).slice(0, 2)) {
        this.g.cfx?.link(mob.x, mob.y - 14, m.x, m.y - 14, "electric");
        this.g.applyMobDamage(m, Math.max(1, Math.floor(dmg * 0.5)), false);
      }
    }
    if (this.pas("killing_edge") && crit) p.slipT = 3;
    if (this.pas("flowing_strikes") && moveId && (this.g.cds?.[moveId] ?? 0) > 0 && Math.random() < 0.2) { this.g.cds[moveId] = 0; this.g.float(save.x, save.y - 56, "FLOW", "#9ad8c8"); }
    if (this.pas("aftershock") && form === "melee") {
      for (const m of this.foes(mob, 60)) if (m !== mob) this.g.applyMobDamage(m, Math.max(1, Math.floor(dmg * 0.35)), false);
      this.g.cfx?.nova(mob.x, mob.y - 4, 60, "earth");
    }
    if (this.pas("searing_light") && mob.alive) this.g.applyMobStatus(mob, "expose", 3);
    if (this.pas("lingering_hex")) {
      if (has("gloom")) heal(dmg * 0.15);
      if (mob.alive) this.g.applyMobStatus(mob, "gloom", 4);
    }
    if (this.pas("plunder") && (has("root") || has("sleep") || has("soak"))) { const n = 1 + Math.floor(Math.random() * 4); save.kyo = (save.kyo ?? 0) + n; this.g.float(mob.x, mob.y - 60, `+${n} kyo`, "#e6c15a"); }
    if (this.pas("sanguine_spells") && spell) heal(dmg * 0.12);
    if (this.pas("momentum")) { p.momN = p.momT > 0 ? p.momN + 1 : 1; p.momT = 2; }
    if (this.pas("static_volley") && spell) {
      const m = this.foes(mob, 140).find((x: any) => x !== mob);
      if (m) { this.g.cfx?.link(mob.x, mob.y - 14, m.x, m.y - 14, "electric"); this.g.applyMobDamage(m, Math.max(1, Math.floor(dmg * 0.3)), false); }
    }
    if (this.pas("resonance") && spell) for (const id of Object.keys(this.g.cds ?? {})) if (id !== moveId) this.g.cds[id] = Math.max(0, this.g.cds[id] - 0.4);
    if (this.pas("rising_tide") && spell && mob.alive && Math.random() < 0.3) this.g.applyMobStatus(mob, "soak", 3);
  }
  /** Before a foe's hit lands: may refuse it entirely. */
  allowHit(m: any, form: string): boolean {
    const save = this.g.save;
    this.data.attacker = m;
    const p = this.st();
    if (this.pas("killing_edge") && p.slipT > 0) { p.slipT = 0; this.g.float(save.x, save.y - 36, "SLIP", "#c9a6ff"); return false; }
    if (this.pas("watchful_ward") && p.wardUp) { p.wardUp = false; p.wardT = 0; this.g.float(save.x, save.y - 36, "WARDED", "#fff1a8"); return false; }
    if (this.pas("lunar_grace") && Math.random() < 0.12) { p.critNext = true; this.g.float(save.x, save.y - 36, "MOON SLIP", "#e8f0ff"); return false; }
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
    const p = this.st();
    const a = this.data.attacker;
    if (this.pas("shield_wall") && a) {
      // In front: on the side you face (left/right), or above/below when you face up/down.
      const dir = this.g.direction ?? (this.g.facing < 0 ? "left" : "right");
      const ahead = dir === "left" ? a.x < save.x : dir === "right" ? a.x > save.x : dir === "up" ? a.y < save.y : a.y > save.y;
      if (ahead) k *= 0.6;
    }
    if (this.pas("battle_rhythm")) k *= 1 - 0.04 * Math.min(5, this.foes(save, 150).length);
    if (this.pas("guardian_wings") && p.wingsCd <= 0 && amount > this.g.maxHp() * 0.25) { k *= 0.5; p.wingsCd = 10; this.g.float(save.x, save.y - 44, "WINGS", "#fff1a8"); }
    if (save.hp < this.g.maxHp() * 0.4) k *= 1 - this.hook("lowHpGuard") / 100;
    if (this.transformed()) k *= 1 - this.chan("form_fury") / 200;
    if (this.t > 0) {
      if (this.id === "bastion") {
        k *= 0.2;
        const a = this.data.attacker;
        if (a?.alive) this.g.applyMobDamage(a, Math.max(1, Math.floor(amount * 0.5)), false);
      }
      if (this.id === "bossform") k *= 0.5;
      if (this.id === "throne") k *= 0.7;
      if (this.id === "banner" && dist(save, this.data.at) < 130) k *= 0.75;
      if (this.id === "oath") { this.data.stored += amount; k *= 0.5; }
      if (this.id === "halo") { k *= 0.5; save.hp = Math.min(this.g.maxHp(), save.hp + amount * 0.5); }
    }
    return Math.max(0, k);
  }
  afterHurt(dmg: number) {
    if (this.pas("vengeance") && dmg > 0) this.st().vengeT = 3;
    const v = this.hook("thorns");
    if (v > 0) {
      const foe = this.g.nearestMob(this.g.save.x, this.g.save.y, 200);
      if (foe?.alive) this.g.applyMobDamage(foe, Math.max(1, Math.floor(dmg * v / 100)), false);
    }
  }
  saveFromDeath(): boolean {
    if (this.active("halo")) return true;
    const p = this.st();
    if (this.pas("grave_bargain") && p.bargainCd <= 0) {
      p.bargainCd = 90;
      p.healT = 3; p.healPer = this.g.maxHp() * 0.1;
      this.g.float(this.g.save.x, this.g.save.y - 60, "GRAVE BARGAIN", "#9ad8a0");
      return true;
    }
    return false;
  }
  onKill(mob: any) {
    const save = this.g.save;
    if (!save) return;
    this.passiveKill(mob);
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
  /** Kill effects from class passives. */
  passiveKill(mob: any) {
    const save = this.g.save;
    const p = this.st();
    const burning = (mob?.status ?? []).some((x: any) => x.id === "burn" && x.t > 0);
    if (this.pas("smoulder") && burning) {
      const next = this.foes(mob, 120).find((x: any) => x !== mob);
      if (next) this.g.applyMobStatus(next, "burn", 4);
    }
    if (this.pas("wildfire") && burning) {
      const dmg = Math.floor(20 + save.level * 3);
      for (const m of this.foes(mob, 80)) if (m !== mob) this.g.applyMobDamage(m, dmg, false);
      this.g.cfx?.nova(mob.x, mob.y - 8, 80, "fire");
      this.g.float(mob.x, mob.y - 50, "WILDFIRE", "#ff9a4a");
    }
    if (this.pas("absolution")) {
      save.hp = Math.min(this.g.maxHp(), save.hp + this.g.maxHp() * 0.1);
      for (const sp of this.g.activeSpirits?.() ?? []) if (sp.hp > 0) sp.hp = Math.min(sp.max, sp.hp + sp.max * 0.1);
    }
    if (this.pas("golden_touch")) {
      const n = Math.min(200, Math.max(1, Math.floor((save.kyo ?? 0) * 0.05)));
      save.kyo = (save.kyo ?? 0) + n;
      this.g.float(mob.x, mob.y - 62, `+${n} kyo`, "#e6c15a");
    }
    if (this.pas("ballad") && ++p.kills % 10 === 0) {
      for (const id of Object.keys(this.g.cds ?? {})) this.g.cds[id] = 0;
      this.g.float(save.x, save.y - 64, "BALLAD · ALL VERSES READY", "#c9f0ff");
    }
    if (this.pas("soul_harvest")) { p.soulN = Math.min(6, p.soulT > 0 ? p.soulN + 1 : 1); p.soulT = 8; }
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
      // The cat sheet is drawn facing LEFT, so flip it when she walks right.
      if (!left) ctx.scale(-1, 1);
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
      // Twice your size while you wear it (scaled about your feet).
      ctx.save();
      ctx.translate(a.x, a.y); ctx.scale(2, 2); ctx.translate(-a.x, -a.y);
      drawMonster(ctx, { x: a.x, y: a.y, template: b.template, type: b.type, facing: left ? -1 : 1, walk: a.walk, hurt: a.hurt, boss: true, rarity: b.rarity, species: b.species, look: b.look as never, time: a.time } as never);
      ctx.restore();
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
    if (id === "overclock") this.ring(ctx, me.x, me.y, 96 * pulse, "rgba(120,230,255,.6)");
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
