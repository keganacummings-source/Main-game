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
import { cryingElements } from "./classes";
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
  /** Combat footwork (see twitchDuel): which way she circles, dash timers, her preferred range. */
  strafe?: number; strafeT?: number; dashT?: number; dashX?: number; dashY?: number; want?: number; potT?: number; summonT?: number;
};

/** How many ghosts a TURBZ witch brings: one, a second from level 20, a third from 40. Crying Ladies bring one extra. */
export function twitchGhostCount(level: number, cryingGirl: boolean): number {
  return Math.max(1, Math.min(3, 1 + Math.floor(Math.max(0, level) / 20) + (cryingGirl ? 1 : 0)));
}

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

  game.startTurbz = function (name: string, _race: string, _classId: string, traitId: string | null, female: boolean, pickClass = false) {
    this.orders = Object.fromEntries(TURBZ_ORDERS.map((o) => [o.id, true]));
    this.teamSeq = 1;
    // swapRules clears the turbz flag; set it true again afterwards, before begin, so the run is TURBZ.
    this.swapRules("hardcore");
    this.turbz = true;
    // TURBZ is normally the Crying Lady's mode. With the class toggle on you may wake as any class instead,
    // at a 50% XP penalty (see gainXp). Her own build keeps the full rate.
    const classId = pickClass && _classId ? _classId : "cryinggirl";
    const race = (CLASS_RACE as Record<string, string>)[classId] ?? _race ?? "tide";
    this.begin(name, race, undefined, classId, traitId, female);
    const save = this.save;
    if (save) save.turbzPickedClass = pickClass && classId !== "cryinggirl";
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
    this.mirrorTurbzCamp();
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
    this.orders = Object.fromEntries(TURBZ_ORDERS.map((o) => [o.id, true]));
    this.teamSeq = 1;
    // swapRules clears the turbz flag; set it true again afterwards so the resumed run is TURBZ.
    this.swapRules("hardcore");
    this.turbz = true;
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
    // No camp standing and none packed in this run? Pick up the one kept off-run (a camp from an older run).
    if (save.survival && !this.turbzCampBlueprint() && !save.turbzCamp) {
      try { save.turbzCamp = JSON.parse(localStorage.getItem(TURBZ_CAMP_KEY) ?? "null"); } catch { save.turbzCamp = null; }
    }
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
      // TURBZ world bosses: always hunt the player when in range, never idle.
      // Their aggro radius is very wide so they come looking for you.
      m.aggro = true;
      m.aggroRange = 2400;
      m.homeX = p.x;
      m.homeY = p.y;
      // Bosses respawn on the wild (never permanently gone): long timer but they come back.
      m.respawnDelay = 600; // 10 min
      this.mobs.push(m);
    });
    this.say("Six dungeons are open, and five world bosses walk the wild. That is where the good gear is.");
  };

  const origLoad = game.loadMap.bind(game);
  game.loadMap = function (map: string, fresh: boolean) {
    if (this.turbz) {
      this.turbzRoster = (this.turbzRoster ?? []).filter((m: any) => m?.alive);
      for (const m of this.mobs ?? []) {
        if ((m.twitch || m.turbzBoss || m.twitchPet) && m.alive && !this.turbzRoster.includes(m)) this.turbzRoster.push(m);
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
      for (const s of save.spirits) if (s?.shiny && this.recordShiny) this.recordShiny(s);
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
   * The camp standing on the wild (its campfire plus every block, bed, chest and Ghost Box laid around it),
   * written as tile offsets from the fire so it can be dropped anywhere, on any wild. Null if no fire is lit.
   */
  game.turbzCampBlueprint = function () {
    const save = this.save;
    if (!save?.survival) return null;
    const fire = save.survival.campfires.find((c: any) => c.map === TURBZ_MAP) ?? save.survival.campfires[0];
    if (!fire) return null;
    const bx = Math.floor(fire.x / 32), by = Math.floor(fire.y / 32);
    const logs = (save.survival.logs ?? []).filter((l: any) => l.map === fire.map)
      .map((l: any) => ({ dx: l.tx - bx, dy: l.ty - by, kind: l.kind, open: l.open }));
    const beds = (save.survival.beds ?? []).filter((b: any) => b.map === fire.map)
      .map((b: any) => ({ dx: b.tx - bx, dy: b.ty - by }));
    // The storage chest folds in by offset too, so it returns with the camp. Its CONTENTS live in their
    // own store (turbz-chest-store-v1) and are never touched here, so they survive death regardless.
    const chest = save.turbzChest && save.turbzChest.map === fire.map
      ? { dx: save.turbzChest.tx - bx, dy: save.turbzChest.ty - by } : null;
    const ghostBox = save.ghostBox && save.ghostBox.map === fire.map
      ? { dx: save.ghostBox.tx - bx, dy: save.ghostBox.ty - by } : null;
    const ghostStore = (save.ghostStore ?? []).map((s: any) => ({ ...s }));
    return { fire, camp: { logs, beds, chest, ghostBox, ghostStore } };
  };

  /** Anything worth dropping back? A camp with just a chest or a Ghost Box still counts. */
  game.turbzCampHasPieces = function (camp: any) {
    return !!camp && !!(camp.logs?.length || camp.beds?.length || camp.chest || camp.ghostBox || camp.ghostStore?.length);
  };

  /**
   * Keeps the off-run copy of your camp in step with the one you are standing in. Written on every TURBZ save,
   * so the camp survives a crash, closing the tab, or starting a brand-new run without dying. Never erases it.
   */
  game.mirrorTurbzCamp = function () {
    const save = this.save;
    if (!this.turbz || !save) return;
    const live = this.turbzCampBlueprint();
    const camp = live ? live.camp : save.turbzCamp;
    if (!this.turbzCampHasPieces(camp)) return;
    try { localStorage.setItem(TURBZ_CAMP_KEY, JSON.stringify(camp)); } catch { /* private mode */ }
  };

  /**
   * TURBZ one-camp rule: fold the campfire and everything around it into one packed camp that survives the run.
   * Runs on death, and from the Pack up camp button. Lighting a campfire again drops it back, layout intact.
   * If the camp is already packed (you died before lighting a fire), the packed camp is kept as it is.
   */
  game.packTurbzCamp = function (): boolean {
    const save = this.save;
    if (!this.turbz || !save?.survival) return false;
    const live = this.turbzCampBlueprint();
    if (!live) {
      // Nothing standing. Never throw away a camp that is already packed.
      if (!save.turbzCamp) {
        try { save.turbzCamp = JSON.parse(localStorage.getItem(TURBZ_CAMP_KEY) ?? "null"); } catch { save.turbzCamp = null; }
      }
      return false;
    }
    const { fire, camp } = live;
    save.turbzCamp = camp;
    // Lift it all off the world so nothing is left standing.
    save.survival.campfires = save.survival.campfires.filter((c: any) => c !== fire);
    save.survival.logs = (save.survival.logs ?? []).filter((l: any) => l.map !== fire.map);
    save.survival.beds = (save.survival.beds ?? []).filter((b: any) => b.map !== fire.map);
    save.turbzChest = null;
    save.ghostBox = null;
    if (this.turbzChestOpen) this.turbzChestOpen = false;
    this.syncSolids?.(save.map);
    try { localStorage.setItem(TURBZ_CAMP_KEY, JSON.stringify(camp)); } catch { /* private mode */ }
    return true;
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
    if (camp.chest) {
      const tx = bx + camp.chest.dx, ty = by + camp.chest.dy;
      if (tx >= 2 && ty >= 2 && tx < w - 2 && ty < h - 2) save.turbzChest = { map: save.map, tx, ty };
    }
    if (camp.ghostBox) {
      const tx = bx + camp.ghostBox.dx, ty = by + camp.ghostBox.dy;
      if (tx >= 2 && ty >= 2 && tx < w - 2 && ty < h - 2) save.ghostBox = { map: save.map, tx, ty };
    }
    if (camp.ghostStore?.length) {
      save.ghostStore = camp.ghostStore.map((s: any) => ({ ...s }));
    }
    save.turbzCamp = null;
    this.syncSolids?.(save.map);
    // The off-run copy now follows the camp that is standing (it is not erased, so a crash cannot lose it).
    this.mirrorTurbzCamp();
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
    const rng = mulberry32(((rand() * 1e9) | 0) || 9);
    // A TURBZ witch is born at least at your level with gear to match, so she is never a pushover.
    level = Math.max(level, this.save?.level ?? 1);

    // 50% chance: a real playerclass witch (any class, full player-style model, battle-heavy AI).
    // 50% chance: a custom-built higher-level cryingGirl (always at least 2 levels above you,
    //             all six gear slots filled, stacked offense spells, relentless hunter AI).
    const isCryingBuild = rand() < 0.5;

    let cls: (typeof CLASSES)[number];
    let raceId: string;
    let classId: string;
    let witchLevel: number;

    if (isCryingBuild) {
      // cryingGirl build: always a few levels above the player so she is never a fair fight.
      classId = "cryinggirl";
      raceId = (CLASS_RACE as Record<string, string>).cryinggirl ?? "tide";
      witchLevel = level + 2 + Math.floor(rand() * 3); // +2 to +4 levels above player
      cls = CLASSES.find((c) => c.id === "cryinggirl") ?? CLASSES[0]!;
    } else {
      // Real playerclass witch: picks any class, uses its race, looks and fights like a player.
      cls = pick(CLASSES);
      classId = cls.id;
      raceId = CLASS_RACE[cls.id] ?? "vesper";
      witchLevel = level;
    }

    const weapon = rollGear(rng, { level: witchLevel, slot: "weapon", floor: witchLevel >= 8 ? "fine" : "common", typeBias: cls?.type ?? "spirit", raceBias: raceId });

    // Build a full gear loadout — all six slots, quality scales with level.
    const gearFloor = witchLevel >= 20 ? "rare" : witchLevel >= 10 ? "fine" : "common";
    const fullGear: Partial<Record<(typeof SLOTS)[number], ReturnType<typeof rollGear>>> = { weapon };
    for (const slot of SLOTS) {
      if (slot === "weapon") continue;
      fullGear[slot] = rollGear(mulberry32(((rand() * 1e9) | 0) || 3), { level: witchLevel, slot, floor: gearFloor, typeBias: cls?.type ?? "spirit", raceBias: raceId });
    }

    const m = this.makeMob({ id: `twitch-${i}-${nextUid()}`, species: "muma", x, y, level: witchLevel, fixedLevel: true, template: 20, type: cls?.type ?? "spirit", name });

    // BATTLE-HEAVY AI: seed the brain with more offense, fewer idle moments, relentless pursuit.
    const brain: Brain = {
      level: witchLevel, xp: 0, sp: Math.max(0, (witchLevel - 1) * 3),
      ranks: {}, known: [...(cls?.starterMoves ?? [])].filter((id) => MOVE_BY_ID[id]),
      gear: fullGear,
      bag: { timber: 0, ore: 0, fish: 0, mushroom: 0, potion: isCryingBuild ? 3 : 2 },
      spirits: isCryingBuild ? Math.min(3, Math.floor(witchLevel / 10)) : 0,
      team: 0,
      state: "hunt", // starts in hunt state, not idle grind
      goalX: x, goalY: y, think: rand() * 0.2, simT: rand() * SIM,
      castCd: {}, foe: "", foeT: 0, dodgeCd: 0, wanderT: 4, age: 0, stuck: 0,
    };

    // lootGear = all worn pieces so the chest after killing her is rewarding.
    const lootGear = Object.values(fullGear).filter(Boolean) as ReturnType<typeof rollGear>[];

    Object.assign(m, {
      twitch: true, witch: true, rival: false,
      classId,
      race: raceId,
      female: rand() < 0.65,
      ghost: false,
      aggro: true, // always aggressive — these witches hunt, they do not wander
      seen: true, huntIn: 0, enchants: [], fromSpawn: false,
      // cryingGirl builds are scarier: more HP, higher crit, better dodge.
      stats: isCryingBuild
        ? { hp: 1.25, dmg: 1.3, speed: 1.05, crit: 0.14, dodge: 0.12, physRes: 0.08, spellRes: 0.08 }
        : { hp: 1.0,  dmg: 1.1, speed: 1.0,  crit: 0.08, dodge: 0.08, physRes: 0,    spellRes: 0    },
      rarity: isCryingBuild ? 3 : 2,
      lootKyo: 8 + witchLevel * 5,
      lootGear,
      rv: brain,
      homeX: x, homeY: y,
      // Direction animation state for smooth movement rendering.
      direction: "down" as const,
      moving: false,
      walk: 0,
    });
    // The ghost she drops has to match her elements: a Crying Lady carries both of hers, everyone else her class element.
    const elems = classId === "cryinggirl" ? cryingElements() : [cls?.type ?? m.type];
    m.type = elems[0] ?? m.type;
    m.types = elems.slice();

    this.scaleTwitch(m, true);
    if (witchLevel > 1) this.twitchSpend(m);
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
    // cryingGirl builds are custom-tuned killing machines: extra health and damage to match.
    const cryingMult = m.classId === "cryinggirl" ? 1.35 : 1;
    const base = Math.max(floorHp, hitRef * t.hits) * (1 + armor / 240) * (1 + r.spirits * 0.03) * cryingMult;
    const max = Math.max(1, Math.floor(base * night));
    const ratio = fresh || !(m.max > 0) ? 1 : Math.max(0, Math.min(1, m.hp / m.max));
    m.level = r.level;
    m.max = max;
    m.baseMax = Math.floor(base);
    if (m.alive !== false) m.hp = Math.max(1, Math.ceil(max * ratio));
    // Fraction of your health one clean hit removes — the dangerous-witch share (≈0.38-0.58, bent).
    // cryingGirl builds hit harder — their power is their identity.
    const fracMult = m.classId === "cryinggirl" ? 1.25 : 1;
    m.frac = (hpRef * t.frac * fracMult) / liveHp;
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
    // cryingGirl builds and all TURBZ hunter witches prioritise offense: learn more attacks faster,
    // rank them up higher, and pick heal/ward last so every skill point makes her hit harder.
    const battleHeavy = m.classId === "cryinggirl" || m.aggro;
    const learn = (filter: (mv: Move) => boolean) => {
      const pool = MOVES.filter((mv) => !r.known.includes(mv.id) && filter(mv));
      const own = pool.filter((mv) => mv.type === cls?.type);
      const choice = (own.length ? own : pool).sort((a, b) => b.power - a.power)[0];
      if (!choice) return false;
      r.known.push(choice.id);
      r.ranks[choice.id] = 1;
      return true;
    };
    // Max spell rank scales with level so high-level witches are genuinely devastating.
    const maxRank = battleHeavy ? Math.max(3, Math.floor(r.level / 8) + 2) : Math.max(2, Math.floor(r.level / 12) + 1);
    let guard = 60;
    while (r.sp > 0 && guard-- > 0) {
      const k = r.known.map((id) => MOVE_BY_ID[id]).filter(Boolean) as Move[];
      if (battleHeavy) {
        // Battle-heavy order: offense first, then rank up aggressively, heal/ward only at low HP budgets.
        if (k.filter(isOffense).length < 4 && learn((mv) => isOffense(mv) && mv.power <= 30 + r.level * 3)) { r.sp--; continue; }
        const offenseK = k.filter(isOffense);
        const toRank = offenseK.filter((mv) => (r.ranks[mv.id] ?? 1) < maxRank)
          .sort((a, b) => b.power - a.power)[0]; // rank up the hardest-hitting move first
        if (toRank) { r.ranks[toRank.id] = (r.ranks[toRank.id] ?? 1) + 1; r.sp--; continue; }
        if (k.filter(isOffense).length < 6 && learn((mv) => isOffense(mv))) { r.sp--; continue; }
        if (!k.some(isHeal) && learn(isHeal)) { r.sp--; continue; }
        if (r.level >= 5 && !k.some(isWard) && learn(isWard)) { r.sp--; continue; }
      } else {
        // Standard order: heal, ward, then offense, then rank up.
        if (!k.some(isHeal) && learn(isHeal)) { r.sp--; continue; }
        if (r.level >= 3 && !k.some(isWard) && learn(isWard)) { r.sp--; continue; }
        if (k.filter(isOffense).length < 4 && learn((mv) => isOffense(mv) && mv.power <= 28 + r.level * 3)) { r.sp--; continue; }
        const best = k.filter(isOffense)
          .filter((mv) => (r.ranks[mv.id] ?? 1) < maxRank)
          .sort((a, b) => (r.ranks[a.id] ?? 1) - (r.ranks[b.id] ?? 1))[0];
        if (!best) break;
        r.ranks[best.id] = (r.ranks[best.id] ?? 1) + 1;
        r.sp--;
      }
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
    // Mana Font (passive) and Arcane Font (Arcanist R): spells cost half the mana.
    const cost = Math.max(1, Math.round(poolCost(move.power, kind) * (kind === "spell" ? (this.gim?.spellCostMult?.() ?? 1) : 1)));
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
    // Your velocity, smoothed over about a third of a second. Witches lead their shots with it.
    if (dt > 0) {
      const last = this.turbzPVLast;
      const pv = this.turbzPV ?? { x: 0, y: 0 };
      if (last && last.map === save.map) {
        const vx = (save.x - last.x) / dt, vy = (save.y - last.y) / dt;
        if (Math.hypot(vx, vy) > 900) { pv.x = 0; pv.y = 0; } // a teleport, not a run
        else { const k = Math.min(1, dt * 3); pv.x += (vx - pv.x) * k; pv.y += (vy - pv.y) * k; }
      }
      this.turbzPV = pv;
      this.turbzPVLast = { x: save.x, y: save.y, map: save.map };
    }
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
    // Level: hunter witches are a real threat — within 2 of the player for playerclass builds,
    // or up to +4 for cryingGirl builds (handled inside makeTwitch via the isCryingBuild branch).
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
    m.evadeT = Math.max(0, (m.evadeT ?? 0) - dt);
    // Hunter witches never forget the player — keep the foe lock permanently refreshed.
    if (m.turbzHunter) { r.foe = "player"; r.foeT = 9999; }
    else r.foeT = Math.max(0, r.foeT - dt);
    for (const k of Object.keys(r.castCd)) r.castCd[k] = Math.max(0, r.castCd[k]! - dt);
    const near = Math.hypot(m.x - save.x, m.y - save.y) < NEAR;
    if (!near) return this.simTwitch(m, dt);
    this.twitchEscort(m, dt);
    this.liveTwitch(m, dt);
  };

  /** Her own ghosts, and the ghosts of witches on her team, are never her foes. */
  game.twitchFriend = function (m: any, o: any): boolean {
    if (!o?.master) return false;
    if (o.master === m.id) return true;
    const lead = this.mobs.find((x: any) => x.id === o.master);
    return !!(lead?.twitch && m.rv?.team && lead.rv?.team === m.rv.team);
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
      if (this.twitchFriend(m, o)) continue;
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
      // Face the way she walks, so her sprite (and the weapon in it) turns with her.
      const sx = nx - m.x, sy = ny - m.y;
      m.direction = Math.abs(sx) >= Math.abs(sy) ? (sx < 0 ? "left" : "right") : (sy < 0 ? "up" : "down");
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
    // Quicker decisions than a wandering witch: she re-reads the fight five times a second.
    if (r.think <= 0) { r.think = 0.2; this.twitchThink(m); }
    this.witchUnstick(m);
    // In a fight she uses real footwork (strafe, weave, kite, dash) instead of walking at her goal.
    const foe = this.twitchFoe(m);
    if (foe && Math.hypot(foe.x - m.x, foe.y - m.y) < 420) { this.twitchDuel(m, foe, dt); return; }
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
      if (o && !(o.twitch && o.rv?.team && o.rv.team === r.team) && !this.twitchFriend(m, o)) return o;
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
        if (!o.alive || o === m || (o.twitch && r.team && o.rv?.team === r.team) || this.twitchFriend(m, o)) continue;
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
    const want = caster ? 112 + Math.min(28, r.level * 0.4) : 42;
    r.want = want;
    if (d > want + 8) { r.goalX = foe.x; r.goalY = foe.y; }
    else if (caster && d < 58) {
      const a = Math.atan2(m.y - foe.y, m.x - foe.x);
      r.goalX = m.x + Math.cos(a) * 80;
      r.goalY = m.y + Math.sin(a) * 80;
    } else { r.goalX = m.x; r.goalY = m.y; }
    const pool = (caster && spellEdge > 0 ? spells : melees.length && meleeEdge > 0 ? melees : moves.filter(isOffense)).filter(ready);
    const hpLeft = foe.hp ?? foe.max ?? 80;
    const hit = pool.filter((mv) => typeEdge(mv.type, foeType) > 0 && d <= (attackForm(mv) === "melee" ? 64 : Math.min(176, attackRange(mv) + 16)))
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
    // TURBZ witches chain verses faster than other foes: about half a second between light spells.
    r.castCd[move.id] = Math.max(0.35, (move.power > 60 ? 1.0 : 0.5));
    if (isHeal(move)) {
      const n = 12 + move.power * 0.4 + r.level;
      m.hp = Math.min(m.max, m.hp + n);
      this.float(m.x, m.y - 46, `+${Math.round(n)}`, "#9ad8c8");
      return;
    }
    if (isWard(move)) { m.wardT = 2.4; this.float(m.x, m.y - 46, "WARD", "#fff1a8"); return; }
    if (!foe) {
      this.mobAttack(m, move, attackForm(move) === "melee" ? undefined : this.twitchAim(m, move));
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


  /**
   * Where a witch aims a shot at you: where you will be when it lands, not where you stand. She reads
   * your last half-second of movement and leads by the wind-up plus flight time (capped, so a feint
   * still works), and one shot in four is fired straight to punish stopping.
   */
  game.twitchAim = function (m: any, move: Move) {
    const save = this.save;
    if (!save) return undefined;
    const vx = this.turbzPV?.x ?? 0, vy = this.turbzPV?.y ?? 0;
    if (Math.hypot(vx, vy) < 20 || rand() < 0.25) return { x: save.x, y: save.y };
    const d = Math.hypot(save.x - m.x, save.y - m.y);
    const wind = attackForm(move) === "ranged" ? 0.42 : 0.55;
    const t = Math.min(0.9, wind + d / 420) * (0.75 + rand() * 0.25);
    let ox = vx * t, oy = vy * t;
    const lead = Math.hypot(ox, oy);
    if (lead > 72) { ox *= 72 / lead; oy *= 72 / lead; }
    const s = this.witchLandSpot(save.x + ox, save.y + oy, save.x, save.y);
    return { x: s.x, y: s.y };
  };

  /**
   * Combat footwork for a witch in a fight. She holds her best range (casters ~110-140, melee in close),
   * circles you and flips direction at random, weaves on the way in instead of a straight line, backs off
   * when a caster is crowded, dashes sideways when you wind up a big cast or lunge, and drinks a potion
   * when she is low instead of standing in the open.
   */
  game.twitchDuel = function (m: any, foe: any, dt: number) {
    const r: Brain = m.rv;
    const save = this.save;
    const dx = foe.x - m.x, dy = foe.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    // Her range breathes in and out a little, so she is never a fixed ring around you.
    const caster = (r.want ?? 96) > 60;
    const want = (r.want ?? 96) + Math.sin(r.age * 1.3 + (m.y % 5)) * (caster ? 22 : 6);
    r.strafeT = (r.strafeT ?? 0) - dt;
    r.potT = Math.max(0, (r.potT ?? 0) - dt);
    if (r.strafeT <= 0 || !r.strafe) { r.strafe = rand() < 0.5 ? -1 : 1; r.strafeT = 0.6 + rand() * 0.9; }

    // Low health: a potion, with a step back first. Not a flight across the map.
    const hp = m.hp / Math.max(1, m.max);
    if (hp < 0.35 && r.potT <= 0 && (r.bag.potion ?? 0) > 0) {
      r.bag.potion--;
      r.potT = 9;
      m.hp = Math.min(m.max, m.hp + m.max * 0.28);
      this.float(m.x, m.y - 46, "DRINKS", "#9ad8c8");
      r.dashT = 0.25; r.dashX = -ux; r.dashY = -uy;
    }

    // Threat read (only against you): a big cast winding up, a lunge or rush, or you closing on a caster.
    if (foe.player && !this.dead && r.dodgeCd <= 0 && (r.dashT ?? 0) <= 0) {
      const pv = this.turbzPV ?? { x: 0, y: 0 };
      const closing = -(pv.x * ux + pv.y * uy);
      const windup = (this.castLock ?? 0) > 0.05 && d < 300;
      const lunging = !!(this.lunge || this.rush) && d < 200;
      const crowded = caster && d < 70 && closing > 40;
      if (windup || lunging || crowded) {
        const side = r.strafe ?? 1;
        // Sideways, and a little away if she is a caster who is too close.
        let ddx = -uy * side - (caster ? ux * 0.6 : 0), ddy = ux * side - (caster ? uy * 0.6 : 0);
        const l = Math.hypot(ddx, ddy) || 1;
        ddx /= l; ddy /= l;
        if (!this.witchClear(m.x, m.y, m.x + ddx * 60, m.y + ddy * 60)) { ddx = -ddx; ddy = -ddy; r.strafe = -side; }
        r.dashT = 0.24; r.dashX = ddx; r.dashY = ddy;
        r.dodgeCd = 1.5 + rand() * 1.1;
        m.evadeT = 0.3; // her dash is a real dodge: hits that land in this window miss
        this.float(m.x, m.y - 40, "DASH", "#e7d9ff");
      }
    }

    let vx: number, vy: number, sp: number;
    const pace = (140 + Math.min(34, r.level * 0.6)) * (m.stats?.speed ?? 1);
    if ((r.dashT ?? 0) > 0) {
      r.dashT! -= dt;
      vx = r.dashX ?? 0; vy = r.dashY ?? 0; sp = 380;
    } else {
      // Radial: close to her range, or back off. Tangential: circle, and weave while closing in.
      let radial = Math.max(-1.25, Math.min(1, (d - want) / 45));
      if (caster && d < want * 0.55) radial = -1.25;
      const far = d > want + 70;
      const tang = far ? Math.sin(r.age * 5.5 + (m.x % 7)) * 0.75 : (caster ? 0.85 : d < 70 ? 0.7 : 0.35) * (r.strafe ?? 1);
      vx = radial * ux + tang * -uy;
      vy = radial * uy + tang * ux;
      sp = pace * (far ? 1.15 : 1);
    }
    const l = Math.hypot(vx, vy);
    if (l > 0.05) {
      const step = sp * dt;
      const gx = m.x + (vx / l) * step * 3, gy = m.y + (vy / l) * step * 3;
      if (this.witchNudge(m, gx, gy, step)) r.stuck = 0;
      else {
        // Pinned on a wall or the shore: switch circling direction and break off the dash.
        r.strafe = -(r.strafe ?? 1);
        r.dashT = 0;
        r.stuck = (r.stuck ?? 0) + dt;
        if (r.stuck > 0.55) this.witchRepick(m);
      }
    }
    m.facing = foe.x < m.x ? -1 : 1;
    m.direction = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    r.goalX = m.x; r.goalY = m.y;
    if (foe.player && save) m.aggro = true;
  };

  /**
   * A dodge roll against a hit that is about to land (called from resolveHit). True means the hit missed.
   * Inside a dash it always misses; otherwise there is a cooldown-gated chance that grows with her level,
   * and she side-steps for real so the next shot has to find her again.
   */
  game.twitchDodge = function (m: any, move: Move): boolean {
    const r: Brain = m.rv;
    if (!r || !m.alive) return false;
    if ((m.evadeT ?? 0) > 0) { this.float(m.x, m.y - 36, "DODGE", "#e7d9ff"); return true; }
    if (r.dodgeCd > 0) return false;
    const chance = Math.min(0.4, 0.2 + (m.classId === "cryinggirl" ? 0.06 : 0) + r.level * 0.002 + (attackForm(move) === "melee" ? -0.05 : 0));
    if (rand() > chance) return false;
    r.dodgeCd = 2 + rand() * 1.2;
    const save = this.save;
    const a = save ? Math.atan2(m.y - save.y, m.x - save.x) + (rand() < 0.5 ? 1.57 : -1.57) : rand() * 6.283;
    const nx = m.x + Math.cos(a) * 52, ny = m.y + Math.sin(a) * 52;
    if (this.witchClear(m.x, m.y, nx, ny)) {
      const mob = (r.known ?? []).map((id) => MOVE_BY_ID[id]).find((mv) => mv && ["roll", "dash", "blink", "surge"].includes(moveTactic(mv)));
      if (mob) this.playMoveFx(mob, m.x, m.y - 16, nx, ny - 16);
      m.x = nx; m.y = ny;
    }
    r.dashT = 0;
    this.float(m.x, m.y - 40, "DODGE", "#e7d9ff");
    return true;
  };

  /**
   * Her ghosts. Raised the first time she comes near you (1-3, see twitchGhostCount), and she calls a
   * fresh one about 40 s after one is destroyed. They are real enemy ghosts (makeEnemyGhost): ghost kits,
   * aid verses that heal and ward her, 1-in-100 shiny, and they fade when she falls.
   */
  game.twitchEscort = function (m: any, dt: number) {
    if (!this.turbz || this.save?.map !== TURBZ_MAP || !this.makeEnemyGhost) return;
    const r: Brain = m.rv;
    r.summonT = Math.max(0, (r.summonT ?? 0) - dt);
    if (r.summonT > 0) return;
    const want = twitchGhostCount(r.level, m.classId === "cryinggirl");
    const have = this.mobs.filter((o: any) => o.alive && o.twitchPet && o.master === m.id);
    if (have.length >= want) return;
    const used = new Set(have.map((o: any) => o.ghostSlot));
    const first = !m.escortMade;
    const n = first ? want - have.length : 1;
    for (let k = 0, slot = 0; k < n && slot < 3; slot++) {
      if (used.has(slot)) continue;
      const pet = this.makeEnemyGhost(m, slot, want, Math.max(1, r.level - 1), { rarity: Math.max(2, m.rarity ?? 2) });
      pet.twitchPet = true;
      pet.aggro = true;
      pet.seen = true;
      pet.chipT = 1 + rand();
      const at = this.witchLandSpot(m.x + (slot - 1) * 26, m.y + 20, m.x, m.y);
      pet.x = at.x; pet.y = at.y; pet.homeX = at.x; pet.homeY = at.y;
      this.mobs.push(pet);
      used.add(slot);
      k++;
    }
    if (!first) this.float(m.x, m.y - 56, "SUMMONS", "#c9a6e8");
    m.escortMade = true;
    r.summonT = first ? 40 : 40 + rand() * 10;
  };

  /**
   * One frame of a witch's ghost. It sticks to her (and is pulled back if it falls far behind), flanks
   * you from the side she is not on when she is fighting you, and fights whatever else she is fighting.
   */
  game.tickTwitchGhost = function (m: any, d: number, dt: number) {
    const lead = this.mobs.find((x: any) => x.id === m.master && x.alive);
    if (!lead) {
      m.alive = false; m.hp = 0;
      this.float(m.x, m.y - 30, "FADES", "#c9a6e8");
      return;
    }
    this.tickEnemyGhostAid?.(m, dt);
    if ((m.status ?? []).some((s: any) => s.id === "root" || s.id === "sleep")) return;
    const save = this.save;
    const ld = Math.hypot(lead.x - m.x, lead.y - m.y);
    if (ld > 420) {
      const at = this.witchLandSpot(lead.x + (rand() - 0.5) * 40, lead.y + 18, lead.x, lead.y);
      m.x = at.x; m.y = at.y;
      return;
    }
    const r: Brain = lead.rv;
    const move = MOVE_BY_ID[m.move] ?? MOVES[0]!;
    const melee = attackForm(move) === "melee";
    const slot = m.ghostSlot ?? 0;
    let tx: number | undefined, ty: number | undefined, sp = 150;
    if (save && !this.dead && (r?.foe === "player" || lead.turbzHunter) && d < 340) {
      // Pincer: stand off on the far side of you from her, spread by slot, bobbing so it is not a fixed target.
      const reach = melee ? 46 : Math.min(140, attackRange(move) * 0.8);
      const base = Math.atan2(save.y - lead.y, save.x - lead.x);
      const ang = base + (slot - 1) * 0.95 + Math.sin(this.clock * 1.7 + slot * 2) * 0.45;
      tx = save.x + Math.cos(ang) * reach;
      ty = save.y + Math.sin(ang) * reach;
      sp = 160;
      m.aggro = true;
      this.combat = Math.max(this.combat ?? 0, 2);
    } else if (r?.foe && r.foe !== "player") {
      const foe = this.mobs.find((o: any) => o.id === r.foe && o.alive && o !== m);
      if (foe) {
        const a = this.clock * 1.3 + slot * 2.1;
        tx = foe.x + Math.cos(a) * 40;
        ty = foe.y + Math.sin(a) * 26;
        sp = 145;
        m.chipT = (m.chipT ?? 1) - dt;
        if (m.chipT <= 0 && Math.hypot(foe.x - m.x, foe.y - m.y) < (melee ? 70 : 150)) {
          m.chipT = 1 + rand() * 0.4;
          const dmg = Math.round(5 + (m.level ?? 1) * 1.3);
          this.playMoveFx?.(move, m.x, m.y - 12, foe.x, foe.y - 12);
          foe.hp -= dmg;
          this.float(foe.x, foe.y - 30, `${dmg}`, "#c9a6e8");
          if (foe.hp <= 0) { foe.hp = 0; foe.alive = false; if (foe.twitch) this.queueWitch(); }
        }
      }
    }
    if (tx === undefined || ty === undefined) {
      // Not fighting: keep up with her, then circle her.
      if (ld > 80) {
        const s = Math.min(210, ld * 3);
        this.moveMob(m, ((lead.x - m.x) / ld) * s * dt, ((lead.y - m.y) / ld) * s * dt);
      } else this.orbitMaster?.(m, lead, dt);
      return;
    }
    const hx = tx - m.x, hy = ty - m.y, hd = Math.hypot(hx, hy);
    if (hd > 3) this.moveMob(m, (hx / hd) * Math.min(sp, hd * 5) * dt, (hy / hd) * Math.min(sp, hd * 5) * dt);
    if (save) m.facing = save.x < m.x ? -1 : 1;
  };

  const origPlan = game.planGrind.bind(game);
  game.planGrind = function () {
    return origPlan();
  };
}
