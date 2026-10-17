// @ts-nocheck
import { renderSfx, BLIP_HZ, SFX_NAMES, type SfxName } from "./sfx-bank";
import { itemUseProblem, bestFood, GREEN_MUSHROOM_LEVEL, healingOf, healingLine, isConsumable, cleanQuick, POTION_CD, QUICK_MAX } from "./item-use";
import { advanceDayNight, clockLabel, darkness, freshDayNight, isNight, normalizeDayNight, skipRate, NIGHT, NIGHT_IN_STANDARD_MODE, DAY_SECONDS, type DayNightState } from "./daynight";
import { BUILD_PIECES, BUILD_REACH, LOG_COST, MAX_BEDS, MAX_LOG_TILES, SAFE_ZONE_TILES, checkPlaceLog, costText, pushOut, safeZoneAt, solidsFor, tileAt, zoneRect } from "./building";
import { normalizeSurvival, advanceSurvival, consumeMaterials, craftAtCamp, waterWithinReach, nearestWaterTile, nearestShore, CAMP_RECIPES, FOOD, type SurvivalState } from "./survival";
import { normalizeAbilities, spendAbilityPoint, abilityMultiplier, verseValues, POINTS_PER_LEVEL } from "./ability-progression";
import { advanceDungeonClock, advanceDungeonDay, normalizeDungeonState, DUNGEON_INTERVAL, type DungeonPortal, type DungeonState } from "./procedural-dungeon";
import { ALL_ORDERS, thinkLikePlayer, type PlayOrders } from "./player-brain";
import { dungeonSeed, generateDungeon } from "./map-gen";
import {
  CLASS_BY_ID,
  LEGACY_CLASS,
  type ClassId,
  ENCHANTS,
  ENCHANT_BY_ID,
  MAX_GEAR_ENCHANTS,
  perkText,
  xpNeed,
  ANIMAL_BY_ID,
  ITEM_BY_ID,
  ITEMS,
  ALCHEMY_RECIPES,
  ENEMY_MATS,
  SCRAP_LOOT,
  MONSTER_BY_ID,
  MONSTERS,
  MOVE_BY_ID,
  MOVES,
  NPCS,
  POIS,
  NODE_RESPAWN_SECONDS,
  FISH_BITE_MIN,
  FISH_BITE_MAX,
  QUESTS,
  RACES,
  SET_BY_ID,
  SETS,
  SKILLS,
  masteryOf,
  TILE,
  TYPES,
  WITCH_NAMES,
  CLASSES,
  CLASS_RACE,
  accountNeed,
  attackForm,
  attackRange,
  MELEE_MAX_REACH,
  AURA_IDS,
  AURAS as AURA_LIST,
  MAX_AURAS,
  moveCdFactor,
  formTag,
  movementKind,
  huntMove,
  gearPrice,
  equipmentStats,
  migrateEquipment,
  gearScore,
  learnPool,
  mulberry32,
  nextUid,
  qualityName,
  rangedStyle,
  rollGear,
  rollGhostLook,
  rollInnate,
  rollSpiritKit,
  spiritAidsPlayer,
  scaleTile,
  skillLine,
  skillNeed,
  levelNearHunter,
  rarityForLevel,
  ensureGearMoves,
  moveTactic,
  bodyRead,
  npcOffers,
  defenseFail,
  reactOf,
  rollCover,
  type Gear,
  type GhostLook,
  type MapId,
  type Move,
  type QualityId,
  type RaceId,
  type SkillId,
  type Slot,
  type TypeId,
  type EnchantRoll,
  type FxId,
} from "./content";
import type { GraveBody } from "./social-types";
import { flushNow, noteShiny, readAccountMeta, takeVaultGhosts, unionGhosts, vaultGhosts, wipeAccountProgress, writeAccountMeta } from "./account-save";
import { furtherLevel, perkPointsAvailable, perkPointsEarned, perkPointsSpent, PERK_POINTS_PER_LEVEL } from "./account-progress";
import { getCryingConfig, getCustomBuild } from "./classes";
import { aptitudeOf, buffLines, classProfile, classGendered, classSpiritOut, IMMUNE_LABEL, STAT_LABEL, TRAIT_BY_ID } from "./classes";
import { Gimmicks, type GimmickView } from "./class-gimmicks";
import { witchSteer } from "./witch-brain";
import { drawActor, drawMonster, drawSetAura, drawShadowName, fxColor, setAuraColor } from "./sprites";
import { fxTrait, fxTraitLabel, geneSeedOf } from "./fx-gene";
import { captureDeathGif } from "./death-gif";
import { gearImbue } from "./gear-fx";
import { drawGhostFx, ghostImbue } from "./ghost-fx";
import { clampRarity, rarityName, rollGhostRarity, rollShinyPalette, shinyPalette, PALETTE_BY_ID, DEFAULT_PALETTE, MAX_GHOST_RARITY } from "./ghost-style";
import { aggregateGhostAbilities, describeAbilities, normalizeAbilities as normalizeGhostAbilities, rollGhostAbilities, GHOST_ABILITY_BY_ID, type GhostAbilityRoll, type GhostAggregate } from "./ghost-abilities";
import { combatRate, derivePools } from "./pools";
import { CHEST_BOTTOM, chestCanvas } from "./chest-sprite";
/** One line on a verse's area, chain or boomerang hits, with the numbers when a hit size is known. */
export function verseAreaNote(mv: Move, hit = 0): string {
	const n = (k: number) => (hit ? ` (${Math.max(1, Math.floor(hit * k))})` : "");
	const bits = [];
	if (mv.nova) bits.push(`Hits every foe within ${mv.nova}px of you for 85%${n(0.85)}.`);
	if (mv.splash) bits.push(`Foes within ${mv.splash.radius}px of the target take ${Math.round(mv.splash.mult * 100)}%${n(mv.splash.mult)}.`);
	if (mv.chain) bits.push(`Leaps to ${mv.chain.jumps} more foes within ${mv.chain.range}px, ${Math.round(mv.chain.mult * 100)}% each jump.`);
	if (mv.echo) bits.push(`Returns for a second cut at ${Math.round(mv.echo * 100)}%${n(mv.echo)}.`);
	if (mv.multi) bits.push(`Strikes ${mv.multi.hits} times, ${Math.round(mv.multi.mult * 100)}% on each extra hit${n(mv.multi.mult)}.`);
	if (mv.selfBuff) bits.push(`Landing it grants you ${mv.selfBuff === "swift" ? "Swift" : mv.selfBuff === "shell" ? "Shell" : mv.selfBuff} for 4s.`);
	return bits.join(" ");
}
/** Each set gets its own aura variant (tint, spin, size, crest) so the 10 aura kinds look like 100. */
const SET_VARIANT: Record<string, number> = Object.fromEntries(SETS.map((s, i) => [s.id, i * 7 + s.style + 1]));
const SET_PIECES = ["head", "chest", "legs", "feet", "relic"];
/** Helpful effects a Cleanse keeps. */
const GOOD_STATUS = new Set(["swift", "shell"]);
const MAX_EQUIPPED = 9;
/** Burning lasts this long and takes this share of max health each second. */
const BURN_SECONDS = 15;
const BURN_PCT_PER_SECOND = 0.05;
/** Autogrind fishes for this long, then lets another skill have a turn. */
const FISH_GRIND_SECONDS = 75;
const FISH_GRIND_PAUSE = 150;
import { bend, bendChance, bendDown, bendSigned, procs, rateMult, ratingChance } from "./overmax";
import { type ChestLook, chestLook, chestToJoin, mergeChestInto, mergeNearbyChests, QUALITY_ORDER, BOSS_COLOR } from "./chest-loot";
import { respawnSeconds } from "./respawn";
import { FLOOR_COLOR, expandZones, mapToWorld, regionAt, savedMaps } from "./map-format";
import { GREEN_CAVE_ID, findMapFile, isBuiltinMap, playableWorlds } from "./builtin-maps";
import { MAIN_WORLD_ID, mainWorldFile, mainWorldHearth, setLifeWorld } from "./main-world";
import { lifeWorldFile, rollLifeWorld, touchLifeWorld, type LifeWorld } from "./life-world";
import { tileImage, tileImageRevision } from "./tile-atlas";
import { accept as acceptMapQuest, advance as advanceMapQuest, marker as questMarker, offerable as offerableQuests, openQuests, progressLines, qkey, sanitizeQuestStates, stepText, turnIn as turnInMapQuest, turnInOf, type QuestEvent, type QuestStates } from "./map-quests";
import { CombatFx, VOLLEY_GAP } from "./combat-fx";
import { drawFloats, drawPlates, makeFloat, TRAIT_SHORT } from "./combat-text";
import { applyStatus, cleanseStatuses, endStatus, HARD_CC, hasStatus, IMMUNE_PREFIX, SOFT_CAP, struggle, tickStatuses } from "./status-rules";
import {
	abandonContract, acceptContract, applyBoardEvent, boardView, ensureBoard, rerollBoard, rerollCost, TIER_XP,
	type BoardEventDetail, type BoardKind,
} from "./quest-board";
import { directionFromDelta, type ActorDirection } from "./actor-sheets.config";
import { initActorSprites } from "./actor-sprites";
import { isPinned } from "./ui-layout-store";
import { enemyDesignFor, installEnemyDesigns } from "./enemy-design";
import {
	BOUNTY_BOARD_SIZE, BOUNTY_HUNT_SECONDS, BOUNTY_ENRAGE, DEATH_MARK, BOUNTY_STARS_NEEDED, HUNTER_SQUAD, HUNTER_WAVE_GAP, MOB_ENCHANTS, SOURCE_BONUS,
	adaptToward, bountyInventory, bountyKyo, bountyQuality, bountyStarChance, clearNameCost, defenseVs, enemyHitDamage, enemyTargets,
	expectedHunterPower, gearSellValue, hardcoreGrowth, itemSellValue, killXpAmount, openWorldLevelEdge, rollEnemyKit, standardGrowth,
} from "./balance";
import {
	breakMelee, commitMelee, commitSpell, freshMelee, freshWeave, pickRushTargets, planMelee, planSpell, schoolMult, shatterWeave, tickMelee, tickWeave,
} from "./fight-depth";
import {
  BIOME_LABEL,
  TAVERNS,
  WORLD_RETURN,
  biomeNameAt,
  blocked,
  buildDungeon,
  buildWorld,
  dungeonExit,
  drawRift,
  paintArena,
  drawWorldSlice,
  paintNode,
  paintWorld,
  pickNodeSpot,
  reachableFrom,
  type Tavern,
  type WorldData,
} from "./world";

export type DeathReport = {
  world: string; seed: number;
  name: string; className: string; focus: string; level: number; mode: string; cause: string; kills: number; survived: string;
  kyo: number; score: number; accountScore: number; spirits: number; shinies: number; gear: string[]; skills: { name: string; level: number }[];
};
export type Panel = null | "died" | "gear" | "sheet" | "lobby" | "bag" | "skills" | "quests" | "map" | "talk" | "shop" | "death" | "pause" | "trade" | "ghost" | "moves" | "chat" | "bounty" | "rebirth" | "survival" | "craft" | "loot" | "chest" | "wildghost";
export type BountyRow = { id: string; name: string; className: string; tier: number; level: number; kyo: number; active: boolean; status: string };
export type HuntInfo = { tier: number; kills: number; stars: number; need: number; wanted: number; waveIn: number; hunters: number; clearCost: number; starsOn: boolean };
export type LootView = { title: string; kyo: number; items: { name: string; count: number }[]; gear: Gear[] };
/** Everything the Spirits window and the lingering-ghost window show about one ghost. */
export type GhostDetail = {
  uid: string; name: string; species: string; type: TypeId; template: number; look: GhostLook | null;
  level: number; levelCap: number; xp: number; xpNeed: number;
  rarity: number; rarityName: string; shiny: boolean; palette: string | null; paletteName: string;
  hp: number; max: number; speed: number;
  /** Hit strength multiplier (rarity), crit bonus and how much slower its verses recharge. */
  hitMult: number; critBonus: number; cdMult: number;
  abilities: GhostAbilityView[];
  /** Where it is, and whether its abilities are working there. */
  where: "out" | "party" | "task" | "box" | "tagged" | "wild"; abilitiesOn: boolean;
  moves: { id: string; name: string; about: string; type: TypeId; power: number; player: boolean; slotted: boolean }[];
};
export type GhostAbilityView = ReturnType<typeof describeAbilities>[number];
export type WildGhostView = GhostDetail & {
  id: string; t: number; near: boolean;
  party: number; partyMax: number; out: number; outMax: number; boxPlaced: boolean; store: number; storeMax: number;
};
export type GhostBonusView = { passive: { id: string; label: string; value: number }[]; timed: { id: string; label: string; value: number; unit: string; cd: number; left: number; n: number }[]; working: number };
export type Snap = {
  mode: "title" | "create" | "play";
  /** The You Died report while the death screen is up. */
  died: DeathReport | null;
  /** Death screen: keep this world for the next life. */
  keepWorld: boolean;
  hasSave: boolean;
  panel: Panel;
  name: string;
  race: RaceId;
  level: number;
  dungeonCountdown: number;
  dungeonPortals: { id: string; x: number; y: number; cleared: boolean }[];
  skillPoints: number;
  abilities: (Move & { rank: number; reachNow?: number; cdNow?: number; now: { mult: number; power: number; heal: number; shield: number }; next: { mult: number; power: number; heal: number; shield: number } })[];
  xp: number;
  xpNeed: number;
  hp: number;
  maxHp: number;
  shield: number;
  kyo: number;
  region: string;
  map: MapId;
  bar: { id: string; name: string; type: TypeId; cd: number; max: number; tag: string }[];
  log: string[];
  questName: string;
  questAbout: string;
  notice: string;
  talk: { id: string; name: string; role: string; line: string; shop: string | null; shrine: TypeId | null; more?: boolean; quests?: { offers: { id: string; name: string; about: string; steps: string[]; reward: string }[]; active: { id: string; name: string; lines: string[]; ready: boolean }[] } } | null;
  /** Open quests on the designer map you are standing in. */
  mapQuests: { id: string; name: string; lines: string[]; ready: boolean; turnIn: string }[];
  gear: Gear[];
  equipped: string[];
  setLabel: string;
  setBonus: string;
  setCount: number;
  totals: { id: string; name: string; power: number }[];
  skills: { id: SkillId; name: string; level: number; xp: number; need: number; line: string }[];
  bag: { id: string; name: string; count: number; about: string; useProblem: string | null; effect: string; quickable: boolean }[];
  /** Items queued on the Space bar (the first is used); the potion cooldown in seconds. */
  quick: { id: string; name: string; count: number }[];
  quickCd: number;
  death: { id: string; name: string; kind: "gear" | "item" }[];
  peers: string[];
  roomCode: string;
  net: string;
  chat: { name: string; text: string }[];
  trade: { open: boolean; peer: string; mine: string; theirs: string; me: boolean; them: boolean } | null;
  shrine: string;
  companion: string;
  box: string[];
  spirits: (GhostDetail & { active: boolean; task: string | null; known: { id: string; name: string; about: string; type: TypeId; player: boolean; slotted: boolean }[]; slots: string[] })[];
  /** The Ghost Box ghost open in the Spirits window, or null. */
  ghostInspect: GhostDetail | null;
  /** What your working ghosts add right now. */
  ghostBonus: GhostBonusView;
  spiritSlots: number;
  spiritCap: number;
  /** Ghosts kept in the Ghost Box. */
  ghostStore: { uid: string; name: string; type: TypeId; level: number; rarity: number; shiny: boolean; tagged: boolean; palette: string | null; abilities: string[] }[];
  ghostBox: { placed: boolean; near: boolean; max: number };
  /** The loot chest you have open (Hardcore). */
  chest: ChestView | null;
  /** The lingering ghost you are looking at, or null. */
  wildGhost: WildGhostView | null;
  /** Last Man Standing scoreboard, or null outside a match. */
  lms: { alive: number; total: number; kills: number; age: string; feed: string[]; over: boolean; won: boolean; place: number; hunting: number; nearest: string } | null;
  jarLeft: number;
  known: { id: string; name: string; type: TypeId }[];
  stash: string[];
  selected: string | null;
  aim: string;
  stock: { uid: string; name: string; price: number; type: string }[];
  wares: { id: string; name: string; price: number }[];
  accountLevel: number;
  accountXp: number;
  accountNeed: number;
  perkPoints: number;
  perks: { id: string; name: string; power: number; max: number; step: number; cat: string; about: string }[];
  bounty: string;
  bountyPlace: string;
  /** The foe you are fighting, for the target frame. */
  target: { name: string; level: number; type: TypeId; hp: number; max: number; enchants: string[]; boss: boolean; bounty: boolean; hunter: boolean; tier: number; hint: string } | null;
  /** Status effects shown on the HUD. */
  effects: { id: string; label: string; t: number; good: boolean }[];
  /** The hunter's class name. */
  className: string;
  /** Every live bounty, one HUD line each. */
  bounties: string[];
  bountyBoard: BountyRow[];
  hunt: HuntInfo;
  loot: LootView | null;
  locked: string[];
  /** Multiplier on gear and item sale prices (Trading skill, Merchant Tongue). */
  sellMult: number;
  unstuck: number;
  /** Finished sets, per class: the rebirth screen offers them as level-1 spawn gear. */
  unlocked: { id: string; name: string; race: RaceId; bonus: string; classId: string }[];
  /** Set collection progress for the current class (sets with at least one piece found). */
  setProgress: { id: string; name: string; have: number; slots: string[] }[];
  hint: string;
  /** Mouse-over card by the cursor (desktop). */
  hover: HoverCard | null;
  foe: string;
  menu: { sx: number; sy: number; title: string; lines: string[]; actions: { id: string; label: string }[] } | null;
  mapX: number;
  mapY: number;
  party: string[];
  autoplay: boolean;
  /** Smart auto-combat. Off means she only swings when you press Attack. */
  autoCombat: boolean;
  gimmick: GimmickView | null;
  grind: string;
  /** TURBZ pools. Null in every other mode. */
  pools: { mana: number; maxMana: number; stam: number; maxStam: number; manaSlow: number; stamSlow: number } | null;
  /** TURBZ autoplay assignments. */
  orders: { id: string; label: string; on: boolean }[] | null;
  /** Other witches still grinding, in TURBZ. */
  turbz: { witches: number; back: number } | null;
  accountScore: number;
  turn: string;
  survival: SurvivalState | null;
  nearCamp: boolean;
  /** A bed you can climb into (Hardcore). */
  nearBed: boolean;
  nearWater: boolean;
  nearTree: boolean;
  sleeping: boolean;
  rules: "hunt" | "hardcore";
  duel: null | { phase: "answer" | "yours"; attacker: string; move: string; about: string; beat: string };
  /** Counts up each time a shiny drops for you; the screen pops a short "SHINY DROPPED" banner on every change. 0 = none yet. */
  shinyAlert: number;
  classId: string;
  sheet: Sheet | null;
  clock: { phase: "day" | "night"; label: string; left: string; dark: number; active: boolean };
  build: { on: boolean; logs: number; placed: number; inZone: boolean; holding: boolean; piece: string; beds: number; ghostBox: boolean };
  lobby: { code: string; role: "solo" | "host" | "guest"; net: string; members: { id: string; name: string; classId: string; className: string; level: number; hp: number; max: number; map: string; self: boolean; host: boolean }[] };
};
export type Sheet = {
  name: string; classId: string; className: string; role: string; type: TypeId; blurb: string; specialty: string; passive: string; female: boolean; gendered: boolean;
  level: number; xp: number; xpNeed: number; hp: number; maxHp: number; shield: number; kyo: number; skillPoints: number;
  trait: { id: string; name: string; about: string } | null;
  stats: { id: string; name: string; value: string; about: string; mod: number; cls: number; trait: number }[];
  buffs: string[]; debuffs: string[];
  effects: { id: string; label: string; t: number; good: boolean }[];
  aptitudes: { id: string; name: string; level: number; mult: number }[];
  moves: { id: string; name: string; type: TypeId; rank: number; tactic: string; signature: boolean; movement: boolean; about: string; kind: string; form: string; acc: number; range: number; cd: number; hit: number; critHit: number; critPct: number; heal: number; shield: number; rankMult: number; shape: { label: string; value: string }[]; note: string }[];
  gear: { slot: string; name: string; quality: string; stat: string }[];
  combat: { label: string; value: string }[];
  account: { level: number; score: number; perks: number };
  numbers: { id: string; label: string; value: string; note: string; parts: { label: string; value: string; src?: string }[] }[];
  bonuses: { id: string; name: string; gear: number; account: number; total: number; effect: string; slots: { slot: string; power: number }[] }[];
  skillsFull: { id: string; name: string; level: number; xp: number; need: number; line: string; mult: number }[];
  night: { on: boolean; phase: string; rules: string };
};


type Status = { id: string; t: number };
type Mob = {
  id: string; species: string; name: string; type: TypeId; template: number;
  x: number; y: number; hp: number; max: number; level: number; boss: boolean; bossId?: string;
  homeX: number; homeY: number; cd: number; hurt: number; status: Status[]; alive: boolean; respawn: number;
  rarity: number; direction: ActorDirection; facing: number; walk: number; swing: number; move: string; animal: boolean; witch: boolean;
  race: RaceId | null; lootGear: Gear[]; lootBag: Record<string, number>; lootKyo: number; huntIn: number; seen: boolean;
  ghost?: boolean; look?: GhostLook | null; speed?: number; master?: string; aggro?: boolean;
  classId?: string; female?: boolean; bounty?: boolean; bountySpirit?: boolean; map?: string;
  power?: number; enraged?: boolean; baseMax?: number; moving?: boolean;
  zone?: { id: string; tx: number; ty: number; tw: number; th: number; levelMin: number; levelMax: number; species: string[]; count: number; respawn: number } | null;
};
type Spirit = {
  uid: string; species: string; name: string; type: TypeId; template: number; level: number; rarity: number;
  look: GhostLook; move: string; hp: number; max: number; speed: number;
  known?: string[]; slots?: string[]; active?: boolean; shiny?: boolean;
  /** Hardcore: what this ghost is doing away from you, its countdown to the next result, and its own XP. */
  task?: GhostTask | null; taskT?: number; xp?: number;
  /** Rolled abilities (ghost-abilities.ts); they work while the ghost is out with you or tagged. */
  abilities?: GhostAbilityRoll[];
  /** Shiny palette id (ghost-style.ts). */
  palette?: string;
  /** Tagged to float along as a tiny follower (Ghost Box ghosts). */
  tagged?: boolean;
};
type GhostPet = { species: string; level: number; rarity: number; look?: GhostLook; move?: string; name?: string; type?: TypeId; template?: number; hp?: number; max?: number; speed?: number };
type SkillState = Record<SkillId, { level: number; xp: number }>;
type QuestState = Record<string, { n: number; n2: number; done: boolean }>;
type Save = {
  v: 3; dungeons?: DungeonState; skillPoints?: number; abilityRanks?: Record<string, number>; progressionVersion?: number; name: string; race: RaceId; classId?: ClassId; seed: number; x: number; y: number; map: MapId; level: number; xp: number; kyo: number; hp: number;
  bag: Record<string, number>; gear: Gear[]; equipped: Partial<Record<Slot, string>>; known: string[]; bar: string[];
  skills: SkillState; quests: QuestState; wins: number; catches: Record<string, number>; regions: string[];
  companion: GhostPet | null; box: GhostPet[]; bosses: Record<string, number>; talked: string[]; bestShrine: number;
  stash: EnchantRoll[]; saltTurned: number; accountLevel: number; accountXp: number; perkPoints: number;
  perks: Record<string, number>; lastTavern: string; innate: string[]; party: string[]; found: Record<string, Slot[]>;
  /** Set pieces collected per class (character). A full set unlocks for that class only. */
  foundBy?: Record<string, Record<string, Slot[]>>;
  spirits?: Spirit[]; accountScore?: number; evilMark?: number; deathBanked?: boolean; traitId?: string | null; female?: boolean; classMovesV?: number;
  ghostSlots?: number; jarLeft?: number;
  /** Equipped verse ids, at most MAX_EQUIPPED. */
  loadout?: string[];
  dayNight?: DayNightState;
  /** Progress in designer-map quests, keyed "mapId:questId". */
  mapQuests?: QuestStates;
  /** Designer maps whose opening story this hunter has read. */
  mapSeen?: string[];
  /** Bounty board, bounty tier, Bounty Stars and the price on your own head. */
  hunt?: HuntState;
  /** A bounty's gear waiting for you to pick one piece (survives a reload). */
  pendingLoot?: PendingLoot | null;
  /** Gear uids protected from Sell All. */
  locked?: string[];
  /** The world rolled for this life (absent: an older character still on Veilreach). */
  world?: LifeWorld;
  /** Auras raised from the bar (they stay up while slotted). */
  auras?: string[];
  /** Id of the overworld this hunter last played on (changes when a new main world is chosen). */
  mainWorld?: string;
  /** This life: foes defeated and seconds survived (for the death screen). */
  lifeKills?: number;
  lifeT?: number;
  /** The last death, shown on the You Died screen until a new witch wakes. */
  lastDeath?: DeathReport | null;
  /** Items queued on the Space bar, used first to last. */
  quick?: string[];
  /** When this save was last written (picks the newer of the cloud's copy and this device's). */
  savedAt?: number;
};
export type HoverCard = {
  x: number; y: number; kind: "mob" | "info"; name: string; lines: string[];
  level?: number; you?: number; type?: TypeId; tag?: string; hp?: number; max?: number; favor?: string;
  traits?: { id: string; name: string; about: string }[]; moves?: string[];
};
type BountyPosting = { id: string; classId: string; name: string; female: boolean; tier: number; levelBonus: number };
type HuntState = {
  /** Highest bounty tier killed. Each new posting is stronger than the last. */
  tier: number;
  kills: number;
  board: BountyPosting[];
  stars: number;
  /** 0 = clean. Each time stars reach 10 this goes up and squads get stronger. */
  wanted: number;
  /** Seconds until the next hunter squad. */
  waveIn: number;
  squads: number;
};
export type ChestView = { id: string; title: string; t: number; near: boolean; look: ChestLook; gear: Gear[]; items: { id: string; name: string; about: string; count: number }[] };
type PendingLoot = { title: string; kyo: number; items: { id: string; count: number }[]; gear: Gear[]; tier: number };
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: string };
type Flo = { x: number; y: number; text: string; life: number; color: string };
type TurnStep = { side: "you" | "foe" | "spirit"; id: string };

const SAVE_KEY = "turbz-v3";
/** Seconds between autosaves while playing (on top of saving after every kill, item and change). */
const AUTOSAVE_SECONDS = 8;
/** Chance an overworld foe rolls a random kind instead of its camp's set kind. */
const OVERWORLD_RANDOM_FOE = 0.45;
/** Foes never strike from further than this, however long their verse reaches. */
const FOE_REACH_CAP = 240;
/** TurboHunt: kyo price of a Ghost Box when you do not have the timber and ore. */
const GHOST_BOX_KYO = 150;
/** Chance an overworld foe rolls a random element (its moves and its ghost follow it). */
const OVERWORLD_RANDOM_ELEMENT = 0.5;
/** Tagged Ghost Box ghosts: how many may follow, and how small they are drawn. */
const TINY_MAX = 20;
const TINY_SCALE = 0.25;
/**
 * Ghost float tuning. near/far: how close the wander spots are; hold: seconds at a spot; spring/drag/max:
 * how they move there; trail: how far they lag when you walk; jitter/kick: random darts (shinies).
 */
const GHOST_DRIFT = {
	normal: { near: 58, far: 100, flat: 0.45, lift: 4, hold: [2.2, 4.4], arrive: 10, restless: 0.15, spring: 5, drag: 3.1, max: 110, trail: 22, bob: 2, bobRate: 1.6, jitter: 0, kick: 0 },
	shiny: { near: 48, far: 86, flat: 0.5, lift: -8, hold: [0.7, 1.8], arrive: 8, restless: 0.8, spring: 8, drag: 3.2, max: 160, trail: 14, bob: 3, bobRate: 2.4, jitter: 0.45, kick: 36 },
	tiny: { near: 6, far: 16, flat: 0.5, lift: 0, hold: [1.1, 2.4], arrive: 3, restless: 0.35, spring: 8, drag: 3.4, max: 90, trail: 6, bob: 1.2, bobRate: 2, jitter: 0, kick: 0 },
	tinyShiny: { near: 4, far: 16, flat: 0.55, lift: 0, hold: [0.6, 1.4], arrive: 3, restless: 0.8, spring: 9, drag: 3.6, max: 110, trail: 4, bob: 1.4, bobRate: 2.6, jitter: 0.4, kick: 22 },
	perch: { near: 0, far: 2, flat: 0.6, lift: 0, hold: [1.4, 3], arrive: 1.5, restless: 0.2, spring: 8, drag: 4, max: 70, trail: 2, bob: 0.5, bobRate: 2, jitter: 0, kick: 0 },
};
/** How wide a ghost is, so it can stand beside you instead of on you. */
function ghostHalfWidth(spirit) {
	const id = spirit?.species ?? "";
	if (id === "stag") return 46;
	if (id === "boar" || id === "wolf") return 40;
	if (id === "hare" || id === "crow") return 28;
	return 22;
}
/** How high the name sits above a ghost's feet. */
function ghostNameLift(spirit) {
	const id = spirit?.species ?? "";
	if (id === "stag" || id === "boar" || id === "wolf") return 78;
	return 62;
}
/** tone(freq) plays the synthesised blip at freq / BLIP_HZ speed (see sfx-bank.ts). */
const SFX_BASE_HZ = BLIP_HZ;
const SFX_MASTER = 1;
/**
 * Named sound cues, all synthesised in sfx-bank.ts (no downloads). vol: level into the master bus (the
 * bank normalises every sound to the same peak, so these are the mix); rate: default pitch; jitter:
 * random ± pitch so repeats never sound identical; gap: minimum seconds between two plays; loop: repeat
 * the sound if a caller asks for a longer length (the gathering pulse).
 */
const CUES: Record<string, { sound: SfxName; vol: number; len?: number; rate?: number; jitter?: number; gap?: number; loop?: boolean }> = {
	hit: { sound: "hit", vol: 0.5, jitter: 0.07, gap: 0.05 },
	slam: { sound: "slam", vol: 0.55 },
	chop: { sound: "chop", vol: 0.45, jitter: 0.05 },
	thud: { sound: "thud", vol: 0.5, jitter: 0.08, gap: 0.05 },
	hurt: { sound: "hurt", vol: 0.42, jitter: 0.08, gap: 0.22 },
	boom: { sound: "boom", vol: 0.6 },
	swell: { sound: "swell", vol: 0.4 },
	sparkle: { sound: "sparkle", vol: 0.34 },
	burst: { sound: "burst", vol: 0.45 },
	fanfare: { sound: "fanfare", vol: 0.45 },
	pulse: { sound: "pulse", vol: 0.24, loop: true },
	click: { sound: "click", vol: 0.42, jitter: 0.08, gap: 0.04 },
	rattle: { sound: "rattle", vol: 0.45, jitter: 0.04 },
	cast: { sound: "cast", vol: 0.3, jitter: 0.1, gap: 0.04 },
};
const SFX_VOL: Record<string, number> = { square: 0.36, sawtooth: 0.34, triangle: 0.34, sine: 0.3 };
/**
 * Master bus: everything (effects, music and the You Died sting) runs through an FET-style compressor
 * (1176-ish: very fast attack, quick release, high ratio, hard knee), then gentle tape-style saturation,
 * makeup gain and a brickwall-ish limiter so nothing ever clips and loud and quiet sounds sit together.
 */
const FET = { threshold: -20, knee: 2, ratio: 8, attack: 0.0008, release: 0.09, makeup: 1.7, drive: 1.25 };
function satCurve(drive: number): Float32Array {
	const n = 2048, c = new Float32Array(n), k = Math.tanh(drive);
	for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive) / k; }
	return c;
}
function sfxFile(name: string): string {
	let ogg = true;
	try { ogg = typeof Audio !== "undefined" && new Audio().canPlayType("audio/ogg; codecs=vorbis") !== ""; } catch { ogg = true; }
	return `/sfx/${name}.${ogg ? "ogg" : "mp3"}`;
}
function gritCurve(): Float32Array {
	const n = 256, c = new Float32Array(n);
	for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.4); }
	return c;
}
/** Quest XP: written rewards are multiplied, plus a share of the current level's XP bar. */
const QUEST_XP_MULT = 2;
const QUEST_XP_SHARE = 0.15;
const BOARD_XP_SHARE = { easy: 0.2, normal: 0.3, hard: 0.45, elite: 0.7 };
/** Ghosts out with you at once, ghosts in the party, and ghosts the Ghost Box can hold. */
const OUT_MAX = 3;
const PARTY_MAX = 6;
const GHOST_STORE_MAX = 300;
/** One ghost in a hundred is shiny: lava-lamp colours, livelier, and it circles you. */
const SHINY_CHANCE = 0.01;
/** Boss foes are luckier: one boss in fifty leaves a shiny ghost behind (every other ghost stays at one in a hundred). */
const BOSS_SHINY_CHANCE = 1 / 50;
/** Shiny odds are this much higher at night (Hardcore has night). */
const NIGHT_SHINY_MULT = 1.3;
/** A boss that does not drop a shiny still leaves an ordinary ghost this often. */
const BOSS_GHOST_CHANCE = 0.5;
/** Ghosts can grow this many levels past you. */
const GHOST_LEVEL_LEAD = 10;
/** Share of a kill's XP that each ghost out with you, and each tagged tiny follower, earns. */
const GHOST_KILL_XP_OUT = 0.6;
const GHOST_KILL_XP_TAGGED = 0.35;
/**
 * Ghost tasks (Hardcore). A ghost in your party can be sent off to work: fishing and chopping drop their
 * catch straight into your bag, and a ghost sent to level hunts foes alone and earns 2x XP. Only that ghost
 * gets the bonus; you gain nothing from its hunts. A ghost on a task is not out with you.
 */
type GhostTask = "fish" | "chop" | "level";
const GHOST_TASK_IDS: GhostTask[] = ["fish", "chop", "level"];
const GHOST_TASK_NAME: Record<GhostTask, string> = { fish: "Go Fishing", chop: "Go Chopping", level: "Go Leveling" };
const GHOST_TASK_BASE_SECONDS: Record<GhostTask, number> = { fish: 9, chop: 10, level: 12 };
const GHOST_LEVEL_XP_MULT = 2;
/** XP a ghost needs to go from `level` to the next. */
const ghostXpNeed = (level: number) => Math.floor(60 + level * level * 1.2);
/** Ghost verses recharge this much slower than yours. */
const GHOST_CD_MULT = 1.5;
/** Hardcore loot chests: how long they last and how close you must be to open one. */
const CHEST_SECONDS = 300;
const CHEST_REACH = 56;
/** A fallen foe's ghost lingers this long (s) where it fell, waiting for you to decide. */
const WILD_GHOST_LIFE = 300;
const WILD_REACH = 64;
/** Beds: how close you must be to climb in, and how much faster rest comes in one. */
const BED_REACH = 44;
const BED_REST = 1.5;
const HC_KEY = "turbz-hardcore-v1";
const emptySnap = (): Snap => ({
	mode: "title",
	died: null,
	keepWorld: false,
	hasSave: false,
	panel: null,
	name: "",
	race: "vesper",
	level: 1,
	dungeonCountdown: 600,
	dungeonPortals: [],
	skillPoints: 0,
	abilities: [],
	xp: 0,
	xpNeed: 30,
	hp: 80,
	maxHp: 80,
	shield: 0,
	kyo: 0,
	region: "",
	map: "world",
	bar: [],
	log: [],
	questName: "First Steps",
	questAbout: "Win 3 battles anywhere.",
	notice: "",
	talk: null,
	gear: [],
	equipped: [],
	setLabel: "",
	setBonus: "",
	setCount: 0,
	totals: [],
	skills: [],
	bag: [],
	death: [],
	peers: [],
	roomCode: "",
	net: "",
	chat: [],
	trade: null,
	shrine: "",
	companion: "No spirit",
	box: [],
	spirits: [],
	spiritSlots: 3,
	spiritCap: 6,
	ghostStore: [],
	quick: [],
	quickCd: 0,
	ghostInspect: null,
	ghostBonus: { passive: [], timed: [], working: 0 },
	ghostBox: { placed: false, near: false, max: 300 },
	chest: null,
	wildGhost: null,
	lms: null,
	jarLeft: 0,
	known: [],
	stash: [],
	selected: null,
	aim: "Click ground to walk. Close range swings on its own.",
	stock: [],
	wares: [],
	accountLevel: 1,
	accountXp: 0,
	accountNeed: 140,
	perkPoints: 0,
	perks: [],
	bounty: "",
	bountyPlace: "",
	target: null,
	effects: [],
	className: "",
	bounties: [],
	bountyBoard: [],
	hunt: { tier: 0, kills: 0, stars: 0, need: 10, wanted: 0, waveIn: 0, hunters: 0, clearCost: 0, starsOn: false },
	loot: null,
	locked: [],
	sellMult: 1,
	unstuck: 0,
	unlocked: [],
	setProgress: [],
	hover: null,
	hint: "",
	foe: "",
	menu: null,
	mapX: 0,
	mapY: 0,
	party: [],
	autoplay: false,
	autoCombat: true,
	gimmick: null,
	grind: "",
	pools: null,
	orders: null,
	turbz: null,
	accountScore: 0,
	turn: "",
	survival: null, nearCamp: false, nearBed: false, nearWater: false, nearTree: false, sleeping: false,
	rules: "hunt",
	duel: null,
	shinyAlert: 0,
	classId: "",
	sheet: null,
	clock: { phase: "day", label: "Day", left: "", dark: 0, active: false },
	mapQuests: [],
	build: { on: false, logs: 0, placed: 0, inZone: false, holding: false, piece: "wood", beds: 0, ghostBox: false },
	lobby: { code: "", role: "solo", net: "", members: [] }
});
let snap: Snap = emptySnap();
const listeners = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}
export function getSnap(): Snap {
	return snap;
}
/** Structural equality for small snapshot values (depth-limited). Big lists are cached by the engine instead. */
function same(a: unknown, b: unknown, depth = 0): boolean {
	if (a === b) return true;
	if (depth > 4 || typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length || a.length > 400) return false;
		for (let i = 0; i < a.length; i++) if (!same(a[i], b[i], depth + 1)) return false;
		return true;
	}
	if (Array.isArray(b)) return false;
	const ka = Object.keys(a as object), kb = Object.keys(b as object);
	if (ka.length !== kb.length) return false;
	for (const k of ka) if (!same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], depth + 1)) return false;
	return true;
}
/** Engine-cached values: a new identity always means new content. */
const IDENTITY_KEYS = new Set<keyof Snap>(["gear", "abilities", "sheet"]);
/** Only changed fields get a new identity, and nothing re-renders when nothing changed. */
function publish(p: Partial<Snap>): void {
	let changed = false;
	const next = { ...snap };
	for (const k of Object.keys(p) as (keyof Snap)[]) {
		const v = p[k];
		if (IDENTITY_KEYS.has(k) ? snap[k] === v : same(snap[k], v)) continue;
		(next as Record<string, unknown>)[k] = v;
		changed = true;
	}
	if (!changed) return;
	snap = next;
	listeners.forEach((l) => l());
}
function blankSkills() {
	const s = {};
	for (const sk of SKILLS) s[sk.id] = {
		level: 1,
		xp: 0
	};
	return s;
}
function blankQuests() {
	const q = {};
	for (const d of QUESTS) q[d.id] = {
		n: 0,
		n2: 0,
		done: false
	};
	return q;
}
/** A verse's base cooldown before anyone's personal bonuses. Hunters and foes share it. */
export function baseMoveCooldown(move) {
	const tactic = moveTactic(move);
	const form = attackForm(move);
	let cd = Math.max(.28, .55 + move.power / 90 - move.priority * .08);
	if (tactic === "heavy" || tactic === "channel") cd *= 1.7;
	else if (form === "spell") cd *= 1.35;
	else if (form === "melee") cd *= .8;
	// Reach and each verse's own twist shape it further (content.ts moveCdFactor).
	return cd * moveCdFactor(move);
}

/**
 * Returns true when the straight line from (ax,ay) to (bx,by) passes through
 * at least one blocked tile.  Step size is 10 px — fine enough for 32-px tiles.
 */
function wallBetween(world, ax: number, ay: number, bx: number, by: number): boolean {
	const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 10));
	for (let s = 1; s < steps; s++) {
		const t = s / steps;
		if (blocked(world, ax + (bx - ax) * t, ay + (by - ay) * t)) return true;
	}
	return false;
}

export class TurbzGame {
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	// recovered fields stay loose; combat fields are assigned in methods
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[k: string]: any;
	gim!: Gimmicks;
	mates: { x: number; y: number; swing: number }[] = [];
	mateCd: Record<string, number> = {};
	mateDirections: Record<string, ActorDirection> = {};
	fightGap = 0;
	turnQ: TurnStep[] = [];
	fought = false;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas");
		this.ctx = ctx;
		this.selfId = `p${Math.random().toString(36).slice(2, 10)}`;
		this.keys = new Set();
		this.qa = new Set();
		this.stick = { x: 0, y: 0 };
		this.cam = { x: 400, y: 400 };
		this.mobs = [];
		this.dormant = [];
		this.populationMap = "";
		this.cds = {};
		this.status = [];
		this.parts = [];
		this.floats = [];
		this.remotes = new Map();
		this.peers = [];
		this.chat = [];
		this.seenSwing = new Map();
		this.nodeCd = {};
		this.nodeRespawn = [];
		this.nodeSeq = 0;
		this.path = [];
		this.shopStock = [];
		this.zoom = 2.35;
		this.facing = 1;
		this.direction = "down";
		this.role = "solo";
		this.log = ["The veil remembers your skills. It does not remember your pockets."];
		this.buff = { crit: 0, ward: 0, t: 0 };
		this.pet = { x: 0, y: 0 };
		this.running = false;
		this.acc = 0;
		this.last = 0;
		this.clock = 0;
		this.role = "solo";
		this.dead = false;
		this.vx = 0;
		this.vy = 0;
		this.walk = 0;
		this.hurt = 0;
		this.attackT = 0;
		this.shake = 0;
		this.combat = 0;
		this.shield = 0;
		this.wardT = 0;
		this.rollT = 0;
		this.cfx = new CombatFx();
		this.gim = new Gimmicks(this);
		this.castLock = 0;
		this.meleeChain = freshMelee();
		this.weave = freshWeave();
		this.overcastT = 0;
		this.rush = null;
		this.orbit = null;
		this.rules = "hunt";
		this.duel = null;
		this.contract = [];
		this.unstuckT = 0;
		this.mouseWorld = null;
		this.defFatigue = 0;
		this.duelAllow = false;
		this.partyIn = 36;
		this.graveFn = null;
		this.cloudHard = null;
		this.autoCd = 0;
		this.netAcc = 0;
		this.mobAcc = 0;
		this.setProc = 0;
		this.zoom = 2.35;
	}
	start() {
		if (this.running) return;
		this.running = true;
		this.bind();
		this.resize();
		// Character sheets are optional art: procedural actors cover the gap until they load.
		void initActorSprites().catch(() => {});
		publish({
			hasSave: !!localStorage.getItem(SAVE_KEY),
			mode: "title"
		});
		this.last = performance.now();
		const loop = (t) => {
			if (!this.running) return;
			const dt = Math.min(.05, (t - this.last) / 1e3);
			this.last = t;
			this.acc += dt;
			while (this.acc >= 1 / 60) {
				this.step(1 / 60);
				this.acc -= 1 / 60;
			}
			this.draw();
			this.raf = requestAnimationFrame(loop);
		};
		this.raf = requestAnimationFrame(loop);
		window.__turbz = this;
		window.__controlsTest = {
			getYaw: () => this.facing < 0 ? .4 : -.4,
			getSpeed: () => Math.hypot(this.vx, this.vy),
			setKeys: (codes) => {
				this.qa = new Set(codes);
			},
			getPos: () => ({
				x: this.save?.x ?? 0,
				y: this.save?.y ?? 0
			})
		};
	}
	stop() {
		this.persist();
		this.events?.abort();
		this.resetInput();
		this.music?.pause(); this.music = null; this.musicTried = false;
		void this.audio?.close().catch(() => {}); this.audio = null;
		this.running = false;
		cancelAnimationFrame(this.raf);
		this.room?.close();
		this.room = null;
	}
	setStick(x, y) {
		this.stick.x = x;
		this.stick.y = y;
	}
	setKeys(codes) {
		this.qa = new Set(codes);
	}
	resetInput() {
		this.keys.clear(); this.qa.clear(); this.stick.x = this.stick.y = 0;
		this.vx = this.vy = 0; this.dest = null;
		if (this.pointer) this.pointer.down = false;
	}
	bind() {
		this.events?.abort();
		this.events = new AbortController();
		const options = { signal: this.events.signal };
		const down = (e) => {
			if (this.typing() || snap.mode !== "play" || this.dead || e.ctrlKey || e.metaKey || e.altKey || snap.panel === "loot") return;
			this.keys.add(e.code);
			if (!e.repeat && this.save) {
				// Mash to wake / pull free.
				const held = this.status.find((s) => (s.id === "sleep" || s.id === "root") && s.t > 0);
				if (held && struggle(this.status, held.id === "sleep" ? 0.3 : 0.18)) {
					this.struggleN = (this.struggleN ?? 0) + 1;
					if (this.struggleN % 3 === 0) this.float(this.save.x, this.save.y - 58, "STRUGGLE", "#e7d9ff");
				}
			}
			if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) this.dest = null;
			if ([
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"Space",
				"Numpad0",
				"Numpad1",
				"Numpad2",
				"Numpad3",
				"Numpad4",
				"Numpad5",
				"Numpad6",
				"Numpad7",
				"Numpad8",
				"Numpad9",
				"NumpadEnter"
			].includes(e.code)) e.preventDefault();
			if (e.repeat) return;
			if (e.code.startsWith("Digit")) {
				const digit = Number(e.code.slice(5));
				if (digit >= 1 && digit <= 9) this.cast(digit - 1);
			}
			if (/^Numpad[1-9]$/.test(e.code)) this.cast(Number(e.code.slice(6)) - 1);
			if (e.code === "Numpad0" || e.code === "NumpadEnter") this.attack();
			if (e.code === "KeyR") this.gim?.activate();
			if (e.code === "KeyE") this.interact();
			if (e.code === "KeyB") this.toggle("bag");
			if (e.code === "KeyI") this.toggle("gear");
			if (e.code === "KeyK") this.toggle("skills");
			if (e.code === "KeyQ") this.toggle("quests");
			if (e.code === "KeyM") this.toggle("map");
			if (e.code === "KeyG") this.toggle("ghost");
			if (e.code === "KeyX") this.toggle("craft");
			if (e.code === "KeyV") this.toggle("moves");
			if (e.code === "KeyC") this.toggle("sheet");
			if (e.code === "KeyH" && this.rules === "hardcore") this.toggle("survival");
			if (e.code === "KeyF" && this.rules === "hardcore") this.toggleBuild();
			if (e.code === "KeyT") this.toggleTrade();
			if (e.code === "Space") this.useQuick();
			if (e.code === "Escape") this.escape();
			this.unlock();
		};
		const up = (e) => this.keys.delete(e.code);
		window.addEventListener("keydown", down, options);
		window.addEventListener("keyup", up, options);
		window.addEventListener("blur", () => this.resetInput(), options);
		window.addEventListener("focusin", () => { if (this.typing()) this.resetInput(); }, options);
		window.addEventListener("pagehide", () => this.persist(), options);
		document.addEventListener("visibilitychange", () => {
			this.resetInput(); this.last = performance.now(); this.acc = 0;
			if (document.hidden) this.persist();
		}, options);
		this.canvas.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			const w = this.screenToWorld(e.clientX, e.clientY);
			const r = this.canvas.getBoundingClientRect();
			this.openInspect(w.x, w.y, e.clientX - r.left, e.clientY - r.top);
		}, options);
		this.canvas.addEventListener("pointerdown", (e) => {
			this.unlock();
			if (e.button === 2) return;
			this.menu = null;
			this.canvas.setPointerCapture(e.pointerId);
			const w = this.screenToWorld(e.clientX, e.clientY);
			if (this.buildMode && this.buildOn()) { this.buildAt(w.x, w.y); return; }
			this.pointer = {
				x: w.x,
				y: w.y,
				down: true
			};
			this.pointAt(w.x, w.y);
		}, options);
		this.canvas.addEventListener("pointermove", (e) => {
			const w = this.screenToWorld(e.clientX, e.clientY);
			this.mouseWorld = w;
			const r = this.canvas.getBoundingClientRect();
			this.hoverClient = e.pointerType === "mouse" ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
			this.hoverAt(w.x, w.y);
			if (!this.pointer?.down) return;
			this.pointer = {
				x: w.x,
				y: w.y,
				down: true
			};
			this.pointAt(w.x, w.y);
		}, options);
		window.addEventListener("pointermove", (e) => {
			this.mouseWorld = this.screenToWorld(e.clientX, e.clientY);
		}, options);
		this.canvas.addEventListener("pointerup", () => {
			if (this.pointer) this.pointer.down = false;
		}, options);
		this.canvas.addEventListener("dblclick", (e) => {
			if (snap.mode !== "play" || this.dead) return;
			this.gim?.dblclick(this.screenToWorld(e.clientX, e.clientY));
		}, options);
		this.canvas.addEventListener("pointercancel", () => { if (this.pointer) this.pointer.down = false; }, options);
		this.canvas.addEventListener("wheel", (e) => {
			e.preventDefault();
			this.zoom = Math.max(1.15, Math.min(3, this.zoom * (e.deltaY > 0 ? .92 : 1.08)));
		}, { ...options, passive: false });
		window.addEventListener("resize", () => this.resize(), options);
	}
	typing() {
		const a = document.activeElement;
		return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
	}
	unlock() {
		if (!this.audio) {
			const AC = window.AudioContext || window.webkitAudioContext;
			if (AC) { this.audio = new AC(); this.buildBus(); }
		}
		this.audio?.resume();
		this.loadSfx();
		if (!this.musicTried) {
			this.musicTried = true;
			this.playMusic("veil.ogg");
		}
	}
	async playMusic(file) {
		try {
			if (!(await fetch(`/music/${file}`, { method: "HEAD" })).ok) {
				const alt = file.replace(/\.ogg$/, ".mp3");
				if (alt === file) return;
				if (!(await fetch(`/music/${alt}`, { method: "HEAD" })).ok) return;
				file = alt;
			}
			if (!this.running) return;
			const audio = new Audio(`/music/${file}`);
			this.music?.pause(); this.music = audio;
			audio.loop = true;
			audio.volume = .35;
			this.toBus(audio, 0.9);
			await audio.play();
		} catch {}
	}
	/**
	 * Builds the master bus once: sfx + music → FET compressor → saturation → makeup → limiter → speakers.
	 * `this.sfxIn` is where every effect connects; nothing connects straight to the destination.
	 */
	buildBus() {
		const ac = this.audio;
		if (!ac || this.sfxIn) return;
		try {
			const input = ac.createGain();
			const comp = ac.createDynamicsCompressor();
			comp.threshold.value = FET.threshold; comp.knee.value = FET.knee; comp.ratio.value = FET.ratio;
			comp.attack.value = FET.attack; comp.release.value = FET.release;
			const sat = ac.createWaveShaper();
			sat.curve = satCurve(FET.drive);
			sat.oversample = "2x";
			const makeup = ac.createGain();
			makeup.gain.value = FET.makeup;
			const lim = ac.createDynamicsCompressor();
			lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
			const out = ac.createGain();
			out.gain.value = 0.92;
			input.connect(comp); comp.connect(sat); sat.connect(makeup); makeup.connect(lim); lim.connect(out); out.connect(ac.destination);
			this.sfxIn = input;
			this.busComp = comp;
		} catch {
			this.sfxIn = ac.destination;
		}
	}
	/** The bus input (falls back to the speakers if the bus could not be built). */
	bus() {
		if (!this.sfxIn) this.buildBus();
		return this.sfxIn ?? this.audio.destination;
	}
	/** Routes an <audio> element (music, the You Died sting) through the master bus. */
	toBus(el: HTMLAudioElement, level = 1) {
		if (!this.audio) return;
		try {
			const src = this.audio.createMediaElementSource(el);
			const g = this.audio.createGain();
			g.gain.value = level;
			src.connect(g); g.connect(this.bus());
		} catch { /* element already routed or not allowed: it plays straight out */ }
	}
	/**
	 * Synthesises the sound bank (sfx-bank.ts) into AudioBuffers, a few sounds per frame so the first
	 * click never stutters. Sounds that are not ready yet fall back to the plain synth.
	 */
	loadSfx() {
		if (!this.audio || this.sfxLoading) return;
		this.sfxLoading = true;
		this.sfxBufs = this.sfxBufs ?? {};
		const ac = this.audio, queue = ["blip", "hit", "hurt", "cast", "click", ...SFX_NAMES].filter((n, i, a) => a.indexOf(n) === i) as SfxName[];
		const step = () => {
			const t0 = performance.now();
			while (queue.length && performance.now() - t0 < 8) {
				const name = queue.shift()!;
				try {
					const data = renderSfx(name, ac.sampleRate);
					const buf = ac.createBuffer(1, data.length, ac.sampleRate);
					buf.copyToChannel(data, 0);
					this.sfxBufs[name] = buf;
				} catch { /* leave it to the synth fallback */ }
			}
			if (queue.length) setTimeout(step, 0);
		};
		step();
	}
	/**
	 * Short pitched sounds for small events: the synthesised mallet blip played at a pitch, length and
	 * colour that fit the moment. `type` picks the colour the old synth wave had (sine soft, triangle
	 * mellow, square plain, sawtooth gritty). Falls back to the plain synth until the bank is ready.
	 */
	tone(freq, dur, type = "square") {
		if (!this.audio) return;
		if (!this.sfxLoading) this.loadSfx();
		if (this.sfxBufs?.blip) return this.playSample(freq, dur, type);
		this.synth(freq, dur, type);
	}
	playSample(freq, dur, type) {
		const ac = this.audio, buf = this.sfxBufs.blip;
		if ((this.sfxVoices ?? 0) >= 16) return;
		const now = ac.currentTime;
		const rate = Math.max(0.25, Math.min(4, freq / SFX_BASE_HZ));
		const len = Math.min(buf.duration / rate, Math.max(0.1, dur * 3));
		const src = ac.createBufferSource();
		src.buffer = buf;
		src.playbackRate.value = rate;
		const vol = (SFX_VOL[type] ?? 0.34) * SFX_MASTER;
		const gain = ac.createGain();
		gain.gain.setValueAtTime(vol, now);
		gain.gain.setValueAtTime(vol, now + len * 0.6);
		gain.gain.linearRampToValueAtTime(0.0001, now + len);
		let head = src;
		if (type === "sine" || type === "triangle") {
			const f = ac.createBiquadFilter();
			f.type = "lowpass";
			f.frequency.value = type === "sine" ? 2200 : 4500;
			head.connect(f);
			head = f;
		} else if (type === "sawtooth") {
			const shaper = ac.createWaveShaper();
			shaper.curve = this.grit ?? (this.grit = gritCurve());
			const f = ac.createBiquadFilter();
			f.type = "highpass";
			f.frequency.value = 90;
			head.connect(shaper);
			shaper.connect(f);
			head = f;
		}
		head.connect(gain);
		gain.connect(this.bus());
		this.sfxVoices = (this.sfxVoices ?? 0) + 1;
		src.onended = () => { this.sfxVoices = Math.max(0, (this.sfxVoices ?? 1) - 1); };
		src.start(now);
		src.stop(now + len + 0.02);
	}
	/**
	 * Plays a named sound cue (see CUES). `opts` can change pitch (rate), loudness (vol) and length (len,
	 * seconds). Pitch requests are softened (square root) so a cue never turns shrill or muddy. Falls back
	 * to the pitched tone (`fb`) until the bank is ready. Returns a stop function (used to cut the
	 * gathering pulse when a channel ends early).
	 */
	cue(name, opts: { rate?: number; vol?: number; len?: number } = {}, fb?: [number, number, string?]) {
		if (!this.audio) return () => {};
		const c = CUES[name];
		const buf = c && this.sfxBufs?.[c.sound];
		if (!c || !buf) { if (!this.sfxLoading) this.loadSfx(); if (fb) this.tone(fb[0], fb[1], fb[2] ?? "square"); return () => {}; }
		const now = this.clock ?? 0;
		this.cueLast = this.cueLast ?? {};
		if (c.gap && now - (this.cueLast[name] ?? -9) < c.gap) return () => {};
		this.cueLast[name] = now;
		if ((this.sfxVoices ?? 0) >= 18) return () => {};
		const ac = this.audio;
		const rate = Math.sqrt(opts.rate ?? c.rate ?? 1) * (1 + (Math.random() - .5) * 2 * (c.jitter ?? 0));
		const natural = buf.duration / rate;
		const len = Math.max(.05, c.loop ? (opts.len ?? natural) : Math.min(opts.len ?? c.len ?? natural, natural));
		const vol = Math.min(1, opts.vol != null ? Math.max(opts.vol, c.vol * 0.6) : c.vol) * SFX_MASTER;
		const t0 = ac.currentTime;
		const src = ac.createBufferSource();
		src.buffer = buf;
		src.playbackRate.value = rate;
		if (c.loop && len > natural) src.loop = true;
		const gain = ac.createGain();
		const fade = Math.min(.2, len * .3);
		gain.gain.setValueAtTime(vol, t0);
		gain.gain.setValueAtTime(vol, t0 + len - fade);
		gain.gain.linearRampToValueAtTime(0.0001, t0 + len);
		const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
		if (pan) { pan.pan.value = (Math.random() - .5) * 0.24; src.connect(gain); gain.connect(pan); pan.connect(this.bus()); }
		else { src.connect(gain); gain.connect(this.bus()); }
		this.sfxVoices = (this.sfxVoices ?? 0) + 1;
		src.onended = () => { this.sfxVoices = Math.max(0, (this.sfxVoices ?? 1) - 1); };
		src.start(t0);
		src.stop(t0 + len + .02);
		return () => { try { gain.gain.cancelScheduledValues(ac.currentTime); gain.gain.setValueAtTime(gain.gain.value, ac.currentTime); gain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + .08); src.stop(ac.currentTime + .1); } catch { /* already stopped */ } };
	}
	/** The You Died sting (also used by Last Man Standing). Music ducks under it. */
	playYouDied() {
		try {
			const a = new Audio(sfxFile("you-died"));
			a.volume = 0.85;
			this.toBus(a);
			const music = this.music;
			if (music) { const was = music.volume; music.volume = Math.min(was, 0.08); setTimeout(() => { if (this.music === music) music.volume = was; }, 6200); }
			void a.play().catch(() => this.synth(70, .3, "sawtooth"));
		} catch {
			this.synth(70, .3, "sawtooth");
		}
	}
	synth(freq, dur, type = "square") {
		if (!this.audio) return;
		const o = this.audio.createOscillator();
		const g = this.audio.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.value = .035;
		o.connect(g);
		g.connect(this.bus());
		o.start();
		o.stop(this.audio.currentTime + dur);
	}
	viewport = { w: 1, h: 1, dpr: 1 };
	moving = false;
	resize() {
		const dpr = Math.min(1.75, window.devicePixelRatio || 1);
		const r = this.canvas.getBoundingClientRect();
		this.canvas.width = Math.max(1, Math.floor(r.width * dpr));
		this.canvas.height = Math.max(1, Math.floor(r.height * dpr));
		this.viewport = { w: r.width, h: r.height, dpr: this.canvas.width / Math.max(1, r.width) };
	}
	cssSize() {
		return this.viewport;
	}
	screenToWorld(cx, cy) {
		const r = this.canvas.getBoundingClientRect();
		const { w, h } = this.cssSize();
		const x = (cx - r.left) / r.width * w;
		const y = (cy - r.top) / r.height * h;
		return {
			x: this.cam.x + (x - w / 2) / this.zoom,
			y: this.cam.y + (y - h / 2) / this.zoom
		};
	}
	say(text) {
		this.log.unshift(text);
		this.log = this.log.slice(0, 6);
		this.syncHud(true);
	}
	/** Banks every ghost a witch has (party and Ghost Box) on the account, for this mode's next witch. */
	bankGhosts(save) {
		if (!save) return;
		const all = [...(save.spirits ?? []), ...(save.ghostStore ?? [])];
		if (all.length) vaultGhosts(this.rules, all.map((g) => ({ ...g, active: false })));
	}
	/**
	 * The ghosts a new witch inherits: everything the last witch of this mode had (whether she died or was
	 * replaced) plus anything banked on the account. The first PARTY_MAX follow her; the rest wait in the Box.
	 */
	inheritGhosts(prev, classId) {
		let local = null;
		try { const text = localStorage.getItem(this.rules === "hardcore" ? HC_KEY : SAVE_KEY); local = text ? JSON.parse(text) : null; } catch { /* private mode */ }
		const from = (x) => (x && typeof x === "object" ? [...(Array.isArray(x.spirits) ? x.spirits : []), ...(Array.isArray(x.ghostStore) ? x.ghostStore : [])] : []);
		const all = unionGhosts(from(prev), from(local), takeVaultGhosts(this.rules)).filter((g) => g && (g.species || g.type));
		const party = [], store = [];
		for (const g of all) {
			const ghost = { ...g, active: false };
			if (party.length < PARTY_MAX && ghost.species && Array.isArray(ghost.known)) party.push(ghost);
			else store.push(ghost);
		}
		const cap = classSpiritOut(classId);
		party.slice(0, Math.max(1, cap)).forEach((g) => { g.active = true; });
		return { spirits: party, ghostStore: store.slice(0, GHOST_STORE_MAX) };
	}
	begin(name, race: RaceId, as, classId: ClassId = LEGACY_CLASS[race], traitId: string | null = null, female = true) {
		const prevSave = this.peekRuleSave();
		if (!this.turbz) this.captureProgress(prevSave);
		const inherited = this.turbz ? { spirits: [], ghostStore: [] } : this.inheritGhosts(prevSave, classId);
		const seed = Math.random() * 1e9 | 0;
		const rng = mulberry32(seed ^ 91);
		const type = CLASS_BY_ID[classId].type;
		const weapon = rollGear(rng, {
			level: 1,
			slot: "weapon",
			floor: "common",
			typeBias: type,
			raceBias: race
		});
		const known = [...CLASS_BY_ID[classId].starterMoves];
		// Every new character wakes in a world rolled just for it.
		const world = rollLifeWorld();
		this.enterLifeWorld(world);
		const home = hearthXY();
		const save = {
			v: 3,
			world,
			worldVer: mainWorldFile() ? 2 : 1,
			mainWorld: this.mainWorldSig(),
			name: (name || "Huntress").slice(0, 16),
			race,
			classId,
			traitId: traitId && TRAIT_BY_ID[traitId] ? traitId : null,
			female: female !== false,
			classMovesV: 3,
			seed,
			x: home.x,
			y: home.y,
			map: "world",
			level: 1,
			xp: 0,
			kyo: 40,
			hp: 90,
			bag: {
				potion: 3,
				ghost_jar: 2,
				cleanse_salt: 0,
				leather: 0,
				mushroom: 0
			},
			gear: [weapon],
			equipped: { weapon: weapon.uid },
			known,
			bar: known,
			skills: blankSkills(),
			quests: blankQuests(),
			wins: 0,
			catches: {},
			regions: ["crown"],
			companion: null,
			box: [],
			bosses: {},
			talked: [],
			bestShrine: 0,
			stash: [],
			saltTurned: 0,
			accountLevel: 1,
			accountXp: 0,
			perkPoints: 0,
			perks: {},
			lastTavern: "crown_tap",
			innate: known,
			party: [],
			found: {},
			foundBy: {},
			spirits: inherited.spirits,
			ghostStore: inherited.ghostStore,
			accountScore: 0,
			evilMark: 0,
			deathBanked: false,
			quick: ["potion"]
		};
		this.boot(save);
		if (!this.turbz && (inherited.spirits.length || inherited.ghostStore.length)) this.say(`Your ghosts found you: ${inherited.spirits.length} in your party${inherited.ghostStore.length ? `, ${inherited.ghostStore.length} waiting in the Ghost Box` : ""}.`);
		save.hp = this.maxHp();
		this.say(this.rules === "hardcore" ? `${save.name} wakes in the frontier. Hunt, gather water, and build a fire. Wounds only mend with healing spells, potions and meals.` : `${save.name} wakes at the hearth.`);
		this.cue("swell", {}, [220, .12]);
	}
	continueGame() {
		const cached = this.rules === "hardcore" ? this.cloudHard : this.cloudCache;
		const key = this.rules === "hardcore" ? HC_KEY : SAVE_KEY;
		const raw = cached ? JSON.stringify(cached) : localStorage.getItem(key);
		if (!raw) return false;
		try {
			this.boot(JSON.parse(raw));
			this.say("The hearth kept your skills.");
			return true;
		} catch {
			return false;
		}
	}
	boot(save) {
		this.direction = "down";
		this.duel = null; this.sleeping = false;
		this.refundNote = 0;
		this.lastHit = null;
		this.normalize(save);
		this.save = save;
		// Shinies caught before the collection existed join it now.
		if (!this.lms) for (const sp of [...(save.spirits ?? []), ...(save.ghostStore ?? [])]) if (sp?.shiny) this.recordShiny(sp);
		if (this.refundNote) setTimeout(() => this.say(`Ghost slots are gone: 3 ghosts go out with you, 6 ride in your party, and a Ghost Box at camp holds the rest. ${this.refundNote} skill point${this.refundNote === 1 ? "" : "s"} refunded.`), 1500);
		// Enemy Designer creations join (or replace) the monster tables before the world is built.
		try { installEnemyDesigns(); } catch { /* a broken design must not stop the game */ }
		// The overworld is always the embedded Veilreach. It is rebuilt fresh for every boot (rejoining from
		// the main menu used to keep the old generated world here).
		this.overworld = null;
		this.overworldFile = null;
		this.mobs = [];
		this.nodeStash = [];
		this.chests = null;
		this.dormant = [];
		this.populationMap = "";
		this.contract = [];
		this.powerRef = null;
		this.powerT = 0;
		this.unstuckT = 0;
		this.dead = !!save.deathBanked;
		this.secondUsed = false;
		this.status = [];
		this.shield = 0;
		this.dest = null;
		this.shrine = null;
		this.mobs = this.mobs ?? [];
		this.cds = this.cds ?? {};
		this.parts = this.parts ?? [];
		this.floats = this.floats ?? [];
		this.remotes = this.remotes ?? new Map();
		this.seenSwing = this.seenSwing ?? new Map();
		this.nodeCd = this.nodeCd ?? {};
		this.nodeRespawn = this.nodeRespawn ?? [];
		this.nodeSeq = this.nodeSeq ?? 0;
		this.keys = this.keys ?? new Set();
		this.qa = this.qa ?? new Set();
		// This character's own world (characters from before life worlds keep Veilreach until they die).
		this.enterLifeWorld(save.world ?? null);
		this.migrateMainWorld(save);
		this.loadMap(save.map, false);
		if (blocked(this.world, save.x, save.y)) {
			this.loadMap("world", true);
			const home = nearestOpen(this.world, hearthXY().x, hearthXY().y);
			save.x = home.x;
			save.y = home.y;
			save.map = "world";
			this.loadMap("world", false);
		}
		this.cam.x = save.x;
		this.cam.y = save.y;
		publish({
			mode: "play",
			panel: this.dead ? (save.lastDeath ? "died" : "rebirth") : null,
			died: this.dead ? save.lastDeath ?? null : null,
			hasSave: true
		});
		this.ensureHunt();
		if (!this.dead && save.map === "world" && this.customFile) this.openMapStory();
		if (!this.dead && save.pendingLoot?.gear?.length) this.openLoot();
		this.syncHud(true);
		this.persist();
	}
	/**
	 * Saves from before Veilreach became the overworld: positions, campfires, logs and open rifts on the
	 * old generated world no longer line up, so the hunter wakes at the new hearth. Veilreach progress
	 * (played as a separate map) carries straight over.
	 */
	/** Makes `world` the overworld (null: Veilreach). Rebuilds the overworld the next time it loads. */
	enterLifeWorld(world: LifeWorld | null) {
		let file = null;
		if (world) {
			try { file = lifeWorldFile(world); } catch { file = null; }
			touchLifeWorld(world.id);
		}
		setLifeWorld(file);
		if (this.overworldFile !== mainWorldFile()) { this.overworld = null; this.overworldFile = null; this.populationMap = ""; }
	}
	/** Death screen: keep this world for the next life instead of rolling a new one. */
	setKeepWorld(on) {
		this.keepWorld = !!on;
		publish({ keepWorld: this.keepWorld });
	}
	/** The main world's id plus a fingerprint, so a rebuilt Veilreach counts as a new world too. */
	mainWorldSig() {
		const mf = mainWorldFile();
		return mf ? `${mf.id}:${mf.w}x${mf.h}:${(mf.npcs ?? []).length}:${(mf.quests ?? []).length}:${(mf.regions ?? []).length}` : "";
	}
	migrateMainWorld(save) {
		// A different main world was chosen in the Map Builder since this hunter last played: positions,
		// campfires, logs and rifts on the old overworld no longer line up, so wake at the new start.
		const mainId = this.mainWorldSig();
		if (save.mainWorld !== mainId && (save.mainWorld !== undefined || (save.worldVer ?? 1) >= 2)) {
			if (save.map === "world" || save.map.startsWith("rift-")) { save.map = "world"; Object.assign(save, hearthXY()); }
			if (save.survival?.campfires) save.survival.campfires = save.survival.campfires.filter((f) => f.map !== "world");
			if (save.survival?.logs) save.survival.logs = save.survival.logs.filter((l) => l.map !== "world");
			if (save.dungeons?.portals) save.dungeons.portals = save.dungeons.portals.filter((p) => p.cleared);
			save.nodesTaken = {};
			setTimeout(() => this.say("The world has changed. You wake somewhere new."), 1200);
		}
		save.mainWorld = mainId;
		if (!mainWorldFile() || (save.worldVer ?? 1) >= 2) return;
		save.worldVer = 2;
		if (save.map === `custom-${MAIN_WORLD_ID}`) save.map = "world";
		else if (save.map === "world" || save.map === "crypt" || save.map === "kiln" || save.map.startsWith("rift-")) {
			save.map = "world";
			Object.assign(save, hearthXY());
		}
		if (save.survival?.campfires) save.survival.campfires = save.survival.campfires.filter((f) => f.map !== "world");
		if (save.survival?.logs) save.survival.logs = save.survival.logs.filter((l) => l.map !== "world");
		if (save.dungeons?.portals) save.dungeons.portals = save.dungeons.portals.filter((p) => p.cleared);
	}
	loadMap(map, freshMobs) {
		const save = this.save;
		if (!save) return;
		if (map === "world") {
			// The overworld is Veilreach (main-world.ts), embedded in the game, for both modes.
			const main = mainWorldFile();
			if (!this.overworld || this.overworldFile !== main) {
				this.overworldFile = main;
				if (main) {
					const w = mapToWorld(main);
					w.spawns.push(...expandZones(main));
					for (const p of POIS) {
						if (p.kind !== "boss") continue;
						const at = scaleTile(p.tx, p.ty);
						w.spawns.push({ id: p.id, kind: "mob", species: "saintling", boss: true, bossId: p.id, x: at.tx * 32 + 16, y: at.ty * 32 + 16, level: p.level, template: p.template, type: p.type });
					}
					w.entry = { x: (main.spawn?.tx ?? 1) * 32 + 16, y: (main.spawn?.ty ?? 1) * 32 + 16 };
					this.overworld = w;
				}
			}
			this.world = this.overworld;
			this.world.cache = null;
			if (main) {
				if (this.customFile !== main) { this.regionKey = ""; this.mapRegion = null; }
				this.customFile = main;
				this.mapNpcs = main.npcs ?? [];
			}
		} else if (map === "custom-turbz" && this.turbzFile) {
			const file = this.turbzFile;
			this.customFile = file;
			this.mapNpcs = [];
			this.regionKey = "";
			this.mapRegion = null;
			this.world = mapToWorld(file);
			this.world.spawns.push(...expandZones(file));
			this.world.entry = { x: (file.spawn?.tx ?? 1) * 32 + 16, y: (file.spawn?.ty ?? 1) * 32 + 16 };
		} else if (map.startsWith("custom-")) {
			const file = findMapFile(map.slice(7));
			if (!file) return this.loadMap("world", true);
			this.customFile = file;
			this.mapNpcs = file.npcs ?? [];
			this.regionKey = "";
			this.mapRegion = null;
			this.world = mapToWorld(file);
			this.world.spawns.push(...expandZones(file));
			this.world.entry = { x: (file.spawn?.tx ?? 1) * 32 + 16, y: (file.spawn?.ty ?? 1) * 32 + 16 };
		} else if (map.startsWith("rift-")) {
			const portal = save.dungeons.portals.find(p => p.id === map);
			if (!portal) return this.loadMap("world", true);
			this.world = this.riftWorld(portal);
			this.world.spawns = this.world.spawns.filter(s => !portal.defeated.includes(s.id));
		} else if (map === "crypt" || map === "kiln") {
			// Built by the map generator from the in-game day, so the Crypt and the Kiln change every day.
			// Drawn live from tile art (like rifts) so walls show once the art loads.
			this.world = generateDungeon({ kind: map, seed: dungeonSeed(save.seed, this.dungeonDay(map), map === "crypt" ? 3 : 9), day: this.dungeonDay(map) });
			this.world.cache = null;
			// One instance per visit: walking in starts a fresh one; reloading the page inside keeps the dead dead.
			const d = save.dungeons;
			if (d) {
				if (freshMobs || d.inside?.map !== map) d.inside = { map, defeated: [] };
				const gone = new Set(d.inside.defeated ?? []);
				if (gone.size) this.world.spawns = this.world.spawns.filter((sp) => !gone.has(sp.id));
			}
		} else {
			this.world = buildDungeon(map, save.seed);
			this.world.cache = null;
		}
		// Dungeon layouts differ every day: arrive at the entry, and never stand inside a wall of a rebuilt map.
		if ((map === "crypt" || map === "kiln" || map.startsWith("rift-")) && this.world.entry && (freshMobs || blocked(this.world, save.x, save.y))) {
			save.x = this.world.entry.x;
			save.y = this.world.entry.y;
		}
		if (!map.startsWith("custom-") && !(map === "world" && this.overworldFile)) { this.customFile = null; this.mapNpcs = []; this.mapRegion = null; this.regionKey = ""; }
		this.applyTakenNodes(map);
		const witch = this.mobs.find((m) => m.witch && m.alive && !m.bounty && !m.bountySpirit && !m.hunter && !m.party) ?? null;
		this.stashContract();
		// Rebuild when the map's population isn't this map's. Returning from a rift or crypt used to
		// keep the dungeon's foe list, so the overworld looked empty until a full refresh.
		if (freshMobs || this.populationMap !== map || (this.mobs.length === 0 && !this.dormant?.length)) {
			// Only bosses are built up front. Every other foe waits as a spawn point and is created
			// when the hunter comes near (see tickDormancy), so big maps load fast and run smoothly.
			const specs = this.world.spawns.filter((s) => s.kind === "mob");
			this.mobs = specs.filter((s) => s.boss || s.dungeonBoss).map((s) => this.makeMob(s));
			this.dormant = specs.filter((s) => !s.boss && !s.dungeonBoss).map((s) => ({ spec: s, x: s.x, y: s.y, at: this.clock }));
			this.dormancyT = 0;
			this.populationMap = map;
			if (map === "world" && witch) this.mobs.push(witch);
		}
		this.restoreContract(map);
		save.map = map;
		this.syncSolids(map);
	}
	/**
	 * Overworld foes from spawn points and camps: 45% of the time one rolls a random kind of foe instead of
	 * the one its camp is set to, so the same few enemies do not repeat forever. Bosses, dungeons, rifts and
	 * Last Man Standing keep their set foes.
	 */
	rollOverworld(spec) {
		if (!spec || this.lms || spec.boss || spec.dungeonBoss || spec.bossId || spec.witch || spec.name) return spec;
		const map = this.save?.map ?? "";
		const file = map.startsWith("custom-") ? this.customFile : null;
		if (map !== "world" && !(file && (file.kind ?? "world") === "world")) return spec;
		// Start from the camp's own kind and element, even if the last body here was a random roll.
		const base = spec.baseSpecies ?? spec.species;
		const reset = spec.rolled || spec.typeRolled;
		const out = { ...spec, species: base, baseSpecies: base, rolled: false, typeRolled: false, type: reset ? undefined : spec.type, template: spec.rolled ? undefined : spec.template, animal: spec.rolled ? undefined : spec.animal };
		// 45%: a random kind of foe instead of the camp's set kind.
		if (Math.random() < OVERWORLD_RANDOM_FOE) {
			const pool = MONSTERS.filter((d) => d.id !== base);
			const def = pool[Math.floor(Math.random() * pool.length)];
			if (def) Object.assign(out, { species: def.id, type: undefined, template: undefined, animal: !!def.animal, rolled: true });
		}
		// 50%: a random element too. Its moves, its colours and the ghost it leaves all follow the new element.
		const def = MONSTER_BY_ID[out.species];
		if (def && !def.animal && !out.animal && Math.random() < OVERWORLD_RANDOM_ELEMENT) {
			const types = (Object.keys(TYPES) as TypeId[]).filter((t) => t !== def.type);
			const t = types[Math.floor(Math.random() * types.length)];
			if (t) Object.assign(out, { type: t, typeRolled: true });
		}
		return out;
	}
	makeMob(s) {
		let species = s.species ?? "onibi";
		// Last Man Standing: only ghosts walk. Beasts are swapped for a ghost of the same element.
		if (this.lms && ANIMAL_BY_ID[species] && !s.rivalBody) {
			const pool = MONSTERS.filter((d) => !d.animal);
			species = pool[Math.floor(Math.random() * pool.length)]?.id ?? "wisp";
			s = { ...s, species, animal: false, type: undefined, template: undefined, name: undefined };
		}
		const def = MONSTER_BY_ID[species] ?? ANIMAL_BY_ID[species] ?? MONSTER_BY_ID.onibi;
		const animal = !!(s.animal || def.animal);
		const spiritKind = def.type === "spirit" || def.template === 16 || def.template === 23;
		const ghost = !animal && (spiritKind || this.lms || Math.random() < 0.55);
		const hunter = Math.max(1, this.save?.level ?? s.level ?? 1);
		const hc = this.rules === "hardcore" ? this.threat().lv : 0;
		const near = this.rules === "hardcore" ? Math.max(hunter - 1, levelNearHunter(hunter, Math.random())) + hc : levelNearHunter(hunter, Math.random());
		const level = s.fixedLevel ? Math.max(1, Math.min(1000, s.level | 0)) : s.dungeonBoss ? Math.max(1, s.level) + hc : s.boss ? Math.max(s.level, hunter + 1 + (Math.random() * 4 | 0)) + hc : near;
		const rarity = s.dungeonBoss ? 0 : rarityForLevel(level, Math.random(), !!s.boss);
		const threat = this.threat();
		const max0 = animal ? Math.floor(14 + level * 7) : Math.floor((26 + level * 16) * (s.dungeonBoss ? 3.0 : s.boss ? 6.5 : 1) * (1 + rarity * 0.45));
		const max = Math.floor(max0 * threat.hp);
		const type = s.type || def.type;
		const moves = MOVES.filter((m) => m.type === type && m.effect !== "mend" && m.effect !== "shell" && !["dash", "surge", "heal", "ward"].includes(moveTactic(m)));
		const ranged = moves.filter((m) => attackForm(m) !== "melee");
		const spell = moves.filter((m) => attackForm(m) === "spell");
		const picked = animal ? "measured" : (ranged[rarity % Math.max(1, ranged.length)] ?? spell[0] ?? moves[0] ?? MOVES[0]).id;
		const lookRng = mulberry32(((s.x * 13 + s.y * 97 + level * 17 + rarity * 41 + Math.floor(Math.random() * 1e6)) >>> 0) || 1);
		const look = ghost ? rollGhostLook(lookRng, rarity, picked, s.boss ? "hunt" : undefined) : null;
		const speed = 8 + level + rarity * 4 + (look?.aggression === "hunt" ? 3 : 0) + (s.boss ? 6 : 0);
		// Every foe rolls its own stat line, enchantments and moves (balance.ts).
		const design = enemyDesignFor(species);
		const kind = animal ? "animal" : s.boss || s.dungeonBoss || design?.boss ? "boss" : "normal";
		const kit = rollEnemyKit(lookRng, { species, type: design?.type ?? type, kind, rarity, playerLevel: hunter, hardcore: this.rules === "hardcore", signature: animal ? undefined : picked, design: design ?? undefined });
		const mob = {
			id: s.id,
			species,
			name: s.name ?? (s.bossId ? bossName(s.bossId) : s.typeRolled && TYPES[type] ? `${TYPES[type].name} ${def.name}` : def.name),
			type,
			template: s.template ?? def.template,
			x: s.x,
			y: s.y,
			hp: max,
			max,
			level,
			boss: !!s.boss,
			dungeonBoss: !!s.dungeonBoss,
			bossId: s.bossId,
			homeX: s.x,
			homeY: s.y,
			cd: 0,
			hurt: 0,
			status: [],
			alive: true,
			respawn: 0,
			rarity,
			direction: "down",
			facing: 1,
			walk: Math.random() * 6,
			swing: 0,
			move: picked,
			animal,
			witch: false,
			race: null,
			lootGear: [],
			lootBag: {},
			lootKyo: 0,
			huntIn: 0,
			seen: false,
			ghost,
			look,
			speed,
			master: "",
			aggro: look?.aggression === "hunt",
			zone: s.zone ?? null,
			rolled: !!s.rolled,
			typeRolled: !!s.typeRolled,
			baseSpecies: s.baseSpecies,
			nightScaled: false,
			spawnLevel: level,
			kit: kit.moves,
			kcd: {},
			enchants: kit.enchants,
			stats: kit.stats,
			scaleT: 0,
			thornT: 0
		};
		if (design) {
			mob.type = design.type;
			mob.name = s.name ?? design.name;
			mob.move = kit.moves[0] ?? mob.move;
			mob.designId = design.id;
			mob.levelJitter = design.levelBonus;
			mob.lootMult = design.loot;
			mob.flee = design.behaviour === "flee";
			mob.drift = design.behaviour === "drift";
			mob.aggro = design.behaviour === "hunt" && !mob.flee;
			if (design.boss) mob.boss = true;
		}
		if (this.save) this.scaleMob(mob, true);
		return mob;
	}
	/** Re-rolls a foe's kit after it becomes a bounty, hunter, witch or minion. */
	rekitMob(m, extra = {}) {
		const rng = mulberry32(((Math.random() * 1e9) >>> 0) || 5);
		const design = !m.bounty && !m.hunter && !m.witch ? enemyDesignFor(m.species) : null;
		const kit = rollEnemyKit(rng, { species: m.species, type: m.type, kind: this.enemyKind(m), rarity: m.rarity, playerLevel: this.save?.level ?? 1, hardcore: this.rules === "hardcore", signature: m.move, design: design ?? undefined, ...extra });
		m.kit = kit.moves;
		m.kcd = {};
		m.enchants = kit.enchants;
		m.stats = kit.stats;
		this.scaleMob(m, true);
	}
	enemyKind(m) {
		if (m.bounty) return "bounty";
		if (m.hunter) return "hunter";
		if (m.witch) return "witch";
		if (m.boss || m.dungeonBoss) return "boss";
		if (m.bountySpirit || m.master) return "minion";
		if (m.animal) return "animal";
		return "normal";
	}
	/** Difficulty growth: Hardcore climbs with level, nights and bounty tier; Standard climbs toward double. */
	growth() {
		const save = this.save;
		if (!save) return 1;
		const tier = save.hunt?.tier ?? 0;
		return this.rules === "hardcore" ? hardcoreGrowth(save.level, save.dayNight?.nights ?? 0, tier) : standardGrowth(save.level, tier);
	}
	/** What the hunter can do right now: average hit, health and armor. */
	measurePlayer() {
		const save = this.save;
		const offense = this.arsenal(save).filter((m) => this.isOffense(m) && m.power > 0);
		let hit = 0;
		for (const m of offense.length ? offense : [MOVE_BY_ID.measured ?? MOVES[0]]) {
			const d = this.damageParts(m, null).dmg;
			if (d > hit) hit = d;
		}
		const crit = Math.min(1, Math.max(0, (offense[0]?.crit ?? 5) + this.chan("crit_edge") + this.mod("crit")) / 100);
		const dbl = Math.min(1, Math.max(0, this.chan("double_strike") / 100));
		hit *= (1 + dbl) * (1 + crit * .75);
		return { hit: Math.max(1, hit), maxHp: this.maxHp(), armor: this.playerArmor() };
	}
	/** Foes read a smoothed copy of the hunter's power. It rises in a minute or two and falls slowly. */
	refreshPower(dt) {
		this.powerT = (this.powerT ?? 0) - dt;
		if (this.powerRef && this.powerT > 0) return;
		const step = this.powerRef ? .5 - this.powerT : 0;
		this.powerT = .5;
		const now = this.measurePlayer();
		const hc = this.rules === "hardcore";
		if (!this.powerRef) this.powerRef = { ...now };
		else {
			this.powerRef.hit = adaptToward(this.powerRef.hit, now.hit, step, hc);
			this.powerRef.maxHp = adaptToward(this.powerRef.maxHp, now.maxHp, step, hc);
			this.powerRef.armor = adaptToward(Math.max(1, this.powerRef.armor), Math.max(1, now.armor), step, hc);
		}
	}
	/**
	 * Bosses, witches, bounties, hunters, shrine saints and every foe inside a dungeon
	 * do not shrink to a naked hunter. The open world does.
	 */
	dangerousFoe(m, kind) {
		if (!m) return false;
		if (kind === "boss" || kind === "witch" || kind === "bounty" || kind === "hunter") return true;
		if (m.dungeonBoss) return true;
		if (typeof m.id === "string" && m.id.startsWith("shrine")) return true;
		const map = this.save?.map ?? "";
		if (this.isDungeonMap(map)) return true;
		return false;
	}
	/**
	 * Resizes a live foe to the hunter: never below your level, health measured in your hits,
	 * damage measured in your health. Keeps the foe's health fraction.
	 * Ordinary foes copy less of your level as you climb. Dangerous ones read the better of
	 * your real power and a decent kit for your level, then add dungeon and shrine pressure.
	 */
	scaleMob(m, fresh = false) {
		const save = this.save;
		if (!save || !m) return;
		if (m.rival) return this.scaleRival(m, fresh);
		if (m.twitch && this.scaleTwitch) return this.scaleTwitch(m, fresh);
		if (!this.powerRef) this.refreshPower(0);
		const kind = this.enemyKind(m);
		const hc = this.rules === "hardcore";
		const t = enemyTargets({ kind, rarity: m.rarity, hardcore: hc, growth: this.growth(), tier: m.tier ?? 0, wanted: m.wanted ?? 1 });
		const stats = m.stats ?? { hp: 1, dmg: 1, speed: 1, crit: .03, dodge: 0, physRes: 0, spellRes: 0 };
		const level = Math.max(m.spawnLevel ?? 1, save.level + t.levelOffset + (m.levelJitter ?? 0));
		const dangerous = this.dangerousFoe(m, kind);
		const inDungeon = this.isDungeonMap(save.map);
		const shrineRound = typeof m.id === "string" && m.id.startsWith("shrine") ? (this.shrine?.round ?? 1) : 0;
		const edge = openWorldLevelEdge(save.level) * (dangerous ? 0.4 : 1);
		const liveHit = Math.max(1, this.powerRef.hit);
		const liveHp = Math.max(1, this.powerRef.maxHp);
		let hitRef = liveHit;
		let hpRef = liveHp;
		let dangerDmg = 1;
		if (dangerous) {
			const exp = expectedHunterPower(save.level);
			hitRef = Math.max(liveHit, exp.hit);
			hpRef = Math.max(liveHp, exp.maxHp);
			const armor = Math.max(0, this.powerRef.armor ?? 0);
			if (armor < exp.armor) dangerDmg *= 1 + ((exp.armor - armor) / exp.armor) * 0.35;
		}
		hitRef *= 1 - edge;
		hpRef *= 1 - edge;
		const floorHp = (20 + level * 8) * (kind === "boss" ? 2.5 : kind === "bounty" || kind === "witch" ? 2.5 : kind === "hunter" ? 1.5 : 1) * (kind === "animal" ? .45 : 1);
		const party = m.party ? .55 : m.summoner ? .7 : 1;
		// Each shrine round is louder. The last round is already a boss, so it gets a smaller extra pile of health and a harder hit.
		const shrineHp = shrineRound ? (kind === "boss" ? 1.2 : 1.15 + shrineRound * 0.35) : 1;
		const shrineDmg = shrineRound ? 1.1 + shrineRound * 0.12 : 1;
		// Dungeon rooms stack: trash is chunkier than the road, and the boss at the end is chunkier than a world boss.
		const dungeonHp = inDungeon ? (m.dungeonBoss || kind === "boss" ? 1.35 : 1.4) : 1;
		const dungeonDmg = inDungeon ? (m.dungeonBoss || kind === "boss" ? 1.18 : 1.12) : 1;
		const base = Math.max(floorHp, hitRef * t.hits) * stats.hp * party * shrineHp * dungeonHp;
		const bountyRage = m.enraged && (m.bounty || m.bountySpirit);
		const mult = (this.isNightNow() ? NIGHT.strength : 1) * (m.enraged ? 2 : 1) * (bountyRage ? BOUNTY_ENRAGE.hp : 1);
		const max = Math.max(1, Math.floor(base * mult));
		const ratio = fresh || !(m.max > 0) ? 1 : Math.max(0, Math.min(1, m.hp / m.max));
		m.level = level;
		m.max = max;
		m.hp = m.alive === false ? 0 : Math.max(1, Math.ceil(max * ratio));
		m.baseMax = Math.floor(base);
		const bite = t.frac * party * shrineDmg * dungeonDmg * dangerDmg;
		// foeHitRaw multiplies by the live health reference. Dangerous blows are sized off the
		// geared-or-better pool, so an undergeared hunter loses a bigger share of her real bar.
		m.frac = dangerous ? (hpRef * bite) / liveHp : bite * (1 - edge);
		m.nightScaled = this.isNightNow();
		m.speed = Math.max(1, Math.round((this.playerSpeed() + t.speedOffset) * stats.speed * (m.enraged ? 1.25 : 1) * (bountyRage ? BOUNTY_ENRAGE.speed : 1)));
	}
	step(dt) {
		if (!this.save || snap.mode !== "play" || this.dead) {
			this.vx = 0;
			this.vy = 0;
			return;
		}
		if (document.hidden) return;
		// Autosave every few seconds of play, so walking, gathering and skill XP are never more than that behind.
		this.autoSaveT = (this.autoSaveT ?? AUTOSAVE_SECONDS) - dt;
		if (this.autoSaveT <= 0) { this.autoSaveT = AUTOSAVE_SECONDS; this.persist(); }
		// A bounty's loot menu stops the world until you pick a piece.
		if (snap.panel === "loot") {
			this.vx = 0;
			this.vy = 0;
			return;
		}
		if (this.role !== "guest") this.tickContract(dt);
		this.tickUnstuck(dt);
		if (snap.panel === "pause" || snap.panel === "death" || this.dead) {
			this.vx = 0;
			this.vy = 0;
			if (this.unstuckT > 0 || this.liveBounty()) this.syncHud(false);
			return;
		}
		if (this.role !== "guest" && !this.lms) this.tickDungeons(dt);
		this.tickPlayer(dt);
		if (this.dead) return;
		this.gim?.tick(dt);
		if (this.save) this.save.lifeT = (this.save.lifeT ?? 0) + dt;
		this.tickDayNight(dt);
		this.tickMapQuests(dt);
		if (this.role !== "guest") {
			this.tickMobs(dt);
			this.enforceSafeZones();
		} else this.tickGuestHurt(dt);
		this.tickSpirits(dt);
		this.tickGhostCombat(dt);
		this.tickGhostAbilities(dt);
		this.tickPotions(dt);
		this.tickGhostTasks(dt);
		this.tickTurns(dt);
		if (this.rules === "hardcore" && !this.dead && !this.turbz) this.tickSurvival(dt);
		if (this.turbz) { this.tickPools?.(dt); this.tickTurbz?.(dt); }
		this.tickParty(dt);
		this.tickChests(dt);
		this.tickWildGhosts(dt);
		this.tickLater(dt);
		this.tickFx(dt);
		this.syncHud(false);
	}
	// ---------- Daily dungeon layouts ----------
	/**
	 * The in-game day. Hardcore counts finished nights on its day/night clock; Standard has no night, so it
	 * keeps its own 25 minute day counter on the dungeon state. Every dungeon, rift and the Crypt and Kiln
	 * are generated from this number, so they all have a new layout and new foes each day.
	 */
	gameDay() {
		const save = this.save;
		if (!save) return 0;
		if (this.nightOn()) return save.dayNight?.nights ?? 0;
		return save.dungeons?.day ?? 0;
	}
	isDungeonMap(map) {
		return map === "crypt" || map === "kiln" || (typeof map === "string" && map.startsWith("rift-"));
	}
	/** The day a dungeon's layout was built for. It is fixed while you are inside, so the walls never move around you. */
	dungeonDay(map) {
		const d = this.save?.dungeons;
		return d?.stamps?.[map] ?? this.gameDay();
	}
	/**
	 * Called on the way in: pins the dungeon to today's layout. A rift or Crypt last built on an earlier day is
	 * rebuilt (new rooms, new foes, nobody defeated), so a returning hunter always meets a fresh dungeon.
	 */
	stampDungeonDay(map) {
		const d = this.save?.dungeons;
		if (!d || !this.isDungeonMap(map)) return;
		const day = this.gameDay();
		if (map.startsWith("rift-")) {
			const portal = d.portals.find((p) => p.id === map);
			if (portal && portal.day !== day) { portal.day = day; portal.defeated = []; }
		} else {
			d.stamps = d.stamps ?? {};
			d.stamps[map] = day;
		}
	}
	/** A rift's rooms and foes for the day it was stamped with. Rifts from before daily layouts keep their first layout. */
	riftWorld(portal: DungeonPortal) {
		const seed = portal.day === undefined ? portal.seed : dungeonSeed(portal.seed, portal.day, 0);
		return generateDungeon({ kind: "rift", seed, level: portal.level, day: portal.day, idPrefix: `d-${portal.seed}-${portal.day ?? 0}` });
	}
	tickDungeons(dt) {
		const save = this.save;
		if (!save?.dungeons) return;
		if (!this.nightOn()) advanceDungeonDay(save.dungeons, dt);
		const today = this.gameDay();
		if (save.dungeons.seenDay === undefined) save.dungeons.seenDay = today;
		else if (save.dungeons.seenDay !== today) {
			save.dungeons.seenDay = today;
			this.say(this.isDungeonMap(save.map) ? "A new day dawns. The dungeons will reshape themselves once you leave." : "A new day dawns. The Crypt, the Kiln and every open rift have reshaped themselves.");
			this.persist();
		}
		const before = save.dungeons.elapsed;
		if (!advanceDungeonClock(save.dungeons, this.turbz ? dt * 2.5 : dt)) {
			if (Math.floor(before / 30) !== Math.floor(save.dungeons.elapsed / 30)) this.persist();
			return;
		}
		const state = save.dungeons;
		const world = this.turbz && this.turbzWorld ? this.turbzWorld : (this.overworld ?? this.world);
		const anchor = (save.map === "world" || (this.turbz && save.map === "custom-turbz")) ? save : (this.turbz ? { x: world.w * 16, y: world.h * 16 } : hearthXY());
		const rng = mulberry32(save.seed ^ state.sequence * 7919);
		const spread = this.turbz ? 2400 : 600;
		const at = nearestOpen(world, anchor.x + (rng() - .5) * spread, anchor.y + (rng() - .5) * spread);
		state.portals.push({ id: `rift-${state.sequence}`, seed: (save.seed ^ state.sequence * 104729) >>> 0, level: save.level, x: at.x, y: at.y, cleared: false, defeated: [] });
		this.say(`Dungeon ${state.sequence} has opened. Find its rift on the world map.`);
		this.room?.send({ t: "dungeons", dungeons: state });
		this.persist(); this.syncHud(true);
	}
	dungeonExitAt() { return this.world?.entry ?? dungeonExit(); }
	trackRift(id) {
		const portal = this.save?.dungeons?.portals.find(p => p.id === id && !p.cleared);
		if (!portal || (this.save.map !== "world" && this.save.map !== "custom-turbz")) return;
		if (Math.hypot(portal.x - this.save.x, portal.y - this.save.y) <= 120) { this.closePanel(); this.enterRift(id); }
		else { this.closePanel(); this.walkTo(portal.x, portal.y); this.say("Tracking the dungeon rift. Interact at its entrance."); }
	}
	enterRift(id) {
		const portal = this.save?.dungeons?.portals.find(p => p.id === id);
		if (!portal || portal.cleared || (this.save.map !== "world" && this.save.map !== "custom-turbz") || Math.hypot(portal.x - this.save.x, portal.y - this.save.y) > 120) return false;
		this.stampDungeonDay(id);
		const dungeon = this.riftWorld(portal);
		this.travel(id, dungeon.entry); return true;
	}
	// ---------- Day and night (Hardcore only) ----------
	nightOn() {
		return this.rules === "hardcore" || NIGHT_IN_STANDARD_MODE;
	}
	isNightNow() {
		const s = this.save?.dayNight;
		return !!s && this.nightOn() && isNight(s);
	}
	clockInfo() {
		const s = this.save?.dayNight;
		if (!s || !this.nightOn()) return { phase: "day", label: "Day", left: "", dark: 0, active: false };
		return { ...clockLabel(s), dark: darkness(s), active: true };
	}
	tickDayNight(dt) {
		const save = this.save;
		if (!save || !this.nightOn()) return;
		if (this.lms) { this.tickLms(dt); return; }
		save.dayNight = save.dayNight ?? freshDayNight();
		const s = save.dayNight;
		const before = s.t;
		const sleptNight = this.sleeping && isNight(s);
		const flip = advanceDayNight(s, dt * skipRate(s, this.sleeping));
		if (flip === "dawn") this.regrowNodes(sleptNight ? "sleep" : "day");
		if (flip === "dusk") {
			this.say(`Night falls. Foes are ${NIGHT.strength}x as strong, but give ${NIGHT.xp}x experience.`);
			this.cue("boom", { rate: 0.65, vol: 0.32 }, [110, .3, "sine"]);
		} else if (flip === "dawn") {
			if (this.rules === "hardcore") this.gainSkill("survival", 40);
			if (sleptNight) {
				this.sleeping = false;
				if (save.survival) save.survival.rest = 100;
				this.say("You slept through the night and wake at dawn.");
			} else this.say("Dawn breaks. Foes weaken again.");
			this.cue("swell", { rate: 1.25, len: 1.8 }, [520, .2, "triangle"]);
		}
		if (flip || Math.floor(before / 30) !== Math.floor(s.t / 30)) { this.persist(); this.syncHud(true); }
	}
	/** Keeps a foe's health in step with the clock: doubled at night, restored at dawn. */
	applyNightScaling(m) {
		const want = this.isNightNow();
		if (want && !m.nightScaled) {
			m.hp = Math.ceil(m.hp * NIGHT.strength);
			m.max = Math.ceil(m.max * NIGHT.strength);
			m.nightScaled = true;
		} else if (!want && m.nightScaled) {
			m.max = Math.max(1, Math.round(m.max / NIGHT.strength));
			m.hp = Math.max(m.alive ? 1 : 0, Math.min(m.max, Math.ceil(m.hp / NIGHT.strength)));
			m.nightScaled = false;
		}
	}
	// ---------- Log building and the campfire safe zone (Hardcore) ----------
	buildOn() {
		return this.rules === "hardcore" && !!this.save?.survival;
	}
	syncSolids(map) {
		if (!this.world) return;
		this.world.solids = this.buildOn() ? solidsFor(this.save.survival.logs, map ?? this.save.map, this.world.w) : undefined;
	}
	/** Picks what build mode places: a wooden or brick wall, a bed, or the Ghost Box. */
	setBuildPiece(piece) {
		if (!BUILD_PIECES[piece]) return;
		this.buildPiece = piece;
		if (this.buildOn() && !this.dead) {
			this.buildMode = true;
			this.dest = null;
			const def = BUILD_PIECES[piece];
			this.say(`Building ${def.name} (${this.costLine(def.cost)}). Click a tile to place it; click a placed piece to pick it up. F or Esc to stop.`);
		}
		this.syncHud(true);
	}
	costLine(cost) {
		return costText(cost, Object.fromEntries(Object.keys(cost).map((id) => [id, ITEM_BY_ID[id]?.name ?? id])));
	}
	toggleBuild(force?: boolean) {
		if (!this.buildOn() || this.dead) return;
		this.buildMode = typeof force === "boolean" ? force : !this.buildMode;
		this.dest = null;
		const def = BUILD_PIECES[this.buildPiece ?? "wood"] ?? BUILD_PIECES.wood;
		this.say(this.buildMode ? `Build mode: ${def.name} (${this.costLine(def.cost)}). Click a tile to place it. Click a placed piece to pick it up. F or Esc to stop.` : "Build mode off.");
		this.syncHud(true);
	}
	buildAt(x, y) {
		const save = this.save;
		if (!this.buildOn() || !this.world) return;
		const { tx, ty } = tileAt(x, y);
		const placed = save.survival.logs.find((l) => l.map === save.map && l.tx === tx && l.ty === ty);
		if (placed) return this.removeLog(placed);
		const bed = save.survival.beds.find((b) => b.map === save.map && b.tx === tx && b.ty === ty);
		if (bed) return this.removeFurniture("bed", bed);
		const box = save.ghostBox;
		if (box && box.map === save.map && box.tx === tx && box.ty === ty) return this.removeFurniture("ghostbox", box);
		const piece = this.buildPiece ?? "wood";
		if (piece === "bed" || piece === "ghostbox") return this.placeFurniture(piece, tx, ty);
		return this.placeLog(tx, ty, piece);
	}
	/** Shared placement rules for every camp piece. */
	checkPiece(piece, tx, ty) {
		const save = this.save;
		const sv = save.survival;
		const furniture = [...sv.beds, ...(save.ghostBox ? [save.ghostBox] : [])];
		return checkPlaceLog({
			world: this.world, map: save.map, logs: sv.logs, camps: sv.campfires, tx, ty, player: save, bag: save.bag,
			terrainBlocked: (px, py) => blocked(this.world, px, py),
			keepClear: this.mobs.filter((m) => m.alive).map((m) => ({ x: m.x, y: m.y })),
			cost: BUILD_PIECES[piece].cost,
			furniture,
			needZone: piece === "bed" || piece === "ghostbox",
		});
	}
	/** Spends a piece's materials. The Building skill may hand one back. */
	payForPiece(piece, xp) {
		const save = this.save;
		const cost = BUILD_PIECES[piece].cost;
		consumeMaterials(save.bag, cost);
		this.gainSkill("building", xp);
		for (let r = procs(this.skillN("building") * 0.25); r > 0; r--) {
			const ids = Object.keys(cost);
			const id = ids[Math.floor(Math.random() * ids.length)];
			if (id) { this.giveItem(id, 1); this.float(save.x, save.y - 52 - r * 8, `+1 ${ITEM_BY_ID[id]?.name ?? id}`, "#e6c15a"); }
		}
	}
	placeLog(tx, ty, piece = "wood") {
		const save = this.save;
		if (save.survival.logs.length >= MAX_LOG_TILES) { this.say("You have placed the most walls the frontier can hold. Pick some up."); return false; }
		const check = this.checkPiece(piece, tx, ty);
		if (!check.ok) { this.say(check.reason); return false; }
		this.payForPiece(piece, piece === "brick" ? 8 : 6);
		save.survival.logs.push({ map: save.map, tx, ty, kind: piece === "brick" ? "brick" : "wood" });
		this.world.solids = this.world.solids ?? new Set();
		this.world.solids.add(ty * this.world.w + tx);
		this.cue("click", { rate: piece === "brick" ? 0.8 : 1 }, [piece === "brick" ? 150 : 190, .05, "square"]);
		this.persist();
		this.syncHud(true);
		return true;
	}
	removeLog(l) {
		const save = this.save;
		if (Math.hypot(l.tx * 32 + 16 - save.x, l.ty * 32 + 16 - save.y) > BUILD_REACH) { this.say("Too far away to pick that up."); return false; }
		save.survival.logs = save.survival.logs.filter((x) => x !== l);
		this.world.solids?.delete(l.ty * this.world.w + l.tx);
		// Old saves placed bare logs (one log each); new walls refund what they cost.
		const cost = l.kind === "brick" ? BUILD_PIECES.brick.cost : l.kind === "wood" ? BUILD_PIECES.wood.cost : { timber: 1 };
		for (const [id, n] of Object.entries(cost)) this.giveItem(id, n);
		this.cue("click", { rate: 0.75 }, [150, .05, "triangle"]);
		this.persist();
		this.syncHud(true);
		return true;
	}
	placeFurniture(piece, tx, ty) {
		const save = this.save;
		if (piece === "bed" && save.survival.beds.length >= MAX_BEDS) { this.say(`${MAX_BEDS} beds is the most a hunter can keep. Pick one up first.`); return false; }
		if (piece === "ghostbox" && save.ghostBox) { this.say("You already have a Ghost Box. Click it in build mode to pick it up and move it."); return false; }
		if (piece === "ghostbox" && save.map !== "world") { this.say("Place the Ghost Box at a camp in the overworld."); return false; }
		const check = this.checkPiece(piece, tx, ty);
		if (!check.ok) { this.say(check.reason); return false; }
		this.payForPiece(piece, piece === "ghostbox" ? 20 : 12);
		if (piece === "bed") {
			save.survival.beds.push({ map: save.map, tx, ty });
			this.say(`Bed built (${save.survival.beds.filter((b) => b.map === save.map).length} here). Send followers home from Survival & Camp.`);
		} else {
			save.ghostBox = { map: save.map, tx, ty };
			this.say(`Ghost Box placed. Stand by it and open Spirits (G) to store, swap and release ghosts. ${save.ghostStore?.length ?? 0} wait inside.`);
		}
		this.cue("click", { rate: 1.2 }, [260, .08, "triangle"]);
		this.persist();
		this.syncHud(true);
		return true;
	}
	removeFurniture(piece, f) {
		const save = this.save;
		if (Math.hypot(f.tx * 32 + 16 - save.x, f.ty * 32 + 16 - save.y) > BUILD_REACH) { this.say("Too far away to pick that up."); return false; }
		if (piece === "bed") save.survival.beds = save.survival.beds.filter((b) => b !== f);
		else {
			save.ghostBox = null;
			this.say(`Ghost Box packed up. The ${save.ghostStore?.length ?? 0} ghosts inside are safe; place it again to reach them.`);
		}
		for (const [id, n] of Object.entries(BUILD_PIECES[piece].cost)) this.giveItem(id, n);
		this.cue("click", { rate: 0.75 }, [150, .05, "triangle"]);
		this.persist();
		this.syncHud(true);
		return true;
	}
	/** The campfire whose 15x15 safe zone the player is standing in, if any. */
	playerSafeCamp() {
		const s = this.save;
		if (this.rules !== "hardcore" || !s?.survival) return null;
		return safeZoneAt(s.survival.campfires, s.map, s.x, s.y);
	}
	/** Foes cannot enter a safe zone: anything inside is pushed back out to its edge. */
	enforceSafeZones() {
		const save = this.save;
		if (this.rules !== "hardcore" || !save?.survival?.campfires.length) return;
		const camps = save.survival.campfires.filter((c) => c.map === save.map);
		if (!camps.length) return;
		for (const m of this.mobs) {
			if (!m.alive) continue;
			const c = safeZoneAt(camps, save.map, m.x, m.y);
			if (!c) continue;
			const p = pushOut(c, m.x, m.y);
			m.x = p.x;
			m.y = p.y;
		}
	}
	/** Followers were sent home to their beds (they stay there whichever map you are on). */
	holdActive() {
		const h = this.save?.survival?.hold;
		const s = this.save;
		return !!h && this.rules === "hardcore" && s.survival.campfires.some((c) => c.map === h.map && c.x === h.x && c.y === h.y);
	}
	/** Followers are home and that home is on this map. */
	holdHere() {
		return this.holdActive() && this.save.survival.hold.map === this.save.map;
	}
	/** Beds inside the safe zone of the camp followers are sent to. */
	homeBeds() {
		const h = this.save?.survival?.hold;
		if (!h) return [];
		return (this.save.survival.beds ?? []).filter((b) => b.map === h.map && safeZoneAt([{ map: h.map, x: h.x, y: h.y }], h.map, b.tx * 32 + 16, b.ty * 32 + 16));
	}
	/** Where follower `k` rests: its own bed, or a shared one when there are more followers than beds. */
	bedSpot(k) {
		const beds = this.homeBeds();
		const h = this.save.survival.hold;
		if (!beds.length) return { x: h.x + Math.cos(k * 2.1) * 36, y: h.y + 18 + Math.sin(k * 2.1) * 14 };
		const b = beds[k % beds.length];
		const share = Math.floor(k / beds.length);
		return { x: b.tx * 32 + 16 + share * 10, y: b.ty * 32 + 14 - share * 4 };
	}
	followerCount() {
		return (this.activeSpirits?.()?.length ?? 0) + (this.save?.party?.length ?? 0);
	}
	/** Send followers home to the beds at the camp you are in (or beside), or call them back. */
	holdFollowers(on) {
		const save = this.save;
		if (!save || this.rules !== "hardcore" || this.dead) return;
		if (!on) {
			save.survival.hold = null;
			this.say("Your followers leave their beds and rejoin you.");
		} else {
			let camp = this.playerSafeCamp();
			if (!camp) {
				let bd = SAFE_ZONE_TILES * 32;
				for (const c of save.survival.campfires) {
					if (c.map !== save.map) continue;
					const d = Math.hypot(c.x - save.x, c.y - save.y);
					if (d < bd) { bd = d; camp = c; }
				}
			}
			if (!camp) return this.say("Stand in a camp to send followers home.");
			const beds = (save.survival.beds ?? []).filter((b) => b.map === camp.map && safeZoneAt([camp], camp.map, b.tx * 32 + 16, b.ty * 32 + 16));
			if (!beds.length) return this.say(`Build a bed in this camp first (${this.costLine(BUILD_PIECES.bed.cost)}). Followers you send home rest in beds.`);
			if (!this.followerCount()) return this.say("You have no followers to send.");
			save.survival.hold = { map: save.map, x: camp.x, y: camp.y };
			const n = this.followerCount();
			this.say(`Your followers go to bed at this camp (${n} follower${n === 1 ? "" : "s"}, ${beds.length} bed${beds.length === 1 ? "" : "s"}). Nothing can reach them there. They stay until you call them back.`);
		}
		this.persist();
		this.syncHud(true);
	}
	buildInfo() {
		const save = this.save;
		const sv = save?.survival;
		return {
			on: !!this.buildMode && this.buildOn(),
			logs: save?.bag?.timber ?? 0,
			placed: sv ? sv.logs.filter((l) => l.map === save.map).length : 0,
			inZone: !!this.playerSafeCamp(),
			holding: this.holdActive(),
			piece: this.buildPiece ?? "wood",
			beds: sv ? sv.beds.length : 0,
			ghostBox: save?.ghostBox ? true : false,
		};
	}
	// ---------- Timed effects so damage lands when the FX lands ----------
	/** Plays a verse's FX and returns the seconds until it visually lands. */
	playMoveFx(move, x0, y0, x1, y1, opts = {}) {
		this.cfx = this.cfx ?? new CombatFx();
		if (this.castImbue && !opts.imbue) opts = { ...opts, imbue: this.castImbue };
		return this.cfx.cast(move, attackForm(move), moveTactic(move), x0, y0, x1, y1, opts);
	}
	/** Runs fn after `delay` seconds of game time (frozen while paused, dropped if the map changes). */
	later(delay, fn) {
		if (!(delay > 0.001)) { fn(); return; }
		this.timers = this.timers ?? [];
		this.timers.push({ t: delay, fn, map: this.save?.map });
	}
	tickLater(dt) {
		if (!this.timers?.length) return;
		const keep = [];
		const due = [];
		for (const e of this.timers) { e.t -= dt; (e.t <= 0 ? due : keep).push(e); }
		this.timers = keep;
		for (const e of due) if (!this.dead && e.map === this.save?.map) e.fn();
	}
	/**
	 * Fires a verse at a foe. Accuracy is rolled now so the FX can show it: a hit chases the foe and
	 * lands on it, a miss flies past it. Damage and floaters happen when the FX arrives. If the foe is
	 * already gone by then, the shot simply lands on empty ground.
	 */
	strike(move, ox, oy, mob, { fromPet = false, mult = 1, volley = false, pet = null, meleePlan = null, spellPlan = null } = {}) {
		const missed = Math.random() * 100 > move.accuracy;
		const sx = Math.random() < .5 ? -1 : 1;
		const off = missed ? { x: sx * (34 + Math.random() * 18), y: (Math.random() - .5) * 28 } : { x: 0, y: 0 };
		const follow = () => (mob.alive ? [mob.x + off.x, mob.y - 12 + off.y] : null);
		const delay = this.playMoveFx(move, ox, oy, mob.x + off.x, mob.y - 12 + off.y, { follow, miss: missed, volley });
		const depth = !fromPet && !!(meleePlan || spellPlan);
		this.later(delay, () => {
			const at = { x: mob.x, y: mob.y };
			if (mob.alive) this.resolveHit(move, mob, fromPet, mult, { missed, stagger: volley ? VOLLEY_GAP : 0, pet, depth, meleePlan, spellPlan });
			this.verseExtras(move, mob, at, { x: ox, y: oy + 24 }, { fromPet, mult, pet, missed });
		});
		return delay;
	}
	/**
	 * What some verses do beyond the one foe they hit: splash the foes beside it, ring out round the caster
	 * (nova), leap from foe to foe (chain), or come back for a second cut (boomerang echo).
	 */
	verseExtras(move, mob, at, from, { fromPet = false, mult = 1, pet = null, missed = false } = {}) {
		if (this.role === "guest") return;
		// Wide Arc (gear and perks) adds to every extra hit.
		mult *= 1 + Math.max(0, this.chan("area_power")) / 100;
		if (move.nova) {
			for (const m of this.foesNear(from.x, from.y, move.nova)) if (m !== mob) this.resolveHit(move, m, fromPet, mult * 0.85, { pet });
		}
		if (missed) return;
		if (move.splash) {
			for (const m of this.foesNear(at.x, at.y, move.splash.radius)) if (m !== mob) this.resolveHit(move, m, fromPet, mult * move.splash.mult, { pet });
		}
		if (move.multi && !fromPet) {
			const extra = mult * move.multi.mult * (1 + Math.max(0, this.chan("combo_core")) / 100);
			for (let i = 1; i < move.multi.hits; i++) this.later(move.multi.gap * i, () => {
				if (!mob.alive) return;
				this.cfx?.mote(mob.x, mob.y - 14, TYPES[move.type]?.color ?? "#fff1a8", move.type, 30, 0.35, "spark");
				this.resolveHit(move, mob, fromPet, extra, { pet, child: true });
			});
		}
		if (move.selfBuff && !fromPet && move.selfBuff !== "none") this.addStatus(move.selfBuff, 4);
		if (move.echo) this.later(0.36, () => { if (mob.alive) this.resolveHit(move, mob, fromPet, mult * move.echo, { pet }); });
		if (move.chain) {
			const hit = new Set([mob]);
			let prev = at, k = mult;
			for (let i = 0; i < move.chain.jumps; i++) {
				const next = this.foesNear(prev.x, prev.y, move.chain.range).filter((m) => !hit.has(m)).sort((a, b) => Math.hypot(a.x - prev.x, a.y - prev.y) - Math.hypot(b.x - prev.x, b.y - prev.y))[0];
				if (!next) break;
				hit.add(next);
				k *= move.chain.mult;
				const p0 = prev, kk = k, delay = 0.12 * (i + 1);
				this.cfx?.link(p0.x, p0.y - 12, next.x, next.y - 12, move.type, delay - 0.08);
				this.later(delay, () => { if (next.alive) this.resolveHit(move, next, fromPet, kk, { pet }); });
				prev = { x: next.x, y: next.y };
			}
		}
	}
	nearCamp() {
		const save = this.save;
		return !!save?.survival?.campfires.some(c => c.map === save.map && Math.hypot(c.x - save.x, c.y - save.y) <= 80);
	}
	/** The bed you stand on or beside (Hardcore), or null. */
	bedNear(reach = BED_REACH) {
		const save = this.save;
		let best = null, bd = reach;
		for (const b of save?.survival?.beds ?? []) {
			if (b.map !== save.map) continue;
			const d = Math.hypot(b.tx * 32 + 16 - save.x, b.ty * 32 + 16 - save.y);
			if (d <= bd) { bd = d; best = b; }
		}
		return best;
	}
	/** Sleep in a bed, or by a campfire. */
	canSleepHere() {
		const bed = this.sleepBed && (this.save?.survival?.beds ?? []).includes(this.sleepBed) ? this.sleepBed : null;
		return !!bed || !!this.bedNear() || this.nearCamp();
	}
	/** Lie down: in a bed when one is close (you climb in), otherwise by the fire. */
	goToSleep(bed = null) {
		const save = this.save;
		if (!save || this.rules !== "hardcore" || this.dead || this.sleeping) return;
		bed = bed ?? this.bedNear();
		if (!bed && !this.nearCamp()) return this.say("Build a bed or a campfire to sleep.");
		if (this.inFight() || this.combat > 0) return this.say("Clear nearby enemies before sleeping.");
		if (this.autoplay) this.resumeAuto = true;
		this.dest = null; this.path = []; this.pathI = 0; this.pendingBed = null;
		this.sleeping = true; this.autoplay = false; this.channel = null; this.closePanel();
		this.sleepBed = bed ?? null;
		this.zT = 0;
		if (bed) {
			save.x = bed.tx * 32 + 16;
			save.y = bed.ty * 32 + 20;
			this.say(this.isNightNow() ? "You climb into your bed. You will wake at dawn, rested half again as fast. Food and water still drain." : "You climb into your bed. Rest comes half again as fast. Food and water still drain.");
		} else this.say(this.isNightNow() ? "Sleeping by the fire. You will wake at dawn. Food and water still drain." : "Sleeping by the fire. Food and water still drain.");
		this.syncHud(true);
	}
	wakeUp() {
		this.sleeping = false;
		this.sleepBed = null;
		if (this.resumeAuto) {
			this.resumeAuto = false;
			this.autoplay = true;
			this.grind = "looking";
			this.say("Rested. Autoplay continues.");
		}
		this.syncHud(true);
	}
	tickSurvival(dt) {
		const s = this.save.survival, before = s.elapsed;
		if (this.sleeping && (!this.canSleepHere() || this.combat > 0 || this.inFight())) this.wakeUp();
		if (!this.sleeping) this.sleepBed = null;
		if (this.sleeping) {
			this.zT = (this.zT ?? 0) - dt;
			if (this.zT <= 0) { this.zT = 1.3; this.float(this.save.x + 8, this.save.y - 40, "z", "#c8beff"); }
		}
		// Pending walk to a clicked bed: climb in on arrival.
		if (!this.sleeping && this.pendingBed) {
			const b = this.pendingBed;
			if (b.map !== this.save.map || !s.beds.includes(b)) this.pendingBed = null;
			else if (Math.hypot(b.tx * 32 + 16 - this.save.x, b.ty * 32 + 16 - this.save.y) <= BED_REACH) this.goToSleep(b);
		}
		const damage = advanceSurvival(s, dt, this.sleeping, rateMult(this.skillN("survival") * 0.4), this.sleepBed ? BED_REST : 1);
		if (damage > 0) {
			this.lastHit = { by: s.hunger <= 0 ? "hunger" : s.thirst <= 0 ? "thirst" : "exhaustion", survival: true, t: this.clock };
			this.save.hp -= damage;
			if (this.save.hp <= 0) this.die();
		}
		if (this.sleeping && s.rest >= 100 && (!this.isNightNow() || this.lms)) { this.wakeUp(); this.gainSkill("survival", 15); this.say("Rested. Sleep does not mend wounds: use a healing spell, potion or meal."); this.regrowNodes("sleep"); }
		if (Math.floor(before / 10) !== Math.floor(s.elapsed / 10)) this.persist();
	}
	survivalAction(action) {
		const save = this.save;
		if (!save || this.rules !== "hardcore" || this.dead) return;
		if (action === "fire") {
			if (this.nearCamp()) return this.say("A campfire is already nearby.");
			if (blocked(this.world, save.x, save.y)) return;
			if (!consumeMaterials(save.bag, { timber: 3 })) return this.say("Chop trees for 3 logs first.");
			save.survival.campfires.push({ map: save.map, x: save.x, y: save.y });
			save.survival.campfires = save.survival.campfires.slice(-100);
			this.gainSkill("survival", 12);
			this.say("Campfire built. Each cook or boil uses another log.");
		} else if (action === "water") {
			if (this.channel) return;
			if (!waterWithinReach(this.world, save.x, save.y)) return this.say("Stand beside a water tile to collect water.");
			this.channel = { kind: "water", t: 0, need: 2 }; this.say("Collecting water...");
		} else if (action === "chop") {
			if (this.channel) return;
			const tree = this.nodeNear("tree", 64);
			if (!tree) return this.say("Stand beside a tree resource to chop logs.");
			this.startNode(tree.id, "tree");
		} else if (action === "sleep") {
			if (this.sleeping) this.wakeUp();
			else this.goToSleep();
		} else {
			// Anything else is a campfire recipe from CAMP_RECIPE_LIST (src/game/survival.ts).
			const recipe = CAMP_RECIPES[action];
			if (!recipe) return;
			if (!this.nearCamp()) return this.say("Stand by a campfire to craft.");
			const made = craftAtCamp(save.bag, action, true);
			if (!made) {
				const missing = Object.entries(recipe.costs).filter(([id, n]) => (save.bag[id] ?? 0) < n).map(([id, n]) => `${n - (save.bag[id] ?? 0)} ${ITEM_BY_ID[id]?.name ?? id}`);
				return this.say(`Missing: ${missing.join(", ")}.`);
			}
			if (made.skill) this.gainSkill(made.skill.id, made.skill.xp);
			const extra = made.skill?.id === "cooking" ? procs(this.skillN("cooking") * 0.15) : 0;
			if (extra > 0) {
				for (const [id, n] of Object.entries(made.outputs)) save.bag[id] = (save.bag[id] ?? 0) + n * extra;
				this.say(extra === 1 ? "A second portion comes off the fire." : `${extra} extra portions come off the fire.`);
			}
			this.say(`Crafted ${Object.entries(made.outputs).map(([id, n]) => `${ITEM_BY_ID[id]?.name ?? id} x${n}`).join(", ")}.`);
			this.boardEvent("craft");
		}
		this.persist(); this.syncHud(true);
	}
	held(code) {
		return this.keys.has(code) || this.qa.has(code);
	}
	tickPlayer(dt) {
		this.moving = false;
		const save = this.save;
		this.clock += dt;
		const rooted = this.typing() || this.status.some((s) => (s.id === "root" || s.id === "sleep") && s.t > 0);
		const sleep = this.status.some((s) => s.id === "sleep" && s.t > 0);
		this.wardT = Math.max(0, this.wardT - dt);
		this.rollT = Math.max(0, this.rollT - dt);
		this.castLock = Math.max(0, this.castLock - dt);
		this.meleeChain = tickMelee(this.meleeChain ?? freshMelee(), dt);
		this.weave = tickWeave(this.weave ?? freshWeave(), dt);
		this.overcastT = Math.max(0, (this.overcastT ?? 0) - dt);
		if (!this.duel) this.defFatigue = Math.max(0, (this.defFatigue ?? 0) - dt * 0.35);
		if (this.lunge) this.tickLunge(dt);
		else if (this.rush) this.tickRush(dt);
		else if (this.orbit) this.tickOrbit(dt);
		else if (this.autoplay && !this.typing() && !this.sleeping && !(this.rules === "hardcore" && this.duel)) this.tickAutoplay(dt);
		else {
			let ix = 0;
			let iy = 0;
			if (this.held("KeyA") || this.held("ArrowLeft")) ix -= 1;
			if (this.held("KeyD") || this.held("ArrowRight")) ix += 1;
			if (this.held("KeyW") || this.held("ArrowUp")) iy -= 1;
			if (this.held("KeyS") || this.held("ArrowDown")) iy += 1;
			if (this.stick.x || this.stick.y) {
				ix = this.stick.x;
				iy = this.stick.y;
			}
			if (this.rules === "hardcore" && this.duel) {
				ix = 0;
				iy = 0;
				this.dest = null;
			}
			if (ix === 0 && iy === 0 && this.dest && !rooted) {
				const dx = this.dest.x - save.x;
				const dy = this.dest.y - save.y;
				const l = Math.hypot(dx, dy);
				if ((this.dest.mob ? this.mobs.find((m) => m.id === this.dest.mob && m.alive) : null) && l <= 52) {
					this.dest = null;
				} else if (l < 6) this.dest = null;
				else {
					ix = dx / l;
					iy = dy / l;
				}
			}
			const mag = Math.hypot(ix, iy) || 1;
			const soak = this.status.some((s) => s.id === "soak");
			const exhausted = this.rules === "hardcore" && save.survival.rest < 15;
			const speed = (rooted || this.sleeping ? 0 : 118) * (soak ? .62 : 1) * (exhausted ? .7 : 1) * this.speedMult();
			this.vx = ix / mag * speed;
			this.vy = iy / mag * speed;
			if (Math.abs(ix) > .2 || Math.abs(iy) > .2) {
				this.tryMove(this.vx * dt, this.vy * dt);
				this.walk += dt * 6;

			}
		}
		// Wayfinding: 1 XP per 10 tiles actually walked. Jumps (fast travel, ferries, portals) are too big to count.
		if (this.lastWalk && this.lastWalk.map === save.map) {
			const moved = Math.hypot(save.x - this.lastWalk.x, save.y - this.lastWalk.y);
			if (moved > 0 && moved < 160) {
				this.walkAcc = (this.walkAcc ?? 0) + moved;
				if (this.walkAcc >= 320) { const n = Math.floor(this.walkAcc / 320); this.walkAcc -= n * 320; this.gainSkill("wayfinding", n); }
			}
		}
		this.lastWalk = { map: save.map, x: save.x, y: save.y };
		this.cam.x += (save.x - this.cam.x) * Math.min(1, dt * 8);
		this.cam.y += (save.y - this.cam.y) * Math.min(1, dt * 8);
		const cdRate = this.gim?.cdRate() ?? 1;
		for (const id of Object.keys(this.cds)) this.cds[id] = Math.max(0, (this.cds[id] ?? 0) - dt * cdRate);
		this.status = tickStatuses(this.status, dt);
		if (this.buff.t > 0) this.buff.t -= dt;
		if ((save.jarLeft ?? 0) > 0) {
			save.jarLeft = Math.max(0, save.jarLeft - dt);
			if (save.jarLeft === 0) this.say("The jar's hum fades.");
		}
		this.hurt = Math.max(0, this.hurt - dt * 3);
		this.attackT = Math.max(0, this.attackT - dt * 3);
		this.tickBurn(dt);
		const adv = save.skills.adventuring.level;
		if (this.rules !== "hardcore" && this.combat <= 0) save.hp = Math.min(this.maxHp(), save.hp + (1.2 + adv * .15) * dt * Math.max(0, 1 + this.mod("regen") / 100));
		this.combat = Math.max(0, this.combat - dt);
		if (this.channel) {
			if (this.channel.kind === "fishing" && Math.hypot(this.channel.x - save.x, this.channel.y - save.y) > 40) {
				this.channel = null;
				this.say("You reel the line in.");
			} else {
				this.channel.t += dt;
				if (this.channel.t >= this.channel.need) this.finishChannel();
			}
		}
		this.tickNodeRespawn(dt);
		this.tickPortal(dt);
		this.tickIncoming(dt);
		this.evadeT = Math.max(0, (this.evadeT ?? 0) - dt);
		this.visitRegion();
		// Nodes are gathered with E. Do not pick them up by walking into them.
		const set = this.setInfo();
		if (set.on && set.fx && this.combat > 0) {
			this.setProc += dt;
			if (this.setProc > 6.2) {
				this.setProc = 0;
				this.procSet(set.fx, set.variant);
			}
		}
	}
	tryMove(dx, dy) {
		const save = this.save;
		const world = this.world;
		const x = save.x;
		const y = save.y;
		const hit = (x, y) => blocked(world, x, y) || blocked(world, x - 7, y) || blocked(world, x + 7, y) || blocked(world, x, y - 6);
		if (this.gim?.flying()) {
			// Skyborne: over walls and water, but never off the edge of the map.
			save.x = Math.max(16, Math.min(world.w * 32 - 16, save.x + dx));
			save.y = Math.max(16, Math.min(world.h * 32 - 16, save.y + dy));
		} else {
			if (!hit(save.x + dx, save.y)) save.x += dx;
			if (!hit(save.x, save.y + dy)) save.y += dy;
		}
		this.moving ||= save.x !== x || save.y !== y;
		this.direction = directionFromDelta(save.x - x, save.y - y, this.direction);
		if (save.x !== x) this.facing = save.x < x ? -1 : 1;
	}
	tickAutoplay(dt) {
		const save = this.save;
		if (this.dead || !this.world) return;
		if (this.autoCare(dt)) return;
		// Fight footwork: casters and archers hold a range and circle, melee closes in, everyone steps off a telegraphed hit.
		{
			const foe = this.fightTarget();
			if (foe && !this.channel) {
				const d = Math.hypot(foe.x - save.x, foe.y - save.y);
				const kit = this.arsenal(save).filter((m) => this.isOffense(m));
				const ranged = kit.filter((m) => attackForm(m) !== "melee");
				const caster = ranged.length > kit.length - ranged.length && !foe.animal;
				const ang = Math.atan2(save.y - foe.y, save.x - foe.x);
				this.autoSide = (this.autoSide ?? 1);
				if ((this.autoSideT = (this.autoSideT ?? 0) - dt) <= 0) { this.autoSideT = 1.4 + Math.random() * 1.4; this.autoSide = -this.autoSide; }
				const threatened = this.incoming?.some((h) => h.t < 0.32 && h.form === "melee");
				if (threatened && d < 80) {
					const side = ang + this.autoSide * 1.9;
					this.stepToward(save.x + Math.cos(side) * 70, save.y + Math.sin(side) * 70, dt);
					return;
				}
				if (caster) {
					const want = Math.max(70, Math.min(150, Math.max(...ranged.map((m) => this.playerReach(m))) * 0.72));
					if (d < want - 18 || (d < want + 30 && this.castLock <= 0)) {
						const out = d < want - 18 ? 1 : 0.15;
						const side = ang + this.autoSide * (Math.PI / 2) * (1 - out * 0.6);
						this.stepToward(save.x + Math.cos(side) * 60, save.y + Math.sin(side) * 60, dt);
						return;
					}
				}
			}
		}
		// Autogrind rotates skills. Fishing never runs out of fish, so without a time limit it
		// kept recasting forever and the other skills never got a turn.
		// Only reset the timer when genuinely switching to a different skill — not when the
		// planner bounces back to fishing right after a skip (the skip pause handles that).
		if (this.grind !== this.grindSeen && !(this.grind === "fishing" && (this.grindSkip?.["fishing"] ?? 0) > this.clock)) {
			this.grindSeen = this.grind;
			this.grindT = 0;
		}
		this.grindT = (this.grindT ?? 0) + dt;
		if (this.grind === "fishing" && this.grindT > FISH_GRIND_SECONDS && !this.channel) { this.skipGrind("fishing", FISH_GRIND_PAUSE); return; }
		if (this.channel) return;
		const gathering = this.grind === "mining" || this.grind === "woodcutting" || this.grind === "shroom" || this.grind === "alchemy";
		if (gathering) {
			const want = this.grind === "mining" ? "ore" : this.grind === "woodcutting" ? "tree" : "shroom";
			const near = this.nodeNear(want, 48);
			if (near) {
				this.path = [];
				this.dest = null;
				this.startNode(near.id, near.node);
				return;
			}
		}
		if (this.grind === "fishing") {
			const shore = nearestShore(this.world, save.x, save.y);
			if (shore && Math.hypot(shore.x - save.x, shore.y - save.y) <= 20 && nearestWaterTile(this.world, save.x, save.y, 80)) {
				this.path = [];
				this.dest = null;
				this.startFishing();
				return;
			}
		}
		const hpPct = save.hp / Math.max(1, this.maxHp());
		const threat = this.nearestMob(save.x, save.y, 90);
		if (hpPct < .34 && threat) {
			const ang = Math.atan2(save.y - threat.y, save.x - threat.x);
			this.stepToward(save.x + Math.cos(ang) * 80, save.y + Math.sin(ang) * 80, dt);
			return;
		}
		if (Math.hypot(save.x - this.stuckX, save.y - this.stuckY) < 4) this.stuckT += dt;
		else {
			this.stuckT = 0;
			this.stuckX = save.x;
			this.stuckY = save.y;
		}
		if (this.stuckT > 1.2) {
			this.stuckT = 0;
			this.path = [];
			this.pathI = 0;
			this.autoPlan = 0;
			// Cannot get to the shore (blocked, or the water is out of reach): try another skill for a while.
			if (this.grind === "fishing") { this.skipGrind("fishing", 60); return; }
		}
		this.autoPlan -= dt;
		let step = this.path[this.pathI];
		if (!step && this.autoPlan <= 0) {
			this.autoPlan = 1.8;
			this.planGrind();
			step = this.path[this.pathI];
		}
		if (!step) return;
		if (this.stepToward(step.x, step.y, dt) < 14) {
			this.pathI += 1;
			if (!this.path[this.pathI]) this.autoPlan = 0;
		}
	}
	stepToward(x, y, dt) {
		const save = this.save;
		const dx = x - save.x;
		const dy = y - save.y;
		const l = Math.hypot(dx, dy) || 1;
		const rooted = this.typing() || this.status.some((s) => (s.id === "root" || s.id === "sleep") && s.t > 0);
		const soak = this.status.some((s) => s.id === "soak");
		const exhausted = this.rules === "hardcore" && save.survival.rest < 15;
			const speed = (rooted || this.sleeping ? 0 : 118) * (soak ? .62 : 1) * (exhausted ? .7 : 1) * this.speedMult();
		this.tryMove(dx / l * speed * dt, dy / l * speed * dt);
		this.walk += dt * 6;
		if (dx < -2) this.facing = -1;
		else if (dx > 2) this.facing = 1;
		return Math.hypot(x - save.x, y - save.y);
	}
	/** Stop grinding `id` for `seconds` so autogrind moves on to something else. */
	skipGrind(id, seconds) {
		this.grindSkip = { ...(this.grindSkip ?? {}), [id]: this.clock + seconds };
		this.grind = "looking";
		this.path = [];
		this.pathI = 0;
		this.dest = null;
		this.autoPlan = 0;
		this.grindT = 0;
	}
	planGrind() {
		const save = this.save;
		if (!save) return;
		const act = this.playThink();
		if (act && act.kind !== "wander" && this.playAct(act)) return;
		const order = Object.keys(save.skills).sort((a, b) => {
			const A = save.skills[a];
			const B = save.skills[b];
			return A.level - B.level || A.xp - B.xp;
		});
		const skip = this.grindSkip ?? {};
		const orders = this.orders;
		const blocked = new Set();
		if (orders) {
			if (!orders.mining) blocked.add("mining");
			if (!orders.woodcutting) blocked.add("woodcutting");
			if (!orders.fishing) blocked.add("fishing");
			if (!orders.shroom) blocked.add("shroom");
			if (!orders.crafting) blocked.add("alchemy");
			if (!orders.spirits) blocked.add("catching");
			if (!orders.combat) { blocked.add("hunting"); blocked.add("physical"); blocked.add("bountyhunting"); }
			if (!orders.dungeon) blocked.add("adventuring");
		}
		const open = order.filter((id) => (skip[id] ?? 0) <= this.clock && !blocked.has(id));
		// Skipped skills still run as a last resort, so autogrind never idles when they are all that is left.
		for (const id of [...open, ...order.filter((id) => !open.includes(id) && !blocked.has(id))]) if (this.aimSkill(id)) {
			this.grind = id;
			return;
		}
		this.grind = "wander";
		const ang = Math.random() * Math.PI * 2;
		this.walkTo(save.x + Math.cos(ang) * 180, save.y + Math.sin(ang) * 180);
	}
	/** Orders default to everything, so autoplay can be told to stop a task in any mode. */
	ensureOrders() {
		if (this.orders && typeof this.orders === "object" && !Array.isArray(this.orders)) return;
		this.orders = { ...ALL_ORDERS };
	}
	playOrders(): PlayOrders {
		const o = this.orders;
		if (!o || Array.isArray(o)) return { ...ALL_ORDERS };
		return {
			combat: o.combat !== false,
			mining: o.mining !== false,
			woodcutting: o.woodcutting !== false,
			fishing: o.fishing !== false,
			shroom: o.shroom !== false,
			crafting: o.crafting !== false,
			spirits: o.spirits !== false,
			dungeon: o.dungeon !== false,
		};
	}
	/** The next thing a player would do from where she stands. */
	playThink() {
		const save = this.save;
		if (!save || !this.world) return null;
		const orders = this.playOrders();
		const foes = [];
		for (const m of this.mobs) {
			if (!m.alive || m.party) continue;
			const d = Math.hypot(m.x - save.x, m.y - save.y);
			if (d > 720) continue;
			foes.push({
				id: m.id, x: m.x, y: m.y, d, level: m.level ?? 1, type: m.type || "normal",
				boss: !!m.boss, dungeonBoss: !!m.dungeonBoss, hunter: !!m.hunter,
				witch: !!m.witch && !m.party, animal: !!m.animal, ghost: !!(m.ghost || m.enemyGhost),
			});
		}
		foes.sort((a, b) => a.d - b.d);
		if (foes.length > 10) foes.length = 10;
		const nodes = [];
		for (const n of this.world.spawns ?? []) {
			if (n.kind !== "node" || n.node === "fish") continue;
			const d = Math.hypot(n.x - save.x, n.y - save.y);
			if (d > 980) continue;
			nodes.push({ id: n.id, node: n.node, x: n.x, y: n.y, d });
		}
		nodes.sort((a, b) => a.d - b.d);
		if (nodes.length > 8) nodes.length = 8;
		let rift = null;
		let rd = 1400;
		for (const p of save.dungeons?.portals ?? []) {
			if (p.cleared) continue;
			const d = Math.hypot(p.x - save.x, p.y - save.y);
			if (d < rd) { rd = d; rift = { id: p.id, x: p.x, y: p.y, level: p.level ?? 1, d }; }
		}
		const shore = nearestShore(this.world, save.x, save.y);
		const hc = this.rules === "hardcore" && !this.turbz;
		const bed = hc ? this.bedNear(280) : null;
		const exit = this.isDungeonMap(save.map) ? this.dungeonExitAt() : null;
		const hungry = hc && (save.survival?.hunger ?? 100) < 38 && !!bestFood(save.bag, save.survival?.hunger ?? 100);
		const thirsty = hc && (save.survival?.thirst ?? 100) < 38 && (save.bag.drinking_water ?? 0) > 0;
		const tired = hc && (save.survival?.rest ?? 100) < 18 && !!(bed || this.nearCamp());
		return thinkLikePlayer({
			x: save.x, y: save.y, level: save.level, hpPct: save.hp / Math.max(1, this.maxHp()),
			type: CLASS_BY_ID[save.classId]?.type ?? "normal",
			bag: save.bag, orders, inDungeon: this.isDungeonMap(save.map),
			needs: { eat: hungry, drink: thirsty, sleep: tired },
			foes, nodes, shore, rift, exit, bed: bed ? { x: bed.tx * 32 + 16, y: bed.ty * 32 + 16 } : (this.nearCamp() ? { x: save.x, y: save.y } : null),
			wander: ((Math.floor(this.clock / 5) * 17) % 628) / 100,
		});
	}
	/** Carry out one player-like decision. False lets the old skill rotation take the turn. */
	playAct(act) {
		const save = this.save;
		if (!save || !act) return false;
		if (act.kind === "flee") { this.grind = "fleeing"; return this.walkTo(act.x, act.y); }
		if (act.kind === "potion") {
			const id = (save.bag.big_potion ?? 0) > 0 && save.hp < this.maxHp() * 0.3 ? "big_potion" : (save.bag.potion ?? 0) > 0 ? "potion" : "big_potion";
			if ((save.bag[id] ?? 0) > 0 && !this.itemProblem(ITEM_BY_ID[id])) { this.useBag(id); this.potionCd = 6; return true; }
			return false;
		}
		if (act.kind === "eat") { this.eatFood(); return true; }
		if (act.kind === "drink") { if ((save.bag.drinking_water ?? 0) > 0) this.useBag("drinking_water"); return true; }
		if (act.kind === "sleep") {
			if (this.inFight() || this.combat > 0) return false;
			if (this.bedNear() || this.nearCamp()) { this.goToSleep(); return true; }
			return this.walkTo(act.x, act.y);
		}
		if (act.kind === "leave") {
			if (Math.hypot(save.x - act.x, save.y - act.y) < 40) {
				const back = this.turbz ? "custom-turbz" : "world";
				this.travel(back, save.dungeons?.portals.find((p) => p.id === save.map) ?? { x: act.x, y: act.y });
				return true;
			}
			this.grind = "leaving";
			return this.walkTo(act.x, act.y);
		}
		if (act.kind === "fight") {
			this.grind = "combat";
			if (Math.hypot(act.x - save.x, act.y - save.y) < 64) { this.path = []; this.dest = null; return true; }
			return this.walkTo(act.x, act.y);
		}
		if (act.kind === "craft") return this.playCraft();
		if (act.kind === "brew") return this.playBrew();
		if (act.kind === "gather") {
			const id = act.node === "ore" ? "mining" : act.node === "tree" ? "woodcutting" : "shroom";
			if (this.aimSkill(id)) { this.grind = id; return true; }
			return false;
		}
		if (act.kind === "fish") {
			if (this.aimSkill("fishing")) { this.grind = "fishing"; return true; }
			return false;
		}
		if (act.kind === "rift") {
			if (Math.hypot(act.x - save.x, act.y - save.y) <= 120) { this.enterRift(act.id); return true; }
			this.grind = "dungeon";
			return this.walkTo(act.x, act.y);
		}
		return false;
	}
	playCraft() {
		const save = this.save;
		if (!save || (save.bag.timber ?? 0) < 3 || (save.bag.ore ?? 0) < 2) return false;
		save.bag.timber -= 3;
		save.bag.ore -= 2;
		const g = rollGear(mulberry32(Math.random() * 1e9 | 0), {
			level: save.level,
			typeBias: CLASS_BY_ID[save.classId]?.type,
			raceBias: save.race,
		});
		this.receiveGear(g);
		this.autoEquip();
		this.gainSkill("alchemy", 8);
		this.say(`Autoplay crafts ${g.name}.`);
		this.syncHud(true);
		return true;
	}
	playBrew() {
		const save = this.save;
		if (!save) return false;
		if ((save.bag.fish ?? 0) >= 1 && (save.bag.fish_meal ?? 0) < 2 && this.rules === "hardcore") { this.brew("meal"); return true; }
		for (const recipe of ALCHEMY_RECIPES) {
			if (recipe.output !== "potion" && recipe.output !== "big_potion") continue;
			if (Object.entries(recipe.costs).every(([k, n]) => (save.bag[k] ?? 0) >= n)) { this.brew(recipe.id); return true; }
		}
		return false;
	}
	/** Wear the best piece in each slot. Autoplay does this in every mode, Hardcore included. */
	autoEquip() {
		const save = this.save;
		if (!save) return;
		let wore = "";
		for (const g of save.gear) {
			const worn = save.equipped?.[g.slot] ? save.gear.find((x) => x.uid === save.equipped[g.slot]) : null;
			if (!worn || gearScore(g) > gearScore(worn)) {
				save.equipped[g.slot] = g.uid;
				wore = g.name;
			}
		}
		if (wore) this.say(`Autoplay wears ${wore}.`);
	}
	aimSkill(id) {
		const save = this.save;
		if (id === "mining" || id === "woodcutting" || id === "fishing" || id === "shroom") {
			if (id === "fishing") {
				const shore = nearestShore(this.world, save.x, save.y);
				if (!shore) return false;
				if (Math.hypot(shore.x - save.x, shore.y - save.y) <= 18 && nearestWaterTile(this.world, save.x, save.y, 80)) {
					this.path = [];
					this.dest = null;
					if (!this.channel) this.startFishing();
					return true;
				}
				return this.walkTo(shore.x, shore.y);
			}
			const node = id === "mining" ? "ore" : id === "woodcutting" ? "tree" : "shroom";
			const live = this.nearestLiveNode(node);
			if (!live) return false;
			if (Math.hypot(live.x - save.x, live.y - save.y) <= 52) {
				this.path = [];
				this.dest = null;
				if (!this.channel) this.startNode(live.id, live.node);
				return true;
			}
			const stand = this.standNear(live.x, live.y);
			return stand ? this.walkTo(stand.x, stand.y) : this.walkTo(live.x, live.y);
		}
		if (id === "trading") {
			if ([
				"meat",
				"leather",
				"mushroom",
				"ore",
				"timber",
				"fish"
			].reduce((n, k) => n + (save.bag[k] ?? 0), 0) > 0) {
				this.sellMats();
				this.path = [];
				return true;
			}
			const beast = this.mobs.find((m) => m.alive && m.animal) ?? this.nearestMob(save.x, save.y, 2e3);
			return beast ? this.walkTo(beast.x, beast.y) : false;
		}
		if (id === "alchemy") {
			for (const recipe of ALCHEMY_RECIPES) {
				if (Object.entries(recipe.costs).every(([k, n]) => (save.bag[k] ?? 0) >= n)) {
					this.brew(recipe.id);
					this.path = [];
					return true;
				}
			}
			const at = this.nearestLiveNode("shroom");
			if (!at) return false;
			if (Math.hypot(at.x - save.x, at.y - save.y) <= 52) {
				this.path = [];
				this.dest = null;
				if (!this.channel) this.startNode(at.id, at.node);
				return true;
			}
			const stand = this.standNear(at.x, at.y);
			return stand ? this.walkTo(stand.x, stand.y) : this.walkTo(at.x, at.y);
		}
		if (id === "social") {
			let best = null;
			let bd = 1e9;
			for (const n of NPCS) {
				if (n.map !== "world") continue;
				const at = scaleTile(n.tx, n.ty);
				const x = at.tx * 32 + 16;
				const y = at.ty * 32 + 20;
				const d = Math.hypot(x - save.x, y - save.y);
				if (d < 48) {
					this.gainSkill("social", 8);
					this.say(`A word with ${n.name}.`);
					this.path = [];
					return true;
				}
				if (d < bd) {
					bd = d;
					best = {
						x,
						y,
						id: n.id,
						name: n.name
					};
				}
			}
			return best ? this.walkTo(best.x, best.y) : false;
		}
		if (id === "adventuring") {
			let far = null;
			let bd = 0;
			for (const p of POIS) {
				if (p.kind !== "shrine" && p.kind !== "dungeon") continue;
				const pos = poiPos(p);
				if (!pos) continue;
				const d = Math.hypot(pos.x - save.x, pos.y - save.y);
				if (d > bd) {
					bd = d;
					far = pos;
				}
			}
			if (far && bd < 80) {
				this.gainSkill("adventuring", 12);
				this.path = [];
				return true;
			}
			return far ? this.walkTo(far.x, far.y) : false;
		}
		if (id === "catching") {
			if ((save.jarLeft ?? 0) <= 0) {
				if ((save.bag.ghost_jar ?? 0) > 0) {
					this.useSpiritJar();
					this.path = [];
					return true;
				}
				const holt = NPCS.find((n) => n.id === "holt");
				if (holt) {
					const at = scaleTile(holt.tx, holt.ty);
					const x = at.tx * 32 + 16;
					const y = at.ty * 32 + 20;
					if (Math.hypot(x - save.x, y - save.y) < 50) {
						const cost = ITEM_BY_ID.ghost_jar ? this.price(ITEM_BY_ID.ghost_jar.price) : 99;
						if (save.kyo >= cost) {
							this.buyItem("ghost_jar");
							this.useSpiritJar();
							this.path = [];
							return true;
						}
					} else return this.walkTo(x, y);
				}
			}
			const foe = this.nearestMob(save.x, save.y, 2400);
			if (!foe) return false;
			if (Math.hypot(foe.x - save.x, foe.y - save.y) < 70) {
				this.path = [];
				return true;
			}
			return this.walkTo(foe.x, foe.y);
		}
		const foe = this.autoFoe(2600);
		if (!foe) return false;
		if (Math.hypot(foe.x - save.x, foe.y - save.y) < 70) {
			this.path = [];
			return true;
		}
		return this.walkTo(foe.x, foe.y);
	}
	/**
	 * The foe autoplay goes after: close, worth the trip, and one it can beat. It skips bosses,
	 * bounties, witches and hunters far above it, prefers an element its verses beat, and leaves
	 * fleeing beasts alone unless it is training Hunting.
	 */
	autoFoe(range) {
		const save = this.save;
		const offense = this.arsenal(save).filter((m) => this.isOffense(m));
		let best = null, bs = Infinity;
		for (const m of this.mobs) {
			if (!m.alive) continue;
			const d = Math.hypot(m.x - save.x, m.y - save.y);
			if (d > range) continue;
			const gap = (m.level ?? 1) - save.level;
			const big = m.boss || m.bounty || m.hunter || (m.witch && !m.party);
			if (big && (gap > 2 || save.hp < this.maxHp() * 0.8)) continue;
			if (gap > 8) continue;
			if (m.animal && this.grind !== "hunting" && this.grind !== "skinning") continue;
			const edge = offense.reduce((n, mv) => Math.max(n, typeChart(mv.type, m.type)), 1);
			if (this.gim?.active("phase") && !this.gim.isGhost(m)) continue;
			const walled = this.world && wallBetween(this.world, save.x, save.y, m.x, m.y) ? 140 : 0;
			const pack = this.foesNear(m.x, m.y, 90).length;
			const score = d * (edge > 1 ? 0.7 : edge < 1 ? 1.3 : 1) + Math.max(0, gap) * 60 + (m.rarity ?? 0) * 25 + walled + Math.max(0, pack - 2) * 45 - (m.aggro ? 90 : 0);
			if (score < bs) { bs = score; best = m; }
		}
		return best ?? this.nearestMob(save.x, save.y, Math.min(range, 400));
	}
	/**
	 * Autoplay looks after itself before it grinds: drinks a potion when hurt, backs off and rests
	 * (TurboHunt heals out of combat) until it is healthy again, spends skill points on its equipped
	 * verses, and sells its gathered materials when the pack fills up.
	 */
	autoCare(dt) {
		const save = this.save;
		const hp = save.hp / Math.max(1, this.maxHp());
		// Asleep or rooted: mash to break free, like a player would.
		const held = this.status.find((s) => (s.id === "sleep" || s.id === "root") && s.t > 0);
		if (held) {
			this.mashT = (this.mashT ?? 0) - dt;
			if (this.mashT <= 0) { this.mashT = 0.15; struggle(this.status, held.id === "sleep" ? 0.3 : 0.18); }
		}
		this.autoCareT = (this.autoCareT ?? 0) - dt;
		this.potionCd = Math.max(0, (this.potionCd ?? 0) - dt);
		if (hp < 0.45 && this.potionCd <= 0 && (this.healCd ?? 0) <= 0 && this.inFight()) {
			const id = (save.bag.big_potion ?? 0) > 0 && hp < 0.3 ? "big_potion" : (save.bag.potion ?? 0) > 0 ? "potion" : (save.bag.big_potion ?? 0) > 0 ? "big_potion" : null;
			if (id && !this.itemProblem(ITEM_BY_ID[id])) { this.useBag(id); this.potionCd = 6; }
		}
		if (this.rules !== "hardcore") {
			if (hp < 0.4) this.autoRest = true;
			if (this.autoRest) {
				if (hp >= 0.85) { this.autoRest = false; this.say("Rested. Back to it."); }
				else {
					const threats = this.foesNear(save.x, save.y, 420).filter((m) => m.aggro || (!m.animal && Math.hypot(m.x - save.x, m.y - save.y) < 220));
					// Being hit with nothing to run from (a shot from far off, a ghost): stop resting and answer it.
					if (!threats.length && this.combat > 1.5 && (this.hurt ?? 0) > 0.2) { this.autoRest = false; return false; }
					if (threats.length) {
						// Run from the middle of the pack, not just the nearest foe. Cornered, it turns and fights.
						const cx = threats.reduce((n, m) => n + m.x, 0) / threats.length, cy = threats.reduce((n, m) => n + m.y, 0) / threats.length;
						const ang = Math.atan2(save.y - cy, save.x - cx);
						const bx = save.x, by = save.y;
						this.stepToward(save.x + Math.cos(ang) * 90, save.y + Math.sin(ang) * 90, dt);
						this.fleeStall = Math.hypot(save.x - bx, save.y - by) < 0.5 ? (this.fleeStall ?? 0) + dt : 0;
						if (this.fleeStall > 0.6) { this.fleeStall = 0; this.autoRest = false; return false; }
					} else { this.path = []; this.dest = null; }
					this.grind = "resting";
					return true;
				}
			}
		}
		if (this.autoCareT > 0) return false;
		this.autoCareT = 6;
		this.autoEquip();
		// Spend skill points on the equipped verses, lowest rank first (strongest attacks break ties).
		let guard = 20;
		while ((save.skillPoints ?? 0) > 0 && guard-- > 0) {
			const kit = this.arsenal(save);
			if (!kit.length) break;
			const pickMove = kit.slice().sort((a, b) => (save.abilityRanks[a.id] ?? 1) - (save.abilityRanks[b.id] ?? 1) || b.power - a.power)[0];
			if (!pickMove || !spendAbilityPoint(save, pickMove.id)) break;
			this.say(`Autoplay ranked up ${pickMove.name} to ${save.abilityRanks[pickMove.id]}.`);
		}
		// Sell gathered materials when the pack is heavy (TurboHunt only; Hardcore keeps its supplies).
		if (this.rules !== "hardcore") {
			const mats = ["meat", "leather", "mushroom", "ore", "timber", "fish"].reduce((n, k) => n + (save.bag[k] ?? 0), 0);
			if (mats >= 40) this.sellMats();
		}
		return false;
	}
	nearestNode(node) {
		const save = this.save;
		if (node === "fish") return nearestShore(this.world, save.x, save.y);
		const live = this.nearestLiveNode(node);
		return live ? { x: live.x, y: live.y } : null;
	}
	nearestLiveNode(node) {
		const save = this.save;
		let best = null;
		let bd = 1e9;
		for (const n of this.world?.spawns ?? []) {
			if (n.kind !== "node" || n.node !== node) continue;
			const d = Math.hypot(n.x - save.x, n.y - save.y);
			if (d < bd) { bd = d; best = n; }
		}
		return best;
	}
	/** A walkable tile beside a node, so autoplay stops next to it instead of pushing into it. */
	standNear(x, y) {
		const save = this.save;
		const tx = Math.floor(x / 32);
		const ty = Math.floor(y / 32);
		let best = null;
		let bd = 1e9;
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (!dx && !dy) continue;
			const px = (tx + dx) * 32 + 16;
			const py = (ty + dy) * 32 + 16;
			if (blocked(this.world, px, py)) continue;
			const d = Math.hypot(px - save.x, py - save.y);
			if (d < bd) { bd = d; best = { x: px, y: py }; }
		}
		return best;
	}
	zoneSpot(z) {
		const spots = [];
		for (let ty = z.ty; ty < z.ty + z.th; ty++) for (let tx = z.tx; tx < z.tx + z.tw; tx++) {
			const px = tx * 32 + 16;
			const py = ty * 32 + 16;
			if (!blocked(this.world, px, py)) spots.push({ x: px, y: py });
		}
		if (!spots.length) return null;
		return spots[Math.floor(Math.random() * spots.length)];
	}
	/** Nearest live resource node of a kind (or any kind) within `reach` px of the player. */
	nodeNear(node, reach = 64, autoOnly = false) {
		const save = this.save;
		let best = null;
		let bd = reach + 1;
		for (const n of this.world.spawns) {
			if (n.kind !== "node" || n.node === "fish" || (node && n.node !== node) || (autoOnly && !n.auto)) continue;
			const d = Math.hypot(n.x - save.x, n.y - save.y);
			if (d <= reach && d < bd) { bd = d; best = n; }
		}
		return best;
	}
	/**
	 * A harvested node is used up where it stands. It does not move or multiply: it grows back in the
	 * same spot when the land regrows, which is when you finish a sleep or a new day dawns (Hardcore),
	 * or once every in-game day (Standard). Used-up nodes are saved, so a reload or a trip through a
	 * door does not bring them back early.
	 */
	depleteNode(id) {
		const i = this.world.spawns.findIndex((n) => n.id === id && n.kind === "node");
		if (i < 0) return;
		const [node] = this.world.spawns.splice(i, 1);
		delete this.nodeCd[id];
		this.nodeStash = this.nodeStash ?? [];
		this.nodeStash.push({ world: this.world, node });
		const key = this.nodeKey(this.save.map);
		if (!key) return;
		const taken = this.save.nodesTaken = this.save.nodesTaken ?? {};
		const list = taken[key] = taken[key] ?? [];
		if (!list.includes(id)) list.push(id);
	}
	/** Which maps remember used-up nodes. Rifts and the Green Cave are rebuilt fresh, so they do not. */
	nodeKey(map) {
		if (!map || map.startsWith("rift-") || map === `custom-${GREEN_CAVE_ID}`) return "";
		return map;
	}
	/** After a map loads: nodes used up earlier today stay gone. */
	applyTakenNodes(map) {
		const key = this.nodeKey(map);
		const ids = key ? this.save?.nodesTaken?.[key] : null;
		if (!ids?.length || !this.world) return;
		const gone = new Set(ids);
		const keep = [];
		this.nodeStash = this.nodeStash ?? [];
		for (const n of this.world.spawns) {
			if (n.kind === "node" && gone.has(n.id)) {
				if (!this.nodeStash.some((e) => e.world === this.world && e.node.id === n.id)) this.nodeStash.push({ world: this.world, node: n });
			} else keep.push(n);
		}
		this.world.spawns = keep;
	}
	/** Every used-up node grows back in its own spot. */
	regrowNodes(why) {
		const save = this.save;
		if (!save) return;
		let n = 0;
		for (const e of this.nodeStash ?? []) {
			if (!e.world?.spawns || e.world.spawns.some((x) => x.id === e.node.id)) continue;
			e.world.spawns.push(e.node);
			n += 1;
		}
		const had = Object.values(save.nodesTaken ?? {}).some((l) => l?.length);
		this.nodeStash = [];
		save.nodesTaken = {};
		save.regrowT = 0;
		if (n || had) this.say(why === "sleep" ? "You wake to a regrown land: trees, ore and mushrooms are back in their groves." : "A new day: trees, ore and mushrooms grow back in their groves.");
	}
	/** Standard has no nights or sleep: the land regrows once per in-game day. */
	tickNodeRespawn(dt) {
		const save = this.save;
		if (!save || this.nightOn()) return;
		save.regrowT = (save.regrowT ?? 0) + dt;
		if (save.regrowT >= DAY_SECONDS) this.regrowNodes("day");
	}
	/** Fish from the nearest water tile. A bite takes 1-10 seconds; Fish Luck shortens it. */
	startFishing() {
		if (this.channel || this.dead || !this.save) return;
		const save = this.save;
		if (!nearestWaterTile(this.world, save.x, save.y, 80)) { this.say("Stand beside water to fish."); return; }
		const perk = 1 - bend(this.chan("fish_luck"), 75, 92) / 100;
		const skill = rateMult(this.skillN("fishing") * 0.5);
		const wait = (FISH_BITE_MIN + Math.random() * (FISH_BITE_MAX - FISH_BITE_MIN)) * perk * skill;
		this.dest = null;
		if (this.autoplay) { this.path = []; this.pathI = 0; }
		this.channel = { kind: "fishing", x: save.x, y: save.y, map: save.map, t: 0, need: Math.max(.25, wait) };
		this.say("Line cast...");
	}
	walkTo(x, y) {
		const save = this.save;
		const path = this.findPath(x, y);
		if (!save || !path.length) return false;
		const last = path[path.length - 1];
		if (Math.hypot(last.x - x, last.y - y) > 256 && Math.hypot(last.x - save.x, last.y - save.y) < 32) return false;
		this.path = path;
		this.pathI = 0;
		return true;
	}
	findPath(x, y) {
		const world = this.world;
		const save = this.save;
		if (!world || !save) return [{
			x,
			y
		}];
		const w = world.w;
		const h = world.h;
		const sx = Math.max(0, Math.min(w - 1, Math.floor(save.x / 32)));
		const sy = Math.max(0, Math.min(h - 1, Math.floor(save.y / 32)));
		let gx = Math.max(0, Math.min(w - 1, Math.floor(x / 32)));
		let gy = Math.max(0, Math.min(h - 1, Math.floor(y / 32)));
		if (blocked(world, gx * 32 + 16, gy * 32 + 16)) {
			let found = false;
			for (let r = 1; r <= 4 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r; dx++) {
				const nx = gx + dx;
				const ny = gy + dy;
				if (nx < 2 || ny < 2 || nx >= w - 2 || ny >= h - 2) continue;
				if (!blocked(world, nx * 32 + 16, ny * 32 + 16)) {
					gx = nx;
					gy = ny;
					found = true;
					break;
				}
			}
		}
		const key = (tx, ty) => ty * w + tx;
		const start = key(sx, sy);
		const goal = key(gx, gy);
		const q = [start];
		const prev = /* @__PURE__ */ new Map();
		prev.set(start, -1);
		let qi = 0;
		let hit = -1;
		let best = start;
		let bestD = Math.abs(sx - gx) + Math.abs(sy - gy);
		let guard = 0;
		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		];
		while (qi < q.length && guard < 14000) {
			guard++;
			const cur = q[qi++];
			if (cur === goal) {
				hit = cur;
				break;
			}
			const cx = cur % w;
			const cy = cur / w | 0;
			const cd = Math.abs(cx - gx) + Math.abs(cy - gy);
			if (cd < bestD) {
				bestD = cd;
				best = cur;
			}
			for (const [dx, dy] of dirs) {
				const nx = cx + dx;
				const ny = cy + dy;
				if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
				const k = key(nx, ny);
				if (prev.has(k)) continue;
				if (blocked(world, nx * 32 + 16, ny * 32 + 16)) continue;
				prev.set(k, cur);
				q.push(k);
			}
		}
		if (hit < 0) hit = best === start ? -1 : best;
		if (hit < 0) return [];
		const raw = [];
		let c = hit;
		while (c !== -1) {
			const tx = c % w;
			const ty = c / w | 0;
			raw.push({
				x: tx * 32 + 16,
				y: ty * 32 + 16
			});
			c = prev.get(c) ?? -1;
		}
		raw.reverse();
		if (raw.length <= 2) return raw;
		const sees = (a, b) => {
			const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
			for (let s = 1; s < steps; s++) {
				const t = s / steps;
				if (blocked(world, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
			}
			return true;
		};
		const slim = [];
		let i = 0;
		while (i < raw.length - 1) {
			let j = Math.min(raw.length - 1, i + 16);
			while (j > i + 1 && !sees(raw[i], raw[j])) j--;
			slim.push(raw[j]);
			i = j;
		}
		return slim;
	}
	reachOf(id) {
		return this.playerReach(MOVE_BY_ID[id] ?? MOVES[0]);
	}
	/** Your reach with a verse: its own reach. Ranged verses and spells are stretched by Long Reach (gear, perks, Far Sight); melee never is. */
	playerReach(move) {
		const base = attackRange(move);
		if (attackForm(move) === "melee") return base;
		return base * (1 + bend(this.chan("reach") / 100, 0.6, 1));
	}
	autoMelee(mob) {
		const save = this.save;
		const weapon = this.piece("weapon");
		const type = weapon?.type ?? "normal";
		const tm = typeChart(type, mob.type);
		this.attackT = 1;
		this.facing = mob.x < save.x ? -1 : 1;
		this.cfx = this.cfx ?? new CombatFx();
		this.cfx.swing(type, weapon ? ["worn", "common", "fine", "rare", "epic", "legendary"].indexOf(weapon.quality) : 0, save.x, save.y - 18, mob.x, mob.y - 12);
		if (tm === 0) {
			this.float(mob.x, mob.y - 36, "IMMUNE", "#e7d9ff");
			return;
		}
		const phys = 1 + (save.skills.physical.level - 1) * .02;
		let dmg = (11 + save.level * 2.4 + (weapon ? equipmentStats(weapon).damage : 8)) * phys * this.stab(type) * tm;
		dmg *= 1 + this.chan("might") / 100;
		dmg *= bendDown(1 + this.mod("might") / 100, 0.2, 0.05);
		dmg *= this.offenseFactor(mob, "melee");
		if (mob.boss) dmg *= 1 + this.chan("boss_bane") / 100;
		this.damageMob(mob, Math.max(1, dmg), false);
		this.gainSkill("physical", 2);
		this.combat = 3;
	}
	pointAt(x, y) {
		if (snap.mode !== "play" || this.dead || !this.save) return;
		if (this.rules === "hardcore") for (const b of this.save.survival?.beds ?? []) {
			if (b.map !== this.save.map || Math.floor(x / 32) !== b.tx || Math.floor(y / 32) !== b.ty) continue;
			if (Math.hypot(b.tx * 32 + 16 - this.save.x, b.ty * 32 + 16 - this.save.y) <= BED_REACH) this.goToSleep(b);
			else { this.pendingBed = b; this.dest = { x: b.tx * 32 + 16, y: b.ty * 32 + 28, mob: null }; this.say("Heading to bed."); }
			return;
		}
		for (const g of this.save.wildGhosts ?? []) {
			if (g.map !== this.save.map || Math.abs(g.x - x) > 18 || y < g.y - 40 || y > g.y + 8) continue;
			if (Math.hypot(g.x - this.save.x, g.y - this.save.y) <= WILD_REACH) this.openWild(g.id);
			else { this.pendingWild = g.id; this.dest = { x: g.x, y: g.y + 6, mob: null }; }
			return;
		}
		for (const c of this.save.chests ?? []) {
			if (c.map !== this.save.map || Math.abs(c.x - x) > 16 || y < c.y - 24 || y > c.y + 6) continue;
			if (Math.hypot(c.x - this.save.x, c.y - this.save.y) <= CHEST_REACH) this.openChest(c.id);
			else { this.pendingChest = c.id; this.dest = { x: c.x, y: c.y + 4, mob: null }; }
			return;
		}
		if (this.customFile) for (const n of this.mapNpcs) {
			const nx = n.tx * 32 + 16, ny = n.ty * 32 + 20;
			if (Math.hypot(nx - x, ny - y) > 42) continue;
			if (Math.hypot(this.save.x - nx, this.save.y - ny) <= 64) { this.openTalk(`cm:${n.id}`); this.dest = null; }
			else this.dest = { x: nx, y: ny + 18, mob: null };
			return;
		}
		if (this.save.map === "world") for (const n of NPCS) {
			if (n.map !== "world") continue;
			const at = scaleTile(n.tx, n.ty);
			const nx = at.tx * 32 + 16;
			const ny = at.ty * 32 + 20;
			if (Math.hypot(nx - x, ny - y) > 42) continue;
			if (Math.hypot(this.save.x - nx, this.save.y - ny) <= 64) {
				this.openTalk(n.id);
				this.dest = null;
			} else this.dest = {
				x: nx,
				y: ny + 18,
				mob: null
			};
			return;
		}
		const mob = this.nearestMob(x, y, 28);
		this.dest = {
			x: mob ? mob.x : x,
			y: mob ? mob.y : y,
			mob: mob?.id ?? null
		};
	}
	nearestMob(x, y, r) {
		let best = null;
		let bd = r;
		for (const m of this.mobs) {
			if (!m.alive) continue;
			const d = Math.hypot(m.x - x, m.y - y);
			if (d < bd) {
				bd = d;
				best = m;
			}
		}
		return best;
	}
	cast(index) {
		const save = this.save;
		if (!save) return;
		const id = save.bar[index];
		const move = id ? MOVE_BY_ID[id] : void 0;
		if (!move) return;
		if (!this.castMove(move)) this.say("Out of range, or that move is cooling.");
	}
	/** Smart auto-combat when the toggle is on. Full autoplay still fights unless Fight is turned off. */
	autoAttacks() {
		if (this.autoCombat) return true;
		if (this.autoplay && this.orders?.combat !== false) return true;
		return false;
	}
	isOffense(m) {
		const tac = moveTactic(m);
		return tac !== "heal" && tac !== "ward" && tac !== "roll" && tac !== "dash" && tac !== "surge" && tac !== "aura" && m.effect !== "mend" && m.effect !== "shell";
	}
	moveReaches(m, dist) {
		const tac = moveTactic(m);
		const pad = attackForm(m) === "melee" ? 0 : tac === "blink" || tac === "lunge" ? 8 : 4;
		return dist <= this.playerReach(m) + pad;
	}
	/** Closest living thing that at least one of these moves can actually hit. */
	nearestInRange(moves) {
		const save = this.save;
		if (!save || !moves?.length) return null;
		let best = null;
		let bd = Infinity;
		for (const mob of this.mobs) {
			if (!mob.alive) continue;
			const d = Math.hypot(mob.x - save.x, mob.y - save.y);
			if (d >= bd) continue;
			if (moves.some((mv) => this.moveReaches(mv, d))) {
				bd = d;
				best = mob;
			}
		}
		return best;
	}
	castOffense(foe) {
		const save = this.save;
		if (!save || !foe?.alive) return false;
		const dist = Math.hypot(foe.x - save.x, foe.y - save.y);
		const magicBetter = bodyRead(foe.type).kind === "magic";
		const tiredMana = this.pools?.manaSlow > 0;
		const tiredStam = this.pools?.stamSlow > 0;
		const pick = this.arsenal(save).filter((m) => (this.cds[m.id] ?? 0) <= 0 && this.isOffense(m) && this.moveReaches(m, dist))
			.sort((a, b) => {
				let sb = this.moveScore(b, foe, magicBetter, dist);
				let sa = this.moveScore(a, foe, magicBetter, dist);
				if (tiredStam) { if (attackForm(b) === "melee") sb -= 80; if (attackForm(a) === "melee") sa -= 80; }
				if (tiredMana) { if (attackForm(b) === "spell") sb -= 80; if (attackForm(a) === "spell") sa -= 80; }
				return sb - sa;
			})[0];
		if (!pick) return false;
		return this.castMove(pick, foe);
	}
	/** Manual swing. Always the nearest thing currently in range. */
	attack() {
		const save = this.save;
		if (!save || this.dead || snap.mode !== "play") return false;
		if (this.castLock > 0 || this.lunge || this.rush || this.orbit) return false;
		const foe = this.fightTarget();
		if (foe && this.castOffense(foe)) return true;
		this.say(foe ? "Moves are still cooling." : "Nothing in range.");
		return false;
	}
	/** The verses you have equipped (at most 9). Casting, auto-battle and autogrind only use these. */
	arsenal(save) {
		const set = new Set(save.loadout ?? []);
		return Object.keys(save.abilityRanks ?? {}).filter(id => MOVE_BY_ID[id] && (save.loadout ? set.has(id) : true)).sort((a, b) => (save.loadout ? save.loadout.indexOf(a) - save.loadout.indexOf(b) : 0)).map(id => MOVE_BY_ID[id]);
	}
	spendAbility(id) {
		if (!this.save || this.dead) return false;
		this.syncArsenal(this.save);
		const first = !this.save.abilityRanks?.[id];
		if (!spendAbilityPoint(this.save, id)) return false;
		// A newly unlocked verse goes straight onto the bar while there is room.
		if (first && this.save.loadout.length < MAX_EQUIPPED) this.save.loadout.push(id);
		this.syncArsenal(this.save);
		{
			const mv = MOVE_BY_ID[id], rank = this.save.abilityRanks[id];
			const v = verseValues(mv, rank, moveTactic(mv));
			const what = v.heal ? `heals ${v.heal}` : v.shield ? `wards ${v.shield}` : `power ${v.power}`;
			this.say(`${mv.name} rank ${rank}: ${what} (×${v.mult.toFixed(2)}).`);
		}
		this.persist(); this.syncHud(true); return true;
	}
	syncArsenal(save) {
		const unlocked = Object.keys(save.abilityRanks ?? {}).filter((id) => MOVE_BY_ID[id]);
		const seen = new Set();
		let loadout = (Array.isArray(save.loadout) ? save.loadout : unlocked).filter((id) => unlocked.includes(id) && !seen.has(id) && seen.add(id));
		// First time (or an old save): equip the first 9 unlocked verses.
		if (!Array.isArray(save.loadout)) loadout = loadout.slice(0, MAX_EQUIPPED);
		save.loadout = loadout.slice(0, MAX_EQUIPPED);
		save.known = unlocked;
		save.bar = save.loadout;
	}
	autoBattle() {
		const save = this.save;
		if (!save || this.dead || this.castLock > 0 || this.lunge) return false;
		const foe = this.smartFoe();
		if (!foe) return true;
		const ready = this.arsenal(save).filter((m) => (this.cds[m.id] ?? 0) <= 0);
		const hpPct = save.hp / Math.max(1, this.maxHp());
		const foePct = foe.hp / Math.max(1, foe.max);
		const by = (t: string) => ready.find((m) => moveTactic(m) === t);
		if (hpPct < 0.4 && foePct > 0.18) {
			const heal = by("heal");
			if (heal && this.castMove(heal)) return true;
		}
		if (this.wardT < 0.2 && this.shield < 8 && hpPct < 0.62 && (foe.boss || Math.hypot(foe.x - save.x, foe.y - save.y) < 96)) {
			const ward = by("ward");
			if (ward && this.castMove(ward, foe)) return true;
		}
		if (hpPct < 0.36 && foePct > 0.3) {
			const roll = by("roll");
			if (roll && Math.hypot(foe.x - save.x, foe.y - save.y) < 78 && this.castMove(roll, foe)) return true;
		}
		// A telegraphed blow is about to land: roll or dash out of it if anything is ready.
		if (this.incoming?.some((h) => h.t < 0.3)) {
			const out = by("roll") ?? by("dash") ?? by("blink");
			if (out && this.castMove(out, foe)) return true;
		}
		// Class gimmick: used in real fights (a boss, a witch, or three or more foes close by).
		if (this.autoplay || this.autoCombat) {
			const crowd = this.foesNear(save.x, save.y, 160).length;
			if ((foe.boss || foe.witch || foe.bounty || crowd >= 3 || hpPct < 0.4) && this.gim?.autoUse(foe)) return true;
		}
		return this.castOffense(foe);
	}
	/**
	 * Who auto-combat should hit: finish a wounded foe, take the element you beat,
	 * ignore a hide you cannot touch, and leave a docile animal alone.
	 */
	smartFoe() {
		const save = this.save;
		if (!save) return null;
		const moves = this.arsenal(save).filter((m) => this.isOffense(m) && (this.cds[m.id] ?? 0) <= 0);
		const kit = moves.length ? moves : this.arsenal(save).filter((m) => this.isOffense(m));
		if (!kit.length) return this.nearestMob(save.x, save.y, 52);
		let best = null;
		let bs = Infinity;
		for (const mob of this.mobs) {
			if (!mob.alive) continue;
			const d = Math.hypot(mob.x - save.x, mob.y - save.y);
			const reach = kit.some((mv) => this.moveReaches(mv, d));
			if (!reach) continue;
			if (mob.animal && !mob.aggro && (mob.hurt ?? 0) <= 0) continue;
			// Do not lock onto something it cannot see or hit through a wall.
			if (this.world && wallBetween(this.world, save.x, save.y, mob.x, mob.y) && !(mob.aggro && d < 60)) continue;
			if (this.gim?.active("phase") && !this.gim.isGhost(mob)) continue;
			const usable = kit.filter((mv) => typeChart(mv.type, mob.type) > 0 && this.moveReaches(mv, d));
			if (!usable.length) continue;
			const gap = (mob.level ?? 1) - save.level;
			const hostile = !!(mob.aggro || (mob.hurt ?? 0) > 0);
			if ((mob.boss || mob.hunter || (mob.witch && !mob.party)) && gap > 3 && !hostile) continue;
			const hpPct = mob.hp / Math.max(1, mob.max);
			const edge = usable.reduce((n, mv) => Math.max(n, typeChart(mv.type, mob.type)), 0);
			let score = d * (edge >= 2 ? 0.62 : edge < 1 ? 1.35 : 1);
			if (hpPct < 0.28) score -= 220;
			else if (hpPct < 0.5) score -= 70;
			if (hostile) score -= 80;
			score += Math.max(0, gap) * 22;
			if (score < bs) { bs = score; best = mob; }
		}
		return best;
	}
	moveScore(m, foe, magicBetter, dist) {
		const tac = moveTactic(m);
		const form = attackForm(m);
		const edge = typeChart(m.type, foe.type);
		if (edge === 0) return -999;
		const rank = this.save?.abilityRanks?.[m.id] ?? 1;
		const est = verseValues(m, rank, tac).power * edge * (magicBetter === (form === "spell" || tac === "channel") ? 1.2 : 0.82);
		let score = est + m.priority * 4;
		const over = est - (foe.hp ?? est);
		if (over > 14) score -= over * 0.4;
		if (edge >= 2) score += 18;
		if (tac === "blink" && dist > 40) score += 16;
		if (tac === "lunge" && dist > 36 && dist <= MELEE_MAX_REACH) score += 14;
		if (tac === "heavy" && dist < 60 && (foe.hp ?? 0) > est * 0.8) score += 12;
		if (tac === "channel" && dist < this.playerReach(m)) score += 8;
		return score;
	}
	/** Casts a verse. An imbued weapon adds its layer to everything this cast draws. */
	castMove(move, prefer) {
		this.castImbue = this.playerImbue();
		try {
			return this.castMoveInner(move, prefer);
		} finally {
			this.castImbue = null;
		}
	}
	/** The imbue layer from your worn gear (an imbued Rare+ weapon), cached until your gear changes. */
	playerImbue() {
		const save = this.save;
		if (!save) return null;
		const key = Object.values(save.equipped ?? {}).join("|");
		if (this.imbueKey === key) return this.imbueCache;
		const qualities = ["worn", "common", "fine", "rare", "epic", "legendary"];
		const pieces = ["weapon", "head", "chest", "legs", "feet", "relic"].map((slot) => this.piece(slot)).filter(Boolean)
			.map((g) => ({ slot: g.slot, style: g.style, type: g.type, fxSeed: g.fxSeed, gene: geneSeedOf(g), quality: Math.max(0, qualities.indexOf(g.quality)) }));
		this.imbueKey = key;
		this.imbueCache = gearImbue(pieces);
		return this.imbueCache;
	}
	castMoveInner(move, prefer) {
		const save = this.save;
		if (!save || this.dead || snap.panel === "death" || !save.abilityRanks?.[move.id]) return false;
		if (this.castLock > 0 || this.lunge || this.rush || this.orbit) return false;
		if (this.status.some((s) => s.id === "sleep")) return false;
		if ((this.cds[move.id] ?? 0) > 0) return false;
		if (this.status.some((s) => s.id === "silence") && move.priority < 2 && move.effect !== "mend") return false;
		const tactic = moveTactic(move);
		if (tactic === "aura") return this.toggleAura(move);
		const kind = movementKind(move);
		if (kind === "rush") return this.castRush(move, prefer);
		if (kind === "orbit") return this.castOrbit(move, prefer);
		if (kind === "slam") return this.castSlam(move, prefer);
		const selfCast = tactic === "heal" || tactic === "ward" || tactic === "roll" || tactic === "dash" || tactic === "surge" || move.effect === "mend" || move.effect === "shell";
		const reach = this.playerReach(move);
		// Melee is strictly within 2 tiles: no padding. Ranged verses keep a little slack.
		const pad = attackForm(move) === "melee" ? 0 : tactic === "blink" || tactic === "lunge" ? 8 : 4;
		const distTo = (mob) => Math.hypot(mob.x - save.x, mob.y - save.y);
		let target = null;
		if (!selfCast) {
			if (prefer && prefer.alive && distTo(prefer) <= reach + pad) target = prefer;
			else target = this.nearestMob(save.x, save.y, reach + pad + 0.5);
		}
		if (!selfCast && !target && tactic !== "blink" && tactic !== "lunge") return false;
		const rootedNow = this.status.some((s) => s.id === "root" && s.t > 0);
		if (tactic === "dash" && rootedNow) {
			this.float(save.x, save.y - 40, "ROOTED", "#6ecf6a");
			return false;
		}
		const form = attackForm(move);
		const cd = this.moveCooldown(move);
		if (this.turbz) this.payPool?.(move);
		this.cds[move.id] = cd;
		this.cdMax = this.cdMax ?? {};
		this.cdMax[move.id] = cd;
		this.attackT = tactic === "heavy" ? 1 : .8;
		this.combat = 3;
		// Every verse you cast grinds the mastery of its element.
		this.gainSkill(masteryOf(move.type), 3);
		if (target && target.x < save.x) this.facing = -1;
		else if (target) this.facing = 1;
		if (tactic === "ward") {
			this.wardT = 3;
			this.shield = Math.max(this.shield, (12 + move.power) * abilityMultiplier(save, move.id));
			this.float(save.x, save.y - 48, "WARD", "#fff1a8");
			this.say("Warded for three seconds.");
			this.playMoveFx(move, save.x, save.y - 24, save.x, save.y - 24);
			return true;
		}
		if (tactic === "heal" || move.effect === "mend") {
			const heal = (18 + Math.max(8, move.power) * .45) * abilityMultiplier(save, move.id);
			save.hp = Math.min(this.maxHp(), save.hp + heal);
			if (this.rules === "hardcore") this.persist();
			this.float(save.x, save.y - 48, `+${Math.floor(heal)}`, "#9ad8c8");
			this.playMoveFx(move, save.x, save.y - 24, save.x, save.y - 20);
			return true;
		}
		if (tactic === "surge") {
			this.addStatus("swift", 4);
			this.buff = { ...this.buff, crit: move.id === "rallycry" || move.id === "battlerush" ? 12 : 6, t: 4, type: move.type };
			this.float(save.x, save.y - 48, "SWIFT", "#9ad8c8");
			this.playMoveFx(move, save.x, save.y - 24, save.x, save.y - 24);
			this.cue("sparkle", { rate: 1.3, len: 0.6, vol: 0.24 }, [520, .08, "triangle"]);
			return true;
		}
		if (tactic === "dash") {
			const failPct = defenseFail(move, this.defFatigue ?? 0);
			const failed = Math.random() * 100 < failPct;
			this.defFatigue = (this.defFatigue ?? 0) + (failed ? 1 : 0.5);
			const fd = this.freeDir(null);
			const dx = fd.x, dy = fd.y, l = 1;
			const dist = failed ? 18 : 96 * Math.max(.8, this.speedMult());
			const x0 = save.x, y0 = save.y;
			for (let i = 0; i < 8; i++) this.tryMove(dx / l * dist / 8, dy / l * dist / 8);
			this.dest = null;
			this.rollT = failed ? 0 : .35;
			if (!failed) this.evadeT = .42;
			this.incoming = (this.incoming ?? []).filter((h) => h.form !== "melee" || Math.hypot(save.x - h.ax, save.y - h.ay) < 30);
			this.rollCoverNow = 1;
			this.rollFailed = false;
			this.float(save.x, save.y - 40, failed ? "SLIP" : "DASH", failed ? "#c4473a" : "#e7d9ff");
			this.playMoveFx(move, x0, y0 - 14, save.x, save.y - 14);
			if (!failed && move.power > 0) {
				const hit = this.nearestMob(save.x, save.y, 60);
				if (hit) this.resolveHit(move, hit, false, .6);
			}
			return true;
		}
		if (tactic === "roll") {
			const failPct = defenseFail(move, this.defFatigue ?? 0);
			const failed = Math.random() * 100 < failPct;
			this.defFatigue = (this.defFatigue ?? 0) + (failed ? 1.15 : 0.75);
			const travel = failed ? 8 : 48 + Math.random() * 40;
			if (!failed) this.evadeT = .45;
			if (!failed) this.incoming = (this.incoming ?? []).filter((h) => h.form !== "melee" || Math.hypot(save.x - h.ax, save.y - h.ay) < 30);
			this.rollCoverNow = rollCover(travel, 78);
			this.rollFailed = failed;
			this.rollT = 0.5;
			const side = this.facing > 0 ? 1 : -1;
			if (!failed) this.tryMove(-side * travel * 0.45, side * Math.min(30, travel * 0.32));
			this.float(save.x, save.y - 36, failed ? "TRIP" : "ROLL", failed ? "#c4473a" : "#e7d9ff");
			this.playMoveFx(move, save.x, save.y - 10, save.x + side * 20, save.y);
			if (!failed && target && move.power > 0 && Math.hypot(target.x - save.x, target.y - save.y) < 86) this.resolveHit(move, target, false, 0.36);
			return true;
		}
		if (tactic === "blink") {
			// Free movement: a blink goes where you steer (or the way you face), never onto a foe.
			const wasRooted = this.status.some((s) => (s.id === "root" || s.id === "soak") && s.t > 0);
			endStatus(this.status, "root");
			this.status = this.status.filter((s) => s.id !== "soak");
			if (wasRooted) this.float(save.x, save.y - 58, "BREAK FREE", "#6ecf6a");
			const failPct = target ? defenseFail(move, this.defFatigue ?? 0) : 0;
			const snag = Math.random() * 100 < failPct;
			this.defFatigue = Math.max(0, (this.defFatigue ?? 0) + (snag ? 1 : -0.2));
			const dir = this.freeDir(prefer ? target : null);
			const x0 = save.x, y0 = save.y;
			const to = this.freeTravel(dir, snag ? 36 : 96, true);
			save.x = to.x; save.y = to.y;
			this.dest = null;
			if (!snag) { this.evadeT = .45; this.incoming = (this.incoming ?? []).filter((h) => h.form !== "melee"); }
			if (dir.x) this.facing = dir.x > 0 ? 1 : -1;
			this.float(save.x, save.y - 46, snag ? "SNAG" : "BLINK", snag ? "#c4473a" : "#b4a6ff");
			this.playMoveFx(move, x0, y0 - 20, save.x, save.y - 20);
			if (move.power > 0) {
				const hit = this.nearestMob(save.x, save.y, 72);
				if (hit) {
					const blinkMiss = Math.random() * 100 > move.accuracy;
					const d = this.playMoveFx(move, save.x, save.y - 20, hit.x, hit.y - 12, { miss: blinkMiss });
					this.later(d, () => { if (hit.alive) this.resolveHit(move, hit, false, snag ? 0.24 : 0.55, { missed: blinkMiss }); });
				}
			}
			return true;
		}
		if (tactic === "lunge") {
			// Free movement: lunge a set distance where you steer and strike whatever is there.
			const failPct = defenseFail(move, this.defFatigue ?? 0);
			const failed = Math.random() * 100 < failPct;
			this.defFatigue = (this.defFatigue ?? 0) + (failed ? 1 : 0.45);
			const dir = this.freeDir(prefer ? target : null);
			if (dir.x) this.facing = dir.x > 0 ? 1 : -1;
			const to = this.freeTravel(dir, failed ? 40 : 104, false);
			const dist = target ? Math.hypot(target.x - save.x, target.y - save.y) : reach;
			const meleePlan = planMelee(this.meleeChain ?? freshMelee(), move.id, tactic, dist, reach);
			this.lunge = {
				t: 0,
				dur: .42,
				ox: save.x,
				oy: save.y,
				tx: to.x,
				ty: to.y,
				mob: null,
				hit: false,
				failed,
				power: move.power,
				moveId: move.id,
				meleePlan
			};
			if (!failed) this.evadeT = .42;
			this.cds[move.id] = Math.max(cd, .9);
			if (failed) this.float(save.x, save.y - 40, "SNAG", "#c4473a");
			return true;
		}
		if (tactic === "heavy" || tactic === "channel") {
			this.castLockMax = tactic === "channel" ? 1.15 : .62;
			this.castLock = this.castLockMax;
		}
		// Weapon blows land with the synthesised strike (heavier = lower); spells and shots get the airy cast whoosh.
		if (attackForm(move) === "melee") this.cue("hit", { rate: Math.max(0.7, 1.35 - move.power / 120) }, [140 + move.priority * 40 + move.power, .06, "square"]);
		else this.cue("cast", { rate: Math.max(0.7, Math.min(1.5, 0.8 + move.priority * 0.15 + (move.type === "electric" ? 0.25 : 0))) }, [140 + move.priority * 40 + move.power, .06, move.type === "electric" ? "sawtooth" : "square"]);
		if (move.effect === "shell") {
			this.playMoveFx(move, save.x, save.y - 24, save.x + this.facing * 30, save.y - 20);
			this.shield = Math.max(this.shield, 20 + move.power);
			this.wardT = Math.max(this.wardT, 1.2);
			this.say("Urn shell.");
			return true;
		}
		let mult = tactic === "heavy" ? 1.7 : tactic === "channel" ? 1.25 : 1;
		let meleePlan = null;
		let spellPlan = null;
		if (target && form === "melee" && (tactic === "strike" || tactic === "heavy")) {
			const dist = Math.hypot(target.x - save.x, target.y - save.y);
			meleePlan = planMelee(this.meleeChain ?? freshMelee(), move.id, tactic, dist, reach);
			mult *= meleePlan.mult;
		}
		if (form === "spell" && tactic !== "heal" && tactic !== "ward" && tactic !== "aura" && move.effect !== "mend") {
			spellPlan = planSpell(this.weave ?? freshWeave(), move.type, tactic, move.priority ?? 1);
			mult *= spellPlan.mult;
			this.weave = commitSpell(this.weave ?? freshWeave(), move.type, spellPlan);
			if (spellPlan.overcast) this.overcastT = 3.4;
			if (spellPlan.refund > 0) {
				this.cds[move.id] = Math.max(.2, (this.cds[move.id] ?? 0) * (1 - spellPlan.refund));
				this.cdMax[move.id] = this.cds[move.id];
			}
		}
		if (target) {
			const volley = form === "ranged" && rangedStyle(move) === "volley";
			this.strike(move, save.x, save.y - 24, target, { mult, volley, meleePlan, spellPlan });
		} else this.playMoveFx(move, save.x, save.y - 24, save.x + this.facing * 30, save.y - 20);
		if (form === "spell" || tactic === "channel") this.gainSkill("magic", 3);
		else this.gainSkill("physical", 2);
		return true;
	}
	/** Pay the verse's cooldown and grind, once a movement attack has actually started. */
	spendMove(move, floor = 0) {
		if (this.turbz) this.payPool?.(move);
		const cd = Math.max(this.moveCooldown(move), floor);
		this.cds[move.id] = cd;
		this.cdMax = this.cdMax ?? {};
		this.cdMax[move.id] = cd;
		this.combat = 3;
		this.gainSkill(masteryOf(move.type), 3);
		this.gainSkill("physical", 2);
		this.cue("hit", { rate: Math.max(0.7, 1.35 - move.power / 120) }, [140 + move.priority * 40 + move.power, .06, "square"]);
	}
	/**
	 * Tri Blitz, Void Prowl, Blood Bound: run through up to three foes and hit each one at full strength.
	 */
	castRush(move, prefer) {
		const save = this.save;
		const radius = move.chain?.range ?? move.range ?? 120;
		const count = 1 + (move.chain?.jumps ?? 2);
		const foes = this.mobs.filter((m) => m.alive);
		const picked = pickRushTargets(save, foes, radius, count, prefer?.alive ? prefer : null);
		if (!picked.length) return false;
		this.spendMove(move, 1.1);
		const first = picked[0];
		this.facing = first.x < save.x ? -1 : 1;
		this.rush = { moveId: move.id, ids: picked.map((m) => m.id), i: 0, hop: moveTactic(move) === "blink" };
		this.float(save.x, save.y - 42, picked.length >= 3 ? "TRIPLE" : "RUSH", "#fff1a8");
		this.dest = null;
		return true;
	}
	tickRush(dt) {
		const save = this.save;
		const rush = this.rush;
		if (!save || !rush) return;
		const move = MOVE_BY_ID[rush.moveId];
		if (!move) { this.rush = null; return; }
		let mob = null;
		while (rush.i < rush.ids.length && !mob) {
			mob = this.mobs.find((m) => m.id === rush.ids[rush.i] && m.alive) ?? null;
			if (!mob) rush.i++;
		}
		if (!mob) { this.rush = null; return; }
		const dx = mob.x - save.x;
		const dy = mob.y - save.y;
		const dist = Math.hypot(dx, dy) || 1;
		this.facing = dx < 0 ? -1 : 1;
		this.attackT = 1;
		if (dist > 28) {
			const before = dist;
			const step = Math.min((rush.hop ? 640 : 420) * dt, dist - 22);
			const dir = { x: dx / dist, y: dy / dist };
			if (rush.hop) {
				const to = this.freeTravel(dir, Math.max(8, dist - 22), true);
				save.x = to.x;
				save.y = to.y;
			} else this.tryMove(dir.x * step, dir.y * step);
			const after = Math.hypot(mob.x - save.x, mob.y - save.y);
			if (after > 28 && after > before - 1) {
				rush.stuck = (rush.stuck ?? 0) + 1;
				if (rush.stuck < 8) return;
				rush.stuck = 0;
				rush.i++;
				if (rush.i >= rush.ids.length) this.rush = null;
				return;
			}
			if (after > 28) return;
		}
		const n = rush.i + 1;
		this.float(mob.x, mob.y - 46, String(n), "#fff1a8");
		const d = this.playMoveFx(move, save.x, save.y - 16, mob.x, mob.y - 12, { imbue: this.playerImbue() });
		const id = mob.id;
		this.later(d, () => {
			const live = this.mobs.find((m) => m.id === id && m.alive);
			if (live) this.resolveHit(move, live, false, 1);
		});
		rush.i++;
		if (rush.i >= rush.ids.length) this.rush = null;
	}
	/** Orbit Strike, Grave Circle, Ember Spin: circle them. An unbroken loop always crits. */
	castOrbit(move, prefer) {
		const save = this.save;
		const reach = this.playerReach(move);
		let target = null;
		if (prefer?.alive && Math.hypot(prefer.x - save.x, prefer.y - save.y) <= reach) target = prefer;
		else target = this.nearestMob(save.x, save.y, reach);
		if (!target) return false;
		if (this.status.some((s) => s.id === "root" && s.t > 0)) {
			this.float(save.x, save.y - 40, "ROOTED", "#6ecf6a");
			return false;
		}
		this.spendMove(move, 1.4);
		this.facing = target.x < save.x ? -1 : 1;
		this.castLockMax = 0.9;
		this.castLock = 0.9;
		this.orbit = { moveId: move.id, mobId: target.id, t: 0, dur: 0.9, ang0: Math.atan2(save.y - target.y, save.x - target.x), broken: false };
		this.playMoveFx(move, save.x, save.y - 16, target.x, target.y - 12, { imbue: this.playerImbue() });
		this.float(save.x, save.y - 42, "ORBIT", "#e7d9ff");
		this.dest = null;
		return true;
	}
	tickOrbit(dt) {
		const save = this.save;
		const orbit = this.orbit;
		if (!save || !orbit) return;
		const move = MOVE_BY_ID[orbit.moveId];
		const mob = this.mobs.find((m) => m.id === orbit.mobId && m.alive);
		if (!move || !mob) { this.orbit = null; this.castLock = 0; return; }
		orbit.t += dt;
		const u = Math.min(1, orbit.t / orbit.dur);
		const ang = orbit.ang0 + u * Math.PI * 2;
		const x = mob.x + Math.cos(ang) * 26;
		const y = mob.y + Math.sin(ang) * 26;
		if (!blocked(this.world, x, y)) { save.x = x; save.y = y; }
		this.facing = mob.x < save.x ? -1 : 1;
		this.attackT = 1;
		if (u < 1) return;
		this.orbit = null;
		this.castLock = 0;
		const whole = !orbit.broken;
		this.float(mob.x, mob.y - 58, whole ? "LOOP" : "BROKEN", whole ? "#fff1a8" : "#c4473a");
		this.resolveHit(move, mob, false, 1, { forceCrit: whole });
	}
	/** Crash Down, Storm Cleave, Tide Crasher: close the gap and land the heavy hit, splash included. */
	castSlam(move, prefer) {
		const save = this.save;
		const reach = move.range ?? 160;
		let target = null;
		if (prefer?.alive && Math.hypot(prefer.x - save.x, prefer.y - save.y) <= reach) target = prefer;
		else target = this.nearestMob(save.x, save.y, reach);
		if (!target) return false;
		if (this.status.some((s) => s.id === "root" && s.t > 0)) {
			this.float(save.x, save.y - 40, "ROOTED", "#6ecf6a");
			return false;
		}
		this.spendMove(move, 1.2);
		const dx = target.x - save.x;
		const dy = target.y - save.y;
		const dist = Math.hypot(dx, dy) || 1;
		const dir = { x: dx / dist, y: dy / dist };
		if (dir.x) this.facing = dir.x > 0 ? 1 : -1;
		const to = this.freeTravel(dir, Math.max(0, dist - 20), false);
		this.lunge = {
			t: 0,
			dur: .36,
			ox: save.x,
			oy: save.y,
			tx: to.x,
			ty: to.y,
			mob: target,
			hit: false,
			failed: false,
			power: move.power,
			moveId: move.id,
			slam: true
		};
		this.evadeT = .3;
		this.dest = null;
		return true;
	}
	tickLunge(dt) {
		const save = this.save;
		const lung = this.lunge;
		if (!save || !lung) return;
		lung.t += dt;
		const u = Math.min(1, lung.t / lung.dur);
		// A slam stays where it lands. Other lunges spring back.
		const along = lung.slam ? Math.min(1, u / 0.72) : (u < .45 ? u / .45 : 1 - (u - .45) / .55);
		save.x = lung.ox + (lung.tx - lung.ox) * Math.max(0, along);
		save.y = lung.oy + (lung.ty - lung.oy) * Math.max(0, along);
		this.attackT = 1;
		if (!lung.hit && u >= (lung.slam ? 0.72 : 0.4)) {
			lung.hit = true;
			const move = MOVE_BY_ID[lung.moveId] ?? MOVES.find((m) => moveTactic(m) === "lunge") ?? MOVES[0];
			if (lung.slam) {
				const mob = lung.mob?.alive && Math.hypot(lung.mob.x - save.x, lung.mob.y - save.y) < 84 ? lung.mob : this.nearestMob(save.x, save.y, 72);
				const missed = Math.random() * 100 > move.accuracy;
				const d = this.playMoveFx(move, save.x, save.y - 16, mob ? mob.x : lung.tx, mob ? mob.y - 12 : lung.ty, { miss: missed, imbue: this.playerImbue() });
				if (mob) this.later(d, () => {
					if (!mob.alive) return;
					this.resolveHit(move, mob, false, 1.45, { missed });
					if (!missed && move.splash) {
						for (const other of this.foesNear(mob.x, mob.y, move.splash.radius)) {
							if (other !== mob && other.alive) this.resolveHit(move, other, false, 1.45 * move.splash.mult, { child: true });
						}
					}
				});
			} else {
				const mob = this.nearestMob(save.x, save.y, 64);
				const lungeMiss = Math.random() * 100 > move.accuracy;
				const d = this.playMoveFx(move, save.x, save.y - 16, mob ? mob.x : lung.tx, mob ? mob.y - 12 : lung.ty, { miss: lungeMiss, imbue: this.playerImbue() });
				if (mob) this.later(d, () => { if (mob.alive) this.resolveHit(move, mob, false, (lung.failed ? 0.22 : 0.72) * (lung.meleePlan?.mult ?? 1), { missed: lungeMiss, depth: true, meleePlan: lung.meleePlan }); });
			}
		}
		if (u >= 1) this.lunge = null;
	}
	/**
	 * Every multiplier that goes into one hit, in one place. resolveHit uses it for real damage and the
	 * character sheet uses it to show the same numbers, so the sheet can never drift from combat.
	 * With no `mob`, target-specific parts (type chart, hide, conditional bonuses) are left neutral and a
	 * reference armor of a same-level foe is used for ranged hits.
	 */
	damageParts(move, mob = null, { fromPet = false, mult = 1, crit = false, pet = null } = {}) {
		const save = this.save;
		const form = attackForm(move);
		const tactic = moveTactic(move);
		const pure = form === "spell";
		const magicLike = pure || tactic === "channel";
		const weapon = this.piece("weapon");
		const weaponDmg = weapon ? equipmentStats(weapon).damage : 0;
		const base = 6 + move.power * .42 + (form !== "spell" && weapon ? weaponDmg * .35 : 0);
		const f = [];
		const add = (id, label, value) => { f.push({ id, label, value }); };
		// A ghost hits with its own level, not yours.
		add("level", pet ? "Ghost level" : "Level", 1 + (pet ? Math.min(pet.level ?? 1, save.level + GHOST_LEVEL_LEAD) : save.level) * .045);
		add("stab", "Matching element gear", pure ? 1 : this.stab(move.type));
		if (mob) add("tm", "Element vs target", pure ? 1 : typeChart(move.type, mob.type));
		add("might", "Might enchants", 1 + this.chan("might") / 100);
		add("hunting", "Hunting skill", 1 + this.skillN("hunting") * 0.002);
		if (form === "ranged") add("form_enchant", "Hunter's Eye", 1 + this.chan("hunter_eye") / 100);
		else if (form !== "spell") add("form_enchant", "Keen Edge", 1 + this.chan("edge") / 100);
		if (save.hp < this.maxHp() * 0.4) add("last_stand", "Last Stand", 1 + this.chan("last_stand") / 100);
		if (mob && mob.max > 0 && mob.hp < mob.max * 0.35) add("execute", "Execute", 1 + this.chan("execute") / 100);
		if (mob && mob.level > save.level) add("giant_bane", "Giant Bane", 1 + this.chan("giant_bane") / 100);
		if (mob?.boss) add("boss", "Boss Bane", 1 + this.chan("boss_bane") / 100);
		if (this.skillN(masteryOf(move.type))) add("mastery", `${TYPES[move.type]?.name ?? ""} Mastery`, 1 + this.skillN(masteryOf(move.type)) * .006);
		if (mob && (mob.bounty || mob.witch || mob.hunter) && this.skillN("bountyhunting")) add("bountyhunting", "Bounty Hunting skill", 1 + this.skillN("bountyhunting") * .005);
		if (this.status.some((s) => s.id === "gloom")) add("gloom", "Gloom", .8);
		if (!pure) add("phys", "Physical skill", 1 + this.skillN("physical") * (form === "melee" ? .02 : .015));
		if (pure) {
			add("mag", "Magic skill", 1.45 * (1 + this.skillN("magic") * .025));
			add("spellweave", "Spellweave + Hymn", (1 + this.chan("spellweave") / 100) * (1 + this.chan("hymn") / 100));
		}
		if (form === "melee") add("melee", "Melee strength", 1.35);
		if (mob) {
			const read = bodyRead(mob.type);
			add("hide", "Target's hide", magicLike ? (read.kind === "magic" ? 1.2 : .8) : (read.kind === "physical" ? 1.2 : .8));
		}
		if (mult !== 1) add("mult", "Move shape", mult);
		if (fromPet) {
			add("pet", "Ghost strength", .62);
			if (this.skillN("ghostkeeping")) add("ghostkeeping", "Ghostkeeping skill", 1 + this.skillN("ghostkeeping") * .004);
		}
		if (crit) add("crit", "Critical hit", 1.75 * (1 + bend(this.chan("crit_force") / 100, 0.8, 0.97)));
		if (!fromPet) {
			add("rank", "Verse rank", abilityMultiplier(save, move.id));
			add("class", magicLike ? "Class Arcana" : "Class Might", bendDown(1 + this.mod(magicLike ? "arcana" : "might") / 100, 0.2, 0.05));
			if (move.type === CLASS_BY_ID[save.classId]?.type) add("affinity", "Element Affinity", 1 + this.mod("affinity") / 100);
		}
		let dmg = base;
		for (const x of f) dmg *= x.value;
		let armor = 0;
		if (form === "melee") {
			// Melee ignores all armor (MELEE_ARMOR_PIERCE), so Armor Crack has nothing to remove either.
			add("armor", "Target armor ignored", 1);
		} else if (form === "ranged") {
			// Spells ignore armor; ranged hits face all of it.
			const targetArmor = mob ? this.mobArmor(mob) : 4 + save.level * 2;
			armor = defenseVs(form, targetArmor) - this.chan("armor_crack");
			dmg = mitigate(dmg, armor);
			add("armor", `Target armor ${Math.max(0, Math.round(armor))}`, 100 / (100 + Math.max(0, armor)));
		}
		if (mob?.status?.some((s) => s.id === "expose")) { dmg *= 1.25; add("expose", "Exposed", 1.25); }
		return { dmg: Math.max(1, dmg), base, factors: f, form };
	}
	critChanceOf(move) {
		return move.crit + this.chan("crit_edge") + (this.buff.t > 0 ? this.buff.crit : 0) + this.mod("crit");
	}
	/** Seconds before this verse can be cast again. castMove and the sheet both use this. */
	/**
	 * Direction for movement verses: the keys or stick you hold, else the way you face. Automatic
	 * casts (auto-battle) with nothing held head toward their foe, but still travel a set distance.
	 */
	freeDir(autoToward) {
		const save = this.save;
		let dx = (this.held("KeyD") || this.held("ArrowRight") ? 1 : 0) - (this.held("KeyA") || this.held("ArrowLeft") ? 1 : 0) + (this.stick?.x ?? 0);
		let dy = (this.held("KeyS") || this.held("ArrowDown") ? 1 : 0) - (this.held("KeyW") || this.held("ArrowUp") ? 1 : 0) + (this.stick?.y ?? 0);
		if (Math.hypot(dx, dy) < .2 && this.dest && Math.hypot(this.dest.x - save.x, this.dest.y - save.y) > 8) { dx = this.dest.x - save.x; dy = this.dest.y - save.y; }
		if (Math.hypot(dx, dy) < .2 && autoToward?.alive) { dx = autoToward.x - save.x; dy = autoToward.y - save.y; }
		if (Math.hypot(dx, dy) < .2) {
			const dir = this.direction ?? (this.facing < 0 ? "left" : "right");
			dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
			dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
		}
		const l = Math.hypot(dx, dy) || 1;
		return { x: dx / l, y: dy / l };
	}
	/** The farthest open spot up to `dist` px along `dir`. A blink may hop over walls; others stop at them. */
	freeTravel(dir, dist, hop) {
		const save = this.save;
		let best = { x: save.x, y: save.y };
		for (let d = 8; d <= dist; d += 8) {
			const x = save.x + dir.x * d, y = save.y + dir.y * d;
			if (blocked(this.world, x, y)) { if (hop) continue; break; }
			best = { x, y };
		}
		if (hop) { const far = { x: save.x + dir.x * dist, y: save.y + dir.y * dist }; if (!blocked(this.world, far.x, far.y)) best = far; }
		return best;
	}
	moveCooldown(move) {
		const tactic = moveTactic(move);
		const form = attackForm(move);
		let cd = baseMoveCooldown(move) * (1 - bend(this.chan("swift") / 100, 0.4, 0.75));
		if (form === "spell" && tactic !== "heavy" && tactic !== "channel") cd *= rateMult(this.skillN("magic") * 0.2) * (1 - bend(this.chan("focus") / 100, 0.35, 0.7));
		cd *= rateMult(this.skillN(masteryOf(move.type)) * 0.1);
		if (tactic === "roll") cd = Math.max(cd, 2.6);
		if (tactic === "ward") cd = Math.max(cd, 5.5);
		if (tactic === "heal") cd = Math.max(cd, 3.2);
		if (tactic === "dash") cd = Math.max(cd, 1.6);
		if (tactic === "surge") cd = Math.max(cd, 8);
		if (this.turbz && this.pools) {
			if (form === "spell" && this.pools.manaSlow > 0) cd *= 2;
			if (form === "melee" && this.pools.stamSlow > 0) cd *= 2;
		}
		return Math.max(.2, cd * (1 - bendSigned(this.mod("haste") / 100, -1.5, -0.4, 0.45, 0.82)));
	}
	resolveHit(move, mob, fromPet, mult = 1, opts = {}) {
		const save = this.save;
		const form = attackForm(move);
		if (opts.missed ?? Math.random() * 100 > move.accuracy) {
			this.float(mob.x, mob.y - 36, "MISS", "#e8dcc4");
			return;
		}
		if (mob.rival && this.rivalDodge(mob)) return;
		const pure = form === "spell";
		const tm = pure ? 1 : typeChart(move.type, mob.type);
		if (!pure && tm === 0) {
			this.float(mob.x, mob.y - 36, "IMMUNE", "#e7d9ff");
			return;
		}
		if (Math.random() < bend(Math.max(0, (mob.stats?.dodge ?? 0) + (mob.enraged && (mob.bounty || mob.bountySpirit) ? BOUNTY_ENRAGE.dodge : 0)), 0.35, 0.8)) {
			this.float(mob.x, mob.y - 36, "DODGE", "#e7d9ff");
			return;
		}
		const crit = !!opts.forceCrit || Math.random() * 100 < (opts.pet ? move.crit + (opts.pet.rarity ?? 0) * 2 + (opts.pet.shiny ? 5 : 0) : this.critChanceOf(move));
		let dmg = this.damageParts(move, mob, { fromPet, mult, crit, pet: opts.pet }).dmg;
		dmg *= 1 - bend(Math.max(0, pure ? (mob.stats?.spellRes ?? 0) : defenseVs(form, mob.stats?.physRes ?? 0)), 0.55, 0.88);
		if (pure) {
			const school = schoolMult(move.type, (mob.status ?? []).map((s) => s.id));
			if (school.mult !== 1) {
				dmg *= school.mult;
				if (!fromPet && !opts.child && school.label) this.float(mob.x, mob.y - 70, school.label, TYPES[move.type]?.color ?? "#c9a6e8");
			}
		}
		// Melee ignores the Warded enchant too: applyMobDamage takes 15% off every hit, so give it back first.
		if (form === "melee" && mob.enchants?.includes("warded")) dmg /= .85;
		let hits = !fromPet && Math.random() * 100 < Math.min(100, Math.max(0, this.chan("double_strike"))) ? 2 : 1;
		if (form === "ranged" && rangedStyle(move) === "volley") {
			hits = 3;
			dmg *= .55;
		}
		this.damageMob(mob, dmg, crit);
		// Extra strikes (double strike, volleys) land one after another instead of all at once.
		for (let i = 1; i < hits; i++) this.later(i * (opts.stagger || .1), () => { if (mob.alive) this.damageMob(mob, dmg, false); });
		this.applyEffect(move, mob, true);
		if (!fromPet && mob.alive && this.chan("ghost_burn") > 0 && Math.random() * 100 < this.chan("ghost_burn")) this.applyMobStatus(mob, "burn", 4);
		if (!fromPet && this.mod("leech") > 0) save.hp = Math.min(this.maxHp(), save.hp + dmg * this.mod("leech") / 100);
		if (!fromPet && this.chan("leech_edge") > 0) save.hp = Math.min(this.maxHp(), save.hp + dmg * this.chan("leech_edge") / 100);
		if (move.effect === "leech" && (this.rules !== "hardcore" || attackForm(move) === "spell")) save.hp = Math.min(this.maxHp(), save.hp + dmg * .35);
		if (!fromPet && !opts.child && opts.depth) this.noteFightDepth(move, mob, opts);
	}
	/** A landed melee or spell updates the chain or the weave. Misses, dodges and extra splashes do not. */
	noteFightDepth(move, mob, opts) {
		if (this.role === "guest" || !mob) return;
		const melee = opts.meleePlan;
		if (melee) {
			this.meleeChain = commitMelee(this.meleeChain ?? freshMelee(), melee, move.id);
			if (melee.label) this.float(mob.x, mob.y - 52, melee.label, melee.step >= 3 ? "#fff1a8" : "#e6c15a");
			if (melee.cleave) {
				for (const m of this.foesNear(mob.x, mob.y, 46)) if (m !== mob && m.alive) this.resolveHit(move, m, false, 0.45, { child: true });
			}
			if (melee.poise > 0) {
				mob.poise = (mob.poise ?? 0) + melee.poise;
				if (mob.poise >= 3) {
					mob.poise = 0;
					const opened = this.applyMobStatus(mob, "expose", 3.4);
					if (opened === "applied" || opened === "refreshed") this.float(mob.x, mob.y - 64, "OPEN", "#fff1a8");
				}
			}
		}
		const spell = opts.spellPlan;
		if (spell) {
			if (spell.label) this.float(mob.x, mob.y - 52, spell.label, spell.overcast ? "#fff1a8" : "#c9a6e8");
			if (spell.splash > 0) {
				for (const m of this.foesNear(mob.x, mob.y, spell.splash)) if (m !== mob && m.alive) this.resolveHit(move, m, false, spell.splashMult, { child: true });
			}
			if (spell.label === "RESONANCE" || spell.overcast) {
				const id = move.effect === "drain" ? "leech" : move.effect;
				const st = id && id !== "none" ? mob.status?.find((s) => s.id === id) : null;
				if (st) st.t = Math.min(SOFT_CAP[st.id] ?? 6, st.t + 1.1);
			}
		}
	}
	damageMob(mob, dmg, crit) {
		const gm = this.gim ? this.gim.dealMult(mob) : 1;
		if (gm <= 0) { this.float(mob.x, mob.y - 30, "PHASED", "#9ad8ff"); return; }
		const amount = Math.floor(dmg * gm);
		if (this.role === "guest") {
			this.room?.send({
				t: "dmg",
				id: mob.id,
				amount
			});
			this.float(mob.x, mob.y - 30, `${amount}${crit ? "!" : ""}`, crit ? "#fff1a8" : "#f0e2c8");
			mob.hurt = 1;
			return;
		}
		this.applyMobDamage(mob, amount, crit);
		this.gim?.onHit(mob, amount, crit);
		// Thorned foes bite back, at most 4% of your health a hit and three times a second.
		if (mob.enchants?.includes("thorned") && (mob.thornT ?? 0) <= 0 && !this.dead && this.save) {
			mob.thornT = .33;
			const back = Math.min(this.maxHp() * .04, amount * .12);
			if (back >= 1) this.hurtSelf(back, null);
		}
	}
	applyMobDamage(mob, amount, crit = false) {
		if (!mob?.alive || !Number.isFinite(amount) || amount <= 0 || this.dead) return;
		if (mob.enchants?.includes("warded")) amount = Math.max(1, Math.floor(amount * .85));
		if (mob.wardT > 0) amount = Math.max(1, Math.floor(amount * .6));
		mob.hp -= amount;
		mob.hurt = 1;
		// Any hit wakes a sleeper (and leaves it immune to sleep for a while).
		if (hasStatus(mob.status, "sleep") && endStatus(mob.status, "sleep", this.toughFoe(mob))) this.float(mob.x, mob.y - 46, "WAKE", "#fff1a8");
		this.float(mob.x, mob.y - 30, `${amount}${crit ? "!" : ""}`, crit ? "#fff1a8" : "#f0e2c8");
		if (crit) this.shake = Math.max(this.shake, 5);
		this.combat = 3;
		if (mob.hp <= 0) this.killMob(mob);
	}
	killMob(mob) {
		const save = this.save;
		if (!save || !mob?.alive || this.dead) return;
		if (mob.twitch) this.queueWitch?.();
		if (mob.rival) this.lmsEliminate(mob, "you");
		mob.alive = false;
		mob.hp = 0;
		this.gim?.onKill(mob);
		save.lifeKills = (save.lifeKills ?? 0) + 1;
		this.mapQuestEvent({ t: "kill", species: mob.species });
		const delay = this.respawnSecondsFor(mob);
		mob.respawn = delay == null ? 1e9 : delay;
		const inside = save.dungeons?.inside;
		if (inside && inside.map === save.map && !inside.defeated.includes(mob.id)) inside.defeated.push(mob.id);
		const portal = save.dungeons?.portals.find(p => p.id === save.map);
		if (portal) {
			if (!portal.defeated.includes(mob.id)) portal.defeated.push(mob.id);
			if (mob.boss) { portal.cleared = true; this.say("Dungeon cleared. Return through the entrance rift."); }
			this.room?.send({ t: "dungeons", dungeons: save.dungeons });
		}
		const amount = killXpAmount(mob.level, {
			boss: !!mob.boss,
			dungeon: this.isDungeonMap(save.map),
			witch: !!mob.witch,
			shrine: typeof mob.id === "string" && mob.id.startsWith("shrine"),
			bounty: !!mob.bounty,
		});
		const xp = Math.floor(amount * (1 + this.chan("xp_boost") / 100) * (this.isNightNow() ? NIGHT.xp : 1));
		this.gainXp(xp);
		// Ghosts out with you and tagged tiny followers learn from every kill too.
		this.feedGhostXp(Math.floor(amount * (this.isNightNow() ? NIGHT.xp : 1)));
		this.gainSkill("hunting", mob.boss ? 28 : 10);
		save.kyo += Math.floor((2 + mob.level) * (mob.boss ? 6 : 1) * (mob.lootMult ?? 1) * (1 + this.chan("kyo_find") / 100) * bendDown(1 + this.mod("kyo") / 100, 0.2, 0.05));
		save.wins += 1;
		const regen = this.chan("regen");
		if (regen && this.rules !== "hardcore") save.hp = Math.min(this.maxHp(), save.hp + regen * .4);
		this.say(`${mob.name} falls.`);
		this.cue(mob.boss ? "boom" : "thud", { rate: mob.boss ? 0.7 : 1 }, [90, .08, "triangle"]);
		this.questKill(mob);
		if (!mob.ghost) this.boardEvent("kills", { species: mob.species, type: mob.type, boss: !!mob.boss });
		this.rollBountyStar(mob);
		if (mob.bounty) {
			for (const pool of [this.mobs, this.contract ?? []]) {
				for (const s of pool) if (s.bountySpirit && s.master === mob.id) {
					s.alive = false;
					s.hp = 0;
				}
			}
			this.contract = (this.contract ?? []).filter((m) => m.alive);
			this.ghostDrop(mob);
			this.claimBounty(mob);
			return;
		}
		if (mob.hunter) {
			this.ghostDrop(mob);
			this.hunterDown(mob);
			return;
		}
		if (mob.witch && !mob.party) {
			// The evil witch still drops her whole kit, re-rolled at your level.
			for (const g of mob.lootGear) this.lootGear(mob, {
				...g,
				uid: nextUid()
			});
			for (const [id, n] of Object.entries(mob.lootBag)) if (n > 0) this.lootItem(mob, id, n);
			save.kyo += mob.lootKyo;
			this.say(this.chestsOn() ? `${mob.name} falls. ${mob.lootKyo} kyo, and her bag and gear wait in a chest where she fell.` : `${mob.name} drops everything. ${mob.lootKyo} kyo, her bag, her gear.`);
			this.gainSkill("hunting", 24);
			this.gainSkill("bountyhunting", 30);
			this.gainAccount(40 + mob.level * 4);
			this.ghostDrop(mob);
			this.persist();
			return;
		}
		if (mob.witch) {
			save.kyo += mob.lootKyo ?? 0;
			this.ghostDrop(mob);
			this.persist();
			return;
		}
		if (mob.animal) {
			const skin = procs(this.skillN("skinning") * 0.3);
			const meat = (mob.species === "stag" || mob.species === "boar" ? 2 : 1) + skin;
			const hide = (mob.species === "stag" ? 2 : 1) + skin;
			this.gainSkill("skinning", 10);
			this.lootItem(mob, "meat", meat);
			this.lootItem(mob, "leather", hide);
			if (Math.random() < 0.4) this.lootItem(mob, "beast_fang", 1);
			if (!this.chestsOn()) this.say(`${mob.name}: meat ${meat}, leather ${hide}.`);
			this.gainSkill("hunting", 8);
			this.gainSkill("physical", 4);
			this.ghostDrop(mob);
			this.persist();
			return;
		}
		const luck = this.chan("loot_find") + this.chan("fortune");
		const dropP = mob.boss ? 1 : Math.min(0.85, (0.12 + Math.min(100, save.level) * 0.003 + mob.rarity * 0.08 + luck / 200) * (mob.lootMult ?? 1));
		if (Math.random() < dropP) {
			// Drops start at your level; rarity, bosses and luck push them up from there.
			const floors = [null, "fine", "rare", "epic", "legendary"];
			const tier = Math.min(4, mob.rarity + (save.level >= 24 ? 1 : 0) + (save.level >= 40 ? 1 : 0));
			const piece = rollGear(mulberry32(Math.random() * 1e9 | 0), {
				level: save.level,
				bonus: mob.boss ? (this.turbz ? 0.12 : SOURCE_BONUS.boss) : SOURCE_BONUS.mob(mob.rarity),
				luck: luck + mob.rarity * 14,
				raceBias: save.race,
				floor: mob.boss ? (this.turbz ? (mob.dungeonBoss ? "epic" : "legendary") : save.level > 14 ? "rare" : "fine") : floors[tier] ?? null,
				typeBias: mob.boss ? mob.type : null
			});
			this.lootGear(mob, piece);
			if (!this.chestsOn()) this.say(`Found ${piece.name} (Lv ${piece.level}).`);
			this.cue("sparkle", { rate: 1.4, len: 0.8, vol: 0.26 }, [520, .1, "triangle"]);
		}
		if (mob.boss) {
			const piece = rollGear(mulberry32(Math.random() * 1e9 | 0), {
				level: save.level,
				bonus: this.turbz ? 0.16 : SOURCE_BONUS.boss,
				luck: luck + (this.turbz ? 48 : 20),
				raceBias: save.race,
				floor: this.turbz ? "legendary" : "epic"
			});
			this.lootGear(mob, piece);
			if (this.turbz && mob.dungeonBoss) {
				const extra = rollGear(mulberry32(Math.random() * 1e9 | 0), {
					level: save.level, bonus: 0.14, luck: luck + 36, raceBias: save.race, floor: "epic", typeBias: mob.type
				});
				this.lootGear(mob, extra);
			}
			this.say(this.chestsOn() ? `${mob.name} falls. ${this.turbz ? "The chest is good gear." : "Its chest holds a warlord relic."}` : `${this.turbz ? "Good gear" : "Warlord relic"}: ${piece.name}.`);
			if (mob.bossId && !mob.dungeonBoss) save.bosses[mob.bossId] = (save.bosses[mob.bossId] ?? 0) + 1;
		}
		if (Math.random() < Math.min(0.8, 0.22 + mob.level * 0.012 + mob.rarity * 0.06)) this.lootItem(mob, mob.type === "water" ? "fish" : mob.type === "earth" ? "mushroom" : "meat", 1 + (mob.level >= 20 ? 1 : 0));
		if (Math.random() < Math.min(0.55, 0.08 + mob.level * 0.008 + mob.rarity * 0.05)) this.lootItem(mob, "cleanse_salt", 1);
		if (mob.rarity >= 3 && Math.random() < 0.12 + mob.level * 0.004) this.lootItem(mob, "ghost_jar", 1);
		const mat = ENEMY_MATS[mob.type];
		if (mat && Math.random() < Math.min(0.72, 0.38 + mob.rarity * 0.06)) this.lootItem(mob, mat, 1 + (mob.level >= 18 && Math.random() < 0.35 ? 1 : 0));
		if (Math.random() < 0.16) this.lootItem(mob, SCRAP_LOOT[Math.floor(Math.random() * SCRAP_LOOT.length)], 1);
		if (this.shrine && mob.id.startsWith("shrine")) this.shrineClear();
		if (this.role === "host") this.room?.send({
			t: "dead",
			id: mob.id,
			boss: mob.bossId ?? ""
		});
		this.ghostDrop(mob);
		this.persist();
	}
	/**
	 * Every kind of foe can leave a ghost: monsters, animals, witches, hunters, bounty targets, shrine foes
	 * and summoned foes roll the usual catch chance. Bosses leave a ghost half the time, and always when
	 * the shiny roll (1 in 50, better at night) hits.
	 */
	ghostDrop(mob) {
		if (!this.save || !mob) return;
		if (mob.boss || mob.dungeonBoss) {
			if (this.lms || this.turbz) return;
			const shiny = Math.random() < this.shinyChance(BOSS_SHINY_CHANCE);
			if (shiny || Math.random() < BOSS_GHOST_CHANCE) this.bossGhost(mob, shiny);
			return;
		}
		this.tryRecruit(mob);
	}
	/** Shiny odds right now: night (Hardcore) and Shiny Charm raise them. */
	shinyChance(base) {
		return base * (this.isNightNow() ? NIGHT_SHINY_MULT : 1) * (1 + Math.max(0, this.chan("shiny_luck")) / 100);
	}
	/** A boss's ghost, built at ghost size, not boss size. */
	bossGhost(mob, shiny) {
		if (!this.save || this.lms) return;
		const spirit = this.spiritFrom(mob, { shiny, boss: true });
		spirit.max = Math.max(18, Math.floor(spirit.max / (mob.dungeonBoss ? 3 : 6.5)));
		spirit.hp = spirit.max;
		if (this.autoplay) {
			if (spirit.shiny) this.announceShiny(spirit);
			this.adoptSpirit(spirit, `${mob.name}'s ${spirit.shiny ? "shiny " : ""}ghost`);
			return;
		}
		this.lingerGhost(mob, spirit);
	}
	tryRecruit(mob: Mob) {
		const save = this.save;
		if (!save) return;
		const jar = (save.jarLeft ?? 0) > 0 ? 0.45 : 0;
		const raw = 0.12 + this.skillN("catching") * 0.0012 + this.chan("catch_boost") / 220 + Math.min(3, mob.rarity ?? 0) * 0.03 + jar;
		// No cap: past a sure catch the extra raises the shiny odds and the ghost's health.
		if (Math.random() > raw) return;
		const over = Math.max(0, raw - 1);
		const spirit = this.spiritFrom(mob, { shiny: over > 0 && Math.random() < this.shinyChance(SHINY_CHANCE) * over ? true : null });
		if (over > 0) {
			spirit.max = Math.floor(spirit.max * (1 + over * 0.25));
			spirit.hp = spirit.max;
		}
		// Autoplay keeps the old behaviour: the ghost joins on the spot.
		if (this.autoplay) {
			if (spirit.shiny) this.announceShiny(spirit);
			if (!this.adoptSpirit(spirit, `${mob.name} almost stayed`)) return;
			this.creditCatch(mob.type);
			return;
		}
		this.lingerGhost(mob, spirit);
	}
	creditCatch(type) {
		const save = this.save;
		this.gainSkill("catching", 16);
		save.catches[type] = (save.catches[type] ?? 0) + 1;
		this.boardEvent("catch");
		this.noteCatch({ type });
	}
	// ---------- Lingering ghosts ----------
	/** The ghost of a fallen foe stands where it fell for 5 minutes, until you look at it and decide. */
	lingerGhost(mob, spirit) {
		const save = this.save;
		save.wildGhosts = save.wildGhosts ?? [];
		const g = { id: `wg-${nextUid()}`, map: save.map, x: mob.x + 18, y: mob.y - 4, t: WILD_GHOST_LIFE, spirit, catchType: mob.type };
		save.wildGhosts.push(g);
		if (save.wildGhosts.length > 30) save.wildGhosts.splice(0, save.wildGhosts.length - 30);
		if (spirit.shiny) { this.float(g.x, g.y - 70, "✦ SHINY GHOST ✦", "#ff7ae0"); this.cue("sparkle", { rate: 1.9, len: 1.6, vol: 0.4 }, [980, .25, "triangle"]); this.announceShiny(spirit); }
		this.float(g.x, g.y - 50, spirit.rarity >= 4 ? `A ${rarityName(spirit.rarity).toUpperCase()} GHOST` : "A GHOST LINGERS", spirit.rarity >= 4 ? (spirit.rarity >= 5 ? "#ff4d8a" : "#ffb341") : "#c9a6e8");
		this.say(`${spirit.name}'s ${rarityName(spirit.rarity)} ghost lingers${spirit.shiny ? ` ✦ SHINY · ${shinyPalette(spirit.palette).name} ✦` : ""}. Press E or click it to look (5 min).`);
		this.tone(660, .12, "sine");
	}
	wildById(id) {
		return (this.save?.wildGhosts ?? []).find((g) => g.id === id) ?? null;
	}
	nearestWild(reach = WILD_REACH) {
		const save = this.save;
		let best = null, bd = reach;
		for (const g of save?.wildGhosts ?? []) {
			if (g.map !== save.map) continue;
			const d = Math.hypot(g.x - save.x, g.y - save.y);
			if (d <= bd) { bd = d; best = g; }
		}
		return best;
	}
	openWild(id) {
		const g = this.wildById(id);
		if (!g) return;
		this.wildOpen = g.id;
		this.pendingWild = null;
		this.dest = null;
		if (snap.panel === "chest") this.chestOpen = null;
		publish({ panel: "wildghost" });
		this.cue("click", { rate: 1.3 }, [560, .06, "sine"]);
		this.syncHud(true);
	}
	tickWildGhosts(dt) {
		const save = this.save;
		if (!save?.wildGhosts?.length) { if (snap.panel === "wildghost") { this.wildOpen = null; publish({ panel: null }); } return; }
		let changed = false;
		for (const g of save.wildGhosts) g.t -= dt;
		const keep = save.wildGhosts.filter((g) => g.t > 0);
		if (keep.length !== save.wildGhosts.length) {
			changed = true;
			for (const g of save.wildGhosts) if (!keep.includes(g) && g.map === save.map) { this.float(g.x, g.y - 30, "THE GHOST FADES", "#8a7a9a"); this.say(`${g.spirit.name}'s ghost faded away.`); }
			save.wildGhosts = keep;
		}
		if (this.pendingWild) {
			const g = this.wildById(this.pendingWild);
			if (!g || g.map !== save.map) this.pendingWild = null;
			else if (Math.hypot(g.x - save.x, g.y - save.y) <= WILD_REACH) this.openWild(g.id);
		}
		if (snap.panel === "wildghost") {
			const g = this.wildById(this.wildOpen);
			if (!g || g.map !== save.map || Math.hypot(g.x - save.x, g.y - save.y) > WILD_REACH * 3) { this.wildOpen = null; publish({ panel: null }); changed = true; }
		}
		if (changed) { this.persist(); this.syncHud(true); }
	}
	/** Gives the lingering ghost a name before you keep it. */
	renameWild(id, name) {
		const g = this.wildById(id);
		const clean = String(name ?? "").replace(/[^\p{L}\p{N} '\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);
		if (!g || !clean) return;
		g.spirit.name = clean;
		this.syncHud(true);
	}
	/** Keeps the lingering ghost: "party" (follows if fewer than 3 are out) or "box" (the Ghost Box). */
	keepWild(id, where = "party") {
		const save = this.save;
		const g = this.wildById(id);
		if (!save || !g || this.dead) return;
		if (g.map !== save.map || Math.hypot(g.x - save.x, g.y - save.y) > WILD_REACH * 3) return this.say("Walk closer to the ghost.");
		save.spirits = save.spirits ?? [];
		save.ghostStore = save.ghostStore ?? [];
		const sp = this.finishGhost(g.spirit);
		if (where === "box") {
			if (!save.ghostBox) return this.say(this.rules === "hardcore" ? "Build a Ghost Box at your camp first." : "Place a Ghost Box first (Spirits → Ghost Box, or right-click the ground).");
			if (save.ghostStore.length >= GHOST_STORE_MAX) return this.say(`The Ghost Box is full (${GHOST_STORE_MAX}). Release some.`);
			sp.active = false;
			save.ghostStore.push(sp);
			this.say(`${sp.name} drifts off to your Ghost Box.`);
		} else {
			if (save.spirits.length >= PARTY_MAX) return this.say(`Your party is full (${PARTY_MAX}). Send it to the Ghost Box, or make room first.`);
			sp.active = save.spirits.filter((s) => s.active).length < this.spiritCap();
			save.spirits.push(sp);
			this.say(sp.active ? `${sp.name} joins you, and follows.` : `${sp.name} joins your party. Send it out from Spirits.`);
		}
		save.wildGhosts = save.wildGhosts.filter((x) => x !== g);
		this.creditCatch(g.catchType ?? sp.type);
		this.gainSkill("ghostkeeping", 2);
		this.float(g.x, g.y - 40, "KEPT", "#7ee0a0");
		this.tone(880, .12, "triangle");
		if (this.wildOpen === g.id) { this.wildOpen = null; publish({ panel: null }); }
		this.persist();
		this.syncHud(true);
	}
	dismissWild(id) {
		const save = this.save;
		const g = this.wildById(id);
		if (!save || !g) return;
		save.wildGhosts = save.wildGhosts.filter((x) => x !== g);
		this.float(g.x, g.y - 30, "SET FREE", "#8a7a9a");
		this.say(`You let ${g.spirit.name}'s ghost go.`);
		if (this.wildOpen === g.id) { this.wildOpen = null; publish({ panel: null }); }
		this.persist();
		this.syncHud(true);
	}
	wildView() {
		const save = this.save;
		if (!save || !this.wildOpen) return null;
		const g = this.wildById(this.wildOpen);
		if (!g) return null;
		const sp = g.spirit;
		const key = `${g.id}|${sp.name}|${sp.level}|${Math.ceil(g.t)}|${save.spirits?.length}|${save.ghostStore?.length}|${!!save.ghostBox}|${save.level}`;
		if (this.wildViewCache?.key === key) return this.wildViewCache.view;
		const view = {
			...this.ghostDetail(sp, "wild"),
			id: g.id, t: Math.ceil(g.t), near: Math.hypot(g.x - save.x, g.y - save.y) <= WILD_REACH * 3,
			party: save.spirits?.length ?? 0, partyMax: PARTY_MAX, out: (save.spirits ?? []).filter((s) => s.active).length, outMax: this.spiritCap(),
			boxPlaced: !!save.ghostBox, store: save.ghostStore?.length ?? 0, storeMax: GHOST_STORE_MAX,
		};
		this.wildViewCache = { key, view };
		return view;
	}
	paintWildGhost(ctx, g) {
		const sp = g.spirit;
		const blink = g.t < 30 && Math.floor(g.t * 3) % 2 === 0;
		const bob = Math.sin(this.clock * 2 + g.x) * 3;
		ctx.save();
		ctx.globalAlpha = blink ? .4 : .85;
		ctx.fillStyle = `rgba(201,166,232,${.14 + Math.sin(this.clock * 2.5) * .06})`;
		ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
		const gfx = { x: g.x, y: g.y + bob, type: sp.type, rarity: sp.rarity, level: sp.level, speed: sp.speed, max: sp.max, shiny: !!sp.shiny, seed: sp.uid, palette: sp.palette };
		drawGhostFx(ctx, gfx, this.clock, "back");
		drawMonster(ctx, { x: g.x, y: g.y + bob, template: sp.template, type: sp.type, facing: 1, walk: 0, hurt: 0, boss: false, rarity: sp.rarity, ghost: true, shiny: !!sp.shiny, palette: sp.palette, spin: 0, look: sp.look, time: this.clock });
		drawGhostFx(ctx, gfx, this.clock, "front");
		ctx.restore();
		const near = Math.hypot(g.x - this.save.x, g.y - this.save.y) <= WILD_REACH;
		drawShadowName(ctx, `${sp.shiny ? "✦ " : ""}${sp.name} · Lv ${sp.level} · ${rarityName(sp.rarity)}`, g.x, g.y - 44 + bob, sp.shiny ? (shinyPalette(sp.palette).kind === "rainbow" ? `hsl(${(this.clock * 120) % 360},90%,70%)` : shinyPalette(sp.palette).badge) : TYPES[sp.type]?.color ?? "#c9a6e8");
		drawShadowName(ctx, near ? "E · LOOK" : `GHOST ${Math.ceil(g.t / 60)}m`, g.x, g.y - 32 + bob, near ? "#ffd166" : "#c9a6e8");
	}
	/** One ghost, read out for the Spirits and lingering-ghost windows. */
	ghostDetail(sp, where = "party"): GhostDetail {
		const lv = Math.max(1, sp.level | 0);
		const rarity = clampRarity(sp.rarity);
		const on = where === "out" || where === "tagged";
		return {
			uid: sp.uid, name: sp.name, species: (MONSTER_BY_ID[sp.species] ?? ANIMAL_BY_ID[sp.species])?.name ?? sp.species ?? "", type: sp.type, template: sp.template ?? 0, look: sp.look ?? null,
			level: lv, levelCap: this.ghostLevelCap(), xp: Math.floor(sp.xp ?? 0), xpNeed: ghostXpNeed(lv),
			rarity, rarityName: rarityName(rarity), shiny: !!sp.shiny, palette: sp.shiny ? sp.palette ?? DEFAULT_PALETTE : null, paletteName: sp.shiny ? shinyPalette(sp.palette).name : "",
			hp: Math.max(0, Math.ceil(sp.hp ?? 0)), max: Math.max(1, Math.ceil(sp.max ?? 1)), speed: sp.speed ?? 10,
			hitMult: Math.round((0.75 + rarity * 0.12) * 100) / 100, critBonus: rarity * 2 + (sp.shiny ? 5 : 0), cdMult: Math.round(GHOST_CD_MULT * (sp.shiny ? 0.9 : 1) * 100) / 100,
			abilities: describeAbilities(sp.abilities, { level: lv, rarity }),
			where, abilitiesOn: on,
			moves: (sp.known ?? []).map((mid) => {
				const m = MOVE_BY_ID[mid];
				return { id: mid, name: m?.name ?? mid, about: m?.about ?? "", type: m?.type ?? sp.type, power: m?.power ?? 0, player: m ? spiritAidsPlayer(m) : false, slotted: (sp.slots ?? []).includes(mid) };
			}),
		};
	}
	/** Opens a Ghost Box ghost's details in the Spirits window (null closes it). */
	inspectGhost(uid) {
		this.inspectUid = uid || null;
		this.syncHud(true);
	}
	/** Ghosts that can be out with you at once. Spirit Caller holds six; every other class holds three. */
	spiritCap() {
		return classSpiritOut(this.save?.classId);
	}
	/**
	 * A new ghost joins: it follows if fewer than 3 are out, waits in the party (6 at most), or goes to
	 * the Ghost Box when the party is full. With a full party and no Ghost Box it slips away.
	 */
	adoptSpirit(spirit, missed = "") {
		const save = this.save;
		this.finishGhost(spirit);
		save.spirits = save.spirits ?? [];
		save.ghostStore = save.ghostStore ?? [];
		const shine = spirit.shiny ? " ✦ SHINY ✦" : "";
		if (spirit.shiny) { this.float(save.x, save.y - 70, "✦ SHINY GHOST ✦", "#ff7ae0"); this.cue("sparkle", { rate: 1.9, len: 1.6, vol: 0.4 }, [980, .25, "triangle"]); }
		if (save.spirits.length >= PARTY_MAX) {
			if (!save.ghostBox) {
				this.say(`${missed || spirit.name + " would have joined"}, but your party is full (${PARTY_MAX}). ${this.rules === "hardcore" ? "Build a Ghost Box at your camp" : "Place a Ghost Box (Spirits → Ghost Box, or right-click the ground)"} to store more ghosts.`);
				return false;
			}
			if (save.ghostStore.length >= GHOST_STORE_MAX) {
				this.say(`${missed || spirit.name + " would have joined"}, but the Ghost Box is full (${GHOST_STORE_MAX}). Release some.`);
				return false;
			}
			spirit.active = false;
			save.ghostStore.push(spirit);
			this.recordShiny(spirit);
			this.say(`${spirit.name}${shine} stays. Your party is full, so it waits in your Ghost Box.`);
			return true;
		}
		spirit.active = save.spirits.filter((s) => s.active).length < this.spiritCap();
		save.spirits.push(spirit);
		this.recordShiny(spirit);
		this.say(spirit.active ? `${spirit.name}${shine} stays, and follows.` : `${spirit.name}${shine} stays in the party. Send it out from Spirits.`);
		return true;
	}
	/** Every shiny you pick up goes into the account's Shiny collection (kept forever, shown on the main menu). */
	recordShiny(spirit) {
		if (!spirit?.shiny || this.lms || !this.save) return;
		const added = noteShiny({
			uid: String(spirit.uid), species: String(spirit.species ?? ""), name: String(spirit.name ?? "Ghost"), type: String(spirit.type ?? "spirit"),
			template: Number(spirit.template) || 0, rarity: Number(spirit.rarity) || 0, level: Number(spirit.level) || 1, speed: Number(spirit.speed) || 10, max: Number(spirit.max) || 10,
			look: spirit.look ?? null, at: Date.now(), mode: this.turbz ? "turbz" : this.rules, by: this.save.name, palette: spirit.palette,
		});
		if (added) { this.say(`✦ ${spirit.name} joins your Shiny collection.`); this.shinyFn?.(); }
	}
	/** A shiny just dropped in the world for this player: the app posts a "Shiny Ghost Seen" GIF to Discord. */
	announceShiny(spirit) {
		if (!spirit?.shiny || this.lms || !this.save) return;
		// Big on-screen "SHINY DROPPED" pop-up (see ShinyDropAlert in turbz-app.tsx).
		publish({ shinyAlert: getSnap().shinyAlert + 1 });
		this.shinySeenFn?.({
			entry: { uid: String(spirit.uid), species: String(spirit.species ?? ""), name: String(spirit.name ?? "Ghost"), type: String(spirit.type ?? "spirit"), template: Number(spirit.template) || 0, rarity: Number(spirit.rarity) || 0, level: Number(spirit.level) || 1, speed: Number(spirit.speed) || 10, max: Number(spirit.max) || 10, look: spirit.look ?? null, at: Date.now(), mode: this.turbz ? "turbz" : this.rules, by: this.save.name, palette: spirit.palette },
			witch: this.save.name,
			place: this.mapRegion?.name ?? (this.save.map === "world" ? this.customFile?.name ?? "the wilds" : this.customFile?.name ?? "a dungeon"),
		});
	}
	attachShinySeen(fn) {
		this.shinySeenFn = fn;
	}
	/** Called whenever the Shiny collection grows (the app re-renders and uploads its GIF). */
	attachShiny(fn: () => void) {
		this.shinyFn = fn;
	}
	nearGhostBox() {
		const save = this.save;
		const b = save?.ghostBox;
		return !!b && b.map === save.map && Math.hypot(b.tx * 32 + 16 - save.x, b.ty * 32 + 16 - save.y) <= 96;
	}
	/** Ghost Box: move a party ghost into storage. */
	storeSpirit(uid) {
		const save = this.save;
		if (!save) return;
		if (!this.nearGhostBox()) return this.say(save.ghostBox ? "Walk to your Ghost Box to store ghosts." : this.rules === "hardcore" ? "Build a Ghost Box at your camp first." : "Place a Ghost Box first (Spirits → Ghost Box, or right-click the ground).");
		const s = save.spirits.find((x) => x.uid === uid);
		if (!s) return;
		if (save.ghostStore.length >= GHOST_STORE_MAX) return this.say("The Ghost Box is full.");
		s.active = false;
		s.task = null;
		s.taskT = 0;
		s.tagged = false;
		save.spirits = save.spirits.filter((x) => x !== s);
		save.ghostStore.push(s);
		this.say(`${s.name} goes into the Ghost Box.`);
		this.gainSkill("ghostkeeping", 2);
		this.persist();
		this.syncHud(true);
	}
	/** Ghost Box: take a stored ghost into the party (swap with `swapUid` when the party is full). */
	takeSpirit(uid, swapUid: string | null = null) {
		const save = this.save;
		if (!save) return;
		if (!this.nearGhostBox()) return this.say("Walk to your Ghost Box to take ghosts out.");
		const s = save.ghostStore.find((x) => x.uid === uid);
		if (!s) return;
		if (save.spirits.length >= PARTY_MAX) {
			const out = swapUid ? save.spirits.find((x) => x.uid === swapUid) : null;
			if (!out) return this.say(`Your party is full (${PARTY_MAX}). Store a ghost first, or swap.`);
			out.active = false;
			save.spirits = save.spirits.filter((x) => x !== out);
			save.ghostStore.push(out);
		}
		save.ghostStore = save.ghostStore.filter((x) => x !== s);
		s.tagged = false;
		s.hp = s.max;
		s.active = save.spirits.filter((x) => x.active).length < this.spiritCap();
		save.spirits.push(s);
		this.say(`${s.name} leaves the Ghost Box${s.active ? " and follows you" : " and joins the party"}.`);
		this.persist();
		this.syncHud(true);
	}
	/** Ghost Box: let a stored ghost go for good. */
	releaseStored(uid) {
		const save = this.save;
		if (!save) return;
		if (!this.nearGhostBox()) return this.say("Walk to your Ghost Box to release ghosts.");
		const s = save.ghostStore.find((x) => x.uid === uid);
		if (!s) return;
		save.ghostStore = save.ghostStore.filter((x) => x !== s);
		this.say(`${s.name} is released.`);
		this.persist();
		this.syncHud(true);
	}
	/** Standard mode has no camps: the Ghost Box goes down where you stand in the overworld. Hardcore needs a camp. */
	/**
	 * Place the Ghost Box where you stand. TurboHunt: anywhere in the overworld, paid with its materials
	 * or (with `buy`) with kyo. Hardcore: inside a camp, with materials, through build mode.
	 */
	placeGhostBoxHere(buy = false) {
		const save = this.save;
		if (!save || this.dead) return;
		if (save.ghostBox) return this.rules === "hardcore" ? this.say("You already have a Ghost Box.") : this.moveGhostBoxHere();
		if (this.rules === "hardcore") {
			if (!this.playerSafeCamp()) return this.say("Stand inside a camp (a campfire's safe zone) to place the Ghost Box.");
			this.buildPiece = "ghostbox";
		}
		if (save.map !== "world") return this.say("Place the Ghost Box in the overworld.");
		const cost = BUILD_PIECES.ghostbox.cost;
		const missing = Object.entries(cost).filter(([id, n]) => (save.bag[id] ?? 0) < n);
		const pay = this.rules !== "hardcore" && missing.length && buy;
		if (missing.length && !pay) return this.say(this.rules === "hardcore" ? `The Ghost Box needs ${this.costLine(cost)}.` : `The Ghost Box needs ${this.costLine(cost)}, or buy one for ${GHOST_BOX_KYO} kyo.`);
		if (pay && save.kyo < GHOST_BOX_KYO) return this.say(`A Ghost Box costs ${GHOST_BOX_KYO} kyo (you have ${save.kyo}), or ${this.costLine(cost)}.`);
		const spot = this.ghostBoxSpot();
		if (!spot) return this.say("No room here. Step onto open ground and try again.");
		if (this.rules === "hardcore") { this.placeFurniture("ghostbox", spot.tx, spot.ty); return; }
		if (pay) save.kyo -= GHOST_BOX_KYO;
		else consumeMaterials(save.bag, cost);
		this.gainSkill("building", 20);
		save.ghostBox = { map: save.map, tx: spot.tx, ty: spot.ty };
		this.say(`Ghost Box placed${pay ? ` (-${GHOST_BOX_KYO} kyo)` : ""}. Stand by it and open Spirits (G) to store, swap and release ghosts. A full party now sends new ghosts straight into it.`);
		this.cue("rattle", { rate: 0.9 }, [520, .14, "triangle"]);
		this.persist();
		this.syncHud(true);
	}
	/** An open tile right below you (or under you) for the Ghost Box. */
	ghostBoxSpot() {
		const save = this.save;
		for (const [dx, dy] of [[0, 24], [0, 0], [24, 0], [-24, 0], [0, -24]]) {
			const { tx, ty } = tileAt(save.x + dx, save.y + dy);
			if (!blocked(this.world, tx * 32 + 16, ty * 32 + 16)) return { tx, ty };
		}
		return null;
	}
	/** TurboHunt: carry the Ghost Box to where you stand, from anywhere in the overworld, for free. */
	moveGhostBoxHere() {
		const save = this.save;
		if (!save?.ghostBox || this.dead) return;
		if (this.rules === "hardcore") return this.say("In Hardcore, move the Ghost Box in build mode at your camp.");
		if (save.map !== "world") return this.say("Place the Ghost Box in the overworld.");
		const spot = this.ghostBoxSpot();
		if (!spot) return this.say("No room here. Step onto open ground and try again.");
		save.ghostBox = { map: save.map, tx: spot.tx, ty: spot.ty };
		this.say("Ghost Box moved here.");
		this.persist();
		this.syncHud(true);
	}
	/** Standard mode: pick the Ghost Box back up (Hardcore uses build mode). */
	pickUpGhostBox() {
		const save = this.save;
		if (!save?.ghostBox) return;
		if (!this.nearGhostBox()) return this.say("Walk to your Ghost Box to pick it up.");
		if (this.rules === "hardcore") return this.removeFurniture("ghostbox", save.ghostBox);
		for (const [id, n] of Object.entries(BUILD_PIECES.ghostbox.cost)) this.giveItem(id, n);
		save.ghostBox = null;
		this.say("Ghost Box packed up. The ghosts inside are safe; place it again to reach them.");
		this.persist();
		this.syncHud(true);
	}
	activeSpirits() {
		const save = this.save;
		if (!save) return [];
		return (save.spirits ?? []).filter((s) => s.active).slice(0, this.spiritCap());
	}
	/**
	 * A ghost from a fallen foe. Its rarity starts at the foe's and may ascend (bosses and shinies climb
	 * more often); shinies roll a palette; every ghost rolls its abilities.
	 */
	spiritFrom(mob: Mob, { shiny = null, boss = false } = {}): Spirit {
		const isShiny = shiny ?? Math.random() < this.shinyChance(SHINY_CHANCE);
		const rarity = rollGhostRarity(mob.rarity ?? 0, Math.random, { boss: boss || !!mob.boss, shiny: isShiny });
		const look = mob.look ?? rollGhostLook(mulberry32((Math.random() * 1e9 | 0) || 1), rarity, mob.move, "hunt");
		const kit = rollSpiritKit(mob.type, mulberry32((Math.random() * 1e9 | 0) || 2), mob.move);
		const max = Math.max(18, Math.floor(mob.max * 0.72 * (1 + Math.max(0, rarity - (mob.rarity ?? 0)) * 0.12)));
		const sp: Spirit = {
			uid: nextUid(), species: mob.species || "wisp", name: mob.name || "Ghost", type: TYPES[mob.type] ? mob.type : "spirit", template: Number(mob.template) || 0,
			level: Math.max(1, Math.min(this.ghostLevelCap(), mob.level | 0)), rarity, look, move: kit.slots[0] ?? mob.move, known: kit.known, slots: kit.slots,
			hp: max, max, speed: Math.max(6, (mob.speed ?? 10) - 1), active: false, shiny: isShiny, xp: 0
		};
		this.finishGhost(sp, true);
		return sp;
	}
	/** Fills in what newer builds give every ghost: a valid rarity, a palette for shinies, and abilities. */
	finishGhost(sp, fresh = false) {
		if (!sp) return sp;
		sp.rarity = clampRarity(sp.rarity);
		sp.shiny = !!sp.shiny;
		if (sp.shiny) {
			// Old shinies keep the rainbow they always had; new ones roll a palette.
			if (!sp.palette || !PALETTE_BY_ID[sp.palette]) sp.palette = fresh ? rollShinyPalette(Math.random, sp.rarity) : DEFAULT_PALETTE;
		} else delete sp.palette;
		sp.abilities = normalizeGhostAbilities(sp.abilities, Math.random, sp.rarity, sp.shiny);
		sp.level = Math.max(1, Math.floor(Number(sp.level) || 1));
		sp.xp = Number.isFinite(sp.xp) ? Math.max(0, Math.floor(sp.xp)) : 0;
		return sp;
	}
	spiritPower(s: Spirit) {
		return s.level * 10 + s.rarity * 12 + s.speed + Math.floor(s.hp);
	}
	noteCatch(mob: Mob) {
		const save = this.save!;
		if (this.world && biomeNameAt(this.world, save.x, save.y) === "ashen" && mob.type === "fire") {
			const q = save.quests.ember_hunt!;
			if (!q.done) {
				q.n += 1;
				if (q.n >= 2) this.completeQuest("ember_hunt");
			}
		}
		if ((save.catches.fire ?? 0) >= 1 && (save.catches.light ?? 0) >= 1 && !save.quests.keeper_lanterns!.done) this.completeQuest("keeper_lanterns");
		if (mob.type === "water" && save.quests.marsh_walk!.n >= 1 && !save.quests.marsh_walk!.done) this.completeQuest("marsh_walk");
	}
	/** The Quest Board: ten random contracts, refreshed every 30 minutes. State lives on the save. */
	questBoardSnap() {
		if (!this.save) return [];
		const now = Date.now();
		return boardView(ensureBoard(this.save, now), now);
	}
	questBoardRerollCost(): number {
		return rerollCost(this.save?.level ?? 1);
	}
	acceptQuest(id: string) {
		if (!this.save) return;
		const q = acceptContract(ensureBoard(this.save, Date.now()), id);
		if (!q) return this.say("That contract is gone. Wait for the board to refresh.");
		this.say(`Accepted: ${q.name}. ${q.about}`);
		this.persist(); this.syncHud(true);
	}
	abandonQuest() {
		if (!this.save) return;
		const q = abandonContract(ensureBoard(this.save, Date.now()));
		if (q) this.say(`Dropped: ${q.name}.`);
		this.persist(); this.syncHud(true);
	}
	rerollQuestBoard() {
		const save = this.save;
		if (!save) return;
		const cost = this.questBoardRerollCost();
		if (save.kyo < cost) return this.say(`A fresh board costs ${cost} kyo.`);
		save.kyo -= cost;
		rerollBoard(save, Date.now());
		this.say(`The board is rewritten. -${cost} kyo.`);
		this.persist(); this.syncHud(true);
	}
	/** Something happened in the world; advance the accepted contract if it cares. */
	boardEvent(kind: BoardKind, detail: BoardEventDetail = {}) {
		const save = this.save;
		if (!save) return;
		const hit = applyBoardEvent(save, ensureBoard(save, Date.now()), kind, detail);
		if (!hit) return;
		if (!hit.complete) {
			this.say(`${hit.quest.name}: ${hit.progress}/${hit.quest.need}`);
			this.syncHud(true);
			return;
		}
		const kyo = Math.floor(hit.quest.rewardKyo * (1 + this.skillN("social") * 0.0015));
		save.kyo += kyo;
		this.gainSkill("adventuring", TIER_XP[hit.quest.tier]);
		this.gainSkill("social", 8);
		const xp = this.questXp(TIER_XP[hit.quest.tier], BOARD_XP_SHARE[hit.quest.tier] ?? 0.25);
		this.gainXp(xp);
		this.say(`Contract complete: ${hit.quest.name}. +${kyo} kyo, +${xp} xp`);
		this.persist(); this.syncHud(true);
	}
	questKill(mob) {
		const save = this.save;
		const q = save.quests;
		if (!q.first_steps.done) {
			q.first_steps.n += 1;
			if (q.first_steps.n >= 3) this.completeQuest("first_steps");
		}
		if (save.map === "crypt" && mob.species === "gaikotsu" && !mob.boss && !q.bone_patrol.done) {
			q.bone_patrol.n += 1;
			if (q.bone_patrol.n >= 2) this.completeQuest("bone_patrol");
		}
		if (mob.bossId === "bone_king" && !q.bone_king.done) this.completeQuest("bone_king");
	}
	/**
	 * Quest experience. A quest's written XP is doubled, and every quest also pays a share of the level you
	 * are working on, so questing keeps pace with grinding at every level.
	 */
	questXp(base, share = QUEST_XP_SHARE) {
		const lv = this.save?.level ?? 1;
		const b = Math.max(0, Number(base) || 0);
		if (!b && !share) return 0;
		return Math.round(b * QUEST_XP_MULT + xpNeed(lv) * share);
	}
	completeQuest(id) {
		const save = this.save;
		const st = save.quests[id];
		if (!st || st.done) return;
		st.done = true;
		const def = QUESTS.find((q) => q.id === id);
		save.kyo += Math.floor(def.rewardKyo * (1 + this.skillN("social") * 0.0015));
		if (def.rewardItems) {
			for (const [k, n] of Object.entries(def.rewardItems)) if (n > 0 && ITEM_BY_ID[k]) this.giveItem(k, n);
		}
		this.gainSkill("adventuring", 24);
		this.gainSkill("social", 12);
		const xp = this.questXp(40, 0.35);
		this.gainXp(xp);
		this.say(`Quest complete: ${def.name}. +${xp} xp`);
		this.cue("burst", { rate: 1.25, len: 1.3 }, [660, .15, "triangle"]);
	}
	giveItem(id, n) {
		const save = this.save;
		save.bag[id] = (save.bag[id] ?? 0) + n;
	}
	// ---------- Loot chests (Hardcore) ----------
	/** Hardcore drops go into a chest where the foe fell. Other modes hand loot straight to you. */
	chestsOn() {
		return this.rules === "hardcore";
	}
	/** The chest this kill's loot goes into (made on first use). */
	chestFor(mob) {
		const save = this.save;
		if (this.openDrop?.src === mob.id && this.openDrop.chest && save.chests.includes(this.openDrop.chest)) return this.openDrop.chest;
		const life = CHEST_SECONDS + this.skillN("looting") * 0.5;
		const at = this.world && blocked(this.world, mob.x, mob.y) ? nearestOpen(this.world, mob.x, mob.y) : { x: mob.x, y: mob.y };
		const fresh = { id: `chest-${nextUid()}`, map: save.map, x: at.x, y: at.y, t: life, max: life, gear: [], items: {}, drops: 1, title: mob.bounty ? `${mob.name} · tier ${mob.tier ?? 1} bounty` : mob.boss ? `${mob.name} · world boss` : mob.witch ? `${mob.name}'s pack` : `${mob.name}'s drop`, boss: !!(mob.boss || mob.bounty || mob.witch) };
		save.chests = save.chests ?? [];
		// Drops close to an existing chest fold into it, so a fight leaves one pile to open, not ten chests.
		const host = chestToJoin(save.chests, save.map, at.x, at.y);
		let chest = fresh;
		if (host) { mergeChestInto(host, fresh); chest = host; this.chestPop = { id: host.id, t: this.clock }; }
		else {
			save.chests.push(chest);
			if (save.chests.length > 40) save.chests.splice(0, save.chests.length - 40);
		}
		this.openDrop = { src: mob.id, chest };
		for (let r = procs(this.skillN("looting") * 0.15); r > 0; r--) {
			const extra = ["potion", "cleanse_salt", "meat", "leather", "ore", "timber", "mushroom"][Math.floor(Math.random() * 7)];
			chest.items[extra] = (chest.items[extra] ?? 0) + 1;
		}
		return chest;
	}
	/** An item from a kill: into the chest in Hardcore, into the bag elsewhere. */
	lootItem(mob, id, n) {
		if (!(n > 0)) return;
		if (this.chestsOn() && mob) {
			const c = this.chestFor(mob);
			c.items[id] = (c.items[id] ?? 0) + n;
			return;
		}
		this.giveItem(id, n);
	}
	/** A gear piece from a kill: into the chest in Hardcore, onto you elsewhere. */
	lootGear(mob, g) {
		if (this.chestsOn() && mob) {
			this.chestFor(mob).gear.push(g);
			return;
		}
		this.receiveGear(g);
	}
	chestById(id) {
		return (this.save?.chests ?? []).find((c) => c.id === id) ?? null;
	}
	chestEmpty(c) {
		return !c.gear.length && !Object.values(c.items).some((n) => n > 0);
	}
	nearestChest(reach = CHEST_REACH) {
		const save = this.save;
		let best = null, bd = reach;
		for (const c of save?.chests ?? []) {
			if (c.map !== save.map) continue;
			const d = Math.hypot(c.x - save.x, c.y - save.y);
			if (d <= bd) { bd = d; best = c; }
		}
		return best;
	}
	/** Opens a chest's window. The world keeps running. */
	openChest(id) {
		const c = this.chestById(id);
		if (!c) return;
		this.chestOpen = c.id;
		this.pendingChest = null;
		this.dest = null;
		publish({ panel: "chest" });
		this.cue("rattle", {}, [420, .06, "triangle"]);
		this.syncHud(true);
	}
	/** Chests count down every frame; empty or expired chests vanish. */
	tickChests(dt) {
		const save = this.save;
		if (!save?.chests?.length) return;
		let changed = false;
		for (const c of save.chests) c.t -= dt;
		// Once a second, fold chests that sit close together (older saves, or a pile next to a new drop).
		this.chestMergeT = (this.chestMergeT ?? 0) - dt;
		if (this.chestMergeT <= 0 && save.chests.length > 1) {
			this.chestMergeT = 1;
			const merged = mergeNearbyChests(save.chests);
			if (merged.list.length !== save.chests.length) {
				save.chests = merged.list;
				if (merged.folded[this.chestOpen]) this.chestOpen = merged.folded[this.chestOpen];
				if (merged.folded[this.pendingChest]) this.pendingChest = merged.folded[this.pendingChest];
				changed = true;
			}
		}
		const keep = save.chests.filter((c) => c.t > 0 && !this.chestEmpty(c));
		if (keep.length !== save.chests.length) {
			changed = true;
			for (const c of save.chests) if (!keep.includes(c) && c.t <= 0 && c.map === save.map) this.float(c.x, c.y - 24, "CHEST GONE", "#8a7a6a");
			save.chests = keep;
		}
		if (this.pendingChest) {
			const c = this.chestById(this.pendingChest);
			if (!c || c.map !== save.map) this.pendingChest = null;
			else if (Math.hypot(c.x - save.x, c.y - save.y) <= CHEST_REACH) this.openChest(c.id);
		}
		if (snap.panel === "chest") {
			const c = this.chestById(this.chestOpen);
			if (!c || c.map !== save.map || Math.hypot(c.x - save.x, c.y - save.y) > CHEST_REACH * 2.2) { this.chestOpen = null; publish({ panel: null }); changed = true; }
		}
		if (changed) { this.persist(); this.syncHud(true); }
	}
	/** Takes one thing from the open chest: kind "gear" with a uid, or "item" with an item id. */
	takeFromChest(chestId, kind, key, quiet = false) {
		let taken = null;
		const save = this.save;
		const c = this.chestById(chestId);
		if (!save || !c || this.dead) return;
		if (c.map !== save.map || Math.hypot(c.x - save.x, c.y - save.y) > CHEST_REACH * 2.2) return this.say("Too far from the chest.");
		if (kind === "gear") {
			const g = c.gear.find((x) => x.uid === key);
			if (!g) return;
			c.gear = c.gear.filter((x) => x !== g);
			taken = { ...g, uid: nextUid() };
			this.receiveGear(taken);
			if (!quiet) this.say(`Took ${g.name} (Lv ${g.level}). Double-click it in the Bag to wear it.`);
		} else {
			const n = c.items[key] ?? 0;
			if (n <= 0) return;
			delete c.items[key];
			this.giveItem(key, n);
			this.say(`Took ${ITEM_BY_ID[key]?.name ?? key} x${n}.`);
		}
		this.gainSkill("looting", 3);
		this.cue("click", { rate: 1.15 }, [560, .05, "triangle"]);
		if (this.chestEmpty(c)) {
			save.chests = save.chests.filter((x) => x !== c);
			if (this.chestOpen === c.id) { this.chestOpen = null; publish({ panel: null }); }
		}
		this.persist();
		this.syncHud(true);
		return taken;
	}
	/** Takes a gear piece out of a chest and puts it on straight away. */
	equipFromChest(chestId, uid) {
		const g = this.takeFromChest(chestId, "gear", uid, true);
		if (g) this.equip(g.uid);
	}
	takeAllChest(chestId) {
		const c = this.chestById(chestId);
		if (!c) return;
		for (const id of Object.keys(c.items)) if (this.chestById(chestId)) this.takeFromChest(chestId, "item", id);
		for (const g of [...c.gear]) if (this.chestById(chestId)) this.takeFromChest(chestId, "gear", g.uid);
	}
	chestView() {
		const save = this.save;
		if (!save || !this.chestOpen) return null;
		const c = this.chestById(this.chestOpen);
		if (!c) return null;
		const key = `${c.id}|${c.gear.length}|${c.drops ?? 1}|${Object.entries(c.items).map(([k, n]) => k + n).join(",")}|${Math.ceil(c.t)}`;
		if (this.chestViewCache?.key === key) return this.chestViewCache.view;
		const view = {
			id: c.id, title: c.title, t: Math.ceil(c.t), look: chestLook(c), near: Math.hypot(c.x - save.x, c.y - save.y) <= CHEST_REACH * 2.2,
			gear: c.gear.slice(),
			items: Object.entries(c.items).filter(([, n]) => n > 0).map(([id, count]) => ({ id, name: ITEM_BY_ID[id]?.name ?? id, about: ITEM_BY_ID[id]?.about ?? "", count })),
		};
		this.chestViewCache = { key, view };
		return view;
	}
	/**
	 * Draws a chest with its contents FX: plain for supplies, a coloured beam for gear (colour = best piece
	 * inside), gold sparkles for boss loot, a count badge for merged piles. Blinks in its last 30 seconds.
	 */
	paintChest(ctx, c) {
		const { x, y, t } = c;
		const look = chestLook(c);
		const clock = this.clock;
		const blink = t < 30 && Math.floor(t * 3) % 2 === 0;
		const pop = this.chestPop?.id === c.id ? Math.max(0, 1 - (clock - this.chestPop.t) * 2.5) : 0;
		ctx.save();
		if (blink) ctx.globalAlpha = .55;
		ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(x - 12, y + 1, 24, 4);
		if (look.best) {
			const hi = QUALITY_ORDER.indexOf(look.best);
			const pulse = .5 + Math.sin(clock * 3 + x * .01) * .5;
			// Ground ring.
			ctx.strokeStyle = look.color;
			ctx.globalAlpha = (blink ? .3 : .55) + pulse * .25;
			ctx.lineWidth = 2;
			ctx.beginPath(); ctx.ellipse(x, y + 2, 15 + pulse * 3, 5 + pulse, 0, 0, Math.PI * 2); ctx.stroke();
			// Beam of light: taller and brighter for better gear.
			const beamH = 34 + hi * 12;
			const grad = ctx.createLinearGradient(0, y - 8 - beamH, 0, y - 6);
			grad.addColorStop(0, "rgba(255,255,255,0)");
			grad.addColorStop(1, look.color);
			ctx.globalAlpha = (blink ? .2 : .32) + pulse * .18 + hi * .03;
			ctx.fillStyle = grad;
			ctx.fillRect(x - 6, y - 8 - beamH, 12, beamH);
			ctx.globalAlpha = (blink ? .3 : .55) + pulse * .2;
			ctx.fillRect(x - 2, y - 8 - beamH, 4, beamH);
			// Rising motes.
			ctx.fillStyle = look.color;
			for (let i = 0; i < 2 + hi; i++) {
				const k = (clock * .7 + i / (2 + hi)) % 1;
				ctx.globalAlpha = (1 - k) * (blink ? .4 : .9);
				ctx.fillRect(Math.round(x + Math.sin(i * 2.3 + clock * 2) * 9), Math.round(y - 10 - k * beamH), 2, 2);
			}
			ctx.globalAlpha = blink ? .55 : 1;
		}
		if (c.boss) {
			ctx.fillStyle = `rgba(255,209,102,${.16 + Math.sin(clock * 3) * .07})`;
			ctx.beginPath(); ctx.arc(x, y - 12, 22, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = BOSS_COLOR;
			for (let i = 0; i < 4; i++) {
				const a = clock * 1.8 + i * Math.PI / 2;
				const r = 18 + Math.sin(clock * 4 + i) * 2;
				const sx = Math.round(x + Math.cos(a) * r), sy = Math.round(y - 12 + Math.sin(a) * r * .55);
				ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
			}
		}
		const img = chestCanvas();
		if (img) {
			// Your 16×16 chest sprite at 2x, standing on the ground where the foe fell. It hops when a drop joins it.
			ctx.imageSmoothingEnabled = false;
			const bob = Math.round(Math.sin(clock * 2) * .5) - Math.round(pop * 6);
			ctx.drawImage(img, Math.round(x - 16), Math.round(y - (CHEST_BOTTOM + 1) * 2 + 2 + bob), 32, 32);
		}
		if (look.drops > 1) {
			// Count badge for merged piles.
			const bx = x + 13, by = y - 24;
			ctx.fillStyle = "#140e0c"; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = look.color; ctx.lineWidth = 1.5; ctx.stroke();
			ctx.font = "14px VT323, monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#f2ecdc";
			ctx.fillText(String(Math.min(99, look.drops)), bx, by + 4);
		}
		ctx.restore();
		const label = `${look.label} · ${t < 60 ? `${Math.ceil(t)}s` : `${Math.ceil(t / 60)}m`}`;
		drawShadowName(ctx, label, x, y - 36 - (look.best ? 2 : 0), t < 30 ? "#ff6b5a" : look.color);
	}
	/** Builds this frame's nameplate for a foe on screen. Names, level and traits show at any range. */
	queuePlate(m) {
		const save = this.save;
		if (!save || !m.alive) return;
		const { w, h } = this.cssSize();
		const vx = w / 2 / this.zoom + 80, vy = h / 2 / this.zoom + 80;
		if (Math.abs(m.x - this.cam.x) > vx || Math.abs(m.y - this.cam.y) > vy) return;
		const d = Math.hypot(m.x - save.x, m.y - save.y);
		const focus = m.id === this.hoverMobId || m.id === this.plateFocus;
		// Lag bar: falls toward real health over ~0.6 s after a hit.
		const now = this.clock;
		const dt = Math.min(0.25, Math.max(0, now - (m.plateT ?? now)));
		m.plateT = now;
		m.plateHp = m.plateHp == null || m.plateHp < m.hp ? m.hp : Math.max(m.hp, m.plateHp - Math.max(m.max * 0.9 * dt, (m.plateHp - m.hp) * dt * 2.5));
		const rank = m.witch ? "witch" : m.bounty ? "bounty" : m.hunter ? "hunter" : m.boss ? "boss" : (m.rarity ?? 0) >= 2 || (m.enchants?.length ?? 0) >= 2 ? "elite" : "normal";
		(this.plates = this.plates ?? []).push({
			id: m.id,
			x: m.x,
			y: m.y - (m.witch || m.bounty || m.hunter ? 50 : m.boss ? 44 : m.animal ? 26 : 36),
			name: m.name,
			level: m.level,
			rank,
			tier: m.tier,
			typeColor: m.witch ? "#c4473a" : TYPES[m.type]?.color ?? "#e8dcc4",
			typeName: TYPES[m.type]?.name ?? "",
			hp: Math.max(0, m.hp),
			max: Math.max(1, m.max),
			ghostHp: m.plateHp,
			traits: (m.enchants ?? []).map((id) => TRAIT_SHORT[id] ?? { short: String(id).slice(0, 4).toUpperCase(), color: "#c9a6e8" }),
			focus,
			fade: 1 - Math.max(0, Math.min(1, (d - 420) / 500)),
			enraged: !!m.enraged,
			you: save.level
		});
	}
	float(x, y, text, color) {
		const save = this.save;
		const onPlayer = !!save && Math.abs(x - save.x) < 4 && Math.abs(y - save.y) < 80;
		this.floats.push(makeFloat(x, y, String(text), color, onPlayer, this.floats));
		if (this.floats.length > 60) this.floats.splice(0, this.floats.length - 60);
	}
	gainXp(n) {
		const save = this.save;
		n = Math.max(1, Math.round(n * bendDown(1 + this.mod("xp") / 100, 0.2, 0.05)));
		const grant = this.rules === "hardcore" ? Math.max(1, Math.floor(n * 0.72)) : n;
		save.xp += grant;
		this.gainAccount(grant);
		if (this.turbz) this.growWornGear?.(grant);
		let need = xpNeed(save.level);
		let ups = 0;
		while (save.xp >= need && ups < 48) {
			if (!Number.isFinite(need) || need <= 0) break;
			save.xp -= need;
			save.level += 1;
			save.skillPoints = (save.skillPoints ?? 0) + POINTS_PER_LEVEL;
			if (this.rules !== "hardcore") save.hp = this.maxHp();
			this.say(`Level ${save.level}. +${POINTS_PER_LEVEL} skill points.`);
			this.cue("burst", {}, [480, .12, "square"]);
			this.maybeEvilWitch();
			ups += 1;
			need = xpNeed(save.level);
		}
	}
	maybeEvilWitch() {
		const save = this.save;
		if (!save || save.map !== "world" || !this.world) return;
		const mark = Math.floor(save.level / 20);
		if (mark < 1 || mark <= (save.evilMark ?? 0)) return;
		if (this.rules === "hardcore") return;
		save.evilMark = mark;
		this.spawnEvilWitch();
	}
	spawnEvilWitch() {
		const save = this.save;
		if (!save || !this.world) return;
		const name = WITCH_NAMES[Math.floor(Math.random() * WITCH_NAMES.length)]!;
		const race = RACES[Math.floor(Math.random() * RACES.length)]!;
		let x = save.x + 280;
		let y = save.y;
		for (let i = 0; i < 40; i++) {
			const ang = Math.random() * Math.PI * 2;
			const dist = 220 + Math.random() * 180;
			const wx = save.x + Math.cos(ang) * dist;
			const wy = save.y + Math.sin(ang) * dist;
			if (blocked(this.world, wx, wy)) continue;
			x = wx;
			y = wy;
			break;
		}
		const lvl = Math.max(save.level, 20);
		const rng = mulberry32(((Date.now() ^ (Math.random() * 1e9)) >>> 0) || 3);
		const best = [...MOVES].filter((m) => m.power >= 48 && m.effect !== "mend").sort((a, b) => b.power - a.power);
		const spell = best.find((m) => m.type === race.type) ?? best[0] ?? huntMove(race.type);
		const gear = [0, 1, 2].map(() => rollGear(rng, { level: save.level, bonus: SOURCE_BONUS.witch, luck: 28, raceBias: race.id, floor: "epic", typeBias: race.type }));
		const mob = this.makeMob({ id: `witch-${nextUid()}`, species: "muma", x, y, level: lvl + 2, template: 20, type: race.type, name });
		mob.witch = true;
		mob.race = race.id;
		mob.name = name;
		mob.move = spell.id;
		mob.hp = mob.max = Math.floor(120 + lvl * 28);
		mob.speed = 16 + lvl;
		mob.aggro = true;
		mob.lootGear = gear;
		mob.lootBag = { potion: 3, mushroom: 6, leather: 4 };
		mob.lootKyo = 40 + lvl * 8;
		mob.huntIn = 18;
		mob.seen = true;
		mob.ghost = false;
		this.rekitMob(mob);
		this.mobs.push(mob);
		// Her escort are real ghosts, built the way yours are: ghost kits, aid verses, a 1-in-100 shiny.
		const n = Math.min(OUT_MAX, 2 + (lvl >= 60 ? 1 : 0));
		for (let i = 0; i < n; i++) {
			const pet = this.makeEnemyGhost(mob, i, n, Math.max(1, lvl - 1), { rarity: 2 });
			pet.aggro = true;
			this.mobs.push(pet);
		}
		this.say(`${name} is coming to hunt you. She brings ${n} ghosts.`);
		this.cue("boom", { rate: 0.72 }, [90, .22, "sawtooth"]);
	}
	gainSkill(id, amount) {
		const st = this.save.skills[id];
		if (!st) return;
		amount = Math.max(1, Math.round(amount * aptitudeOf(this.save.classId, id)));
		const gain = this.rules === "hardcore" ? Math.max(1, Math.floor(amount * 2.4)) : amount;
		st.xp += gain;
		let ups = 0;
		while (ups < 48) {
			const need = skillNeed(st.level);
			if (!Number.isFinite(need) || need <= 0 || st.xp < need) break;
			st.xp -= need;
			st.level += 1;
			ups += 1;
		}
		if (ups) {
			const name = SKILLS.find((sk) => sk.id === id)?.name ?? id;
			this.say(`${name} ${st.level}. ${skillLine(id, st.level)}`);
			this.tone(700, .08, "triangle");
		}
	}
	skillN(id) {
		const lv = this.save?.skills?.[id]?.level;
		return Math.max(0, (Number.isFinite(lv) ? lv : 1) - 1);
	}
	offenseFactor(mob, form) {
		const save = this.save;
		let m = 1 + this.skillN("hunting") * 0.002;
		if (form === "ranged") m *= 1 + this.chan("hunter_eye") / 100;
		else if (form !== "spell") m *= 1 + this.chan("edge") / 100;
		if (save && save.hp < this.maxHp() * 0.4) m *= 1 + this.chan("last_stand") / 100;
		if (mob && mob.max > 0 && mob.hp < mob.max * 0.35) m *= 1 + this.chan("execute") / 100;
		if (mob && save && mob.level > save.level) m *= 1 + this.chan("giant_bane") / 100;
		return m;
	}
	/**
	 * Seconds until this foe returns, or null when it must not (rifts, shrines, bounties, witches, hunters).
	 * Hardcore overworld foes, bosses included, always take two minutes.
	 */
	respawnSecondsFor(m) {
		const special = !!(m?.witch || m?.bounty || m?.bountySpirit || m?.enemyGhost || m?.hunter || m?.dungeonBoss || String(m?.id ?? "").startsWith("shrine"));
		return respawnSeconds({
			hardcore: this.rules === "hardcore",
			map: this.save?.map ?? "",
			zoneRespawn: m?.zone?.respawn,
			boss: !!m?.boss,
			special,
		});
	}
	/** A fresh copy of a fallen foe, standing where it belongs. Zone camps roll a new body from the zone. */
	birthFrom(m) {
		let spec = m;
		if (m.zone) {
			const spot = this.zoneSpot(m.zone);
			const pool = m.zone.species?.length ? m.zone.species : null;
			const species = pool ? pool[Math.floor(Math.random() * pool.length)] : m.species;
			const lo = m.zone.levelMin ?? m.level;
			const hi = m.zone.levelMax ?? m.level;
			const level = lo + Math.floor(Math.random() * (Math.max(0, hi - lo) + 1));
			spec = { id: m.id, species, level, x: spot?.x ?? m.homeX, y: spot?.y ?? m.homeY, fixedLevel: true, zone: m.zone, boss: false };
		}
		const born = this.makeMob(this.rollOverworld(m.zone ? {
			id: spec.id, species: spec.species, x: spec.x, y: spec.y, level: spec.level, boss: false, fixedLevel: true, zone: m.zone
		} : {
			...spec, boss: m.boss, bossId: m.bossId, template: m.rolled ? undefined : m.template, type: m.rolled || m.typeRolled ? undefined : m.type, typeRolled: m.typeRolled, animal: m.animal, fixedLevel: false, zone: null
		}));
		if (m.fromSpawn || m.zone) born.fromSpawn = true;
		if (m.zone) born.zone = m.zone;
		born.alive = true;
		return born;
	}
	/**
	 * Proximity spawning. Foes from the map's spawn points only exist while the hunter is near:
	 * they are created on approach and packed away again when the hunter is far and they are not
	 * fighting. Packed foes still count respawn time every frame, so a two-minute timer finishes
	 * even if you walk away.
	 */
	tickDormancy(dt) {
		const save = this.save;
		if (!save || !this.world) return;
		if (!this.dormant) this.dormant = [];
		for (const d of this.dormant) {
			const dead = d.mob;
			if (!dead || dead.alive) continue;
			const delay = this.respawnSecondsFor(dead);
			if (delay == null) continue;
			if (!(dead.respawn > 0) || !Number.isFinite(dead.respawn)) dead.respawn = delay;
			dead.respawn -= dt;
			if (dead.respawn <= 0) {
				const born = this.birthFrom(dead);
				d.mob = born;
				d.x = born.homeX ?? born.x;
				d.y = born.homeY ?? born.y;
			}
		}
		this.dormancyT = (this.dormancyT ?? 0) - dt;
		if (this.dormancyT > 0) return;
		this.dormancyT = .4;
		const z = Math.max(.5, this.zoom ?? 1);
		const css = this.cssSize?.() ?? { w: 1366, h: 860 };
		const view = Math.hypot(css.w, css.h) / 2 / z;
		const on = Math.max(900, view + 260), off = on + 520;
		const px = save.x, py = save.y;
		const keep = [];
		for (const d of this.dormant) {
			if (Math.abs(d.x - px) > on || Math.abs(d.y - py) > on || Math.hypot(d.x - px, d.y - py) > on) { keep.push(d); continue; }
			let m = d.mob;
			if (!m) { m = this.makeMob(this.rollOverworld(d.spec)); m.fromSpawn = true; }
			this.mobs.push(m);
		}
		this.dormant = keep;
		const live = [];
		for (const m of this.mobs) {
			const idle = m.fromSpawn && !m.boss && !m.master && (!m.alive || (!m.aggro && m.hurt <= 0 && !m.status?.length));
			if (idle && Math.hypot(m.x - px, m.y - py) > off && Math.hypot((m.homeX ?? m.x) - px, (m.homeY ?? m.y) - py) > off) {
				if (m.alive) { m.hp = m.max; m.x = m.homeX ?? m.x; m.y = m.homeY ?? m.y; }
				this.dormant.push({ mob: m, x: m.homeX ?? m.x, y: m.homeY ?? m.y, at: this.clock });
			} else live.push(m);
		}
		this.mobs = live;
	}
	tickMobs(dt) {
		const save = this.save;
		this.refreshPower(dt);
		this.tickWanted(dt);
		this.tickDormancy(dt);
		for (const m of this.mobs) {
			m.hurt = Math.max(0, m.hurt - dt * 3);
			m.walk += dt * 4;
			// Foes keep pace with the hunter as the game goes, not just when they respawn.
			if (m.alive) {
				m.scaleT = (m.scaleT ?? 0) - dt;
				if (m.scaleT <= 0 || m.nightScaled !== this.isNightNow()) {
					m.scaleT = .25;
					this.scaleMob(m);
				}
				for (const id of Object.keys(m.kcd ?? {})) m.kcd[id] = Math.max(0, m.kcd[id] - dt);
				m.thornT = Math.max(0, (m.thornT ?? 0) - dt);
				if (m.wardT > 0) m.wardT = Math.max(0, m.wardT - dt);
				if (m.enchants?.includes("regenerating") && m.hp < m.max) m.hp = Math.min(m.max, m.hp + m.max * .004 * dt);
			}
			m.status = tickStatuses(m.status, dt, this.toughFoe(m));
			if (!m.alive) {
				const delay = this.respawnSecondsFor(m);
				if (delay == null) continue;
				if (!(m.respawn > 0) || !Number.isFinite(m.respawn)) m.respawn = delay;
				m.respawn -= dt;
				if (m.respawn <= 0) {
					const zone = m.zone;
					const born = this.birthFrom(m);
					Object.assign(m, born);
					if (zone) m.zone = zone;
				}
				continue;
			}
			if (!m.boss && !m.witch && !m.master && Math.hypot(m.x - save.x, m.y - save.y) > 1200) continue;
			if (m.status.some((s) => s.id === "burn")) m.hp -= Math.max(6, m.max * .01) * dt;
			if (m.hp <= 0) {
				this.killMob(m);
				continue;
			}
			if (m.rival) { this.tickRival(m, dt); continue; }
			if (m.twitch) { this.tickTwitch?.(m, dt); continue; }
			if (m.status.some((s) => s.id === "sleep")) continue;
			const dx = save.x - m.x;
			const dy = save.y - m.y;
			const d = Math.hypot(dx, dy);
			this.tickMobAttack(m, d, dt);
			const rooted = m.status.some((s) => s.id === "root");
			if ((m.animal && m.species !== "wolf" && m.species !== "boar") || m.flee) {
				if (!rooted && d < 120 && d > 1) {
					this.moveMob(m, -dx / d * 70 * dt, -dy / d * 70 * dt);
					m.facing = dx < 0 ? 1 : -1;
				} else if (!rooted) m.x += Math.sin(m.walk) * 10 * dt;
				continue;
			}
			if (m.witch || m.bounty) {
				this.tickWitch(m, save.x, save.y, d, dx, dy, dt);
				continue;
			}
			if (m.bountySpirit) {
				this.tickBountySpirit(m, dt);
				continue;
			}
			if (m.enemyGhost) {
				const lead = this.mobs.find((x) => x.id === m.master && x.alive);
				if (!lead) {
					// Her ghosts fade with her.
					m.alive = false;
					m.hp = 0;
					this.float(m.x, m.y - 30, "FADES", "#c9a6e8");
					continue;
				}
				else {
					this.tickEnemyGhostAid(m, dt);
					if (!this.wantsFight(m, d) && !m.status.some((st) => st.id === "root")) { this.orbitMaster(m, lead, dt); continue; }
				}
			}
			if (m.foeRival && this.lms && this.mobVsRival(m, dt, d)) continue;
			const aggro = this.wantsFight(m, d);
			if (aggro) {
				this.combat = 2;
				m.aggro = true;
			}
			const move = MOVE_BY_ID[m.move] ?? MOVES[0];
			const reach = attackRange(move);
			if (aggro && d > Math.min(reach * .72, 120) && !rooted && d > 1) {
				const sp = (m.boss ? 46 : m.look?.aggression === "hunt" ? 70 : 58) * (m.status.some((s) => s.id === "soak") ? .7 : 1);
				this.moveMob(m, dx / d * sp * dt, dy / d * sp * dt);
				if (dx < 0) m.facing = -1;
				else m.facing = 1;
			} else if (!aggro && !rooted) {
				m.x += Math.sin(m.walk) * (m.ghost ? 18 : 8) * dt;
				if (m.ghost) m.y += Math.cos(m.walk * .7) * 8 * dt;
			}
		}
	}
	wantsFight(m: Mob, d: number) {
		const save = this.save;
		if (m.master) {
			const boss = this.mobs.find((x) => x.id === m.master && x.alive);
			if (boss && (boss.seen || boss.huntIn <= 0 || boss.hurt > 0 || boss.aggro)) return d < 240;
			return false;
		}
		if (m.flee) return false;
		// Already hurt / aggro'd — keep fighting even through walls (they know where you are).
		if (m.hurt > 0 || m.aggro || m.hp < m.max) return d < (m.boss ? 280 : 240);
		if ((m.drift || m.look?.aggression === "drift") && !m.boss && !m.witch) return false;
		// Fresh aggro: don't detect the player through solid walls.
		const range = d < (m.boss ? 240 : m.animal ? 110 : 168);
		if (!range) return false;
		if (this.world && save && wallBetween(this.world, m.x, m.y, save.x, save.y)) return false;
		return true;
	}
	moveMob(m, dx, dy) {
		const world = this.world;
		const x = m.x;
		const y = m.y;
		const hit = (px, py) => blocked(world, px, py) || blocked(world, px - 7, py) || blocked(world, px + 7, py) || blocked(world, px, py - 6);
		if (!hit(m.x + dx, m.y)) m.x += dx;
		if (!hit(m.x, m.y + dy)) m.y += dy;
		m.moving = m.x !== x || m.y !== y;
		m.direction = directionFromDelta(m.x - x, m.y - y, m.direction);
		if (m.x !== x) m.facing = m.x < x ? -1 : 1;
	}
	tickWitch(m, px, py, d, dx, dy, dt) {
		m.moving = false;
		if (!m.bounty && m.huntIn > 0) {
			m.huntIn -= dt;
			if (m.huntIn <= 0) this.say(`${m.name} is done waiting. She is hunting you.`);
		}
		const hunting = m.bounty ? !!m.enraged : m.huntIn <= 0;
		if (m.bounty && !hunting) {
			if (d < 200 || m.hurt > 0) {
				if (!m.seen) this.say(`${m.name} turns to face you.`);
				m.seen = true;
			} else if (d > 360) m.seen = false;
		} else if ((d < 280 || m.hurt > 0) && !m.seen) {
			m.seen = true;
			this.say(`${m.name} knows you are here.`);
		}
		const rooted = m.status.some((s) => s.id === "root");
		m.cd -= dt;
		const engage = hunting || m.seen;
		const agility = m.classId && CLASS_BY_ID[m.classId] ? 1 + Math.max(-.25, (CLASS_BY_ID[m.classId].stats.speed ?? 0) / 180) : 1;
		if (!rooted && d > 4) {
			if (engage && (hunting || d < 320)) {
				witchSteer(this, m, d, dx, dy, dt, hunting, agility);
			} else if (!engage) {
				const hx = m.homeX - m.x;
				const hy = m.homeY - m.y;
				const hd = Math.hypot(hx, hy);
				if (hd > 36) this.moveMob(m, hx / hd * 26 * dt, hy / hd * 26 * dt);
			}
		}
		if (!engage) m.aggro = false;
		if ((m.bounty || m.hunter) && hunting && this.world) {
			m.chaseT = (m.chaseT ?? 0) + dt;
			if (m.chaseT > 2.2) {
				m.chaseT = 0;
				if (d > 200 && d > (m.chaseD ?? d) - 16) {
					const step = Math.min(Math.max(64, d - 90), 320);
					const at = nearestOpen(this.world, m.x + (dx / Math.max(d, 1)) * step, m.y + (dy / Math.max(d, 1)) * step);
					m.x = at.x;
					m.y = at.y;
					const pack = this.mobs.filter((s) => s.bountySpirit && s.master === m.id && s.alive);
					pack.forEach((s, i) => {
						const pet = nearestOpen(this.world, at.x + (i - 1) * 24, at.y + 18);
						s.x = pet.x;
						s.y = pet.y;
					});
				}
				m.chaseD = Math.hypot(px - m.x, py - m.y);
			}
		}
		if (!engage || this.role === "guest") return;
		this.combat = 2;
		m.aggro = true;
	}
	threat() {
		const save = this.save;
		if (!save) return { hp: 1, dmg: 1, lv: 0 };
		const gear = ["weapon", "head", "chest", "legs", "feet", "relic"].reduce((n, slot) => { const g = this.piece(slot); return n + (g ? ["worn", "common", "fine", "rare", "epic", "legendary"].indexOf(g.quality) + 1 : 0); }, 0);
		const depth = (save.dungeons?.sequence ?? 0) + (save.map.startsWith("rift-") ? 2 : 0);
		if (this.rules === "hardcore") return { hp: 1 + save.level * .05 + gear * .03 + depth * .06, dmg: 1 + save.level * .04 + gear * .02 + depth * .05, lv: Math.floor(save.level / 6 + depth / 2) };
		return { hp: 1 + save.level * .012, dmg: 1 + save.level * .008, lv: 0 };
	}
	mobHitsPlayer(m, move, dist = 99, mult = 1) {
		const save = this.save;
		this.cue("hurt", {});
		this.lastHit = { by: m.name, level: m.level, move: move?.name ?? "", kind: m.bounty ? `tier ${m.tier ?? 1} bounty` : m.hunter ? "hunter" : m.witch ? "witch" : m.boss ? "world boss" : m.enemyGhost ? "witch's ghost" : m.animal ? "beast" : "", mark: mult > 1, t: this.clock };
		if (this.playerSafeCamp()) {
			this.float(save.x, save.y - 36, "SAFE", "#9ad8c8");
			return;
		}
		if (this.gim && !this.gim.allowHit(m, this.foeForm(m, move))) return;
		let dmg = this.foeHitRaw(m, move, dist) * mult;
		const crit = Math.random() < bendChance((m.stats?.crit ?? .03) + (m.enraged && (m.bounty || m.bountySpirit) ? BOUNTY_ENRAGE.crit : 0));
		if (crit) {
			dmg *= 1.75;
			this.float(m.x, m.y - 48, "CRIT", "#ff6a4a");
		}
		// Melee hits ignore your ward, shell and guard completely, like armor.
		const form = this.foeForm(m, move);
		dmg *= 1 - bend(defenseVs(form, this.chan("ward") / 160 + this.buff.ward), 0.45, 0.8);
		if (form !== "melee" && this.status.some((s) => s.id === "shell")) dmg *= .7;
		dmg *= 1 - bendSigned(defenseVs(form, this.mod("guard") / 100), -0.8, -0.5, 0.6, 0.9);
		if (Math.random() * 100 < bend(this.chan("echo_guard"), 40, 75)) {
			this.float(save.x, save.y - 36, "ECHO", "#6a4cff");
			return;
		}
		if (this.skillN("evasion") && Math.random() < ratingChance(this.skillN("evasion") * 0.1)) {
			this.float(save.x, save.y - 36, "SLIP", "#9ad8c8");
			this.gainSkill("evasion", 2);
			return;
		}
		const evaded = (this.evadeT ?? 0) > 0 || this.wardT > 0;
		if (!evaded && this.ghostGuard()) return;
		const hpBefore = save.hp;
		// The hit's effect is applied once, after the damage (so a sleeping hit cannot wake and re-sleep).
		this.hurtSelf(dmg, null);
		if (!evaded) this.applyEffect(move, null, false);
		if (save.hp < hpBefore && m.alive && m.enchants?.includes("vampiric")) {
			m.hp = Math.min(m.max, m.hp + m.max * .015);
			this.float(m.x, m.y - 40, "DRAIN", "#c4473a");
		}
	}
	/** How a foe's verse lands: beasts always bite in melee. */
	foeForm(m, move) {
		return m?.animal ? "melee" : attackForm(move);
	}
	/** One clean hit from this foe before the hunter's ward, shell, guard and dodges. */
	foeHitRaw(m, move, dist = 99) {
		if (m.rival) return this.rivalHitRaw(m, move);
		const form = this.foeForm(m, move);
		const ref = this.powerRef ?? this.measurePlayer();
		if (!(m.frac > 0)) this.scaleMob(m);
		let dmg = enemyHitDamage({
			maxHpRef: ref.maxHp,
			frac: m.frac ?? .05,
			dmgMult: m.stats?.dmg ?? 1,
			movePower: move.power,
			form,
			typeMult: form === "spell" ? 1 : typeChart(move.type, this.armorType()),
			armor: this.playerArmor(),
			armorRef: ref.armor,
			night: this.isNightNow() ? NIGHT.strength : 1,
			enraged: !!m.enraged,
			frenzied: !!m.enchants?.includes("frenzied") && m.hp < m.max * .5,
		});
		if (m.enraged && (m.bounty || m.bountySpirit)) dmg *= BOUNTY_ENRAGE.dmg;
		return dmg;
	}
	tickGuestHurt(dt) {
		for (const m of this.mobs) {
			m.hurt = Math.max(0, m.hurt - dt * 3);
			m.walk += dt * 3;
		}
	}
	hurtSelf(amount, effect) {
		const save = this.save;
		if ((this.evadeT ?? 0) > 0) {
			this.float(save.x, save.y - 36, "EVADE", "#e7d9ff");
			this.cfx?.evade(save.x, save.y - 18);
			this.gainSkill("evasion", 2);
			return;
		}
		if (this.wardT > 0) {
			this.float(save.x, save.y - 36, "WARD", "#fff1a8");
			return;
		}
		if (this.rollT > 0) {
			const cover = this.rollCoverNow ?? 0.4;
			if (this.rollFailed) {
				amount *= 1.24;
				this.float(save.x, save.y - 36, "TRIP", "#c4473a");
			} else if (cover >= 0.98) {
				this.float(save.x, save.y - 36, "CLEAR", "#e7d9ff");
				return;
			} else {
				amount *= 1 - cover * 0.85;
				this.float(save.x, save.y - 36, cover > 0.55 ? "GRAZE" : "CLIP", "#e7d9ff");
				if (amount < 0.75) return;
			}
		}
		let dmg = amount * (this.gim?.hurtMult(amount) ?? 1);
		if (this.shield > 0) {
			const use = Math.min(this.shield, dmg);
			this.shield -= use;
			dmg -= use;
		}
		if (dmg <= 0) return;
		this.meleeChain = breakMelee(this.meleeChain ?? freshMelee());
		if (this.orbit) this.orbit.broken = true;
		if (this.castLock > 0 && !this.orbit) {
			this.weave = shatterWeave(this.weave ?? freshWeave());
			this.float(save.x, save.y - 56, "FALTER", "#c9a6e8");
		}
		if ((this.overcastT ?? 0) > 0) dmg *= 1.12;
		this.sleeping = false;
		if (hasStatus(this.status, "sleep") && endStatus(this.status, "sleep")) this.float(save.x, save.y - 60, "AWAKE", "#fff1a8");
		save.hp -= dmg;
		if (save.hp <= 0 && this.gim?.saveFromDeath()) save.hp = 1;
		this.gim?.afterHurt(dmg);
		if (save.hp > 0) this.ghostSecondWind();
		if (this.rules === "hardcore") this.persist();
		this.hurt = 1;
		this.shake = Math.max(this.shake, 3);
		this.float(save.x, save.y - 42, `${Math.floor(dmg)}`, "#c4473a");
		this.combat = 3;
		const thorns = this.chan("thorns");
		if (thorns > 0) {
			const foe = this.nearestMob(save.x, save.y, 220);
			if (foe?.alive) this.applyMobDamage(foe, Math.max(1, Math.floor(dmg * bend(thorns / 100, 0.35, 0.6))), false);
		}
		if (effect && effect !== "none" && effect !== "mend") this.addStatus(effect, 3.5);
		if (save.hp <= 0) {
			if (this.chan("second_chance") >= 1 && !this.secondUsed) {
				this.secondUsed = true;
				save.hp = 1;
				this.say("Second Chance.");
				return;
			}
			this.die();
		}
	}
	/** Burning: 5% of max health every second for 15 seconds. Shields soak it; dodges and wards do not. Cleanse Salt puts it out. */
	tickBurn(dt) {
		const save = this.save;
		const burn = this.status.find((s) => s.id === "burn");
		if (!save || !burn || this.dead) return;
		if (this.lastHit && !this.lastHit.survival) this.lastHit.burning = true;
		burn.tick = (burn.tick ?? 1) - dt;
		while (burn.tick <= 0 && !this.dead) {
			burn.tick += 1;
			let dmg = this.maxHp() * BURN_PCT_PER_SECOND;
			if (this.shield > 0) {
				const use = Math.min(this.shield, dmg);
				this.shield -= use;
				dmg -= use;
			}
			if (dmg <= 0) continue;
			this.sleeping = false;
			save.hp -= dmg;
			this.hurt = Math.max(this.hurt, .6);
			this.combat = Math.max(this.combat, 2);
			this.float(save.x, save.y - 42, `${Math.ceil(dmg)}`, "#ffb15e");
			if (save.hp <= 0) {
				if (this.chan("second_chance") >= 1 && !this.secondUsed) {
					this.secondUsed = true;
					save.hp = 1;
					this.status = this.status.filter((s) => s.id !== "burn");
					this.say("Second Chance. The flames go out.");
					return;
				}
				this.say("Burned to death.");
				this.die();
				return;
			}
			if (this.rules === "hardcore") this.persist();
		}
	}
	die() {
		if (this.lms) { this.lmsDefeat?.(); return; }
		if (this.turbz) { this.turbzFell(); return; }
		const save = this.save;
		if (this.rules !== "hardcore" && (this.shrine || save.map !== "world")) {
			this.knockOut();
			return;
		}
		for (const g of save.gear) this.noteFound(g);
		// Hunt keeps her ghosts for the next witch. Hardcore does not.
		if (this.rules !== "hardcore") this.bankGhosts(save);
		const kyoAtDeath = save.kyo;
		const scored = this.bankAccount(save);
		this.emitGrave(save, scored);
		this.dead = true;
		this.dest = null;
		save.lastDeath = this.deathReport(save, scored, kyoAtDeath);
		if (this.rules === "hardcore") {
			save.spirits = [];
			save.ghostStore = [];
			save.companion = null;
			save.box = [];
			takeVaultGhosts("hardcore");
		}
		publish({ panel: "died", died: save.lastDeath });
		this.persist();
		this.say(this.rules === "hardcore"
			? "This witch is gone. Her ghosts are gone with her. Skills, account level, and permanent bonuses stay."
			: "This witch is gone. Her levels and kit became Account Score. Skills, account level, and permanent bonuses stay.");
		this.playYouDied();
		this.syncHud(true);
	}
	/** TURBZ death: the run ends. Worn gear and party ghosts are kept for the next start, at level 1. Shared Hunt and Hardcore skills are not touched. */
	turbzFell() {
		const save = this.save;
		if (!save || this.dead) return;
		this.stashTurbzKit?.();
		let score = save.level * 50 + (save.xp | 0) + Math.floor((save.kyo | 0) / 2);
		for (const g of save.gear ?? []) score += gearScore(g);
		for (const sk of Object.values(save.skills ?? {})) score += Math.max(0, ((sk.level ?? 1) - 1) * 8);
		score = Math.max(1, Math.floor(score));
		this.emitGrave(save, score);
		this.dead = true;
		this.dest = null;
		this.lunge = null;
		this.rush = null;
		this.orbit = null;
		save.hp = 0;
		save.lastDeath = this.deathReport(save, score, save.kyo | 0);
		if (save.lastDeath) save.lastDeath.accountScore = 0;
		publish({ panel: "died", died: save.lastDeath });
		this.say("You died. Play again to start over. What you wore, and the ghosts in your party, come back at level 1 with their enchants. This run's skills are wiped. Hunt and Hardcore keep theirs.");
		this.playYouDied();
		this.syncHud(true);
	}
	/** What the You Died screen shows. */
	deathReport(save, scored, kyo): DeathReport {
		const c = CLASS_BY_ID[save.classId];
		const skills = SKILLS.map((k) => ({ name: k.name, level: save.skills?.[k.id]?.level ?? 1 })).filter((k) => k.level > 1).sort((a, b) => b.level - a.level).slice(0, 3);
		const t = Math.floor(save.lifeT ?? 0);
		return {
			world: save.world?.name || mainWorldFile()?.name || "Veilreach", seed: save.world?.seed ?? 0,
			name: save.name, className: c?.name ?? "Witch", focus: c?.focus ?? "", level: save.level, mode: this.turbz ? "turbz" : this.rules,
			cause: this.causeOfDeath?.() ?? "", kills: save.lifeKills ?? 0, survived: t >= 3600 ? `${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m` : `${Math.floor(t / 60)}m ${t % 60}s`,
			kyo, score: scored, accountScore: save.accountScore ?? 0, spirits: (save.spirits ?? []).length, shinies: [...(save.spirits ?? []), ...(save.ghostStore ?? [])].filter((x) => x?.shiny).length,
			gear: (save.gear ?? []).filter((g) => Object.values(save.equipped ?? {}).includes(g.uid)).map((g) => g.name).slice(0, 6), skills,
		};
	}
	/** You Died → choose the next witch. */
	toRebirth() {
		if (!this.dead) return;
		publish({ panel: "rebirth" });
	}
	knockOut() {
		const save = this.save;
		const loss = Math.max(6, Math.min(save.kyo, 12 + Math.floor(save.kyo * .15)));
		save.kyo -= loss;
		save.hp = Math.max(1, Math.floor(this.maxHp() * .42));
		this.dead = false;
		this.dest = null;
		this.status = [];
		this.shield = 0;
		this.wardT = 0;
		this.castLock = 0;
		this.meleeChain = freshMelee();
		this.weave = freshWeave();
		this.overcastT = 0;
		this.lunge = null;
		this.rush = null;
		this.orbit = null;
		this.shrine = null;
		this.mobs = this.mobs.filter((m) => !m.id.startsWith("shrine-"));
		if (save.map !== "world") {
			const portal = save.dungeons?.portals.find(p => p.id === save.map);
			if (portal) { save.x = portal.x; save.y = portal.y; }
			const door = POIS.find((p) => p.kind === "dungeon" && p.id === save.map);
			save.map = "world";
			if (door && door.kind === "dungeon") {
				const at = scaleTile(door.tx, door.ty);
				save.x = at.tx * 32 + 16;
				save.y = (at.ty + 2) * 32 + 8;
			}
			this.loadMap("world", false);
		}
		this.cam.x = save.x;
		this.cam.y = save.y;
		publish({
			panel: null,
			death: []
		});
		this.say(`Knocked out. The ring keeps ${loss} kyo. You keep your gear.`);
		this.persist();
		this.syncHud(true);
	}
	rebirth(name, race: RaceId, setId, classId: ClassId = LEGACY_CLASS[race], traitId: string | null = null, female = true) {
		const save = this.save;
		if (!save || !this.dead) return;
		if (this.turbz) {
			this.startTurbz?.(name, race, classId, traitId, female);
			return;
		}
		const set = setId ? SET_BY_ID[setId] : null;
		const wear = set && this.isUnlocked(set.id, classId) ? set.id : null;
		save.name = (name || "Huntress").slice(0, 16);
		save.race = race;
		save.classId = classId;
		save.traitId = traitId && TRAIT_BY_ID[traitId] ? traitId : null;
		{
			// Hunt: ghosts banked at death come back. Hardcore already emptied the vault.
			const have = new Set([...(save.spirits ?? []), ...(save.ghostStore ?? [])].map((g) => g.uid));
			const back = this.rules === "hardcore" ? [] : takeVaultGhosts(this.rules).filter((g) => g && !have.has(g.uid) && g.species);
			save.ghostStore = [...(save.ghostStore ?? []), ...back.map((g) => ({ ...g, active: false }))].slice(0, GHOST_STORE_MAX);
		}
		{
			const cap = classSpiritOut(classId);
			let following = 0;
			for (const s of save.spirits ?? []) {
				if (s.active && following < cap) following += 1;
				else s.active = false;
			}
		}
		save.female = female !== false;
		save.classMovesV = 3;
		for (const id of CLASS_BY_ID[classId].starterMoves) if (MOVE_BY_ID[id] && !save.abilityRanks?.[id]) {
			save.abilityRanks = save.abilityRanks ?? {};
			save.abilityRanks[id] = 1;
		}
		save.level = 1;
		save.xp = 0;
		save.hp = 90;
		if (this.rules === "hardcore") { save.survival = normalizeSurvival(); save.dayNight = freshDayNight(); save.mapQuests = {}; this.sleeping = false; this.buildMode = false; this.syncSolids(save.map); save.ghostBox = null; save.chests = []; this.chestOpen = null; save.wildGhosts = []; this.wildOpen = null; }
		save.kyo = Math.floor(save.kyo * .85);
		save.bag = {
			potion: 2,
			ghost_jar: 0,
			cleanse_salt: 0,
			leather: 0,
			mushroom: 0
		};
		if (this.rules === "hardcore") save.bag.trail_ration = 2;
		save.party = [];
		save.companion = null;
		save.jarLeft = 0;
		save.deathBanked = false;
		save.lifeKills = 0;
		save.lifeT = 0;
		save.lastDeath = null;
		save.pendingLoot = null;
		save.locked = [];
		// A new witch has no name yet: fresh bounty board, no stars, no price on her head.
		save.hunt = undefined;
		this.contract = [];
		this.mobs = this.mobs.filter((m) => !m.bounty && !m.bountySpirit);
		this.powerRef = null;
		this.contract = (this.contract ?? []).filter((m) => !m.hunter);
		this.mobs = this.mobs.filter((m) => !m.hunter);
		const known = [...CLASS_BY_ID[classId].starterMoves];
		save.innate = known;
		save.known = known;
		save.bar = known;
		save.loadout = undefined;
		save.progressionVersion = undefined;
		normalizeAbilities(save);
		if (wear) this.wearSet(wear);
		else {
			const type = CLASS_BY_ID[save.classId].type;
			const weapon = rollGear(mulberry32(Math.random() * 1e9 | 0), {
				level: 1,
				slot: "weapon",
				floor: "common",
				typeBias: type,
				raceBias: race
			});
			save.gear = [weapon];
			save.equipped = { weapon: weapon.uid };
		}
		// A new life rolls a new world, unless "Keep Current World" was chosen on the death screen.
		if (!this.keepWorld || !save.world) {
			const oldId = mainWorldFile()?.id ?? "";
			save.world = rollLifeWorld();
			this.enterLifeWorld(save.world);
			save.mainWorld = this.mainWorldSig();
			// Anything pinned to the old world's ground goes with it.
			if (save.survival?.campfires) save.survival.campfires = save.survival.campfires.filter((f) => f.map !== "world");
			if (save.survival?.logs) save.survival.logs = save.survival.logs.filter((l) => l.map !== "world");
			if (save.dungeons?.portals) save.dungeons.portals = [];
			save.nodesTaken = {};
			save.wildGhosts = [];
			save.regions = [];
			if (save.mapQuests && oldId) for (const k of Object.keys(save.mapQuests)) if (k.startsWith(`${oldId}:`)) delete save.mapQuests[k];
			if (save.ghostBox && save.ghostBox.map === "world") {
				if (this.rules !== "hardcore") for (const [id, n] of Object.entries(BUILD_PIECES.ghostbox.cost)) this.giveItem(id, n);
				save.ghostBox = null;
			}
			this.syncSolids("world");
		}
		this.keepWorld = false;
		publish({ keepWorld: false });
		// TurboHunt wakes you at a random tavern. Hardcore always starts over at the world's starting point
		// and you fast travel back to towns you have already seen (see fastTravelTo).
		const hardcoreWake = this.rules === "hardcore";
		const tavern = hardcoreWake ? null : this.pickTavern();
		save.map = "world";
		if (tavern) {
			save.lastTavern = tavern.id;
			save.x = tavern.boardTx * 32 + 16;
			save.y = (tavern.boardTy + 1) * 32 + 8;
		} else {
			const home = hearthXY();
			save.x = home.x;
			save.y = home.y;
		}
		this.secondUsed = false;
		this.status = [];
		this.shield = 0;
		this.shrine = null;
		this.dead = false;
		this.loadMap("world", false);
		this.ensureHunt();
		const spot = nearestOpen(this.world, save.x, save.y);
		save.x = spot.x;
		save.y = spot.y;
		this.cam.x = save.x;
		this.cam.y = save.y;
		this.syncArsenal(save);
		save.hp = this.maxHp();
		publish({
			panel: null,
			death: []
		});
		const dressed = wear ? SET_BY_ID[wear].name : "the default robes";
		if (save.world?.name) this.say(`A new life in ${save.world.name}${save.world.seed ? ` (seed ${save.world.seed})` : ""}.`);
		if (tavern) this.say(`${save.name} wakes at ${tavern.name} in ${dressed}. Skills stayed with the account. The board is by the door.`);
		else this.say(`${save.name} wakes at the world's starting point in ${dressed}. Skills stayed with the account. Open the map (M) and click a town you have visited to fast travel.`);
		this.persist();
		this.syncHud(true);
	}
	wearSet(setId) {
		const save = this.save;
		const rng = mulberry32(Math.random() * 1e9 | 0);
		const race = save.race;
		const type = CLASS_BY_ID[save.classId].type;
		const floor = save.accountLevel >= 10 ? "fine" : "common";
		const pieces = [
			"head",
			"chest",
			"legs",
			"feet",
			"relic"
		].map((slot) => rollGear(rng, {
			level: Math.max(1, save.level),
			slot,
			setId,
			floor,
			raceBias: race,
			typeBias: type,
			luck: 8
		}));
		const weapon = rollGear(rng, {
			level: Math.max(1, save.level),
			slot: "weapon",
			floor,
			typeBias: type,
			raceBias: race
		});
		save.gear = [weapon, ...pieces];
		save.equipped = { weapon: weapon.uid };
		for (const p of pieces) save.equipped[p.slot] = p.uid;
	}
	noteFound(g) {
		const save = this.save;
		if (!save || !g?.setId || g.slot === "weapon" || !SET_BY_ID[g.setId]) return;
		const slots = new Set(save.found[g.setId] ?? []);
		slots.add(g.slot);
		save.found[g.setId] = [...slots];
		// Per character: the class wearing the body when the piece was found.
		const cls = save.classId;
		if (!cls) return;
		save.foundBy = save.foundBy ?? {};
		const mine = (save.foundBy[cls] = save.foundBy[cls] ?? {});
		const had = mine[g.setId] ?? [];
		if (had.includes(g.slot)) return;
		mine[g.setId] = [...had, g.slot];
		if (mine[g.setId].length === SET_PIECES.length) {
			const set = SET_BY_ID[g.setId];
			this.say(`Set unlocked for ${CLASS_BY_ID[cls]?.name ?? "this witch"}: ${set.name}. Your next life as this class can wake wearing it.`);
			this.cue("sparkle", { rate: 1.1, len: 1.4 }, [660, .25]);
		}
	}
	/** A set is unlocked for a class once that class has found all five pieces. */
	isUnlocked(id, classId = this.save?.classId) {
		const have = new Set(this.save?.foundBy?.[classId]?.[id] ?? []);
		return SET_PIECES.every((s) => have.has(s));
	}
	unlockedSets() {
		const by = this.save?.foundBy ?? {};
		const out = [];
		for (const cls of Object.keys(by)) for (const id of Object.keys(by[cls])) {
			const set = SET_BY_ID[id];
			if (set && this.isUnlocked(id, cls)) out.push({ id, name: set.name, race: set.race, bonus: set.bonus, classId: cls });
		}
		return out;
	}
	setProgress() {
		const mine = this.save?.foundBy?.[this.save?.classId] ?? {};
		return Object.entries(mine).filter(([id]) => SET_BY_ID[id]).map(([id, slots]) => ({ id, name: SET_BY_ID[id].name, have: slots.length, slots: [...slots] }))
			.sort((a, b) => b.have - a.have || a.name.localeCompare(b.name)).slice(0, 12);
	}
	autoHarvest() {
		const save = this.save;
		if (!save || save.map !== "world" || this.dead || this.channel || this.rules === "hardcore") return;
		// Only the starting resource nodes (and their respawns) are picked up by walking over them.
		const n = this.nodeNear(null, 64, true);
		if (n) this.harvestNow(n.id, n.node);
	}
	harvestNow(id, node) {
		this.depleteNode(id);
		const luck = 1 + this.chan("harvest") / 100;
		if (node === "ore") {
			const n = Math.max(1, Math.floor((1 + Math.random()) * luck * (1 + this.skillN("mining") * 0.003)));
			this.giveItem("ore", n);
			this.cue("chop", { rate: 0.9 });
			this.gainSkill("mining", 14);
			this.say(`Ore x${n}.`);
		} else if (node === "tree") {
			const n = Math.max(1, Math.floor((1 + Math.random()) * luck * (1 + this.chan("lumberjack") / 100) * (1 + this.skillN("woodcutting") * 0.003)));
			this.giveItem("timber", n);
			this.cue("chop", {});
			this.gainSkill("woodcutting", 14);
			this.say(`Timber x${n}.`);
		} else if (node === "shroom") {
			const bonus = this.chan("shroom_sense");
			const extra = procs(this.skillN("shroom") * 0.2);
			this.giveItem(Math.random() < .34 ? "dreamspore" : Math.random() < .5 ? "embercap" : "blue_lantern", 1 + (bonus > 20 ? 1 : 0) + extra);
			this.giveItem("mushroom", Math.max(1, Math.floor((1 + extra) * (1 + this.chan("forager") / 100) + Math.random() * 0.5)));
			if (Math.random() * 100 < this.chan("forager") * 0.6) this.giveItem(Math.random() < .5 ? "dreamspore" : "blue_lantern", 1);
			this.gainSkill("shroom", 16);
			this.say("The patch gives.");
		}
		this.boardEvent(node as BoardKind);
		this.persist();
	}
	bankAccount(save: Save) {
		if (save.deathBanked) return 0;
		let score = save.level * 50 + save.xp + Math.floor(save.kyo / 2);
		for (const g of save.gear) score += gearScore(g);
		for (const n of Object.values(save.bag)) score += (n ?? 0) * 4;
		for (const sk of Object.values(save.skills)) score += Math.max(0, (sk.level - 1) * 8);
		for (const s of save.spirits ?? []) score += this.spiritPower(s);
		if (this.rules === "hardcore") {
			let skill = 0;
			for (const sk of Object.values(save.skills)) skill += Math.max(0, (sk.level - 1) * 24);
			score += skill;
		}
		save.accountScore = (save.accountScore ?? 0) + score;
		save.deathBanked = true;
		this.say(`Account Score +${score}. It stays.`);
		return score;
	}
	fightTarget(): Mob | null {
		const save = this.save;
		if (!save) return null;
		const moves = this.arsenal(save).filter((m) => this.isOffense(m));
		if (!moves.length) return this.nearestMob(save.x, save.y, 52);
		return this.nearestInRange(moves);
	}
	inFight() {
		return !!this.fightTarget();
	}
	openSpot(x, y) {
		return nearestOpen(this.world, x, y);
	}
	playerSpeed() {
		const save = this.save;
		if (!save) return 8;
		return 10 + save.level + Math.floor(this.chan("swift") / 8) + Math.min(6, (save.skills.physical?.level ?? 1) / 8);
	}
	buildTurns() {
		const save = this.save;
		if (!save) return;
		// Foes no longer wait in this queue: they attack on their own cooldowns (tickMobAttack).
		// Ghosts no longer wait in this queue either: they cast on their own cooldowns (tickGhostCombat).
		this.turnQ = [{ side: "you", id: "you" }];
	}
	tickTurns(dt: number) {
		const save = this.save;
		if (!save || this.dead || this.role === "guest") return;
		if (!this.inFight()) {
			this.turnQ = [];
			this.fought = false;
			for (const s of save.spirits ?? []) if (s.hp < s.max) s.hp = Math.min(s.max, s.hp + 6 * dt);
			return;
		}
		if (!this.fought) {
			this.fought = true;
			this.buildTurns();
			this.fightGap = 0.12;
		}
		this.fightGap -= dt;
		if (this.fightGap > 0 || this.lunge || this.castLock > 0.15) return;
		if (this.turnQ.length === 0) this.buildTurns();
		const step = this.turnQ.shift();
		if (!step) return;
		if (step.side === "you") {
			const manual = !this.autoAttacks();
			if (!manual && (this.status.some((s) => s.id === "sleep") || !this.autoBattle())) {
				this.float(save.x, save.y - 44, "WAIT", "#c8c0b0");
				while (this.turnQ[0]?.side === "spirit") this.turnQ.shift();
			}
		} else if (step.side === "spirit") {
			const spirit = (save.spirits ?? []).find((s) => s.uid === step.id && s.hp > 0);
			if (spirit) this.spiritTurn(spirit);
		} else {
			const mob = this.mobs.find((m) => m.id === step.id && m.alive);
			if (mob) this.foeTurn(mob);
		}
		this.fightGap = step.side === "you" ? 0.3 : 0.2;
		if (!this.inFight()) {
			this.turnQ = [];
			this.fought = false;
		}
	}
	/** Kept for old turn steps; ghosts now act through tickGhostCombat. */
	spiritTurn(spirit: Spirit) {
		this.ghostAct(spirit, this.activeSpirits().indexOf(spirit), true);
	}
	/** Seconds before a ghost can use this verse again: your base cooldown, slowed for a ghost. */
	ghostCooldown(spirit, move) {
		const tactic = moveTactic(move);
		let cd = baseMoveCooldown(move) * GHOST_CD_MULT;
		if (tactic === "heal" || move.effect === "mend") cd = Math.max(cd, 6);
		if (tactic === "ward" || move.effect === "shell") cd = Math.max(cd, 8);
		if (move.effect === "cleanse") cd = Math.max(cd, 5);
		if (tactic === "surge") cd = Math.max(cd, 10);
		cd *= rateMult(this.skillN(masteryOf(move.type)) * 0.1);
		return Math.max(.6, cd * (spirit.shiny ? 0.9 : 1));
	}
	/**
	 * Ghosts fight on the same system you do: each readied verse has its own cooldown and range, a
	 * strike flies from the ghost and lands with the FX, and aid verses go on you. Their hits use the
	 * ghost's own level and rarity and a ghost's strength, not your verse ranks or class.
	 */
	tickGhostCombat(dt) {
		const save = this.save;
		if (!save || this.dead || this.role === "guest" || this.holdActive()) return;
		const list = this.activeSpirits();
		this.ghostCd = this.ghostCd ?? {};
		list.forEach((spirit, i) => {
			const cds = this.ghostCd[spirit.uid] = this.ghostCd[spirit.uid] ?? { gap: .4 };
			for (const k of Object.keys(cds)) cds[k] = Math.max(0, cds[k] - dt);
			if (spirit.hp <= 0 || cds.gap > 0) return;
			if (this.ghostAct(spirit, i, false)) cds.gap = .55 + Math.random() * .25;
			else cds.gap = .2;
		});
	}
	ghostAct(spirit, slot, forced) {
		const save = this.save;
		if (!save || this.holdActive()) return false;
		const cds = (this.ghostCd = this.ghostCd ?? {})[spirit.uid] = this.ghostCd[spirit.uid] ?? { gap: 0 };
		const ready = (spirit.slots ?? []).map((id) => MOVE_BY_ID[id]).filter((m) => m && (forced || (cds[m.id] ?? 0) <= 0));
		if (!ready.length) return false;
		const aid = ready.filter((m) => spiritAidsPlayer(m));
		let move = null;
		if (save.hp < this.maxHp() * 0.5) move = aid.find((m) => m.effect === "mend" || moveTactic(m) === "heal") ?? null;
		if (!move && this.status.some((st) => !GOOD_STATUS.has(st.id)) && Math.random() < 0.7) move = aid.find((m) => m.effect === "cleanse") ?? null;
		if (!move && this.wardT <= 0 && save.hp < this.maxHp() * 0.8 && this.inFight()) move = aid.find((m) => m.effect === "shell" || moveTactic(m) === "ward") ?? null;
		if (!move && this.inFight() && Math.random() < 0.18) move = aid.find((m) => moveTactic(m) === "surge") ?? null;
		if (move) {
			cds[move.id] = this.ghostCooldown(spirit, move);
			this.applySpiritAid(spirit, move);
			return true;
		}
		const foe = this.fightTarget() ?? this.nearestMob(save.x, save.y, 200);
		if (!foe || !foe.alive) return false;
		const at = this.mates[slot] ?? { x: save.x - 20, y: save.y, swing: 0 };
		const d = Math.hypot(foe.x - at.x, foe.y - at.y);
		const offs = ready.filter((m) => !spiritAidsPlayer(m) && m.power > 0);
		// Like you, a ghost only casts what reaches. Melee verses send it darting in.
		const reaches = offs.filter((m) => (attackForm(m) === "melee" ? MELEE_MAX_REACH : attackRange(m) + 16) >= d);
		if (!reaches.length) return false;
		const weights = reaches.map((m) => 1 + m.power / 50);
		let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
		move = reaches[reaches.length - 1];
		for (let k = 0; k < reaches.length; k++) { roll -= weights[k]; if (roll <= 0) { move = reaches[k]; break; } }
		cds[move.id] = this.ghostCooldown(spirit, move);
		at.swing = 1;
		if (attackForm(move) === "melee") { at.dashT = .38; at.dashX = foe.x - (foe.x > at.x ? 14 : -14); at.dashY = foe.y; }
		if (slot >= 0) this.mates[slot] = at;
		this.castImbue = ghostImbue({ type: spirit.type, rarity: spirit.rarity, seed: spirit.uid, shiny: spirit.shiny });
		try {
			this.strike(move, at.x, at.y - 12, foe, { fromPet: true, mult: (0.75 + spirit.rarity * 0.12) * (1 + bend(this.chan("spirit_bond") / 100, 0.5, 1)), pet: spirit });
		} finally {
			this.castImbue = null;
		}
		this.gainSkill("ghostkeeping", 1);
		if (Math.random() < .5) this.gainSkill(masteryOf(move.type), 1);
		return true;
	}
	/**
	 * How a ghost moves. Out of a fight every ghost has a will of its own: it picks a spot somewhere around
	 * you, floats there on its own momentum (a soft spring, so it overshoots and drifts), lingers, then
	 * picks another. When you walk off it lags behind and catches up. Normal ghosts drift lazily at a
	 * comfortable distance; shiny ghosts are little sparks — they pick new spots constantly, zip and loop,
	 * but never stray far from you. In a fight, normal ghosts circle the foe at their verses' reach.
	 */
	moveGhost(spirit, at, i, dt) {
		const save = this.save;
		const h = Math.min(Math.max(dt, 0), 0.05);
		at.t = (at.t ?? Math.random() * 10) + h;
		const far = Math.hypot(at.x - save.x, at.y - save.y);
		if (far > 1600) {
			at.x = save.x + (i % 2 === 0 ? -52 : 52);
			at.y = save.y + 12;
			at.vx = 0;
			at.vy = 0;
		} else if (far > 340) {
			const catchUp = Math.min(0.35, h * 2.4);
			at.x += (save.x - at.x) * catchUp;
			at.y += (save.y - at.y) * catchUp;
			at.vx = (at.vx ?? 0) * 0.5;
			at.vy = (at.vy ?? 0) * 0.5;
		}
		let foe = spirit.shiny ? null : this.fightTarget();
		if (foe) { at.fightT = 0.4; at.foeId = foe.id; }
		else if ((at.fightT ?? 0) > 0) {
			at.fightT -= h;
			const held = this.mobs.find((m) => m.id === at.foeId && m.alive);
			if (held && Math.hypot(held.x - save.x, held.y - save.y) < 260) foe = held;
			else at.fightT = 0;
		}
		if (foe || (at.dashT ?? 0) > 0) {
			at.ang = (at.ang ?? i * 2.05) + h * 0.55;
			const reaches = (spirit.slots ?? []).map((id) => MOVE_BY_ID[id]).filter((m) => m && !spiritAidsPlayer(m)).map((m) => (attackForm(m) === "melee" ? 52 : attackRange(m) * 0.55));
			const reach = Math.max(44, Math.min(140, reaches.length ? Math.min(...reaches) : 64));
			let tx = foe ? foe.x + Math.cos(at.ang) * reach : at.x;
			let ty = foe ? foe.y + Math.sin(at.ang) * reach * 0.42 : at.y;
			if ((at.dashT ?? 0) > 0) {
				at.dashT -= h;
				if (at.dashT > 0.12) { tx = at.dashX ?? tx; ty = at.dashY ?? ty; }
			}
			const k = 1 - Math.exp(-h * ((at.dashT ?? 0) > 0.12 ? 8 : 3.5));
			const px = at.x;
			const py = at.y;
			at.x += (tx - at.x) * k;
			at.y += (ty - at.y) * k;
			at.vx = (at.x - px) / Math.max(h, 1e-3);
			at.vy = (at.y - py) / Math.max(h, 1e-3);
			if (Math.abs(at.x - px) > 0.05) at.facing = at.x > px ? 1 : -1;
			at.spin = 0;
			return;
		}
		this.driftGhost(at, i, h, spirit.shiny ? GHOST_DRIFT.shiny : GHOST_DRIFT.normal, save.x, save.y);
		at.spin = 0;
	}
	/**
	 * Free-floating pet motion around (cx, cy): wander targets, spring + drag, a speed cap, a lag when the
	 * hunter walks, and a gentle bob. `d` tunes how lazy or wild it is (see GHOST_DRIFT).
	 */
	driftGhost(at, i, dt, d, cx, cy) {
		at.t = (at.t ?? Math.random() * 10) + dt;
		at.wt = (at.wt ?? 0) - dt;
		const dist = Math.hypot(at.x - cx, at.y - cy);
		const arrived = at.wx !== undefined && Math.hypot(cx + at.wx - at.x, cy + at.wy - at.y) < d.arrive;
		if (at.wt <= 0 || at.wx === undefined || (arrived && Math.random() < dt * d.restless)) {
			const a = Math.random() * Math.PI * 2;
			const r = d.near + Math.random() * (d.far - d.near);
			at.wx = Math.cos(a) * r;
			at.wy = Math.sin(a) * r * d.flat + d.lift;
			at.wt = d.hold[0] + Math.random() * (d.hold[1] - d.hold[0]);
		}
		// Walking drags the spot behind you, so pets trail and then catch up.
		const trail = this.moving ? -this.facing * d.trail : 0;
		const tx = cx + at.wx + trail;
		const ty = cy + at.wy + Math.sin(at.t * d.bobRate + i * 1.7) * d.bob;
		const pull = dist > d.far * 2.2 ? d.spring * 1.35 : d.spring;
		const gain = Math.min(0.28, pull * dt);
		at.vx = (at.vx ?? 0) * Math.exp(-dt * d.drag) + (tx - at.x) * gain;
		at.vy = (at.vy ?? 0) * Math.exp(-dt * d.drag) + (ty - at.y) * gain;
		if (d.jitter && Math.random() < dt * d.jitter) { const a = Math.random() * Math.PI * 2; at.vx += Math.cos(a) * d.kick; at.vy += Math.sin(a) * d.kick * .6; }
		const cap = d.max * (dist > d.far * 2 ? 1.35 : 1);
		const sp = Math.hypot(at.vx, at.vy);
		if (sp > cap) { at.vx *= cap / sp; at.vy *= cap / sp; }
		const maxStep = cap * dt;
		let dx = at.vx * dt;
		let dy = at.vy * dt;
		const step = Math.hypot(dx, dy);
		if (step > maxStep) { dx *= maxStep / step; dy *= maxStep / step; }
		const px = at.x;
		at.x += dx;
		at.y += dy;
		if (Math.abs(at.vx) > 4) at.facing = at.vx > 0 ? 1 : -1;
		else if (Math.abs(at.x - px) > .05) at.facing = at.x > px ? 1 : -1;
	}
	/** Nudge a follower off the hunter. A few pixels a frame, never a snap. */
	clearOfHunter(at, half) {
		const save = this.save;
		if (!save || !at) return;
		const needX = 30 + (half ?? 18) * 0.35;
		const dx = at.x - save.x;
		const dy = at.y - save.y;
		const nx = dx / needX;
		const ny = (dy + 34) / 56;
		const e = nx * nx + ny * ny;
		if (e >= 1 || e < 1e-4) return;
		const depth = 1 - Math.sqrt(e);
		const side = dx < -0.4 ? -1 : dx > 0.4 ? 1 : (at.facing || this.facing || 1);
		at.x += side * Math.min(4, depth * needX);
		at.y += (dy > -8 ? 1 : -1) * Math.min(2.5, depth * 8);
		if ((at.vx ?? 0) * side < 8) at.vx = side * 28;
	}
	/** Keeps ghosts from piling onto the same spot. A short nudge, not a teleport. */
	spreadGhosts(list, gap) {
		for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
			const p = list[a], q = list[b];
			if (!p || !q) continue;
			let dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
			if (d >= gap) continue;
			if (d < 0.5) { dx = a % 2 === 0 ? -1 : 1; dy = 0.2; d = Math.hypot(dx, dy); }
			const nx = dx / d, ny = dy / d;
			const push = Math.min(4, (gap - d) * 0.2);
			p.x -= nx * push; p.y -= ny * push;
			q.x += nx * push; q.y += ny * push;
			p.vx = (p.vx ?? 0) - nx * 16; p.vy = (p.vy ?? 0) - ny * 16;
			q.vx = (q.vx ?? 0) + nx * 16; q.vy = (q.vy ?? 0) + ny * 16;
		}
	}
	// ---------- Ghost abilities ----------
	/** Ghosts whose abilities work right now: out with you (and standing), plus tagged tiny followers. */
	abilityGhosts() {
		if (!this.save || this.lms) return [];
		const home = this.holdActive() && !this.holdHere();
		const out = home ? [] : this.activeSpirits().filter((s) => s.hp > 0 && !s.task);
		return [...out, ...this.taggedGhosts()];
	}
	/** Totals and shared timers. Timed abilities start on a full cooldown the moment they switch on. */
	tickGhostAbilities(dt) {
		const save = this.save;
		if (!save) return;
		this.ghostCdT = this.ghostCdT ?? {};
		this.ghostAggT = (this.ghostAggT ?? 0) - dt;
		if (this.ghostAggT <= 0 || !this.ghostAgg) {
			this.ghostAggT = 0.5;
			// Spirit Resonance (gear and perks) and Ghostkeeping make every ability a little stronger.
			const agg = aggregateGhostAbilities(this.abilityGhosts(), 1 + Math.max(0, this.chan("ghost_power")) / 100 + this.skillN("ghostkeeping") * 0.001);
			for (const [id, t] of Object.entries(agg.timed)) if (!this.ghostAgg?.timed?.[id]) this.ghostCdT[id] = t.cd;
			for (const id of Object.keys(this.ghostCdT)) if (!agg.timed[id]) delete this.ghostCdT[id];
			this.ghostAgg = agg;
		}
		for (const id of Object.keys(this.ghostCdT)) this.ghostCdT[id] = Math.max(0, this.ghostCdT[id] - dt);
		if (this.dead || this.role === "guest") return;
		const timed = this.ghostAgg.timed;
		const ready = (id) => !!timed[id] && (this.ghostCdT[id] ?? 0) <= 0;
		const spend = (id) => { this.ghostCdT[id] = timed[id]?.cd ?? 30; };
		if (ready("soul_mend") && save.hp < this.maxHp() * 0.98) {
			const n = Math.max(1, Math.floor(this.maxHp() * timed.soul_mend.value / 100));
			save.hp = Math.min(this.maxHp(), save.hp + n);
			this.float(save.x, save.y - 50, `+${n} SOUL MEND`, "#9ad8c8");
			this.cfx = this.cfx ?? new CombatFx();
			this.cfx.guard(save.x, save.y - 18, "water");
			spend("soul_mend");
		}
		if (ready("well_gift") && this.pools) {
			const pct = (timed.well_gift.value ?? 0) / 100;
			const p = this.pools;
			const mana = Math.max(1, Math.floor(p.maxMana * pct));
			const stam = Math.max(1, Math.floor(p.maxStam * pct));
			p.mana = Math.min(p.maxMana, p.mana + mana);
			p.stam = Math.min(p.maxStam, p.stam + stam);
			this.float(save.x, save.y - 58, `WELL +${mana}`, "#9ecbff");
			spend("well_gift");
		}
		const fighting = this.inFight();
		if (ready("soul_bomb") && fighting) {
			const foe = this.fightTarget();
			if (foe?.alive) {
				spend("soul_bomb");
				this.cfx = this.cfx ?? new CombatFx();
				const from = this.mates?.[0] ?? { x: save.x, y: save.y };
				const fx = foe.x, fy = foe.y;
				const delay = this.cfx.bomb(from.x, from.y - 20, fx, fy - 10, "spirit", 70);
				this.later(delay, () => {
					const dmg = Math.floor(timed.soul_bomb?.value ?? 0);
					const hit = this.foesNear(fx, fy, 70);
					for (const m of hit) this.applyMobDamage(m, dmg, false);
					if (hit.length) this.float(fx, fy - 54, "SOUL BOMB", "#c9a6e8");
					this.cue("boom", { rate: 1.3, vol: 0.3 }, [120, .08, "triangle"]);
				});
			}
		}
		if (ready("radiant_surge") && fighting) {
			spend("radiant_surge");
			this.cfx = this.cfx ?? new CombatFx();
			this.cfx.nova(save.x, save.y - 12, 120, "light");
			const dmg = Math.floor(timed.radiant_surge.value);
			for (const m of this.foesNear(save.x, save.y, 120)) this.applyMobDamage(m, dmg, false);
			const heal = Math.max(1, Math.floor(this.maxHp() * 0.06));
			save.hp = Math.min(this.maxHp(), save.hp + heal);
			this.float(save.x, save.y - 60, "RADIANT SURGE", "#fff1a8");
			this.cue("sparkle", { rate: 1.6, len: 0.8, vol: 0.3 }, [880, .12, "triangle"]);
		}
	}
	/** Live foes within r of (x, y). */
	foesNear(x, y, r) {
		const out = [];
		// Only this map's foes (bounties waiting on other maps sit in this.contract, not here).
		for (const m of this.mobs) if (m.alive && Math.hypot(m.x - x, m.y - y) <= r) out.push(m);
		return out;
	}
	/** Spirit Guard: swallows one whole hit when ready. */
	ghostGuard() {
		const t = this.ghostAgg?.timed?.spirit_guard;
		if (!t || (this.ghostCdT?.spirit_guard ?? 0) > 0 || !this.save) return false;
		this.ghostCdT.spirit_guard = t.cd;
		this.float(this.save.x, this.save.y - 40, "SPIRIT GUARD", "#c9a6e8");
		this.cfx = this.cfx ?? new CombatFx();
		this.cfx.guard(this.save.x, this.save.y - 18, "spirit");
		this.cue("click", { rate: 0.7 }, [300, .05, "triangle"]);
		return true;
	}
	/** Second Wind: a hit that leaves you under 25% health is answered with a heal. */
	ghostSecondWind() {
		const save = this.save;
		const t = this.ghostAgg?.timed?.second_wind;
		if (!save || !t || (this.ghostCdT?.second_wind ?? 0) > 0 || save.hp >= this.maxHp() * 0.25) return;
		this.ghostCdT.second_wind = t.cd;
		const n = Math.floor(this.maxHp() * t.value / 100);
		save.hp = Math.min(this.maxHp(), save.hp + n);
		this.float(save.x, save.y - 62, `SECOND WIND +${n}`, "#9ad8c8");
		this.cfx = this.cfx ?? new CombatFx();
		this.cfx.guard(save.x, save.y - 18, "air");
	}
	/** What your working ghosts add right now, for the Spirits window. */
	ghostBonusView() {
		const agg = this.ghostAgg ?? aggregateGhostAbilities(this.abilityGhosts());
		const chanName = { might: "Damage", ward: "Ward", swift_step: "Move speed", xp_boost: "XP", kyo_find: "Kyo", loot_find: "Loot luck", double_strike: "Double hit", crit_edge: "Crit chance", leech_edge: "Lifesteal", catch_boost: "Ghost lure", swift: "Cooldowns (Swift)", thorns: "Thorns", spirit_bond: "Ghost damage", ghost_burn: "Burn chance", shiny_luck: "Shiny odds" };
		const passive = Object.entries(agg.chan).map(([id, v]) => ({ id, label: chanName[id] ?? id, value: v }));
		const timed = Object.entries(agg.timed).map(([id, t]) => ({ id, label: GHOST_ABILITY_BY_ID[id]?.name ?? id, value: t.value, unit: GHOST_ABILITY_BY_ID[id]?.unit ?? "", cd: t.cd, left: Math.ceil(this.ghostCdT?.[id] ?? 0), n: t.n }));
		return { passive, timed, working: this.abilityGhosts().length };
	}
	// ---------- Tagged mini ghosts ----------
	/** Ghost Box ghosts tagged to follow you as tiny pets. They never fight, but their abilities work and they earn XP. */
	taggedGhosts() {
		const save = this.save;
		if (!save) return [];
		return (save.ghostStore ?? []).filter((s) => s.tagged).slice(0, TINY_MAX);
	}
	/** Tag or untag a Ghost Box ghost. At most TINY_MAX follow at once. */
	tagGhost(uid) {
		const save = this.save;
		if (!save) return;
		const g = (save.ghostStore ?? []).find((x) => x.uid === uid);
		if (!g) return;
		if (!g.tagged && this.taggedGhosts().length >= TINY_MAX) return this.say(`Only ${TINY_MAX} tiny ghosts can follow you at once. Untag one first.`);
		g.tagged = !g.tagged;
		this.ghostAggT = 0;
		const n = g.abilities?.length ?? 0;
		this.say(g.tagged ? `${g.shiny ? "✦ " : ""}${g.name} shrinks down and floats along with you.${n ? ` Its ${n === 1 ? "ability is" : `${n} abilities are`} active (timed ones start recharging now).` : ""}` : `${g.name} goes back to the Ghost Box. Its abilities switch off.`);
		this.persist();
		this.syncHud(true);
	}
	tickTinies(dt) {
		const save = this.save;
		if (!save) return;
		const h = Math.min(Math.max(dt, 0), 0.05);
		const list = this.taggedGhosts();
		this.tinyBy = this.tinyBy ?? {};
		const live = new Set();
		this.tinies = list.map((g, i) => {
			live.add(g.uid);
			let at = this.tinyBy[g.uid];
			if (!at || !Number.isFinite(at.x)) at = this.tinyBy[g.uid] = { x: save.x + (i % 2 === 0 ? -20 : 20), y: save.y - 36, vx: 0, vy: 0 };
			return at;
		});
		for (const id of Object.keys(this.tinyBy)) if (!live.has(id)) delete this.tinyBy[id];
		list.forEach((g, i) => {
			const at = this.tinies[i];
			const far = Math.hypot(at.x - save.x, at.y - save.y);
			if (far > 1200) { at.x = save.x; at.y = save.y - 36; at.vx = 0; at.vy = 0; }
			else if (far > 240) {
				at.x += (save.x - at.x) * Math.min(0.3, h * 2.5);
				at.y += (save.y - 36 - at.y) * Math.min(0.3, h * 2.5);
			}
			const perch = i < 2 && !g.shiny;
			if (perch) {
				const side = i === 0 ? -1 : 1;
				this.driftGhost(at, i, h, GHOST_DRIFT.perch, save.x + side * 48, save.y - 8);
			} else this.driftGhost(at, i, h, g.shiny ? GHOST_DRIFT.tinyShiny : GHOST_DRIFT.tiny, save.x + ((i % 2 === 0 ? -1 : 1) * 36), save.y - 108);
		});
		this.spreadGhosts(this.tinies, 8);
	}
	drawTinies(ctx) {
		const save = this.save;
		if (!save || !this.tinies?.length) return;
		const list = this.taggedGhosts();
		list.forEach((g, i) => {
			const at = this.tinies[i];
			if (!at) return;
			ctx.save();
			ctx.translate(at.x, at.y);
			ctx.scale(TINY_SCALE, TINY_SCALE);
			drawMonster(ctx, { x: 0, y: 0, template: g.template, type: g.type, facing: at.facing ?? 1, walk: this.walk + i, hurt: 0, boss: false, rarity: g.rarity, ghost: true, shiny: !!g.shiny, palette: g.palette, spin: 0, look: g.look, time: this.clock + i });
			ctx.restore();
			if (g.shiny && Math.floor(this.clock * 4 + i) % 3 === 0) {
				ctx.fillStyle = `hsl(${(this.clock * 160 + i * 40) % 360},95%,75%)`;
				ctx.fillRect(Math.round(at.x + Math.sin(this.clock * 7 + i) * 5), Math.round(at.y - 6 + Math.cos(this.clock * 6 + i) * 4), 1, 1);
			}
		});
	}
	applySpiritAid(spirit, move) {
		const save = this.save;
		if (!save) return;
		const slot = this.activeSpirits().indexOf(spirit);
		const at = this.mates[slot] ?? { x: save.x - 20, y: save.y, swing: 0 };
		at.swing = 1;
		if (slot >= 0) this.mates[slot] = at;
		this.playMoveFx(move, at.x, at.y - 12, save.x, save.y - 16);
		const tactic = moveTactic(move);
		if (move.effect === "cleanse") {
			this.status = cleanseStatuses(this.status, GOOD_STATUS);
			this.float(save.x, save.y - 48, "CLEAN", "#fff1a8");
		} else if (move.effect === "mend" || tactic === "heal") {
			const n = Math.max(6, Math.floor((move.power || 12) * 0.7 + spirit.level * 1.2));
			save.hp = Math.min(this.maxHp(), save.hp + n);
			this.float(save.x, save.y - 50, `+${n}`, "#9ad8c8");
		} else if (move.effect === "shell" || tactic === "ward") {
			this.wardT = Math.max(this.wardT, 3.2);
			this.float(save.x, save.y - 48, "WARD", "#fff1a8");
		} else if (move.id === "keenwhisper" || move.effect === "expose") {
			this.buff = { crit: Math.max(this.buff?.crit || 0, 18), ward: this.buff?.ward || 0, t: Math.max(this.buff?.t || 0, 8), type: this.buff?.type };
			this.float(save.x, save.y - 48, "KEEN", "#e6c15a");
		} else if (tactic === "surge") {
			this.addStatus("swift", 4);
			this.float(save.x, save.y - 48, "HASTE", "#9ad8c8");
		} else this.float(save.x, save.y - 48, move.name, TYPES[move.type].color);
	}
	foeTurn(m: Mob) {
		if (m.status.some((s) => s.id === "sleep")) return;
		this.mobAttack(m, this.pickFoeMove(m));
	}
	/**
	 * Real-time enemy attacks: every foe fights like a player, on its own cooldown, whenever
	 * you are in reach. Nothing waits for a turn queue.
	 */
	tickMobAttack(m, d, dt) {
		if (this.role === "guest" || this.dead || m.flee || (m.animal && m.species !== "wolf" && m.species !== "boar")) return;
		if (!this.wantsFight(m, d)) {
			// A short reaction delay when it first notices you, so a pack does not strike in one frame.
			m.atkCd = Math.max(m.atkCd ?? 0, 0.3 + Math.random() * 0.5);
			return;
		}
		this.combat = Math.max(this.combat ?? 0, 2);
		m.atkCd = (m.atkCd ?? 0.5) - dt;
		if (m.atkCd > 0) return;
		if (this.playerSafeCamp()) { m.atkCd = 0.6; return; }
		if (this.incoming?.some((h) => h.id === m.id)) return;
		if (m.bounty && this.tryDeathMark(m, d, dt)) return;
		const move = this.pickFoeMove(m);
		const reach = attackForm(move) === "melee" || m.animal ? 62 : Math.min(FOE_REACH_CAP, attackRange(move)) + 24;
		if (d > reach) { m.atkCd = 0.15; return; }
		// Do not attack through walls — require clear line of sight.
		const save = this.save;
		if (this.world && save && wallBetween(this.world, m.x, m.y, save.x, save.y)) { m.atkCd = 0.2; return; }
		this.mobAttack(m, move);
		m.atkCd = this.mobAttackGap(m, move);
	}
	/**
	 * Seconds between a foe's attacks: the move's own cooldown, the same base a hunter gets for
	 * that verse (before the hunter's personal haste and skill bonuses). Swift and rage speed it up.
	 */
	mobAttackGap(m, move) {
		let gap = baseMoveCooldown(move);
		if (m.enchants?.includes("swift")) gap *= 0.85;
		if (m.enraged) gap *= 0.85;
		if (m.enraged && (m.bounty || m.bountySpirit)) gap *= BOUNTY_ENRAGE.gap;
		return Math.max(0.28, gap * (0.95 + Math.random() * 0.1));
	}
	mobAttack(m, move) {
		const save = this.save!;
		m.kcd = m.kcd ?? {};
		m.kcd[move.id] = baseMoveCooldown(move);
		m.move = move.id;
		m.swing += 1;
		const spirits = this.holdActive() ? [] : this.activeSpirits().filter((s) => s.hp > 0);
		if (spirits.length && Math.random() < 0.28) {
			const spirit = spirits[Math.floor(Math.random() * spirits.length)]!;
			const slot = this.activeSpirits().indexOf(spirit);
			const at = this.mates[slot] ?? { x: save.x, y: save.y, swing: 0 };
			const spiritDelay = this.playMoveFx(move, m.x, m.y - 16, at.x, at.y - 10, { follow: () => [at.x, at.y - 10] });
			const dmg = Math.max(4, Math.floor(spirit.max * (m.frac ?? .05) * 1.25 * (m.stats?.dmg ?? 1) * (m.enraged ? 1.6 : 1) * (this.isNightNow() ? NIGHT.strength : 1)));
			this.later(spiritDelay, () => {
				if (this.holdActive() && safeZoneAt(this.save.survival.campfires, this.save.map, at.x, at.y)) { this.float(at.x, at.y - 28, "SAFE", "#9ad8c8"); return; }
				spirit.hp -= dmg;
				this.float(at.x, at.y - 28, `${dmg}`, "#c4473a");
				if (spirit.hp <= 0) {
					spirit.hp = 0;
					this.say(`${spirit.name} drops.`);
				}
			});
			return;
		}
		this.queueStrike(m, move);
	}
	/** A foe picks from its own kit: something ready that reaches you, its signature if nothing else. */
	pickFoeMove(m) {
		const save = this.save;
		const kit = (m.kit ?? []).map((id) => MOVE_BY_ID[id]).filter(Boolean);
		if (!kit.length) return MOVE_BY_ID[m.move] ?? MOVES[0];
		const d = save ? Math.hypot(save.x - m.x, save.y - m.y) : 0;
		// Silenced foes cannot cast: spells are off the table until it wears off.
		const silenced = hasStatus(m.status ?? [], "silence");
		const ready = kit.filter((mv) => (m.kcd?.[mv.id] ?? 0) <= 0 && !(silenced && attackForm(mv) === "spell"));
		const reach = ready.filter((mv) => (attackForm(mv) === "melee" || m.animal ? 62 : Math.min(FOE_REACH_CAP, attackRange(mv)) + 24) >= d);
		const pool = reach.length ? reach : ready.length ? ready : kit;
		// Strong moves are favoured but not certain.
		const weights = pool.map((mv) => 1 + mv.power / 40);
		let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
		for (let i = 0; i < pool.length; i++) {
			roll -= weights[i];
			if (roll <= 0) return pool[i];
		}
		return pool[pool.length - 1];
	}
	/**
	 * A bounty's Death Mark: every few seconds she marks the ground under you and swings a blow worth
	 * several normal hits. Move out of the ring, blink, roll, dash or ward in time, or it lands.
	 */
	tryDeathMark(m, d, dt) {
		m.markCd = (m.markCd ?? DEATH_MARK.every * 0.6) - Math.max(dt, 0.016);
		if (m.markCd > 0 || d > 280) return false;
		const save = this.save;
		if (this.world && wallBetween(this.world, m.x, m.y, save.x, save.y)) return false;
		m.markCd = m.enraged ? DEATH_MARK.everyEnraged : DEATH_MARK.every;
		const kit = (m.kit ?? []).map((id) => MOVE_BY_ID[id]).filter(Boolean);
		const move = [...kit].sort((a, b) => b.power - a.power)[0] ?? MOVE_BY_ID[m.move] ?? MOVES[0];
		const wind = m.enraged ? DEATH_MARK.windEnraged : DEATH_MARK.wind;
		this.incoming = this.incoming ?? [];
		this.incoming.push({ id: m.id, move: move.id, t: wind, t0: wind, ax: save.x, ay: save.y, form: "spell", heavy: true, mult: DEATH_MARK.mult });
		this.float(m.x, m.y - 50, "DEATH MARK", "#ff3a2a");
		this.float(save.x, save.y - 60, "MOVE!", "#ff6a4a");
		this.cue("boom", { rate: 0.68 }, [70, .3, "sawtooth"]);
		m.atkCd = Math.max(m.atkCd ?? 0, wind + 0.4);
		return true;
	}
	/** Red rings on the ground where a Death Mark will land. */
	drawTelegraphs(ctx) {
		for (const hit of this.incoming ?? []) {
			if (!hit.heavy) continue;
			const p = 1 - Math.max(0, hit.t) / (hit.t0 || 1);
			ctx.save();
			ctx.fillStyle = `rgba(255,40,30,${0.12 + p * 0.25})`;
			ctx.beginPath(); ctx.arc(hit.ax, hit.ay, DEATH_MARK.radius * p, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = `rgba(255,80,60,${0.6 + Math.sin(this.clock * 20) * 0.3})`;
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.beginPath(); ctx.arc(hit.ax, hit.ay, DEATH_MARK.radius, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		}
	}
	queueStrike(m, move) {
		const save = this.save;
		const form = attackForm(move);
		const wind = (form === "melee" ? .34 : form === "ranged" ? .42 : .55) * (m.boss ? .85 : 1) * (m.enchants?.includes("swift") ? .8 : 1) * (this.rules === "hardcore" ? Math.max(.7, 1 - (save.level ?? 1) * .006) : 1);
		this.incoming = this.incoming ?? [];
		this.incoming.push({ id: m.id, move: move.id, t: wind, ax: save.x, ay: save.y, form });
		this.float(m.x, m.y - 40, "!", "#ff6a4a");
	}
	tickIncoming(dt) {
		if (!this.incoming?.length) return;
		const save = this.save;
		const keep = [];
		for (const hit of this.incoming) {
			hit.t -= dt;
			if (hit.t > 0) { keep.push(hit); continue; }
			const m = this.mobs.find((x) => x.id === hit.id && x.alive);
			if (!m || this.dead) continue;
			const move = MOVE_BY_ID[hit.move] ?? MOVES[0];
			const melee = hit.form === "melee" || m.animal;
			const reach = melee ? 62 : Math.min(FOE_REACH_CAP, attackRange(move)) + 24;
			const firedOutOfReach = Math.hypot(save.x - m.x, save.y - m.y) > reach;
			// The shot flies to the spot it was aimed at. What happens to you is decided when it lands.
			const aimX = hit.form === "melee" ? save.x : hit.ax;
			const aimY = hit.form === "melee" ? save.y : hit.ay;
			const follow = hit.form === "melee" ? () => [save.x, save.y - 18] : undefined;
			const delay = this.playMoveFx(move, m.x, m.y - 16, aimX, aimY - 18, { follow, imbue: m.enemyGhost ? ghostImbue({ type: m.type, rarity: m.rarity, seed: m.id, shiny: m.shiny }) : null });
			this.later(delay, () => {
				if (this.dead) return;
				const dist = Math.hypot(save.x - m.x, save.y - m.y);
				const offSpot = hit.form !== "melee" && Math.hypot(save.x - aimX, save.y - aimY) > (hit.heavy ? DEATH_MARK.radius : 46);
				const tooFar = hit.heavy ? false : hit.form === "melee" ? dist > reach : firedOutOfReach;
				if (tooFar || offSpot) {
					this.float(save.x, save.y - 44, "DODGED", "#9ad8c8");
					this.cfx?.evade(save.x, save.y - 18);
					this.gainSkill("adventuring", 1);
					this.gainSkill("evasion", hit.heavy ? 12 : 3);
					return;
				}
				if (hit.heavy) { this.shake = Math.max(this.shake, 9); this.float(save.x, save.y - 52, "MARKED", "#ff3a2a"); }
				this.mobHitsPlayer(m, move, dist, hit.mult ?? 1);
			});
		}
		this.incoming = keep;
	}
	tickSpirits(dt: number) {
		const save = this.save;
		if (!save) return;
		const step = Math.min(Math.max(dt, 0), 0.05);
		const list = this.activeSpirits();
		this.mateBy = this.mateBy ?? {};
		const live = new Set();
		this.mates = list.map((spirit, i) => {
			live.add(spirit.uid);
			let at = this.mateBy[spirit.uid];
			if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) {
				const side = i % 2 === 0 ? -1 : 1;
				at = { x: save.x + side * (46 + i * 6), y: save.y + 8, swing: 0, vx: 0, vy: 0 };
				this.mateBy[spirit.uid] = at;
			}
			return at;
		});
		for (const id of Object.keys(this.mateBy)) if (!live.has(id)) delete this.mateBy[id];
		list.forEach((spirit, i) => {
			const at = this.mates[i]!;
			at.swing = Math.max(0, at.swing - step * 3);
			if (spirit.hp <= 0) {
				at.x += (save.x - this.facing * 28 - at.x) * Math.min(1, step * 2);
				at.y += (save.y + 16 - at.y) * Math.min(1, step * 2);
				at.vx = 0;
				at.vy = 0;
				return;
			}
			if (this.holdActive()) {
				const bed = this.bedSpot(i);
				at.x += (bed.x + Math.sin(this.clock * .6 + i) * 3 - at.x) * Math.min(1, step * 3);
				at.y += (bed.y - 6 + Math.cos(this.clock * .5 + i) * 2 - at.y) * Math.min(1, step * 3);
				return;
			}
			if (this.gim?.leading()) { this.gim.leadGhost(at, i, step); return; }
			this.moveGhost(spirit, at, i, step);
		});
		if (!this.fightTarget()) this.spreadGhosts(this.mates, 40);
		list.forEach((spirit, i) => { if (spirit.hp > 0) this.clearOfHunter(this.mates[i], ghostHalfWidth(spirit)); });
		this.tickTinies(step);
	}
	tickParty(dt) {
		const save = this.save;
		if (this.role === "guest") return;
		save.party = save.party ?? [];
		save.party.forEach((id, i) => {
			const npc = NPCS.find((n) => n.id === id);
			if (!npc) return;
			const key = `mate-${id}`;
			this.mateCd[key] = (this.mateCd[key] ?? 0) - dt;
			const hold = this.holdActive() ? this.bedSpot(this.activeSpirits().length + i) : null;
			const foe = hold ? null : this.nearestMob(save.x, save.y, 190);
			const px = this.mateCd[`${key}x`] ?? save.x;
			const py = this.mateCd[`${key}y`] ?? save.y;
			const dist = foe ? Math.hypot(foe.x - px, foe.y - py) : 999;
			const ang = this.clock * .9 + i * 2.1;
			const orbit = foe ? dist > 80 ? 70 : 48 : 56;
			const homeX = foe ? foe.x + Math.cos(ang) * (orbit + i * 10) : hold ? hold.x : save.x + Math.cos(ang) * 56;
			const homeY = foe ? foe.y + Math.sin(ang) * 22 : hold ? hold.y : save.y + 4;
			if (foe && dist > 90 && dist < 160 && (this.mateCd[`${key}blink`] ?? 0) <= 0) {
				const behind = foe.x >= save.x ? 1 : -1;
				this.mateCd[`${key}x`] = foe.x + behind * 26;
				this.mateCd[`${key}y`] = foe.y + 4;
				this.mateCd[`${key}blink`] = 4;
				this.float(foe.x, foe.y - 28, "BLINK", "#b4a6ff");
			} else {
				this.mateCd[`${key}x`] = px + (homeX - px) * Math.min(1, dt * 4);
				this.mateCd[`${key}y`] = py + (homeY - py) * Math.min(1, dt * 4);
			}
			this.mateDirections[id] = directionFromDelta(this.mateCd[`${key}x`] - px, this.mateCd[`${key}y`] - py, this.mateDirections[id]);
			this.mateCd[`${key}blink`] = Math.max(0, (this.mateCd[`${key}blink`] ?? 0) - dt);
			if (!foe || this.mateCd[key] > 0) return;
			const reach = dist > 70 ? 150 : 56;
			if (Math.hypot(foe.x - (this.mateCd[`${key}x`] ?? 0), foe.y - (this.mateCd[`${key}y`] ?? 0)) > reach) return;
			this.mateCd[key] = dist > 70 ? 1.35 : .9;
			const move = dist > 70 ? huntMove(npc.shrine ?? "normal") : MOVES.find((m) => m.type === (npc.shrine ?? "normal") && attackForm(m) === "melee") ?? huntMove(npc.shrine ?? "normal");
			const mateDmg = (dist > 70 ? 6 : 9) + save.level * 1.4;
			const mateDelay = this.playMoveFx(move, this.mateCd[`${key}x`] ?? save.x, (this.mateCd[`${key}y`] ?? save.y) - 20, foe.x, foe.y - 12, { follow: () => (foe.alive ? [foe.x, foe.y - 12] : null) });
			this.later(mateDelay, () => { if (foe.alive) this.damageMob(foe, mateDmg, false); });
		});
	}
	tickFx(dt) {
		for (const p of this.parts) {
			p.life -= dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += (p.kind === "rain" ? 40 : 0) * dt;
		}
		this.parts = this.parts.filter((p) => p.life > 0).slice(-240);
		this.cfx?.tick(dt);
		if (this.cfx?.kick) {
			this.shake = Math.max(this.shake, this.cfx.kick);
			this.cfx.kick = 0;
		}
		for (const f of this.floats) f.life -= dt;
		this.floats = this.floats.filter((f) => f.life > 0);
		this.shake = Math.max(0, this.shake - dt * 18);
		for (const id of Object.keys(this.nodeCd)) this.nodeCd[id] = Math.max(0, (this.nodeCd[id] ?? 0) - dt);
	}
	legacyMoveFx(move, x0, y0, x1, y1) {
		const color = TYPES[move.type].color;
		const n = 8 + Math.floor(move.power / 8) + (move.effect !== "none" ? 4 : 0) + move.priority;
		for (let i = 0; i < n; i++) {
			const kind = move.anim[i % move.anim.length] ?? "burst";
			const ang = i / n * Math.PI * 2 + move.priority;
			let x = x0;
			let y = y0;
			let vx = Math.cos(ang) * (40 + move.power);
			let vy = Math.sin(ang) * (40 + move.power);
			if (kind === "beam" || kind === "slash") {
				const t = i / n;
				x = x0 + (x1 - x0) * t;
				y = y0 + (y1 - y0) * t;
				vx = (x1 - x0) * 2;
				vy = (y1 - y0) * 2 + (kind === "slash" ? Math.sin(t * 8) * 80 : 0);
			} else if (kind === "rain") {
				x = x1 + (Math.random() - .5) * 40;
				y = y1 - 30 - Math.random() * 20;
				vx = 0;
				vy = 50 + move.power;
			} else if (kind === "orbit" || kind === "spiral") {
				vx = Math.cos(ang) * 70;
				vy = Math.sin(ang) * 70;
			} else if (kind === "shield") {
				x = x0 + Math.cos(ang) * 16;
				y = y0 + Math.sin(ang) * 16;
				vx = 0;
				vy = 0;
			}
			this.parts.push({
				x,
				y,
				vx,
				vy,
				life: .25 + move.priority * .05 + (move.effect === "sleep" ? .2 : 0),
				max: .45,
				color: effectTint(move.effect, color),
				size: kind === "burst" || move.power > 48 ? 4 : 2,
				kind
			});
		}
	}
	procSet(fx, variant = 0) {
		const save = this.save;
		this.say(`Set: ${fx.replace(/([a-z])([A-Z])/g, "$1 $2")}.`);
		this.shake = 8;
		this.cue("slam", { rate: 0.85 + (variant % 6) * 0.06 }, [150 + (variant % 6) * 22, .2, "square"]);
		// Each set bursts its own way: ring, spiral, star, fountain or double ring, in its own colour.
		const color = setAuraColor(fx, variant);
		const alt = fxColor(fx);
		const style = variant % 5;
		const n = 24 + (variant % 4) * 6;
		for (let i = 0; i < n; i++) {
			const u = i / n;
			let a = u * Math.PI * 2, sp = 120, vy0 = 0, life = .5, size = 4;
			if (style === 1) { a += u * Math.PI * 2; sp = 60 + u * 120; }
			else if (style === 2) { sp = i % 2 ? 160 : 70; size = i % 2 ? 3 : 5; }
			else if (style === 3) { a = -Math.PI / 2 + (u - .5) * 1.6; sp = 110 + (i % 5) * 18; vy0 = -40; life = .7; }
			else if (style === 4) { sp = i % 2 ? 140 : 80; life = i % 2 ? .45 : .6; }
			this.parts.push({
				x: save.x,
				y: save.y - 20,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp + vy0,
				life,
				max: life,
				color: i % 3 === 2 ? alt : color,
				size,
				kind: "burst"
			});
		}
		for (const m of this.mobs) {
			if (!m.alive) continue;
			if (Math.hypot(m.x - save.x, m.y - save.y) > 120) continue;
			const bonus = fx === "solarnova" || fx === "bloodmoon" ? 28 : 18;
			if (this.role !== "guest") this.applyMobDamage(m, bonus + save.level * 2, true);
			if (fx === "briarburst" || fx === "tidalsurge") this.applyMobStatus(m, fx === "tidalsurge" ? "soak" : "root", 2.5);
			if (fx === "whitestorm" || fx === "gravepulse") this.applyMobStatus(m, "sleep", 1.6);
			if (fx === "voidring" || fx === "stormcrown") this.applyMobStatus(m, "silence", 2);
		}
		if (this.rules !== "hardcore" && (fx === "lanternwake" || fx === "featherfall" || fx === "gravepulse")) save.hp = Math.min(this.maxHp(), save.hp + 20);
	}
	interact() {
		const save = this.save;
		if (!save || this.dead || !this.world) return;
		{
			const chest = this.nearestChest();
			const wild = this.nearestWild();
			const dc = chest ? Math.hypot(chest.x - save.x, chest.y - save.y) : Infinity;
			const dw = wild ? Math.hypot(wild.x - save.x, wild.y - save.y) : Infinity;
			// Pressing E again by both flips between them.
			if (wild && (dw <= dc || snap.panel === "chest") && snap.panel !== "wildghost") { this.openWild(wild.id); return; }
			if (chest) { this.openChest(chest.id); return; }
			if (wild) { this.openWild(wild.id); return; }
			if (this.rules === "hardcore" && this.bedNear()) { if (this.sleeping) this.wakeUp(); else this.goToSleep(); return; }
		}
		if (this.customFile && this.interactMapPlace()) return;
		if (save.map !== "world" && !save.map.startsWith("custom-")) {
			const ex = this.dungeonExitAt();
			if (Math.hypot(save.x - ex.x, save.y - ex.y) < 36) {
				const back = this.turbz ? "custom-turbz" : "world";
				this.travel(back, save.dungeons?.portals.find(p => p.id === save.map) ?? WORLD_RETURN[save.map] ?? hearthXY());
				return;
			}
		}
		if (save.map === "world" || save.map === "custom-turbz") {
			const portal = save.dungeons?.portals.find(p => !p.cleared && Math.hypot(p.x - save.x, p.y - save.y) <= 120);
			if (portal) { this.enterRift(portal.id); return; }
		}
		if (save.map === "world") for (const tavern of TAVERNS) {
			const x = tavern.boardTx * 32 + 16;
			const y = tavern.boardTy * 32 + 16;
			if (Math.hypot(save.x - x, save.y - y) < 48) {
				this.openBounty(tavern);
				return;
			}
		}
		let best = 999;
		let hit = null;
		for (const p of POIS) {
			if (save.map !== "world") break;
			const pos = poiPos(p);
			if (!pos) continue;
			const reach = p.kind === "dungeon" || p.kind === "shrine" ? 120 : 52;
			const d = Math.hypot(pos.x - save.x, pos.y - save.y);
			if (d <= reach && d < best) {
				best = d;
				hit = p;
			}
		}
		if (!hit) {
			const resource = this.nodeNear(null, 64);
			if (resource) { this.startNode(resource.id, resource.node); return; }
			if (nearestWaterTile(this.world, save.x, save.y, 80)) { this.startFishing(); return; }
			this.say("Nothing close.");
			return;
		}
		if (hit.kind === "npc") this.openTalk(hit.id);
		else if (hit.kind === "shrine") {
			const keeper = NPCS.find((n) => n.shrine === hit.type);
			if (keeper) this.openTalk(keeper.id);
			else this.say("The arena waits. Find whoever keeps the door.");
		} else if (hit.kind === "dungeon") this.travel(hit.id, dungeonExit());
		else if (hit.kind === "hearth") {
			if (this.rules !== "hardcore") save.hp = this.maxHp();
			this.secondUsed = false;
			this.status = [];
			this.say(this.rules === "hardcore" ? "The hearth offers shelter, not healing. Use healing spells, potions or meals." : "The hearth mends you. Skills stay either way.");
			this.gainSkill("adventuring", 4);
			this.persist();
		} else if (hit.kind === "node") this.startNode(hit.id, hit.node);
		else if (hit.kind === "boss") {
			const m = this.mobs.find((mm) => mm.bossId === hit.id);
			if (m) this.dest = {
				x: m.x,
				y: m.y,
				mob: m.id
			};
		}
	}
	startNode(id, node) {
		if (this.channel || this.dead || !this.save) return;
		if (node === "fish") return this.startFishing();
		if (!this.world.spawns.some((n) => n.id === id && n.kind === "node")) {
			this.say("Already gathered.");
			return;
		}
		const skill = node === "ore" ? "mining" : node === "tree" ? "woodcutting" : "shroom";
		const lv = this.save.skills[skill].level;
		const need = Math.max(.3, (1.15 - lv * .008) * (1 - bend(this.chan("quick_hands") / 100, 0.45, 0.6)));
		this.dest = null;
		if (this.autoplay) { this.path = []; this.pathI = 0; }
		this.channel = {
			kind: `${node}:${id}`, x: this.save.x, y: this.save.y, map: this.save.map,
			t: 0,
			need
		};
		this.say(node === "ore" ? "Mining..." : node === "tree" ? "Chopping..." : "Foraging...");
		this.channelSfx?.();
		this.channelSfx = this.cue("pulse", { len: need, rate: node === "ore" ? 0.85 : node === "tree" ? 1 : 1.2 });
	}
	finishChannel() {
		this.save;
		const ch = this.channel;
		this.channel = null;
		this.channelSfx?.();
		this.channelSfx = null;
		if (!ch) return;
		if (ch.kind === "water") {
			if (this.rules === "hardcore" && waterWithinReach(this.world, this.save.x, this.save.y)) { this.giveItem("raw_water", 1); this.gainSkill("survival", 3); this.say("Collected raw water. Purify it on a campfire."); this.persist(); }
			return;
		}
		if (ch.map && (ch.map !== this.save.map || Math.hypot(ch.x - this.save.x, ch.y - this.save.y) > 64)) { this.say(ch.kind === "fishing" ? "You reel the line in." : "Gathering stopped: too far away."); return; }
		if (ch.kind === "fishing") {
			if (!nearestWaterTile(this.world, this.save.x, this.save.y, 80)) return;
			const n = 1 + (this.chan("fish_luck") > 25 ? 1 : 0);
			this.giveItem("fish", n);
			this.gainSkill("fishing", 16);
			this.say(`A bite! Fish x${n}.`);
			this.mapQuestEvent({ t: "gather", node: "fish" });
			this.boardEvent("fish");
			this.persist();
			if (this.autoplay) this.autoPlan = 0;
			return;
		}
		const [node, id] = ch.kind.split(":");
		// The node may already be gone (auto-harvested, or taken by a stale channel).
		if (!this.world.spawns.some((n) => n.id === id && n.kind === "node")) return;
		this.depleteNode(id);
		const luck = 1 + this.chan("harvest") / 100;
		if (node === "ore") {
			const n = Math.max(1, Math.floor((1 + Math.random()) * luck * (1 + this.chan("prospector") / 100) * (1 + this.skillN("mining") * 0.003)));
			this.giveItem("ore", n);
			if (Math.random() < Math.min(0.95, 0.45 * (1 + this.chan("prospector") * 0.008))) this.giveItem("ironroot", 1);
			this.gainSkill("mining", 14);
			this.say(`Ore x${n}.`);
		} else if (node === "tree") {
			const n = Math.max(1, Math.floor((1 + Math.random()) * luck * (1 + this.skillN("woodcutting") * 0.003)));
			this.giveItem("timber", n);
			this.gainSkill("woodcutting", 14);
			this.say(`Timber x${n}.`);
		} else if (node === "shroom") {
			const bonus = this.chan("shroom_sense");
			const extra = procs(this.skillN("shroom") * 0.2);
			this.giveItem(Math.random() < .34 ? "dreamspore" : Math.random() < .5 ? "embercap" : "blue_lantern", 1 + (bonus > 20 ? 1 : 0) + extra);
			this.giveItem("mushroom", 1 + extra);
			this.gainSkill("shroom", 16);
			this.say("The patch gives.");
		}
		this.boardEvent(node as BoardKind);
		this.mapQuestEvent({ t: "gather", node });
		this.persist();
		if (this.autoplay) this.autoPlan = 0;
	}
	// ---- Designer maps: story, NPCs, quests and placed places --------------------------------
	mapId() { return this.customFile?.id ?? ""; }
	questCtx() {
		const npcs = this.mapNpcs;
		return {
			npcName: (id) => npcs.find((n) => n.id === id)?.name ?? "someone",
			itemName: (id) => ITEMS.find((i) => i.id === id)?.name ?? id,
			speciesName: (id) => MONSTER_BY_ID[id]?.name ?? ANIMAL_BY_ID[id]?.name ?? id,
			placeName: (tx, ty) => (this.customFile ? regionAt(this.customFile, tx, ty)?.name ?? null : null)
		};
	}
	openMapStory() {
		const file = this.customFile;
		const save = this.save;
		if (!file || !save || !file.intro || this.lms) return;
		save.mapSeen = save.mapSeen ?? [];
		if (save.mapSeen.includes(file.id)) return;
		save.mapSeen.push(file.id);
		this.storyPages = file.intro.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
		if (!this.storyPages.length) return;
		this.talkId = "cm:~story";
		this.talkI = 0;
		this.shop = null;
		publish({ panel: "talk" });
		this.syncHud(true);
	}
	talkLines(n) { return n.lines?.length ? n.lines : ["…"]; }
	openMapTalk(id) {
		const save = this.save;
		const n = this.mapNpcs.find((x) => x.id === id);
		const file = this.customFile;
		if (!n || !save || !file) return;
		save.mapQuests = save.mapQuests ?? {};
		this.talkId = `cm:${n.id}`;
		this.talkI = 0;
		this.talkOverride = null;
		this.shop = null;
		// Talking can finish "talk" and "bring" steps and hand in finished quests.
		this.mapQuestEvent({ t: "talk", npcId: n.id });
		let q;
		while ((q = turnInMapQuest(file, n.id, save.mapQuests))) {
			const r = q.reward ?? {};
			if (r.kyo) save.kyo += r.kyo;
			if (r.xp) this.gainXp(r.xp);
			for (const it of r.items ?? []) this.giveItem(it.itemId, it.count);
			const bits = [r.kyo ? `${r.kyo} kyo` : "", r.xp ? `${r.xp} xp` : "", ...(r.items ?? []).map((i) => `${i.count} ${this.questCtx().itemName(i.itemId)}`)].filter(Boolean);
			this.say(`Quest done: ${q.name}${bits.length ? ` (${bits.join(", ")})` : ""}.`);
			if (q.done) this.talkOverride = q.done;
			this.cue("burst", { rate: 1.25, len: 1.4 }, [660, .12, "square"]);
		}
		this.persist();
		publish({ panel: "talk" });
		this.syncHud(true);
	}
	acceptMapQuestById(qid) {
		const save = this.save;
		const file = this.customFile;
		const n = this.mapNpcs.find((x) => `cm:${x.id}` === this.talkId);
		if (!save || !file || !n) return;
		const q = offerableQuests(file, n.id, save.mapQuests).find((x) => x.id === qid);
		if (!q || !acceptMapQuest(file, q.id, save.mapQuests)) return;
		this.say(`Quest accepted: ${q.name}.`);
		this.talkOverride = null;
		// A step may already be satisfied (items in the bag).
		this.mapQuestEvent({ t: "talk", npcId: n.id });
		this.persist();
		this.syncHud(true);
	}
	mapTalkSnap() {
		if (!this.talkId?.startsWith("cm:")) return null;
		if (this.talkId === "cm:~story") {
			return { id: "story", name: this.customFile?.name ?? "Story", role: "The story so far", line: this.storyPages?.[this.talkI] ?? "", shop: null, shrine: null, quests: { offers: [], active: [] }, more: this.talkI < (this.storyPages?.length ?? 1) - 1 };
		}
		const n = this.mapNpcs.find((x) => `cm:${x.id}` === this.talkId);
		const file = this.customFile;
		const save = this.save;
		if (!n || !file || !save) return null;
		const c = this.questCtx();
		const states = save.mapQuests ?? {};
		const offers = offerableQuests(file, n.id, states).map((q) => ({
			id: q.id, name: q.name, about: q.offer || q.about, steps: q.steps.map((s) => stepText(s, q, c)),
			reward: [q.reward?.kyo ? `${q.reward.kyo} kyo` : "", q.reward?.xp ? `${this.questXp(q.reward.xp)} xp` : "", ...(q.reward?.items ?? []).map((i) => `${i.count} ${c.itemName(i.itemId)}`)].filter(Boolean).join(", ")
		}));
		const active = openQuests(file, states, n.id).map((q) => ({ id: q.id, name: q.name, lines: progressLines(q, states[qkey(file.id, q.id)], c), ready: states[qkey(file.id, q.id)].status === "ready", say: q.progress }));
		const lines = this.talkLines(n);
		let line = this.talkOverride ?? lines[this.talkI] ?? lines[0];
		if (!this.talkOverride && this.talkI === 0) {
			const first = active.find((a) => !a.ready && a.say);
			if (!offers.length && first) line = first.say;
		}
		return { id: n.id, name: n.name, role: n.role || "Villager", line, shop: null, shrine: null, quests: { offers, active }, more: !this.talkOverride && this.talkI < lines.length - 1 };
	}
	mapQuestLog() {
		const file = this.customFile;
		const save = this.save;
		if (!file || !save) return [];
		const c = this.questCtx();
		return openQuests(file, save.mapQuests ?? {}).map((q) => {
			const s = save.mapQuests[qkey(file.id, q.id)];
			return { id: q.id, name: q.name, lines: progressLines(q, s, c), ready: s.status === "ready", turnIn: c.npcName(turnInOf(q)) };
		});
	}
	mapQuestEvent(ev) {
		const save = this.save;
		const file = this.customFile;
		if (!save || !file || !file.quests?.length) return;
		save.mapQuests = save.mapQuests ?? {};
		let touched = false;
		for (const q of file.quests) {
			const s = save.mapQuests[qkey(file.id, q.id)];
			if (!s || s.status !== "active") continue;
			const a = advanceMapQuest(q, s, ev, save.bag);
			if (a.consumed) { save.bag[a.consumed.itemId] = Math.max(0, (save.bag[a.consumed.itemId] ?? 0) - a.consumed.count); }
			if (!a.changed) continue;
			touched = true;
			if (a.ready) this.say(`${q.name}: all done. Report to ${this.questCtx().npcName(turnInOf(q))}.`);
			else if (ev.t !== "kill" && ev.t !== "gather") this.say(`${q.name}: step done.`);
			else if (s.n === 0) this.say(`${q.name}: step done.`);
		}
		if (touched) { this.persist(); this.syncHud(true); }
	}
	tickMapQuests(dt) {
		const save = this.save;
		if (!save || !this.customFile) return;
		this.tickMapRegion(dt);
		if (!this.customFile?.quests?.length) return;
		this.questTick = (this.questTick ?? 0) - dt;
		if (this.questTick > 0) return;
		this.questTick = .4;
		this.mapQuestEvent({ t: "goto", tx: Math.floor(save.x / 32), ty: Math.floor(save.y / 32) });
	}
	/** Announces named regions (towns, continents, forests…) as you walk into them. First visits give Adventuring experience. */
	tickMapRegion(dt) {
		const file = this.customFile;
		const save = this.save;
		if (!file?.regions?.length || !save) return;
		this.regionTick = (this.regionTick ?? 0) - dt;
		if (this.regionTick > 0) return;
		this.regionTick = .5;
		this.noteTownsVisited(file, Math.floor(save.x / 32), Math.floor(save.y / 32));
		const r = regionAt(file, Math.floor(save.x / 32), Math.floor(save.y / 32));
		const key = r ? `${file.id}:${r.id}` : "";
		if (key === this.regionKey) return;
		this.regionKey = key;
		this.mapRegion = r ?? null;
		if (!r) { this.syncHud(true); return; }
		const levels = r.levelMin ? ` · foes ${r.levelMin}${r.levelMax && r.levelMax !== r.levelMin ? `–${r.levelMax}` : ""}` : "";
		this.say(`${r.name}${levels}${r.about ? ` · ${r.about}` : ""}`);
		save.mapRegionsSeen = save.mapRegionsSeen ?? [];
		if (!save.mapRegionsSeen.includes(key)) {
			save.mapRegionsSeen.push(key);
			if (save.mapRegionsSeen.length > 3000) save.mapRegionsSeen.splice(0, save.mapRegionsSeen.length - 3000);
			if (r.kind !== "landmark" || r.tw > 1) this.gainSkill("adventuring", r.kind === "region" ? 20 : 10);
			if (r.kind === "region" || r.kind === "city") this.gainSkill("wayfinding", r.kind === "region" ? 20 : 30);
		}
		this.syncHud(true);
	}
	/** Remembers every town the hunter stands in (the smallest-region rule above can hide a town behind a landmark inside it). */
	noteTownsVisited(file, tx, ty) {
		const save = this.save;
		if (!save) return;
		// When the town is the smallest area under you, tickMapRegion records it (and pays the first-visit XP).
		const top = regionAt(file, tx, ty);
		for (const r of file.regions ?? []) {
			if (r.kind !== "city" || top?.id === r.id || tx < r.tx || ty < r.ty || tx >= r.tx + r.tw || ty >= r.ty + r.th) continue;
			save.mapRegionsSeen = save.mapRegionsSeen ?? [];
			const key = `${file.id}:${r.id}`;
			if (!save.mapRegionsSeen.includes(key)) save.mapRegionsSeen.push(key);
		}
	}
	/**
	 * Hardcore fast travel: the towns this save has walked into, plus the capital you wake in.
	 * Only on the overworld, and only in Hardcore (TurboHunt wakes you at taverns instead).
	 */
	fastTravelTowns() {
		const save = this.save;
		const file = this.customFile;
		if (!save || !file || this.rules !== "hardcore" || save.map !== "world") return [];
		const seen = new Set(save.mapRegionsSeen ?? []);
		const start = file.spawn;
		return (file.regions ?? []).filter((r) => r.kind === "city" && (
			seen.has(`${file.id}:${r.id}`) ||
			(!!start && start.tx >= r.tx && start.ty >= r.ty && start.tx < r.tx + r.tw && start.ty < r.ty + r.th)
		));
	}
	/** The fast-travel town under a map position (tile coords), if any. Smallest town wins when they overlap. */
	fastTravelTownAt(tx, ty) {
		let best = null;
		for (const r of this.fastTravelTowns()) {
			if (tx < r.tx || ty < r.ty || tx >= r.tx + r.tw || ty >= r.ty + r.th) continue;
			if (!best || r.tw * r.th < best.tw * best.th) best = r;
		}
		return best;
	}
	/** Jump to a town you have already visited. Not while dead, in a fight, or in a duel. */
	fastTravelTo(regionId) {
		const save = this.save;
		if (!save || !this.world || this.dead) return false;
		const town = this.fastTravelTowns().find((r) => r.id === regionId);
		if (!town) return false;
		if (this.duel) { this.say("Finish the duel first."); return false; }
		if (this.combat > 0 || this.inFight()) { this.say("You cannot slip away with enemies on you."); return false; }
		const to = nearestOpen(this.world, (town.tx + town.tw / 2) * 32, (town.ty + town.th / 2) * 32);
		save.x = to.x;
		save.y = to.y;
		this.cam.x = save.x;
		this.cam.y = save.y;
		this.dest = null;
		this.path = [];
		this.incoming = [];
		this.sleeping = false;
		this.say(`You fast travel to ${town.name}.`);
		this.cue("swell", {}, [330, .2, "triangle"]);
		this.syncHud(true);
		this.persist();
		return true;
	}
	/** E near a designer-placed bounty board, arena, shrine, hearth, door or NPC. Returns true when handled. */
	interactMapPlace() {
		const save = this.save;
		const file = this.customFile;
		if (!save || !file) return false;
		let best = null;
		let bd = 1e9;
		for (const n of this.mapNpcs) {
			const d = Math.hypot(n.tx * 32 + 16 - save.x, n.ty * 32 + 20 - save.y);
			if (d <= 64 && d < bd) { bd = d; best = { npc: n }; }
		}
		for (const it of file.interactables ?? []) {
			if (it.kind === "node") continue;
			const d = Math.hypot(it.tx * 32 + 16 - save.x, it.ty * 32 + 16 - save.y);
			if (d <= 64 && d < bd) { bd = d; best = { it }; }
		}
		if (!best) return false;
		if (best.npc) { this.openTalk(`cm:${best.npc.id}`); return true; }
		const it = best.it;
		if (it.kind === "bounty") this.openBounty({ name: it.label || "Bounty Board" });
		else if (it.kind === "arena") this.startShrine(Object.keys(TYPES)[Math.floor(Math.random() * Object.keys(TYPES).length)]);
		else if (it.kind === "shrine") this.startShrine(TYPES[it.type] ? it.type : "light");
		else if (it.kind === "hearth") {
			if (this.rules !== "hardcore") save.hp = this.maxHp();
			this.status = [];
			this.say(this.rules === "hardcore" ? "The hearth offers shelter, not healing. Use healing spells, potions or meals." : "The hearth mends you.");
		} else if (it.kind === "dungeon") {
			if (it.mapId === "world") this.leaveCustom();
			else if (findMapFile(it.mapId) && !isBuiltinMap(it.mapId)) this.enterCustom(it.mapId);
			else this.say("This door leads nowhere yet. Save the target map in the Map Builder.");
		}
		return true;
	}
	drawMapPlaces(ctx) {
		const file = this.customFile;
		const save = this.save;
		if (!file || !save) return;
		const { w: vw, h: vh } = this.cssSize();
		const viewX = vw / this.zoom * .62 + 120, viewY = vh / this.zoom * .62 + 140;
		const offscreen = (x, y) => Math.abs(x - this.cam.x) > viewX || Math.abs(y - this.cam.y) > viewY;
		for (const it of file.interactables ?? []) {
			if (it.kind === "node") continue;
			const x = it.tx * 32 + 16, y = it.ty * 32 + 16;
			if (offscreen(x, y)) continue;
			const col = it.kind === "bounty" ? "#e8c46a" : it.kind === "arena" ? "#c4473a" : it.kind === "shrine" ? "#8fd0ff" : it.kind === "hearth" ? "#ff9a4a" : "#c9a6e8";
			const bob = Math.sin(this.clock * 2 + it.tx) * 2;
			ctx.save();
			ctx.fillStyle = "rgba(0,0,0,.35)";
			ctx.beginPath(); ctx.ellipse(x, y + 12, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = col;
			if (it.kind === "bounty") { ctx.fillRect(x - 10, y - 14, 20, 24); ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x - 7, y - 10, 14, 4); ctx.fillRect(x - 7, y - 3, 14, 4); }
			else if (it.kind === "hearth") { ctx.beginPath(); ctx.moveTo(x, y - 14 + bob); ctx.lineTo(x + 9, y + 8); ctx.lineTo(x - 9, y + 8); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#ffe08a"; ctx.fillRect(x - 3, y - 2, 6, 8); }
			else if (it.kind === "dungeon") { ctx.fillRect(x - 12, y - 18, 24, 28); ctx.fillStyle = "#140e0c"; ctx.fillRect(x - 7, y - 12, 14, 22); }
			else { ctx.beginPath(); ctx.moveTo(x, y - 18 + bob); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 10, y); ctx.closePath(); ctx.fill(); }
			ctx.restore();
			const label = it.kind === "dungeon" ? it.name || "Door" : it.kind === "shrine" ? it.name || "Shrine" : it.kind === "bounty" || it.kind === "arena" ? it.label || (it.kind === "bounty" ? "Bounty Board" : "Arena") : "Hearth";
			drawShadowName(ctx, label, x, y - 24, col);
		}
		const states = save.mapQuests ?? {};
		for (const n of this.mapNpcs) {
			const x = n.tx * 32 + 16, y = n.ty * 32 + 20;
			if (offscreen(x, y)) continue;
			const outfit = n.outfit ?? ((n.id.length * 7 + n.tx) % 8);
			drawActor(ctx, {
				x, y, race: "vesper", female: !!n.female, hair: n.hair ?? (n.tx + n.ty) % 6, skin: outfit % 5, facing: Math.sin(this.clock * .4 + n.tx) > 0 ? 1 : -1,
				walk: .2, attack: 0, hurt: 0, setFx: null, setOn: false, time: this.clock,
				pieces: ["chest", "legs", "feet"].map((slot, i) => ({ slot, style: outfit, type: "normal", fxSeed: i, quality: 0 }))
			});
			drawShadowName(ctx, n.name.split(" ").slice(-1)[0], x, y - 44, "#f0e2c8");
			const mk = questMarker(file, n, states);
			if (mk) drawShadowName(ctx, mk, x, y - 60 + Math.sin(this.clock * 4) * 2, mk === "!" ? "#ffe08a" : "#8fd06a");
		}
	}
	openTalk(id) {
		if (typeof id === "string" && id.startsWith("cm:")) return this.openMapTalk(id.slice(3));
		const npc = NPCS.find((n) => n.id === id);
		if (!npc) return;
		this.talkId = id;
		this.talkI = 0;
		this.shop = npc.shop ?? null;
		if (npc.shop === "armor" || npc.shop === "fence") {
			const rng = mulberry32(Date.now() / 1e3 | 0);
			this.shopStock = [
				0,
				1,
				2,
				3
			].map(() => rollGear(rng, {
				level: Math.max(1, this.save.level),
				raceBias: this.save.race,
				luck: 5
			}));
		}
		const save = this.save;
		if (!save.talked.includes(id)) {
			save.talked.push(id);
			this.gainSkill("social", 8);
		}
		publish({ panel: "talk" });
		this.syncHud(true);
	}
	nextLine() {
		if (this.talkId?.startsWith("cm:")) {
			const n = this.mapNpcs.find((x) => `cm:${x.id}` === this.talkId);
			if (n) this.talkI = Math.min(this.talkLines(n).length - 1, this.talkI + 1);
			this.syncHud(true);
			return;
		}
		const npc = NPCS.find((n) => n.id === this.talkId);
		if (!npc) return;
		this.talkI = Math.min(npc.lines.length - 1, this.talkI + 1);
		this.syncHud(true);
	}
	startShrine(type) {
		const save = this.save;
		const t = type ?? NPCS.find((n) => n.id === this.talkId)?.shrine ?? "light";
		this.shrine = {
			type: t,
			round: 1
		};
		if (this.rules !== "hardcore") save.hp = this.maxHp();
		this.spawnShrineFoe();
		publish({ panel: null });
		this.say(`${TYPES[t].name} shrine. Round 1.`);
		this.gainSkill("adventuring", 6);
	}
	spawnShrineFoe() {
		const save = this.save;
		if (!this.shrine) return;
		const list = MOVES.filter((m) => m.type === this.shrine.type);
		const species = Object.values(MONSTER_BY_ID).find((m) => m.type === this.shrine.type)?.id ?? "hikari";
		const def = MONSTER_BY_ID[species];
		const level = save.level + this.shrine.round * 2;
		const mob = this.makeMob({
			id: `shrine-${this.shrine.round}-${nextUid()}`,
			species,
			x: save.x + 48,
			y: save.y - 10,
			level,
			template: def.template,
			type: this.shrine.type,
			name: `${TYPES[this.shrine.type].name} Saint`
		});
		mob.name = `${TYPES[this.shrine.type].name} Saint ${this.shrine.round}`;
		mob.move = (list[this.shrine.round] ?? list[0] ?? MOVES[0]).id;
		mob.boss = this.shrine.round === 3;
		this.rekitMob(mob);
		this.mobs.push(mob);
		this.dest = {
			x: mob.x,
			y: mob.y,
			mob: mob.id
		};
	}
	shrineClear() {
		const save = this.save;
		if (!this.shrine) return;
		if (this.shrine.round >= 3) {
			const piece = rollGear(mulberry32(Math.random() * 1e9 | 0), {
				level: save.level,
				bonus: SOURCE_BONUS.shrine,
				floor: "rare",
				typeBias: this.shrine.type,
				raceBias: save.race,
				luck: 30
			});
			this.receiveGear(piece);
			save.bestShrine = Math.max(save.bestShrine, 3);
			save.kyo += 40 + save.bestShrine * 5;
			this.say(`Shrine clear. ${piece.name}.`);
			this.shrine = null;
			this.gainSkill("adventuring", 30);
			this.persist();
			return;
		}
		this.shrine.round += 1;
		if (this.rules !== "hardcore") save.hp = this.maxHp();
		this.say(`Round ${this.shrine.round}. The saint is louder.`);
		this.spawnShrineFoe();
	}
	travel(map, at) {
		this.save;
		this.stampDungeonDay(map);
		this.room?.send({
			t: "go",
			dungeons: this.save.dungeons,
			map,
			x: at.x,
			y: at.y
		});
		this.switchTo(map, at);
	}
	customMaps() {
		const mine = savedMaps().filter((m) => m.id !== MAIN_WORLD_ID).map((m) => ({ id: m.id, name: m.name, kind: m.kind ?? "world", builtin: false }));
		const worlds = playableWorlds().filter((w) => w.id !== MAIN_WORLD_ID && !mine.some((m) => m.id === w.id)).map((m) => ({ id: m.id, name: m.name, kind: "world", builtin: true }));
		return [...worlds, ...mine];
	}
	enterCustom(id) {
		const file = findMapFile(id);
		if (!file || !this.save || isBuiltinMap(id)) return;
		this.closePanel();
		this.returnTo = this.save.map === "world" ? { x: this.save.x, y: this.save.y } : hearthXY();
		if (this.mapKey(id) === "world") { if (this.save.map !== "world") this.switchTo("world", this.returnTo ?? hearthXY()); return; }
		this.switchTo(`custom-${id}`, { x: (file.spawn?.tx ?? 1) * 32 + 16, y: (file.spawn?.ty ?? 1) * 32 + 16 });
		this.say(`You step into ${file.name}.`);
	}
	/** The save-map key for a map file id: the main world is "world", others are "custom-<id>". */
	mapKey(id) {
		return id === MAIN_WORLD_ID && mainWorldFile() ? "world" : `custom-${id}`;
	}
	/** Hardcore, level 30+: eat a Green Mushroom and wake in a brand new Green Cave. */
	eatGreenMushroom() {
		const save = this.save;
		if (!save || this.dead || (save.bag.green_mushroom ?? 0) <= 0) return;
		if (this.rules !== "hardcore") return this.say("The Green Cave only opens in Hardcore.");
		if (save.level < GREEN_MUSHROOM_LEVEL) return this.say(`Too strong for you. Reach level ${GREEN_MUSHROOM_LEVEL} first.`);
		const file = findMapFile(GREEN_CAVE_ID);
		if (!file) return this.say("The mushroom tastes of nothing.");
		save.bag.green_mushroom -= 1;
		// A fresh instance: the map, its foes and nodes are rebuilt, and its quest starts over.
		const prefix = `${GREEN_CAVE_ID}:`;
		for (const key of Object.keys(save.mapQuests ?? {})) if (key.startsWith(prefix)) delete save.mapQuests[key];
		if (save.map === "world") this.returnTo = { x: save.x, y: save.y };
		else if (!save.map.startsWith("custom-")) this.returnTo = hearthXY();
		this.closePanel();
		this.dest = null;
		this.incoming = [];
		this.sleeping = false;
		this.switchTo(`custom-${GREEN_CAVE_ID}`, { x: (file.spawn?.tx ?? 1) * 32 + 16, y: (file.spawn?.ty ?? 1) * 32 + 16 });
		this.say(`You eat the Green Mushroom. The world melts into ${file.name}. Find the door marked "Wake up" to leave.`);
		this.cue("swell", { rate: 0.7, len: 3 }, [300, .3, "sine"]);
		this.syncHud(true);
	}
	leaveCustom() {
		if (!this.save?.map.startsWith("custom-")) return;
		this.closePanel();
		this.switchTo("world", this.returnTo ?? hearthXY());
	}
	tickPortal(dt) {
		const save = this.save;
		this.portalCd = Math.max(0, (this.portalCd ?? 0) - dt);
		if (!save || this.portalCd > 0 || !this.world) return;
		const tx = Math.floor(save.x / 32), ty = Math.floor(save.y / 32);
		const t = this.world.tiles[ty * this.world.w + tx];
		if (!t?.portal) return;
		this.portalCd = 1.5;
		const p = t.portal;
		if (p.map === "world") {
			const at = p.tx !== undefined ? (this.overworld ? nearestOpen(this.overworld, p.tx * 32 + 16, p.ty * 32 + 16) : { x: p.tx * 32 + 16, y: p.ty * 32 + 16 }) : this.returnTo ?? hearthXY();
			this.switchTo("world", at);
			return;
		}
		// A portal to another spot on the same map (ferries): move without reloading the map.
		if (this.mapKey(p.map) === save.map && p.tx !== undefined && this.world) {
			const to = nearestOpen(this.world, p.tx * 32 + 16, p.ty * 32 + 16);
			save.x = to.x;
			save.y = to.y;
			this.cam.x = save.x;
			this.cam.y = save.y;
			this.dest = null;
			this.path = [];
			this.incoming = [];
			this.portalCd = 2.5;
			const where = this.customFile ? regionAt(this.customFile, p.tx, p.ty) : null;
			this.say(where ? `You sail to ${where.name}.` : "The ferry carries you across.");
			this.cue("swell", {}, [330, .2, "triangle"]);
			this.persist();
			return;
		}
		const file = findMapFile(p.map);
		if (!file || isBuiltinMap(p.map)) { this.say("This portal leads nowhere yet. Save the target map in the Map Builder."); return; }
		if (save.map === "world") this.returnTo = { x: save.x, y: save.y + 40 };
		const ax = p.tx ?? file.spawn?.tx ?? 1, ay = p.ty ?? file.spawn?.ty ?? 1;
		this.switchTo(this.mapKey(file.id), { x: ax * 32 + 16, y: ay * 32 + 16 });
		this.say(`The portal carries you to ${file.name}.`);
	}
	switchTo(map, at) {
		const save = this.save;
		save.x = at.x;
		save.y = at.y;
		this.loadMap(map, true);
		this.cam.x = save.x;
		this.cam.y = save.y;
		if (map.startsWith("custom-")) { this.persist(); this.openMapStory(); return; }
		if (map === "world" && this.customFile && !(save.mapSeen ?? []).includes(this.customFile.id)) { this.persist(); this.openMapStory(); return; }
		this.say(map === "world" ? "Back under the sky." : map === "crypt" ? "The Tiny Crypt breathes." : map.startsWith("rift-") ? "A new dungeon. Its guardian waits in the final room." : "The Ash Kiln is awake.");
		if (map === "crypt") {
			if (!save.quests.bone_king.done && save.regions.includes("bone")) {}
		}
		this.persist();
	}
	visitRegion() {
		const save = this.save;
		if (!this.world || save.map !== "world") return;
		const b = biomeNameAt(this.world, save.x, save.y);
		if (!save.regions.includes(b)) {
			save.regions.push(b);
			this.say(BIOME_LABEL[b]);
			this.gainSkill("adventuring", 10);
			const q = save.quests.marsh_walk;
			if (b === "tide" && !q.done && q.n < 1) {
				q.n = 1;
				this.say("Tide land. Now catch a Water spirit.");
			}
			if (b === "bone") {
				const bk = save.quests.bone_king;
				if (!bk.done) bk.n = 1;
			}
		}
	}
	catchSpirit() {
		return this.useSpiritJar();
	}
	useSpiritJar() {
		const save = this.save;
		if (!save) return;
		if ((save.bag.ghost_jar ?? 0) <= 0) return this.say("Need a ghost jar.");
		save.bag.ghost_jar -= 1;
		save.jarLeft = 60;
		this.say("The jar hums. For one minute, fallen foes are much more likely to stay.");
		this.tone(600, .12, "triangle");
		this.persist();
		this.syncHud(true);
	}
	turnSalt() {
		const save = this.save;
		if ((save.bag.cleanse_salt ?? 0) < 2) return this.say("Need 2 cleanse salt.");
		save.bag.cleanse_salt -= 2;
		save.saltTurned += 2;
		if (!save.quests.salt_run.done) this.completeQuest("salt_run");
		this.persist();
	}
	itemProblem(def) {
		const save = this.save;
		return itemUseProblem(def, { hardcore: this.rules === "hardcore", hp: save.hp, maxHp: this.maxHp(), hunger: save.survival?.hunger, thirst: save.survival?.thirst, level: save.level });
	}
	eatFood() {
		if (!this.save || this.rules !== "hardcore" || this.dead) return;
		const id = bestFood(this.save.bag, this.save.survival.hunger);
		if (id) this.useBag(id);
	}
	useBag(id) {
		const save = this.save;
		const def = ITEM_BY_ID[id];
		if (!save || !def || this.dead || (save.bag[id] ?? 0) <= 0) return;
		const issue = this.itemProblem(def);
		if (issue) return this.say(issue);
		if (id === "ghost_jar") return this.catchSpirit();
		if (id === "green_mushroom") return this.eatGreenMushroom();
		if (id === "smoke_bomb") {
			save.bag[id] -= 1;
			this.dest = null;
			const retreat = this.facing * -8;
			for (let i = 0; i < 5; i++) this.tryMove(retreat, 0);
			this.say("Smoke."); this.persist(); this.syncHud(true);
			return;
		}
		if (id === "cleanse_salt") {
			save.bag[id] -= 1;
			this.status = cleanseStatuses(this.status, GOOD_STATUS);
			this.say("Cleansed. Sleep, roots and silence cannot take hold for a few seconds."); this.persist(); this.syncHud(true);
			return;
		}
		const hc = this.rules === "hardcore";
		const healing = healingOf(id, this.maxHp(), hc, this.chan("potion_sip"));
		if (healing?.potion && (this.healCd ?? 0) > 0) return this.say(`Potion cooldown · ${Math.ceil(this.healCd)}s.`);
		if (hc && (FOOD[id] || id === "drinking_water")) {
			save.bag[id]--;
			if (id === "drinking_water") save.survival.thirst = Math.min(100, save.survival.thirst + 50);
			else save.survival.hunger = Math.min(100, save.survival.hunger + FOOD[id]);
			this.gainSkill("survival", 3);
			if (healing) this.drinkHeal(def, healing);
			else this.say(`Used ${def.name}.`);
			this.afterItem(id);
			return;
		}
		if (healing || def.heal || def.buff) save.bag[id] -= 1;
		if (healing) this.drinkHeal(def, healing);
		if (def.buff) this.say(`${def.name} · 25 seconds.`);
		if (def.buff === "fire") this.buff = {
			type: "fire",
			crit: 0,
			ward: 0,
			t: 25
		};
		if (def.buff === "crit") this.buff = {
			crit: 20,
			ward: 0,
			t: 25
		};
		if (def.buff === "ward") this.buff = {
			crit: 0,
			ward: .2,
			t: 25
		};
		this.afterItem(id);
	}
	/** A healing item lands: instant health, a trickle after, mended ghosts, and the potion cooldown. */
	drinkHeal(def, h) {
		const save = this.save;
		const before = save.hp;
		save.hp = Math.min(this.maxHp(), save.hp + h.now);
		const got = Math.floor(save.hp - before);
		if (h.regen > 0 && h.sec > 0) this.potionRegen = { left: h.sec, perSec: h.regen / h.sec };
		if (h.ghost > 0) for (const sp of this.activeSpirits()) sp.hp = Math.min(sp.max, sp.hp + sp.max * h.ghost);
		if (h.potion) this.healCd = POTION_CD;
		this.float(save.x, save.y - 52, `+${got}${h.regen ? ` (+${h.regen})` : ""}`, "#9ad8c8");
		this.cfx = this.cfx ?? new CombatFx();
		this.cfx.guard(save.x, save.y - 18, "water");
		this.cue("sparkle", { rate: 1.5, len: 0.4, vol: 0.2 }, [640, .06, "triangle"]);
		this.say(`${def.name}: +${got} health${h.regen ? `, +${h.regen} over ${h.sec}s` : ""}${h.ghost ? ", your ghosts mend" : ""}.`);
	}
	/** Heal-over-time from potions and meals, and the potion cooldown. */
	tickPotions(dt) {
		this.healCd = Math.max(0, (this.healCd ?? 0) - dt);
		const r = this.potionRegen;
		if (!r || !this.save || this.dead) return;
		const step = Math.min(dt, r.left);
		r.left -= dt;
		this.save.hp = Math.min(this.maxHp(), this.save.hp + r.perSec * step);
		if (r.left <= 0) this.potionRegen = null;
	}
	/** After an item is used: save, and move the Space queue on if that item just ran out. */
	afterItem(id) {
		const save = this.save;
		const q = save.quick ?? [];
		if (q.includes(id) && (save.bag[id] ?? 0) <= 0) {
			save.quick = this.cleanQuickOf(save);
			const next = save.quick[0];
			this.say(next ? `Out of ${ITEM_BY_ID[id]?.name ?? id}. Space now uses ${ITEM_BY_ID[next]?.name ?? next} (×${save.bag[next]}).` : `Out of ${ITEM_BY_ID[id]?.name ?? id}. Nothing left on Space.`);
		}
		this.persist();
		this.syncHud(true);
	}
	cleanQuickOf(save) {
		return cleanQuick(save.quick, save.bag, (id) => !!ITEM_BY_ID[id] && isConsumable(ITEM_BY_ID[id]));
	}
	// ---------- Space bar items ----------
	/** Space: use the first item in the queue (skipping any you have run out of). */
	useQuick() {
		const save = this.save;
		if (!save || this.dead) return;
		save.quick = this.cleanQuickOf(save);
		const id = save.quick[0];
		if (!id) return this.say("Nothing on Space. In the Bag (B), pick an item and choose Set to Space.");
		this.useBag(id);
	}
	/**
	 * Manage the Space queue (QUICK_MAX items). "set": this item first; "queue": add it to the end;
	 * "remove": take it off; "up": move it one place earlier.
	 */
	setQuick(id, how = "set") {
		const save = this.save;
		const def = ITEM_BY_ID[id];
		if (!save || !def) return;
		if (how !== "remove" && !isConsumable(def)) return this.say(`${def.name} cannot go on Space.`);
		let q = (save.quick ?? []).filter((x) => x !== id);
		if (how === "set") q.unshift(id);
		else if (how === "queue") {
			if (q.length >= QUICK_MAX) return this.say(`Space holds ${QUICK_MAX} items. Remove one first.`);
			q.push(id);
		} else if (how === "up") {
			const i = (save.quick ?? []).indexOf(id);
			q = (save.quick ?? []).slice();
			if (i > 0) { q.splice(i, 1); q.splice(i - 1, 0, id); }
		}
		const dropped = q.length > QUICK_MAX ? q[QUICK_MAX] : null;
		save.quick = q.slice(0, QUICK_MAX);
		save.quick = this.cleanQuickOf(save);
		if (how === "set") this.say(`Space: ${def.name}${save.quick.length > 1 ? `, then ${save.quick.slice(1).map((x) => ITEM_BY_ID[x]?.name ?? x).join(", then ")}` : ""}.${dropped ? ` ${ITEM_BY_ID[dropped]?.name ?? dropped} came off the queue.` : ""}`);
		else if (how === "queue") this.say(`${def.name} queued on Space (${save.quick.indexOf(id) + 1} of ${QUICK_MAX}).`);
		else if (how === "remove") this.say(`${def.name} is off Space.`);
		this.persist();
		this.syncHud(true);
	}
	equip(uid) {
		const save = this.save;
		const g = save.gear.find((x) => x.uid === uid);
		if (!g) return;
		save.equipped[g.slot] = uid;
		this.say(`Equipped ${g.name}.`);
		this.selected = uid;
		this.persist();
		this.syncHud(true);
	}
	receiveGear(g) {
		const save = this.save;
		if (!save) return;
		save.gear.push(g);
		this.noteFound(g);
		// Hardcore never dresses you: pick what to wear in the Bag (double-click a piece).
		if (this.rules === "hardcore") return;
		const worn = this.piece(g.slot);
		if (!worn || gearScore(g) > gearScore(worn)) {
			save.equipped[g.slot] = g.uid;
			this.say(`Wore ${g.name}. Score ${gearScore(g)}.`);
		}
	}
	/** Task toggles for autoplay. Every mode can turn a job off. */
	setOrder(id) {
		this.ensureOrders();
		if (!this.orders || !(id in this.orders)) return;
		this.orders[id] = !this.orders[id];
		this.autoPlan = 0;
		const labels = { combat: "Fight", mining: "Mine ore", woodcutting: "Chop wood", fishing: "Fish", shroom: "Forage", crafting: "Craft", spirits: "Seek spirits", dungeon: "Dungeons" };
		this.say(`${labels[id] ?? id} ${this.orders[id] ? "on" : "off"} for autoplay.`);
		this.syncHud(true);
	}
	toggleAutoplay() {
		if (!this.save || this.dead) return;
		this.ensureOrders();
		this.autoplay = !this.autoplay;
		this.path = [];
		this.pathI = 0;
		this.autoPlan = 0;
		this.grind = this.autoplay ? "looking" : "";
		this.dest = null;
		this.say(this.autoplay
			? "Autoplay. She fights fair prey, gathers, crafts, catches spirits, eats and sleeps when she must, and takes a dungeon she can survive."
			: "Autoplay off.");
		this.syncHud(true);
	}
	toggleAutoCombat() {
		if (!this.save || this.dead) return;
		this.autoCombat = !this.autoCombat;
		this.say(this.autoCombat
			? "Auto combat on. She finishes the weak one, uses the element that lands, and will not swing at a hide she cannot touch."
			: "Auto combat off. She swings only when you press Attack.");
		this.syncHud(true);
	}
	sell(uid) {
		const save = this.save;
		const i = save.gear.findIndex((g) => g.uid === uid);
		if (i < 0) return;
		const g = save.gear[i];
		if (Object.values(save.equipped).includes(uid)) return this.say("Equip a replacement before selling worn gear.");
		if ((save.locked ?? []).includes(uid)) return this.say("That piece is locked. Unlock it to sell it.");
		const value = gearSellValue(gearPrice(g), this.sellMult());
		save.kyo += value;
		save.gear.splice(i, 1);
		if (this.selected === uid) this.selected = null;
		this.gainSkill("trading", 8);
		this.say(`Sold ${g.name} for ${value} kyo.`);
		this.persist();
		this.syncHud(true);
	}
	/** Trading skill and Merchant Tongue on every sale. */
	sellMult() {
		return (1 + this.skillN("trading") * 0.002) * (1 + this.chan("sell_boost") / 100);
	}
	/** Gear Sell All would take: not worn, not locked, optionally at or below a quality. */
	sellableGear(maxQuality: string | null = null) {
		const save = this.save;
		if (!save) return [];
		const worn = new Set(Object.values(save.equipped).filter(Boolean));
		const locked = new Set(save.locked ?? []);
		const order = ["worn", "common", "fine", "rare", "epic", "legendary"];
		const cap = maxQuality ? order.indexOf(maxQuality) : 99;
		return save.gear.filter((g) => !worn.has(g.uid) && !locked.has(g.uid) && order.indexOf(g.quality) <= cap);
	}
	/** Sells every unequipped, unlocked piece in one go. */
	sellAllUnequipped(maxQuality: string | null = null) {
		const save = this.save;
		if (!save) return;
		const list = this.sellableGear(maxQuality);
		if (!list.length) return this.say(maxQuality ? `No unlocked spare gear at ${maxQuality} or below.` : "No unequipped gear to sell. Locked pieces are kept.");
		const mult = this.sellMult();
		let kyo = 0;
		const gone = new Set(list.map((g) => g.uid));
		for (const g of list) kyo += gearSellValue(gearPrice(g), mult);
		save.gear = save.gear.filter((g) => !gone.has(g.uid));
		if (gone.has(this.selected)) this.selected = null;
		save.kyo += kyo;
		this.gainSkill("trading", Math.min(80, 6 + list.length * 3));
		this.say(`Sold ${list.length} piece${list.length === 1 ? "" : "s"} for ${kyo} kyo.`);
		this.cue("rattle", { rate: 1.2, len: 0.9 }, [620, .1, "triangle"]);
		this.persist();
		this.syncHud(true);
	}
	/** Locked gear is skipped by Sell All and cannot be sold until unlocked. */
	toggleLock(uid) {
		const save = this.save;
		if (!save || !save.gear.some((g) => g.uid === uid)) return;
		const set = new Set(save.locked ?? []);
		if (set.has(uid)) set.delete(uid);
		else set.add(uid);
		save.locked = [...set];
		this.persist();
		this.syncHud(true);
	}
	/** Sell bag items. n = Infinity sells the whole stack. */
	sellItem(id: string, n: number = 1) {
		const save = this.save;
		const def = ITEM_BY_ID[id];
		const have = save?.bag?.[id] ?? 0;
		if (!save || !def || have <= 0 || this.dead) return;
		const count = Math.max(1, Math.min(have, Number.isFinite(n) ? Math.floor(n) : have));
		const each = itemSellValue(def.price, this.sellMult());
		save.bag[id] = have - count;
		save.kyo += each * count;
		this.gainSkill("trading", Math.min(30, 2 + count));
		this.say(`Sold ${count} ${def.name} for ${each * count} kyo.`);
		this.persist();
		this.syncHud(true);
	}
	buyGear(uid) {
		const save = this.save;
		const g = this.shopStock.find((x) => x.uid === uid);
		if (!g) return;
		const price = this.price(g.price);
		if (save.kyo < price) return this.say("Need more Kyo.");
		save.kyo -= price;
		this.receiveGear(g);
		this.shopStock = this.shopStock.filter((x) => x.uid !== uid);
		this.gainSkill("trading", 8);
		this.say(`Bought ${g.name}.`);
		this.persist();
		this.syncHud(true);
	}
	buyItem(id) {
		const save = this.save;
		const def = ITEM_BY_ID[id];
		if (!def) return;
		const price = this.price(def.price);
		if (save.kyo < price) return this.say("Need more Kyo.");
		save.kyo -= price;
		this.giveItem(id, 1);
		this.gainSkill("trading", 4);
		this.persist();
		this.syncHud(true);
	}
	price(n) {
		const off = 1 - rateMult(this.skillN("trading") * 0.25);
		const charm = bend(Math.max(0, this.chan("shop_charm")) / 140, 0.75, 0.92);
		const mult = Math.max(0.05, (1 - off) * (1 - charm));
		return Math.max(1, Math.floor(n * mult));
	}
	brew(recipeId) {
		const save = this.save;
		if (!save) return;
		if (recipeId === "meal") {
			if ((save.bag.fish ?? 0) < 1) return this.say("Need a raw fish.");
			save.bag.fish -= 1;
			this.giveItem("fish_meal", 1);
			this.gainSkill("fishing", 18);
			this.say("Cooked a fish meal.");
			this.persist();
			this.syncHud(true);
			return;
		}
		const recipe = ALCHEMY_RECIPES.find((r) => r.id === recipeId);
		if (!recipe) return this.say("Unknown recipe.");
		for (const [id, n] of Object.entries(recipe.costs)) {
			if ((save.bag[id] ?? 0) < n) return this.say(`Need ${n} ${ITEM_BY_ID[id]?.name ?? id}.`);
		}
		for (const [id, n] of Object.entries(recipe.costs)) save.bag[id] -= n;
		this.giveItem(recipe.output, recipe.n);
		{
			const doses = procs(this.skillN("alchemy") * 0.125);
			if (doses) this.giveItem(recipe.output, recipe.n * doses);
		}
		this.gainSkill("alchemy", 18);
		this.say(`Brewed ${ITEM_BY_ID[recipe.output]?.name ?? recipe.name}.`);
		this.persist();
		this.syncHud(true);
	}
	teach() {
		this.toggle("moves");
		this.say("Spend character skill points to unlock or upgrade attacks and spells.");
	}
	/** Equip `moveId` (into slot `index`, or the next free one) or, with an empty id, unequip slot `index`. */
	setBar(index, moveId) {
		const save = this.save;
		if (!save) return;
		this.syncArsenal(save);
		const list = [...save.loadout];
		if (!moveId) {
			if (index >= 0 && index < list.length) list.splice(index, 1);
		} else {
			if (!save.abilityRanks?.[moveId] || list.includes(moveId)) return;
			if (list.length >= MAX_EQUIPPED) { this.say(`All ${MAX_EQUIPPED} verse slots are full. Unequip one first.`); return; }
			list.splice(Math.max(0, Math.min(list.length, index)), 0, moveId);
		}
		save.loadout = list;
		this.syncArsenal(save);
		this.persist();
		this.syncHud(true);
	}
	/** Move the verse in slot `from` to slot `to` (keys 1-9). If `to` holds a verse, the two swap. */
	moveBar(from, to) {
		const save = this.save;
		if (!save) return;
		this.syncArsenal(save);
		const list = [...save.loadout];
		if (from < 0 || from >= list.length || from === to) return;
		if (to >= list.length) {
			const [id] = list.splice(from, 1);
			list.push(id);
		} else {
			[list[from], list[to]] = [list[to], list[from]];
		}
		save.loadout = list;
		this.syncArsenal(save);
		this.persist();
		this.syncHud(true);
	}
	select(uid) {
		this.selected = uid;
		this.syncHud(true);
	}
	disenchant() {
		const save = this.save;
		const g = save.gear.find((x) => x.uid === this.selected);
		if (!g || g.enchants.length === 0) return;
		if (save.kyo < 80) return this.say("Disenchant costs 80 Kyo.");
		save.kyo -= 80;
		const e = g.enchants.pop();
		save.stash.push(e);
		this.say(`Stripped ${ENCHANT_BY_ID[e.id]?.name ?? e.id}.`);
		this.persist();
		this.syncHud(true);
	}
	applyStash(index) {
		const save = this.save;
		const g = save.gear.find((x) => x.uid === this.selected);
		const e = save.stash[index];
		if (!g || !e) return;
		if (g.enchants.length >= MAX_GEAR_ENCHANTS) return this.say("That piece already holds 20 enchantments.");
		const exist = g.enchants.find((x) => x.id === e.id);
		if (exist) exist.power = Math.min(ENCHANT_BY_ID[e.id]?.max ?? 99, exist.power + e.power);
		else g.enchants.push(e);
		save.stash.splice(index, 1);
		this.say("Enchant set.");
		this.persist();
		this.syncHud(true);
	}
	summonBox(index) {
		const save = this.save;
		const pet = save?.box?.[index];
		if (!save || !pet) return;
		const def = MONSTER_BY_ID[pet.species] ?? ANIMAL_BY_ID[pet.species];
		if (!def) return;
		const kit = rollSpiritKit(def.type, mulberry32((Date.now() ^ index) >>> 0 || 1), pet.move);
		const max = 30 + (pet.level || 1) * 8;
		const spirit = {
			uid: nextUid(), species: pet.species, name: def.name, type: def.type, template: def.template,
			level: pet.level || 1, rarity: pet.rarity || 0,
			look: pet.look || rollGhostLook(mulberry32(save.seed || 1), pet.rarity || 0, kit.slots[0] || "measured", "hunt"),
			move: kit.slots[0] || "measured", known: kit.known, slots: kit.slots, hp: max, max, speed: 8 + (pet.level || 1),
			active: false, shiny: !!pet.shiny
		};
		if (!this.adoptSpirit(spirit)) return;
		save.box.splice(index, 1);
		this.persist();
		this.syncHud(true);
	}
	setSpiritActive(uid, on) {
		const save = this.save;
		const spirit = save?.spirits?.find((s) => s.uid === uid);
		if (!save || !spirit) return;
		if (on) {
			const used = save.spirits.filter((s) => s.active && s.uid !== uid).length;
			if (used >= this.spiritCap()) return this.say(`Only ${this.spiritCap()} ghosts can be out at once. Call one back first.`);
			spirit.task = null;
			spirit.taskT = 0;
			spirit.active = true;
			this.say(`${spirit.name} follows.`);
		} else {
			spirit.active = false;
			this.say(`${spirit.name} waits in the party.`);
		}
		this.persist();
		this.syncHud(true);
	}
	// ---------- Ghost tasks (Hardcore) ----------
	taskOn() {
		return this.rules === "hardcore" && !this.lms;
	}
	/** Seconds between a working ghost's results: rarer ghosts are quicker, and water ghosts fish and earth ghosts chop faster. */
	ghostTaskEvery(spirit: Spirit, task: GhostTask) {
		let t = GHOST_TASK_BASE_SECONDS[task] - (spirit.rarity ?? 0) * 0.6;
		if ((task === "fish" && spirit.type === "water") || (task === "chop" && spirit.type === "earth")) t *= 0.75;
		if (spirit.shiny) t *= 0.9;
		return Math.max(4, t);
	}
	/** Sends a party ghost off to fish, chop or level, or calls it home (task = null). */
	setGhostTask(uid, task: GhostTask | null) {
		const save = this.save;
		const spirit = save?.spirits?.find((s) => s.uid === uid);
		if (!save || !spirit) return;
		if (!this.taskOn()) return this.say("Ghosts only take tasks in Hardcore.");
		if (!task) {
			if (!spirit.task) return;
			spirit.task = null;
			spirit.taskT = 0;
			this.say(`${spirit.name} comes home and waits in the party.`);
			this.persist();
			this.syncHud(true);
			return;
		}
		if (!GHOST_TASK_IDS.includes(task)) return;
		if (task === "level" && spirit.level >= this.ghostLevelCap()) return this.say(`${spirit.name} is Lv ${spirit.level}, ${GHOST_LEVEL_LEAD} past you. Level up first and it can train.`);
		spirit.task = task;
		spirit.active = false;
		spirit.taskT = this.ghostTaskEvery(spirit, task);
		this.say(task === "fish" ? `${spirit.name} goes fishing. Fish land in your bag.` : task === "chop" ? `${spirit.name} goes chopping. Timber lands in your bag.` : `${spirit.name} heads out alone after foes. It earns ${GHOST_LEVEL_XP_MULT}x XP.`);
		this.persist();
		this.syncHud(true);
	}
	tickGhostTasks(dt) {
		const save = this.save;
		if (!save || this.dead || this.role === "guest" || !this.taskOn()) return;
		for (const sp of save.spirits ?? []) {
			if (!sp.task) continue;
			sp.taskT = (sp.taskT ?? 0) - dt;
			if (sp.taskT > 0) continue;
			sp.taskT = this.ghostTaskEvery(sp, sp.task);
			this.ghostTaskResult(sp);
		}
	}
	ghostTaskResult(sp: Spirit) {
		const save = this.save;
		const lucky = Math.random() < 0.12 + (sp.rarity ?? 0) * 0.06;
		if (sp.task === "fish" || sp.task === "chop") {
			const n = 1 + (lucky ? 1 : 0) + (sp.level >= 30 ? 1 : 0);
			const id = sp.task === "fish" ? "fish" : "timber";
			this.giveItem(id, n);
			this.float(save.x, save.y - 62, `+${n} ${ITEM_BY_ID[id]?.name ?? id} · ${sp.name}`, sp.task === "fish" ? "#7ec8ea" : "#8fd06a");
			this.gainSkill("ghostkeeping", 1);
			return;
		}
		if (sp.task === "level") this.ghostHunt(sp);
	}
	/** One lone hunt: the ghost meets a foe near its own level, usually wins, and earns double XP. It never fights for you. */
	ghostHunt(sp: Spirit) {
		const save = this.save;
		if (sp.level >= this.ghostLevelCap()) {
			sp.task = null;
			sp.taskT = 0;
			this.say(`${sp.name} is ${GHOST_LEVEL_LEAD} levels past you (Lv ${sp.level}) and comes home.`);
			this.persist();
			this.syncHud(true);
			return;
		}
		const foeLevel = Math.max(1, sp.level + Math.floor(Math.random() * 4) - 1);
		const win = Math.min(0.95, 0.62 + (sp.rarity ?? 0) * 0.06 + (sp.shiny ? 0.06 : 0) + (foeLevel <= sp.level ? 0.08 : 0));
		if (Math.random() > win) {
			sp.taskT = (sp.taskT ?? 0) + 15;
			this.float(save.x, save.y - 62, `${sp.name} limps back from a hunt`, "#c98a8a");
			return;
		}
		const gain = Math.floor((8 + foeLevel * 3) * GHOST_LEVEL_XP_MULT);
		this.float(save.x, save.y - 62, `+${gain} XP · ${sp.name}`, "#c9a6e8");
		const ups = this.giveGhostXp(sp, gain, true);
		if (!ups) return;
		if (sp.level >= this.ghostLevelCap()) {
			sp.task = null;
			sp.taskT = 0;
			this.say(`${sp.name} is ${GHOST_LEVEL_LEAD} levels past you and comes home.`);
		}
		this.persist();
		this.syncHud(true);
	}
	/** Ghosts can grow up to GHOST_LEVEL_LEAD levels past you, so they always have room to gain. */
	ghostLevelCap() {
		return Math.max(1, (this.save?.level ?? 1) + GHOST_LEVEL_LEAD);
	}
	/** Adds XP to one ghost and levels it up (health grows with each level). Returns the levels gained. */
	giveGhostXp(sp: Spirit, amount, loud = true) {
		if (!sp || !(amount > 0)) return 0;
		const cap = this.ghostLevelCap();
		if (sp.level >= cap) { sp.xp = 0; return 0; }
		// Ghost Mentor (gear and perks) and Ghostkeeping speed every ghost's growth.
		amount *= (1 + Math.max(0, this.chan("ghost_xp")) / 100) * (1 + this.skillN("ghostkeeping") * 0.005);
		sp.xp = Math.max(0, Math.floor(sp.xp ?? 0)) + Math.max(1, Math.floor(amount));
		let ups = 0;
		while (sp.level < cap && ups < 25 && sp.xp >= ghostXpNeed(sp.level)) {
			sp.xp -= ghostXpNeed(sp.level);
			sp.max = Math.ceil(sp.max * (sp.level + 1) / sp.level);
			sp.level += 1;
			ups += 1;
		}
		if (sp.level >= cap) sp.xp = 0;
		if (!ups) return 0;
		sp.hp = sp.max;
		if (loud) {
			this.say(`${sp.name} grew to Lv ${sp.level}.`);
			this.cue("sparkle", { rate: 1.3, len: 0.7, vol: 0.28 }, [660, .1, "triangle"]);
			const slot = this.activeSpirits().indexOf(sp);
			const at = slot >= 0 ? this.mates?.[slot] : null;
			if (at && this.save) this.float(at.x, at.y - 52, `LV ${sp.level}!`, "#c9a6e8");
		}
		this.ghostAggT = 0;
		return ups;
	}
	/** A kill teaches every ghost out with you (and, a little less, every tagged tiny follower). */
	feedGhostXp(base) {
		const save = this.save;
		if (!save || !(base > 0)) return;
		const out = this.activeSpirits().filter((s) => s.hp > 0 && !s.task);
		let grew = 0;
		for (const sp of out) grew += this.giveGhostXp(sp, base * GHOST_KILL_XP_OUT, true);
		const tiny = this.taggedGhosts();
		const names = [];
		for (const sp of tiny) if (this.giveGhostXp(sp, base * GHOST_KILL_XP_TAGGED, false)) names.push(`${sp.name} Lv ${sp.level}`);
		if (names.length) this.say(`Tiny follower${names.length > 1 ? "s" : ""} grew: ${names.slice(0, 4).join(", ")}${names.length > 4 ? ` +${names.length - 4} more` : ""}.`);
		if (grew || names.length) this.syncHud(true);
	}
	dismissSpirit(uid) {
		const save = this.save;
		if (!save?.spirits) return;
		const spirit = save.spirits.find((s) => s.uid === uid);
		if (!spirit) return;
		save.spirits = save.spirits.filter((s) => s.uid !== uid);
		this.say(`${spirit.name} is dismissed.`);
		this.persist();
		this.syncHud(true);
	}
	toggleSpiritMove(uid, moveId) {
		const save = this.save;
		const spirit = save?.spirits?.find((s) => s.uid === uid);
		if (!spirit || !spirit.known?.includes(moveId)) return;
		const slots = spirit.slots ?? [];
		if (slots.includes(moveId)) {
			if (slots.length <= 1) return this.say("A spirit needs at least one move readied.");
			spirit.slots = slots.filter((id) => id !== moveId);
		} else {
			if (slots.length >= 3) return this.say("Only 3 moves can be readied. Unslot one first.");
			spirit.slots = [...slots, moveId];
		}
		spirit.move = spirit.slots[0] ?? spirit.move;
		this.persist();
		this.syncHud(true);
	}
	// ---------- Bounties: a board of marks, each one stronger than the last ----------
	ensureHunt() {
		const save = this.save;
		if (!save) return null;
		const h = save.hunt ?? (save.hunt = { tier: 0, kills: 0, board: [], stars: 0, wanted: 0, waveIn: 0, squads: 0 });
		h.board = (Array.isArray(h.board) ? h.board : []).filter((p) => p && typeof p.id === "string" && CLASS_BY_ID[p.classId]);
		while (h.board.length < BOUNTY_BOARD_SIZE) h.board.push(this.makePosting(this.nextPostingTier()));
		return h;
	}
	nextPostingTier() {
		const h = this.save?.hunt;
		const top = Math.max(h?.tier ?? 0, ...(h?.board ?? []).map((p) => p.tier));
		return top + 1;
	}
	makePosting(tier) {
		const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)] ?? CLASSES[0];
		return {
			id: `post-${nextUid()}`,
			classId: cls.id,
			name: WITCH_NAMES[Math.floor(Math.random() * WITCH_NAMES.length)] ?? "Harrow Nia",
			female: classGendered(cls.id) ? Math.random() < .5 : true,
			tier,
			levelBonus: 3 + tier,
		};
	}
	/** Every live bounty mark, wherever it is. */
	liveBounties() {
		const seen = new Set();
		const out = [];
		for (const m of [...(this.contract ?? []), ...this.mobs]) {
			if (!m.bounty || !m.alive || seen.has(m.id)) continue;
			seen.add(m.id);
			out.push(m);
		}
		return out;
	}
	/** Takes a posting off the board (the first free one when no id is given). */
	takeBounty(postingId: string | null = null) {
		const save = this.save;
		if (!save || !this.world) return this.say("The board is blank out here.");
		const h = this.ensureHunt();
		const live = this.liveBounties();
		const busy = new Set(live.map((m) => m.postingId));
		const posting = postingId ? h.board.find((p) => p.id === postingId) : h.board.find((p) => !busy.has(p.id));
		if (!posting) return this.say("Every posting is already being hunted.");
		if (busy.has(posting.id)) return this.say(`You already hunt ${posting.name}.`);
		const tier = posting.tier;
		const cls = CLASS_BY_ID[posting.classId] ?? CLASSES[0];
		const raceId = CLASS_RACE[cls.id] ?? "vesper";
		const level = Math.max(1, save.level + posting.levelBonus);
		const spot = this.bountySpot();
		const rng = mulberry32(((Date.now() ^ (Math.random() * 1e9)) >>> 0) || 7);
		// A full kit at your level, pushed up by the bounty tier. You pick one piece when they fall.
		const gear = (["weapon", "head", "chest", "legs", "feet", "relic"] as Slot[]).map((slot) => rollGear(rng, {
			level: save.level,
			slot,
			bonus: SOURCE_BONUS.bounty(tier),
			luck: 30 + tier * 3,
			raceBias: raceId,
			floor: bountyQuality(tier, rng()),
			typeBias: cls.type,
		}));
		const offensive = cls.starterMoves.map((id) => MOVE_BY_ID[id]).filter((m) => m && !["heal", "ward", "roll", "dash", "surge"].includes(moveTactic(m)) && m.effect !== "mend" && m.effect !== "shell");
		const spell = [...offensive].sort((a, b) => b.power - a.power)[0] ?? huntMove(cls.type);
		const mob = this.makeMob({
			id: `bounty-${nextUid()}`,
			species: "muma",
			x: spot.x,
			y: spot.y,
			level,
			fixedLevel: true,
			template: 20,
			type: cls.type,
			name: posting.name
		});
		mob.bounty = true;
		mob.witch = true;
		mob.tier = tier;
		mob.postingId = posting.id;
		mob.classId = cls.id;
		mob.female = posting.female;
		mob.race = raceId;
		mob.map = save.map;
		mob.name = posting.name;
		mob.move = spell.id;
		mob.enraged = false;
		mob.rarity = 3;
		mob.lootGear = gear;
		mob.lootBag = bountyInventory(rng, tier, this.rules === "hardcore");
		mob.lootKyo = bountyKyo(save.level, tier);
		mob.huntIn = BOUNTY_HUNT_SECONDS;
		mob.seen = false;
		mob.aggro = false;
		mob.homeX = spot.x;
		mob.homeY = spot.y;
		this.rekitMob(mob, { tier });
		const spirits = this.spawnBountySpirits(mob, level, tier);
		this.mobs.push(mob, ...spirits);
		this.contract = [...(this.contract ?? []).filter((m) => m.alive), mob, ...spirits];
		publish({ panel: null });
		const tiles = Math.max(1, Math.round(Math.hypot(spot.x - save.x, spot.y - save.y) / 32));
		this.say(`Bounty tier ${tier}: ${posting.name} the ${cls.name}, level ${mob.level}. ${spirits.length} spirits. ${tiles} tiles ${this.compass(spot.x - save.x, spot.y - save.y)}. Five minutes.`);
		this.cue("boom", { rate: 1.3, vol: 0.3, len: 1 }, [180, .14, "triangle"]);
		this.persist();
		this.syncHud(true);
	}
	/** A bounty falls: kyo and their whole bag are yours, then the world stops while you pick one piece of gear. */
	claimBounty(mob) {
		const save = this.save;
		const h = this.ensureHunt();
		const tier = mob.tier ?? 1;
		h.tier = Math.max(h.tier, tier);
		h.kills += 1;
		const i = h.board.findIndex((p) => p.id === mob.postingId);
		const fresh = this.makePosting(this.nextPostingTier());
		if (i >= 0) h.board[i] = fresh;
		else if (h.board.length < BOUNTY_BOARD_SIZE) h.board.push(fresh);
		save.kyo += mob.lootKyo ?? 0;
		const items = [];
		for (const [id, n] of Object.entries(mob.lootBag ?? {})) if (n > 0) {
			this.lootItem(mob, id, n);
			items.push({ id, count: n });
		}
		this.gainSkill("hunting", 24 + tier * 2);
		this.gainSkill("bountyhunting", 60 + tier * 6);
		this.gainAccount(40 + mob.level * 4);
		const gear = (mob.lootGear ?? []).map((g) => ({ ...g, uid: nextUid() }));
		if (this.chestsOn()) {
			// Hardcore: no pause and no pick-one window. Her whole kit and bag drop in a chest where she fell.
			for (const g of gear) this.lootGear(mob, g);
			this.say(`${mob.name} falls. ${mob.lootKyo} kyo is yours; her bag and all ${gear.length} pieces of her kit wait in a chest where she fell (5 minutes). A tier ${fresh.tier} mark is posted.`);
			this.cue("fanfare", {}, [660, .2, "triangle"]);
			if (h.kills === 1) this.say("You have a name now. From here on, any kill can earn a Bounty Star. Ten stars and they put a price on you.");
			this.persist();
			this.syncHud(true);
			return;
		}
		this.say(`${mob.name} falls. ${mob.lootKyo} kyo and ${items.length} kinds of supplies are yours. Choose one piece of their gear. A tier ${fresh.tier} mark is posted.`);
		this.cue("fanfare", {}, [660, .2, "triangle"]);
		if (h.kills === 1) this.say("You have a name now. From here on, any kill can earn a Bounty Star. Ten stars and they put a price on you.");
		if (gear.length) {
			save.pendingLoot = { title: `${mob.name} · tier ${tier} bounty`, kyo: mob.lootKyo ?? 0, items, gear, tier };
			this.openLoot();
		}
		this.persist();
		this.syncHud(true);
	}
	openLoot() {
		const save = this.save;
		if (!save?.pendingLoot?.gear?.length) return;
		this.resetInput();
		this.incoming = [];
		publish({ panel: "loot" });
		this.syncHud(true);
	}
	/** Pick one piece from a fallen bounty. The rest stays with the body. */
	pickLoot(index) {
		const save = this.save;
		const loot = save?.pendingLoot;
		const piece = loot?.gear?.[index];
		if (!piece) return;
		save.pendingLoot = null;
		this.receiveGear({ ...piece, uid: nextUid() });
		this.say(`Took ${piece.name} (Lv ${piece.level}).`);
		publish({ panel: null });
		this.persist();
		this.syncHud(true);
	}
	/** Each kill after your first bounty may earn a star. Ten put a bounty on you. */
	rollBountyStar(mob) {
		const save = this.save;
		const h = save?.hunt;
		if (!h || h.kills < 1 || mob.id?.startsWith?.("shrine")) return;
		if (Math.random() >= bountyStarChance(this.enemyKind(mob), mob.rarity ?? 0, this.rules === "hardcore")) return;
		h.stars += 1;
		this.float(save.x, save.y - 60, "★ BOUNTY STAR", "#ffd166");
		if (h.stars < BOUNTY_STARS_NEEDED) {
			this.say(`Bounty Star ${h.stars}/${BOUNTY_STARS_NEEDED}.`);
			return;
		}
		h.stars = 0;
		h.wanted += 1;
		h.waveIn = 6;
		this.say(`WANTED. There is a price on your head (level ${h.wanted}). Hunters are coming, five at a time, stronger than you. Clear your name at a bounty board.`);
		this.cue("boom", { rate: 0.6 }, [80, .35, "sawtooth"]);
	}
	liveHunters() {
		const seen = new Set();
		const out = [];
		for (const m of [...(this.contract ?? []), ...this.mobs]) {
			if (!m.hunter || !m.alive || seen.has(m.id)) continue;
			seen.add(m.id);
			out.push(m);
		}
		return out;
	}
	tickWanted(dt) {
		const save = this.save;
		const h = save?.hunt;
		if (!h || h.wanted <= 0 || this.dead || this.role === "guest" || this.shrine) return;
		if (this.liveHunters().length) return;
		h.waveIn = (h.waveIn ?? 0) - dt;
		if (h.waveIn > 0) return;
		h.waveIn = this.rules === "hardcore" ? HUNTER_WAVE_GAP.hardcore : HUNTER_WAVE_GAP.standard;
		this.spawnHunterSquad();
	}
	/** Five hunters, each a playable class in a full kit, sent after a wanted witch. */
	spawnHunterSquad() {
		const save = this.save;
		const h = save?.hunt;
		if (!save || !h || !this.world) return;
		const ang0 = Math.random() * Math.PI * 2;
		const dist = 9 * 32;
		const anchor = nearestOpen(this.world, save.x + Math.cos(ang0) * dist, save.y + Math.sin(ang0) * dist);
		const squad = [];
		for (let i = 0; i < HUNTER_SQUAD; i++) {
			const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)] ?? CLASSES[0];
			const raceId = CLASS_RACE[cls.id] ?? "vesper";
			const at = nearestOpen(this.world, anchor.x + ((i % 3) - 1) * 30, anchor.y + (Math.floor(i / 3) - .5) * 28);
			const rng = mulberry32(((Date.now() ^ (Math.random() * 1e9)) >>> 0) || 11);
			const offensive = cls.starterMoves.map((id) => MOVE_BY_ID[id]).filter((m) => m && this.isOffense(m));
			const spell = [...offensive].sort((a, b) => b.power - a.power)[0] ?? huntMove(cls.type);
			const mob = this.makeMob({ id: `hunter-${nextUid()}`, species: "muma", x: at.x, y: at.y, level: save.level + 3, fixedLevel: true, template: 20, type: cls.type, name: WITCH_NAMES[Math.floor(Math.random() * WITCH_NAMES.length)] ?? "Hunter" });
			mob.hunter = true;
			mob.witch = true;
			mob.wanted = h.wanted;
			mob.classId = cls.id;
			mob.female = classGendered(cls.id) ? Math.random() < .5 : true;
			mob.race = raceId;
			mob.map = save.map;
			mob.move = spell.id;
			mob.rarity = 2;
			mob.huntIn = 0;
			mob.seen = true;
			mob.aggro = true;
			mob.ghost = false;
			mob.lootGear = (["weapon", "chest", "head"] as Slot[]).map((slot) => rollGear(rng, { level: save.level, slot, bonus: SOURCE_BONUS.hunter(h.wanted), luck: 20, raceBias: raceId, typeBias: cls.type }));
			mob.lootBag = { potion: 1 + Math.floor(Math.random() * 2), cleanse_salt: Math.random() < .5 ? 1 : 0 };
			mob.lootKyo = Math.floor(20 + save.level * 6 * (1 + h.wanted * .2));
			mob.levelJitter = Math.floor(Math.random() * 3);
			this.rekitMob(mob, { wanted: h.wanted });
			squad.push(mob);
		}
		this.mobs.push(...squad);
		this.contract = [...(this.contract ?? []).filter((m) => m.alive), ...squad];
		h.squads = (h.squads ?? 0) + 1;
		this.say(`A hunter squad has found you. Five of them, ${this.compass(anchor.x - save.x, anchor.y - save.y)}.`);
		this.cue("boom", { rate: 0.68 }, [70, .3, "sawtooth"]);
		this.syncHud(true);
	}
	hunterDown(mob) {
		const save = this.save;
		save.kyo += mob.lootKyo ?? 0;
		for (const [id, n] of Object.entries(mob.lootBag ?? {})) if (n > 0) this.lootItem(mob, id, n);
		let note = "";
		if (Math.random() < .35 && mob.lootGear?.length) {
			const g = mob.lootGear[Math.floor(Math.random() * mob.lootGear.length)];
			this.lootGear(mob, { ...g, uid: nextUid() });
			note = this.chestsOn() ? ` They dropped a chest with ${g.name}.` : ` They dropped ${g.name}.`;
		}
		this.gainSkill("hunting", 14);
		this.gainSkill("bountyhunting", 15);
		this.gainAccount(20 + mob.level * 2);
		this.contract = (this.contract ?? []).filter((m) => m.alive);
		const left = this.liveHunters().length;
		const gap = this.rules === "hardcore" ? HUNTER_WAVE_GAP.hardcore : HUNTER_WAVE_GAP.standard;
		this.say(left ? `Hunter down. ${left} left.${note}` : `The squad is down.${note} More will come in about ${gap} seconds unless you clear your name.`);
		this.persist();
	}
	/** Pay the board to take the price off your head. */
	clearName() {
		const save = this.save;
		const h = save?.hunt;
		if (!save || !h || h.wanted <= 0) return this.say("Nobody is hunting you.");
		const cost = clearNameCost(save.level, h.wanted);
		if (save.kyo < cost) return this.say(`Clearing your name costs ${cost} kyo.`);
		save.kyo -= cost;
		h.wanted = 0;
		h.stars = 0;
		h.waveIn = 0;
		for (const m of this.liveHunters()) {
			m.alive = false;
			m.hp = 0;
		}
		this.contract = (this.contract ?? []).filter((m) => m.alive);
		this.mobs = this.mobs.filter((m) => !m.hunter);
		this.say(`Paid ${cost} kyo. Your name is clean and the hunters stand down.`);
		this.persist();
		this.syncHud(true);
	}
	liveBounty() {
		return this.liveBounties()[0] ?? null;
	}
	stashContract() {
		const live = this.mobs.filter((m) => (m.bounty || m.bountySpirit || m.hunter) && m.alive);
		if (!this.contract) this.contract = [];
		for (const m of live) {
			const i = this.contract.findIndex((c) => c.id === m.id);
			if (i >= 0) this.contract[i] = m;
			else this.contract.push(m);
		}
		this.contract = this.contract.filter((m) => m.alive);
	}
	restoreContract(map) {
		this.mobs = this.mobs.filter((m) => !m.bounty && !m.bountySpirit && !m.hunter);
		for (const m of this.contract ?? []) if (m.alive && m.map === map) this.mobs.push(m);
	}
	tickContract(dt) {
		if (this.turbz) return;
		if (!this.save) return;
		for (const lead of this.liveBounties()) {
			if (!lead.enraged && lead.huntIn > 0) {
				lead.huntIn -= dt;
				if (lead.huntIn <= 0) {
					lead.huntIn = 0;
					this.enrageBounty(lead);
				}
			} else if (lead.enraged && lead.map !== this.save.map) this.bringBounty(lead);
		}
		// Hunters follow you through doors and rifts after a short delay.
		const away = this.liveHunters().filter((m) => m.map !== this.save.map);
		if (away.length) {
			this.hunterFollow = (this.hunterFollow ?? 4) - dt;
			if (this.hunterFollow <= 0) {
				this.hunterFollow = 4;
				this.bringHunters(away);
			}
		}
	}
	bringHunters(list) {
		const save = this.save;
		if (!save || !this.world) return;
		const ang = Math.random() * Math.PI * 2;
		const at = nearestOpen(this.world, save.x + Math.cos(ang) * 8 * 32, save.y + Math.sin(ang) * 8 * 32);
		list.forEach((m, i) => {
			const p = nearestOpen(this.world, at.x + ((i % 3) - 1) * 28, at.y + Math.floor(i / 3) * 26);
			m.x = m.homeX = p.x;
			m.y = m.homeY = p.y;
			m.map = save.map;
			m.aggro = true;
			m.seen = true;
		});
		this.restoreContract(save.map);
		this.say("The hunters followed you.");
	}
	enrageBounty(lead) {
		const bump = (m) => {
			if (!m || m.enraged) return;
			m.enraged = true;
			m.seen = true;
			m.aggro = true;
			m.huntIn = 0;
		};
		bump(lead);
		for (const s of this.contract ?? []) if (s.bountySpirit && s.master === lead.id && s.alive) bump(s);
		this.say(`${lead.name} is done waiting. Enraged: far tougher, faster and deadlier, and her Death Marks come quicker. She is hunting you.`);
		this.cue("boom", { rate: 0.85 }, [90, .22, "sawtooth"]);
		if (this.save && lead.map !== this.save.map) this.bringBounty(lead);
		else this.syncHud(true);
	}
	bringBounty(lead) {
		const save = this.save;
		if (!save || !this.world || !lead?.alive) return;
		const ang = Math.random() * Math.PI * 2;
		const dist = (10 + Math.random() * 6) * 32;
		const spot = nearestOpen(this.world, save.x + Math.cos(ang) * dist, save.y + Math.sin(ang) * dist);
		lead.x = spot.x;
		lead.y = spot.y;
		lead.homeX = spot.x;
		lead.homeY = spot.y;
		lead.map = save.map;
		lead.seen = true;
		lead.aggro = true;
		const spirits = (this.contract ?? []).filter((s) => s.bountySpirit && s.master === lead.id && s.alive);
		spirits.forEach((s, i) => {
			const at = nearestOpen(this.world, spot.x + (i - 1) * 28, spot.y + 22);
			s.x = at.x;
			s.y = at.y;
			s.homeX = at.x;
			s.homeY = at.y;
			s.map = save.map;
			s.aggro = true;
		});
		this.restoreContract(save.map);
		this.say(`${lead.name} steps out of the dark to hunt you.`);
		this.syncHud(true);
	}
	bountySpot() {
		const world = this.world;
		const save = this.save;
		const reach = reachableFrom(world, save.x, save.y);
		const min = world.w < 48 ? 6 : 18;
		const max = world.w < 48 ? 22 : 80;
		let fallback = null;
		for (let i = 0; i < 500; i++) {
			const tx = 3 + Math.floor(Math.random() * (world.w - 6));
			const ty = 3 + Math.floor(Math.random() * (world.h - 6));
			if (!reach[ty * world.w + tx]) continue;
			const x = tx * 32 + 16;
			const y = ty * 32 + 16;
			if (blocked(world, x, y)) continue;
			const tiles = Math.hypot(x - save.x, y - save.y) / 32;
			if (tiles < min) continue;
			if (tiles <= max) return { x, y };
			if (!fallback || tiles < fallback.d) fallback = { x, y, d: tiles };
		}
		if (fallback) return { x: fallback.x, y: fallback.y };
		for (let r = min; r < Math.max(world.w, world.h); r++) {
			for (let k = 0; k < 16; k++) {
				const ang = (k / 16) * Math.PI * 2;
				const tx = Math.floor((save.x + Math.cos(ang) * r * 32) / 32);
				const ty = Math.floor((save.y + Math.sin(ang) * r * 32) / 32);
				if (tx < 2 || ty < 2 || tx >= world.w - 2 || ty >= world.h - 2) continue;
				if (!reach[ty * world.w + tx]) continue;
				const x = tx * 32 + 16;
				const y = ty * 32 + 16;
				if (!blocked(world, x, y)) return { x, y };
			}
		}
		return nearestOpen(world, save.x + 32 * 10, save.y);
	}
	spawnBountySpirits(mob, level, tier) {
		const save = this.save;
		// A bounty fights like you do: up to three ghosts out at once, rolled like yours.
		const n = Math.min(OUT_MAX, 2 + Math.floor(tier / 6));
		const spirits = [];
		for (let i = 0; i < n; i++) {
			const spiritLevel = Math.max((save?.level ?? 1) + 3, level - (1 + i));
			const pet = this.makeEnemyGhost(mob, i, n, spiritLevel, { rarity: Math.min(4, 2 + Math.floor(tier / 5)), bounty: true });
			pet.map = mob.map;
			pet.aggro = false;
			pet.seen = false;
			pet.enraged = false;
			spirits.push(pet);
		}
		return spirits;
	}
	/**
	 * An enemy witch's ghost, made the same way the player's are: a ghost body and look, a ghost kit
	 * (up to 3 readied verses from its element), aid verses it spends on its witch, and the same
	 * 1-in-100 shiny roll. It cannot be caught.
	 */
	makeEnemyGhost(master, i, n, level, { rarity = 2, bounty = false } = {}) {
		const pool = MONSTERS.filter((d) => !d.animal && (d.type === "spirit" || d.type === master.type));
		const spec = pool[Math.floor(Math.random() * pool.length)] ?? MONSTERS[0];
		const at = this.world ? nearestOpen(this.world, master.x + (i - (n - 1) / 2) * 28, master.y + 18) : { x: master.x, y: master.y + 18 };
		const pet = this.makeMob({
			id: `${bounty ? "bounty" : "witch"}-spirit-${nextUid()}`, species: spec.id, x: at.x, y: at.y,
			level, fixedLevel: true, template: spec.template, type: spec.type, name: spec.name
		});
		pet.master = master.id;
		pet.enemyGhost = true;
		pet.ghost = true;
		pet.bountySpirit = bounty;
		pet.level = level;
		pet.rarity = rarity;
		pet.shiny = Math.random() < this.shinyChance(SHINY_CHANCE);
		if (pet.shiny) pet.palette = rollShinyPalette(Math.random, rarity);
		pet.ghostSlot = i;
		pet.homeX = at.x;
		pet.homeY = at.y;
		const rng = mulberry32(((Math.random() * 1e9) >>> 0) || 13);
		pet.look = rollGhostLook(rng, rarity, spec.move ?? "measured", "hunt");
		this.rekitMob(pet);
		const kit = rollSpiritKit(spec.type, rng, pet.move);
		const slots = kit.slots.map((id) => MOVE_BY_ID[id]).filter(Boolean);
		const attacks = slots.filter((m) => !spiritAidsPlayer(m)).map((m) => m.id);
		pet.kit = attacks.length ? attacks : pet.kit;
		pet.aid = slots.filter((m) => spiritAidsPlayer(m)).map((m) => m.id);
		pet.move = pet.kit[0] ?? pet.move;
		pet.aidCd = 2 + Math.random() * 2;
		if (pet.shiny) pet.name = `Shiny ${pet.name}`;
		return pet;
	}
	/** Enemy ghosts heal, ward and hasten their witch the way your ghosts look after you. */
	tickEnemyGhostAid(m, dt) {
		if (!m.aid?.length) return;
		m.aidCd = (m.aidCd ?? 3) - dt;
		if (m.aidCd > 0) return;
		m.aidCd = 3.5 + Math.random() * 2;
		const lead = this.mobs.find((x) => x.id === m.master && x.alive);
		if (!lead || Math.hypot(lead.x - m.x, lead.y - m.y) > 260) return;
		const moves = m.aid.map((id) => MOVE_BY_ID[id]).filter(Boolean);
		let move = null;
		if (lead.hp < lead.max * 0.55) move = moves.find((mv) => mv.effect === "mend" || moveTactic(mv) === "heal");
		if (!move && lead.status?.length) move = moves.find((mv) => mv.effect === "cleanse");
		if (!move && (lead.wardT ?? 0) <= 0 && lead.hp < lead.max * 0.85) move = moves.find((mv) => mv.effect === "shell" || moveTactic(mv) === "ward");
		if (!move) return;
		this.playMoveFx(move, m.x, m.y - 12, lead.x, lead.y - 16);
		if (move.effect === "cleanse") {
			lead.status = [];
			this.float(lead.x, lead.y - 48, "CLEAN", "#fff1a8");
		} else if (move.effect === "mend" || moveTactic(move) === "heal") {
			const heal = Math.floor(lead.max * (m.bountySpirit ? 0.05 : 0.04));
			lead.hp = Math.min(lead.max, lead.hp + heal);
			this.float(lead.x, lead.y - 50, `+${heal}`, "#9ad8c8");
		} else {
			lead.wardT = 2.5;
			this.float(lead.x, lead.y - 48, "WARD", "#fff1a8");
		}
	}
	/** Unengaged enemy ghosts circle their witch instead of standing in a line. */
	orbitMaster(m, lead, dt) {
		const n = 3;
		const ang = this.clock * (m.shiny ? 1.6 : 0.9) + (m.ghostSlot ?? 0) * (Math.PI * 2 / n);
		const rad = m.shiny ? 40 : 34;
		const tx = lead.x + Math.cos(ang) * rad;
		const ty = lead.y + 6 + Math.sin(ang) * rad * 0.5 + Math.sin(this.clock * 2.3 + (m.ghostSlot ?? 0)) * 4;
		const hx = tx - m.x, hy = ty - m.y;
		const hd = Math.hypot(hx, hy);
		if (hd > 2) this.moveMob(m, hx / hd * Math.min(hd * 4, 110) * dt, hy / hd * Math.min(hd * 4, 110) * dt);
	}
	tickBountySpirit(m, dt) {
		const save = this.save;
		if (!save) return;
		m.moving = false;
		const lead = this.mobs.find((x) => x.id === m.master && x.alive) ?? (this.contract ?? []).find((x) => x.id === m.master && x.alive);
		if (!lead) {
			m.alive = false;
			m.hp = 0;
			return;
		}
		if (m.status.some((s) => s.id === "sleep")) return;
		const dx = save.x - m.x;
		const dy = save.y - m.y;
		const d = Math.hypot(dx, dy) || 1;
		const hunting = !!lead.enraged;
		const engage = hunting || lead.seen || m.hurt > 0;
		const rooted = m.status.some((s) => s.id === "root");
		if (!rooted) {
			if (engage && d > 64) {
				const sp = hunting ? 176 : 72;
				this.moveMob(m, dx / d * sp * dt, dy / d * sp * dt);
			} else if (!engage) {
				if (m.enemyGhost) this.orbitMaster(m, lead, dt);
				else {
					const hx = lead.x - m.x;
					const hy = lead.y + 16 - m.y;
					const hd = Math.hypot(hx, hy);
					if (hd > 34) this.moveMob(m, hx / hd * 78 * dt, hy / hd * 78 * dt);
				}
			}
		}
		if (m.enemyGhost && engage) this.tickEnemyGhostAid(m, dt);
		m.aggro = engage;
		if (engage) this.combat = 2;
	}
	compass(dx, dy) {
		const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
		const i = Math.round((Math.atan2(dy, dx) / (Math.PI / 4) + 8) ) % 8;
		return dirs[i] ?? "N";
	}
	beginUnstuck() {
		if (!this.save || this.dead || snap.mode !== "play") return;
		if (this.unstuckT > 0) {
			this.unstuckT = 0;
			this.say("Unstuck cancelled.");
			this.syncHud(true);
			return;
		}
		this.unstuckT = 3;
		this.say("Unstuck in 3 seconds. Put the cursor where you want to land.");
		this.syncHud(true);
	}
	tickUnstuck(dt) {
		if (!(this.unstuckT > 0) || !this.save || this.dead) return;
		const before = Math.ceil(this.unstuckT);
		this.unstuckT -= dt;
		if (this.unstuckT <= 0) {
			this.unstuckT = 0;
			this.finishUnstuck();
			this.syncHud(true);
			return;
		}
		if (Math.ceil(this.unstuckT) !== before) this.syncHud(false);
	}
	finishUnstuck() {
		const save = this.save;
		const w = this.mouseWorld;
		if (!save || !this.world || !w) return this.say("Move the cursor over the ground first.");
		const spot = nearestOpen(this.world, w.x, w.y);
		save.x = spot.x;
		save.y = spot.y;
		this.cam.x = spot.x;
		this.cam.y = spot.y;
		this.dest = null;
		this.path = [];
		this.vx = 0;
		this.vy = 0;
		this.say("You tear free and land under the cursor.");
		this.persist();
	}
	spendPerk(id) {
		const save = this.save;
		const def = ENCHANT_BY_ID[id];
		const perk = def?.perk;
		if (!save || !def || !perk) return;
		save.perks = save.perks || {};
		save.perkPoints = perkPointsAvailable(save.accountLevel, save.perks);
		if (save.perkPoints <= 0) {
			this.say(`No perk points. Every account level gives ${PERK_POINTS_PER_LEVEL}.`);
			return;
		}
		const cur = Number.isFinite(save.perks[id]) ? save.perks[id] : 0;
		const next = cur + perk.step;
		save.perks[id] = next;
		save.perkPoints = perkPointsAvailable(save.accountLevel, save.perks);
		this.say(next > perk.max ? `${def.name} ${next} (overmax, old max ${perk.max}). ${perk.each}.` : `${def.name} ${next}/${perk.max}. ${perk.each}.`);
		this.persist();
		this.syncHud(true);
	}
	craftGear() {
		const save = this.save;
		if (!save) return;
		if ((save.bag.leather ?? 0) < 10 || (save.bag.mushroom ?? 0) < 10) {
			this.say("Need 10 leather and 10 mushrooms.");
			return;
		}
		save.bag.leather -= 10;
		save.bag.mushroom -= 10;
		const piece = rollGear(mulberry32(Math.random() * 1e9 | 0), {
			level: save.level,
			luck: 12 + save.accountLevel * 2,
			raceBias: save.race
		});
		this.receiveGear(piece);
		this.say(`Stitched ${piece.name} at level ${piece.level}.`);
		this.gainSkill("alchemy", 22);
		this.persist();
		this.syncHud(true);
	}
	sellMats() {
		const save = this.save;
		if (!save) return;
		const ids = this.rules === "hardcore" ? ["leather", "ore"] : [
			"meat",
			"leather",
			"mushroom",
			"ore",
			"timber",
			"fish"
		];
		let kyo = 0;
		const charm = 1 + this.chan("sell_boost") / 100 + this.skillN("trading") * 0.002;
		for (const id of ids) {
			const n = save.bag[id] ?? 0;
			if (n <= 0) continue;
			const price = ITEM_BY_ID[id]?.price ?? 6;
			kyo += Math.floor(n * price * .85 * charm);
			save.bag[id] = 0;
		}
		if (kyo <= 0) {
			this.say("Nothing Holt wants.");
			return;
		}
		save.kyo += kyo;
		this.say(`Sold the pack for ${kyo} kyo.`);
		this.gainSkill("trading", 10);
		this.persist();
		this.syncHud(true);
	}
	toggle(panel) {
		if (snap.mode !== "play" || this.dead || snap.panel === "loot") return;
		publish({ panel: snap.panel === panel ? null : panel });
		this.syncHud(true);
	}
	escape() {
		if (this.dead || snap.panel === "loot") return;
		if (this.buildMode && !snap.panel) { this.toggleBuild(false); return; }
		if (snap.panel) publish({ panel: null });
		else if (snap.mode === "play") publish({ panel: "pause" });
	}
	closePanel() {
		if (this.dead || snap.panel === "loot") return;
		if (snap.panel === "chest") this.chestOpen = null;
		if (snap.panel === "wildghost") this.wildOpen = null;
		publish({ panel: null });
	}
	/**
	 * Ascension: every witch, both modes, account level, perks, skills and score are wiped, locally and in
	 * the cloud. Returns how many times this account has now ascended.
	 */
	ascend() {
		window.clearTimeout(this.cloudTimer);
		this.endLms?.();
		this.room?.close();
		this.room = null;
		this.role = "solo";
		this.save = null;
		this.dead = false;
		this.cloudCache = null;
		this.cloudHard = null;
		this.mobs = [];
		this.dormant = [];
		this.populationMap = "";
		this.contract = [];
		const n = wipeAccountProgress();
		try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(HC_KEY); } catch { /* private mode */ }
		publish({ ...emptySnap(), rules: this.rules, hasSave: false, mode: "title" });
		return n;
	}
	toTitle() {
		this.persist();
		this.endLms?.();
		this.room?.close();
		this.room = null;
		this.role = "solo";
		this.save = null;
		this.mobs = [];
		this.dormant = [];
		this.populationMap = "";
		this.contract = [];
		this.unstuckT = 0;
		publish({
			...emptySnap(),
			rules: this.rules,
			hasSave: !!((this.rules === "hardcore" ? this.cloudHard : this.cloudCache) || localStorage.getItem(this.rules === "hardcore" ? HC_KEY : SAVE_KEY)),
			mode: "title"
		});
	}
	stab(type) {
		this.save;
		let s = 1;
		for (const slot of [
			"weapon",
			"head",
			"chest",
			"legs",
			"feet",
			"relic"
		]) {
			const g = this.piece(slot);
			if (!g) continue;
			if (g.type === type) s += slot === "weapon" ? .28 : .08;
		}
		s += this.chan("type_edge") / 100;
		if (this.buff.t > 0 && this.buff.type === type) s += .22;
		return s;
	}
	piece(slot) {
		const save = this.save;
		if (!save) return null;
		const uid = save.equipped[slot];
		return save.gear.find((g) => g.uid === uid) ?? null;
	}
	normalize(save) {
		if (!RACES.some((r) => r.id === save.race)) save.race = "vesper";
		if (!Object.hasOwn(CLASS_BY_ID, save.classId)) save.classId = LEGACY_CLASS[save.race];
		const skills = blankSkills();
		const prev = save.skills ?? {};
		for (const sk of SKILLS) {
			const had = prev[sk.id];
			if (had && had.level) skills[sk.id] = {
				level: had.level,
				xp: had.xp || 0
			};
		}
		save.skills = skills;
		{
			const lv = Math.floor(Number(save.level));
			save.level = Number.isFinite(lv) ? Math.max(1, lv) : 1;
		}
		for (const sk of SKILLS) {
			const st = save.skills[sk.id];
			if (!st) continue;
			const lv = Math.floor(Number(st.level));
			const xp = Math.floor(Number(st.xp));
			st.level = Number.isFinite(lv) ? Math.max(1, lv) : 1;
			st.xp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
		}
		save.quests = save.quests ?? blankQuests();
		for (const d of QUESTS) if (!save.quests[d.id]) save.quests[d.id] = {
			n: 0,
			n2: 0,
			done: false
		};
		save.accountLevel = save.accountLevel || 1;
		save.accountXp = save.accountXp || 0;
		save.perkPoints = save.perkPoints || 0;
		save.perks = save.perks || {};
		save.lastTavern = save.lastTavern || "crown_tap";
		save.bag = save.bag || {};
		save.gear = save.gear || [];
		save.party = save.party ?? [];
		save.found = save.found ?? {};
		// Old saves tracked sets per account. Hand finished ones to every class of that race (the old rule),
		// and partial progress to the current class, so nothing already earned is lost.
		if (!save.foundBy) {
			save.foundBy = {};
			for (const [id, slots] of Object.entries(save.found)) {
				const set = SET_BY_ID[id];
				if (!set) continue;
				const done = SET_PIECES.every((p) => slots.includes(p));
				const owners = done ? CLASSES.filter((c) => CLASS_RACE[c.id] === set.race).map((c) => c.id) : [];
				if (save.classId && !owners.includes(save.classId)) owners.push(save.classId);
				for (const cls of owners) (save.foundBy[cls] = save.foundBy[cls] ?? {})[id] = [...slots];
			}
		}
		save.spirits = save.spirits ?? [];
		save.accountScore = save.accountScore ?? 0;
		save.evilMark = save.evilMark ?? 0;
		if (save.companion && save.spirits.length === 0) {
			const def = MONSTER_BY_ID[save.companion.species];
			if (def) {
				const look = rollGhostLook(mulberry32(save.seed || 1), save.companion.rarity || 0, "measured", "hunt");
				save.spirits.push({
					uid: nextUid(), species: save.companion.species, name: def.name, type: def.type, template: def.template,
					level: save.companion.level, rarity: save.companion.rarity || 0, look, move: look.move,
					hp: 30 + save.companion.level * 8, max: 30 + save.companion.level * 8, speed: 8 + save.companion.level
				});
			}
			save.companion = null;
		}
		// Ghost slots are gone (3 out, 6 in the party, the rest in the Ghost Box). Points spent on them come back.
		if ((save.ghostSlots | 0) > 0) {
			save.skillPoints = (Number.isFinite(save.skillPoints) ? save.skillPoints : 0) + Math.min(7, save.ghostSlots | 0);
			this.refundNote = Math.min(7, save.ghostSlots | 0);
		}
		save.ghostSlots = 0;
		save.ghostStore = Array.isArray(save.ghostStore) ? save.ghostStore.filter((g) => g && typeof g.uid === "string" && g.species).slice(0, GHOST_STORE_MAX) : [];
		{
			const b = save.ghostBox;
			save.ghostBox = b && typeof b.map === "string" && Number.isInteger(b.tx) && Number.isInteger(b.ty) ? { map: b.map, tx: b.tx, ty: b.ty } : null;
		}
		save.chests = Array.isArray(save.chests) ? save.chests.filter((c) => c && typeof c.id === "string" && Number.isFinite(c.x) && Number.isFinite(c.y) && c.t > 0).slice(-40) : [];
		save.jarLeft = Math.max(0, save.jarLeft || 0);
		{
			const taken = {};
			for (const [k, v] of Object.entries(save.nodesTaken && typeof save.nodesTaken === "object" ? save.nodesTaken : {})) {
				if (Array.isArray(v)) taken[k] = v.filter((id) => typeof id === "string").slice(-4000);
			}
			save.nodesTaken = taken;
			save.regrowT = Number.isFinite(save.regrowT) ? Math.max(0, save.regrowT) : 0;
		}
		save.box = save.box ?? [];
		save.spirits = save.spirits ?? [];
		for (const pet of save.box) {
			const def = MONSTER_BY_ID[pet.species] ?? ANIMAL_BY_ID[pet.species];
			if (!def) continue;
			const kit = rollSpiritKit(def.type, mulberry32(((pet.level || 1) * 997 + (pet.rarity || 0) * 13) >>> 0 || 1), pet.move);
			const max = pet.max ?? 30 + (pet.level || 1) * 8;
			save.spirits.push({
				uid: nextUid(), species: pet.species, name: pet.name || def.name, type: pet.type || def.type, template: pet.template ?? def.template,
				level: pet.level || 1, rarity: pet.rarity || 0,
				look: pet.look || rollGhostLook(mulberry32((save.seed || 1) + save.spirits.length), pet.rarity || 0, kit.slots[0] || "measured", "hunt"),
				move: kit.slots[0] || "measured", known: kit.known, slots: kit.slots,
				hp: pet.hp ?? max, max, speed: pet.speed ?? 8 + (pet.level || 1), active: false, shiny: !!pet.shiny
			});
		}
		save.box = [];
		// Six ghosts in the party at most; older saves keep the rest safe in the Ghost Box.
		if (save.spirits.length > PARTY_MAX) {
			const keep = [...save.spirits.filter((s) => s.active), ...save.spirits.filter((s) => !s.active)].slice(0, PARTY_MAX);
			const extra = save.spirits.filter((s) => !keep.includes(s));
			for (const s of extra) s.active = false;
			save.ghostStore = [...save.ghostStore, ...extra].slice(0, GHOST_STORE_MAX);
			save.spirits = save.spirits.filter((s) => keep.includes(s));
		}
		const cap = this.spiritCap();
		let following = 0;
		for (const s of save.spirits) {
			if (!Array.isArray(s.known) || !s.known.length) {
				const kit = rollSpiritKit(s.type, mulberry32(((s.level || 1) * 17 + (s.name?.length || 1) * 31) >>> 0 || 1), s.move);
				s.known = kit.known;
				s.slots = kit.slots;
			}
			s.known = [...new Set(s.known)].filter((id) => MOVE_BY_ID[id]).slice(0, 10);
			if (s.known.length < 3) {
				const kit = rollSpiritKit(s.type, mulberry32(s.known.length + 5), s.move);
				for (const id of kit.known) if (!s.known.includes(id) && s.known.length < 10) s.known.push(id);
			}
			s.slots = (Array.isArray(s.slots) ? s.slots : [s.move]).filter((id) => s.known.includes(id)).slice(0, 3);
			while (s.slots.length < Math.min(3, s.known.length)) {
				const id = s.known.find((k) => !s.slots.includes(k));
				if (!id) break;
				s.slots.push(id);
			}
			s.move = s.slots[0] ?? s.move ?? "measured";
			if (s.hp == null) s.hp = s.max ?? 30;
			if (s.max == null) s.max = Math.max(s.hp, 30);
			s.shiny = !!s.shiny;
			if (this.rules !== "hardcore" || !GHOST_TASK_IDS.includes(s.task as GhostTask)) { s.task = null; s.taskT = 0; }
			s.xp = Number.isFinite(s.xp) ? Math.max(0, Math.floor(s.xp as number)) : 0;
			if (s.task) { s.active = false; s.taskT = Number.isFinite(s.taskT) ? s.taskT : this.ghostTaskEvery(s, s.task); }
			if (s.active) {
				if (following < cap) following += 1;
				else s.active = false;
			}
		}
		if (!following) {
			for (const s of save.spirits) {
				if (following >= cap) break;
				if (s.task) continue;
				s.active = true;
				following += 1;
			}
		}
		// Older ghosts gain what newer builds roll: rarity in range, a palette for shinies, and abilities.
		for (const g of [...save.spirits, ...save.ghostStore]) this.finishGhost(g);
		save.quick = this.cleanQuickOf(save);
		for (const w of Array.isArray(save.wildGhosts) ? save.wildGhosts : []) if (w?.spirit) this.finishGhost(w.spirit);
		if (save.ghostStore.filter((g) => g.tagged).length > TINY_MAX) { let n = 0; for (const g of save.ghostStore) if (g.tagged && ++n > TINY_MAX) g.tagged = false; }
		this.ghostAgg = null;
		this.ghostCdT = {};
		if (!save.innate?.length) {
			const seed = save.seed || 1;
			save.innate = save.known?.length ? save.known.slice(0, 4) : rollInnate(mulberry32(seed));
		}
		normalizeAbilities(save);
		if (save.traitId && !TRAIT_BY_ID[save.traitId]) save.traitId = null;
		if (save.female === undefined) save.female = true;
		if (save.classMovesV !== 3) {
			for (const id of CLASS_BY_ID[save.classId].starterMoves) if (MOVE_BY_ID[id] && !save.abilityRanks[id]) save.abilityRanks[id] = 1;
			save.classMovesV = 3;
		}
		save.dungeons = normalizeDungeonState(save.dungeons);
		if (this.rules === "hardcore") save.dayNight = normalizeDayNight(save.dayNight);
		save.mapQuests = sanitizeQuestStates(save.mapQuests);
		save.mapSeen = Array.isArray(save.mapSeen) ? save.mapSeen.filter((x) => typeof x === "string").slice(-200) : [];
		if (this.rules === "hardcore") {
			const fresh = !save.survival; save.survival = normalizeSurvival(save.survival);
			if (fresh) { save.bag.trail_ration = (save.bag.trail_ration ?? 0) + 2; }
		}
		if (save.map.startsWith("rift-") && !save.dungeons.portals.some(p => p.id === save.map)) { save.map = "world"; Object.assign(save, hearthXY()); }
		if (save.map.startsWith("custom-") && save.map !== "custom-turbz" && !findMapFile(save.map.slice(7))) { save.map = "world"; Object.assign(save, hearthXY()); }
		// The Green Cave is Hardcore only.
		if (save.map === `custom-${GREEN_CAVE_ID}` && this.rules !== "hardcore") { save.map = "world"; Object.assign(save, hearthXY()); }
		for (const g of save.gear) migrateEquipment(g);
		save.locked = Array.isArray(save.locked) ? save.locked.filter((id) => save.gear.some((g) => g.uid === id)) : [];
		if (save.hunt) {
			const h = save.hunt;
			h.tier = Math.max(0, Math.floor(h.tier || 0));
			h.kills = Math.max(0, Math.floor(h.kills || 0));
			h.stars = Math.max(0, Math.min(BOUNTY_STARS_NEEDED - 1, Math.floor(h.stars || 0)));
			h.wanted = Math.max(0, Math.floor(h.wanted || 0));
			h.waveIn = Math.max(0, Number(h.waveIn) || 0);
			h.squads = Math.max(0, Math.floor(h.squads || 0));
		}
		if (save.pendingLoot && !Array.isArray(save.pendingLoot.gear)) save.pendingLoot = null;
		if (save.pendingLoot) for (const g of save.pendingLoot.gear) migrateEquipment(g);
		this.foldAccount(save);
		this.syncArsenal(save);
	}
	gainAccount(n) {
		const save = this.save;
		save.accountXp += Math.max(0, n);
		let need = accountNeed(save.accountLevel);
		let ups = 0;
		while (save.accountXp >= need && ups < 48) {
			if (!Number.isFinite(need) || need <= 0) break;
			save.accountXp -= need;
			save.accountLevel += 1;
			this.say(`Account level ${save.accountLevel}! +${PERK_POINTS_PER_LEVEL} perk points.`);
			if (this.save && !this.lms) this.float(save.x, save.y - 84, `ACCOUNT ${save.accountLevel} · +${PERK_POINTS_PER_LEVEL} PERKS`, "#e6c15a");
			this.cue("burst", { rate: 0.9, len: 2.6 }, [520, .14, "square"]);
			ups += 1;
			need = accountNeed(save.accountLevel);
		}
		save.perkPoints = perkPointsAvailable(save.accountLevel, save.perks);
		if (ups && !this.lms && !this.turbz) { this.writeProgress(save); this.syncHud(true); }
	}
	pickTavern() {
		const last = this.save?.lastTavern;
		const pool = TAVERNS.filter((t) => t.id !== last);
		return pool[Math.floor(Math.random() * pool.length)] ?? TAVERNS[0];
	}
	openBounty(tavern) {
		this.ensureHunt();
		publish({ panel: "bounty" });
		this.say(`${tavern.name}. ${BOUNTY_BOARD_SIZE} names on the board.`);
		this.syncHud(true);
	}
	playerArmor() {
		return ["head", "chest", "legs", "feet", "relic"].reduce((sum, slot) => { const g = this.piece(slot); return sum + (g ? equipmentStats(g).armor : 0); }, 0);
	}
	mobArmor(mob) {
		if (mob.bounty || mob.hunter) return 10 + mob.level * 3;
		if (mob.animal && mob.species !== "boar") return 2;
		if (mob.witch) return 10 + mob.level * 3;
		return 4 + mob.level * 2 + (mob.boss ? 24 : 0);
	}
	chan(id) {
		const save = this.save;
		if (!save) return 0;
		let n = 0;
		for (const slot of [
			"weapon",
			"head",
			"chest",
			"legs",
			"feet",
			"relic"
		]) {
			const g = this.piece(slot);
			if (!g) continue;
			for (const e of g.enchants) if (e.id === id) n += e.power;
		}
		n += save.perks[id] ?? 0;
		for (const a of this.activeAuras()) n += a.chan?.[id] ?? 0;
		n += this.ghostAgg?.chan?.[id] ?? 0;
		return n;
	}
	// ---------- Auras ----------
	/** Auras that are up: raised from the bar and still slotted there. */
	activeAuras() {
		const save = this.save;
		if (!save?.auras?.length) return [];
		const out = [];
		for (const id of save.auras) {
			if (out.length >= MAX_AURAS) break;
			if (!AURA_IDS.has(id) || !save.bar?.includes(id)) continue;
			const a = MOVE_BY_ID[id]?.aura;
			if (a) out.push(a);
		}
		return out;
	}
	/** Share of maximum health the raised auras hold back (Aura Ease trims it, by half at most). */
	auraReserve() {
		const raw = this.activeAuras().reduce((n, a) => n + a.reserve, 0);
		if (!raw) return 0;
		const ease = Math.min(0.5, bend(this.chanNoAura("aura_ease") / 100, 0.35, 0.5));
		return Math.min(0.6, raw * (1 - ease));
	}
	chanNoAura(id) {
		const save = this.save;
		if (!save) return 0;
		let n = save.perks[id] ?? 0;
		for (const slot of ["weapon", "head", "chest", "legs", "feet", "relic"]) for (const e of this.piece(slot)?.enchants ?? []) if (e.id === id) n += e.power;
		return n;
	}
	/** Cast from the bar: raise the aura, or drop it if it is already up. */
	toggleAura(move) {
		const save = this.save;
		if (!save || !move.aura) return false;
		save.auras = (save.auras ?? []).filter((id) => AURA_IDS.has(id) && save.bar.includes(id));
		const on = save.auras.includes(move.id);
		if (on) {
			save.auras = save.auras.filter((id) => id !== move.id);
			this.float(save.x, save.y - 48, `${move.name} fades`, "#c9a6e8");
			this.say(`${move.name} fades. Your full health returns.`);
		} else {
			if (save.auras.length >= MAX_AURAS) { this.say(`Only ${MAX_AURAS} auras can be up at once. Cast one again to drop it.`); return false; }
			save.auras.push(move.id);
			this.float(save.x, save.y - 48, move.name.toUpperCase(), TYPES[move.type]?.color ?? "#fff1a8");
			this.say(`${move.name} is up: ${move.aura.label}. It holds back ${Math.round(this.auraReserve() * 100)}% of your health while your auras stay up.`);
			this.playMoveFx(move, save.x, save.y - 24, save.x, save.y - 24);
			this.cue("swell", { rate: 1.4, len: 1 });
		}
		save.hp = Math.min(save.hp, this.maxHp());
		this.cds[move.id] = 1;
		this.cdMax = this.cdMax ?? {};
		this.cdMax[move.id] = 1;
		this.persist();
		this.syncHud(true);
		return true;
	}
	setInfo() {
		const ids = [
			"head",
			"chest",
			"legs",
			"feet",
			"relic"
		].map((s) => this.piece(s)?.setId ?? null);
		const first = ids.find((id) => id);
		if (!first) return {
			on: false,
			count: 0,
			name: "",
			bonus: "",
			fx: null
		};
		const count = ids.filter((id) => id === first).length;
		const set = SET_BY_ID[first];
		return {
			id: first,
			variant: SET_VARIANT[first] ?? 0,
			on: count === 5,
			count,
			name: set?.name ?? "",
			bonus: set?.bonus ?? "",
			fx: set?.fx ?? null
		};
	}
	maxHp() {
		const save = this.save;
		if (!save) return 80;
		const tide = 1 + Math.max(0, this.chan("body_tide")) / 100;
		const full = (78 + save.level * 12 + this.chan("spark_life") + this.chan("vitality")) * (1 + this.mod("hp") / 100) * tide;
		return Math.max(20, Math.floor(full * (1 - this.auraReserve())));
	}
	/** Mana and stamina as shares of max health, plus skills, enchants, auras and ghosts. */
	poolCaps() {
		const save = this.save;
		const cls = save ? CLASS_BY_ID[save.classId] : null;
		return derivePools({
			hp: this.maxHp(),
			role: cls?.role ?? "Bruiser",
			fightStyle: cls?.fightStyle ?? "mixed",
			manaSkill: this.skillN?.("mana") ?? 0,
			stamSkill: this.skillN?.("stamina") ?? 0,
			magic: this.skillN?.("magic") ?? 0,
			physical: this.skillN?.("physical") ?? 0,
			survival: this.skillN?.("survival") ?? 0,
			manaWell: this.chan?.("mana_well") ?? 0,
			stamWell: this.chan?.("stam_well") ?? 0,
			manaFlow: this.chan?.("mana_flow") ?? 0,
			stamFlow: this.chan?.("stam_flow") ?? 0,
		});
	}
	armorType() {
		return (this.piece("chest") ?? this.piece("weapon"))?.type ?? "normal";
	}
	applyEffect(move, mob, onMob) {
		if (move.effect === "none" || move.effect === "leech" || move.effect === "mend" || move.effect === "shell") return;
		const st = {
			id: move.effect === "drain" ? "leech" : move.effect,
			t: 3.2 + move.priority * .3
		};
		if (onMob && mob) this.applyMobStatus(mob, st.id, st.t);
		else this.addStatus(st.id, st.t);
	}
	profile() {
		const save = this.save;
		const key = `${save?.classId}|${save?.traitId ?? ""}|${save?.classId === "cryinggirl" ? getCustomBuild().join(",") + JSON.stringify(getCryingConfig()) : ""}`;
		if (this.profileKey !== key) {
			this.profileKey = key;
			this.profileCache = save ? classProfile(save.classId, save.traitId) : { stats: {}, immune: [] };
		}
		return this.profileCache;
	}
	mod(id) {
		if (!this.save) return 0;
		let n = this.profile().stats[id] ?? 0;
		for (const a of this.activeAuras()) n += a.mod?.[id] ?? 0;
		return n;
	}
	speedMult() {
		const swift = this.status.some((s) => s.id === "swift") ? 1.45 : 1;
		const agility = bendDown(1 + this.mod("speed") / 100, 0.5, 0.05);
		const roam = this.combat > 0 ? 1 : 1 + bend(this.chan("wayfarer") / 100, 0.5, 0.9);
		return agility * swift * roam * (1 + bend(this.chan("swift_step") / 100, 0.45, 0.85)) * (1 + this.skillN("wayfinding") * 0.00075) * (this.gim?.speedMult() ?? 1);
	}
	addStatus(id, t) {
		if (id === "none") return;
		if (this.save && this.profile().immune.includes(id)) {
			this.float(this.save.x, this.save.y - 52, "IMMUNE", "#9ad8c8");
			return;
		}
		if (id === "burn") {
			// Burning is a fixed 15 seconds. A fresh flame does not stack or restart one already burning.
			if (this.status.some((s) => s.id === "burn" && s.t > 0)) return;
			this.status.push({ id: "burn", t: BURN_SECONDS + .05, tick: 1 });
			if (this.save) this.float(this.save.x, this.save.y - 56, "BURNING", "#ffb15e");
			return;
		}
		const r = applyStatus(this.status, id, t);
		if (!this.save) return;
		if (r === "resisted") this.float(this.save.x, this.save.y - 52, "RESIST", "#9ad8c8");
		else if (r === "applied" && HARD_CC[id]) {
			this.float(this.save.x, this.save.y - 56, id === "sleep" ? "ASLEEP" : id === "root" ? "ROOTED" : "SILENCED", "#c9a6e8");
			if (!this.ccTipShown) {
				this.ccTipShown = true;
				this.say(id === "sleep" ? "Asleep! Any hit wakes you, and mashing keys shakes it off faster. You are immune to it for a while after." : id === "root" ? "Rooted! Blink to break free, or mash keys. You are immune to it for a while after." : "Silenced! Blinks, dashes and mends still work. Cleanse Salt clears it.");
			}
		}
	}
	/** Bosses, bounties, witches and hunters shake hard control off twice as fast. */
	toughFoe(m) {
		return !!(m && (m.boss || m.bounty || m.witch || m.hunter || m.dungeonBoss));
	}
	/** Every status on a foe goes through here: no stacking, short hard control, immunity after. */
	applyMobStatus(m, id, t) {
		if (!m?.alive) return "ignored";
		const r = applyStatus(m.status, id, t, { tough: this.toughFoe(m) });
		if (r === "resisted") this.float(m.x, m.y - 44, "RESIST", "#9ad8c8");
		else if (r === "applied" && HARD_CC[id]) this.float(m.x, m.y - 46, id === "sleep" ? "SLEEP" : id === "root" ? "ROOT" : "SILENCE", "#c9a6e8");
		return r;
	}

	peekRuleSave() {
		const cached = this.rules === "hardcore" ? this.cloudHard : this.cloudCache;
		if (cached && cached.skills) return cached;
		try {
			const key = this.rules === "hardcore" ? HC_KEY : SAVE_KEY;
			const text = localStorage.getItem(key);
			return text ? JSON.parse(text) : null;
		} catch {
			return null;
		}
	}
	captureProgress(raw) {
		if (!raw || typeof raw !== "object") return;
		const save = {
			skills: blankSkills(),
			accountLevel: raw.accountLevel || 1,
			accountXp: raw.accountXp || 0,
			perkPoints: raw.perkPoints || 0,
			perks: { ...(raw.perks || {}) },
			accountScore: raw.accountScore || 0,
			ghostSlots: 0
		};
		for (const sk of SKILLS) {
			const had = raw.skills?.[sk.id];
			if (had && had.level) save.skills[sk.id] = { level: had.level, xp: had.xp || 0 };
		}
		this.foldAccount(save);
	}
	foldAccount(save) {
		const meta = readAccountMeta();
		if (meta) {
			const skills = meta.skills && typeof meta.skills === "object" ? meta.skills : {};
			for (const sk of SKILLS) {
				const had = skills[sk.id];
				const cur = save.skills?.[sk.id];
				if (!had || !cur) continue;
				const lv = Math.floor(Number(had.level));
				const xp = Math.floor(Number(had.xp));
				const safeLv = Number.isFinite(lv) ? Math.max(1, lv) : 1;
				const safeXp = Number.isFinite(xp) ? Math.max(0, xp) : 0;
				if (safeLv > cur.level || (safeLv === cur.level && safeXp > (cur.xp | 0))) {
					cur.level = safeLv;
					cur.xp = safeXp;
				}
			}
			// Level and XP go together: the further of the two copies, never a mix of both.
			const lv = furtherLevel({ level: save.accountLevel || 1, xp: save.accountXp || 0 }, { level: meta.accountLevel | 0 || 1, xp: meta.accountXp | 0 || 0 });
			save.accountLevel = lv.level;
			save.accountXp = lv.xp;
			save.perks = save.perks || {};
			const perks = meta.perks && typeof meta.perks === "object" ? meta.perks : {};
			for (const [id, n] of Object.entries(perks)) {
				const v = Math.max(0, n | 0);
				if (v > (save.perks[id] ?? 0)) save.perks[id] = v;
			}
			save.accountScore = Math.max(save.accountScore ?? 0, meta.accountScore | 0 || 0);
			save.ghostSlots = 0;
		}
		// Perk points are earned per account level and spent per perk; never trusted from a stored copy.
		save.perks = save.perks || {};
		save.perkPoints = perkPointsAvailable(save.accountLevel || 1, save.perks);
		this.writeProgress(save);
	}
	writeProgress(save) {
		if (!save?.skills) return;
		const skills = {};
		for (const sk of SKILLS) {
			const st = save.skills[sk.id];
			const lv = Math.floor(Number(st?.level));
			const xp = Math.floor(Number(st?.xp));
			skills[sk.id] = { level: Number.isFinite(lv) ? Math.max(1, lv) : 1, xp: Number.isFinite(xp) ? Math.max(0, xp) : 0 };
		}
		writeAccountMeta({
			skills,
			accountLevel: save.accountLevel || 1,
			accountXp: save.accountXp || 0,
			perkPoints: save.perkPoints || 0,
			perks: save.perks || {},
			accountScore: save.accountScore ?? 0,
			ghostSlots: save.ghostSlots || 0
		});
	}
	persist() {
		if (!this.save) return;
		// Last Man Standing is a match, not a save: nothing is written, so your Hardcore witch is untouched.
		if (this.lms || this.turbz) return;
		for (const g of this.save.gear) this.noteFound(g);
		this.save.savedAt = Date.now();
		const key = this.rules === "hardcore" ? HC_KEY : SAVE_KEY;
		const localJson = JSON.stringify(this.save);
		if (this.rules === "hardcore") this.cloudHard = JSON.parse(localJson);
		else this.cloudCache = JSON.parse(localJson);
		try { localStorage.setItem(key, localJson); } catch {
			if (!this.storageWarned) { this.storageWarned = true; this.say("Local saving is unavailable. Keep this tab open to retain your progress."); }
		}
		this.writeProgress(this.save);
		if (!this.cloudFn) return;
		const json = JSON.stringify({ slot: this.rules === "hardcore" ? "hardcore" : "hunt", save: this.save });
		window.clearTimeout(this.cloudTimer);
		this.cloudTimer = window.setTimeout(() => this.cloudFn?.(json), 700);
	}
	/** The page is closing: save now and send to the cloud without waiting for the usual pause. */
	flushCloud() {
		if (!this.save || this.lms || this.turbz) { flushNow(); return; }
		this.persist();
		window.clearTimeout(this.cloudTimer);
		const json = JSON.stringify({ slot: this.rules === "hardcore" ? "hardcore" : "hunt", save: this.save });
		this.cloudFn?.(json);
		flushNow();
	}
	attachCloud(fn: (json: string) => void) {
		this.cloudFn = fn;
	}
	rememberCloud(raw) {
		if (!raw || typeof raw !== "object") return;
		const save = raw;
		if (!save.name || !save.race) return;
		this.cloudCache = save;
		if (this.rules !== "hardcore") publish({ hasSave: true });
	}
	rememberHard(raw) {
		if (!raw || typeof raw !== "object") return;
		const save = raw;
		if (!save.name || !save.race) return;
		this.cloudHard = save;
		if (this.rules === "hardcore") publish({ hasSave: true });
	}
	swapRules(rules) {
		if (this.save) this.persist();
		this.rules = rules === "hardcore" ? "hardcore" : "hunt";
		this.autoCombat = this.rules !== "hardcore";
		this.duel = null;
		this.save = null;
		this.mobs = [];
		this.dormant = [];
		this.populationMap = "";
		this.contract = [];
		this.unstuckT = 0;
		this.dead = false;
		const key = this.rules === "hardcore" ? HC_KEY : SAVE_KEY;
		const cached = this.rules === "hardcore" ? this.cloudHard : this.cloudCache;
		let local = false;
		try { local = !!localStorage.getItem(key); } catch { local = false; }
		publish({
			...emptySnap(),
			rules: this.rules,
			hasSave: !!(cached || local),
			mode: "title"
		});
	}
	attachGrave(fn) {
		this.graveFn = fn;
	}
	openShell(sx, sy) {
		this.openInspect(-9999, -9999, sx, sy);
	}
	buildSheet() {
		const base = this.buildSheetBase();
		if (snap.panel === "sheet" || !this.sheetExtraCache) this.sheetExtraCache = this.sheetExtras(base);
		return { ...base, ...this.sheetExtraCache, moves: base.moves.map((m) => ({ kind: "utility", form: "", acc: 0, range: 0, cd: 0, hit: 0, critHit: 0, critPct: 0, heal: 0, shield: 0, rankMult: 1, shape: [], note: "", ...m, ...(this.sheetExtraCache.verses[m.id] ?? {}) })) };
	}
	/** Breakdown tables for the character sheet. Every number comes from the same functions combat uses. */
	sheetExtras(base) {
		const save = this.save;
		const SLOTS = ["weapon", "head", "chest", "legs", "feet", "relic"];
		const gearOf = (id) => SLOTS.reduce((n, s) => n + (this.piece(s)?.enchants ?? []).reduce((a, e) => a + (e.id === id ? e.power : 0), 0), 0);
		const acctOf = (id) => save.perks?.[id] ?? 0;
		const ename = (id) => ENCHANT_BY_ID[id]?.name ?? id;
		const prof = this.profile();
		const sgn = (v, d = 0) => `${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(d)}`;
		const parts = [];
		const P = (label, value, src) => parts.push({ label, value, src });
		const enchParts = (id, fmt) => {
			const g = gearOf(id), a = acctOf(id);
			const out = [];
			if (g) out.push({ label: `${ename(id)} · gear`, value: fmt(g), src: "gear" });
			if (a) out.push({ label: `${ename(id)} · account`, value: fmt(a), src: "account" });
			return out;
		};
		const numbers = [];
		const num = (id, label, value, list, note) => numbers.push({ id, label, value, parts: list, note: note ?? "" });
		const pct = (v) => `${v >= 0 ? "+" : "-"}${Math.abs(v)}%`;

		// Maximum health
		{
			const l = [{ label: "Base", value: "78", src: "base" }, { label: `Level ${save.level} × 12`, value: String(save.level * 12), src: "level" }];
			l.push(...enchParts("spark_life", (n) => sgn(n)), ...enchParts("vitality", (n) => sgn(n)));
			if (prof.stats.hp) l.push({ label: "Class / trait Vitality", value: `×${(1 + prof.stats.hp / 100).toFixed(2)}`, src: "class" });
			num("hp", "Maximum health", String(this.maxHp()), l);
		}
		// Weapon
		{
			const w = this.piece("weapon");
			const l = [];
			if (w) {
				const q = Math.max(0, ["worn", "common", "fine", "rare", "epic", "legendary"].indexOf(w.quality));
				l.push({ label: `${w.name} base`, value: "8", src: "gear" }, { label: `Gear level ${w.level || 1} × 2`, value: String((w.level || 1) * 2), src: "gear" }, { label: `${w.quality} quality`, value: String(q * 6), src: "gear" });
				const wh = (w.enchants ?? []).filter((e) => e.id === "whetstone").reduce((n, e) => n + e.power, 0);
				if (wh) l.push({ label: "Whetstone", value: sgn(wh), src: "gear" });
			} else l.push({ label: "Bare hands", value: "8", src: "base" });
			num("weapon", "Weapon damage", String(w ? equipmentStats(w).damage : 8), l, "Each verse uses 35% of this on top of its own power.");
		}
		// Armor
		{
			const l = [];
			for (const slot of ["head", "chest", "legs", "feet", "relic"]) {
				const g = this.piece(slot);
				l.push({ label: `${slot[0].toUpperCase()}${slot.slice(1)}${g ? ` · ${g.name}` : ""}`, value: g ? String(equipmentStats(g).armor) : "0", src: "gear" });
			}
			num("armor", "Armor", String(this.playerArmor()), l, "Armor cuts ranged damage by 100 ÷ (100 + armor). Melee hits ignore armor, ward and guard completely.");
		}
		// Crit
		{
			const l = [];
			if (prof.stats.crit) l.push({ label: "Class / trait Precision", value: sgn(prof.stats.crit), src: "class" });
			l.push(...enchParts("crit_edge", (n) => sgn(n)));
			if (this.buff.t > 0 && this.buff.crit) l.push({ label: "Battle edge (timed)", value: sgn(this.buff.crit), src: "buff" });
			num("crit", "Crit chance bonus", `${sgn(this.critChanceOf({ crit: 0 }))}%`, l, "Added to each verse's own crit chance.");
		}
		// Cooldowns
		{
			const haste = bendSigned(prof.stats.haste / 100, -1.5, -0.4, 0.45, 0.82);
			const swiftCut = bend(this.chan("swift") / 100, 0.4, 0.75);
			const atk = (1 - swiftCut) * (1 - haste);
			const magicCut = 1 - rateMult(this.skillN("magic") * 0.2);
			const focusCut = bend(this.chan("focus") / 100, 0.35, 0.7);
			const spl = atk * (1 - magicCut) * (1 - focusCut);
			const l = [];
			if (prof.stats.haste) l.push({ label: "Class / trait Haste", value: pct(-prof.stats.haste), src: "class" });
			l.push(...enchParts("swift", (n) => `-${n}%`));
			l.push(...enchParts("focus", (n) => `-${n}% spells`));
			if (this.skillN("magic")) l.push({ label: `Magic skill ${this.skillN("magic") + 1} (spells)`, value: `-${(magicCut * 100).toFixed(1)}%`, src: "skill" });
			num("cd", "Cooldown length", `Attacks ${Math.round(atk * 100)}% · Spells ${Math.round(spl * 100)}%`, l, "100% is the verse's normal cooldown. Lower is faster. Past the old haste, swift, focus and magic knees the cut still grows, but a cooldown never hits zero.");
		}
		// Move speed
		{
			const l = [{ label: "Base", value: "118", src: "base" }];
			if (prof.stats.speed) l.push({ label: "Class / trait Agility", value: `×${bendDown(1 + prof.stats.speed / 100, 0.5, 0.05).toFixed(2)}`, src: "class" });
			l.push(...enchParts("swift_step", (n) => `×${(1 + bend(n / 100, 0.45, 0.85)).toFixed(2)}`));
			if (this.skillN("wayfinding")) l.push({ label: `Wayfinding skill ${this.skillN("wayfinding") + 1}`, value: `×${(1 + this.skillN("wayfinding") * 0.00075).toFixed(2)}`, src: "skill" });
			if (this.status.some((s) => s.id === "swift")) l.push({ label: "Swift (timed)", value: "×1.45", src: "buff" });
			num("speed", "Move speed", String(Math.round(118 * this.speedMult())), l, "Soak slows you by 38% and Hardcore exhaustion by 30%.");
		}
		// Damage taken
		{
			const wardRed = bend(this.chan("ward") / 160 + (this.buff?.ward ?? 0), 0.45, 0.8);
			const guardRed = bendSigned(prof.stats.guard / 100, -0.8, -0.5, 0.6, 0.9);
			const night = this.isNightNow() ? NIGHT.strength : 1;
			const l = [];
			if (prof.stats.guard) l.push({ label: "Class / trait Guard", value: pct(-prof.stats.guard), src: "class" });
			l.push(...enchParts("ward", (n) => `-${(n / 1.6).toFixed(1)}%`));
			l.push(...enchParts("echo_guard", (n) => `${n}% to ignore a hit`));
			l.push(...enchParts("thorns", (n) => `${n}% returned`));
			if (night > 1) l.push({ label: "Night", value: `×${night}`, src: "buff" });
			num("taken", "Damage taken", `${Math.round((1 - wardRed) * (1 - guardRed) * night * 100)}%`, l, "Before armor. Past the old knees, Ward bends toward 80% off, Guard toward 90% off (or 80% more taken), Echo Guard toward 75%, and Thorns toward 60%. None of them can reach certainty.");
		}
		// XP
		{
			const insight = bendDown(1 + prof.stats.xp / 100, 0.2, 0.05);
			const boost = 1 + this.chan("xp_boost") / 100;
			const hc = this.rules === "hardcore" ? .72 : 1;
			const night = this.isNightNow() ? NIGHT.xp : 1;
			const l = [];
			if (prof.stats.xp) l.push({ label: "Class / trait Insight", value: `×${insight.toFixed(2)}`, src: "class" });
			l.push(...enchParts("xp_boost", (n) => `×${(1 + n / 100).toFixed(2)}`));
			if (hc !== 1) l.push({ label: "Hardcore", value: "×0.72", src: "base" });
			if (night > 1) l.push({ label: "Night", value: `×${night}`, src: "buff" });
			num("xp", "Experience gained", `${Math.round(insight * boost * hc * night * 100)}%`, l);
		}
		// Kyo
		{
			const fort = bendDown(1 + prof.stats.kyo / 100, 0.2, 0.05);
			const l = [];
			if (prof.stats.kyo) l.push({ label: "Class / trait Fortune", value: `×${fort.toFixed(2)}`, src: "class" });
			l.push(...enchParts("kyo_find", (n) => `×${(1 + n / 100).toFixed(2)}`));
			num("kyo", "Kyo from kills", `${Math.round(fort * (1 + this.chan("kyo_find") / 100) * 100)}%`, l);
		}
		// Basic swing
		{
			const w = this.piece("weapon");
			const type = w?.type ?? "normal";
			const phys = 1 + (save.skills.physical.level - 1) * .02;
			const might = bendDown(1 + prof.stats.might / 100, 0.2, 0.05);
			const raw = (11 + save.level * 2.4 + (w ? equipmentStats(w).damage : 8)) * phys * this.stab(type) * (1 + this.chan("might") / 100) * might * this.offenseFactor(null, "melee");
			const l = [{ label: "Base 11 + level × 2.4 + weapon", value: String(Math.round(11 + save.level * 2.4 + (w ? equipmentStats(w).damage : 8))), src: "base" }, { label: `Physical skill ${save.skills.physical.level}`, value: `×${phys.toFixed(2)}`, src: "skill" }];
			l.push(...enchParts("might", (n) => `×${(1 + n / 100).toFixed(2)}`), ...enchParts("edge", (n) => `×${(1 + n / 100).toFixed(2)}`));
			if (prof.stats.might) l.push({ label: "Class / trait Might", value: `×${might.toFixed(2)}`, src: "class" });
			num("basic", "Basic swing (Attack key)", String(Math.round(raw)), l, "Against a neutral target. Element match, boss bane and similar apply on top.");
		}

		// Enchant / perk table
		const ids = [...new Set([...ENCHANTS.map((e) => e.id).filter((id) => gearOf(id) || acctOf(id))])];
		const bonuses = ids.map((id) => {
			const g = gearOf(id), a = acctOf(id);
			const def = ENCHANT_BY_ID[id];
			return {
				id, name: ename(id), gear: g, account: a, total: g + a,
				effect: def ? def.gear(g + a) : "",
				slots: SLOTS.map((s) => ({ slot: s, power: (this.piece(s)?.enchants ?? []).reduce((n, e) => n + (e.id === id ? e.power : 0), 0) })).filter((x) => x.power > 0),
			};
		}).sort((x, y) => y.total - x.total);

		// Verses: real numbers for every move the character can use
		const verses = {};
		for (const m of base.moves) {
			const mv = MOVE_BY_ID[m.id];
			if (!mv) continue;
			const tactic = moveTactic(mv), form = attackForm(mv);
			const rank = save.abilityRanks?.[m.id] ?? 0;
			const out = { form, acc: mv.accuracy, range: Math.round(this.playerReach(mv)), cd: Math.round(this.moveCooldown(mv) * 100) / 100, kind: "utility", hit: 0, critHit: 0, critPct: 0, heal: 0, shield: 0, rankMult: abilityMultiplier(save, m.id), shape: [], note: "" };
			if (tactic === "heal" || mv.effect === "mend") { out.kind = "heal"; out.heal = Math.floor((18 + Math.max(8, mv.power) * .45) * abilityMultiplier(save, m.id)); }
			else if (tactic === "ward") { out.kind = "ward"; out.shield = Math.floor((12 + mv.power) * abilityMultiplier(save, m.id)); }
			else if (mv.power > 0 && tactic !== "surge") {
				out.kind = "damage";
				const shapeMult = tactic === "heavy" ? 1.7 : tactic === "channel" ? 1.25 : tactic === "blink" ? .55 : tactic === "lunge" ? .72 : tactic === "dash" ? .6 : tactic === "roll" ? .36 : 1;
				const normal = this.damageParts(mv, null, { mult: shapeMult });
				const crit = this.damageParts(mv, null, { mult: shapeMult, crit: true });
				let hits = 1, each = 1;
				if (form === "ranged" && rangedStyle(mv) === "volley") { hits = 3; each = .55; }
				out.hit = Math.max(1, Math.floor(normal.dmg * each));
				out.critHit = Math.max(1, Math.floor(crit.dmg * each));
				out.critPct = Math.max(0, Math.min(100, Math.round(this.critChanceOf(mv))));
				out.shape = [{ label: "Base", value: normal.base.toFixed(1) }, ...normal.factors.map((x) => ({ label: x.label, value: `×${x.value.toFixed(2)}` }))];
				if (hits > 1) out.note = `Fires ${hits} shots, each ${out.hit}. Total ${out.hit * hits}.`;
				const ds = Math.min(100, Math.max(0, this.chan("double_strike")));
				if (ds > 0) out.note = `${out.note} ${ds}% chance to hit twice.`.trim();
				const area = verseAreaNote(mv, out.hit);
				if (area) out.note = `${out.note} ${area}`.trim();
			}
			verses[m.id] = out;
		}

		// Skills with what they currently do
		const skills = SKILLS.map((sk) => {
			const st = save.skills[sk.id];
			return { id: sk.id, name: sk.name, level: st.level, xp: st.xp, need: skillNeed(st.level), line: skillLine(sk.id, st.level), mult: aptitudeOf(save.classId, sk.id) };
		});
		const night = this.nightOn() ? { on: true, phase: this.isNightNow() ? "night" : "day", rules: `Night: foes ${NIGHT.strength}x health and damage, ${NIGHT.xp}x experience.` } : { on: false, phase: "day", rules: "Standard mode has no night." };
		return { numbers, bonuses, verses, skillsFull: skills, night };
	}
	buildSheetBase() {
		const save = this.save;
		const c = CLASS_BY_ID[save.classId];
		const prof = this.profile();
		const t = save.traitId ? TRAIT_BY_ID[save.traitId] : null;
		const cls = buffLines(c.stats, c.immune ?? []);
		const tr = t ? buffLines(t.stats, t.immune ?? []) : { buffs: [], debuffs: [] };
		const pct = (v) => `${v > 0 ? "+" : ""}${v}%`;
		const stats = Object.entries(STAT_LABEL).map(([id, l]) => ({ id, name: l.name, about: l.about, mod: prof.stats[id] ?? 0, cls: c.stats[id] ?? 0, trait: t?.stats?.[id] ?? 0, value: id === "crit" ? `${prof.stats.crit > 0 ? "+" : ""}${prof.stats.crit}` : pct(prof.stats[id] ?? 0) }));
		const effects = this.hudEffects();
		const weapon = this.piece("weapon");
		const set = this.setInfo();
		const ranks = save.abilityRanks ?? {};
		const moveIds = [...new Set([...c.starterMoves, ...Object.keys(ranks)])].filter((id) => MOVE_BY_ID[id]);
		return {
			name: save.name, classId: save.classId, className: c.name, role: c.role, type: c.type, blurb: c.blurb, specialty: c.specialty, passive: c.passive,
			female: save.female !== false, gendered: classGendered(save.classId),
			level: save.level, xp: save.xp, xpNeed: xpNeed(save.level), hp: Math.max(0, Math.ceil(save.hp)), maxHp: this.maxHp(), shield: Math.ceil(this.shield), kyo: save.kyo, skillPoints: save.skillPoints ?? 0,
			trait: t ? { id: t.id, name: t.name, about: t.about } : null,
			stats,
			buffs: [...cls.buffs, ...tr.buffs.map((b) => `${b} (trait)`)],
			debuffs: [...cls.debuffs, ...tr.debuffs.map((b) => `${b} (trait)`)],
			effects,
			aptitudes: SKILLS.map((sk) => ({ id: sk.id, name: sk.name, level: save.skills[sk.id].level, mult: aptitudeOf(save.classId, sk.id) })),
			moves: moveIds.map((id) => { const m = MOVE_BY_ID[id]; const tac = moveTactic(m); return { id, name: m.name, type: m.type, rank: ranks[id] ?? 0, tactic: tac, signature: id === c.signature, movement: ["blink", "lunge", "roll", "dash", "surge"].includes(tac), about: m.about }; }),
			gear: ["weapon", "head", "chest", "legs", "feet", "relic"].map((slot) => { const g = this.piece(slot); const st = g ? equipmentStats(g) : null; return { slot, name: g?.name ?? "Empty", quality: g?.quality ?? "", stat: st ? (st.damage ? `Damage ${st.damage}` : `Armor ${st.armor}`) : "" }; }),
			combat: [
				{ label: "Weapon damage", value: String(weapon ? equipmentStats(weapon).damage : 8) },
				{ label: "Armor", value: String(this.playerArmor()) },
				{ label: "Crit chance bonus", value: `+${prof.stats.crit + this.chan("crit_edge")}` },
				{ label: "Move speed", value: `${Math.round(118 * this.speedMult())}` },
				{ label: "Damage taken", value: `${Math.round((1 - bendSigned(prof.stats.guard / 100, -0.8, -0.5, 0.6, 0.9)) * 100)}%` },
				{ label: "Cooldowns", value: `${Math.round((1 - bendSigned(prof.stats.haste / 100, -1.5, -0.4, 0.45, 0.82)) * 100)}%` },
				{ label: "Element", value: TYPES[c.type].name },
				{ label: "Immunities", value: prof.immune.map((i) => IMMUNE_LABEL[i]).join(", ") || "None" },
				{ label: "Set", value: set.name ? `${set.name} ${set.count}/5` : "None" },
			],
			account: { level: save.accountLevel, score: save.accountScore ?? 0, perks: save.perkPoints },
		};
	}
	/** Status effects for the HUD (also used by the character sheet). */
	hudEffects() {
		const GOOD = new Set(["swift", "shell"]);
		const NAMES = { swift: "Swift (+45% speed)", shell: "Shell (-30% damage)", burn: "Burning", soak: "Soaked (slowed)", root: "Rooted", sleep: "Asleep", gloom: "Gloom (-20% damage)", silence: "Silenced", spark: "Sparked", expose: "Exposed", leech: "Drained" };
		const effects = this.status.filter((st) => st.t > 0).map((st) => st.id.startsWith(IMMUNE_PREFIX)
			? { id: st.id, label: `${HARD_CC[st.id.slice(IMMUNE_PREFIX.length)]?.name ?? "Effect"} immune`, t: Math.ceil(st.t), good: true }
			: { id: st.id, label: NAMES[st.id] ?? st.id, t: Math.ceil(st.t), good: GOOD.has(st.id) });
		if (this.buff?.t > 0) effects.push({ id: "edge", label: `Battle edge (+${this.buff.crit} crit)`, t: Math.ceil(this.buff.t), good: true });
		if (this.wardT > 0) effects.push({ id: "ward", label: "Ward (no harm)", t: Math.ceil(this.wardT), good: true });
		if (this.shield > 0) effects.push({ id: "shield", label: `Shield ${Math.ceil(this.shield)}`, t: 0, good: true });
		const auras = this.activeAuras();
		if (auras.length) effects.push({ id: "auras", label: `Auras: ${auras.map((a) => a.label).join(", ")} (−${Math.round(this.auraReserve() * 100)}% health)`, t: 0, good: true });
		return effects;
	}
	/** The verse catalog only changes when ranks change, so it keeps one identity between updates. */
	cachedAbilities() {
		const ranks = this.save?.abilityRanks ?? {};
		const key = `${JSON.stringify(ranks)}|${this.chan("reach")}|${this.chan("swift")}|${this.chan("focus")}|${JSON.stringify(getCryingConfig())}`;
		if (this.abilityKey !== key || !this.abilityCache) {
			this.abilityKey = key;
			this.abilityCache = [...MOVES, ...AURA_LIST].map((m) => {
				const rank = ranks[m.id] ?? 0;
				const tactic = moveTactic(m);
				return { ...m, rank, reachNow: Math.round(this.playerReach(m)), cdNow: Math.round(this.moveCooldown(m) * 100) / 100, now: verseValues(m, rank, tactic), next: verseValues(m, rank + 1, tactic) };
			});
		}
		return this.abilityCache;
	}
	/** Gear is mutated in place by the engine; hand the UI a new array only when something actually changed. */
	cachedGear() {
		const save = this.save;
		let sig = `${save.gear.length}|`;
		for (const g of save.gear) sig += `${g.uid}:${g.level}:${g.enchants.length}:${g.enchants.reduce((n, e) => n + e.power, 0)};`;
		if (this.gearSig !== sig || !this.gearCache) {
			this.gearSig = sig;
			this.gearCache = save.gear.slice();
		}
		return this.gearCache;
	}
	hudAt = 0;
	syncHud(force) {
		const now = performance.now();
		if (!force && now - this.hudAt < 120) return;
		this.hudAt = now;
		const save = this.save;
		if (!save) return;
		// Fast fields refresh every 120 ms. Slow fields (bag, perks, spirits, boards…) only on a real
		// change (force) or once a second. The character sheet is only built while it is on screen.
		const slow = !!force || now - (this.slowAt ?? 0) > 1000 || snap.mode !== "play";
		if (slow) this.slowAt = now;
		const sheetOpen = snap.panel === "sheet" || isPinned("panel-sheet");
		const set = this.setInfo();
		const q = QUESTS.find((d) => !save.quests[d.id]?.done) ?? QUESTS[QUESTS.length - 1];
		const region = this.customFile && (save.map === "world" || save.map.startsWith("custom-")) ? (this.mapRegion ? `${this.mapRegion.name} · ${this.customFile.name}` : this.customFile.name) : this.world && save.map === "world" ? BIOME_LABEL[biomeNameAt(this.world, save.x, save.y)] : save.map === "crypt" ? "Tiny Crypt" : save.map.startsWith("rift-") ? `Dungeon ${save.map.slice(5)}` : save.map.startsWith("custom-") ? (this.mapRegion ? `${this.mapRegion.name} · ${this.customFile?.name ?? ""}` : this.customFile?.name ?? "Custom map") : "Ash Kiln";
		const npc = NPCS.find((n) => n.id === this.talkId);
		publish({
			mode: "play",
			name: !slow ? snap.name : save.name,
			classId: !slow ? snap.classId : save.classId,
			sheet: sheetOpen && (slow || now - (this.sheetAt ?? 0) > 400) ? (this.sheetAt = now, this.buildSheet()) : snap.sheet,
			effects: this.hudEffects(),
			target: (() => {
				const mob = this.fightTarget();
				this.plateFocus = mob?.id ?? null;
				if (!mob) return null;
				return {
					name: mob.name, level: mob.level, type: mob.type, hp: Math.max(0, Math.ceil(mob.hp)), max: Math.max(1, Math.ceil(mob.max)),
					enchants: (mob.enchants ?? []).map((id) => MOB_ENCHANTS[id]?.name ?? id), boss: !!mob.boss, bounty: !!mob.bounty, hunter: !!mob.hunter, tier: mob.tier ?? 0,
					hint: bodyRead(mob.type).kind === "magic" ? "Magic hits harder" : "Physical hits harder",
				};
			})(),
			className: CLASS_BY_ID[save.classId]?.name ?? "",
			clock: this.clockInfo(),
			build: this.buildInfo(),
			race: !slow ? snap.race : save.race,
			level: save.level,
			dungeonCountdown: Math.ceil((DUNGEON_INTERVAL - (save.dungeons?.elapsed ?? 0)) / (this.turbz ? 2.5 : 1)),
			dungeonPortals: !slow ? snap.dungeonPortals : (save.dungeons?.portals ?? []).map((p) => ({ ...p })),
			skillPoints: !slow ? snap.skillPoints : save.skillPoints ?? 0,
			abilities: this.cachedAbilities(),
			xp: save.xp,
			xpNeed: xpNeed(save.level),
			hp: Math.max(0, Math.ceil(save.hp)),
			maxHp: this.maxHp(),
			shield: Math.ceil(this.shield),
			kyo: save.kyo,
			region,
			map: save.map,
			log: this.log.slice(),
			questName: !slow ? snap.questName : q.name,
			questAbout: !slow ? snap.questAbout : q.about,
			bar: save.bar.filter((id) => MOVE_BY_ID[id]).map((id) => {
				const m = MOVE_BY_ID[id];
				const form = attackForm(m);
				const tac = moveTactic(m);
				let max = Math.max(.3, .55 + m.power / 90);
				if (tac === "heavy" || tac === "channel") max *= 1.7;
				else if (form === "spell") max *= 1.35;
				return {
					id,
					name: m.name,
					type: m.type,
					cd: this.cds[id] ?? 0,
					max: this.cdMax?.[id] ?? max,
					tag: m.aura ? `${save.auras?.includes(id) ? "aura on" : "aura"} · ${m.aura.label.toLowerCase()} · ${Math.round(m.aura.reserve * 100)}% hp` : `${reactOf(m)} · ${formTag(m)}${defenseFail(m, 0) ? ` · ${defenseFail(m, 0)}% slip` : ""}`
				};
			}),
			gear: this.cachedGear(),
			equipped: !slow ? snap.equipped : Object.values(save.equipped).filter((x) => !!x),
			setLabel: !slow ? snap.setLabel : set.name ? `${set.name} ${set.count}/5` : "No set",
			setBonus: !slow ? snap.setBonus : set.on ? set.bonus : "Wear all 5 pieces of one set.",
			setCount: !slow ? snap.setCount : set.count,
			totals: !slow ? snap.totals : Object.entries([
				"head",
				"chest",
				"legs",
				"feet",
				"relic",
				"weapon"
			].reduce((acc, slot) => {
				this.piece(slot)?.enchants.forEach((e) => acc[e.id] = (acc[e.id] ?? 0) + e.power);
				return acc;
			}, {})).map(([id, power]) => ({
				id,
				name: ENCHANT_BY_ID[id]?.name ?? id,
				power
			})),
			skills: !slow ? snap.skills : SKILLS.map((sk) => ({
				id: sk.id,
				name: sk.name,
				level: save.skills[sk.id].level,
				xp: save.skills[sk.id].xp,
				need: skillNeed(save.skills[sk.id].level),
				line: skillLine(sk.id, save.skills[sk.id].level)
			})),
			bag: !slow ? snap.bag : ITEMS.filter((it) => (save.bag[it.id] ?? 0) > 0).map((it) => ({
				id: it.id,
				name: it.name,
				count: save.bag[it.id] ?? 0,
				about: it.about, useProblem: this.itemProblem(it),
				effect: healingLine(it.id, this.maxHp(), this.rules === "hardcore", this.chan("potion_sip")),
				quickable: isConsumable(it)
			})),
			quick: (save.quick ?? []).map((id) => ({ id, name: ITEM_BY_ID[id]?.name ?? id, count: save.bag[id] ?? 0 })),
			quickCd: Math.ceil(this.healCd ?? 0),
			mapQuests: !slow ? snap.mapQuests : this.mapQuestLog(),
			talk: !slow ? snap.talk : this.mapTalkSnap() ?? (npc ? {
				id: npc.id,
				name: npc.name,
				role: npc.role,
				line: npc.lines[this.talkI] ?? npc.lines[0],
				shop: npc.shop ?? null,
				shrine: npc.shrine ?? null
			} : null),
			shrine: this.shrine ? `${TYPES[this.shrine.type].name} shrine · round ${this.shrine.round}/3` : "",
			companion: !slow ? snap.companion : this.activeSpirits().filter((s) => s.hp > 0).map((s) => `${s.name} lv${s.level}`).join(", ") || "No spirits out",
			spirits: !slow ? snap.spirits : (save.spirits ?? []).map((s) => ({
				...this.ghostDetail(s, s.task ? "task" : s.active ? "out" : "party"),
				active: !!s.active,
				task: s.task ?? null,
				slots: s.slots ?? [],
				known: (s.known ?? []).map((id) => {
					const m = MOVE_BY_ID[id];
					return {
						id,
						name: m?.name ?? id,
						about: m?.about ?? "",
						type: m?.type ?? s.type,
						player: m ? spiritAidsPlayer(m) : false,
						slotted: (s.slots ?? []).includes(id)
					};
				})
			})),
			spiritSlots: this.spiritCap(),
			spiritCap: PARTY_MAX,
			ghostStore: !slow ? snap.ghostStore : (save.ghostStore ?? []).map((g) => ({ uid: g.uid, name: g.name, type: g.type, level: g.level, rarity: g.rarity ?? 0, shiny: !!g.shiny, tagged: !!g.tagged, palette: g.shiny ? g.palette ?? DEFAULT_PALETTE : null, abilities: (g.abilities ?? []).map((a) => GHOST_ABILITY_BY_ID[a.id]?.name ?? a.id) })),
			ghostInspect: !slow ? snap.ghostInspect : (() => { const g = this.inspectUid ? (save.ghostStore ?? []).find((x) => x.uid === this.inspectUid) : null; return g ? this.ghostDetail(g, g.tagged ? "tagged" : "box") : null; })(),
			ghostBonus: !slow ? snap.ghostBonus : this.ghostBonusView(),
			ghostBox: { placed: !!save.ghostBox, near: this.nearGhostBox(), max: GHOST_STORE_MAX },
			chest: this.chestView(),
			wildGhost: this.wildView(),
			lms: this.lmsView?.() ?? null,
			jarLeft: Math.ceil(save.jarLeft ?? 0),
			accountScore: !slow ? snap.accountScore : save.accountScore ?? 0,
			turn: this.duel ? (this.duel.phase === "yours" ? "Your verse" : `${this.duel.lead?.name ?? "They"} readies`) : this.turnQ[0] ? (this.turnQ[0].side === "you" ? "Your turn" : this.turnQ[0].side === "spirit" ? "Spirit" : "Enemy") : "",
			survival: this.rules === "hardcore" ? { ...save.survival, campfires: save.survival.campfires.slice(), logs: save.survival.logs.slice() } : null,
			nearTree: !!this.nodeNear("tree", 64),
			nearCamp: this.nearCamp(), nearBed: this.rules === "hardcore" && !!this.bedNear(), nearWater: waterWithinReach(this.world, save.x, save.y), sleeping: !!this.sleeping,
			rules: !slow ? snap.rules : this.rules === "hardcore" ? "hardcore" : "hunt",
			duel: this.duel ? {
				phase: this.duel.phase === "yours" ? "yours" : "answer",
				attacker: this.duel.lead?.name ?? "",
				move: MOVE_BY_ID[this.duel.moveId]?.name ?? "",
				about: MOVE_BY_ID[this.duel.moveId]?.about ?? "",
				beat: this.duel.beat ?? ""
			} : null,
			box: !slow ? snap.box : save.box.map((p) => `${MONSTER_BY_ID[p.species]?.name ?? "Spirit"} lv ${p.level}`),
			known: !slow ? snap.known : save.known.map((id) => ({
				id,
				name: MOVE_BY_ID[id]?.name ?? id,
				type: MOVE_BY_ID[id]?.type ?? "normal"
			})),
			stash: !slow ? snap.stash : save.stash.map((e) => `${ENCHANT_BY_ID[e.id]?.name ?? e.id} ${e.power}`),
			selected: this.selected,
			chat: this.chat.slice(),
			trade: !slow ? snap.trade : this.trade ? {
				open: true,
				peer: this.remotes.get(this.trade.peer)?.name ?? "Hunter",
				mine: this.trade.mine.map((id) => save.gear.find((g) => g.uid === id)?.name ?? id).join(", ") || "—",
				theirs: this.trade.theirsGear.map((g) => g.name).join(", ") || "—",
				me: this.trade.me,
				them: this.trade.them
			} : null,
			stock: !slow ? snap.stock : this.shopStock.map((g) => ({
				uid: g.uid,
				name: g.name,
				price: this.price(g.price),
				type: TYPES[g.type].name
			})),
			wares: !slow ? snap.wares : [
				"potion",
				"big_potion",
				"ghost_jar",
				"cleanse_salt",
				"spirit_candy",
				"smoke_bomb", ...(this.rules === "hardcore" ? ["trail_ration", "cooked_meat"] : [])
			].map((id) => ({
				id,
				name: ITEM_BY_ID[id].name,
				price: this.price(ITEM_BY_ID[id].price)
			})),
			net: snap.net,
			roomCode: snap.roomCode,
			peers: snap.peers,
			aim: this.castLock > 0 ? "Casting..." : this.channel ? (this.channel.kind === "fishing" ? "Fishing..." : "Gathering...") : "Press E beside a node or the water. Right-click for menus.",
			hint: this.hint,
			foe: (() => {
				const mob = this.fightTarget();
				if (!mob) return "";
				const read = bodyRead(mob.type);
				return `${mob.name} · Lv ${mob.level} · ${TYPES[mob.type].name} · ${Math.ceil(mob.hp)}/${Math.ceil(mob.max)} · ${read.kind === "magic" ? "magic hits harder" : "physical hits harder"}`;
			})(),
			menu: this.menu,
			mapX: save.x,
			mapY: save.y,
			party: !slow ? snap.party : (save.party ?? []).map((id) => NPCS.find((n) => n.id === id)?.name ?? id),
			autoplay: this.autoplay,
			autoCombat: !!this.autoCombat,
			gimmick: this.gim?.view() ?? null,
			grind: this.autoplay ? this.grind : "",
			pools: this.turbz && this.pools ? {
				mana: Math.ceil(this.pools.mana), maxMana: this.pools.maxMana,
				stam: Math.ceil(this.pools.stam), maxStam: this.pools.maxStam,
				manaSlow: Math.ceil(this.pools.manaSlow), stamSlow: Math.ceil(this.pools.stamSlow),
			} : null,
			orders: (this.turbz || this.autoplay) && this.orders && !Array.isArray(this.orders) ? [
				{ id: "combat", label: "Fight", on: !!this.orders.combat },
				{ id: "mining", label: "Mine ore", on: !!this.orders.mining },
				{ id: "woodcutting", label: "Chop wood", on: !!this.orders.woodcutting },
				{ id: "fishing", label: "Fish", on: !!this.orders.fishing },
				{ id: "shroom", label: "Forage", on: !!this.orders.shroom },
				{ id: "crafting", label: "Craft", on: !!this.orders.crafting },
				{ id: "spirits", label: "Seek spirits", on: !!this.orders.spirits },
				{ id: "dungeon", label: "Dungeons", on: !!this.orders.dungeon },
			] : null,
			turbz: this.turbz ? {
				witches: (this.save?.map === "custom-turbz" ? this.mobs : (this.turbzRoster ?? this.mobs)).filter((m) => m.twitch && m.alive).length,
				back: Math.ceil(Math.min(...((this.witchGraves ?? []).length ? this.witchGraves : [0]))),
			} : null,
			accountLevel: !slow ? snap.accountLevel : save.accountLevel,
			accountXp: !slow ? snap.accountXp : save.accountXp,
			accountNeed: !slow ? snap.accountNeed : accountNeed(save.accountLevel),
			perkPoints: !slow ? snap.perkPoints : save.perkPoints,
			perks: !slow ? snap.perks : ENCHANTS.filter((def) => def.perk).map((def) => ({
				id: def.id,
				name: def.name,
				power: save.perks[def.id] ?? 0,
				max: def.perk.max,
				step: def.perk.step,
				cat: def.cat ?? "combat",
				about: perkText(def, save.perks[def.id] ?? 0)
			})),
			bounty: (() => {
				const mark = this.liveBounty();
				if (!mark) return "";
				const cls = mark.classId ? CLASS_BY_ID[mark.classId]?.name : "";
				const spirits = (this.contract ?? []).filter((m) => m.bountySpirit && m.master === mark.id && m.alive).length;
				const left = Math.max(0, Math.ceil(mark.huntIn));
				const clock = mark.enraged || mark.huntIn <= 0
					? "hunting you · twice as strong"
					: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} to find them`;
				return `${mark.name}${cls ? ` the ${cls}` : ""} · Lv ${mark.level} · ${spirits} spirits · ${clock}`;
			})(),
			bountyPlace: (() => {
				const mark = this.liveBounty();
				if (!mark || !this.save) return "";
				if (mark.map && mark.map !== this.save.map) return mark.enraged ? "Closing in from another place" : "Still out there. The clock is running.";
				const tiles = Math.max(1, Math.round(Math.hypot(mark.x - this.save.x, mark.y - this.save.y) / 32));
				const dir = this.compass(mark.x - this.save.x, mark.y - this.save.y);
				let where = "";
				if (this.world && mark.map === this.save.map) {
					const biome = biomeNameAt(this.world, mark.x, mark.y);
					where = BIOME_LABEL[biome] ? ` · ${BIOME_LABEL[biome]}` : "";
				}
				return `${dir} · ${tiles} tiles${where}`;
			})(),
			bounties: this.liveBounties().map((mark) => {
				const cls = mark.classId ? CLASS_BY_ID[mark.classId]?.name : "";
				const left = Math.max(0, Math.ceil(mark.huntIn));
				const clock = mark.enraged || mark.huntIn <= 0 ? "hunting you" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
				const where = mark.map && mark.map !== save.map ? "elsewhere" : `${this.compass(mark.x - save.x, mark.y - save.y)} ${Math.max(1, Math.round(Math.hypot(mark.x - save.x, mark.y - save.y) / 32))} tiles`;
				return `★${mark.tier ?? 1} ${mark.name}${cls ? ` the ${cls}` : ""} · Lv ${mark.level} · ${clock} · ${where}`;
			}),
			bountyBoard: !slow ? snap.bountyBoard : (save.hunt?.board ?? []).map((p) => {
				const live = this.liveBounties().find((m) => m.postingId === p.id);
				return {
					id: p.id,
					name: p.name,
					className: CLASS_BY_ID[p.classId]?.name ?? "Hunter",
					tier: p.tier,
					level: live?.level ?? save.level + p.levelBonus,
					kyo: live?.lootKyo ?? bountyKyo(save.level, p.tier),
					active: !!live,
					status: !live ? "Posted" : live.enraged || live.huntIn <= 0 ? "Hunting you" : `Hunting · ${Math.floor(Math.ceil(live.huntIn) / 60)}:${String(Math.ceil(live.huntIn) % 60).padStart(2, "0")} left`,
				};
			}),
			hunt: {
				tier: save.hunt?.tier ?? 0,
				kills: save.hunt?.kills ?? 0,
				stars: save.hunt?.stars ?? 0,
				need: BOUNTY_STARS_NEEDED,
				wanted: save.hunt?.wanted ?? 0,
				waveIn: Math.ceil(save.hunt?.waveIn ?? 0),
				hunters: this.liveHunters().length,
				clearCost: clearNameCost(save.level, Math.max(1, save.hunt?.wanted ?? 1)),
				starsOn: (save.hunt?.kills ?? 0) >= 1,
			},
			loot: !slow ? snap.loot : save.pendingLoot ? {
				title: save.pendingLoot.title,
				kyo: save.pendingLoot.kyo,
				items: save.pendingLoot.items.map((it) => ({ name: ITEM_BY_ID[it.id]?.name ?? it.id, count: it.count })),
				gear: save.pendingLoot.gear,
			} : null,
			locked: !slow ? snap.locked : save.locked ?? [],
			sellMult: !slow ? snap.sellMult : this.sellMult(),
			unstuck: this.unstuckT > 0 ? Math.ceil(this.unstuckT) : 0,
			hover: this.hoverCard(),
			unlocked: !slow ? snap.unlocked : this.unlockedSets(),
			setProgress: !slow ? snap.setProgress : this.setProgress()
		});
	}
	draw() {
		const { w, h, dpr } = this.cssSize();
		const ctx = this.ctx;
		// Menus draw a quiet backdrop once instead of repainting every frame.
		if (!this.world || !this.save || snap.mode !== "play") {
			const key = `${w}x${h}x${dpr}`;
			if (this.menuDrawn === key) return;
			this.menuDrawn = key;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.fillStyle = "#140e0c";
			ctx.fillRect(0, 0, w, h);
			ctx.fillStyle = "#1b1310";
			for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < w; x += 64) ctx.fillRect(x, y, 32, 32);
			return;
		}
		this.menuDrawn = "";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = "#140e0c";
		ctx.fillRect(0, 0, w, h);
		const sx = (Math.random() - .5) * this.shake;
		const sy = (Math.random() - .5) * this.shake;
		ctx.translate(w / 2 + sx, h / 2 + sy);
		ctx.scale(this.zoom, this.zoom);
		ctx.translate(-this.cam.x, -this.cam.y);
		ctx.imageSmoothingEnabled = false;
		if (this.world.cache) ctx.drawImage(this.world.cache, 0, 0);
		else drawWorldSlice(ctx, this.world, this.cam.x, this.cam.y, w, h, this.zoom);
		const save = this.save;
		this.gim?.drawUnder(ctx, this.clock);
		if (save.map === "world") for (const p of POIS) {
			const pos = poiPos(p);
			if (!pos) continue;
			if (Math.abs(pos.x - this.cam.x) > w / this.zoom * 0.62 + 160 || Math.abs(pos.y - this.cam.y) > h / this.zoom * 0.62 + 200) continue;
			// On the main world (a map file) the classic shrines and doors are drawn live, not baked into a cache.
			if (this.customFile && (p.kind === "shrine" || p.kind === "dungeon")) {
				const at = scaleTile(p.tx, p.ty);
				if (p.kind === "shrine") paintArena(ctx, at.tx * 32 + 16, at.ty * 32 + 28);
				else { drawRift(ctx, at.tx * 32 + 16, at.ty * 32 + 28); drawShadowName(ctx, p.name.toUpperCase(), at.tx * 32 + 16, at.ty * 32 - 100, "#e7d9ff"); }
			}
			if (p.kind === "npc") {
				const npc = NPCS.find((n) => n.id === p.id);
				drawActor(ctx, {
					x: pos.x,
					y: pos.y,
					race: "vesper",
					npcId: npc.id,
					female: npc.female,
					hair: npc.hair,
					skin: npc.outfit % 5,
					facing: 1,
					walk: .2,
					attack: 0,
					hurt: 0,
					pieces: [
						{
							slot: "chest",
							style: npc.outfit,
							type: "normal",
							fxSeed: 0,
							quality: 0
						},
						{
							slot: "legs",
							style: npc.outfit,
							type: "normal",
							fxSeed: 1,
							quality: 0
						},
						{
							slot: "feet",
							style: npc.outfit,
							type: "normal",
							fxSeed: 2,
							quality: 0
						}
					],
					setFx: null,
					setOn: false,
					time: this.clock
				});
				drawShadowName(ctx, npc.name.split(" ").slice(-1)[0], pos.x, pos.y - 44, "#f0e2c8");
			}
		}
		if (this.customFile) this.drawMapPlaces(ctx);
		if (save.map !== "world" && !save.map.startsWith("custom-")) {
			const ex = this.dungeonExitAt();
			drawRift(ctx, ex.x, ex.y + 8);
			drawShadowName(ctx, "EXIT", ex.x, ex.y - 130, "#e7d9ff");
		}
		if (save.map === "world" || save.map === "custom-turbz") for (const portal of save.dungeons?.portals ?? []) {
			if (portal.cleared) continue;
			drawRift(ctx, portal.x, portal.y);
			drawShadowName(ctx, `DUNGEON ${portal.id.slice(5)}`, portal.x, portal.y - 100, "#e7d9ff");
		}
		if (this.rules === "hardcore") for (const fire of save.survival.campfires) {
			if (fire.map !== save.map) continue;
			// Small pixel flame and crossed logs use the same pixel scale as world art.
			ctx.fillStyle = "#68412d"; ctx.fillRect(fire.x - 12, fire.y - 4, 24, 6); ctx.fillRect(fire.x - 8, fire.y - 8, 16, 6);
			ctx.fillStyle = "#df582a"; ctx.fillRect(fire.x - 8, fire.y - 20, 16, 14); ctx.fillRect(fire.x - 4, fire.y - 26, 8, 6);
			ctx.fillStyle = "#ffc45b"; ctx.fillRect(fire.x - 4, fire.y - 16, 8, 10);
			drawShadowName(ctx, "CAMP", fire.x, fire.y - 40, "#ffc45b");
		}
		if (this.rules === "hardcore") this.drawBuild(ctx, w, h);
		this.drawExtras(ctx, w, h);
		for (const node of this.world.spawns) if (node.kind === "node") {
			if (Math.abs(node.x - this.cam.x) > w / this.zoom * 0.62 + 96 || Math.abs(node.y - this.cam.y) > h / this.zoom * 0.62 + 128) continue;
			// No label: you find out what a node is by walking up to it (the "E  Chop / Mine / Forage" prompt).
			paintNode(ctx, node.node, node.x, node.y + 2);
		}
		for (const m of this.mobs) {
			if (!m.alive) continue;
			if (Math.abs(m.x - this.cam.x) > w / this.zoom * 0.62 + 140) continue;
			if (Math.abs(m.y - this.cam.y) > h / this.zoom * 0.62 + 160) continue;
			if ((m.bounty || m.witch) && (m.classId || m.race)) {
				const cls = m.classId ? CLASS_BY_ID[m.classId] : null;
				const raceId = m.race ?? (cls ? CLASS_RACE[cls.id] : null) ?? "vesper";
				const rr = RACES.find((r) => r.id === raceId) ?? RACES[0];
				const qualities = ["worn", "common", "fine", "rare", "epic", "legendary"];
				drawActor(ctx, {
					x: m.x,
					y: m.y,
					race: raceId,
					classId: m.classId,
					direction: m.direction ?? "down",
					moving: !!m.moving,
					female: m.female !== false,
					hair: rr?.hair ?? 0,
					skin: 2,
					facing: m.facing,
					walk: m.walk,
					attack: m.swing > 0 ? .4 : 0,
					hurt: m.hurt,
					tall: rr?.tall ?? 1,
					time: this.clock,
					pieces: (m.lootGear ?? []).map((g) => ({
						slot: g.slot,
						style: g.style,
						type: g.type,
						fxSeed: g.fxSeed,
						gene: geneSeedOf(g),
						quality: Math.max(0, qualities.indexOf(g.quality))
					})),
					setFx: null,
					setOn: false
				});
			} else {
				const gfx = m.enemyGhost ? { x: m.x, y: m.y, type: m.type, rarity: m.rarity, level: m.level, speed: m.speed, max: m.max, shiny: !!m.shiny, seed: m.id, palette: m.palette } : null;
				if (gfx) drawGhostFx(ctx, gfx, this.clock, "back");
				drawMonster(ctx, {
				x: m.x,
				y: m.y,
				template: m.template,
				type: m.type,
				facing: m.facing,
				walk: m.walk,
				hurt: m.hurt,
				boss: m.boss,
				rarity: m.rarity,
				ghost: !!m.ghost,
				shiny: !!m.shiny,
				palette: m.palette,
				animal: !!m.animal,
				// Witch and bounty ghosts wear the same ghost body as yours.
				species: m.enemyGhost ? undefined : m.species,
				look: m.look ?? null,
				time: this.clock
				});
				if (gfx) drawGhostFx(ctx, gfx, this.clock, "front");
			}
			this.queuePlate(m);
		}
		if (save.map === "world") for (const tavern of TAVERNS) {
			const x = tavern.boardTx * 32 + 16;
			const y = tavern.boardTy * 32 + 16;
			ctx.fillStyle = "#3a221c";
			ctx.fillRect(x - 6, y - 18, 12, 16);
			ctx.fillStyle = "#e6c15a";
			ctx.fillRect(x - 5, y - 16, 10, 8);
			drawShadowName(ctx, "BOARD", x, y - 28, "#e6c15a");
		}
		const race = RACES.find((r) => r.id === save.race);
		const set = this.setInfo();
		const pieces = [
			"weapon",
			"head",
			"chest",
			"legs",
			"feet",
			"relic"
		].map((slot) => this.piece(slot)).filter((g) => !!g).map((g) => ({
			slot: g.slot,
			style: g.style,
			type: g.type,
			fxSeed: g.fxSeed,
			gene: geneSeedOf(g),
			quality: [
				"worn",
				"common",
				"fine",
				"rare",
				"epic",
				"legendary"
			].indexOf(g.quality)
		}));
		const homeAway = this.holdActive() && !this.holdHere();
		if (!homeAway) this.activeSpirits().forEach((spirit, i) => {
			const at = this.mates[i];
			if (!at || spirit.hp <= 0) return;
			const gfx = { x: at.x, y: at.y, type: spirit.type, rarity: spirit.rarity, level: spirit.level, speed: spirit.speed, max: spirit.max, shiny: !!spirit.shiny, seed: spirit.uid, palette: spirit.palette };
			drawGhostFx(ctx, gfx, this.clock, "back");
			drawMonster(ctx, {
				x: at.x,
				y: at.y,
				template: spirit.template,
				type: spirit.type,
				facing: at.facing ?? this.facing,
				walk: this.walk + i,
				hurt: at.swing > 0 ? 0.2 : 0,
				boss: false,
				rarity: spirit.rarity,
				ghost: true,
				shiny: !!spirit.shiny,
				palette: spirit.palette,
				spin: at.spin ?? 0,
				look: spirit.look,
				time: this.clock
			});
			drawGhostFx(ctx, gfx, this.clock, "front");
			drawShadowName(ctx, spirit.shiny ? `✦ ${spirit.name}` : spirit.name, at.x, at.y - ghostNameLift(spirit), spirit.shiny ? (shinyPalette(spirit.palette).kind === "rainbow" ? `hsl(${(this.clock * 120) % 360},90%,70%)` : shinyPalette(spirit.palette).badge) : TYPES[spirit.type].color);
		});
		if (!homeAway) for (const id of save.party ?? []) {
			const npc = NPCS.find((n) => n.id === id);
			if (!npc) continue;
			const px = this.mateCd[`mate-${id}x`] ?? save.x + 20;
			const py = this.mateCd[`mate-${id}y`] ?? save.y + 8;
			drawActor(ctx, {
				x: px,
				y: py,
				race: "vesper",
				npcId: npc.id,
				direction: this.mateDirections[id] ?? "down",
				female: npc.female,
				hair: npc.hair,
				skin: npc.outfit % 5,
				facing: this.facing,
				walk: this.walk,
				attack: 0,
				hurt: 0,
				pieces: [
					{
						slot: "chest",
						style: npc.outfit,
						type: npc.shrine ?? "normal",
						fxSeed: 2,
						quality: 2
					},
					{
						slot: "legs",
						style: npc.outfit,
						type: "normal",
						fxSeed: 1,
						quality: 1
					},
					{
						slot: "feet",
						style: npc.outfit,
						type: "normal",
						fxSeed: 0,
						quality: 1
					}
				],
				setFx: null,
				setOn: false,
				time: this.clock,
				scale: 1
			});
			drawShadowName(ctx, npc.name.split(" ").slice(-1)[0], px, py - 58, "#9ad8c8");
		}
		for (const r of this.remotes.values()) {
			if (r.map !== save.map) continue;
			const rr = RACES.find((x) => x.id === r.race);
			drawActor(ctx, {
				x: r.x,
				y: r.y,
				race: r.race,
				classId: r.classId,
				direction: r.direction,
				female: r.female !== false,
				hair: rr.hair,
				skin: 0,
				facing: r.facing,
				walk: 1,
				attack: 0,
				hurt: 0,
				tall: rr.tall,
				pieces: r.pieces.map((g) => ({
					slot: g.slot,
					style: g.style,
					type: g.type,
					fxSeed: g.fxSeed,
						gene: geneSeedOf(g),
					quality: Math.max(0, ["worn", "common", "fine", "rare", "epic", "legendary"].indexOf(g.quality))
				})),
				setFx: null,
				setOn: false,
				time: this.clock
			});
			drawShadowName(ctx, r.name, r.x, r.y - 44, "#e6c15a");
		}
		const formDrawn = !!this.gim?.drawForm(ctx, { x: save.x, y: save.y, direction: this.direction, moving: this.moving && !this.dead, walk: this.walk, facing: this.facing, hurt: this.hurt, time: this.clock });
		if (this.gim?.active("phase")) ctx.globalAlpha = 0.5 + Math.sin(this.clock * 5) * 0.1;
		if (this.gim?.active("flight")) ctx.translate(0, -10);
		if (!formDrawn) drawActor(ctx, {
			x: save.x,
			y: save.y,
			race: save.race,
			classId: save.classId,
			direction: this.direction,
			moving: this.moving && !this.dead && snap.panel !== "pause",
			female: save.female !== false,
			hair: race.hair,
			skin: RACES.findIndex((r) => r.id === save.race),
			facing: this.facing,
			walk: this.walk,
			attack: this.attackT,
			hurt: this.hurt,
			tall: race.tall,
			pieces,
			setFx: set.fx,
			setOn: set.on,
			setVariant: set.variant,
			time: this.clock,
			scale: 1
		});
		ctx.globalAlpha = 1;
		if (this.gim?.active("flight")) ctx.translate(0, 10);
		this.gim?.drawOver(ctx, this.clock);
		if (this.sleeping && this.sleepBed) {
			// Tucked in: the bed's blanket covers you while you sleep in it.
			const bx = this.sleepBed.tx * 32, by = this.sleepBed.ty * 32;
			ctx.fillStyle = "#8e3a3a"; ctx.fillRect(bx + 4, by + 14, 24, 14);
			ctx.fillStyle = "#a94848"; ctx.fillRect(bx + 4, by + 14, 24, 3);
			ctx.fillStyle = "#6e2c2c"; for (let i = 0; i < 3; i++) ctx.fillRect(bx + 8 + i * 7, by + 20, 3, 1);
			ctx.fillStyle = "#5a3820"; ctx.fillRect(bx + 3, by + 26, 26, 3);
		}
		if (!this.dead && !this.sleeping) this.drawTinies(ctx);
		const barOn = this.combat > 0 || this.wardT > 0;
		const head = save.y - 98;
		const nameY = barOn ? head - 14 : head + 2;
		drawShadowName(ctx, save.name, save.x, nameY, "#fff6e8");
		if (this.unstuckT > 0 && this.mouseWorld) {
			const spot = nearestOpen(this.world, this.mouseWorld.x, this.mouseWorld.y);
			ctx.strokeStyle = "#e6c15a";
			ctx.lineWidth = 2;
			ctx.strokeRect(spot.x - 12, spot.y - 12, 24, 24);
			drawShadowName(ctx, `UNSTUCK ${Math.ceil(this.unstuckT)}`, spot.x, spot.y - 22, "#e6c15a");
		}
		if (!this.channel && !this.dead && !this.sleeping) {
			const node = this.nodeNear(null, 56);
			const prompt = node ? (node.node === "ore" ? "E  Mine" : node.node === "tree" ? "E  Chop" : "E  Forage") : nearestWaterTile(this.world, save.x, save.y, 64) ? "E  Fish" : "";
			if (prompt) drawShadowName(ctx, prompt, save.x, nameY - 16, "#e6c15a");
		}
		if (this.combat > 0 || this.wardT > 0) {
			const pct = Math.max(0, save.hp / this.maxHp());
			const barY = head;
			ctx.fillStyle = "#140e0c";
			ctx.fillRect(save.x - 23, barY, 46, 7);
			ctx.fillStyle = "#3a1414";
			ctx.fillRect(save.x - 22, barY + 1, 44, 5);
			ctx.fillStyle = pct < 0.3 ? "#ff4d4d" : "#c4473a";
			ctx.fillRect(save.x - 22, barY + 1, Math.round(44 * pct), 5);
			ctx.fillStyle = "rgba(255,255,255,.3)";
			ctx.fillRect(save.x - 22, barY + 1, Math.round(44 * pct), 1);
			if (this.wardT > 0) {
				ctx.strokeStyle = "#fff1a8";
				ctx.lineWidth = 2;
				ctx.strokeRect(save.x - 25, barY - 2, 50, 11);
			}
			let markY = nameY - 16;
			const chain = this.meleeChain;
			if (chain && (chain.n > 0 || chain.recover > 0)) {
				for (let i = 0; i < 3; i++) {
					ctx.fillStyle = chain.recover > 0 ? "#5a4038" : i < chain.n ? "#e6c15a" : "#2a211c";
					ctx.fillRect(save.x - 16 + i * 12, markY, 8, 4);
				}
				markY -= 8;
			}
			const weave = this.weave;
			if (weave && (weave.types.length > 0 || weave.focus > 8 || (this.overcastT ?? 0) > 0)) {
				weave.types.forEach((t, i) => {
					ctx.fillStyle = TYPES[t]?.color ?? "#c9a6e8";
					ctx.fillRect(save.x - 14 + i * 8, markY, 6, 6);
				});
				const focus = Math.max(0, Math.min(1, (weave.focus ?? 0) / 100));
				ctx.fillStyle = "#1a1214";
				ctx.fillRect(save.x - 14, markY - 3, 28, 2);
				ctx.fillStyle = (this.overcastT ?? 0) > 0 || focus >= 1 ? "#fff1a8" : "#6a4cff";
				ctx.fillRect(save.x - 14, markY - 3, Math.round(28 * ((this.overcastT ?? 0) > 0 ? 1 : focus)), 2);
			}
		}
		for (const p of this.parts) {
			ctx.globalAlpha = Math.max(0, p.life / p.max);
			ctx.fillStyle = p.color;
			ctx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.size, p.size);
		}
		ctx.globalAlpha = 1;
		this.cfx?.draw(ctx, this.clock);
		ctx.globalAlpha = 1;
		// Nameplates and combat text are drawn in screen space: crisp and readable at any zoom.
		const m = ctx.getTransform();
		const toScreen = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		// Text scale: grows a little with zoom, never smaller than 1.25x so it stays readable.
		const k = Math.max(1, Math.round(dpr * Math.min(2, Math.max(1.25, this.zoom * 0.9)) * 4) / 4);
		drawPlates(ctx, this.plates ?? [], toScreen, k);
		this.plates = [];
		drawFloats(ctx, this.floats, toScreen, k);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.drawNight(ctx, w, h);
		this.drawPinArrow(ctx, toScreen, dpr);
		if (this.channel || this.castLock > 0) {
			const p = this.channel ? this.channel.t / this.channel.need : 1 - this.castLock / Math.max(.05, this.castLockMax);
			ctx.fillStyle = "#1a1214";
			ctx.fillRect(w / 2 - 46, h / 2 - 78, 92, 6);
			ctx.fillStyle = this.castLock > 0 ? "#e6c15a" : "#f0e2c8";
			ctx.fillRect(w / 2 - 46, h / 2 - 78, 92 * Math.max(0, Math.min(1, p)), 6);
		}
	}
	paintLog(ctx, x, y) {
		ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(x + 2, y + 27, 30, 4);
		for (let i = 0; i < 4; i++) {
			const by = y + 2 + i * 7;
			ctx.fillStyle = "#4a2e1a"; ctx.fillRect(x + 1, by, 30, 7);
			ctx.fillStyle = i % 2 ? "#8a5a34" : "#9a6a3c"; ctx.fillRect(x + 2, by + 1, 28, 5);
			ctx.fillStyle = "#6b4528"; ctx.fillRect(x + 2, by + 4, 28, 2);
			ctx.fillStyle = "#d2a566"; ctx.fillRect(x + 1, by + 1, 5, 5);
			ctx.fillStyle = "#a97a45"; ctx.fillRect(x + 3, by + 3, 2, 2);
		}
	}
	paintBrick(ctx, x, y) {
		ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(x + 2, y + 27, 30, 4);
		ctx.fillStyle = "#3a2622"; ctx.fillRect(x, y, 32, 30);
		for (let r = 0; r < 5; r++) {
			const by = y + 1 + r * 6;
			const off = r % 2 ? 0 : -6;
			for (let c = -1; c < 4; c++) {
				const bx = x + 1 + off + c * 11;
				const x0 = Math.max(x + 1, bx), x1 = Math.min(x + 31, bx + 10);
				if (x1 <= x0) continue;
				ctx.fillStyle = (r + c) % 3 === 0 ? "#9c4a36" : (r + c) % 3 === 1 ? "#b35a40" : "#8a4030";
				ctx.fillRect(x0, by, x1 - x0, 5);
				ctx.fillStyle = "#cf7a5a"; ctx.fillRect(x0, by, x1 - x0, 1);
			}
		}
	}
	paintBed(ctx, x, y) {
		ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x + 3, y + 26, 28, 4);
		ctx.fillStyle = "#5a3820"; ctx.fillRect(x + 3, y + 4, 26, 24);
		ctx.fillStyle = "#8a5a34"; ctx.fillRect(x + 4, y + 5, 24, 22);
		ctx.fillStyle = "#efe6d2"; ctx.fillRect(x + 6, y + 6, 20, 6);
		ctx.fillStyle = "#b8a88c"; ctx.fillRect(x + 6, y + 11, 20, 1);
		ctx.fillStyle = "#8e3a3a"; ctx.fillRect(x + 5, y + 13, 22, 13);
		ctx.fillStyle = "#a94848"; ctx.fillRect(x + 5, y + 13, 22, 3);
		ctx.fillStyle = "#6e2c2c"; for (let i = 0; i < 3; i++) ctx.fillRect(x + 8 + i * 7, y + 18, 3, 1);
	}
	paintGhostBox(ctx, x, y, t) {
		const glow = .55 + Math.sin(t * 2.2) * .25;
		ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(x + 2, y + 27, 28, 4);
		ctx.fillStyle = `rgba(180,166,255,${glow * .25})`; ctx.beginPath(); ctx.arc(x + 16, y + 14, 20, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = "#231a33"; ctx.fillRect(x + 3, y + 8, 26, 20);
		ctx.fillStyle = "#3b2d55"; ctx.fillRect(x + 4, y + 9, 24, 18);
		ctx.fillStyle = "#4c3a6e"; ctx.fillRect(x + 2, y + 4, 28, 7);
		ctx.fillStyle = "#e6c15a"; ctx.fillRect(x + 14, y + 10, 4, 5);
		ctx.fillStyle = `rgba(200,180,255,${glow})`;
		ctx.fillRect(x + 7, y + 16, 2, 6); ctx.fillRect(x + 23, y + 16, 2, 6); ctx.fillRect(x + 11, y + 20, 10, 2);
		ctx.fillStyle = "#e7d9ff"; ctx.fillRect(x + 15, y + 1 - Math.sin(t * 3) * 2, 2, 2);
	}
	/** World-space pass: the Ghost Box, loot chests and attack telegraphs. */
	drawExtras(ctx, w, h) {
		const save = this.save;
		const halfW = w / this.zoom * 0.6 + 64, halfH = h / this.zoom * 0.6 + 64;
		const box = save.ghostBox;
		if (box && box.map === save.map && Math.abs(box.tx * 32 + 16 - this.cam.x) < halfW && Math.abs(box.ty * 32 + 16 - this.cam.y) < halfH) {
			this.paintGhostBox(ctx, box.tx * 32, box.ty * 32, this.clock);
			drawShadowName(ctx, `GHOST BOX · ${save.ghostStore?.length ?? 0}`, box.tx * 32 + 16, box.ty * 32 - 10, "#c9a6e8");
		}
		for (const c of save.chests ?? []) {
			if (c.map !== save.map || Math.abs(c.x - this.cam.x) > halfW || Math.abs(c.y - this.cam.y) > halfH) continue;
			this.paintChest(ctx, c);
		}
		for (const g of save.wildGhosts ?? []) {
			if (g.map !== save.map || Math.abs(g.x - this.cam.x) > halfW || Math.abs(g.y - this.cam.y) > halfH) continue;
			this.paintWildGhost(ctx, g);
		}
		this.drawTelegraphs(ctx);
	}
	/** World-space pass: placed logs, safe zone outlines and the build cursor. */
	drawBuild(ctx, w, h) {
		const save = this.save;
		const sv = save.survival;
		if (!sv) return;
		const halfW = w / this.zoom * 0.6 + 64, halfH = h / this.zoom * 0.6 + 64;
		for (const l of sv.logs) {
			if (l.map !== save.map) continue;
			const x = l.tx * 32, y = l.ty * 32;
			if (Math.abs(x + 16 - this.cam.x) > halfW || Math.abs(y + 16 - this.cam.y) > halfH) continue;
			if (l.kind === "brick") this.paintBrick(ctx, x, y);
			else this.paintLog(ctx, x, y);
		}
		for (const b of sv.beds ?? []) {
			if (b.map !== save.map) continue;
			const x = b.tx * 32, y = b.ty * 32;
			if (Math.abs(x + 16 - this.cam.x) > halfW || Math.abs(y + 16 - this.cam.y) > halfH) continue;
			this.paintBed(ctx, x, y);
		}
		const inside = this.playerSafeCamp();
		ctx.save();
		for (const c of sv.campfires) {
			if (c.map !== save.map) continue;
			const r = zoneRect(c);
			if (r.x1 < this.cam.x - halfW || r.x0 > this.cam.x + halfW || r.y1 < this.cam.y - halfH || r.y0 > this.cam.y + halfH) continue;
			const on = !!inside && inside.x === c.x && inside.y === c.y;
			ctx.fillStyle = `rgba(255,196,91,${on ? .09 : .04})`;
			ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
			ctx.strokeStyle = `rgba(255,196,91,${on ? .8 : .45})`;
			ctx.lineWidth = 2;
			ctx.setLineDash([8, 6]);
			ctx.strokeRect(r.x0 + 1, r.y0 + 1, r.x1 - r.x0 - 2, r.y1 - r.y0 - 2);
		}
		ctx.restore();
		if (this.buildMode && this.mouseWorld) {
			const { tx, ty } = tileAt(this.mouseWorld.x, this.mouseWorld.y);
			const placed = sv.logs.some((l) => l.map === save.map && l.tx === tx && l.ty === ty)
				|| (sv.beds ?? []).some((b) => b.map === save.map && b.tx === tx && b.ty === ty)
				|| (save.ghostBox && save.ghostBox.map === save.map && save.ghostBox.tx === tx && save.ghostBox.ty === ty);
			const check = placed ? { ok: true } : this.checkPiece(this.buildPiece ?? "wood", tx, ty);
			ctx.save();
			ctx.fillStyle = placed ? "rgba(255,160,60,.35)" : check.ok ? "rgba(120,230,120,.35)" : "rgba(230,80,70,.35)";
			ctx.fillRect(tx * 32, ty * 32, 32, 32);
			ctx.strokeStyle = placed ? "#ffa03c" : check.ok ? "#78e678" : "#e65046";
			ctx.lineWidth = 2;
			ctx.strokeRect(tx * 32 + 1, ty * 32 + 1, 30, 30);
			ctx.strokeStyle = "rgba(255,255,255,.18)";
			ctx.setLineDash([4, 6]);
			ctx.beginPath(); ctx.arc(save.x, save.y, BUILD_REACH, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		}
	}
	/** Screen-space pass: night tint with warm light around you and campfires. */
	drawNight(ctx, w, h) {
		const s = this.save?.dayNight;
		if (!s || !this.nightOn()) return;
		const d = darkness(s);
		if (d <= .01) return;
		ctx.fillStyle = `rgba(8,10,34,${(.58 * d).toFixed(3)})`;
		ctx.fillRect(0, 0, w, h);
		ctx.save();
		ctx.globalCompositeOperation = "lighter";
		const sx = (x) => w / 2 + (x - this.cam.x) * this.zoom;
		const sy = (y) => h / 2 + (y - this.cam.y) * this.zoom;
		const glow = (x, y, r, a, rgb) => {
			const g = ctx.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, `rgba(${rgb},${a})`);
			g.addColorStop(1, `rgba(${rgb},0)`);
			ctx.fillStyle = g;
			ctx.fillRect(x - r, y - r, r * 2, r * 2);
		};
		glow(sx(this.save.x), sy(this.save.y - 10), 90 * this.zoom, .2 * d, "255,214,150");
		for (const c of this.save.survival?.campfires ?? []) {
			if (c.map !== this.save.map) continue;
			const flick = 1 + Math.sin(this.clock * 9 + c.x) * .06;
			glow(sx(c.x), sy(c.y - 12), 200 * this.zoom * flick, .34 * d, "255,150,60");
		}
		ctx.restore();
	}
	clearMenu() {
		this.menu = null;
		publish({ menu: null });
	}
	menuAct(id) {
		if (id.startsWith("menu:")) {
			const panel = id.slice(5);
			if (panel === "trade") this.toggleTrade();
			else if (panel === "jar") this.catchSpirit();
			else if (panel === "auto") this.toggleAutoplay();
			else this.toggle(panel);
			this.clearMenu();
			return;
		}
		if (id === "ghostbox:here") {
			const save = this.save;
			if (save?.ghostBox) this.moveGhostBoxHere();
			else if (save) {
				const have = Object.entries(BUILD_PIECES.ghostbox.cost).every(([k, n]) => (save.bag[k] ?? 0) >= n);
				this.placeGhostBoxHere(!have);
			}
			this.clearMenu();
			return;
		}
		if (id.startsWith("talk:")) this.openTalk(id.slice(5));
		else if (id.startsWith("join:")) this.recruit(id.slice(5));
		else if (id.startsWith("chop:")) {
			const node = this.world.spawns.find(n => n.id === id.slice(5) && n.kind === "node");
			if (node && Math.hypot(node.x - this.save.x, node.y - this.save.y) <= 64) this.startNode(node.id, node.node);
			else this.say("Move beside the resource to gather it.");
		} else if (id === "fish") this.startFishing();
		else if (id === "water") this.survivalAction("water");
		else if (id === "gather") this.interact();
		this.clearMenu();
	}
	recruit(id) {
		const save = this.save;
		if (!save) return;
		save.party = save.party ?? [];
		const npc = NPCS.find((n) => n.id === id);
		if (!npc) return;
		if (save.party.includes(id)) {
			this.say(`${npc.name} already walks with you.`);
			return;
		}
		if (save.party.length >= 3) {
			this.say("Three followers is a full hunt.");
			return;
		}
		save.party.push(id);
		this.say(`${npc.name} joins. They will strike with you.`);
		this.persist();
		this.syncHud(true);
	}
	/** Average colour of a tile picture, for the map. Null until the picture has loaded. */
	spriteColor(path) {
		this.spriteColors = this.spriteColors ?? new Map();
		const hit = this.spriteColors.get(path);
		if (hit !== undefined) return hit;
		const img = tileImage(path);
		if (!img.complete || img.naturalWidth <= 0) return null;
		let col = null;
		try {
			const c = document.createElement("canvas");
			c.width = c.height = 1;
			const g = c.getContext("2d");
			g.drawImage(img, 0, 0, 1, 1);
			const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
			col = a < 40 ? null : [r, gr, b];
		} catch { col = null; }
		this.spriteColors.set(path, col);
		return col;
	}
	/** The map panel while you are inside a designer map: the whole map, its places, quests and you. */
	drawCustomMap(canvas) {
		const file = this.customFile;
		const world = this.world;
		const save = this.save;
		const ctx = canvas.getContext("2d");
		if (!ctx || !file || !world || !save) return;
		const W = 560, H = 360;
		if (canvas.width !== W) canvas.width = W;
		if (canvas.height !== H) canvas.height = H;
		ctx.fillStyle = "#0e0a09";
		ctx.fillRect(0, 0, W, H);
		const top = 18, bottom = 22;
		const k = Math.min(W / file.w, (H - top - bottom) / file.h);
		const ox = Math.floor((W - file.w * k) / 2), oy = top + Math.floor((H - top - bottom - file.h * k) / 2);
		// The terrain picture only changes when the map does: build it once per map.
		let img = this.customMapImg?.file === file ? this.customMapImg.img : null;
		if (!img) {
		img = document.createElement("canvas");
		img.width = file.w; img.height = file.h;
		const ig = img.getContext("2d");
		const data = ig.createImageData(file.w, file.h);
		const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
		for (let i = 0; i < file.tiles.length; i++) {
			const t = file.tiles[i];
			let c = (t.sprite && this.spriteColor(t.sprite)) || hex(FLOOR_COLOR[t.floor] ?? "#3d5a3a");
			if (t.layers?.length) { const top2 = this.spriteColor(t.layers[t.layers.length - 1]); if (top2) c = [(c[0] + top2[0]) >> 1, (c[1] + top2[1]) >> 1, (c[2] + top2[2]) >> 1]; }
			if (t.floor === 2 && !t.sprite) c = [37, 139, 181];
			if (t.block) c = [c[0] * .45 | 0, c[1] * .45 | 0, c[2] * .45 | 0];
			if (t.portal) c = [180, 166, 255];
			data.data.set([c[0], c[1], c[2], 255], i * 4);
		}
		ig.putImageData(data, 0, 0);
		this.customMapImg = { file, img };
		}
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(img, ox, oy, file.w * k, file.h * k);
		const big = file.w * file.h > 40000;
		ctx.strokeStyle = "#f0e2c8";
		ctx.lineWidth = 1;
		ctx.strokeRect(ox - .5, oy - .5, file.w * k + 1, file.h * k + 1);
		const at = (tx, ty) => [ox + (tx + .5) * k, oy + (ty + .5) * k];
		const dot = (tx, ty, color, r = 3.5, label = "") => {
			const [x, y] = at(tx, ty);
			ctx.fillStyle = color;
			ctx.strokeStyle = "#1a1214";
			ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			if (label) { ctx.font = "13px VT323, monospace"; ctx.fillStyle = "#fff6e8"; ctx.textAlign = "left"; ctx.fillText(label, x + r + 3, y + 4); }
		};
		for (const z of big ? [] : file.zones ?? []) {
			ctx.strokeStyle = "rgba(196,71,58,.9)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
			ctx.strokeRect(ox + z.tx * k, oy + z.ty * k, z.tw * k, z.th * k);
			ctx.setLineDash([]);
		}
		if (!big) for (const n of world.spawns) if (n.kind === "node") dot(Math.floor(n.x / TILE), Math.floor(n.y / TILE), "#8fd06a", 2.5);
		// Named regions: continents in big letters, towns as gold squares.
		ctx.textAlign = "center";
		// Labels skip spots another label already took, so a crowded world stays readable.
		const taken = [];
		const free = (x, y, w, h) => { if (taken.some((b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y)) return false; taken.push({ x, y, w, h }); return true; };
		const regions = [...(file.regions ?? [])].sort((a, b) => (a.kind === "region" ? 0 : 1) - (b.kind === "region" ? 0 : 1));
		for (const r of regions) {
			const [cx, cy] = at(r.tx + r.tw / 2, r.ty + r.th / 2);
			if (r.kind === "region") {
				ctx.font = "17px VT323, monospace";
				const lw = ctx.measureText(r.name).width + 4;
				free(cx - lw / 2, oy + r.ty * k, lw, 14);
				ctx.fillStyle = "rgba(20,14,12,.7)"; ctx.fillText(r.name.toUpperCase(), cx + 1, oy + r.ty * k + 13);
				ctx.fillStyle = "#f0e2c8"; ctx.fillText(r.name.toUpperCase(), cx, oy + r.ty * k + 12);
			} else if (r.kind === "city") {
				ctx.fillStyle = "#e6c15a"; ctx.strokeStyle = "#1a1214"; ctx.lineWidth = 1;
				const sz = Math.max(3, r.tw * k * .5);
				ctx.fillRect(cx - sz / 2, cy - sz / 2, sz, sz); ctx.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz);
				if (big) {
					ctx.font = "12px VT323, monospace";
					const lw = ctx.measureText(r.name).width + 2;
					if (free(cx - lw / 2, cy - sz / 2 - 12, lw, 11)) { ctx.fillStyle = "rgba(20,14,12,.75)"; ctx.fillText(r.name, cx + 1, cy - sz / 2 - 1); ctx.fillStyle = "#fff6e8"; ctx.fillText(r.name, cx, cy - sz / 2 - 2); }
				}
			}
		}
		ctx.textAlign = "left";
		for (const m of this.mobs) if (m.alive && m.boss) dot(Math.floor(m.x / TILE), Math.floor(m.y / TILE), "#c4473a", 5, m.name);
		for (const it of big ? [] : file.interactables ?? []) {
			if (it.kind === "node") continue;
			const color = it.kind === "dungeon" ? "#b4a6ff" : it.kind === "hearth" ? "#ff9a4a" : it.kind === "shrine" ? "#8fd0ff" : "#e6c15a";
			const label = it.kind === "dungeon" ? it.name || "Door" : it.kind === "shrine" ? it.name || "Shrine" : it.kind === "hearth" ? "Hearth" : it.label || (it.kind === "bounty" ? "Bounty Board" : "Arena");
			dot(it.tx, it.ty, color, 5, label);
		}
		const states = save.mapQuests ?? {};
		for (const n of this.mapNpcs) {
			const mk = questMarker(file, n, states);
			if (big && !mk) continue;
			// On a big world only hand-ins ('?') get a label; offers show as a dot so towns are not a wall of '!'.
			dot(n.tx, n.ty, mk === "?" ? "#ffe08a" : "#c9a6e8", big ? 3 : 4, big ? (mk === "?" ? mk : undefined) : `${mk ? mk + " " : ""}${n.name}`);
		}
		// Where the open quests want you to go.
		for (const q of openQuests(file, states)) {
			const s = states[qkey(file.id, q.id)];
			const step = s.status === "active" ? q.steps[s.step] : null;
			const goal = s.status === "ready" ? this.mapNpcs.find((n) => n.id === turnInOf(q)) : step?.type === "goto" ? { tx: step.tx, ty: step.ty } : step?.type === "talk" ? this.mapNpcs.find((n) => n.id === step.npcId) : step?.type === "bring" ? this.mapNpcs.find((n) => n.id === (step.npcId || turnInOf(q))) : null;
			if (!goal) continue;
			const [x, y] = at(goal.tx, goal.ty);
			ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(x, y, 8 + Math.sin(this.clock * 4) * 1.5, 0, Math.PI * 2); ctx.stroke();
		}
		for (const fire of save.survival?.campfires ?? []) if (fire.map === save.map) dot(Math.floor(fire.x / TILE), Math.floor(fire.y / TILE), "#ffac45", 3.5);
		if (file.spawn) dot(file.spawn.tx, file.spawn.ty, "#8fd06a", 2.5);
		const px = ox + save.x / TILE * k, py = oy + save.y / TILE * k;
		ctx.fillStyle = "#fff6e8"; ctx.strokeStyle = "#1a1214"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(px + 5.5, py + 5); ctx.lineTo(px - 5.5, py + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
		ctx.font = "15px VT323, monospace";
		ctx.textAlign = "left";
		ctx.fillStyle = "#e6c15a";
		ctx.fillText(`${file.name} · ${file.w}×${file.h}`, 8, 13);
		ctx.font = "14px VT323, monospace";
		ctx.fillStyle = "#f0e2c8";
		ctx.fillText("You · triangle   NPC · violet ('!' quest, '?' hand in)   gold ring · quest goal   red · boss/zone", 8, H - 6);
	}
	/** One pixel per tile picture of the current map, rebuilt when the map or tile art changes. */
	mapTerrainImage() {
		const world = this.world;
		if (!world) return null;
		const rev = tileImageRevision();
		const c = this.mapImg;
		if (c && c.world === world && (c.rev === rev || performance.now() - c.at < 2500) && c.solids === (world.solids?.size ?? 0)) return c.img;
		const img = c?.world === world ? c.img : document.createElement("canvas");
		img.width = world.w; img.height = world.h;
		const ig = img.getContext("2d");
		const data = ig.createImageData(world.w, world.h);
		const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
		const floorRgb = Object.keys(FLOOR_COLOR).map((k) => hex(FLOOR_COLOR[k] ?? "#3d5a3a"));
		for (let i = 0; i < world.tiles.length; i++) {
			const t = world.tiles[i];
			let col = (t.sprite && this.spriteColor(t.sprite)) || floorRgb[t.floor] || [61, 90, 58];
			if (t.layers?.length) { const top = this.spriteColor(t.layers[t.layers.length - 1]); if (top) col = [(col[0] + top[0]) >> 1, (col[1] + top[1]) >> 1, (col[2] + top[2]) >> 1]; }
			if (t.floor === 2 && !t.sprite) col = [37, 139, 181];
			if (t.block && t.floor !== 2) col = [col[0] * .5 | 0, col[1] * .5 | 0, col[2] * .5 | 0];
			if (!t.block && t.decor && !t.sprite) col = [col[0] * .8 | 0, col[1] * .85 | 0, col[2] * .8 | 0];
			if (t.portal) col = [180, 166, 255];
			if (world.solids?.has(i)) col = [120, 82, 48];
			data.data[i * 4] = col[0]; data.data[i * 4 + 1] = col[1]; data.data[i * 4 + 2] = col[2]; data.data[i * 4 + 3] = 255;
		}
		ig.putImageData(data, 0, 0);
		this.mapImg = { world, img, rev, at: performance.now(), solids: world.solids?.size ?? 0 };
		return img;
	}
	/** Size of the current map in tiles, for the map window. */
	mapInfo() {
		const save = this.save;
		const world = this.world;
		if (!save || !world) return null;
		return { w: world.w, h: world.h, px: save.x / TILE, py: save.y / TILE, name: this.customFile?.name ?? (save.map === "world" ? "The Overworld" : save.map === "crypt" ? "Tiny Crypt" : save.map === "kiln" ? "Ash Kiln" : save.map.startsWith("rift-") ? `Dungeon ${save.map.slice(5)}` : "Map"), pin: save.mapPin?.map === save.map ? save.mapPin : null };
	}
	/** Named places on the current map for the map window's list: towns, areas, classic sites. */
	mapPlaces() {
		const save = this.save;
		const out = [];
		for (const r of this.customFile?.regions ?? []) out.push({ name: r.name, kind: r.kind, tx: r.tx + r.tw / 2, ty: r.ty + r.th / 2, levels: r.levelMin ? `${r.levelMin}–${r.levelMax ?? r.levelMin}` : "" });
		if (save?.map === "world") {
			for (const p of POIS) {
				if (p.kind === "npc") { const n = NPCS.find((x) => x.id === p.id); if (!n) continue; const a = scaleTile(n.tx, n.ty); out.push({ name: n.name, kind: "npc", tx: a.tx, ty: a.ty, levels: "" }); }
				else if ("tx" in p && p.kind !== "hearth") { const a = scaleTile(p.tx, p.ty); out.push({ name: p.name ?? p.kind, kind: p.kind === "boss" ? "boss" : p.kind === "dungeon" ? "dungeon" : "landmark", tx: a.tx, ty: a.ty, levels: p.kind === "boss" ? `${p.level}` : "" }); }
			}
			for (const t of TAVERNS) out.push({ name: `${t.name} board`, kind: "landmark", tx: t.boardTx, ty: t.boardTy, levels: "" });
		}
		for (const n of this.mapNpcs ?? []) out.push({ name: n.name, kind: "npc", tx: n.tx, ty: n.ty, levels: "" });
		return out;
	}
	/** What is under a map position (tile coords): the area, and the nearest place or person within `r` tiles. */
	mapPick(tx, ty, r = 2) {
		const lines = [];
		const file = this.customFile;
		const area = file ? regionAt(file, Math.floor(tx), Math.floor(ty)) : null;
		const land = file ? (file.regions ?? []).filter((x) => x.kind === "region" && tx >= x.tx && ty >= x.ty && tx < x.tx + x.tw && ty < x.ty + x.th)[0] : null;
		if (area) lines.push(`${area.name}${area.levelMin ? ` · foes ${area.levelMin}–${area.levelMax ?? area.levelMin}` : ""}`);
		if (land && land !== area) lines.push(land.name);
		if (area?.about) lines.push(area.about);
		let best = null, bd = r;
		for (const p of this.mapPlaces()) {
			if (p.kind === "region" || p.kind === "city" || p.kind === "resource" || p.kind === "water") continue;
			const d = Math.hypot(p.tx - tx, p.ty - ty);
			if (d < bd) { bd = d; best = p; }
		}
		for (const m of this.mobs) if (m.alive && m.boss) { const d = Math.hypot(m.x / TILE - tx, m.y / TILE - ty); if (d < bd) { bd = d; best = { name: `${m.name} · Lv ${m.level}`, kind: "boss" }; } }
		if (best) lines.unshift(best.name);
		if (this.fastTravelTownAt(Math.floor(tx), Math.floor(ty))) lines.push("Click to fast travel");
		const t = this.world?.tiles[Math.floor(ty) * (this.world?.w ?? 0) + Math.floor(tx)];
		if (!lines.length && t) lines.push(t.floor === 2 ? "Open water" : t.block ? "Impassable" : "Wilds");
		return lines;
	}
	/** Pin a spot on the map (click again near it to clear). An arrow in the world points to it. */
	setMapPin(tx, ty) {
		const save = this.save;
		if (!save) return;
		const pin = save.mapPin;
		if (pin && pin.map === save.map && Math.hypot(pin.tx - tx, pin.ty - ty) < 3) { save.mapPin = null; this.say("Pin removed."); }
		else { save.mapPin = { map: save.map, tx: Math.round(tx), ty: Math.round(ty) }; this.say("Pinned. Follow the arrow."); }
		this.persist();
	}
	travelToPin() {
		const pin = this.save?.mapPin;
		if (!pin || pin.map !== this.save.map) return;
		this.pointAt(pin.tx * 32 + 16, pin.ty * 32 + 16);
	}
	/**
	 * The map window: the whole map, pannable and zoomable. `view` = centre (tiles) and scale (px per tile);
	 * `layers` toggles areas, people, places, foes and resources.
	 */
	drawWorldMap(canvas, view, layers = {}) {
		const save = this.save;
		const world = this.world;
		const ctx = canvas.getContext("2d");
		if (!ctx || !world || !save) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const W = Math.max(50, canvas.clientWidth), H = Math.max(50, canvas.clientHeight);
		if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = "#0b0807";
		ctx.fillRect(0, 0, W, H);
		const k = view.s;
		const X = (tx) => (tx - view.cx) * k + W / 2;
		const Y = (ty) => (ty - view.cy) * k + H / 2;
		const inView = (x, y, pad = 30) => x > -pad && y > -pad && x < W + pad && y < H + pad;
		const img = this.mapTerrainImage();
		ctx.imageSmoothingEnabled = k < 1;
		if (img) ctx.drawImage(img, X(0), Y(0), world.w * k, world.h * k);
		ctx.imageSmoothingEnabled = false;
		ctx.strokeStyle = "rgba(240,226,200,.5)"; ctx.lineWidth = 1;
		ctx.strokeRect(X(0) - .5, Y(0) - .5, world.w * k + 1, world.h * k + 1);
		const file = this.customFile;
		const L = { areas: true, people: true, places: true, foes: true, resources: true, ...layers };
		// Label boxes already used, so labels never stack on each other.
		const taken = [];
		const free = (x, y, w, h) => { if (taken.some((b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y)) return false; taken.push({ x, y, w, h }); return true; };
		const text = (str, x, y, color, size = 13, center = true, force = false) => {
			ctx.font = `${size}px VT323, monospace`;
			const w = ctx.measureText(str).width;
			const lx = center ? x - w / 2 : x;
			if (!force && !free(lx - 2, y - size + 2, w + 4, size)) return false;
			ctx.fillStyle = "rgba(14,10,9,.78)"; ctx.fillRect(lx - 2, y - size + 3, w + 4, size);
			ctx.fillStyle = color; ctx.fillText(str, lx, y);
			return true;
		};
		const dot = (tx, ty, color, r, label = "", labelColor = "#fff6e8") => {
			const x = X(tx + .5), y = Y(ty + .5);
			if (!inView(x, y)) return;
			ctx.fillStyle = color; ctx.strokeStyle = "#140e0c"; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			if (label) text(label, x + r + 3, y + 4, labelColor, 13, false);
		};
		const glyph = (tx, ty, ch, color, size = 16) => {
			const x = X(tx + .5), y = Y(ty + .5);
			if (!inView(x, y)) return;
			ctx.font = `bold ${size}px VT323, monospace`; ctx.textAlign = "center";
			ctx.fillStyle = "#140e0c"; ctx.fillText(ch, x + 1, y - 5);
			ctx.fillStyle = color; ctx.fillText(ch, x, y - 6);
			ctx.textAlign = "left";
		};
		const states = save.mapQuests ?? {};
		// Player first so its label wins the spot.
		const px = X(save.x / TILE), py = Y(save.y / TILE);
		text("YOU", px, py - 12, "#fff6e8", 14, true, true);
		// Quest goals.
		const goals = [];
		if (file) for (const q of openQuests(file, states)) {
			const st = states[qkey(file.id, q.id)];
			const step = st.status === "active" ? q.steps[st.step] : null;
			const npcs = this.mapNpcs ?? [];
			const goal = st.status === "ready" ? npcs.find((n) => n.id === turnInOf(q)) : step?.type === "goto" ? { tx: step.tx, ty: step.ty, r: step.radius } : step?.type === "talk" ? npcs.find((n) => n.id === step.npcId) : step?.type === "bring" ? npcs.find((n) => n.id === (step.npcId || turnInOf(q))) : null;
			if (goal) goals.push({ ...goal, name: q.name });
		}
		// Areas: continents, towns, groves, landmarks.
		if (file && L.areas) {
			const regions = [...(file.regions ?? [])].sort((a, b) => (a.kind === "region" ? 0 : a.kind === "city" ? 1 : 2) - (b.kind === "region" ? 0 : b.kind === "city" ? 1 : 2));
			const travelIds = new Set(this.fastTravelTowns().map((r) => r.id));
			for (const r of regions) {
				const x = X(r.tx), y = Y(r.ty), w = r.tw * k, h = r.th * k;
				if (x > W || y > H || x + w < 0 || y + h < 0) continue;
				const cx = x + w / 2, cy = y + h / 2;
				if (r.kind === "region") {
					if (k >= 3) { ctx.strokeStyle = "rgba(240,226,200,.25)"; ctx.setLineDash([8, 6]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); }
					const size = k < 1.5 ? 18 : k < 4 ? 22 : 26;
					text(r.name.toUpperCase() + (r.levelMin ? `  ${r.levelMin}–${r.levelMax ?? r.levelMin}` : ""), cx, Math.max(size + 4, Math.min(H - 6, k >= 3 ? y + size + 2 : cy)), "#f0e2c8", size);
				} else if (r.kind === "city") {
					const sz = Math.max(4, Math.min(w, 14));
					if (k >= 3) { ctx.strokeStyle = "rgba(230,193,90,.85)"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); ctx.lineWidth = 1; }
					else { ctx.fillStyle = "#e6c15a"; ctx.strokeStyle = "#140e0c"; ctx.fillRect(cx - sz / 2, cy - sz / 2, sz, sz); ctx.strokeRect(cx - sz / 2, cy - sz / 2, sz, sz); }
					if (travelIds.has(r.id)) { ctx.strokeStyle = "#fff6e8"; ctx.lineWidth = 2; if (k >= 3) ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); else { ctx.beginPath(); ctx.arc(cx, cy, sz / 2 + 5, 0, Math.PI * 2); ctx.stroke(); } ctx.lineWidth = 1; }
					text(r.name, cx, k >= 3 ? y - 3 : cy - sz / 2 - 3, "#ffe7a6", k >= 3 ? 16 : 14);
				} else if (k >= 2) {
					const col = r.kind === "resource" ? "#8fd06a" : r.kind === "dungeon" ? "#ff7a5a" : r.kind === "water" ? "#7ec8ea" : "#c9a6e8";
					if (k >= 4) { ctx.strokeStyle = col; ctx.globalAlpha = .7; ctx.strokeRect(x, y, w, h); ctx.globalAlpha = 1; }
					else dot(r.tx + r.tw / 2 - .5, r.ty + r.th / 2 - .5, col, 3);
					if (k >= 3) text(r.name, cx, y - 3, col, 13);
				}
			}
		}
		// Resources (only once you zoom in; there are thousands).
		if (L.resources && k >= 3) {
			const nodeCol = { tree: "#5fae4a", ore: "#b8b8c8", shroom: "#d07ad0", fish: "#7ec8ea" };
			for (const n of world.spawns) if (n.kind === "node") { const x = X(n.x / TILE), y = Y(n.y / TILE); if (inView(x, y, 4)) { ctx.fillStyle = nodeCol[n.node] ?? "#8fd06a"; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); } }
		}
		// Places: designer interactables, classic sites, taverns, rifts, campfires.
		if (L.places) {
			for (const it of file?.interactables ?? []) {
				if (it.kind === "node") continue;
				if (k < 2.5 && it.kind !== "dungeon") continue;
				const col = it.kind === "dungeon" ? "#b4a6ff" : it.kind === "hearth" ? "#ff9a4a" : it.kind === "shrine" ? "#8fd0ff" : it.kind === "arena" ? "#c4473a" : "#e6c15a";
				const label = k >= 5 ? (it.kind === "dungeon" ? it.name || "Door" : it.kind === "shrine" ? it.name || "Shrine" : it.kind === "hearth" ? "Hearth" : it.label || (it.kind === "bounty" ? "Bounty Board" : "Arena")) : "";
				dot(it.tx, it.ty, col, k >= 5 ? 4.5 : 3, label);
			}
			if (save.map === "world") {
				// Classic POI/tavern overlay only applies to the procedurally-generated world.
				// When the new overworld (Veilreach) is active its own interactables are already
				// drawn above via file.interactables, so skip the old overlay entirely.
				if (!this.overworldFile) {
					for (const p of POIS) {
						if (p.kind === "npc" || p.kind === "boss" || !("tx" in p)) continue;
						const a = scaleTile(p.tx, p.ty);
						const col = p.kind === "dungeon" ? "#b4a6ff" : p.kind === "shrine" ? "#8fd0ff" : "#ff9a4a";
						dot(a.tx, a.ty, col, 5, p.kind === "hearth" ? "Hearth" : k >= 1.5 ? p.name : "");
					}
					for (const t of TAVERNS) dot(t.boardTx, t.boardTy, "#e6c15a", 4, k >= 3 ? t.name : "");
				}
				for (const portal of save.dungeons?.portals ?? []) if (!portal.cleared) { glyph(portal.x / TILE - .5, portal.y / TILE - .5, "◆", "#b4a6ff", 18); dot(portal.x / TILE - .5, portal.y / TILE - .5, "#b4a6ff", 4, `Rift ${portal.id.slice(5)}`, "#e7d9ff"); }
			}
			for (const fire of save.survival?.campfires ?? []) if (fire.map === save.map) dot(fire.x / TILE - .5, fire.y / TILE - .5, "#ffac45", 4, k >= 3 ? "Campfire" : "");
			if (save.map !== "world" && !file) { const ex = this.dungeonExitAt(); dot(ex.x / TILE - .5, ex.y / TILE - .5, "#e7d9ff", 5, "Exit"); }
		}
		// People: map NPCs (quest marks always), classic townsfolk.
		if (L.people) {
			for (const n of this.mapNpcs ?? []) {
				const mk = file ? questMarker(file, n, states) : "";
				if (mk && (mk === "?" || k >= 2)) { glyph(n.tx, n.ty, mk, mk === "?" ? "#ffe08a" : "#e6c15a", 18); dot(n.tx, n.ty, mk === "?" ? "#ffe08a" : "#c9a6e8", 3.5, k >= 6 ? n.name : ""); }
				else if (k >= 2.5) dot(n.tx, n.ty, "#c9a6e8", 3, k >= 6 ? n.name : "");
			}
			// Classic NPC dots only for the procedural world; Veilreach serves its own via mapNpcs.
		if (save.map === "world" && !this.overworldFile) for (const p of POIS) {
				if (p.kind !== "npc") continue;
				const n = NPCS.find((x) => x.id === p.id);
				if (!n || n.map !== "world") continue;
				const a = scaleTile(n.tx, n.ty);
				if (k >= 2.5) dot(a.tx, a.ty, "#f0e2c8", 3, k >= 6 ? n.name : "");
			}
		}
		// Foes: bosses always, others near you once zoomed in.
		if (L.foes) {
			for (const m of this.mobs) {
				if (!m.alive) continue;
				if (m.boss || m.bounty || m.witch) dot(m.x / TILE - .5, m.y / TILE - .5, "#ff4a3a", 5, `${m.name} ${m.level}`, "#ffb4a8");
				else if (k >= 3) dot(m.x / TILE - .5, m.y / TILE - .5, "#c4473a", 2);
			}
		}
		const bounty = this.liveBounty();
		if (bounty && (bounty.map ?? "world") === save.map) dot(bounty.x / TILE - .5, bounty.y / TILE - .5, bounty.enraged ? "#ff4d6a" : "#e6c15a", 5, bounty.enraged ? "HUNT" : "BOUNTY");
		// Quest goals pulse in gold.
		for (const g of goals) {
			const x = X(g.tx + .5), y = Y(g.ty + .5);
			const r = Math.max(7, (g.r ?? 0) * k) + Math.sin(this.clock * 4) * 1.5;
			ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2;
			if (inView(x, y, r + 4)) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
			else this.mapEdgeArrow(ctx, W, H, x, y, "#ffe08a");
		}
		// Pin.
		const pin = save.mapPin?.map === save.map ? save.mapPin : null;
		if (pin) {
			const x = X(pin.tx + .5), y = Y(pin.ty + .5);
			if (inView(x, y)) {
				ctx.fillStyle = "#ff6a4a"; ctx.strokeStyle = "#140e0c"; ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y - 14); ctx.arc(x, y - 16, 7, Math.PI * .8, Math.PI * .2, false); ctx.closePath(); ctx.fill(); ctx.stroke();
				text(`${Math.round(Math.hypot(pin.tx - save.x / TILE, pin.ty - save.y / TILE))} tiles`, x, y - 26, "#ffb4a8", 13, true, true);
			} else this.mapEdgeArrow(ctx, W, H, x, y, "#ff6a4a");
		}
		// You.
		if (inView(px, py)) {
			ctx.fillStyle = "#fff6e8"; ctx.strokeStyle = "#140e0c"; ctx.lineWidth = 2;
			ctx.save(); ctx.translate(px, py);
			const dir = this.direction ?? "down";
			ctx.rotate(dir === "up" ? 0 : dir === "right" ? Math.PI / 2 : dir === "down" ? Math.PI : -Math.PI / 2);
			ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
			ctx.restore();
		} else this.mapEdgeArrow(ctx, W, H, px, py, "#fff6e8");
		// Scale bar.
		const tiles = [10, 25, 50, 100, 200].find((n) => n * k >= 60) ?? 200;
		ctx.fillStyle = "#f0e2c8"; ctx.fillRect(10, H - 14, tiles * k, 3);
		ctx.font = "13px VT323, monospace"; ctx.fillText(`${tiles} tiles`, 12, H - 18);
	}
	/** A small arrow around the hunter pointing at the map pin, with the distance. Clears on arrival. */
	drawPinArrow(ctx, toScreen, dpr) {
		const save = this.save;
		const pin = save?.mapPin;
		if (!pin || pin.map !== save.map) return;
		const dx = pin.tx * 32 + 16 - save.x, dy = pin.ty * 32 + 16 - save.y;
		const d = Math.hypot(dx, dy) / 32;
		if (d < 2.5) { save.mapPin = null; this.say("You reached your pin."); return; }
		const p = toScreen(save.x, save.y - 18);
		const a = Math.atan2(dy, dx);
		const rad = 30 * Math.max(1, this.zoom ?? 1);
		const x = p.x / dpr + Math.cos(a) * rad, y = p.y / dpr + Math.sin(a) * rad;
		ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(1.6, 1.6);
		ctx.fillStyle = "#ff6a4a"; ctx.strokeStyle = "#140e0c"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-3, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
		ctx.restore();
		ctx.font = "14px VT323, monospace"; ctx.textAlign = "center";
		ctx.fillStyle = "#140e0c"; ctx.fillText(`${Math.round(d)}`, x + 1, y + 19);
		ctx.fillStyle = "#ffb4a8"; ctx.fillText(`${Math.round(d)}`, x, y + 18);
		ctx.textAlign = "left";
	}
	mapEdgeArrow(ctx, W, H, x, y, color) {
		const cx = W / 2, cy = H / 2;
		const a = Math.atan2(y - cy, x - cx);
		const r = Math.min(W / 2 - 14, H / 2 - 14);
		const s = Math.min(Math.abs((W / 2 - 14) / Math.cos(a) || 1e9), Math.abs((H / 2 - 14) / Math.sin(a) || 1e9));
		const ex = cx + Math.cos(a) * Math.min(s, 1e6), ey = cy + Math.sin(a) * Math.min(s, 1e6);
		ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
		ctx.fillStyle = color; ctx.strokeStyle = "#140e0c"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
		ctx.restore();
		void r;
	}
	drawMap(canvas) {
		if (this.save?.map?.startsWith("custom-") && this.customFile) return this.drawCustomMap(canvas);
		const world = this.overworld ?? (this.save?.map === "world" ? this.world : null);
		const save = this.save;
		const ctx = canvas.getContext("2d");
		if (!ctx || !world || !save) return;
		const w = 560;
		const h = 360;
		if (canvas.width !== w) canvas.width = w;
		if (canvas.height !== h) canvas.height = h;
		const sx = w / world.w;
		const sy = h / world.h;
		const colors = [
			"#4a3480",
			"#d5e6f4",
			"#3c8a40",
			"#d9c6a4",
			"#c4ae90",
			"#2a78b0",
			"#c56a3c"
		];
		const step = Math.max(1, Math.round(world.w / 140));
		for (let y = 0; y < world.h; y += step) for (let x = 0; x < world.w; x += step) {
			const t = world.tiles[y * world.w + x];
			ctx.fillStyle = !t ? "#111" : t.floor === 2 ? "#258bb5" : t.block ? "#1c1412" : colors[t.biome] ?? "#555";
			ctx.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx * step) + 1, Math.ceil(sy * step) + 1);
		}
		for (const tavern of TAVERNS) {
			ctx.fillStyle = "#e6c15a";
			ctx.fillRect(tavern.tx * sx, tavern.ty * sy, 4, 4);
		}
		for (const n of this.world.spawns) {
			if (n.kind !== "node") continue;
			ctx.fillStyle = "#8fd06a";
			ctx.fillRect(Math.floor(n.x / 32) * sx + sx / 2 - 1, Math.floor(n.y / 32) * sy + sy / 2 - 1, 3, 3);
		}
		for (const p of POIS) {
			if (p.kind !== "shrine" && p.kind !== "dungeon" && p.kind !== "boss") continue;
			const at = scaleTile(p.tx, p.ty);
			const mx = at.tx * sx + sx / 2;
			const my = at.ty * sy + sy / 2;
			ctx.fillStyle = p.kind === "dungeon" ? "#b4a6ff" : p.kind === "boss" ? "#c4473a" : p.kind === "node" ? "#8fd06a" : "#e6c15a";
			ctx.beginPath();
			ctx.arc(mx, my, p.kind === "dungeon" ? 7 : p.kind === "shrine" ? 6 : 4, 0, Math.PI * 2);
			ctx.fill();
			if (p.kind === "shrine" || p.kind === "dungeon" || p.kind === "boss") {
				ctx.font = "13px VT323, monospace";
				ctx.fillStyle = "#fff6e8";
				ctx.textAlign = "left";
				ctx.fillText(p.kind === "dungeon" ? p.name : p.kind === "shrine" ? "Arena" : p.name, mx + 6, my + 3);
			}
		}
		for (const fire of save.survival?.campfires ?? []) {
			if (fire.map !== "world") continue;
			ctx.fillStyle = "#ffac45"; ctx.fillRect(fire.x / TILE * sx - 3, fire.y / TILE * sy - 3, 6, 6);
		}
		for (const portal of save.dungeons?.portals ?? []) {
			if (portal.cleared) continue;
			ctx.fillStyle = "#b4a6ff"; ctx.fillRect(portal.x / TILE * sx - 3, portal.y / TILE * sy - 3, 6, 6);
			ctx.font = "13px VT323"; ctx.fillText(`Dungeon ${portal.id.slice(5)}`, portal.x / TILE * sx + 5, portal.y / TILE * sy);
		}
		if (save.map === "world") {
			ctx.fillStyle = "#fff6e8";
			ctx.strokeStyle = "#1a1214";
			ctx.lineWidth = 2;
			const px = save.x / 32 * sx;
			const py = save.y / 32 * sy;
			ctx.beginPath();
			ctx.moveTo(px, py - 6);
			ctx.lineTo(px + 5, py + 5);
			ctx.lineTo(px - 5, py + 5);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		} else {
			ctx.fillStyle = "#b4a6ff";
			ctx.fillRect(8, 8, 10, 10);
			ctx.font = "14px VT323, monospace";
			ctx.fillStyle = "#efe6ff";
			ctx.textAlign = "left";
			ctx.fillText("Inside a rift. The exit is the tear behind you.", 22, 16);
		}
		const mark = this.liveBounty();
		if (mark && (mark.map === "world" || mark.map === save.map)) {
			const mx = mark.map === "world" ? mark.x / 32 * sx : 18;
			const my = mark.map === "world" ? mark.y / 32 * sy : 28;
			ctx.fillStyle = mark.enraged ? "#ff4d6a" : "#e6c15a";
			ctx.beginPath();
			ctx.arc(mx, my, 5, 0, Math.PI * 2);
			ctx.fill();
			ctx.font = "13px VT323";
			ctx.fillStyle = "#fff6e8";
			ctx.textAlign = "left";
			ctx.fillText(mark.enraged ? "HUNT" : "BOUNTY", mx + 6, my - 2);
		}
		ctx.font = "14px VT323, monospace";
		ctx.fillStyle = "#f0e2c8";
		ctx.textAlign = "left";
		ctx.fillText("You · gold triangle · gold bounty · violet rift · red boss", 8, 352);
	}
	hoverAt(x, y) {
		const info = this.describeAt(x, y);
		this.hint = info?.hint ?? "";
		const mob = this.save ? this.nearestMob(x, y, 40) : null;
		const was = this.hoverMobId;
		this.hoverMobId = mob?.id ?? null;
		this.hoverInfo = info;
		if (was !== this.hoverMobId) this.syncHud(false);
	}
	/** Mouse-over card: a foe's full read, or a short read for anything else, placed by the cursor. */
	hoverCard() {
		const at = this.hoverClient;
		if (!at || this.dead || !this.save) return null;
		const mob = this.hoverMobId ? this.mobs.find((m) => m.id === this.hoverMobId && m.alive) : null;
		if (mob) {
			const read = bodyRead(mob.type);
			return {
				x: at.x, y: at.y, kind: "mob",
				name: mob.name, level: mob.level, you: this.save.level, type: mob.type,
				tag: mob.bounty ? `★${mob.tier ?? 1} BOUNTY` : mob.hunter ? "HUNTER" : mob.witch ? "WITCH" : mob.boss ? "BOSS" : "",
				hp: Math.max(0, Math.ceil(mob.hp)), max: Math.max(1, Math.ceil(mob.max)),
				favor: read.kind === "magic" ? "Magic hits harder" : "Physical hits harder",
				traits: (mob.enchants ?? []).map((id) => ({ id, name: MOB_ENCHANTS[id]?.name ?? id, about: MOB_ENCHANTS[id]?.about ?? "" })),
				moves: (mob.kit ?? [mob.move]).map((id) => MOVE_BY_ID[id]?.name ?? id).filter(Boolean).slice(0, 5),
				lines: mob.bounty ? [mob.enraged ? "The hunt has turned: twice as strong." : `${Math.ceil(mob.huntIn ?? 0)}s before they hunt you.`, `Carries ${mob.lootGear?.length ?? 0} gear, a full bag and ${mob.lootKyo ?? 0} kyo.`] : mob.enraged ? ["Enraged: twice as strong."] : [],
			};
		}
		const info = this.hoverInfo;
		if (!info?.hint) return null;
		return { x: at.x, y: at.y, kind: "info", name: info.title ?? info.hint, lines: (info.lines ?? []).slice(0, 2) };
	}
	openInspect(x, y, sx, sy) {
		if (!this.save || this.dead) return;
		const info = x < -1e3 ? null : this.describeAt(x, y);
		const { w, h } = this.cssSize();
		const shell = [
			{
				id: "menu:bag",
				label: "Bag"
			},
			{
				id: "menu:skills",
				label: "Skills"
			},
			{
				id: "menu:quests",
				label: "Quests"
			},
			{
				id: "menu:map",
				label: "Map"
			},
			{
				id: "menu:moves",
				label: "Verses"
			},
			{
				id: "menu:ghost",
				label: "Spirits"
			},
			{
				id: "menu:craft",
				label: "Crafting"
			},
			{
				id: "menu:jar",
				label: "Use ghost jar"
			},
			{
				id: "menu:bounty",
				label: "Bounty"
			},
			{
				id: "menu:trade",
				label: "Trade"
			},
			{
				id: "menu:pause",
				label: "Pause"
			},
			{
				id: "menu:auto",
				label: "Autoplay"
			}
		];
		this.menu = {
			sx: Math.max(8, Math.min(sx, w - 300)),
			sy: Math.max(8, Math.min(sy, h - 280)),
			title: info?.title ?? "Menu",
			lines: info?.lines ?? ["Bag, skills, the board, and the rest of the veil."],
			actions: [...info?.actions ?? [], ...(this.rules === "hardcore" ? [{ id: "menu:survival", label: "Survival & Camp" }] : this.save?.map === "world" && !this.lms ? [{ id: "ghostbox:here", label: this.save.ghostBox ? "Move Ghost Box here" : "Place Ghost Box here" }] : []), ...shell]
		};
		this.syncHud(true);
	}
	describeAt(x, y) {
		const save = this.save;
		if (!save) return null;
		const mob = this.nearestMob(x, y, 40);
		if (mob) {
			const read = bodyRead(mob.type);
			const best = [...this.arsenal(save)].sort((a, b) => this.moveScore(b, mob, read.kind === "magic", 48) - this.moveScore(a, mob, read.kind === "magic", 48))[0];
			const kind = attackForm(best ?? MOVES[0]) === "spell" ? "magic" : "physical";
			return {
				hint: `${mob.name} · ${TYPES[mob.type].name} · favor ${read.kind}`,
				title: mob.name,
				lines: [
					`${TYPES[mob.type].name} · ${Math.ceil(mob.hp)} / ${Math.ceil(mob.max)}`,
					read.line,
					best ? `Best you carry: ${best.name} (${moveTactic(best)}, ${kind}).` : "No verse packed yet.",
					`Lv ${mob.level} · moves: ${(mob.kit ?? [mob.move]).map((id) => MOVE_BY_ID[id]?.name ?? id).join(", ")}`,
					...(mob.enchants ?? []).map((id) => `${MOB_ENCHANTS[id]?.name ?? id}: ${MOB_ENCHANTS[id]?.about ?? ""}`),
					...(mob.bounty ? [
						mob.enraged ? "The hunt has turned. They are twice as strong." : `${Math.ceil(mob.huntIn)}s before they hunt you.`,
						`Tier ${mob.tier ?? 1} bounty. Carries ${mob.lootGear?.length ?? 0} pieces (you pick one), a full bag, and ${mob.lootKyo} kyo.`
					] : [])
				],
				actions: []
			};
		}
		if (save.map === "world") for (const n of NPCS) {
			if (n.map !== "world") continue;
			const p = poiPos({
				kind: "npc",
				id: n.id
			});
			if (!p || Math.hypot(p.x - x, p.y - y) > 46) continue;
			const offers = npcOffers(n);
			const actions = [{
				id: `talk:${n.id}`,
				label: "Speak"
			}];
			if (offers.includes("Companionship")) actions.push({
				id: `join:${n.id}`,
				label: save.party?.includes(n.id) ? "With you" : "Ask to follow"
			});
			return {
				hint: `${n.name} · ${offers.join(" · ") || "Talk"}`,
				title: n.name,
				lines: [
					n.role,
					offers.length ? `Offers ${offers.join(", ")}.` : "They will talk if you ask.",
					`Party ${save.party?.length ?? 0} / 3`
				],
				actions
			};
		}
		for (const node of this.world.spawns) if (node.kind === "node" && Math.hypot(node.x - x, node.y - y) < 40) {
			const info = { tree: ["Tree · chop for logs", "Resource tree", "Chop logs to build a campfire, cook meals, and purify water.", "Chop logs"], ore: ["Ore vein · mine", "Ore vein", "Mine ore for a Ghost Box (4 ore + 4 logs), or sell it from the Bag.", "Mine ore"], shroom: ["Mushroom patch · forage", "Mushroom patch", "Forage mushrooms and alchemy spores.", "Forage"] }[node.node];
			if (info) return { hint: info[0], title: info[1], lines: [info[2], this.rules === "hardcore" ? "Press E beside it. Once gathered it grows back in this spot after you sleep or a new day dawns." : "Press E beside it. Once gathered it grows back in this spot the next in-game day."], actions: [{ id: `chop:${node.id}`, label: info[3] }] };
		}
		const tileAt = this.world.tiles[Math.floor(y / 32) * this.world.w + Math.floor(x / 32)];
		if (tileAt && tileAt.floor === 2) return {
			hint: "Water · fish here", title: "Water", lines: ["Any water tile can be fished. A bite takes 1-10 seconds."].concat(this.rules === "hardcore" ? ["Hardcore: you can also collect raw water here."] : []),
			actions: [{ id: "fish", label: "Fish here" }].concat(this.rules === "hardcore" ? [{ id: "water", label: "Collect water" }] : [])
		};
		for (const p of POIS) {
			const pos = poiPos(p);
			if (!pos || Math.hypot(pos.x - x, pos.y - y) > 56) continue;
			if (p.kind === "dungeon") return {
				hint: `${p.name} · rift`,
				title: p.name,
				lines: ["A dungeon door. Walk up and press E. Each visit is a fresh instance; foes you kill inside stay dead until you leave.", this.rules === "hardcore" ? "Hardcore death takes this body, including inside dungeons." : "Die in there and you are knocked out. Kyo bleeds. Gear stays."],
				actions: []
			};
			if (p.kind === "shrine") return {
				hint: `${p.name} · arena`,
				title: p.name,
				lines: ["A battle arena. Speak to the keeper at the door.", this.rules === "hardcore" ? "Hardcore death takes this body. The shrine does not heal you between rounds." : "A loss here is a knockout, not the veil."],
				actions: []
			};
			if (p.kind === "node") return {
				hint: `${p.node} node`,
				title: p.node,
				lines: ["Press E beside it, or gather from this menu."],
				actions: [{
					id: "gather",
					label: "Gather"
				}]
			};
			if (p.kind === "boss") return {
				hint: p.name,
				title: p.name,
				lines: [`World boss · ${TYPES[p.type].name}`, bodyRead(p.type).line],
				actions: []
			};
		}
		return null;
	}
	preview(canvas, race, classId?: ClassId, female = true) {
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = "#1c1412";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const r = RACES.find((x) => x.id === race);
		drawActor(ctx, {
			x: canvas.width / 2,
			y: canvas.height - 8,
			race,
			classId,
			female,
			hair: r.hair,
			skin: RACES.findIndex((x) => x.id === race),
			facing: 1,
			walk: performance.now() / 400,
			attack: 0,
			hurt: 0,
			tall: 1,
			pieces: [
				{
					slot: "chest",
					style: 0,
					type: r.type,
					fxSeed: 1,
					quality: 3
				},
				{
					slot: "legs",
					style: 0,
					type: r.type,
					fxSeed: 2,
					quality: 2
				},
				{
					slot: "head",
					style: 1,
					type: r.type,
					fxSeed: 3,
					quality: 2
				},
				{
					slot: "feet",
					style: 0,
					type: r.type,
					fxSeed: 0,
					quality: 1
				}
			],
			setFx: "lanternwake",
			setOn: true,
			scale: 1.7
		});
	}
	/** Plain words for what killed this witch. */
	causeOfDeath() {
		const h = this.lastHit;
		if (!h) return "Fell to unknown causes.";
		if (h.survival) return h.by === "hunger" ? "Starved in the wilds." : h.by === "thirst" ? "Died of thirst." : "Collapsed from exhaustion.";
		const who = `${h.by}${h.kind ? ` (${h.kind}, level ${h.level})` : ` (level ${h.level})`}`;
		if (h.mark) return `Caught in ${who}'s Death Mark.`;
		return `Killed by ${who}${h.move ? ` with ${h.move}` : ""}${h.burning ? ", burning" : ""}.`;
	}
	/** How she looked: enough for the leaderboard to draw her and for the Discord GIF. */
	graveLook(save) {
		const race = RACES.find((r) => r.id === save.race);
		const set = this.setInfo();
		const qualities = ["worn", "common", "fine", "rare", "epic", "legendary"];
		const pieces = ["weapon", "head", "chest", "legs", "feet", "relic"].map((slot) => this.piece(slot)).filter(Boolean)
			.map((g) => ({ slot: g.slot, style: g.style, type: g.type, fxSeed: g.fxSeed, gene: geneSeedOf(g), quality: Math.max(0, qualities.indexOf(g.quality)) }));
		return {
			race: save.race, classId: save.classId, female: save.female !== false, hair: race?.hair ?? 0,
			skin: Math.max(0, RACES.findIndex((r) => r.id === save.race)), tall: race?.tall ?? 1, pieces,
			setFx: set.fx ?? null, setOn: !!set.on, setVariant: set.variant ?? 0, scale: 1, direction: "down",
		};
	}
	emitGrave(save, score) {
		if (!this.graveFn || !score) return;
		const gear = [];
		const effects = [];
		const qualities = ["worn", "common", "fine", "rare", "epic", "legendary"];
		for (const slot of ["weapon", "head", "chest", "legs", "feet", "relic"]) {
			const g = this.piece(slot);
			if (!g) continue;
			const label = fxTraitLabel(fxTrait(geneSeedOf(g), g.slot, Math.max(0, qualities.indexOf(g.quality))));
			if (label) effects.push(`${label} (${TYPES[g.type]?.name ?? g.type})`);
			gear.push({
				slot,
				name: g.name,
				level: g.level,
				quality: qualityName(g.quality),
				type: TYPES[g.type]?.name ?? g.type,
				enchants: (g.enchants ?? []).map((e) => ({ name: ENCHANT_BY_ID[e.id]?.name ?? e.id, power: e.power })),
				moves: (g.moves ?? []).map((id) => MOVE_BY_ID[id]?.name ?? id),
				fx: label
			});
		}
		const set = this.setInfo();
		if (set.on && set.name) effects.push(`${set.name} set aura`);
		const out = this.activeSpirits();
		const ghosts = (save.spirits ?? []).map((sp) => ({ name: sp.name, type: sp.type, level: sp.level, rarity: sp.rarity, shiny: !!sp.shiny }));
		if (ghosts.some((g) => g.shiny)) effects.push("Shiny ghost");
		const look = this.graveLook(save);
		const body: GraveBody = {
			mode: this.turbz ? "turbz" : this.rules === "hardcore" ? "hardcore" : "hunt",
			score,
			name: save.name,
			race: RACES.find((r) => r.id === save.race)?.name ?? save.race,
			level: save.level,
			accountScore: save.accountScore ?? 0,
			skills: SKILLS.map((sk) => ({ name: sk.name, level: save.skills[sk.id]?.level ?? 1 })),
			gear,
			note: this.turbz ? "Died in TURBZ. The wild kept what she was wearing, at level 1." : this.rules === "hardcore" ? "Died grinding the hardcore wilds." : "Died on the hunt.",
			className: CLASS_BY_ID[save.classId]?.name ?? "",
			cause: this.causeOfDeath(),
			place: snap.region || "",
			effects,
			ghosts,
			look
		};
		const fn = this.graveFn;
		const deathGhosts = out.map((sp) => ({ type: sp.type, rarity: sp.rarity, level: sp.level, speed: sp.speed, max: sp.max, shiny: !!sp.shiny, uid: sp.uid, template: sp.template, look: sp.look ?? null, palette: sp.palette ?? null }));
		// The GIF for Discord is drawn a moment later so dying never stutters.
		setTimeout(() => {
			let gif = null;
			try { gif = captureDeathGif(look, deathGhosts); } catch { gif = null; }
			try { fn(gif ? { ...body, gif } : body); } catch { /* the board can wait */ }
		}, 50);
	}
	tickParties(dt) {
		const save = this.save;
		if (!save || save.map !== "world" || this.dead || this.duel) return;
		if (this.mobs.some((m) => m.alive && m.party)) return;
		this.partyIn = (this.partyIn ?? 22) - dt;
		if (this.partyIn > 0) return;
		this.partyIn = 46 + Math.random() * 30;
		this.spawnHuntParty();
	}
	spawnHuntParty() {
		const save = this.save;
		if (!save || !this.world) return;
		const witches = 2 + Math.floor(Math.random() * 9);
		const summoners = 1 + Math.floor(Math.random() * 5);
		const party = `party-${nextUid()}`;
		const lvl = Math.max(1, save.level);
		let anchorX = save.x + 220;
		let anchorY = save.y;
		for (let i = 0; i < 28; i++) {
			const ang = Math.random() * Math.PI * 2;
			const dist = 190 + Math.random() * 150;
			const wx = save.x + Math.cos(ang) * dist;
			const wy = save.y + Math.sin(ang) * dist;
			if (blocked(this.world, wx, wy)) continue;
			anchorX = wx;
			anchorY = wy;
			break;
		}
		const pool = MOVES.filter((m) => m.power > 8 && m.power < 56 && m.effect !== "mend" && reactOf(m) === "strike");
		const make = (summoner, index) => {
			const race = RACES[Math.floor(Math.random() * RACES.length)];
			const name = WITCH_NAMES[Math.floor(Math.random() * WITCH_NAMES.length)];
			const spell = pool.find((m) => m.type === race.type) ?? pool[index % Math.max(1, pool.length)] ?? huntMove(race.type);
			const mob = this.makeMob({
				id: `${party}-${index}`,
				species: "muma",
				x: anchorX + ((index % 5) - 2) * 28,
				y: anchorY + (Math.floor(index / 5) - 1) * 26,
				level: Math.max(1, lvl - 1),
				template: 20,
				type: race.type,
				name: summoner ? `Summoner ${name}` : name
			});
			mob.witch = true;
			mob.party = party;
			mob.summoner = summoner;
			mob.race = race.id;
			mob.move = spell.id;
			mob.hp = mob.max = Math.floor((62 + lvl * 11) * (summoner ? 0.72 : 0.6));
			mob.speed = 8 + Math.floor(lvl * 0.3) + spell.priority + (summoner ? 0 : 2);
			mob.aggro = true;
			mob.huntIn = 0;
			mob.seen = false;
			mob.lootKyo = 4 + lvl;
			this.mobs.push(mob);
		};
		for (let i = 0; i < witches; i++) make(false, i);
		for (let i = 0; i < summoners; i++) make(true, witches + i);
		this.say(`A witch party. ${witches} witches and ${summoners} summoners. Weaker than a lone huntress. They strike first.`);
		this.cue("boom", { rate: 0.75 }, [110, .18, "sawtooth"]);
	}
	engagedFoes() {
		const save = this.save;
		if (!save) return [];
		const out = [];
		for (const m of this.mobs) {
			if (!m.alive) continue;
			if (m.animal && m.species !== "wolf" && m.species !== "boar") continue;
			const move = MOVE_BY_ID[m.move] ?? MOVES[0];
			const reach = Math.max(52, attackRange(move) * (m.party ? 0.82 : 1));
			const d = Math.hypot(m.x - save.x, m.y - save.y);
			const hot = !!(m.party || m.witch || m.aggro || m.hurt > 0 || m.boss);
			if ((hot && d <= reach) || (!m.animal && d <= reach * 0.8)) out.push(m);
		}
		return out;
	}
	tickHardcore(dt) {
		const save = this.save;
		if (!save || this.dead || this.role === "guest") return;
		if (this.duel) {
			this.duel.wait = (this.duel.wait ?? 0) + dt;
			if (this.duel.wait > 14 && this.duel.phase === "answer") {
				const guard = MOVE_BY_ID.brace ?? this.arsenal(save).find((m) => reactOf(m) === "guard") ?? MOVES[0];
				this.resolveExchange(guard);
			}
			return;
		}
		const foes = this.engagedFoes();
		if (foes.length) this.openDuel(foes);
	}
	openDuel(foes) {
		const ranked = [...foes].sort((a, b) => {
			const ma = MOVE_BY_ID[a.move] ?? MOVES[0];
			const mb = MOVE_BY_ID[b.move] ?? MOVES[0];
			return (b.speed ?? 0) * 10 + mb.priority * 8 - ((a.speed ?? 0) * 10 + ma.priority * 8);
		});
		this.duel = { phase: "answer", queue: ranked, lead: null, moveId: "", beat: "", followers: [], wait: 0 };
		this.declareLead();
		this.say("They are in range. Answer before the verse plays. You never open.");
		this.syncHud(true);
	}
	declareLead() {
		const duel = this.duel;
		if (!duel) return;
		duel.wait = 0;
		while (duel.queue.length && !duel.queue[0].alive) duel.queue.shift();
		if (!duel.queue.length) {
			duel.phase = "yours";
			duel.lead = null;
			duel.moveId = "";
			duel.followers = [];
			duel.beat = "Your verse. The party has spent this round.";
			this.syncHud(true);
			return;
		}
		const lead = duel.queue.shift();
		const followers = [];
		while (followers.length < 2 && duel.queue.length) {
			const next = duel.queue[0];
			if (!next?.alive) { duel.queue.shift(); continue; }
			followers.push(duel.queue.shift());
		}
		const move = MOVE_BY_ID[lead.move] ?? MOVES[0];
		duel.phase = "answer";
		duel.lead = lead;
		duel.followers = followers;
		duel.moveId = move.id;
		duel.beat = `${lead.name} readies ${move.name}${followers.length ? ` · ${followers.length} more in the beat` : ""}. Choose.`;
		this.float(lead.x, lead.y - 42, move.name, "#fff1a8");
		this.syncHud(true);
	}
	answerDuel(move) {
		const save = this.save;
		const duel = this.duel;
		if (!save || !duel) {
			this.say("Walk into their reach. They start the fight.");
			return;
		}
		if (duel.phase === "yours") {
			const foe = this.engagedFoes().sort((a, b) => a.hp - b.hp)[0];
			if (!foe) {
				this.duel = null;
				this.syncHud(true);
				return;
			}
			this.duelAllow = true;
			const ok = this.castMove(move, foe);
			this.duelAllow = false;
			if (!ok) return;
			this.defFatigue = Math.max(0, (this.defFatigue ?? 0) - 0.4);
			const still = this.engagedFoes();
			if (!still.length) {
				this.duel = null;
				this.say("The party breaks.");
			} else this.openDuel(still);
			this.syncHud(true);
			return;
		}
		this.resolveExchange(move);
	}
	incomingOf(mob) {
		const move = MOVE_BY_ID[mob.move] ?? MOVES[0];
		const dmg = this.foeHitRaw(mob, move, Math.hypot((this.save?.x ?? 0) - mob.x, (this.save?.y ?? 0) - mob.y));
		return Math.max(1, dmg * (1 - bend(defenseVs(this.foeForm(mob, move), this.chan("ward") / 160 + (this.buff?.ward ?? 0)), 0.45, 0.8)));
	}
	resolveExchange(pMove) {
		const save = this.save;
		const duel = this.duel;
		if (!save || !duel?.lead) return;
		const lead = duel.lead;
		const eMove = MOVE_BY_ID[duel.moveId] ?? MOVE_BY_ID[lead.move] ?? MOVES[0];
		const kind = reactOf(pMove);
		const fatigue = this.defFatigue ?? 0;
		let incoming = lead.alive ? this.incomingOf(lead) : 0;
		for (const f of duel.followers ?? []) if (f?.alive) incoming += this.incomingOf(f) * .4;
		incoming *= 1 / (1 + Math.min(6, (duel.queue?.length ?? 0) * .12));
		const fail = Math.random() * 100 < defenseFail(pMove, fatigue);
		let note = "TRADE";
		const chip = (mult) => {
			if (!lead.alive || pMove.power <= 0) return;
			this.duelAllow = true;
			this.resolveHit(pMove, lead, false, mult);
			this.duelAllow = false;
		};
		if (lead.summoner && lead.alive && Math.random() < .62 && this.mobs.filter((m) => m.alive && m.master === lead.id).length < 2) {
			this.spawnPartySpirit(lead);
			incoming *= .32;
			note = "SUMMON";
		}
		if (kind === "guard") {
			incoming *= Math.max(.25, .46 / abilityMultiplier(save, pMove.id));
			this.defFatigue = Math.max(0, fatigue - .35);
			note = note === "SUMMON" ? note : "GUARD";
		} else if (kind === "heal") {
			incoming *= .8;
			const heal = (14 + Math.max(8, pMove.power) * .4) * abilityMultiplier(save, pMove.id);
			save.hp = Math.min(this.maxHp(), save.hp + heal);
			this.float(save.x, save.y - 52, `+${Math.floor(heal)}`, "#9ad8c8");
			note = "MEND";
		} else if (kind === "roll") {
			this.defFatigue = fatigue + 1;
			if (fail) {
				incoming *= 1.3;
				note = "TRIP";
			} else {
				const travel = 30 + Math.random() * 58;
				const cover = rollCover(travel, attackRange(eMove));
				incoming *= 1 - cover * .82;
				if (cover >= .98) incoming = 0;
				const side = this.facing > 0 ? 1 : -1;
				this.tryMove(-side * travel * .42, side * Math.min(26, travel * .28));
				chip(.28 + cover * .12);
				note = incoming <= 0 ? "CLEAR" : cover > .55 ? "GRAZE" : "CLIP";
			}
		} else if (kind === "counter") {
			this.defFatigue = fatigue + (fail ? 1.2 : .3);
			if (fail) {
				incoming *= 1.36;
				note = "SLIP";
			} else {
				incoming *= .12;
				chip(.58);
				note = "RIPOSTE";
				if (Math.random() < .42 && duel.queue?.length) {
					const skipped = duel.queue.shift();
					if (skipped) this.float(skipped.x, skipped.y - 28, "STAGGER", "#fff1a8");
				}
			}
		} else if (kind === "move") {
			this.defFatigue = fatigue + (fail ? 1 : .45);
			if (fail) {
				incoming *= 1.16;
				chip(.2);
				note = "SNAG";
			} else {
				incoming *= .36;
				if (moveTactic(pMove) === "blink" && lead.alive) {
					const behind = lead.x >= save.x ? 1 : -1;
					const nx = lead.x + behind * 28;
					const ny = lead.y + 4;
					if (!blocked(this.world, nx, ny)) {
						save.x = nx;
						save.y = ny;
					}
					this.facing = behind > 0 ? -1 : 1;
				} else if (lead.alive) this.tryMove((lead.x - save.x) * .25, (lead.y - save.y) * .25);
				chip(.46);
				note = "SLIDE";
			}
		} else {
			const mine = pMove.priority * 8 + this.playerSpeed();
			const theirs = eMove.priority * 8 + (lead.speed ?? 0);
			if (mine > theirs && Math.random() < .55) {
				incoming *= .6;
				note = "CUT IN";
			}
			this.defFatigue = Math.max(0, fatigue - .5);
			chip(moveTactic(pMove) === "heavy" || moveTactic(pMove) === "channel" ? 1.05 : .9);
		}
		this.playMoveFx(eMove, lead.x, lead.y - 16, save.x, save.y - 18);
		this.playMoveFx(pMove, save.x, save.y - 20, lead.x, lead.y - 12);
		this.float(save.x, save.y - 64, note, "#fff1a8");
		if (incoming > .75) this.hurtSelf(incoming, eMove.effect);
		if (attackForm(pMove) === "spell" || moveTactic(pMove) === "channel") this.gainSkill("magic", 4);
		else this.gainSkill("physical", 3);
		this.advanceDuel();
	}
	advanceDuel() {
		if (!this.duel) return;
		if (this.save && this.save.hp <= 0) return;
		if (!this.engagedFoes().length) {
			this.duel = null;
			this.say("The party breaks.");
			this.syncHud(true);
			return;
		}
		this.declareLead();
	}
	spawnPartySpirit(master) {
		const pool = MONSTERS.filter((d) => d.type === "spirit" || d.type === master.type);
		const spec = pool[Math.floor(Math.random() * pool.length)] ?? MONSTERS[0];
		const pet = this.makeMob({
			id: `summon-${nextUid()}`,
			species: spec.id,
			x: master.x + (Math.random() < .5 ? -26 : 26),
			y: master.y + 16,
			level: Math.max(1, master.level - 2),
			template: spec.template,
			type: spec.type,
			name: spec.name
		});
		pet.master = master.id;
		pet.party = master.party;
		pet.aggro = true;
		pet.hp = pet.max = Math.floor(pet.max * .45);
		pet.speed = Math.max(6, (pet.speed ?? 8) - 2);
		this.mobs.push(pet);
		this.float(master.x, master.y - 46, "SUMMON", "#c9a6e8");
		this.say(`${master.name} calls ${pet.name}.`);
	}
}
function typeChart(a, d) {
	if (TYPES[d].immune.includes(a)) return 0;
	if (TYPES[a].strong.includes(d)) return 2;
	if (TYPES[a].weak.includes(d)) return .5;
	return 1;
}
function mitigate(dmg, armor) {
	return dmg * (100 / (100 + Math.max(0, armor)));
}
function hearthXY() {
	const main = mainWorldHearth();
	if (main) return main;
	const p = scaleTile(30, 33);
	return {
		x: p.tx * 32 + 16,
		y: p.ty * 32 + 16
	};
}
function nearestOpen(world, x, y) {
	if (!world) return { x, y };
	const hit = (px, py) => blocked(world, px, py) || blocked(world, px - 7, py) || blocked(world, px + 7, py);
	if (!hit(x, y)) return { x, y };
	for (let r = 1; r <= 12; r++) {
		for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
			if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
			const nx = x + dx * 32;
			const ny = y + dy * 32;
			if (!hit(nx, ny)) return { x: nx, y: ny };
		}
	}
	return hearthXY();
}
function effectTint(effect, color) {
	if (effect === "burn") return "#ffb15e";
	if (effect === "soak") return "#7ec8ea";
	if (effect === "root") return "#6ecf6a";
	if (effect === "sleep") return "#d6c6f5";
	if (effect === "gloom") return "#6a4cff";
	if (effect === "spark") return "#f2d43a";
	if (effect === "leech" || effect === "drain") return "#ff4d6a";
	if (effect === "silence") return "#c8c0b0";
	if (effect === "expose") return "#fff1a8";
	return color;
}
function bossName(id) {
	if (id === "bone_king") return "Bone King";
	if (id === "ash_regent") return "Ash Regent";
	if (id === "tide_tyrant") return "Tide Tyrant";
	if (id === "void_cantor") return "Void Cantor";
	if (id === "marrow_saint") return "Marrow Saint";
	return "Warlord";
}
function poiPos(p) {
	if (p.kind === "npc") {
		const n = NPCS.find((x) => x.id === p.id);
		if (!n) return null;
		const s = scaleTile(n.tx, n.ty);
		return {
			x: s.tx * 32 + 16,
			y: s.ty * 32 + 20
		};
	}
	if ("tx" in p) {
		const s = scaleTile(p.tx, p.ty);
		return {
			x: s.tx * 32 + 16,
			y: s.ty * 32 + 18
		};
	}
	return null;
}
//#endregion
//#region src/components/turbz-app.tsx
