/**
 * TURBZ. Hardcore on the charted continent (2500×2500). A window of that chart
 * is the ground you walk; the rest streams in as you reach the edge. No bounties,
 * no townsfolk and no quests. Rival witches grind, craft, catch spirits and sometimes die.
 */
import {
  CLASSES,
  CLASS_BY_ID,
  CLASS_RACE,
  MONSTERS,
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
  type RaceId,
} from "./content";
import type { ClassId } from "./classes";
import { cryingElements } from "./classes";
import { enemyTargets, expectedHunterPower } from "./balance";
import { generateWorld } from "./map-gen";
import { generateTexWorld, retextureDungeon } from "./tex-world";
import { beginChart, chartAnchors, presentChart, stampChartSave, tickChartPlay } from "./chart-play";
import { clearActiveChart } from "./chart-store";
import { setTexMode } from "./tile-atlas";
import { lmsSpawns } from "./lms";
import { hasStatus } from "./status-rules";
import { blocked } from "./world";
import { DAY_SECONDS } from "./daynight";
import { nearestShore } from "./survival";
import { combatRate } from "./pools";
import { ALL_ORDERS, thinkLikePlayer, typeEdge } from "./player-brain";
import { allTasksOn } from "./autoplay";
import { drawActor, drawShadowName } from "./sprites";

export const TURBZ_MAP = "custom-turbz";
/** Remembers the New Texture Mode choice made on the TURBZ screen (the run itself keeps its own on `save.turbzNewTex`). */
export const TURBZ_NEWTEX_PREF = "turbz-newtex-pref-v1";

/** The TURBZ wild for a seed: the classic generator, or the New Texture Mode one (new biomes, new textures only). */
export function buildTurbzWorld(seed: number, newTex: boolean, single = false) {
  const file = newTex
    ? generateTexWorld({ id: "turbz", name: "TURBZ", seed, w: 450, h: 450, single })
    : generateWorld({ id: "turbz", name: "TURBZ", seed, w: 450, h: 450, continentCount: single ? 1 : 5, citiesPerContinent: 1, islands: single ? 0 : 4, story: false, intro: "" });
  file.npcs = [];
  file.quests = [];
  file.id = "turbz";
  return file;
}
/** Where a TURBZ run is saved so leaving and returning resumes the same grind. */
export const TURBZ_SAVE_KEY = "turbz-run-v1";
/** The armor you keep forever: every piece from your bag, reset to level 1, enchants intact. */
export const TURBZ_HEIR_KEY = "turbz-heirloom-v1";
/** Your packed-up camp: it survives death and drops back when you place a campfire next life. */
export const TURBZ_CAMP_KEY = "turbz-camp-v1";

/**
 * EASY MODE (the TurboHunt tile): the exact same TURBZ, with the same camp, build mode, Storage Chest, Ghost Box,
 * power blocks, pools, dungeons and world bosses, but gentler. It keeps its OWN run, heirloom and camp slots so it
 * never touches a real TURBZ run. See `easyTune` for every knob that makes it easier.
 */
export const TURBZ_EASY_SAVE_KEY = "turbz-easy-run-v1";
export const TURBZ_EASY_HEIR_KEY = "turbz-easy-heirloom-v1";
export const TURBZ_EASY_CAMP_KEY = "turbz-easy-camp-v1";
let EASY = false;
const saveKey = () => (EASY ? TURBZ_EASY_SAVE_KEY : TURBZ_SAVE_KEY);
const heirKey = () => (EASY ? TURBZ_EASY_HEIR_KEY : TURBZ_HEIR_KEY);
const campKey = () => (EASY ? TURBZ_EASY_CAMP_KEY : TURBZ_CAMP_KEY);

/** Every easy-mode knob in one place. Tweak these numbers to make the TurboHunt version harder or easier. */
export const EASY_TUNE = {
  /** Rival witches on the wild (hard mode is 10 to 15). */
  witchesMin: 3,
  witchesSpread: 2,
  /** The most rivals that can be alive at once (hard mode is 15). */
  witchCap: 4,
  /** A rival only commits to you inside this range (hard mode is 1900) and gives up past the chase range (hard is 5200). */
  witchHunt: 520,
  witchChase: 1100,
  /** World bosses only notice you inside this range (hard mode is 2400). */
  bossAggro: 900,
  /** Damage you take, and the health of every foe. */
  dmgTaken: 0.5,
  foeHp: 0.8,
  /** Mana and stamina refill speed. */
  poolRegen: 1.6,
  /** Fraction of health you wake with after a knockout, and kyo lost. */
  reviveHp: 0.6,
  kyoLoss: 0.1,
};

/** Is there a TURBZ run to continue? (Used by the menu to offer Continue.) */
export function hasTurbzSave(easy = false): boolean {
  try { return !!localStorage.getItem(easy ? TURBZ_EASY_SAVE_KEY : TURBZ_SAVE_KEY); } catch { return false; }
}
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

/** TURBZ2 nations: the witch powers that hold cities and war across the wild. */
export const NATION_NAMES = ["Crimson Host", "Pale Court", "Ash Legion", "Tide Circle", "Green Compact", "Gold Pact", "Void Choir"];
export const NATION_COLORS = ["#d8524a", "#c9a6e8", "#f08a24", "#5ab0e8", "#7dcea0", "#e6c15a", "#9a6ad8"];
export const NATION_COUNT = 5;
/** TURBZ2 economy: harvest-witches gather the land and carry materials home to grow each nation. */
export const HARVEST_START = 50;   // resource witches on the map at the start, spread across the nations
const HARVEST_CAP = 6;             // materials a harvester carries per trip
const HARVEST_BITE = 2;            // materials gained per gather tick
const HARVEST_TIME = 1.2;          // seconds per gather bite
const HARVEST_RECRUIT = 30;        // materials a nation spends to raise one combat witch
const HARVEST_SPEED = 64;          // harvester walk speed (px/s)
const NATION_COMBAT_CAP = 14;      // most combat witches a nation grows to (performance guard)
const TURBZ2_MOB_CAP = 170;        // global living-mob cap for TURBZ2
// TURBZ2 is a no-sides battlefield: every witch fights every other witch (and the player), so the
// wild is a constant brawl and the aggression is spread out instead of everyone hunting you.
const TURBZ2_FREE_FOR_ALL = true;  // set false to restore the old team/nation war
const TURBZ2_FIGHTERS = 60;        // battlefield witches kept alive across the continent
const TURBZ2_FILL_EVERY = 6;       // seconds between population top-ups
/** Witches level-checked per frame. The rotating cursor covers the whole pool over several frames. */
const TURBZ2_LEVEL_SLICE = 6;

/**
 * The night siege.
 *
 * TURBZ nights used to only make the foes already on the map hit harder. Now the dark brings its
 * own: hostile foes rise out of the wild in a ring around you and come straight for you, in waves,
 * for as long as the night lasts. Dawn stops the waves — see `tickNightSiege` for what happens to
 * the ones still standing.
 *
 * The cap is the important number. The world already holds witches and camp foes, so the siege is
 * deliberately a small, constant pressure rather than a horde: a dozen foes that all actually reach
 * you is far more dangerous, and far cheaper to run, than fifty wandering about.
 */
const SIEGE_CAP = 12;            // most siege foes alive at once
const SIEGE_EVERY = 3.4;         // seconds between waves
const SIEGE_PER_WAVE = 2;        // foes per wave (before the per-night ramp)
const SIEGE_RING_MIN = 340;      // closest a foe rises, in pixels: outside arm's reach
const SIEGE_RING_MAX = 620;      // furthest: close enough to find you, far enough to see coming
/** Each night survived adds this to the cap and to the wave size, so later nights press harder. */
const SIEGE_NIGHT_RAMP = 2;
const SIEGE_CAP_MAX = 22;
/** Easy mode still gets a night siege, just a gentler one. */
const SIEGE_EASY = { cap: 5, every: 5.5, perWave: 1, ramp: 1, capMax: 9 };
/** Travellers crossing the TURBZ wild: the mode has no towns, so Social needs someone to meet. */
const WANDER_MAX = 3;          // out at once
const WANDER_FIRST = 25;       // seconds before the first one shows up in a run
const WANDER_EVERY = 95;       // roughly how long between arrivals
const WANDER_STAY_MIN = 240;   // how long one keeps to the area before moving on
const WANDER_STAY_MAX = 460;
const WANDER_SPEED = 38;       // px/s: an amble, slower than a witch
const WANDER_REACH = 74;       // how close you must be to speak
const WANDER_SOCIAL_XP = 12;
const WANDERER_NAMES = ["Hald", "Mirren", "Ossa", "Pell", "Tove", "Ingra", "Caul", "Resh", "Vanya", "Orrin", "Sabel", "Dunn"];
const WANDERER_ROLES = ["a pedlar", "a map-maker", "a salt carrier", "a pilgrim", "a bone-setter", "a tinker", "a seed trader", "a message runner"];
const WANDERER_LINES = [
  "The witches out here do not ask who you are before they decide.",
  "I walk by day and sit very still by night. It has worked so far.",
  "Ore runs deeper where the rock has gone black. Mind the roof.",
  "If a door hums, it is open. If it sings, something came through it.",
  "I have seen a ghost take a shine to someone. Rare. Worth the walk.",
  "Everything out here grows back. That is the trouble with it.",
  "Keep a shore at your back and you will never go hungry.",
  "The quiet ones in the dark are the ones already looking at you.",
];

/** Seconds a battlefield witch keeps the rival she picked before looking for a nearer one. */
const TURBZ2_TARGET_HOLD = 1.5;
// Nations re-assign jobs on the fly so they never get stuck as all-harvesters or all-defenders:
const NATION_COMBAT_MIN = 5;       // a nation drafts harvesters into fighters below this army size
const NATION_HARVEST_MIN = 6;      // a nation demobilizes fighters into harvesters below this many
const NATION_GARRISON = 2;         // fighters that stay to guard the city; the rest raid enemy cities
const NATION_CMD_EVERY = 4;        // seconds between nation command passes (rebalance + duties)

export function installTurbz(game: any): void {
  game.turbz = false;
  game.turbzEasy = false;
  game.turbz2 = false;
  game.pools = null;
  game.orders = null;

  game.startTurbz = function (name: string, _race: string, _classId: string, traitId: string | null, female: boolean, pickClass = false, newTex?: boolean, easy?: boolean) {
    // TURBZ2 sets `pendingTurbz2` before calling through here so the world is built as ONE continent.
    this.turbz2 = !!this.pendingTurbz2;
    // Easy (TurboHunt) is remembered on the game so a rebirth, which passes no choice, stays in the same mode.
    this.turbzEasy = easy ?? !!this.turbzEasy;
    EASY = !!this.turbzEasy;
    // Rebirth passes no choice: the next life keeps the texture mode the last one used.
    const useNewTex = true; // NewTex is permanent in TURBZ.
    // Parameter kept in the signature for back-compat but ignored.
    void newTex;
    this.orders = allTasksOn();
    this.teamSeq = 1;
    // swapRules clears the turbz flag; set it true again afterwards, before begin, so the run is TURBZ.
    this.swapRules("hardcore");
    this.turbz = true;
    // Any class can play TURBZ at the full XP rate (the Crying Girl is no longer forced). `pickClass` is kept for old callers.
    void pickClass;
    const classId = _classId || "cryinggirl";
    const race = (CLASS_RACE as Record<string, string>)[classId] ?? _race ?? "tide";
    this.begin(name, race, undefined, classId, traitId, female);
    const save = this.save;
    if (save) save.turbzPickedClass = false;
    if (!save) return;
    save.turbzEasy = EASY;
    save.cryRebuildMark = Math.floor((save.level ?? 1) / 50);
    save.mergeArmor = true; // TURBZ: duplicate pieces merge/level up instead of cluttering the bag.
    // Skills, perks, account level/XP and score are ACCOUNT progress: they are NOT wiped on death or a new run.
    // Start from a blank sheet, then fold the saved account record back in (the furthest of each wins).
    save.skills = Object.fromEntries(SKILLS.map((sk) => [sk.id, { level: 1, xp: 0 }]));
    save.perks = {};
    save.perkPoints = 0;
    save.accountLevel = 1;
    save.accountXp = 0;
    save.accountScore = 0;
    this.foldAccount(save);
    save.skillPoints = 0;
    save.level = 1;
    save.xp = 0;
    save.spirits = [];
    save.ghostStore = [];
    save.party = [];
    save.campGround = {}; // new wild: previous cleared camp zones do not carry over
    save.mined = {}; // new wild: nothing has been mined yet
    save.kyo = 0;
    save.bag = { potion: 2 };
    if (save.hunt) { save.hunt.wanted = 0; save.hunt.stars = 0; save.hunt.board = []; save.hunt.waveIn = 0; }
    save.dayNight = { t: DAY_SECONDS * 0.35, nights: 0 };
    const seed = (Math.random() * 1e9) >>> 0 || 7;
    // The seed rebuilds the same continent. The chart itself is never saved — only the fog and where you stand.
    save.turbzSeed = seed;
    save.turbzNewTex = useNewTex;
    save.fog = null;
    save.chartMined = [];
    setTexMode(useNewTex);
    const play = beginChart(this, seed, save);
    const chart = play.chart;
    save.map = TURBZ_MAP;
    this.contract = [];
    this.loadMap(TURBZ_MAP, true);
    if (this.world) this.world.swim = true;
    const n = EASY ? EASY_TUNE.witchesMin + Math.floor(rand() * EASY_TUNE.witchesSpread) : 10 + Math.floor(rand() * 6);
    const spots = lmsSpawns(this.world, n + 1);
    // Wake on the chart's start tile (habitable ground). Drop the witch spot nearest that, so a rival doesn't spawn on you.
    let mine = 0;
    let best = Infinity;
    spots.forEach((p, i) => {
      const d = Math.hypot(p.x - save.x, p.y - save.y);
      if (d < best) { best = d; mine = i; }
    });
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
    this.say(EASY ? `TURBZ (easy). Level 1 on a ${chart.w}×${chart.h} continent with ${n} calm witches. The map (M) fills in as you walk. Light a campfire (H) to build a camp, a bed, a Storage Chest and a Ghost Box. If you fall you only lose a little kyo, never your level or gear.` : `TURBZ. Level 1 on a ${chart.w}×${chart.h} continent. The map (M) starts dark and fills in as you walk. Dungeons and world bosses drop the good gear. ${n} witches are hunting. Spells drink mana, melee drinks stamina. Die and you keep your whole armour bag (reset to level 1, enchants intact). Leave and come back and the run is right where you left it.`);
    this.giveTurbzHeirloom();
    // Bring back the camp you were packed up with, so placing a campfire drops it where you stand.
    try { save.turbzCamp = JSON.parse(localStorage.getItem(campKey()) ?? "null"); } catch { save.turbzCamp = null; }
    // A Ghost Box still standing in the old run's wild is folded into the packed camp, so it comes back with it.
    if (save.ghostBox) {
      save.turbzCamp = save.turbzCamp ?? { logs: [], beds: [], chest: null, ghostBox: null, ghostStore: [] };
      save.turbzCamp.ghostBox = save.turbzCamp.ghostBox ?? { dx: 1, dy: 1 };
      save.ghostBox = null;
    }
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
    // TURBZ2: a freshly spawned batch of witches still belongs to the warring nations.
    if (this.turbz2) this.layerNations();
  };

  /**
   * TURBZ2 — the war world. Starts a normal TURBZ run, then layers the nations on top: each nation
   * gets a City on the map and every rival witch is sworn to the nearest one. Witches of the same
   * nation are allies; different nations are enemies, so the powers war across the wild around you.
   * (Stage 1: nations, cities and allegiances. Per-nation hostility toward the player, talking and
   * besieged cities come in the next stages.)
   */
  game.startTurbz2 = function (name: string, _race: string, _classId: string, traitId: string | null, female: boolean, pickClass = false, newTex?: boolean, easy?: boolean) {
    this.pendingTurbz2 = true;            // so the world builds as ONE continent (same as the Witch Circle)
    this.startTurbz(name, _race, _classId, traitId, female, pickClass, newTex, easy);
    this.pendingTurbz2 = false;
    const save = this.save;
    if (!save) return;
    this.turbz2 = true;
    save.turbz2 = true;
    save.nations = null; // a new TURBZ2 run builds a fresh set of city landmarks
    this.layerNations();
    if (TURBZ2_FREE_FOR_ALL) {
      this.spawnBattlefield(TURBZ2_FIGHTERS);
      this.say(`TURBZ2. One continent, no sides. Every witch fights for herself — they hunt each other as readily as they hunt you, so the wild is a constant battlefield. Cities dot the map as landmarks. Open the Map (M).`);
    } else {
      this.spawnNationGarrisons(3);
      this.spawnNationHarvesters(HARVEST_START);
      this.say(`TURBZ2. ${NATION_COUNT} witch nations hold cities on one continent and war on each other. Their harvest-witches gather the land to grow their armies. You cannot tell who is who in the field — only at their cities. Open the Map (M) to find them.`);
    }
    this.persistTurbz();
    this.syncHud(true);
  };

  /** Build the nations and their cities (once), then swear every rival witch to her nearest nation. */
  game.layerNations = function () {
    const save = this.save;
    const world = this.turbzWorld || this.world;
    if (!save || !world) return;
    if (!Array.isArray(save.nations) || !save.nations.length) {
      const cand = (lmsSpawns(world, NATION_COUNT * 6) ?? []).filter((p: any) => Math.hypot(p.x - save.x, p.y - save.y) > 760);
      const cities: any[] = [];
      for (let i = 0; i < NATION_COUNT && cand.length; i++) {
        // spread the cities: pick the candidate farthest from the player and the cities chosen so far
        let bi = 0, bd = -1;
        cand.forEach((p: any, idx: number) => {
          const d = cities.length ? Math.min(...cities.map((c) => Math.hypot(c.x - p.x, c.y - p.y))) : Math.hypot(p.x - save.x, p.y - save.y);
          if (d > bd) { bd = d; bi = idx; }
        });
        const p = cand.splice(bi, 1)[0];
        cities.push({ id: i, name: NATION_NAMES[i] ?? `Nation ${i + 1}`, color: NATION_COLORS[i] ?? "#f0e2c8", x: p.x, y: p.y, known: false });
      }
      save.nations = cities;
    }
    const cities = save.nations as any[];
    if (!cities.length) return;
    for (const m of this.mobs) {
      if (!m.twitch || !m.rv) continue;
      let nid = 0, nd = Infinity;
      for (const c of cities) { const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < nd) { nd = d; nid = c.id; } }
      m.nation = nid;
      // Free-for-all: no team, so she treats every other witch as a foe. (Team war uses nid+1.)
      m.rv.team = TURBZ2_FREE_FOR_ALL ? 0 : nid + 1;
    }
  };

  /** A lone battlefield witch: no team, hostile to everyone, dropped onto open land to go brawl. */
  game.makeBattlefieldWitch = function (i: number, x: number, y: number) {
    const m = this.makeTwitch(4000 + i, x, y, pick(WITCH_NAMES));
    m.harvester = false;
    m.aggro = true;
    if (m.rv) { m.rv.team = 0; m.rv.foe = ""; m.rv.foeT = 0; m.rv.state = "hunt"; }
    return m;
  };

  /** Seed the continent with `total` free-for-all witches, spread out so fights break out all over. */
  game.spawnBattlefield = function (total = TURBZ2_FIGHTERS) {
    const save = this.save;
    const world = this.turbzWorld || this.world;
    if (!save || !world) return;
    const spots = (lmsSpawns(world, total * 2) ?? []).filter((p: any) => Math.hypot(p.x - save.x, p.y - save.y) > 560);
    // Count the living once and then keep the tally as we push, instead of re-filtering the whole
    // mob list on every one of the sixty spawns — that made starting a TURBZ2 run hitch.
    const mobs = (this.mobs ??= []);
    let alive = 0;
    for (let i = 0; i < mobs.length; i++) if (mobs[i]?.alive) alive++;
    for (let i = 0; i < total; i++) {
      if (alive >= TURBZ2_MOB_CAP) break;
      const p = spots.length ? spots[i % spots.length] : { x: save.x + (rand() * 2400 - 1200), y: save.y + (rand() * 2400 - 1200) };
      mobs.push(this.makeBattlefieldWitch(i, p.x, p.y));
      alive++;
    }
  };

  /** Keep the battlefield lively: top the witch population back up as they cut each other down. */
  game.battlefieldMaintain = function (dt: number) {
    const save = this.save;
    if (!this.turbz2 || !save) return;
    this.bfT = (this.bfT ?? 0) - dt;
    if (this.bfT > 0) return;
    this.bfT = TURBZ2_FILL_EVERY;
    // One walk for both tallies, rather than two throwaway arrays.
    const mobs = this.mobs ?? [];
    let alive = 0, total = 0;
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (!m?.alive) continue;
      total++;
      if (m.twitch) alive++;
    }
    if (alive >= TURBZ2_FIGHTERS || total >= TURBZ2_MOB_CAP) return;
    // refill a few at a time, spawned off-screen so witches appear from the wild, not on top of you
    const world = this.turbzWorld || this.world;
    const spots = (lmsSpawns(world, 40) ?? []).filter((p: any) => Math.hypot(p.x - save.x, p.y - save.y) > 1500);
    const want = Math.min(TURBZ2_FIGHTERS - alive, 4, TURBZ2_MOB_CAP - total);
    for (let i = 0; i < want; i++) {
      const p = spots.length ? spots[(Math.random() * spots.length) | 0] : { x: save.x + (rand() * 3000 - 1500), y: save.y + (rand() * 3000 - 1500) };
      this.mobs.push(this.makeBattlefieldWitch(5000 + ((Math.random() * 1e6) | 0), p.x, p.y));
    }
  };

  /** Garrison each nation's city with a few of its own witches, so the powers have a visible home force. */
  game.spawnNationGarrisons = function (perCity = 3) {
    const save = this.save;
    if (!this.turbz2 || !save || !Array.isArray(save.nations)) return;
    for (const c of save.nations) {
      for (let k = 0; k < perCity; k++) {
        const m = this.makeTwitch(950 + c.id * 10 + k, c.x, c.y, pick(WITCH_NAMES));
        m.nation = c.id;
        if (m.rv) { m.rv.team = c.id + 1; m.homeX = c.x; m.homeY = c.y; }
        this.mobs.push(m);
      }
    }
  };

  /** The resource nodes harvesters wander to (cached from the world's node spawns). */
  game.buildHarvestNodes = function () {
    const world = this.turbzWorld || this.world;
    this.harvestNodes = (world?.spawns ?? []).filter((s: any) => s.kind === "node" && s.node !== "fish").map((s: any) => ({ x: s.x, y: s.y }));
  };

  /** A resource node for a harvester at (x,y): a random one within its home range, else the nearest. */
  game.nearestHarvestNode = function (x: number, y: number) {
    const nodes = this.harvestNodes as { x: number; y: number }[] | undefined;
    if (!nodes || !nodes.length) return null;
    // forage close to home so a harvester completes trips quickly (short round-trips = steady growth);
    // a little randomness keeps them visually spread out rather than all stacked on one node
    let near = nodes.filter((n) => Math.hypot(n.x - x, n.y - y) < 650);
    if (!near.length) near = nodes.filter((n) => Math.hypot(n.x - x, n.y - y) < 1400);
    const pool = near.length ? near : nodes;
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  };

  /** A non-combat harvest witch: a witch body with no warrior AI, sworn to a nation. */
  game.makeHarvester = function (i: number, x: number, y: number, nation: number) {
    const m = this.makeTwitch(2000 + i, x, y, pick(WITCH_NAMES));
    m.harvester = true;
    m.aggro = false;
    m.turbzHunter = false;
    m.nation = nation;
    if (m.rv) { m.rv.team = nation + 1; m.rv.foe = ""; m.rv.foeT = 0; m.rv.state = "harvest"; }
    m.carry = 0; m.hvNode = null; m.hvT = 0; m.homeX = x; m.homeY = y;
    // keep her full fighting profile so she can be drafted back into the army later
    m.baseStats = m.stats ? { ...m.stats } : { hp: 1, dmg: 1, speed: 1, crit: 0.05, dodge: 0.1 };
    m.stats = { hp: 0.7, dmg: 0.2, speed: 1.0, crit: 0, dodge: 0.12 };
    m.duty = "harvest";
    return m;
  };

  /** Draft a harvester into the army: she drops her basket and fights for her nation. */
  game.convertToFighter = function (m: any, nationId?: number) {
    if (!m || !m.twitch) return;
    const save = this.save;
    const nid = nationId ?? m.nation ?? 0;
    const city = save?.nations?.[nid];
    m.harvester = false;
    m.aggro = true;
    m.carry = 0; m.hvNode = null; m.hvT = 0;
    if (m.baseStats) m.stats = { ...m.baseStats };
    if (city) { m.homeX = city.x; m.homeY = city.y; }
    if (m.rv) { m.rv.foe = ""; m.rv.foeT = 0; m.rv.state = "hunt"; }
    m.duty = "guard";
    this.float?.(m.x, m.y - 46, "TO ARMS", "#e0b060");
  };

  /** Demobilize a fighter into a harvester: her nation needs materials more than another blade. */
  game.convertToHarvester = function (m: any, nationId?: number) {
    if (!m || !m.twitch) return;
    const save = this.save;
    const nid = nationId ?? m.nation ?? 0;
    const city = save?.nations?.[nid];
    m.harvester = true;
    m.aggro = false;
    m.turbzHunter = false;
    m.carry = 0; m.hvNode = null; m.hvT = 0;
    if (city) { m.homeX = city.x; m.homeY = city.y; }
    if (!m.baseStats) m.baseStats = m.stats ? { ...m.stats } : { hp: 1, dmg: 1, speed: 1, crit: 0.05, dodge: 0.1 };
    m.stats = { hp: 0.7, dmg: 0.2, speed: 1.0, crit: 0, dodge: 0.12 };
    if (m.rv) { m.rv.foe = ""; m.rv.foeT = 0; m.rv.state = "harvest"; }
    m.duty = "harvest";
    this.float?.(m.x, m.y - 46, "TO FIELDS", "#9ad8c8");
  };

  /**
   * Nation high-command, run every few seconds. Two jobs:
   *  1) Rebalance labour vs war — draft harvesters when the army is thin, demobilize fighters when
   *     the economy is starving — so a nation is never stuck as all-harvesters or all-defenders.
   *  2) Hand out duties — keep a small city garrison, send everyone else raiding enemy cities, so
   *     armies actually march and fight instead of sitting at home.
   */
  game.nationCommand = function (dt: number) {
    const save = this.save;
    if (!this.turbz2 || !save || !Array.isArray(save.nations) || !save.nations.length) return;
    this.natCmdT = (this.natCmdT ?? 0) - dt;
    if (this.natCmdT > 0) return;
    this.natCmdT = NATION_CMD_EVERY;
    const nations = save.nations;
    const slots = nations.map(() => ({ fighters: [] as any[], harvesters: [] as any[] }));
    for (const m of this.mobs) {
      if (!m.twitch || !m.alive || m.nation == null) continue;
      const s = slots[m.nation];
      if (!s) continue;
      (m.harvester ? s.harvesters : s.fighters).push(m);
    }
    for (const c of nations) {
      const s = slots[c.id];
      if (!s) continue;
      let fighters = s.fighters;
      let harvesters = s.harvesters;
      const near = Math.hypot((save.x ?? 0) - c.x, (save.y ?? 0) - c.y) < 2200;
      // 1a) army too thin → call harvesters to arms (keep a labour floor)
      if (fighters.length < NATION_COMBAT_MIN && harvesters.length > NATION_HARVEST_MIN) {
        const draft = Math.min(NATION_COMBAT_MIN - fighters.length, harvesters.length - NATION_HARVEST_MIN);
        harvesters.sort((a: any, b: any) => (a.carry ?? 0) - (b.carry ?? 0) || (Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)));
        for (let i = 0; i < draft; i++) { this.convertToFighter(harvesters[i], c.id); fighters.push(harvesters[i]); }
        harvesters = harvesters.slice(draft);
        if (draft > 0 && near) this.say(`The ${c.name} call their harvesters to arms.`);
      }
      // 1b) economy starving → send surplus fighters back to the fields
      else if (harvesters.length < NATION_HARVEST_MIN && fighters.length > NATION_COMBAT_MIN) {
        const send = Math.min(NATION_HARVEST_MIN - harvesters.length, fighters.length - NATION_COMBAT_MIN);
        fighters.sort((a: any, b: any) => ((a.rv?.foeT ?? 0) - (b.rv?.foeT ?? 0)) || (Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)));
        for (let i = 0; i < send; i++) { this.convertToHarvester(fighters[i], c.id); }
        fighters = fighters.slice(send);
        if (send > 0 && near) this.say(`The ${c.name} send warriors back to the fields.`);
      }
      // 2) duties: nearest to the city guard it, the rest raid the nearest enemy city
      const enemies = nations.filter((n: any) => n.id !== c.id);
      fighters.sort((a: any, b: any) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
      fighters.forEach((f: any, idx: number) => {
        if (idx < NATION_GARRISON || !enemies.length) { f.duty = "guard"; f.raidTarget = null; return; }
        f.duty = "raid";
        let best: any = null, bd = Infinity;
        for (const e of enemies) { const d = Math.hypot(e.x - f.x, e.y - f.y); if (d < bd) { bd = d; best = e; } }
        f.raidTarget = best ? { x: best.x, y: best.y } : null;
      });
    }
  };

  /** Spread `total` harvest witches across the nations at the start of a TURBZ2 run. */
  game.spawnNationHarvesters = function (total = HARVEST_START) {
    const save = this.save;
    if (!this.turbz2 || !save || !Array.isArray(save.nations) || !save.nations.length) return;
    this.buildHarvestNodes();
    const nats = save.nations;
    for (let i = 0; i < total; i++) {
      const c = nats[i % nats.length];
      this.mobs.push(this.makeHarvester(i, c.x, c.y, c.id));
    }
  };

  /** Grow a nation: raise one combat witch at its city (capped for performance). */
  game.spawnNationWitch = function (nationId: number) {
    const save = this.save;
    if (!save || !Array.isArray(save.nations)) return;
    const c = save.nations[nationId];
    if (!c) return;
    if ((this.mobs ?? []).filter((m: any) => m.alive).length >= TURBZ2_MOB_CAP) return;
    const combat = (this.mobs ?? []).filter((m: any) => m.twitch && !m.harvester && m.alive && m.nation === nationId).length;
    if (combat >= NATION_COMBAT_CAP) return;
    const m = this.makeTwitch(3000 + nationId * 100 + ((Math.random() * 1e6) | 0), c.x, c.y, pick(WITCH_NAMES));
    m.nation = nationId;
    if (m.rv) { m.rv.team = nationId + 1; m.homeX = c.x; m.homeY = c.y; }
    this.mobs.push(m);
  };

  /** Walk a harvester toward (tx,ty), sliding along blocked tiles, with walk/direction for the sprite. */
  game.moveHarvester = function (m: any, tx: number, ty: number, dt: number) {
    const world = this.turbzWorld || this.world;
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
    const sp = HARVEST_SPEED * dt;
    const nx = m.x + (dx / d) * sp, ny = m.y + (dy / d) * sp;
    const bx = world ? blocked(world, nx, m.y) : false;
    const by = world ? blocked(world, m.x, ny) : false;
    if (!bx) m.x = nx;
    if (!by) m.y = ny;
    if (bx && by) { m.x += (Math.random() - 0.5) * 6; m.y += (Math.random() - 0.5) * 6; }
    m.facing = dx < 0 ? -1 : 1;
    m.moving = true;
    m.walk = (m.walk ?? 0) + dt * 6;
    m.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  };

  /** Harvester brain: gather from a node → carry home → deposit → the nation grows. */
  game.tickHarvester = function (m: any, dt: number) {
    if (!m.alive) return;
    const save = this.save;
    const nation = save?.nations?.[m.nation];
    if (!nation) return;
    if ((m.carry ?? 0) >= HARVEST_CAP) {
      const d = Math.hypot(m.x - nation.x, m.y - nation.y);
      if (d < 56) {
        nation.stock = (nation.stock ?? 0) + m.carry;
        m.carry = 0; m.hvNode = null; m.moving = false;
        while ((nation.stock ?? 0) >= HARVEST_RECRUIT) { nation.stock -= HARVEST_RECRUIT; this.spawnNationWitch(m.nation); }
      } else this.moveHarvester(m, nation.x, nation.y, dt);
      return;
    }
    if (!m.hvNode) m.hvNode = this.nearestHarvestNode(m.x, m.y);
    if (!m.hvNode) { this.moveHarvester(m, nation.x, nation.y, dt); return; }
    const nd = m.hvNode;
    if (Math.hypot(m.x - nd.x, m.y - nd.y) > 30) { this.moveHarvester(m, nd.x, nd.y, dt); m.hvT = 0; return; }
    m.moving = false;
    m.hvT = (m.hvT ?? 0) + dt;
    if (m.hvT >= HARVEST_TIME) {
      m.hvT = 0;
      m.carry = (m.carry ?? 0) + HARVEST_BITE;
      this.float?.(m.x, m.y - 40, "+mat", "#d8c48a");
      // stay at THIS node until full, so a harvester actually completes a load instead of
      // running across the map between every bite (which left nations stuck at 0 growth)
    }
  };

  /** How close (world px) you must be to a city to read which nation holds it. */
  game.nationCityReveal = function () {
    const save = this.save;
    if (!this.turbz2 || !save || !Array.isArray(save.nations)) return;
    for (const c of save.nations) {
      if (!c.known && Math.hypot((save.x ?? 0) - c.x, (save.y ?? 0) - c.y) < 220) {
        c.known = true;
        this.say(`You reach the city of the ${c.name}.`);
      }
    }
  };

  /** Save the current TURBZ run so it can be resumed after leaving. */
  game.persistTurbz = function () {
    const save = this.save;
    if (!this.turbz || !save || this.dead) return;
    stampChartSave(this);
    try { localStorage.setItem(saveKey(), JSON.stringify(save)); } catch { /* private mode */ }
    // Skills, perks and account level are kept on the account, so they survive death and carry into the next run.
    try { this.writeProgress(save); } catch { /* private mode */ }
    this.mirrorTurbzCamp();
  };

  /** Forget the resume slot (on death — the next life starts fresh, keeping the armour heirloom). */
  game.clearTurbzSave = function () {
    try { localStorage.removeItem(saveKey()); } catch { /* private mode */ }
  };

  /** Resume a saved TURBZ run: same world (from its seed), same witch, gear, skills and grind. */
  game.continueTurbz = function (easy?: boolean): boolean {
    this.turbzEasy = easy ?? !!this.turbzEasy;
    EASY = !!this.turbzEasy;
    let raw: any = null;
    try { raw = JSON.parse(localStorage.getItem(saveKey()) ?? "null"); } catch { raw = null; }
    if (!raw || !raw.name) return false;
    this.orders = allTasksOn();
    this.teamSeq = 1;
    // swapRules clears the turbz flag; set it true again afterwards so the resumed run is TURBZ.
    this.swapRules("hardcore");
    this.turbz = true;
    const seed = (raw.turbzSeed as number) || ((Math.random() * 1e9) >>> 0 || 7);
    raw.turbzSeed = seed;
    raw.turbzEasy = EASY;
    // A war-world save (it holds nations) is always TURBZ2, so it always rebuilds as ONE continent —
    // this migrates older TURBZ2 saves made before the turbz2 flag was persisted, which would
    // otherwise come back as the multi-continent wild.
    if (Array.isArray(raw.nations) && raw.nations.length) raw.turbz2 = true;
    // Rebuild the exact same wild from the saved seed before booting into it (same generator it was made with).
    raw.turbzNewTex = true; // NewTex is permanent in TURBZ (migrates old saves on load).
    setTexMode(raw.turbzNewTex);
    // Same continent as the run was charted on. A save from before the chart has no chart position,
    // so it wakes on the new start tile instead of trying to stand on the old 450 map.
    const at = Number.isFinite(raw.chartX) && Number.isFinite(raw.chartY)
      ? { tx: Math.max(0, Math.floor(raw.chartX / 32)), ty: Math.max(0, Math.floor(raw.chartY / 32)) }
      : undefined;
    beginChart(this, seed, raw, at);
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
    // Resume a TURBZ2 run as a nations run (the cities are saved; witches are re-sworn to them).
    this.turbz2 = !!save.turbz2;
    this.spawnTurbzWitches(EASY ? EASY_TUNE.witchesMin + Math.floor(rand() * EASY_TUNE.witchesSpread) : 10 + Math.floor(rand() * 6));
    if (this.turbz2) {
      this.layerNations();
      if (TURBZ2_FREE_FOR_ALL) this.spawnBattlefield(TURBZ2_FIGHTERS);
      else { this.spawnNationGarrisons(3); this.spawnNationHarvesters(HARVEST_START); }
    }
    this.plantTurbzHunts();
    // No camp standing and none packed in this run? Pick up the one kept off-run (a camp from an older run).
    if (save.survival && !this.turbzCampBlueprint() && !save.turbzCamp) {
      try { save.turbzCamp = JSON.parse(localStorage.getItem(campKey()) ?? "null"); } catch { save.turbzCamp = null; }
    }
    this.fixTurbzGhostBox?.();
    this.say(EASY ? "TURBZ (easy) resumed. Your witch, camp and grind are right where you left them." : "TURBZ resumed. Your witch, your gear and your grind are right where you left them.");
    this.persistTurbz();
    this.syncHud(true);
    return true;
  };

  game.plantTurbzHunts = function () {
    const save = this.save;
    if (!save || !this.world) return;
    save.dungeons = save.dungeons ?? { elapsed: 0, sequence: 1, portals: [], day: 0, dayElapsed: 0, stamps: {} };
    const spots = this.chartPlay ? chartAnchors(this.chartPlay, 14) : lmsSpawns(this.world, 14);
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
      m.aggroRange = EASY ? EASY_TUNE.bossAggro : 2400;
      m.homeX = p.x;
      m.homeY = p.y;
      // Bosses respawn on the wild (never permanently gone): long timer but they come back.
      m.respawnDelay = 600; // 10 min
      this.mobs.push(m);
    });
    this.say("Six dungeons are open, and five world bosses walk the wild. That is where the good gear is.");
  };

  game.tickChartPlay = function () {
    tickChartPlay(this);
  };

  const origSwap = game.swapRules.bind(game);
  game.swapRules = function (rules: string) {
    origSwap(rules);
    this.chartPlay = null;
    clearActiveChart();
  };

  const origRegrow = game.regrowNodes?.bind(game);
  if (origRegrow) {
    game.regrowNodes = function (why: string) {
      origRegrow(why);
      if (this.chartPlay && this.save?.map === TURBZ_MAP) {
        presentChart(this);
        this.applyCampGround?.(this.save.map);
        this.applyMined?.(this.save.map);
        this.syncSolids?.(this.save.map);
        this.refreshTerrain?.();
      }
    };
  }

  const origLoad = game.loadMap.bind(game);
  game.loadMap = function (map: string, fresh: boolean) {
    if (this.turbz) {
      this.turbzRoster = (this.turbzRoster ?? []).filter((m: any) => m?.alive);
      for (const m of this.mobs ?? []) {
        if ((m.twitch || m.turbzBoss || m.twitchPet) && m.alive && !this.turbzRoster.includes(m)) this.turbzRoster.push(m);
      }
    }
    if (map === TURBZ_MAP && this.chartPlay) {
      presentChart(this);
      const save = this.save;
      if (save) {
        save.map = map;
        this.applyTakenNodes?.(map);
        this.applyCampGround?.(map);
        this.applyMined?.(map);
        this.syncSolids?.(map);
        if (fresh || this.populationMap !== map) {
          this.mobs = [];
          this.dormant = [];
          this.populationMap = map;
        }
      }
    } else {
      origLoad(map, fresh);
    }
    // New Texture Mode: the wild is generated with the new art, and every dungeon is re-skinned to match.
    const newTex = !!(this.turbz && this.save?.turbzNewTex);
    setTexMode(newTex);
    if (newTex && map !== TURBZ_MAP && this.world && this.isDungeonMap?.(map)) retextureDungeon(this.world);
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
    // The Super Ghost (if one is extracted) comes back with you at level 1, like party ghosts do.
    const superGhost = save.superGhost ? {
      ...save.superGhost,
      hp: 1,
      maxHp: Math.max(100, Math.floor((save.superGhost.maxHp ?? 100) * 0.25)),
      level: 1,
    } : null;
    this.turbzHeirloom = { gear, equipped, spirits, superGhost };
    // Persist it so your armour survives even if you close the game on the You Died screen.
    try { localStorage.setItem(heirKey(), JSON.stringify(this.turbzHeirloom)); } catch { /* private mode */ }
  };

  game.giveTurbzHeirloom = function () {
    let kit = this.turbzHeirloom;
    if (!kit) { try { kit = JSON.parse(localStorage.getItem(heirKey()) ?? "null"); } catch { kit = null; } }
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
    if (kit.superGhost) save.superGhost = { ...kit.superGhost, hp: kit.superGhost.maxHp };
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
    // Power machines: keep every piece's full state (ore in generators, items in duplicators,
    // the merger's queue + super-in-progress, the forge's pile tally, wire network — everything).
    const rel = (list: any[] | undefined) => (list ?? []).filter((n: any) => n.map === fire.map)
      .map((n: any) => ({ ...n, dx: n.tx - bx, dy: n.ty - by }));
    const powerGens = rel(save.powerGens);
    const powerBats = rel(save.powerBats);
    const powerWires = rel(save.powerWires);
    const powerXps = rel(save.powerXps);
    const powerDups = rel(save.powerDups);
    const powerMergers = rel(save.powerMergers);
    const powerForges = rel(save.powerForges);
    const powerExtra = rel(save.powerExtra);
    return { fire, camp: { logs, beds, chest, ghostBox, ghostStore, powerGens, powerBats, powerWires, powerXps, powerDups, powerMergers, powerForges, powerExtra } };
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
    try { localStorage.setItem(campKey(), JSON.stringify(camp)); } catch { /* private mode */ }
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
        try { save.turbzCamp = JSON.parse(localStorage.getItem(campKey()) ?? "null"); } catch { save.turbzCamp = null; }
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
    // Lift every power machine off the world too — they come back when the camp drops.
    save.powerGens = (save.powerGens ?? []).filter((n: any) => n.map !== fire.map);
    save.powerBats = (save.powerBats ?? []).filter((n: any) => n.map !== fire.map);
    save.powerWires = (save.powerWires ?? []).filter((n: any) => n.map !== fire.map);
    save.powerXps = (save.powerXps ?? []).filter((n: any) => n.map !== fire.map);
    save.powerDups = (save.powerDups ?? []).filter((n: any) => n.map !== fire.map);
    save.powerMergers = (save.powerMergers ?? []).filter((n: any) => n.map !== fire.map);
    save.powerForges = (save.powerForges ?? []).filter((n: any) => n.map !== fire.map);
    save.powerExtra = (save.powerExtra ?? []).filter((n: any) => n.map !== fire.map);
    if (this.turbzChestOpen) this.turbzChestOpen = false;
    this.syncSolids?.(save.map);
    try { localStorage.setItem(campKey(), JSON.stringify(camp)); } catch { /* private mode */ }
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
    // Furniture must land on open ground: the new site may have a tree, rock or water where the old one didn't,
    // or a wall the camp itself just put down. Spiral out to the nearest free tile instead of losing the piece.
    const taken = (tx: number, ty: number) =>
      save.survival.logs.some((e: any) => e.map === save.map && e.tx === tx && e.ty === ty && e.kind !== "woodfloor" && e.kind !== "stonefloor") ||
      save.survival.beds.some((e: any) => e.map === save.map && e.tx === tx && e.ty === ty) ||
      (save.turbzChest && save.turbzChest.map === save.map && save.turbzChest.tx === tx && save.turbzChest.ty === ty) ||
      (save.ghostBox && save.ghostBox.map === save.map && save.ghostBox.tx === tx && save.ghostBox.ty === ty) ||
      (tx === bx && ty === by);
    const freeNear = (tx0: number, ty0: number) => {
      for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = tx0 + dx, ty = ty0 + dy;
        if (tx < 2 || ty < 2 || tx >= w - 2 || ty >= h - 2) continue;
        if (taken(tx, ty) || blocked(this.world, tx * 32 + 16, ty * 32 + 16)) continue;
        return { tx, ty };
      }
      return null;
    };
    if (camp.chest) {
      const at = freeNear(bx + camp.chest.dx, by + camp.chest.dy);
      if (at) save.turbzChest = { map: save.map, ...at };
    }
    // Boxed ghosts always come back with a box to reach them, even if the box itself was packed on its own.
    if (camp.ghostBox || camp.ghostStore?.length) {
      const at = freeNear(bx + (camp.ghostBox?.dx ?? 1), by + (camp.ghostBox?.dy ?? 1));
      if (at) save.ghostBox = { map: save.map, ...at };
    }
    if (camp.ghostStore?.length) {
      // Merge rather than overwrite, so a ghost boxed since the camp was packed is not lost.
      const have = new Set((save.ghostStore ?? []).map((g: any) => g.uid));
      save.ghostStore = [...(save.ghostStore ?? []), ...camp.ghostStore.filter((g: any) => !have.has(g.uid)).map((g: any) => ({ ...g, active: false }))];
    }
    // Beds go through the same open-ground check (walls and floors keep their exact layout).
    for (const b of save.survival.beds) if (b.map === save.map && blocked(this.world, b.tx * 32 + 16, b.ty * 32 + 16)) {
      const at = freeNear(b.tx, b.ty);
      if (at) { b.tx = at.tx; b.ty = at.ty; }
    }
    // Power machines: shift each saved piece back onto the world relative to the new fire.
    const putPower = (listName: string, src: any[]) => {
      if (!src?.length) return;
      save[listName] = save[listName] ?? [];
      for (const n of src) {
        const tx = bx + (n.dx ?? 0), ty = by + (n.dy ?? 0);
        if (tx < 2 || ty < 2 || tx >= w - 2 || ty >= h - 2) continue;
        if (save[listName].some((e: any) => e.map === save.map && e.tx === tx && e.ty === ty)) continue;
        const { dx: _dx, dy: _dy, ...rest } = n;
        save[listName].push({ ...rest, map: save.map, tx, ty });
      }
    };
    putPower("powerGens", camp.powerGens);
    putPower("powerBats", camp.powerBats);
    putPower("powerWires", camp.powerWires);
    putPower("powerXps", camp.powerXps);
    putPower("powerDups", camp.powerDups);
    putPower("powerMergers", camp.powerMergers);
    putPower("powerForges", camp.powerForges);
    putPower("powerExtra", camp.powerExtra);
    save.turbzCamp = null;
    this.fixTurbzGhostBox?.();
    this.syncSolids?.(save.map);
    // The off-run copy now follows the camp that is standing (it is not erased, so a crash cannot lose it).
    this.mirrorTurbzCamp();
  };

  /**
   * TURBZ keeps the Ghost Box with the camp. A box left from an earlier run (or a different map, a far
   * corner, or now-blocked ground) said "you have a Ghost Box" but could not be seen; it is moved to the
   * nearest open tile beside your campfire. With no fire lit, a stray box is folded into the packed camp.
   */
  game.fixTurbzGhostBox = function () {
    const save = this.save;
    if (!this.turbz || !save?.ghostBox || !this.world) return false;
    const fire = (save.survival?.campfires ?? []).find((c: any) => c.map === save.map);
    const b = save.ghostBox;
    const w = this.world.w, h = this.world.h;
    const inside = b.map === save.map && b.tx >= 2 && b.ty >= 2 && b.tx < w - 2 && b.ty < h - 2;
    if (!fire) {
      if (!inside) {
        save.turbzCamp = save.turbzCamp ?? { logs: [], beds: [], chest: null, ghostBox: null, ghostStore: [] };
        save.turbzCamp.ghostBox = save.turbzCamp.ghostBox ?? { dx: 1, dy: 1 };
        save.ghostBox = null;
        return true;
      }
      return false;
    }
    const fx = Math.floor(fire.x / 32), fy = Math.floor(fire.y / 32);
    const ok = inside && Math.hypot(b.tx - fx, b.ty - fy) <= 10 && !blocked(this.world, b.tx * 32 + 16, b.ty * 32 + 16);
    if (ok) return false;
    const taken = (tx: number, ty: number) => (tx === fx && ty === fy) ||
      (save.survival.logs ?? []).some((e: any) => e.map === save.map && e.tx === tx && e.ty === ty && e.kind !== "woodfloor" && e.kind !== "stonefloor") ||
      (save.survival.beds ?? []).some((e: any) => e.map === save.map && e.tx === tx && e.ty === ty) ||
      (save.turbzChest && save.turbzChest.map === save.map && save.turbzChest.tx === tx && save.turbzChest.ty === ty);
    for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = fx + dx, ty = fy + dy;
      if (tx < 2 || ty < 2 || tx >= w - 2 || ty >= h - 2 || taken(tx, ty) || blocked(this.world, tx * 32 + 16, ty * 32 + 16)) continue;
      save.ghostBox = { map: save.map, tx, ty };
      this.say?.("Your Ghost Box is back beside your campfire.");
      return true;
    }
    return false;
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
    let raceId: RaceId;
    let classId: string;
    let witchLevel: number;

    if (isCryingBuild) {
      // cryingGirl build: always a few levels above the player so she is never a fair fight.
      classId = "cryinggirl";
      raceId = (CLASS_RACE as Record<string, RaceId>).cryinggirl ?? "tide";
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
    let manaRate = combatRate(caps.manaRate, this.combat > 0) * (EASY ? EASY_TUNE.poolRegen : 1);
    let stamRate = combatRate(caps.stamRate, this.combat > 0) * (EASY ? EASY_TUNE.poolRegen : 1);
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

  // setOrder is NOT overridden here any more. TURBZ used to carry its own copy with its own
  // eight-item table, and it ignored any task that table did not list -- so tasks added later were
  // dead buttons in the mode most people play. The engine's one handles every task.

  game.tickTurbz = function (dt: number) {
    if (!this.turbz || !this.save) return;
    const save = this.save;
    if (this.turbz2) { this.nationCityReveal(); if (TURBZ2_FREE_FOR_ALL) this.battlefieldMaintain(dt); else this.nationCommand(dt); }
    // Night sends foes after you on the TURBZ wild.
    this.tickNightSiege(dt);
    // Travellers crossing the wild, so Social has someone to meet.
    this.tickWanderers(dt);
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
    // Counted by hand: the battlefield pool can run to a couple of hundred, and this used to build
    // and throw away an array of them on every frame.
    let aliveN = 0;
    for (let i = 0; i < pool.length; i++) { const m = pool[i]; if (m?.twitch && m.alive) aliveN++; }
    // Keep every witch leveled to you. This is meant to be throttled to a few per frame, and the
    // rotating cursor exists for exactly that — but the loop ran the whole pool anyway, so every
    // witch was level-checked on every frame. Walk only a slice, and let the cursor carry the rest
    // into the next frames: across TURBZ2_LEVEL_SLICE frames the whole pool is still covered.
    const span = pool.length;
    if (span) {
      const start = (this.twitchLevelCursor ?? 0) % span;
      const take = Math.min(span, TURBZ2_LEVEL_SLICE);
      for (let k = 0; k < take; k++) {
        const m = pool[(start + k) % span];
        if (m?.twitch && !m.harvester && m.alive && (m.rv?.level ?? 1) < save.level) this.autoLevelTwitch(m);
      }
      this.twitchLevelCursor = (start + take) % span;
    }
    while (graves.length && (graves[0] ?? 1) <= 0) {
      if (aliveN >= (EASY ? EASY_TUNE.witchCap : 15)) break;
      graves.shift();
      if (this.spawnReturnedWitch()) aliveN += 1;
    }
    // Secret witch hunt: check if the player crossed a new multiple-of-10 level mark.
    const huntMark = Math.floor(save.level / 10);
    if (huntMark >= 1 && huntMark > (save.turbzHuntMark ?? 0)) {
      save.turbzHuntMark = huntMark;
      if (!EASY) this.spawnTurbzHunterWitch(); // easy mode: no secret hunter witches
    }
  };

  /** The siege's limits right now: harder every night you live through, gentler in easy mode. */
  game.siegeTuning = function () {
    const nights = Math.max(0, Math.floor(this.save?.dayNight?.nights ?? 0));
    const t = EASY ? SIEGE_EASY : { cap: SIEGE_CAP, every: SIEGE_EVERY, perWave: SIEGE_PER_WAVE, ramp: SIEGE_NIGHT_RAMP, capMax: SIEGE_CAP_MAX };
    return {
      cap: Math.min(t.capMax, t.cap + nights * t.ramp),
      every: t.every,
      // One extra foe a wave for every few nights survived.
      perWave: t.perWave + Math.floor(nights / 3),
    };
  };

  // ─── Travellers on the wild ──────────────────────────────────────────────────────────────────
  /**
   * TURBZ has no towns and no townsfolk, which left Social the one skill with nothing in the mode
   * that trains it. So the wild has travellers: people crossing it on their own business, who will
   * stop and talk if you walk up to them.
   *
   * They arrive and leave on their own, and each has something to say once — so Social is trained
   * by actually meeting new people over a run, rather than by standing next to one and mashing a
   * key. Autoplay's "Talk" task seeks them out the same way you would.
   */
  game.tickWanderers = function (dt: number) {
    const save = this.save;
    if (!this.turbz || !save || this.dead) return;
    // They walk the open wild only; dungeons are no place for a pedlar.
    if (save.map !== TURBZ_MAP) return;
    const list = (save.wanderers ??= []);

    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      w.t = (w.t ?? 0) - dt;
      // Their road takes them on. They only slip away out of sight, never in front of you.
      if (w.t <= 0 && Math.hypot(w.x - save.x, w.y - save.y) > 760) { list.splice(i, 1); continue; }
      // Amble toward a spot, pick a new one when they arrive or give up on it.
      w.goalT = (w.goalT ?? 0) - dt;
      const dx = (w.gx ?? w.x) - w.x, dy = (w.gy ?? w.y) - w.y;
      const d = Math.hypot(dx, dy);
      if (w.goalT <= 0 || d < 12) {
        w.goalT = 4 + rand() * 6;
        const ang = rand() * Math.PI * 2;
        const far = 90 + rand() * 170;
        const gx = w.x + Math.cos(ang) * far, gy = w.y + Math.sin(ang) * far;
        if (this.witchLand(gx, gy)) { w.gx = gx; w.gy = gy; }
      } else if (d > 1) {
        const step = WANDER_SPEED * dt;
        const nx = w.x + (dx / d) * step, ny = w.y + (dy / d) * step;
        if (this.witchLand(nx, ny)) { w.x = nx; w.y = ny; w.facing = dx < 0 ? -1 : 1; }
        else w.goalT = 0;   // walked into something: choose somewhere else
        w.walk = (w.walk ?? 0) + dt * 4;
      }
    }

    this.wanderT = (this.wanderT ?? WANDER_FIRST) - dt;
    if (this.wanderT > 0 || list.length >= WANDER_MAX) return;
    this.wanderT = WANDER_EVERY * (0.7 + rand() * 0.6);
    const spot = this.wanderSpot();
    if (!spot) return;
    const name = pick(WANDERER_NAMES);
    list.push({
      id: `wd-${nextUid()}`,
      name,
      role: pick(WANDERER_ROLES),
      line: pick(WANDERER_LINES),
      x: spot.x, y: spot.y, gx: spot.x, gy: spot.y,
      facing: 1, walk: 0, goalT: 0,
      t: WANDER_STAY_MIN + rand() * (WANDER_STAY_MAX - WANDER_STAY_MIN),
      said: false,
    });
  };

  /** Somewhere to arrive from: walkable, off-screen-ish, but not so far you will never meet them. */
  game.wanderSpot = function () {
    const save = this.save;
    if (!save) return null;
    for (let i = 0; i < 40; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = 420 + rand() * 420;
      const x = save.x + Math.cos(ang) * dist;
      const y = save.y + Math.sin(ang) * dist;
      if (this.witchLand(x, y)) return { x, y };
    }
    return null;
  };

  /** The nearest traveller within `reach`, or null. */
  game.nearestWanderer = function (reach = WANDER_REACH) {
    const save = this.save;
    if (!save || save.map !== TURBZ_MAP) return null;
    let best: any = null, bd = reach;
    for (const w of save.wanderers ?? []) {
      const d = Math.hypot(w.x - save.x, w.y - save.y);
      if (d <= bd) { bd = d; best = w; }
    }
    return best;
  };

  /**
   * Pass the time with a traveller. Each has one thing worth hearing, so Social is trained by
   * meeting people rather than by talking at the same one over and over.
   */
  game.talkWanderer = function (w: any) {
    const save = this.save;
    if (!save || !w) return false;
    if (w.said) {
      this.say(`${w.name} has told you all they know.`);
      return false;
    }
    w.said = true;
    // Having spoken, they are in no hurry to leave: you get a moment with them.
    w.t = Math.max(w.t ?? 0, 40);
    this.say(`${w.name}, ${w.role}: "${w.line}"`);
    this.float(w.x, w.y - 52, `+${WANDER_SOCIAL_XP} Social`, "#9ad8c8");
    this.gainSkill("social", WANDER_SOCIAL_XP);
    this.cue("click", { rate: 1.1 }, [520, .06, "sine"]);
    this.syncHud(true);
    return true;
  };

  /** Travellers are drawn like any other person on the map. */
  game.drawWanderers = function (ctx: any) {
    const save = this.save;
    if (!save || save.map !== TURBZ_MAP) return;
    for (const w of save.wanderers ?? []) {
      if (Math.abs(w.x - save.x) > 1200 || Math.abs(w.y - save.y) > 1200) continue;
      drawActor(ctx, {
        x: w.x, y: w.y, race: "vesper", female: true, hair: 2, skin: 2,
        facing: w.facing ?? 1, walk: w.walk ?? 0, attack: 0, hurt: 0,
        pieces: [
          { slot: "chest", style: 6, type: "normal", fxSeed: 0, quality: 1 },
          { slot: "legs", style: 6, type: "normal", fxSeed: 1, quality: 0 },
          { slot: "feet", style: 6, type: "normal", fxSeed: 2, quality: 0 },
        ],
        setFx: null, setOn: false, time: this.clock,
      });
      drawShadowName(ctx, w.said ? w.name : `${w.name} ·`, w.x, w.y - 44, w.said ? "#c8c0b0" : "#9ad8c8");
    }
  };

  /**
   * Night in TURBZ: the wild sends foes after you.
   *
   * While it is dark, waves rise in a ring around you and hunt you down; `siege` marks them so the
   * engine lets them come from further off than an ordinary foe would, and so they are never put
   * back to sleep or respawned.
   *
   * At dawn the waves stop and any siege foe you have not met melts away — but only the ones that
   * are off-screen and not already fighting you. Anything standing in front of you stays, so a
   * fight is never pulled out from under you at sunrise, and the population never piles up night
   * after night.
   */
  game.tickNightSiege = function (dt: number) {
    const save = this.save;
    if (!this.turbz || !save) return;
    const mobs = this.mobs;
    if (!mobs) return;

    const night = !!this.isNightNow?.();
    const wasNight = !!this.siegeWasNight;
    this.siegeWasNight = night;
    // Nothing to do and nothing left over: a day with no siege foes costs one boolean a frame.
    if (!night && !wasNight && !this.siegeAny) return;

    // Dead siege foes are dropped here: nothing respawns them, and they are not camp spawns, so
    // without this they would sit in the list forever. Only walked while a siege is in play.
    let living = 0;
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      if (!m?.siege) continue;
      if (m.alive) living++;
      else mobs.splice(i, 1);
    }
    this.siegeAny = living > 0;

    // The siege belongs to the TURBZ overworld at night. Dungeons have their own foes, and the
    // battlefield mode already fills the map with witches.
    const onWild = save.map === TURBZ_MAP;
    // step() already returns before this when a panel (pause, loot, death) has the world stopped.
    if (!night || !onWild || this.turbz2 || this.dead) {
      // Only at the moment the sun comes up, not on every daylight frame.
      if (wasNight && !night) this.dawnClearSiege();
      this.siegeT = 0;
      return;
    }

    const tune = this.siegeTuning();
    if (living >= tune.cap) return;
    const alive = living;

    this.siegeT = (this.siegeT ?? 0) - dt;
    if (this.siegeT > 0) return;
    this.siegeT = tune.every;

    const want = Math.min(tune.perWave, tune.cap - alive);
    let made = 0;
    for (let i = 0; i < want; i++) if (this.spawnSiegeFoe()) made++;
    // Said once a night, the first time something actually rises, so the player knows why.
    if (made && !this.siegeToldNight) {
      this.siegeToldNight = true;
      this.say("Something is moving in the dark. They know where you are.");
    }
  };

  /** Dawn: quietly take back the siege foes you never met. */
  game.dawnClearSiege = function () {
    const save = this.save;
    const mobs = this.mobs;
    if (!save || !mobs) return;
    this.siegeToldNight = false;
    let left = 0;
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      if (!m?.siege) continue;
      // Leave anything close by, hurt, or in a fight: the sun does not end a fight you are in.
      const far = Math.hypot(m.x - save.x, m.y - save.y) > 900;
      if (!m.alive || (far && m.hurt <= 0 && m.hp >= m.max)) { mobs.splice(i, 1); continue; }
      left++;
    }
    // Anything that survived dawn (because you were standing next to it) keeps the siege bookkeeping
    // alive until it is dealt with.
    this.siegeAny = left > 0;
  };

  /**
   * Raises one hostile foe on open ground in a ring around the player.
   *
   * Beasts are skipped on purpose: an animal's instinct in the mob loop is to run from you, which
   * would make for a siege that flees. These are monsters, and they come.
   */
  game.spawnSiegeFoe = function (): boolean {
    const save = this.save;
    if (!save) return false;
    let sx = 0, sy = 0, found = false;
    for (let i = 0; i < 40; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = SIEGE_RING_MIN + rand() * (SIEGE_RING_MAX - SIEGE_RING_MIN);
      const x = save.x + Math.cos(ang) * dist;
      const y = save.y + Math.sin(ang) * dist;
      if (this.witchLand(x, y)) { sx = x; sy = y; found = true; break; }
    }
    if (!found) return false;
    const pool = MONSTERS.filter((d: any) => !d.animal && !d.boss);
    const species = (pool.length ? pick(pool) : MONSTERS[0])?.id;
    if (!species) return false;
    const mob = this.makeMob({ id: `siege-${nextUid()}`, kind: "mob", species, x: sx, y: sy, level: save.level });
    if (!mob) return false;
    mob.siege = true;      // hunts from further off, never sleeps, never respawns
    mob.aggro = true;      // it rose looking for you
    mob.seen = true;
    mob.drift = false;
    mob.flee = false;
    mob.huntIn = 0;    // no grace period before it notices you
    this.mobs.push(mob);
    this.siegeAny = true;
    return true;
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

  /**
   * Easy mode death: no run-ending. You wake at your campfire (or the dungeon door you fell near) with most of
   * your health and mana, minus a little kyo. Level, gear, skills, ghosts and camp are untouched.
   */
  game.turbzKnockOut = function () {
    const save = this.save;
    if (!save) return;
    const loss = Math.floor((save.kyo | 0) * EASY_TUNE.kyoLoss);
    save.kyo = Math.max(0, (save.kyo | 0) - loss);
    this.dead = false;
    this.dest = null;
    this.status = [];
    this.shield = 0;
    this.wardT = 0;
    this.castLock = 0;
    this.overcastT = 0;
    this.lunge = null;
    this.rush = null;
    this.orbit = null;
    this.combat = 0;
    if (save.map !== TURBZ_MAP) {
      const portal = save.dungeons?.portals?.find((q: any) => q.id === save.map);
      if (portal) { save.x = portal.x; save.y = portal.y; }
      save.map = TURBZ_MAP;
      this.loadMap(TURBZ_MAP, false);
    }
    const fire = save.survival?.campfires?.find((c: any) => c.map === TURBZ_MAP);
    if (fire) { save.x = fire.x; save.y = fire.y; }
    // Whoever was chasing you loses the trail.
    for (const m of this.mobs ?? []) if (m?.rv && m.rv.foe === "player") { m.rv.foe = ""; m.rv.foeT = 0; }
    save.hp = Math.max(1, Math.floor(this.maxHp() * EASY_TUNE.reviveHp));
    const caps = this.poolCaps();
    this.pools = { mana: caps.maxMana, maxMana: caps.maxMana, stam: caps.maxStam, maxStam: caps.maxStam, manaSlow: 0, stamSlow: 0 };
    this.cam.x = save.x;
    this.cam.y = save.y;
    this.say(loss > 0 ? `Knocked out. You wake ${fire ? "at your campfire" : "nearby"} and the wild keeps ${loss} kyo. Level and gear are safe.` : `Knocked out. You wake ${fire ? "at your campfire" : "nearby"}. Level and gear are safe.`);
    this.persistTurbz();
    this.syncHud(true);
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
    for (const k in r.castCd) r.castCd[k] = Math.max(0, r.castCd[k]! - dt);
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
    // TURBZ2: allegiances are fixed by nation, so witches never re-team on the field.
    if (this.turbz2) return;
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
    // In the free-for-all she has no special grudge against you — she'll only come if you are close,
    // the same as she'd turn on any witch nearby — so the whole wild doesn't converge on the player.
    const scent = TURBZ2_FREE_FOR_ALL && this.turbz2 ? 460 : (EASY ? EASY_TUNE.witchHunt : 3600);
    if (pd < scent && m.hp > m.max * 0.25) { r.foe = "player"; r.foeT = Math.max(r.foeT, 6); }
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
      if (d < 280) foes.push({ id: "player", x: save.x, y: save.y, d, level: save.level, type: CLASS_BY_ID[save.classId as ClassId]?.type ?? "spirit" });
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
    const decision = thinkLikePlayer({
      x: m.x, y: m.y, level: r.level, hpPct: m.hp / Math.max(1, m.max), type: m.type || "normal",
      bag: r.bag, orders: ALL_ORDERS, inDungeon: false,
      needs: { eat: false, drink: false, sleep: false },
      foes, nodes, shore, rift, exit: null, bed: null,
      wander: ((Math.floor((r.age + (m.x | 0)) / 6) * 13) % 628) / 100,
    });
    // TURBZ2 movement intent: unless she is fighting or fleeing, give her somewhere to go so the
    // wild actually churns instead of everyone idling. Combat always takes priority (foes override).
    if (this.turbz2 && !m.harvester && decision?.kind !== "fight" && decision?.kind !== "flee") {
      if (TURBZ2_FREE_FOR_ALL) {
        // Free-for-all: head for the nearest OTHER witch to pick a fight, so battles break out all
        // over the map and nobody is singling the player out.
        //
        // Finding her by sweeping the whole roster is O(n) per witch, and with sixty-odd witches all
        // doing it every frame that was thousands of distance checks a frame — the single biggest
        // cost in TURBZ2. She now keeps the rival she picked for a moment and re-picks on a stagger,
        // which is also truer to the fiction: she commits to a fight instead of re-deciding
        // every sixtieth of a second.
        const now = this.clock ?? 0;
        const held = m.bfFoe;
        if (held && held.alive && held !== m && now < (m.bfHoldUntil ?? 0)) {
          return { kind: "wander", x: held.x + (rand() * 140 - 70), y: held.y + (rand() * 140 - 70) };
        }
        let near: any = null, bd = Infinity;
        const mobs = this.mobs;
        for (let i = 0; i < mobs.length; i++) {
          const o = mobs[i];
          if (!o.twitch || !o.alive || o === m) continue;
          const ox = o.x - m.x, oy = o.y - m.y;
          const d = ox * ox + oy * oy;
          if (d < bd) { bd = d; near = o; }
        }
        if (near) {
          m.bfFoe = near;
          // Stagger the holds so the re-picks do not all land on one frame.
          m.bfHoldUntil = now + TURBZ2_TARGET_HOLD * (0.7 + Math.random() * 0.6);
          return { kind: "wander", x: near.x + (rand() * 140 - 70), y: near.y + (rand() * 140 - 70) };
        }
        m.bfFoe = null;
        m.bfHoldUntil = 0;
      } else {
        // Team war: raiders march on an enemy city; strayed guards head home.
        if (m.duty === "raid" && m.raidTarget) {
          return { kind: "wander", x: m.raidTarget.x + (rand() * 160 - 80), y: m.raidTarget.y + (rand() * 160 - 80) };
        }
        if (m.duty === "guard" && m.homeX != null && Math.hypot(m.x - m.homeX, m.y - m.homeY) > 520) {
          return { kind: "wander", x: m.homeX + (rand() * 120 - 60), y: m.homeY + (rand() * 120 - 60) };
        }
      }
    }
    return decision;
  };

  game.witchPlay = function (m: any, far: boolean) {
    const r: Brain = m.rv;
    const save = this.save;
    // AGGRESSION: a TURBZ witch is a hunter, not a farmer. If you are anywhere near (or she has
    // already locked onto you), she drops crafting/gathering and comes straight for you.
    const pd = save && !this.dead ? Math.hypot(save.x - m.x, save.y - m.y) : Infinity;
    const lockable = m.hp > m.max * 0.25 || m.turbzHunter;
    // In the free-for-all she engages the player only at close range, like she would any other witch,
    // so she isn't drawn across the map to you. Hunter witches (m.turbzHunter) still hunt relentlessly.
    const ffa = TURBZ2_FREE_FOR_ALL && this.turbz2 && !m.turbzHunter;
    const huntR = ffa ? 420 : (EASY ? EASY_TUNE.witchHunt : TWITCH_HUNT), chaseR = ffa ? 760 : (EASY ? EASY_TUNE.witchChase : TWITCH_CHASE);
    if (lockable && (pd < huntR || m.turbzHunter || (r.foe === "player" && pd < chaseR))) {
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
      const heal = moves.find((mv: Move) => isHeal(mv) && ready(mv));
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
    const lead = this.mobById(m.master);
    if (!lead) {
      m.alive = false; m.hp = 0;
      this.float(m.x, m.y - 30, "FADES", "#c9a6e8");
      return;
    }
    this.tickEnemyGhostAid?.(m, dt);
    if (hasStatus(m.status ?? [], "root") || hasStatus(m.status ?? [], "sleep")) return;
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
