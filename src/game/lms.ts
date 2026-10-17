/**
 * Last Man Standing.
 *
 * 99 rival witches and you wake at level 1, spread evenly over Veilreach with its people, quests,
 * doors and ferries taken out. It is always night and the only foes are ghosts. Everything plays
 * like Hardcore (hunger, thirst, rest, campfires, chests, no healing but healing verses), and
 * anyone can swim, so every continent can be reached. The last witch alive wins.
 *
 * Rivals are real foes on the engine's mob list (so your verses, chests and nameplates all work on
 * them). Each one runs its own brain:
 *
 *  - Survive first: flee and heal (verse, potion, ward) when hurt, eat when hungry, cook raw meat,
 *    brew potions from mushrooms.
 *  - Grow: hunt ghosts of its level for experience and drops, chop and mine for camp supplies,
 *    spend skill points (a heal and a ward first, then strong attacks, a dodge, then ranks).
 *  - Gear up: keep the best piece for each of the six slots.
 *  - Hunt: once it wears a full set (or late in the match) it seeks out the other rivals and you.
 *  - Fight like a player: casters hold range, melee closes in, it dodges with its movement verses,
 *    wards when pressed and breaks off to heal.
 *
 * Rivals near you are simulated frame by frame. Rivals far away are simulated in coarse steps
 * (the same choices, resolved as outcomes) so 99 brains stay cheap.
 */
import {
  CLASSES,
  CLASS_BY_ID,
  CLASS_RACE,
  MOVES,
  MOVE_BY_ID,
  SKILLS,
  WITCH_NAMES,
  attackForm,
  attackRange,
  equipmentStats,
  gearScore,
  moveTactic,
  mulberry32,
  nextUid,
  rollGear,
  typeMult,
  xpNeed,
  type Gear,
  type Move,
} from "./content";
import type { ClassId } from "./classes";
import { blocked } from "./world";
import { defenseVs } from "./balance";
import { pickFight } from "./player-brain";
import { DAY_SECONDS, NIGHT_SECONDS } from "./daynight";

export const LMS_RIVALS = 99;
export const LMS_MAP = "custom-lms";
const SLOTS = ["weapon", "head", "chest", "legs", "feet", "relic"] as const;
const NEAR = 1400; // px: closer than this, rivals are simulated frame by frame
const SIM_STEP = 1.5; // s: coarse step for far rivals
const HUNT_LEVEL = 14; // a full set alone isn't enough: they want the levels too
const HUNT_AFTER = 18 * 60; // s: everyone hunts after this, full set or not
const NAMES = [
  ...WITCH_NAMES, "Vellum Sax", "Nix of Salt", "Sable Quill", "Ione Marr", "Cairn Hess", "Rue the Lid", "Onyx Pell", "Moss Ives",
  "Hester Vetch", "Lumen Bret", "Silt Ama", "Bram of Glass", "Nell Dusk", "Pax Yarrow", "Ivy Sorrow", "Cass of Embers", "Wren Holt",
  "Otter Vine", "Isla Thorn", "Quill Mare", "Dusk Nen", "Cress Vail", "Vetch Ora", "Nim of the Well", "Hale Mot", "Juniper Hex",
  "Tallow Mae", "Grey Pell", "Annis Coil", "Mab of Rime", "Kit the Toll", "Edda Vellum", "Noa of Pitch", "Fern Widow", "Lux of Bone",
  "Pim Salt", "Ysolde Marr", "Betony Vale", "Cressida Ash", "Morrow Kin", "Saffi Lark", "Teg of Ash", "Ulla Brine", "Vesna Hollow",
  "Wynn Tallis", "Xan Mire", "Yew Cobb", "Zell Morrow", "Agnes Rook", "Bee Thatch", "Cleo Ravel", "Dilly Moss", "Esme Flint",
  "Faye Crook", "Gilly Wode", "Hesper Lyle", "Iris Gall", "Jory Pike", "Kestrel Dun", "Lettie Sorn", "Maud Penny", "Nessa Grail",
  "Oona Brack", "Prue Lantern", "Quenby Rush", "Ros Hallow", "Sukie Tarn", "Tamsin Wold", "Una Spire", "Viv Cinder", "Willa Fen",
  "Xyla Dross", "Yara Kettle", "Zinnia Pall", "Alba Moth", "Briar Lune", "Coral Vex", "Delphine Ash", "Elva Tor", "Freya Holt",
];

type Feed = { text: string; t: number };
export type LmsMatch = {
  on: boolean; over: boolean; won: boolean; place: number; kills: number; startedAt: number; age: number; feed: Feed[]; total: number;
};
export type LmsView = { alive: number; total: number; kills: number; age: string; feed: string[]; over: boolean; won: boolean; place: number; hunting: number; nearest: string };

type RivalBrain = {
  level: number; xp: number; sp: number; ranks: Record<string, number>; known: string[]; gear: Partial<Record<(typeof SLOTS)[number], Gear>>;
  bag: Record<string, number>; food: number; state: "grind" | "gather" | "hunt" | "flee" | "heal" | "cook"; goalX: number; goalY: number;
  think: number; simT: number; kills: number; dodgeCd: number; potionCd: number; castCd: Record<string, number>; foe: string; foeT: number;
  channel: number; channelNode: string; wanderT: number; lastBy: string; huntLocked: boolean;
};

const rand = Math.random;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

/** Even spread: farthest-point sampling over random open land tiles. */
export function lmsSpawns(world: any, n: number): { x: number; y: number }[] {
  const cand: { x: number; y: number }[] = [];
  for (let i = 0; i < 12000 && cand.length < 2600; i++) {
    const tx = 6 + Math.floor(rand() * (world.w - 12));
    const ty = 6 + Math.floor(rand() * (world.h - 12));
    const t = world.tiles[ty * world.w + tx];
    if (!t || t.floor === 1 || t.floor === 2 || t.block) continue;
    const x = tx * 32 + 16, y = ty * 32 + 16;
    const swim = world.swim;
    world.swim = false;
    const bad = blocked(world, x, y);
    world.swim = swim;
    if (!bad) cand.push({ x, y });
  }
  if (!cand.length) return Array.from({ length: n }, () => ({ x: world.w * 16, y: world.h * 16 }));
  const out = [cand[Math.floor(rand() * cand.length)]!];
  const dist = cand.map((c) => Math.hypot(c.x - out[0]!.x, c.y - out[0]!.y));
  while (out.length < n) {
    let bi = 0;
    for (let i = 1; i < cand.length; i++) if (dist[i]! > dist[bi]!) bi = i;
    const p = cand[bi]!;
    out.push(p);
    for (let i = 0; i < cand.length; i++) dist[i] = Math.min(dist[i]!, Math.hypot(cand[i]!.x - p.x, cand[i]!.y - p.y));
  }
  return out;
}

const isHeal = (m: Move) => m.effect === "mend" || moveTactic(m) === "heal";
const isWard = (m: Move) => m.effect === "shell" || moveTactic(m) === "ward";
const isMobility = (m: Move) => ["roll", "dash", "blink"].includes(moveTactic(m));
const isOffense = (m: Move) => m.power > 0 && !isHeal(m) && !isWard(m) && !["roll", "dash", "surge"].includes(moveTactic(m));

export function installLms(game: any): void {
  /** Start a match: you, at level 1, as the chosen class, with 99 rivals. */
  game.startLms = function (name: string, race: string, classId: string, traitId: string | null, female: boolean) {
    this.swapRules("hardcore");
    this.lms = true;
    this.lmsMatch = { on: true, over: false, won: false, place: 0, kills: 0, startedAt: Date.now(), age: 0, feed: [], total: LMS_RIVALS + 1 } as LmsMatch;
    this.begin(name, race, undefined, classId, traitId, female);
    const save = this.save;
    if (!save) return;
    // A fair start: account skills, perks and spirits do not come into the match.
    save.skills = Object.fromEntries(SKILLS.map((sk) => [sk.id, { level: 1, xp: 0 }]));
    save.perks = {};
    save.perkPoints = 0;
    save.accountLevel = 1;
    save.spirits = [];
    save.ghostStore = [];
    save.box = [];
    save.kyo = 0;
    save.bag = { potion: 1, trail_ration: 2 };
    save.dayNight = { t: DAY_SECONDS + NIGHT_SECONDS / 2, nights: 0 };
    save.map = LMS_MAP;
    save.mapSeen = [...(save.mapSeen ?? []), "lms"];
    this.loadMap(LMS_MAP, true);
    if (this.world) this.world.swim = true;
    const spots = lmsSpawns(this.world, LMS_RIVALS + 1);
    const mine = Math.floor(rand() * spots.length);
    save.x = spots[mine]!.x;
    save.y = spots[mine]!.y;
    this.cam.x = save.x;
    this.cam.y = save.y;
    const used = new Set<string>([save.name]);
    let r = 0;
    spots.forEach((p, i) => {
      if (i === mine) return;
      let nm = pick(NAMES);
      for (let k = 0; k < 20 && used.has(nm); k++) nm = pick(NAMES);
      if (used.has(nm)) nm = `${nm} ${r + 2}`;
      used.add(nm);
      this.mobs.push(this.makeRival(r++, p.x, p.y, nm));
    });
    this.say(`Last Man Standing. ${LMS_RIVALS} rivals wake across Veilreach, all at level 1. It is always night and only ghosts walk. Level up, gear up, and be the last witch alive.`);
    this.lmsFeed(`The match begins: ${LMS_RIVALS + 1} witches.`);
    this.syncHud(true);
  };

  game.makeRival = function (i: number, x: number, y: number, name: string) {
    const cls = pick(CLASSES);
    const raceId = CLASS_RACE[cls.id] ?? "vesper";
    const rng = mulberry32(((rand() * 1e9) | 0) || 3);
    const weapon = rollGear(rng, { level: 1, slot: "weapon", floor: "common", typeBias: cls.type, raceBias: raceId });
    const m = this.makeMob({ id: `rival-${i}-${nextUid()}`, species: "muma", x, y, level: 1, fixedLevel: true, template: 20, type: cls.type, name });
    const brain: RivalBrain = {
      level: 1, xp: 0, sp: 0, ranks: {}, known: [...cls.starterMoves].filter((id) => MOVE_BY_ID[id]), gear: { weapon },
      bag: { potion: 1, cooked: 2, meat: 0, timber: 0, ore: 0, mushroom: 0, leather: 0 }, food: 100, state: "grind",
      goalX: x, goalY: y, think: rand() * 0.4, simT: rand() * SIM_STEP, kills: 0, dodgeCd: 0, potionCd: 0, castCd: {}, foe: "", foeT: 0,
      channel: 0, channelNode: "", wanderT: 0, lastBy: "", huntLocked: false,
    };
    for (const id of brain.known) brain.ranks[id] = 1;
    Object.assign(m, {
      rival: true, witch: true, classId: cls.id, race: raceId, female: rand() < 0.6, ghost: false, look: null, aggro: false, seen: true,
      huntIn: 0, enchants: [], stats: { hp: 1, dmg: 1, speed: 1, crit: 0.05, dodge: 0.04, physRes: 0, spellRes: 0 }, rarity: 2,
      lootKyo: 0, lootBag: {}, lootGear: [], rv: brain, homeX: x, homeY: y, fromSpawn: false,
    });
    this.rivalRefresh(m, true);
    return m;
  };

  /** Recomputes a rival's verses, worn look and stats after a level, a skill or a gear change. */
  game.rivalRefresh = function (m: any, fresh = false) {
    const r: RivalBrain = m.rv;
    const offense = r.known.map((id) => MOVE_BY_ID[id]).filter((mv): mv is Move => !!mv && isOffense(mv));
    m.kit = offense.sort((a, b) => b.power * (r.ranks[b.id] ?? 1) - a.power * (r.ranks[a.id] ?? 1)).slice(0, 5).map((mv) => mv.id);
    m.move = m.kit[0] ?? "measured";
    m.lootGear = SLOTS.map((s) => r.gear[s]).filter(Boolean);
    m.lootBag = Object.fromEntries(Object.entries(r.bag).filter(([id, n]) => n > 0 && id !== "cooked").map(([id, n]) => [id === "cooked" ? "cooked_meat" : id, n]));
    if (r.bag.cooked > 0) m.lootBag.cooked_meat = r.bag.cooked;
    m.lootKyo = 10 + r.level * 6;
    this.scaleRival(m, fresh);
  };

  game.scaleRival = function (m: any, fresh = false) {
    const r: RivalBrain = m.rv;
    const armor = SLOTS.reduce((n, s) => n + (r.gear[s] ? equipmentStats(r.gear[s]!).armor : 0), 0);
    const max = Math.round((80 + r.level * 13) * (1 + armor / 300));
    const ratio = fresh || !(m.max > 0) ? 1 : Math.max(0, Math.min(1, m.hp / m.max));
    m.level = r.level;
    m.max = max;
    if (m.alive !== false) m.hp = Math.max(1, Math.ceil(max * ratio));
    m.baseMax = max;
    m.frac = 0.05;
    m.nightScaled = this.isNightNow();
    m.speed = 10 + r.level;
  };

  game.rivalPower = function (m: any): number {
    const r: RivalBrain = m.rv;
    const w = r.gear.weapon ? equipmentStats(r.gear.weapon).damage : 0;
    const best = (m.kit ?? []).map((id: string) => MOVE_BY_ID[id]).filter(Boolean)[0] as Move | undefined;
    const rank = 1 + ((r.ranks[best?.id ?? ""] ?? 1) - 1) * 0.15;
    return (6 + (best?.power ?? 30) * 0.42 + w * 0.35) * (1 + r.level * 0.045) * rank;
  };

  /** One clean hit from a rival with this verse, before the target's defences. */
  game.rivalDamage = function (m: any, move: Move, defType: string): number {
    const r: RivalBrain = m.rv;
    const w = r.gear.weapon ? equipmentStats(r.gear.weapon).damage : 0;
    const form = attackForm(move);
    let dmg = (6 + move.power * 0.42 + (form !== "spell" ? w * 0.35 : 0)) * (1 + r.level * 0.045);
    dmg *= 1 + ((r.ranks[move.id] ?? 1) - 1) * 0.15;
    if (move.type === CLASS_BY_ID[m.classId as ClassId]?.type) dmg *= 1.15;
    if (form === "melee") dmg *= 1.2;
    if (form !== "spell") dmg *= typeMult(move.type as any, defType as any) || 0.35;
    if (rand() * 100 < move.crit + 5) dmg *= 1.7;
    return Math.max(1, dmg);
  };

  /** A rival's hit on you (used by the engine's normal foe-hit path). */
  game.rivalHitRaw = function (m: any, move: Move) {
    const dmg = this.rivalDamage(m, move, this.armorType());
    return dmg * (100 / (100 + Math.max(0, defenseVs(attackForm(move), this.playerArmor())) * 0.6));
  };

  game.lmsFeed = function (text: string) {
    const match: LmsMatch = this.lmsMatch;
    if (!match) return;
    match.feed.push({ text, t: match.age });
    if (match.feed.length > 8) match.feed.shift();
  };

  game.lmsAlive = function (): any[] {
    return (this.mobs ?? []).filter((m: any) => m.rival && m.alive);
  };

  /** A rival is out. `by` is a name ("you", another rival, "the ghosts"). */
  game.lmsEliminate = function (m: any, by: string, killer: any = null) {
    if (!m.rival || m.lmsOut) return;
    m.lmsOut = true;
    const left = this.lmsAlive().filter((x: any) => x !== m).length + (this.dead ? 0 : 1);
    this.lmsFeed(`${by === "you" ? "You" : by} took out ${m.name} (Lv ${m.rv.level}). ${left} left.`);
    if (by === "you") {
      this.lmsMatch.kills += 1;
      this.float(m.x, m.y - 60, `${left} LEFT`, "#ffd166");
    } else if (Math.hypot(m.x - this.save.x, m.y - this.save.y) < NEAR) this.say(`${m.name} falls to ${by}. ${left} left.`);
    if (killer?.rv) {
      killer.rv.kills += 1;
      this.rivalLoot(killer, m);
    }
    // A rival that dies near you leaves a chest with everything she had.
    if (by !== "you" && Math.hypot(m.x - this.save.x, m.y - this.save.y) < NEAR) {
      for (const g of m.lootGear ?? []) this.lootGear(m, { ...g, uid: nextUid() });
      for (const [id, n] of Object.entries(m.lootBag ?? {})) if ((n as number) > 0) this.lootItem(m, id, n);
    }
    if (by !== "you") { m.alive = false; m.hp = 0; m.respawn = 1e9; }
    this.lmsCheckEnd();
  };

  /** The winner of a duel takes the loser's better pieces and her potions. */
  game.rivalLoot = function (k: any, loser: any) {
    const r: RivalBrain = k.rv, l: RivalBrain = loser.rv;
    let took = false;
    for (const s of SLOTS) {
      const g = l.gear[s];
      if (g && (!r.gear[s] || gearScore(g) > gearScore(r.gear[s]!))) { r.gear[s] = g; took = true; }
    }
    for (const id of ["potion", "cooked", "meat", "mushroom", "timber"]) r.bag[id] = (r.bag[id] ?? 0) + (l.bag[id] ?? 0);
    this.rivalGainXp(k, 40 + l.level * 12);
    if (took) this.rivalRefresh(k);
  };

  game.lmsCheckEnd = function () {
    const match: LmsMatch = this.lmsMatch;
    if (!match || match.over) return;
    if (this.lmsAlive().length === 0 && !this.dead) {
      match.over = true;
      match.won = true;
      match.place = 1;
      this.lmsFeed("You are the last witch standing.");
      this.say("VICTORY. You are the last witch standing.");
      this.cue("fanfare", {}, [880, 0.4, "triangle"]);
      this.syncHud(true);
    }
  };

  /** You died: the match is over for you. */
  game.lmsDefeat = function () {
    const match: LmsMatch = this.lmsMatch;
    if (!match || match.over) return;
    match.over = true;
    match.won = false;
    match.place = this.lmsAlive().length + 1;
    const h = this.lastHit;
    this.lmsFeed(`You fell in place #${match.place}${h?.by ? ` to ${h.by}` : ""}.`);
    this.dead = true;
    this.dest = null;
    this.say(`You fell. Place #${match.place} of ${match.total}.`);
    this.playYouDied?.();
    this.syncHud(true);
  };

  game.lmsView = function (): LmsView | null {
    const match: LmsMatch = this.lmsMatch;
    if (!this.lms || !match) return null;
    const alive = this.lmsAlive();
    const save = this.save;
    let nearest = "";
    if (save && alive.length) {
      let bd = Infinity, who: any = null;
      for (const m of alive) { const d = Math.hypot(m.x - save.x, m.y - save.y); if (d < bd) { bd = d; who = m; } }
      if (who) nearest = `${who.name} Lv ${who.rv.level} · ${Math.round(bd / 32)} tiles ${this.compass(who.x - save.x, who.y - save.y)}`;
    }
    const s = Math.floor(match.age);
    return {
      alive: alive.length + (this.dead ? 0 : 1), total: match.total, kills: match.kills, age: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
      feed: match.feed.slice(-6).map((f) => f.text), over: match.over, won: match.won, place: match.place,
      hunting: alive.filter((m: any) => m.rv.state === "hunt").length, nearest,
    };
  };

  // ---------------------------------------------------------------- the brain

  game.rivalGainXp = function (m: any, n: number) {
    const r: RivalBrain = m.rv;
    r.xp += n;
    let ups = 0;
    while (r.xp >= xpNeed(r.level) && ups < 20) { r.xp -= xpNeed(r.level); r.level += 1; r.sp += 3; ups++; }
    if (!ups) return;
    this.rivalSpend(m);
    this.rivalRefresh(m);
    if (Math.hypot(m.x - this.save.x, m.y - this.save.y) < NEAR) this.float(m.x, m.y - 56, `Lv ${r.level}`, "#e6c15a");
  };

  /** Skill points: a heal and a ward first, then attacks and a dodge, then ranks on the best attack. */
  game.rivalSpend = function (m: any) {
    const r: RivalBrain = m.rv;
    const cls = CLASS_BY_ID[m.classId as ClassId];
    const known = () => r.known.map((id) => MOVE_BY_ID[id]).filter(Boolean) as Move[];
    const learn = (filter: (mv: Move) => boolean) => {
      const pool = MOVES.filter((mv) => !r.known.includes(mv.id) && filter(mv));
      const own = pool.filter((mv) => mv.type === cls?.type);
      const choice = (own.length ? own : pool).sort((a, b) => b.power - a.power)[0];
      if (!choice) return false;
      r.known.push(choice.id);
      r.ranks[choice.id] = 1;
      return true;
    };
    let guard = 40;
    while (r.sp > 0 && guard-- > 0) {
      const k = known();
      if (!k.some(isHeal) && learn(isHeal)) { r.sp--; continue; }
      if (r.level >= 3 && !k.some(isWard) && learn(isWard)) { r.sp--; continue; }
      if (r.level >= 5 && !k.some(isMobility) && learn(isMobility)) { r.sp--; continue; }
      if (k.filter(isOffense).length < 4 + Math.floor(r.level / 12) && learn((mv) => isOffense(mv) && mv.power <= 30 + r.level * 4)) { r.sp--; continue; }
      const best = k.filter(isOffense).sort((a, b) => (r.ranks[a.id] ?? 1) - (r.ranks[b.id] ?? 1) || b.power - a.power)[0] ?? k.find(isHeal);
      if (!best) break;
      r.ranks[best.id] = (r.ranks[best.id] ?? 1) + 1;
      r.sp--;
    }
  };

  game.rivalGearDrop = function (m: any, chance: number) {
    const r: RivalBrain = m.rv;
    if (rand() > chance) return;
    const missing = SLOTS.filter((s) => !r.gear[s]);
    const slot = missing.length && rand() < 0.75 ? pick(missing) : pick(SLOTS);
    const g = rollGear(mulberry32(((rand() * 1e9) | 0) || 5), { level: r.level, slot, typeBias: CLASS_BY_ID[m.classId as ClassId]?.type, raceBias: m.race });
    if (!r.gear[slot] || gearScore(g) > gearScore(r.gear[slot]!)) {
      r.gear[slot] = g;
      this.rivalRefresh(m);
    }
  };

  game.rivalFullSet = function (m: any): boolean {
    return SLOTS.every((s) => !!m.rv.gear[s]);
  };

  /** Called by the engine for every rival, every frame. */
  game.tickRival = function (m: any, dt: number) {
    const r: RivalBrain = m.rv;
    const save = this.save;
    const match: LmsMatch = this.lmsMatch;
    if (!r || !save) return;
    r.dodgeCd = Math.max(0, r.dodgeCd - dt);
    r.potionCd = Math.max(0, r.potionCd - dt);
    r.foeT = Math.max(0, r.foeT - dt);
    for (const k of Object.keys(r.castCd)) r.castCd[k] = Math.max(0, r.castCd[k]! - dt);
    r.food = Math.max(0, r.food - dt * (100 / 1500));
    if (r.food <= 0) { m.hp -= m.max * 0.004 * dt; if (m.hp <= 0) return this.lmsEliminate(m, "hunger"); }
    if (m.hurt > 0 && Math.hypot(m.x - save.x, m.y - save.y) < 420 && !this.dead) { r.foe = "player"; r.foeT = 8; }
    const near = Math.hypot(m.x - save.x, m.y - save.y) < NEAR;
    // Wanting to hunt: a full set, or late in the match.
    if (!r.huntLocked && ((this.rivalFullSet(m) && r.level >= HUNT_LEVEL) || (match?.age ?? 0) > HUNT_AFTER)) {
      r.huntLocked = true;
      if (near) this.float(m.x, m.y - 64, "HUNTING", "#ff6a4a");
    }
    if (!near) return this.simRival(m, dt);
    this.liveRival(m, dt);
  };

  // ---- far away: coarse outcomes

  game.simRival = function (m: any, dt: number) {
    const r: RivalBrain = m.rv;
    r.simT -= dt;
    if (r.simT > 0) return;
    const step = SIM_STEP;
    r.simT = step;
    const hp = m.hp / m.max;
    // Needs.
    if (r.food < 40) {
      if (r.bag.cooked > 0) { r.bag.cooked--; r.food = Math.min(100, r.food + 50); }
      else if (r.bag.meat > 0 && r.bag.timber > 0) { r.bag.meat--; r.bag.timber--; r.bag.cooked++; }
    }
    if (r.bag.mushroom >= 2) { r.bag.mushroom -= 2; r.bag.potion++; }
    const heal = (m.kit ? r.known : []).map((id) => MOVE_BY_ID[id]).find((mv) => mv && isHeal(mv));
    if (hp < 0.75 && heal) m.hp = Math.min(m.max, m.hp + (18 + heal.power * 0.45) * (1 + ((r.ranks[heal.id] ?? 1) - 1) * 0.15));
    if (hp < 0.4 && r.bag.potion > 0) { r.bag.potion--; m.hp = Math.min(m.max, m.hp + m.max * 0.15); }
    // Hunt another rival far from you.
    if (r.huntLocked && hp > 0.45) {
      const prey = this.nearestRival(m, 5000);
      if (prey) {
        const d = Math.hypot(prey.x - m.x, prey.y - m.y);
        if (d < 300 && Math.hypot(prey.x - this.save.x, prey.y - this.save.y) >= NEAR) {
          // A duel resolved in steps. Each side deals a few hits' worth per step.
          const mine = this.rivalPower(m) * (2 + rand() * 2);
          const theirs = this.rivalPower(prey) * (2 + rand() * 2);
          prey.hp -= mine;
          m.hp -= theirs;
          prey.rv.foe = m.id;
          if (prey.hp <= 0) return this.lmsEliminate(prey, m.name, m);
          if (m.hp <= 0) return this.lmsEliminate(m, prey.name, prey);
          return;
        }
        this.simMove(m, prey.x, prey.y, step);
        return;
      }
    }
    // Rest when low: no fighting.
    if (hp < 0.4) return;
    // Grind ghosts: an outcome per step, scaled by danger at night.
    // About one ghost every twenty seconds (finding, fighting, resting),
    // like a player grinding at night.
    const roll = rand();
    if (roll < 0.075) {
      const lvl = r.level + Math.floor(rand() * 4) - 1;
      const taken = m.max * (0.08 + rand() * 0.18) * (lvl > r.level ? 1.3 : 0.9);
      m.hp -= taken;
      if (m.hp <= 0) return this.lmsEliminate(m, "the ghosts");
      this.rivalGainXp(m, (8 + lvl * 3) * 1.4);
      if (rand() < 0.5) r.bag.meat++;
      if (rand() < 0.25) r.bag.mushroom++;
      this.rivalGearDrop(m, 0.07 + Math.min(0.06, r.level * 0.003));
    } else if (roll < 0.22) {
      // Gather.
      if (rand() < 0.5) r.bag.timber++;
      else if (rand() < 0.5) r.bag.mushroom++;
      else r.bag.ore++;
    }
    r.wanderT -= step;
    if (r.wanderT <= 0) {
      r.wanderT = 20 + rand() * 30;
      const a = rand() * Math.PI * 2;
      r.goalX = m.x + Math.cos(a) * 600;
      r.goalY = m.y + Math.sin(a) * 600;
    }
    this.simMove(m, r.goalX, r.goalY, step);
  };

  game.simMove = function (m: any, x: number, y: number, step: number) {
    const d = Math.hypot(x - m.x, y - m.y);
    if (d < 4) return;
    const sp = 60 * step;
    let nx = m.x + ((x - m.x) / d) * Math.min(sp, d);
    let ny = m.y + ((y - m.y) / d) * Math.min(sp, d);
    if (blocked(this.world, nx, ny)) {
      const a = rand() * Math.PI * 2;
      nx = m.x + Math.cos(a) * 40;
      ny = m.y + Math.sin(a) * 40;
      if (blocked(this.world, nx, ny)) return;
    }
    m.x = nx;
    m.y = ny;
  };

  game.nearestRival = function (m: any, range: number) {
    let best = null, bd = range;
    for (const o of this.mobs) {
      if (!o.rival || !o.alive || o === m) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };

  // ---- near you: frame by frame

  game.liveRival = function (m: any, dt: number) {
    const r: RivalBrain = m.rv;
    const save = this.save;
    m.moving = false;
    if (m.status?.some((s: any) => s.id === "sleep")) return;
    const rooted = m.status?.some((s: any) => s.id === "root");
    // Channelled gathering.
    if (r.channel > 0) {
      r.channel -= dt;
      if (r.channel <= 0) this.rivalFinishGather(m);
      if (!m.hurt) return;
      r.channel = 0;
    }
    r.think -= dt;
    if (r.think <= 0) {
      r.think = 0.3 + rand() * 0.15;
      this.rivalThink(m);
    }
    // Movement toward the goal.
    const d = Math.hypot(r.goalX - m.x, r.goalY - m.y);
    if (!rooted && d > 6) {
      const water = this.world?.tiles[Math.floor(m.y / 32) * this.world.w + Math.floor(m.x / 32)];
      const swim = water && (water.floor === 1 || water.floor === 2) ? 0.6 : 1;
      const sp = (62 + Math.min(40, r.level * 0.6)) * swim * (r.state === "flee" ? 1.15 : 1);
      const bx = m.x, by = m.y;
      this.moveMob(m, ((r.goalX - m.x) / d) * sp * dt, ((r.goalY - m.y) / d) * sp * dt);
      if (Math.hypot(m.x - bx, m.y - by) < 0.2) {
        // Stuck on a wall: pick a side step.
        const a = Math.atan2(r.goalY - m.y, r.goalX - m.x) + (rand() < 0.5 ? 1.4 : -1.4);
        r.goalX = m.x + Math.cos(a) * 80;
        r.goalY = m.y + Math.sin(a) * 80;
      }
    }
    if (!this.dead && r.foe === "player") m.facing = save.x < m.x ? -1 : 1;
  };

  game.rivalFoe = function (m: any): any {
    const r: RivalBrain = m.rv;
    const save = this.save;
    if (r.foe === "player" && !this.dead && r.foeT > 0) return { player: true, x: save.x, y: save.y, type: this.armorType() };
    if (r.foe) {
      const o = this.mobs.find((x: any) => x.id === r.foe && x.alive);
      if (o && Math.hypot(o.x - m.x, o.y - m.y) < 700) return o;
      r.foe = "";
    }
    return null;
  };

  game.rivalThink = function (m: any) {
    const r: RivalBrain = m.rv;
    const save = this.save;
    const hp = m.hp / m.max;
    const moves = r.known.map((id) => MOVE_BY_ID[id]).filter(Boolean) as Move[];
    const ready = (mv: Move) => (r.castCd[mv.id] ?? 0) <= 0;
    let foe = this.rivalFoe(m);
    // 1. Survive.
    if (hp < 0.45) {
      const heal = moves.find((mv) => isHeal(mv) && ready(mv));
      if (heal) return this.rivalSelfCast(m, heal);
      if (r.bag.potion > 0 && r.potionCd <= 0) {
        r.bag.potion--; r.potionCd = 6;
        const n = m.max * 0.15;
        m.hp = Math.min(m.max, m.hp + n);
        this.float(m.x, m.y - 50, `+${Math.round(n)}`, "#9ad8c8");
        return;
      }
      if (foe && hp < 0.3) {
        r.state = "flee";
        const a = Math.atan2(m.y - foe.y, m.x - foe.x) + (rand() - 0.5) * 0.6;
        r.goalX = m.x + Math.cos(a) * 220;
        r.goalY = m.y + Math.sin(a) * 220;
        const ward = moves.find((mv) => isWard(mv) && ready(mv));
        if (ward && (m.wardT ?? 0) <= 0) this.rivalSelfCast(m, ward);
        return;
      }
    }
    if (foe && hp < 0.75 && (m.wardT ?? 0) <= 0) {
      const ward = moves.find((mv) => isWard(mv) && ready(mv));
      if (ward) return this.rivalSelfCast(m, ward);
    }
    if (!foe && hp < 0.7) {
      const heal = moves.find((mv) => isHeal(mv) && ready(mv));
      if (heal) return this.rivalSelfCast(m, heal);
    }
    // 2. Needs.
    if (!foe && r.food < 40) {
      if (r.bag.cooked > 0) { r.bag.cooked--; r.food = Math.min(100, r.food + 50); this.float(m.x, m.y - 48, "eats", "#e6c15a"); return; }
      if (r.bag.meat > 0 && r.bag.timber > 0) { r.bag.meat--; r.bag.timber--; r.bag.cooked++; this.float(m.x, m.y - 48, "cooks", "#ffc45b"); return; }
    }
    if (!foe && r.bag.mushroom >= 2) { r.bag.mushroom -= 2; r.bag.potion++; this.float(m.x, m.y - 48, "brews", "#c9a6e8"); return; }
    // 3. Choose a fight.
    if (!foe && r.huntLocked && hp > 0.55) {
      const prey = this.nearestRival(m, 2400);
      const pd = prey ? Math.hypot(prey.x - m.x, prey.y - m.y) : Infinity;
      const yd = this.dead ? Infinity : Math.hypot(save.x - m.x, save.y - m.y);
      if (yd < 1600 && yd < pd) { r.foe = "player"; r.foeT = 30; foe = this.rivalFoe(m); }
      else if (prey) { r.foe = prey.id; foe = prey; }
      if (foe) r.state = "hunt";
    }
    if (!foe && hp > 0.5) {
      const sensed = [];
      for (const o of this.mobs) {
        if (!o.alive || o.rival || o.animal || o === m) continue;
        const d = Math.hypot(o.x - m.x, o.y - m.y);
        if (d > 700) continue;
        sensed.push({ id: o.id, x: o.x, y: o.y, d, level: o.level ?? 1, type: o.type || "normal", boss: !!o.boss, ghost: !!(o.ghost || o.enemyGhost), hunter: !!o.hunter, witch: !!o.witch });
      }
      const best = pickFight(
        { level: r.level, hpPct: hp, type: m.type || "normal", orders: { combat: true, mining: true, woodcutting: true, fishing: true, shroom: true, crafting: true, spirits: true, dungeon: false } },
        sensed,
      );
      if (best) { r.foe = best.id; foe = this.mobs.find((o: any) => o.id === best.id); r.state = "grind"; }
    }
    if (foe) return this.rivalFight(m, foe, moves);
    // 4. Gather what it lacks.
    const want = r.bag.timber < 2 ? "tree" : r.bag.mushroom < 2 && r.bag.potion < 2 ? "shroom" : r.bag.ore < 2 ? "ore" : "";
    if (want) {
      const node = this.rivalNode(m, want);
      if (node) {
        r.state = "gather";
        if (Math.hypot(node.x - m.x, node.y - m.y) < 40) { r.channel = 1.3; r.channelNode = node.id; r.goalX = m.x; r.goalY = m.y; this.float(m.x, m.y - 48, want === "tree" ? "chops" : want === "ore" ? "mines" : "forages", "#9ad8c8"); }
        else { r.goalX = node.x; r.goalY = node.y + 18; }
        return;
      }
    }
    // 5. Roam.
    r.state = "grind";
    r.wanderT -= 0.35;
    if (r.wanderT <= 0 || Math.hypot(r.goalX - m.x, r.goalY - m.y) < 20) {
      r.wanderT = 6 + rand() * 6;
      const a = rand() * Math.PI * 2;
      r.goalX = m.x + Math.cos(a) * 260;
      r.goalY = m.y + Math.sin(a) * 260;
    }
  };

  game.rivalNode = function (m: any, kind: string) {
    let best = null, bd = 600;
    for (const n of this.world?.spawns ?? []) {
      if (n.kind !== "node" || n.node !== kind) continue;
      const d = Math.hypot(n.x - m.x, n.y - m.y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

  game.rivalFinishGather = function (m: any) {
    const r: RivalBrain = m.rv;
    const node = this.world?.spawns.find((n: any) => n.id === r.channelNode && n.kind === "node");
    if (!node) return;
    this.depleteNode(node.id);
    const k = node.node === "tree" ? "timber" : node.node === "ore" ? "ore" : "mushroom";
    r.bag[k] = (r.bag[k] ?? 0) + 1 + (rand() < 0.5 ? 1 : 0);
  };

  /** Heals and wards on herself. */
  game.rivalSelfCast = function (m: any, mv: Move) {
    const r: RivalBrain = m.rv;
    r.castCd[mv.id] = isHeal(mv) ? 4 : 7;
    this.playMoveFx(mv, m.x, m.y - 20, m.x, m.y - 20);
    if (isHeal(mv)) {
      const n = (18 + Math.max(8, mv.power) * 0.45) * (1 + ((r.ranks[mv.id] ?? 1) - 1) * 0.15);
      m.hp = Math.min(m.max, m.hp + n);
      this.float(m.x, m.y - 50, `+${Math.round(n)}`, "#9ad8c8");
    } else {
      m.wardT = 3;
      this.float(m.x, m.y - 48, "WARD", "#fff1a8");
    }
  };

  /** Fighting like a player: hold the verse's range (casters) or close in (melee), then cast what is ready. */
  game.rivalFight = function (m: any, foe: any, moves: Move[]) {
    const r: RivalBrain = m.rv;
    const offense = moves.filter((mv) => isOffense(mv));
    const ready = offense.filter((mv) => (r.castCd[mv.id] ?? 0) <= 0);
    const d = Math.hypot(foe.x - m.x, foe.y - m.y);
    const best = (ready.length ? ready : offense).sort((a, b) => b.power * (r.ranks[b.id] ?? 1) - a.power * (r.ranks[a.id] ?? 1))[0];
    if (!best) return;
    const form = attackForm(best);
    const reach = form === "melee" ? 58 : attackRange(best) + 10;
    const hold = form === "melee" ? 34 : Math.min(reach * 0.75, 170);
    // Position: kite to `hold` distance on a slow circle so it is not a sitting target.
    const a = Math.atan2(m.y - foe.y, m.x - foe.x) + (form === "melee" ? 0 : 0.35);
    r.goalX = foe.x + Math.cos(a) * hold;
    r.goalY = foe.y + Math.sin(a) * hold;
    m.facing = foe.x < m.x ? -1 : 1;
    if (d > reach || !ready.includes(best)) return;
    if (form !== "melee" && this.world && !clearLine(this.world, m.x, m.y, foe.x, foe.y)) return;
    r.castCd[best.id] = Math.max(0.7, (0.55 + best.power / 90) * (form === "spell" ? 1.35 : form === "melee" ? 0.8 : 1) * (moveTactic(best) === "heavy" ? 1.7 : 1));
    m.swing = (m.swing ?? 0) + 1;
    if (foe.player) {
      // On you: the engine's normal foe attack, with its wind-up warning and dodge window.
      this.mobAttack(m, best);
      return;
    }
    const delay = this.playMoveFx(best, m.x, m.y - 16, foe.x, foe.y - 12, { follow: () => (foe.alive ? [foe.x, foe.y - 12] : null) });
    this.later(delay, () => {
      if (!m.alive || !foe.alive) return;
      if (rand() * 100 > best.accuracy) { this.float(foe.x, foe.y - 36, "MISS", "#e8dcc4"); return; }
      const dmg = this.rivalDamage(m, best, foe.type);
      if (foe.rival) this.hurtRival(foe, dmg, m);
      else {
        foe.hp -= dmg;
        foe.hurt = 1;
        foe.foeRival = m.id;
        this.float(foe.x, foe.y - 30, `${Math.round(dmg)}`, "#d8c8b0");
        if (foe.hp <= 0) this.rivalKillsMob(m, foe);
      }
    });
  };

  game.rivalKillsMob = function (m: any, mob: any) {
    if (!mob.alive) return;
    mob.alive = false;
    mob.hp = 0;
    const delay = this.respawnSecondsFor(mob);
    mob.respawn = delay == null ? 1e9 : delay;
    this.rivalGainXp(m, (8 + (mob.level ?? 1) * 3) * (mob.boss ? 4 : 1) * 3);
    const r: RivalBrain = m.rv;
    if (rand() < 0.5) r.bag.meat++;
    if (rand() < 0.2) r.bag.potion++;
    this.rivalGearDrop(m, mob.boss ? 1 : 0.14 + (mob.rarity ?? 0) * 0.05);
    if (r.foe === mob.id) r.foe = "";
  };

  /** Damage on a rival from anyone but you (your hits go through the engine). Rivals dodge with their movement verses. */
  game.hurtRival = function (r: any, dmg: number, by: any) {
    if (!r.alive) return;
    if (this.rivalDodge(r)) return;
    if ((r.wardT ?? 0) > 0) dmg *= 0.6;
    r.hp -= dmg;
    r.hurt = 1;
    if (by?.rival) { r.rv.foe = by.id; r.rv.foeT = 8; }
    else if (by) r.rv.foe = by.id;
    this.float(r.x, r.y - 30, `${Math.round(dmg)}`, "#f0e2c8");
    if (r.hp <= 0) this.lmsEliminate(r, by?.rival ? by.name : by?.name ? `${by.name} (ghost)` : "the ghosts", by?.rival ? by : null);
  };

  /** A rival with a roll, dash or blink ready may slip a hit (about a third of the time). */
  game.rivalDodge = function (m: any): boolean {
    const r: RivalBrain = m.rv;
    if (!r || r.dodgeCd > 0) return false;
    const mob = r.known.map((id) => MOVE_BY_ID[id]).find((mv) => mv && isMobility(mv));
    if (!mob || rand() > 0.33) return false;
    r.dodgeCd = 3.2;
    const a = rand() * Math.PI * 2;
    const nx = m.x + Math.cos(a) * 48, ny = m.y + Math.sin(a) * 48;
    if (!blocked(this.world, nx, ny)) { this.playMoveFx(mob, m.x, m.y - 16, nx, ny - 16); m.x = nx; m.y = ny; }
    this.float(m.x, m.y - 40, "DODGE", "#e7d9ff");
    return true;
  };

  /** A ghost a rival hit fights back against that rival. Returns true while it does. */
  game.mobVsRival = function (mob: any, dt: number, dPlayer: number): boolean {
    const r = this.mobs.find((x: any) => x.id === mob.foeRival && x.alive);
    if (!r) { mob.foeRival = ""; return false; }
    const d = Math.hypot(r.x - mob.x, r.y - mob.y);
    if (d > 520 || (dPlayer < d && dPlayer < 200)) { if (d > 520) mob.foeRival = ""; return false; }
    const move = MOVE_BY_ID[mob.move] ?? MOVES[0]!;
    const reach = attackForm(move) === "melee" ? 54 : attackRange(move) + 20;
    if (d > reach * 0.8) {
      const sp = 58;
      this.moveMob(mob, ((r.x - mob.x) / d) * sp * dt, ((r.y - mob.y) / d) * sp * dt);
      return true;
    }
    mob.rvCd = (mob.rvCd ?? 0.5) - dt;
    if (mob.rvCd > 0) return true;
    mob.rvCd = 1.1 + rand() * 0.4;
    const delay = this.playMoveFx(move, mob.x, mob.y - 16, r.x, r.y - 12, { follow: () => (r.alive ? [r.x, r.y - 12] : null) });
    this.later(delay, () => {
      if (!mob.alive || !r.alive) return;
      const dmg = r.max * (mob.frac ?? 0.05) * (mob.stats?.dmg ?? 1) * (this.isNightNow() ? 2 : 1) * (0.85 + (move.power ?? 30) / 300);
      this.hurtRival(r, dmg, mob);
    });
    return true;
  };

  /** Engine hooks: the match clock and forced night. */
  game.tickLms = function (dt: number) {
    const match: LmsMatch = this.lmsMatch;
    if (!this.lms || !match || match.over) return;
    match.age += dt;
    const s = this.save?.dayNight;
    if (s) s.t = DAY_SECONDS + NIGHT_SECONDS / 2;
  };

  game.endLms = function () {
    this.lms = false;
    this.lmsMatch = null;
  };
}

/** Line of sight on the live world (water does not block it). */
function clearLine(world: any, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 12));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    if (blocked(world, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}
