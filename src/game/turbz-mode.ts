/**
 * TURBZ. Hardcore difficulty on a fresh 450×450 wild with no bounties, no townsfolk and no quests.
 * Ten to fifteen other witches grind, craft, catch spirits and sometimes die. If two meet, they
 * team up, never more than three. You have health, mana and stamina instead of food and water.
 */
import {
  CLASSES,
  CLASS_BY_ID,
  CLASS_RACE,
  MOVE_BY_ID,
  MOVES,
  SKILLS,
  WITCH_NAMES,
  ENCHANT_BY_ID,
  attackForm,
  attackRange,
  equipmentStats,
  gearPrice,
  gearScore,
  moveTactic,
  mulberry32,
  nextUid,
  rollGear,
  xpNeed,
  type Gear,
  type Move,
} from "./content";
import type { ClassId } from "./classes";
import { enemyTargets, expectedHunterPower } from "./balance";
import { generateWorld } from "./map-gen";
import { lmsSpawns } from "./lms";
import { DAY_SECONDS } from "./daynight";
import { nearestShore } from "./survival";
import { combatRate } from "./pools";
import { ALL_ORDERS, thinkLikePlayer, typeEdge } from "./player-brain";

export const TURBZ_MAP = "custom-turbz";
/** Where a TURBZ run is saved so leaving and returning resumes the same grind. */
export const TURBZ_SAVE_KEY = "turbz-run-v1";
/** The armor you keep forever: every piece from your bag, reset to level 1, enchants intact. */
export const TURBZ_HEIR_KEY = "turbz-heirloom-v1";
/** Your packed-up camp: it survives death and drops back when you place a campfire next life. */
export const TURBZ_CAMP_KEY = "turbz-camp-v1";

/** Is there a TURBZ run to continue? (Used by the menu to offer Continue.) */
export function hasTurbzSave(): boolean {
  try { return !!localStorage.getItem(TURBZ_SAVE_KEY); } catch { return false; }
}
export const TURBZ_ORDERS = [
  { id: "combat", label: "Fight" },
  { id: "mining", label: "Mine ore" },
  { id: "woodcutting", label: "Chop wood" },
  { id: "fishing", label: "Fish" },
  { id: "shroom", label: "Forage" },
  { id: "crafting", label: "Craft" },
  { id: "spirits", label: "Seek spirits" },
  { id: "dungeon", label: "Dungeons" },
] as const;

const SLOTS = ["weapon", "head", "chest", "legs", "feet", "relic"] as const;
/** Within this range a witch runs full live AI and hunts you relentlessly. */
const NEAR = 1900;
/** Within this range a witch commits to the player, dropping whatever she was doing. */
const TWITCH_HUNT = 1900;
/** Once she has locked onto you she chases this far before giving up. */
const TWITCH_CHASE = 5200;
const SIM = 2;
const TEAM_MAX = 3;
const rand = Math.random;
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

type Brain = {
  level: number; xp: number; sp: number; ranks: Record<string, number>; known: string[];
  gear: Partial<Record<(typeof SLOTS)[number], Gear>>;
  bag: Record<string, number>; spirits: number; team: number;
  state: string; goalX: number; goalY: number; think: number; simT: number; stuck: number;
  castCd: Record<string, number>; foe: string; foeT: number; dodgeCd: number; wanderT: number; age: number;
};

export function poolMax(level: number): number {
  return 50 + Math.max(0, Math.floor(level) - 1) * 3;
}

/** Mana for a spell. Stamina for a melee verse, and a lighter drink for a shot. */
export function poolCost(power: number, form: "melee" | "spell" | "ranged"): number {
  if (form === "spell") return Math.max(4, Math.round(8 + power * 0.15));
  if (form === "ranged") return Math.max(3, Math.round(5 + power * 0.08));
  return Math.max(4, Math.round(6 + power * 0.1));
}

const isHeal = (m: Move) => m.effect === "mend" || moveTactic(m) === "heal";
const isWard = (m: Move) => m.effect === "shell" || moveTactic(m) === "ward";
const isOffense = (m: Move) => m.power > 0 && !isHeal(m) && !isWard(m) && !["roll", "dash", "surge"].includes(moveTactic(m));

export function installTurbz(game: any): void {
  game.turbz = false;
  game.pools = null;
  game.orders = null;

  game.startTurbz = function (name: string, _race: string, _classId: string, traitId: string | null, female: boolean) {
    this.turbz = true;
    this.orders = Object.fromEntries(TURBZ_ORDERS.map((o) => [o.id, true]));
    this.teamSeq = 1;
    this.swapRules("hardcore");
    // TURBZ is the Crying Lady's mode only — always her, with the race her chosen element implies.
    const classId = "cryinggirl";
    const race = (CLASS_RACE as Record<string, string>).cryinggirl ?? _race ?? "tide";
    this.begin(name, race, undefined, classId, traitId, female);
    const save = this.save;
    if (!save) return;
    save.cryRebuildMark = Math.floor((save.level ?? 1) / 50);
    save.mergeArmor = true; // TURBZ: duplicate pieces merge/level up instead of cluttering the bag.
    save.skills = Object.fromEntries(SKILLS.map((sk) => [sk.id, { level: 1, xp: 0 }]));
    save.perks = {};
    save.perkPoints = 0;
    save.accountLevel = 1;
    save.accountXp = 0;
    save.accountScore = 0;
    save.skillPoints = 0;
    save.level = 1;
    save.xp = 0;
    save.spirits = [];
    save.ghostStore = [];
    save.party = [];
    save.kyo = 0;
    save.bag = { potion: 2 };
    if (save.hunt) { save.hunt.wanted = 0; save.hunt.stars = 0; save.hunt.board = []; save.hunt.waveIn = 0; }
    save.dayNight = { t: DAY_SECONDS * 0.35, nights: 0 };
    const seed = (Math.random() * 1e9) >>> 0 || 7;
    // Remember the seed so the exact same wild can be rebuilt when you continue the run later.
    save.turbzSeed = seed;
    const file = generateWorld({
      id: "turbz", name: "TURBZ", seed, w: 450, h: 450,
      continentCount: 5, citiesPerContinent: 1, islands: 4, story: false,
      intro: "",
    });
    file.npcs = [];
    file.quests = [];
    file.id = "turbz";
    this.turbzFile = file;
    save.map = TURBZ_MAP;
    this.contract = [];
    this.loadMap(TURBZ_MAP, true);
    if (this.world) this.world.swim = true;
    const n = 10 + Math.floor(rand() * 6);
    const spots = lmsSpawns(this.world, n + 1);
    // Land ladder: continent levels climb 1, 13, 25, 37, 49... Start on the gentlest land, not a random one.
    const zones: { tx: number; ty: number; tw: number; th: number; levelMin: number }[] = file.zones ?? [];
    const landLevel = (p: { x: number; y: number }) => {
      let best = Infinity, lv = 1;
      for (const z of zones) {
        const d = Math.hypot((z.tx + z.tw / 2) * 32 - p.x, (z.ty + z.th / 2) * 32 - p.y);
        if (d < best) { best = d; lv = z.levelMin; }
      }
      return lv;
    };
    const lowest = Math.min(...spots.map(landLevel));
    const gentle = spots.map((p, i) => ({ i, lv: landLevel(p) })).filter((o) => o.lv <= lowest + 3).map((o) => o.i);
    const mine = gentle[Math.floor(rand() * gentle.length)] ?? 0;
    save.x = spots[mine]!.x;
    save.y = spots[mine]!.y;
    this.cam.x = save.x;
    this.cam.y = save.y;
    save.hp = this.maxHp();
    const caps = this.poolCaps();
    this.pools = { mana: caps.maxMana, maxMana: caps.maxMana, stam: caps.maxStam, maxStam: caps.maxStam, manaSlow: 0, stamSlow: 0 };
    this.turbzWorld = this.world;
    this.turbzRoster = [];
    this.witchGraves = [];
    this.spawnTurbzWitches(n, spots.filter((_, i) => i !== mine));
    this.plantTurbzHunts();
    this.say(`TURBZ. Level 1 on a ${file.w}×${file.h} wild. Dungeons and world bosses drop the good gear. ${n} witches are hunting. Spells drink mana, melee drinks stamina. Die and you keep your whole armour bag (reset to level 1, enchants intact). Leave and come back and the run is right where you left it.`);
    this.giveTurbzHeirloom();
    // Bring back the camp you were packed up with, so placing a campfire drops it where you stand.
    try { save.turbzCamp = JSON.parse(localStorage.getItem(TURBZ_CAMP_KEY) ?? "null"); } catch { save.turbzCamp = null; }
    this.persistTurbz();
    this.syncHud(true);
  };

  /** Spawns `n` rival witches at the given land spots (or fresh ones), away from the player. */
  game.spawnTurbzWitches = function (n: number, spots?: { x: number; y: number }[]) {
    const world = this.turbzWorld || this.world;
    const save = this.save;
    if (!world || !save) return;
    const places = spots ?? lmsSpawns(world, n + 3);
    const used = new Set<string>([save.name]);
    let made = 0;
    for (const p of places) {
      if (made >= n) break;
      if (Math.hypot(p.x - save.x, p.y - save.y) < 520) continue;
      let nm = pick(WITCH_NAMES);
      for (let k = 0; k < 12 && used.has(nm); k++) nm = pick(WITCH_NAMES);
      if (used.has(nm)) nm = `${nm} ${made + 2}`;
      used.add(nm);
      this.mobs.push(this.makeTwitch(made + 1, p.x, p.y, nm));
      made++;
    }
  };

  /** Save the current TURBZ run so it can be resumed after leaving. */
  game.persistTurbz = function () {
    const save = this.save;
    if (!this.turbz || !save || this.dead) return;
    try { localStorage.setItem(TURBZ_SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
  };

  /** Forget the resume slot (on death — the next life starts fresh, keeping the armour heirloom). */
  game.clearTurbzSave = function () {
    try { localStorage.removeItem(TURBZ_SAVE_KEY); } catch { /* private mode */ }
  };

  /** Resume a saved TURBZ run: same world (from its seed), same witch, gear, skills and grind. */
  game.continueTurbz = function (): boolean {
    let raw: any = null;
    try { raw = JSON.parse(localStorage.getItem(TURBZ_SAVE_KEY) ?? "null"); } catch { raw = null; }
    if (!raw || !raw.name) return false;
    this.turbz = true;
    this.orders = Object.fromEntries(TURBZ_ORDERS.map((o) => [o.id, true]));
    this.teamSeq = 1;
    this.swapRules("hardcore");
    const seed = (raw.turbzSeed as number) || ((Math.random() * 1e9) >>> 0 || 7);
    raw.turbzSeed = seed;
    // Rebuild the exact same wild from the saved seed before booting into it.
    const file = generateWorld({
      id: "turbz", name: "TURBZ", seed, w: 450, h: 450,
      continentCount: 5, citiesPerContinent: 1, islands: 4, story: false, intro: "",
    });
    file.npcs = [];
    file.quests = [];
    file.id = "turbz";
    this.turbzFile = file;
    // Always resume on the overworld (never stuck inside a torn-down rift instance).
    raw.map = TURBZ_MAP;
    if (raw.deathBanked) raw.deathBanked = false;
    // boot() does the heavy lifting: normalises the save, installs skins, resets runtime state,
    // loads the custom-turbz map (from the turbzFile set above) and switches the UI into play.
    this.boot(raw);
    const save = this.save;
    // If the saved tile somehow isn't open, boot falls back to "world" — force back onto the wild.
    if (save.map !== TURBZ_MAP) {
      save.map = TURBZ_MAP;
      const spot = lmsSpawns(this.world, 3)[0];
      if (spot) { save.x = spot.x; save.y = spot.y; }
      this.loadMap(TURBZ_MAP, true);
      this.cam.x = save.x; this.cam.y = save.y;
    }
    if (this.world) this.world.swim = true;
    this.turbzWorld = this.world;
    const caps = this.poolCaps();
    this.pools = { mana: caps.maxMana, maxMana: caps.maxMana, stam: caps.maxStam, maxStam: caps.maxStam, manaSlow: 0, stamSlow: 0 };
    if (!(save.hp > 0)) save.hp = this.maxHp();
    this.turbzRoster = [];
    this.witchGraves = [];
    this.spawnTurbzWitches(10 + Math.floor(rand() * 6));
    this.plantTurbzHunts();
    this.say("TURBZ resumed. Your witch, your gear and your grind are right where you left them.");
    this.persistTurbz();
    this.syncHud(true);
    return true;
  };

  game.plantTurbzHunts = function () {
    const save = this.save;
    if (!save || !this.world) return;
    save.dungeons = save.dungeons ?? { elapsed: 0, sequence: 1, portals: [], day: 0, dayElapsed: 0, stamps: {} };
    const spots = lmsSpawns(this.world, 14);
    const depths = [4, 8, 12, 18, 26, 36];
    // Idempotent: on resume the rift portals already exist (persisted), so only add missing ones.
    depths.forEach((lv, i) => {
      const p = spots[i];
      if (!p) return;
      const id = `rift-${101 + i}`;
      if (save.dungeons.portals.some((q: any) => q.id === id)) return;
      save.dungeons.portals.push({
        id,
        seed: (save.seed ^ (i + 3) * 104729) >>> 0,
        level: lv,
        x: p.x,
        y: p.y,
        cleared: false,
        defeated: [],
        day: 0,
      });
    });
    save.dungeons.sequence = Math.max(save.dungeons.sequence ?? 1, 106);
    const bosses = [
      { species: "naraku", name: "The Walking Pit", level: 10 },
      { species: "yomi", name: "Door of Yomi", level: 18 },
      { species: "saintling", name: "Marrow Saint", level: 28 },
      { species: "kagaribi", name: "The Watchfire", level: 40 },
      { species: "gaikotsu", name: "Bone Procession", level: 56 },
    ];
    bosses.forEach((b, i) => {
      const p = spots[6 + i];
      if (!p) return;
      const m = this.makeMob({
        id: `turbz-boss-${i}`, species: b.species, x: p.x, y: p.y, level: b.level,
        fixedLevel: true, boss: true, bossId: `turbz-boss-${i}`, name: b.name,
      });
      m.turbzBoss = true;
      this.mobs.push(m);
    });
    this.say("Six dungeons are open, and five world bosses walk the wild. That is where the good gear is.");
  };

  const origLoad = game.loadMap.bind(game);
  game.loadMap = function (map: string, fresh: boolean) {
    if (this.turbz) {
      this.turbzRoster = (this.turbzRoster ?? []).filter((m: any) => m?.alive);
      for (const m of this.mobs ?? []) {
        if ((m.twitch || m.turbzBoss) && m.alive && !this.turbzRoster.includes(m)) this.turbzRoster.push(m);
      }
    }
    origLoad(map, fresh);
    if (this.turbz && map === TURBZ_MAP && this.world) this.turbzWorld = this.world;
    if (this.turbz && map === TURBZ_MAP) {
      const have = new Set((this.mobs ?? []).map((m: any) => m.id));
      for (const m of this.turbzRoster ?? []) if (m.alive && !have.has(m.id)) this.mobs.push(m);
    }
  };

  game.gearToLevelOne = function (g: any) {
    g.level = 1;
    g.gx = 0;
    g.price = gearPrice(g);
  };

  /**
   * Keeps your ENTIRE armour bag, not just what you wore: every piece is copied back at level 1 with
   * its enchantments fully intact (enchants never reset). The party ghosts come back at level 1 too.
   * This is what lets you grind a full armour set in TURBZ and never lose it to a death.
   */
  game.stashTurbzKit = function () {
    const save = this.save;
    if (!save) return;
    const gear: any[] = [];
    for (const g of save.gear ?? []) {
      const copy = { ...g, level: 1, gx: 0, enchants: (g.enchants ?? []).map((e: any) => ({ ...e })), moves: [...(g.moves ?? [])] };
      copy.price = gearPrice(copy);
      gear.push(copy);
    }
    // Preserve which pieces were worn (by uid) so they are re-equipped on the next life.
    const equipped: Record<string, string> = {};
    for (const [slot, uid] of Object.entries(save.equipped ?? {})) if (uid && gear.some((g) => g.uid === uid)) equipped[slot] = uid as string;
    const spirits = (save.spirits ?? []).map((s: any) => ({
      ...s,
      level: 1,
      xp: 0,
      task: null,
      taskT: 0,
      max: 38,
      hp: 38,
      speed: 9,
      abilities: (s.abilities ?? []).map((a: any) => ({ ...a })),
      known: [...(s.known ?? [])],
      slots: [...(s.slots ?? [])],
    }));
    this.turbzHeirloom = { gear, equipped, spirits };
    // Persist it so your armour survives even if you close the game on the You Died screen.
    try { localStorage.setItem(TURBZ_HEIR_KEY, JSON.stringify(this.turbzHeirloom)); } catch { /* private mode */ }
  };

  game.giveTurbzHeirloom = function () {
    let kit = this.turbzHeirloom;
    if (!kit) { try { kit = JSON.parse(localStorage.getItem(TURBZ_HEIR_KEY) ?? "null"); } catch { kit = null; } }
    const save = this.save;
    if (!kit || !save) return;
    if (kit.gear?.length) {
      const starter = (save.gear ?? []).find((g: any) => g.slot === "weapon");
      const gear = kit.gear.map((g: any) => ({ ...g, enchants: (g.enchants ?? []).map((e: any) => ({ ...e })), moves: [...(g.moves ?? [])] }));
      save.equipped = { ...kit.equipped };
      if (!save.equipped.weapon && starter) {
        gear.unshift(starter);
        save.equipped.weapon = starter.uid;
      }
      save.gear = gear;
    }
    if (kit.spirits?.length) {
      const cap = typeof this.spiritCap === "function" ? this.spiritCap() : 3;
      let out = 0;
      save.spirits = kit.spirits.map((s: any) => {
        const active = !!s.active && out < cap;
        if (active) out += 1;
        return { ...s, active, level: 1, xp: 0, max: 38, hp: 38, speed: 9 };
      });
      save.ghostStore = [];
      save.companion = null;
      save.box = [];
    }
    save.hp = this.maxHp();
    const caps = this.poolCaps?.();
    if (caps && this.pools) {
      this.pools.maxMana = caps.maxMana;
      this.pools.maxStam = caps.maxStam;
      this.pools.mana = caps.maxMana;
      this.pools.stam = caps.maxStam;
    }
  };

  /**
   * TURBZ one-camp rule: on death, fold the campfire, its blocks and its beds into a single packed camp
   * (stored as tile offsets from the fire) that survives the run. Placing a campfire next life drops it back.
   */
  game.packTurbzCamp = function () {
    const save = this.save;
    if (!this.turbz || !save?.survival) return;
    const fire = save.survival.campfires.find((c: any) => c.map === save.map) ?? save.survival.campfires[0];
    if (!fire) { try { localStorage.removeItem(TURBZ_CAMP_KEY); } catch { /* ignore */ } save.turbzCamp = null; return; }
    const bx = Math.floor(fire.x / 32), by = Math.floor(fire.y / 32);
    const logs = (save.survival.logs ?? []).filter((l: any) => l.map === fire.map)
      .map((l: any) => ({ dx: l.tx - bx, dy: l.ty - by, kind: l.kind, open: l.open }));
    const beds = (save.survival.beds ?? []).filter((b: any) => b.map === fire.map)
      .map((b: any) => ({ dx: b.tx - bx, dy: b.ty - by }));
    save.turbzCamp = { logs, beds };
    // Remove it from the world so nothing is left standing after death.
    save.survival.campfires = save.survival.campfires.filter((c: any) => c !== fire);
    save.survival.logs = (save.survival.logs ?? []).filter((l: any) => l.map !== fire.map);
    save.survival.beds = (save.survival.beds ?? []).filter((b: any) => b.map !== fire.map);
    this.syncSolids?.(save.map);
    try { localStorage.setItem(TURBZ_CAMP_KEY, JSON.stringify(save.turbzCamp)); } catch { /* private mode */ }
  };

  /** Drops the packed camp back onto the world, centred on a freshly placed campfire at (x, y). */
  game.restoreTurbzCamp = function (x: number, y: number) {
    const save = this.save;
    const camp = save?.turbzCamp;
    if (!camp || !this.world) return;
    const bx = Math.floor(x / 32), by = Math.floor(y / 32);
    const w = this.world.w, h = this.world.h;
    save.survival.logs = save.survival.logs ?? [];
    for (const l of camp.logs ?? []) {
      const tx = bx + l.dx, ty = by + l.dy;
      if (tx < 2 || ty < 2 || tx >= w - 2 || ty >= h - 2) continue;
      if (save.survival.logs.some((e: any) => e.map === save.map && e.tx === tx && e.ty === ty)) continue;
      const tile: any = { map: save.map, tx, ty, kind: l.kind };
      if (l.kind === "door") tile.open = !!l.open;
      save.survival.logs.push(tile);
    }
    save.survival.beds = save.survival.beds ?? [];
    for (const b of camp.beds ?? []) {
      const tx = bx + b.dx, ty = by + b.dy;
      if (tx < 2 || ty < 2 || tx >= w - 2 || ty >= h - 2) continue;
      if (save.survival.beds.some((e: any) => e.map === save.map && e.tx === tx && e.ty === ty)) continue;
      save.survival.beds.push({ map: save.map, tx, ty });
    }
    save.turbzCamp = null;
    try { localStorage.removeItem(TURBZ_CAMP_KEY); } catch { /* ignore */ }
    this.syncSolids?.(save.map);
  };

  game.growWornGear = function (grant: number) {
    const save = this.save;
    if (!save) return;
    for (const uid of Object.values(save.equipped ?? {})) {
      const g = save.gear.find((x: any) => x.uid === uid);
      if (!g || g.level >= save.level) continue;
      g.gx = (g.gx ?? 0) + grant;
      const need = Math.max(48, xpNeed(g.level) * 3);
      if (g.gx < need) continue;
      g.gx -= need;
      g.level += 1;
      for (const e of g.enchants ?? []) {
        const cap = ENCHANT_BY_ID[e.id]?.max ?? e.power + 1;
        e.power = Math.min(cap, e.power + 1);
      }
      g.price = gearPrice(g);
      this.float(save.x, save.y - 72, `${g.name.split(" ").slice(-1)[0]} ${g.level}`, "#e6c15a");
      this.say(`${g.name} grew to level ${g.level}. Gear climbs slower than you.`);
    }
  };

  game.turbzDeath = function () {
    this.turbzFell?.();
  };

  game.makeTwitch = function (i: number, x: number, y: number, name: string, level = 1) {
    const cls = pick(CLASSES);
    const raceId = CLASS_RACE[cls.id] ?? "vesper";
    const rng = mulberry32(((rand() * 1e9) | 0) || 9);
    // A TURBZ witch is born at least at your level with gear to match, so she is never a pushover.
    level = Math.max(level, this.save?.level ?? 1);
    const weapon = rollGear(rng, { level, slot: "weapon", floor: level >= 8 ? "fine" : "common", typeBias: cls.type, raceBias: raceId });
    const m = this.makeMob({ id: `twitch-${i}-${nextUid()}`, species: "muma", x, y, level, fixedLevel: true, template: 20, type: cls.type, name });
    const brain: Brain = {
      level, xp: 0, sp: Math.max(0, (level - 1) * 3), ranks: {}, known: [...cls.starterMoves].filter((id) => MOVE_BY_ID[id]),
      gear: { weapon }, bag: { timber: 0, ore: 0, fish: 0, mushroom: 0, potion: 1 }, spirits: 0, team: 0,
      state: "grind", goalX: x, goalY: y, think: rand() * 0.4, simT: rand() * SIM, castCd: {}, foe: "", foeT: 0, dodgeCd: 0, wanderT: 8, age: 0, stuck: 0,
    };
    Object.assign(m, {
      twitch: true, witch: true, rival: false, classId: cls.id, race: raceId, female: rand() < 0.6,
      ghost: false, aggro: false, seen: true, huntIn: 0, enchants: [], fromSpawn: false,
      stats: { hp: 1, dmg: 1.1, speed: 1, crit: 0.08, dodge: 0.08, physRes: 0, spellRes: 0 },
      rarity: 2, lootKyo: 8 + level * 4, rv: brain, homeX: x, homeY: y,
    });
    this.scaleTwitch(m, true);
    if (level > 1) this.twitchSpend(m);
    return m;
  };

  game.scaleTwitch = function (m: any, fresh = false) {
    const r: Brain = m.rv;
    if (!r) return;
    const save = this.save;
    const playerLv = Math.max(1, save?.level ?? 1);
    if (!this.powerRef && this.refreshPower) this.refreshPower(0);
    const armor = SLOTS.reduce((n, s) => n + (r.gear[s] ? equipmentStats(r.gear[s]!).armor : 0), 0);
    // TURBZ witches are scaled to YOU the way the hardest world witches are: their health is measured
    // in your hits and their damage is a real share of your health (the bent "witch" damage share),
    // read against the better of your real power and a decent hunter of your level. They are meant to
    // be among the deadliest fights in the game — never a level-1 chump grinding in a corner.
    const t = enemyTargets({ kind: "witch", rarity: Math.max(2, m.rarity ?? 2), hardcore: true, growth: this.growth ? this.growth() : 1 });
    const exp = expectedHunterPower(Math.max(r.level, playerLv));
    const liveHit = Math.max(1, this.powerRef?.hit ?? exp.hit);
    const liveHp = Math.max(1, this.powerRef?.maxHp ?? exp.maxHp);
    const hitRef = Math.max(liveHit, exp.hit);
    const hpRef = Math.max(liveHp, exp.maxHp);
    const floorHp = (20 + r.level * 8) * 2.5;
    const night = this.isNightNow?.() ? 1.2 : 1;
    const base = Math.max(floorHp, hitRef * t.hits) * (1 + armor / 240) * (1 + r.spirits * 0.03);
    const max = Math.max(1, Math.floor(base * night));
    const ratio = fresh || !(m.max > 0) ? 1 : Math.max(0, Math.min(1, m.hp / m.max));
    m.level = r.level;
    m.max = max;
    m.baseMax = Math.floor(base);
    if (m.alive !== false) m.hp = Math.max(1, Math.ceil(max * ratio));
    // Fraction of your health one clean hit removes — the dangerous-witch share (≈0.38-0.58, bent).
    m.frac = (hpRef * t.frac) / liveHp;
    m.dmgMult = 1.15 + Math.min(0.4, r.spirits * 0.03);
    m.nightScaled = !!this.isNightNow?.();
    m.speed = Math.max(1, Math.round(((this.playerSpeed?.() ?? 14) + t.speedOffset)));
    const offense = r.known.map((id) => MOVE_BY_ID[id]).filter((mv): mv is Move => !!mv && isOffense(mv));
    m.kit = offense.sort((a, b) => b.power * (r.ranks[b.id] ?? 1) - a.power * (r.ranks[a.id] ?? 1)).slice(0, 4).map((mv) => mv.id);
    m.move = m.kit[0] ?? "measured";
    m.lootGear = SLOTS.map((s) => r.gear[s]).filter(Boolean);
  };

  /**
   * Autoleveling: a TURBZ witch's level, skills, stats and worn gear all track yours. She never
   * falls behind — the moment you out-level her she catches up (new skill points spent, gear
   * leveled to match), so a witch you meet at level 60 fights like a level-60 build, not a relic.
   */
  game.autoLevelTwitch = function (m: any) {
    const r: Brain = m?.rv;
    const save = this.save;
    if (!r || !save) return;
    const target = Math.max(r.level, save.level | 0);
    let touched = false;
    if (target > r.level) {
      r.sp += (target - r.level) * 3;
      r.level = target;
      this.twitchSpend(m); // learns new verses and ranks the ones she has, to your level
      touched = true;
    }
    for (const slot of SLOTS) {
      const g = r.gear[slot];
      if (g) {
        if ((g.level ?? 1) < r.level) { g.level = r.level; g.gx = 0; g.price = gearPrice(g); touched = true; }
      } else if (rand() < 0.4) {
        r.gear[slot] = rollGear(mulberry32(((rand() * 1e9) | 0) || 3), { level: r.level, slot, floor: r.level >= 14 ? "rare" : "fine", typeBias: m.type, raceBias: m.race });
        touched = true;
      }
    }
    if (touched) this.scaleTwitch(m);
  };

  game.twitchSpend = function (m: any) {
    const r: Brain = m?.rv;
    if (!r) return;
    const cls = CLASS_BY_ID[m.classId as ClassId];
    const learn = (filter: (mv: Move) => boolean) => {
      const pool = MOVES.filter((mv) => !r.known.includes(mv.id) && filter(mv));
      const own = pool.filter((mv) => mv.type === cls?.type);
      const choice = (own.length ? own : pool).sort((a, b) => b.power - a.power)[0];
      if (!choice) return false;
      r.known.push(choice.id);
      r.ranks[choice.id] = 1;
      return true;
    };
    let guard = 30;
    while (r.sp > 0 && guard-- > 0) {
      const k = r.known.map((id) => MOVE_BY_ID[id]).filter(Boolean) as Move[];
      if (!k.some(isHeal) && learn(isHeal)) { r.sp--; continue; }
      if (r.level >= 3 && !k.some(isWard) && learn(isWard)) { r.sp--; continue; }
      if (k.filter(isOffense).length < 4 && learn((mv) => isOffense(mv) && mv.power <= 28 + r.level * 3)) { r.sp--; continue; }
      const best = k.filter(isOffense).sort((a, b) => (r.ranks[a.id] ?? 1) - (r.ranks[b.id] ?? 1))[0];
      if (!best) break;
      r.ranks[best.id] = (r.ranks[best.id] ?? 1) + 1;
      r.sp--;
    }
    this.scaleTwitch(m);
  };

  game.twitchXp = function (m: any, n: number) {
    const r: Brain = m.rv;
    r.xp += n;
    let ups = 0;
    while (r.xp >= xpNeed(r.level) && ups < 8) { r.xp -= xpNeed(r.level); r.level++; r.sp += 3; ups++; }
    if (ups) this.twitchSpend(m);
  };

  game.tickPools = function (dt: number) {
    const save = this.save;
    const p = this.pools;
    if (!save || !p) return;
    const caps = this.poolCaps();
    const wounded = save.hp < caps.hp * 0.35;
    p.maxMana = caps.maxMana;
    p.maxStam = caps.maxStam;
    p.manaSlow = Math.max(0, p.manaSlow - dt);
    p.stamSlow = Math.max(0, p.stamSlow - dt);
    let manaRate = combatRate(caps.manaRate, this.combat > 0);
    let stamRate = combatRate(caps.stamRate, this.combat > 0);
    if (wounded) { manaRate *= 0.55; stamRate *= 0.55; }
    if (p.manaSlow > 0) stamRate *= 0.5;
    if (p.stamSlow > 0) manaRate *= 0.5;
    p.mana = Math.min(p.maxMana, Math.max(0, p.mana) + manaRate * dt);
    p.stam = Math.min(p.maxStam, Math.max(0, p.stam) + stamRate * dt);
  };

  game.payPool = function (move: Move) {
    if (!this.turbz || !this.pools) return;
    const form = attackForm(move);
    const kind = form === "spell" ? "spell" : form === "ranged" ? "ranged" : form === "melee" ? "melee" : null;
    if (!kind) return;
    const key = kind === "spell" ? "mana" : "stam";
    const slow = kind === "spell" ? "manaSlow" : "stamSlow";
    const skill = kind === "spell" ? "mana" : "stamina";
    const cost = poolCost(move.power, kind);
    if (this.pools[key] >= cost) this.pools[key] -= cost;
    else {
      this.pools[key] = 0;
      this.pools[slow] = 5;
      this.float(this.save.x, this.save.y - 64, kind === "spell" ? "NO MANA" : "NO STAMINA", "#c4473a");
    }
    this.gainSkill(skill, 2);
  };

  game.setOrder = function (id: string) {
    if (!this.orders || !(id in this.orders)) return;
    this.orders[id] = !this.orders[id];
    this.autoPlan = 0;
    this.say(`${TURBZ_ORDERS.find((o) => o.id === id)?.label ?? id} ${this.orders[id] ? "on" : "off"} for autoplay.`);
    this.syncHud(true);
  };

  game.tickTurbz = function (dt: number) {
    if (!this.turbz || !this.save) return;
    const save = this.save;
    const graves: number[] = this.witchGraves ?? [];
    for (let i = 0; i < graves.length; i++) graves[i] = (graves[i] ?? 0) - dt;
    this.witchGraves = graves;
    const onMap = save.map === TURBZ_MAP;
    const pool = onMap ? this.mobs : (this.turbzRoster ?? []);
    let aliveN = pool.filter((m: any) => m.twitch && m.alive).length;
    // Keep every witch leveled to you. Throttled: a few per frame is plenty and costs nothing.
    this.twitchLevelCursor = ((this.twitchLevelCursor ?? 0) + 1) % Math.max(1, pool.length);
    for (let k = 0; k < pool.length; k++) {
      const m = pool[(this.twitchLevelCursor + k) % pool.length];
      if (m?.twitch && m.alive && (m.rv?.level ?? 1) < save.level) this.autoLevelTwitch(m);
    }
    while (graves.length && (graves[0] ?? 1) <= 0) {
      if (aliveN >= 15) break;
      graves.shift();
      if (this.spawnReturnedWitch()) aliveN += 1;
    }
    // Secret witch hunt: check if the player crossed a new multiple-of-10 level mark.
    const huntMark = Math.floor(save.level / 10);
    if (huntMark >= 1 && huntMark > (save.turbzHuntMark ?? 0)) {
      save.turbzHuntMark = huntMark;
      this.spawnTurbzHunterWitch();
    }
  };

  /**
   * Silently spawns a rival witch near the player whose sole purpose is hunting them down.
   * No message is shown — the player will not know it is coming until it arrives.
   */
  game.spawnTurbzHunterWitch = function () {
    const save = this.save;
    const world = this.turbzWorld || this.world;
    if (!save || !world) return;
    // Pick a spawn ring 280–480 px out, out of immediate sight but not across the map.
    let sx = save.x + 380, sy = save.y;
    for (let i = 0; i < 48; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = 280 + rand() * 200;
      const wx = save.x + Math.cos(ang) * dist;
      const wy = save.y + Math.sin(ang) * dist;
      if (this.witchLand(wx, wy)) { sx = wx; sy = wy; break; }
    }
    // Level: within 2 of the player — a real match, not a stomp.
    const lv = Math.max(1, save.level + Math.floor(rand() * 3) - 1);
    let nm = pick(WITCH_NAMES);
    const used = new Set<string>((this.mobs ?? []).map((m: any) => m.name));
    for (let k = 0; k < 10 && used.has(nm); k++) nm = pick(WITCH_NAMES);
    const m = this.makeTwitch(
      (this.mobs?.length ?? 0) + (this.turbzRoster?.length ?? 0) + 9000,
      sx, sy, nm, lv,
    );
    // Override AI: this witch is always hunting the player.
    m.rv.foe = "player";
    m.rv.foeT = 9999;
    m.turbzHunter = true;
    m.aggro = true;
    if (save.map === TURBZ_MAP) this.mobs.push(m);
    else {
      this.turbzRoster = this.turbzRoster ?? [];
      this.turbzRoster.push(m);
    }
    // Intentionally: no this.say() call. The player gets no warning.
  };

  /** A fallen witch comes back about five minutes later, one level under you. */
  game.queueWitch = function () {
    if (!this.turbz) return;
    this.witchGraves = this.witchGraves ?? [];
    this.witchGraves.push(300);
  };

  game.spawnReturnedWitch = function () {
    const save = this.save;
    const world = this.turbzWorld || this.world;
    if (!save || !world) return false;
    const spots = lmsSpawns(world, 8);
    const far = spots.find((p) => Math.hypot(p.x - save.x, p.y - save.y) > 700) ?? spots[0];
    if (!far) return false;
    const lv = Math.max(1, (save.level | 0) - 1);
    const m = this.makeTwitch(this.mobs.length + (this.turbzRoster?.length ?? 0), far.x, far.y, pick(WITCH_NAMES), lv);
    if (save.map === TURBZ_MAP) this.mobs.push(m);
    else {
      this.turbzRoster = this.turbzRoster ?? [];
      this.turbzRoster.push(m);
    }
    this.say(`A witch steps back onto the wild at level ${lv}.`);
    return true;
  };

  game.tickTwitch = function (m: any, dt: number) {
    const r: Brain = m.rv;
    const save = this.save;
    if (!r || !save || !m.alive) return;
    r.age += dt;
    r.dodgeCd = Math.max(0, r.dodgeCd - dt);
    // Hunter witches never forget the player — keep the foe lock permanently refreshed.
    if (m.turbzHunter) { r.foe = "player"; r.foeT = 9999; }
    else r.foeT = Math.max(0, r.foeT - dt);
    for (const k of Object.keys(r.castCd)) r.castCd[k] = Math.max(0, r.castCd[k]! - dt);
    const near = Math.hypot(m.x - save.x, m.y - save.y) < NEAR;
    if (!near) return this.simTwitch(m, dt);
    this.liveTwitch(m, dt);
  };

  game.twitchTeamSize = function (id: number) {
    if (!id) return 0;
    return this.mobs.filter((m: any) => m.twitch && m.alive && m.rv?.team === id).length;
  };

  game.twitchMeet = function (m: any) {
    const r: Brain = m.rv;
    for (const o of this.mobs) {
      if (!o.twitch || !o.alive || o === m) continue;
      if (Math.hypot(o.x - m.x, o.y - m.y) > 150) continue;
      const other: Brain = o.rv;
      if (r.team && r.team === other.team) continue;
      if (r.team && other.team) continue;
      const host = r.team || other.team;
      if (host && this.twitchTeamSize(host) >= TEAM_MAX) continue;
      const id = host || (this.teamSeq = (this.teamSeq ?? 1) + 1);
      if (this.twitchTeamSize(id) >= TEAM_MAX) continue;
      r.team = id;
      other.team = id;
      if (this.twitchTeamSize(id) > TEAM_MAX) { r.team = 0; continue; }
      this.float(m.x, m.y - 52, "TEAMS UP", "#9ad8c8");
      return;
    }
  };

  game.simTwitch = function (m: any, dt: number) {
    const r: Brain = m.rv;
    r.simT -= dt;
    if (r.simT > 0) return;
    r.simT = SIM;
    const save = this.save;
    const pd = save && !this.dead ? Math.hypot(save.x - m.x, save.y - m.y) : Infinity;
    // Scent range: a witch who catches your trail turns hunter and heads your way from off-screen.
    if (pd < 3600 && m.hp > m.max * 0.25) { r.foe = "player"; r.foeT = Math.max(r.foeT, 6); }
    this.witchPlay(m, true);
  };

  /** Same decisions a player autoplay makes, carried out on a witch's body. */
  game.witchAct = function (m: any) {
    const r: Brain = m.rv;
    const save = this.save;
    const foes: any[] = [];
    for (const o of this.mobs) {
      if (!o.alive || o === m) continue;
      if (o.twitch && r.team && o.rv?.team === r.team) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d > 640) continue;
      foes.push({
        id: o.id, x: o.x, y: o.y, d, level: o.level ?? 1, type: o.type || "normal",
        boss: !!o.boss, dungeonBoss: !!o.dungeonBoss, hunter: !!o.hunter,
        witch: !!o.witch, animal: !!o.animal, ghost: !!(o.ghost || o.enemyGhost),
      });
    }
    if (save && !this.dead) {
      const d = Math.hypot(save.x - m.x, save.y - m.y);
      if (d < 280) foes.push({ id: "player", x: save.x, y: save.y, d, level: save.level, type: CLASS_BY_ID[save.classId]?.type ?? "spirit" });
    }
    foes.sort((a, b) => a.d - b.d);
    if (foes.length > 8) foes.length = 8;
    const nodes: any[] = [];
    for (const n of this.world?.spawns ?? []) {
      if (n.kind !== "node" || n.node === "fish") continue;
      const d = Math.hypot(n.x - m.x, n.y - m.y);
      if (d > 720) continue;
      nodes.push({ id: n.id, node: n.node, x: n.x, y: n.y, d });
    }
    nodes.sort((a, b) => a.d - b.d);
    if (nodes.length > 6) nodes.length = 6;
    let rift = null;
    let rd = 1200;
    for (const p of save?.dungeons?.portals ?? []) {
      if (p.cleared) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < rd) { rd = d; rift = { id: p.id, x: p.x, y: p.y, level: p.level ?? 1, d }; }
    }
    const shore = this.world ? nearestShore(this.world, m.x, m.y) : null;
    return thinkLikePlayer({
      x: m.x, y: m.y, level: r.level, hpPct: m.hp / Math.max(1, m.max), type: m.type || "normal",
      bag: r.bag, orders: ALL_ORDERS, inDungeon: false,
      needs: { eat: false, drink: false, sleep: false },
      foes, nodes, shore, rift, exit: null, bed: null,
      wander: ((Math.floor((r.age + (m.x | 0)) / 6) * 13) % 628) / 100,
    });
  };

  game.witchPlay = function (m: any, far: boolean) {
    const r: Brain = m.rv;
    const save = this.save;
    // AGGRESSION: a TURBZ witch is a hunter, not a farmer. If you are anywhere near (or she has
    // already locked onto you), she drops crafting/gathering and comes straight for you.
    const pd = save && !this.dead ? Math.hypot(save.x - m.x, save.y - m.y) : Infinity;
    const lockable = m.hp > m.max * 0.25 || m.turbzHunter;
    if (lockable && (pd < TWITCH_HUNT || m.turbzHunter || (r.foe === "player" && pd < TWITCH_CHASE))) {
      r.foe = "player";
      r.foeT = Math.max(r.foeT, 8);
      const foe = { player: true, x: save.x, y: save.y, alive: true, level: save.level };
      if (!far) return this.twitchFight(m, foe, this.witchMoves(m));
      const s = this.witchLandSpot(save.x, save.y, m.x, m.y);
      r.goalX = s.x; r.goalY = s.y;
      this.witchStep(m);
      return;
    }
    const act = this.witchAct(m);
    const go = (x: number, y: number) => {
      const s = this.witchLandSpot(x, y, m.x, m.y);
      r.goalX = s.x; r.goalY = s.y;
    };
    if (act.kind === "flee" || act.kind === "wander" || act.kind === "sleep") { go(act.x, act.y); if (far) this.witchStep(m); return; }
    if (act.kind === "potion") {
      if ((r.bag.potion ?? 0) > 0) {
        r.bag.potion--;
        m.hp = Math.min(m.max, m.hp + m.max * 0.28);
        this.float(m.x, m.y - 46, "DRINKS", "#9ad8c8");
      }
      return;
    }
    if (act.kind === "craft") {
      if ((r.bag.timber ?? 0) >= 3 && (r.bag.ore ?? 0) >= 2) {
        r.bag.timber -= 3; r.bag.ore -= 2;
        const g = rollGear(mulberry32(((rand() * 1e9) | 0) || 2), { level: r.level, slot: pick(SLOTS), typeBias: m.type, floor: rand() < 0.25 ? "fine" : "common" });
        const slot = g.slot as (typeof SLOTS)[number];
        if (!r.gear[slot] || gearScore(g) > gearScore(r.gear[slot]!)) { r.gear[slot] = g; this.scaleTwitch(m); }
        this.float(m.x, m.y - 46, "CRAFTS", "#e6c15a");
      }
      return;
    }
    if (act.kind === "brew") {
      if ((r.bag.mushroom ?? 0) >= 2) { r.bag.mushroom -= 2; r.bag.potion = (r.bag.potion ?? 0) + 1; this.float(m.x, m.y - 46, "BREWS", "#c9a6e8"); }
      return;
    }
    if (act.kind === "gather") {
      const spot = this.witchLandSpot(act.x, act.y, m.x, m.y);
      if (Math.hypot(spot.x - m.x, spot.y - m.y) < 28 || Math.hypot(act.x - m.x, act.y - m.y) < 36) {
        if (act.node === "tree") r.bag.timber = (r.bag.timber ?? 0) + 1;
        else if (act.node === "ore") r.bag.ore = (r.bag.ore ?? 0) + 1;
        else r.bag.mushroom = (r.bag.mushroom ?? 0) + 1;
        this.float(m.x, m.y - 44, act.node === "tree" ? "CHOPS" : act.node === "ore" ? "MINES" : "FORAGES", "#9ad8c8");
        this.twitchXp(m, 4);
      } else { go(spot.x, spot.y); if (far) this.witchStep(m); }
      return;
    }
    if (act.kind === "fish") {
      const spot = this.witchLandSpot(act.x, act.y, m.x, m.y);
      if (Math.hypot(spot.x - m.x, spot.y - m.y) < 28 || Math.hypot(act.x - m.x, act.y - m.y) < 36) { r.bag.fish = (r.bag.fish ?? 0) + 1; this.float(m.x, m.y - 44, "FISHES", "#7eb6d8"); this.twitchXp(m, 4); }
      else { go(spot.x, spot.y); if (far) this.witchStep(m); }
      return;
    }
    if (act.kind === "rift") {
      const spot = this.witchLandSpot(act.x, act.y, m.x, m.y);
      if (Math.hypot(spot.x - m.x, spot.y - m.y) < 36 || Math.hypot(act.x - m.x, act.y - m.y) < 80) {
        m.hp -= m.max * (0.08 + rand() * 0.1);
        this.float(m.x, m.y - 46, "DELVES", "#e7d9ff");
        if (m.hp <= 0) { m.alive = false; m.hp = 0; this.queueWitch(); return; }
        if (rand() < 0.4) {
          const g = rollGear(mulberry32(((rand() * 1e9) | 0) || 5), { level: r.level, slot: pick(SLOTS), typeBias: m.type, floor: "rare", bonus: 0.08 });
          const slot = g.slot as (typeof SLOTS)[number];
          if (!r.gear[slot] || gearScore(g) > gearScore(r.gear[slot]!)) { r.gear[slot] = g; this.scaleTwitch(m); }
        }
        this.twitchXp(m, 14 + r.level);
      } else { go(spot.x, spot.y); if (far) this.witchStep(m); }
      return;
    }
    if (act.kind === "fight") {
      if (act.id === "player") {
        r.foe = "player"; r.foeT = 5;
        const foe = { player: true, x: act.x, y: act.y, alive: true, level: this.save?.level ?? 1 };
        if (!far) return this.twitchFight(m, foe, this.witchMoves(m));
        go(act.x, act.y); this.witchStep(m); return;
      }
      const foe = this.mobs.find((o: any) => o.id === act.id && o.alive);
      if (!foe) return;
      r.foe = foe.id; r.foeT = 4;
      if (!far) return this.twitchFight(m, foe, this.witchMoves(m));
      const d = Math.hypot(foe.x - m.x, foe.y - m.y);
      if (d > 52) { go(foe.x, foe.y); this.witchStep(m); return; }
      const boss = !!(foe.boss || foe.dungeonBoss);
      foe.hp -= foe.max * (boss ? 0.05 : 0.1);
      m.hp -= m.max * (boss ? 0.14 : 0.06);
      if (foe.hp <= 0) {
        foe.hp = 0; foe.alive = false;
        if (foe.twitch) this.queueWitch();
        this.twitchXp(m, 10 + (foe.level ?? 1) * 3);
        if (boss && rand() < 0.65) {
          const g = rollGear(mulberry32(((rand() * 1e9) | 0) || 6), { level: r.level, slot: pick(SLOTS), floor: "epic", bonus: 0.12, typeBias: m.type });
          const slot = g.slot as (typeof SLOTS)[number];
          if (!r.gear[slot] || gearScore(g) > gearScore(r.gear[slot]!)) { r.gear[slot] = g; this.scaleTwitch(m); }
        }
      }
      if (m.hp <= 0) { m.alive = false; m.hp = 0; this.queueWitch(); }
      return;
    }
    if ("x" in act) { go(act.x, act.y); if (far) this.witchStep(m); }
  };

  game.witchMoves = function (m: any): Move[] {
    return (m.rv.known as string[]).map((id) => MOVE_BY_ID[id]).filter(Boolean) as Move[];
  };

  /** Overworld the witches actually walk. Swimming is on for the player, not for them. */
  game.witchWorld = function () {
    return this.turbzWorld || this.world;
  };

  /** Dry land, inset from the rim. Water and walls are closed even though the player can swim. */
  game.witchLand = function (x: number, y: number) {
    const w = this.witchWorld();
    if (!w?.tiles) return false;
    const tx = Math.floor(x / 32);
    const ty = Math.floor(y / 32);
    if (tx < 4 || ty < 4 || tx >= w.w - 4 || ty >= w.h - 4) return false;
    if (w.solids?.has(ty * w.w + tx)) return false;
    const t = w.tiles[ty * w.w + tx];
    if (!t || t.floor === 1 || t.floor === 2 || t.block === 1) return false;
    return true;
  };

  /** Nearest dry tile to (x, y). Prefers land toward the middle of the map over the rim. */
  game.witchLandSpot = function (x: number, y: number, fromX: number, fromY: number) {
    if (this.witchLand(x, y)) return { x, y };
    const w = this.witchWorld();
    if (!w) return { x: fromX, y: fromY };
    const midX = w.w * 16;
    const midY = w.h * 16;
    const tx = Math.floor(x / 32);
    const ty = Math.floor(y / 32);
    let best: { x: number; y: number } | null = null;
    let score = Infinity;
    for (let r = 1; r <= 14; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const px = (tx + dx) * 32 + 16;
        const py = (ty + dy) * 32 + 16;
        if (!this.witchLand(px, py)) continue;
        const s = Math.hypot(px - x, py - y) + Math.hypot(px - midX, py - midY) * 0.04;
        if (s < score) { score = s; best = { x: px, y: py }; }
      }
      if (best && r >= 2) return best;
    }
    return best ?? { x: fromX, y: fromY };
  };

  game.witchClear = function (x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d / 16));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!this.witchLand(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  };

  /** One step toward a point. Turns aside at a wall instead of sliding along it. */
  game.witchNudge = function (m: any, gx: number, gy: number, step: number) {
    const d = Math.hypot(gx - m.x, gy - m.y);
    if (d < 3) return false;
    const dist = Math.min(step, d);
    const ang = Math.atan2(gy - m.y, gx - m.x);
    for (const extra of [0, 0.55, -0.55, 1.15, -1.15, 1.8, -1.8]) {
      const nx = m.x + Math.cos(ang + extra) * dist;
      const ny = m.y + Math.sin(ang + extra) * dist;
      if (!this.witchClear(m.x, m.y, nx, ny)) continue;
      m.facing = nx < m.x ? -1 : 1;
      m.x = nx;
      m.y = ny;
      m.moving = true;
      return true;
    }
    return false;
  };

  /** Already in the sea or the rim: put her on the nearest dry ground, marching inland if the water is wide. */
  game.witchUnstick = function (m: any) {
    if (this.witchLand(m.x, m.y)) return;
    const w = this.witchWorld();
    if (!w) return;
    const midX = w.w * 16;
    const midY = w.h * 16;
    let x = m.x;
    let y = m.y;
    for (let i = 0; i < 40; i++) {
      const spot = this.witchLandSpot(x, y, x, y);
      if (this.witchLand(spot.x, spot.y)) {
        m.x = spot.x;
        m.y = spot.y;
        m.rv.goalX = spot.x;
        m.rv.goalY = spot.y;
        m.rv.stuck = 0;
        return;
      }
      const d = Math.hypot(midX - x, midY - y) || 1;
      x += ((midX - x) / d) * 128;
      y += ((midY - y) / d) * 128;
    }
  };

  /** The last goal was a wall or the ocean. Pick dry ground inland. */
  game.witchRepick = function (m: any) {
    const r: Brain = m.rv;
    const w = this.witchWorld();
    const midX = (w?.w ?? 64) * 16;
    const midY = (w?.h ?? 64) * 16;
    const ang = rand() * Math.PI * 2;
    const dist = 80 + rand() * 160;
    const toward = 0.45;
    const gx = m.x * (1 - toward) + midX * toward + Math.cos(ang) * dist;
    const gy = m.y * (1 - toward) + midY * toward + Math.sin(ang) * dist;
    const spot = this.witchLandSpot(gx, gy, m.x, m.y);
    r.goalX = spot.x;
    r.goalY = spot.y;
    r.stuck = 0;
  };

  game.witchStep = function (m: any) {
    const r: Brain = m.rv;
    this.witchUnstick(m);
    const spot = this.witchLandSpot(r.goalX, r.goalY, m.x, m.y);
    r.goalX = spot.x;
    r.goalY = spot.y;
    let moved = false;
    for (let i = 0; i < 3; i++) if (this.witchNudge(m, r.goalX, r.goalY, 32)) moved = true;
    if (!moved) this.witchRepick(m);
  };

  game.liveTwitch = function (m: any, dt: number) {
    const r: Brain = m.rv;
    const save = this.save;
    r.think -= dt;
    if (r.think <= 0) { r.think = 0.35; this.twitchThink(m); }
    this.witchUnstick(m);
    const spot = this.witchLandSpot(r.goalX, r.goalY, m.x, m.y);
    r.goalX = spot.x;
    r.goalY = spot.y;
    const d = Math.hypot(r.goalX - m.x, r.goalY - m.y);
    if (d > 10) {
      // Hunters move fast enough to run you down; idle witches amble.
      const hunting = r.foe === "player" || m.turbzHunter;
      const pace = (hunting ? 132 : 76) + Math.min(28, r.level);
      const step = Math.min(d, pace * dt);
      if (this.witchNudge(m, r.goalX, r.goalY, step)) r.stuck = 0;
      else {
        r.stuck = (r.stuck ?? 0) + dt;
        if (r.stuck > 0.55) this.witchRepick(m);
      }
    }
    if (!this.dead && r.foe === "player") m.facing = save.x < m.x ? -1 : 1;
  };

  game.twitchThink = function (m: any) {
    const r: Brain = m.rv;
    this.twitchMeet(m);
    const hp = m.hp / Math.max(1, m.max);
    const moves = this.witchMoves(m);
    const ready = (mv: Move) => (r.castCd[mv.id] ?? 0) <= 0;
    if (hp < 0.55) {
      const heal = moves.find((mv) => isHeal(mv) && ready(mv));
      if (heal) return this.twitchCast(m, heal, null);
    }
    this.witchPlay(m, false);
  };

  game.twitchFoe = function (m: any) {
    const r: Brain = m.rv;
    const save = this.save;
    if (r.foe === "player" && !this.dead && r.foeT > 0) return { player: true, x: save.x, y: save.y, alive: true, level: save.level };
    if (r.foe && r.foe !== "player") {
      const o = this.mobs.find((x: any) => x.id === r.foe && x.alive);
      if (o && !(o.twitch && o.rv?.team && o.rv.team === r.team)) return o;
    }
    r.foe = "";
    return null;
  };

  game.twitchFight = function (m: any, foe: any, moves: Move[]) {
    const r: Brain = m.rv;
    const ready = (mv: Move) => (r.castCd[mv.id] ?? 0) <= 0;
    if (!foe.player) {
      let best = foe;
      let pct = (foe.hp ?? foe.max ?? 1) / Math.max(1, foe.max ?? 1);
      for (const o of this.mobs) {
        if (!o.alive || o === m || (o.twitch && r.team && o.rv?.team === r.team)) continue;
        if (Math.hypot(o.x - m.x, o.y - m.y) > 110) continue;
        const p = o.hp / Math.max(1, o.max);
        if (p < pct && p < 0.35) { pct = p; best = o; }
      }
      foe = best;
      r.foe = foe.id;
    }
    const d = Math.hypot(foe.x - m.x, foe.y - m.y);
    const spells = moves.filter((mv) => isOffense(mv) && attackForm(mv) === "spell");
    const melees = moves.filter((mv) => isOffense(mv) && attackForm(mv) === "melee");
    const foeType = foe.type || "normal";
    const spellEdge = spells.reduce((n, mv) => Math.max(n, typeEdge(mv.type, foeType)), 0);
    const meleeEdge = melees.reduce((n, mv) => Math.max(n, typeEdge(mv.type, foeType)), 0);
    const caster = spellEdge > meleeEdge || (spellEdge === meleeEdge && spells.length > melees.length);
    const want = caster ? 96 : 42;
    if (d > want + 8) { r.goalX = foe.x; r.goalY = foe.y; }
    else if (caster && d < 58) {
      const a = Math.atan2(m.y - foe.y, m.x - foe.x);
      r.goalX = m.x + Math.cos(a) * 80;
      r.goalY = m.y + Math.sin(a) * 80;
    } else { r.goalX = m.x; r.goalY = m.y; }
    const pool = (caster && spellEdge > 0 ? spells : melees.length && meleeEdge > 0 ? melees : moves.filter(isOffense)).filter(ready);
    const hpLeft = foe.hp ?? foe.max ?? 80;
    const hit = pool.filter((mv) => typeEdge(mv.type, foeType) > 0 && d <= (attackForm(mv) === "melee" ? 64 : Math.min(160, attackRange(mv))))
      .sort((a, b) => this.witchMoveScore(r, b, foeType, hpLeft) - this.witchMoveScore(r, a, foeType, hpLeft))[0];
    if (!hit) return;
    const hurt = m.hp / Math.max(1, m.max);
    if (hurt < 0.5 && hpLeft > (foe.max ?? hpLeft) * 0.25) {
      const ward = moves.find((mv) => isWard(mv) && ready(mv));
      if (ward && (m.wardT ?? 0) <= 0) return this.twitchCast(m, ward, null);
    }
    this.twitchCast(m, hit, foe.player ? null : foe);
  };

  game.witchMoveScore = function (r: Brain, mv: Move, foeType: string, hpLeft: number) {
    const edge = typeEdge(mv.type, foeType);
    if (edge <= 0) return -1;
    const est = mv.power * (r.ranks[mv.id] ?? 1) * edge;
    const cd = mv.power > 60 ? 1.35 : 0.7;
    let score = est / cd;
    if (est > hpLeft * 1.25) score -= (est - hpLeft) * 0.15;
    return score;
  };

  game.twitchCast = function (m: any, move: Move, foe: any) {
    const r: Brain = m.rv;
    r.castCd[move.id] = Math.max(0.45, (move.power > 60 ? 1.3 : 0.7));
    if (isHeal(move)) {
      const n = 12 + move.power * 0.4 + r.level;
      m.hp = Math.min(m.max, m.hp + n);
      this.float(m.x, m.y - 46, `+${Math.round(n)}`, "#9ad8c8");
      return;
    }
    if (isWard(move)) { m.wardT = 2.4; this.float(m.x, m.y - 46, "WARD", "#fff1a8"); return; }
    if (!foe) {
      this.mobAttack(m, move);
      return;
    }
    if (!foe.alive) return;
    const dmg = (8 + move.power * 0.35 + r.level * 1.4) * (1 + ((r.ranks[move.id] ?? 1) - 1) * 0.12) * (this.isNightNow?.() ? 1.35 : 1);
    foe.hp -= dmg;
    this.float(foe.x, foe.y - 28, `${Math.round(dmg)}`, "#c4473a");
    if (foe.hp <= 0) {
      foe.hp = 0; foe.alive = false;
      if (foe.twitch) this.queueWitch();
      this.twitchXp(m, 10 + (foe.level ?? 1) * 3);
      if (rand() < 0.2) r.bag.mushroom = (r.bag.mushroom ?? 0) + 1;
    }
  };

  const origPlan = game.planGrind.bind(game);
  game.planGrind = function () {
    return origPlan();
  };
}
