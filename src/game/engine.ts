// @ts-nocheck
import { itemUseProblem, bestFood } from "./item-use";
import { normalizeSurvival, advanceSurvival, consumeMaterials, craftAtCamp, waterWithinReach, nearestWaterTile, nearestShore, CAMP_RECIPES, FOOD, type SurvivalState } from "./survival";
import { normalizeAbilities, spendAbilityPoint, abilityMultiplier, POINTS_PER_LEVEL } from "./ability-progression";
import { advanceDungeonClock, buildProceduralDungeon, normalizeDungeonState, DUNGEON_INTERVAL, type DungeonState } from "./procedural-dungeon";
import { P2PRoom } from "@/lib/multiplayer";
import {
  CLASS_BY_ID,
  LEGACY_CLASS,
  type ClassId,
  ENCHANTS,
  ENCHANT_BY_ID,
  MAX_CHARACTER_LEVEL,
  MAX_SKILL_LEVEL,
  MAX_GEAR_ENCHANTS,
  perkText,
  xpNeed,
  ANIMAL_BY_ID,
  ITEM_BY_ID,
  ITEMS,
  ALCHEMY_RECIPES,
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
  TILE,
  TYPES,
  WITCH_NAMES,
  CLASSES,
  CLASS_RACE,
  accountNeed,
  attackForm,
  attackRange,
  formTag,
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
import { readAccountMeta, writeAccountMeta } from "./account-save";
import { aptitudeOf, buffLines, classProfile, classGendered, IMMUNE_LABEL, STAT_LABEL, TRAIT_BY_ID } from "./classes";
import { drawActor, drawMonster, drawSetAura, drawShadowName, fxColor } from "./sprites";
import { expandZones, mapToWorld, savedMaps } from "./map-format";
import { CombatFx } from "./combat-fx";
import { directionFromDelta, type ActorDirection } from "./actor-sheets.config";
import { initActorSprites } from "./actor-sprites";
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
  drawWorldSlice,
  paintNode,
  paintWorld,
  pickNodeSpot,
  reachableFrom,
  type Tavern,
  type WorldData,
} from "./world";

export type Panel = null | "sheet" | "lobby" | "bag" | "skills" | "quests" | "map" | "talk" | "shop" | "death" | "pause" | "trade" | "ghost" | "moves" | "chat" | "bounty" | "rebirth" | "survival" | "craft";
export type Snap = {
  mode: "title" | "create" | "play";
  hasSave: boolean;
  panel: Panel;
  name: string;
  race: RaceId;
  level: number;
  dungeonCountdown: number;
  dungeonPortals: { id: string; x: number; y: number; cleared: boolean }[];
  skillPoints: number;
  abilities: (Move & { rank: number })[];
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
  talk: { id: string; name: string; role: string; line: string; shop: string | null; shrine: TypeId | null } | null;
  gear: Gear[];
  equipped: string[];
  setLabel: string;
  setBonus: string;
  setCount: number;
  totals: { id: string; name: string; power: number }[];
  skills: { id: SkillId; name: string; level: number; xp: number; need: number; line: string }[];
  bag: { id: string; name: string; count: number; about: string; useProblem: string | null }[];
  death: { id: string; name: string; kind: "gear" | "item" }[];
  peers: string[];
  roomCode: string;
  net: string;
  chat: { name: string; text: string }[];
  trade: { open: boolean; peer: string; mine: string; theirs: string; me: boolean; them: boolean } | null;
  shrine: string;
  companion: string;
  box: string[];
  spirits: { uid: string; name: string; type: TypeId; level: number; rarity: number; hp: number; max: number; active: boolean; known: { id: string; name: string; about: string; type: TypeId; player: boolean; slotted: boolean }[]; slots: string[] }[];
  spiritSlots: number;
  spiritCap: number;
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
  perks: { id: string; name: string; power: number; max: number; about: string }[];
  bounty: string;
  bountyPlace: string;
  unstuck: number;
  unlocked: { id: string; name: string; race: RaceId; bonus: string }[];
  hint: string;
  foe: string;
  menu: { sx: number; sy: number; title: string; lines: string[]; actions: { id: string; label: string }[] } | null;
  mapX: number;
  mapY: number;
  party: string[];
  autoplay: boolean;
  grind: string;
  accountScore: number;
  turn: string;
  survival: SurvivalState | null;
  nearCamp: boolean;
  nearWater: boolean;
  nearTree: boolean;
  sleeping: boolean;
  rules: "hunt" | "hardcore";
  duel: null | { phase: "answer" | "yours"; attacker: string; move: string; about: string; beat: string };
  classId: string;
  sheet: Sheet | null;
  lobby: { code: string; role: "solo" | "host" | "guest"; net: string; members: { id: string; name: string; classId: string; className: string; level: number; hp: number; max: number; map: string; self: boolean; host: boolean }[] };
};
export type Sheet = {
  name: string; classId: string; className: string; role: string; type: TypeId; blurb: string; specialty: string; passive: string; female: boolean; gendered: boolean;
  level: number; xp: number; xpNeed: number; hp: number; maxHp: number; shield: number; kyo: number; skillPoints: number;
  trait: { id: string; name: string; about: string } | null;
  stats: { id: string; name: string; value: string; about: string; mod: number }[];
  buffs: string[]; debuffs: string[];
  effects: { id: string; label: string; t: number; good: boolean }[];
  aptitudes: { id: string; name: string; level: number; mult: number }[];
  moves: { id: string; name: string; type: TypeId; rank: number; tactic: string; signature: boolean; movement: boolean; about: string }[];
  gear: { slot: string; name: string; quality: string; stat: string }[];
  combat: { label: string; value: string }[];
  account: { level: number; score: number; perks: number };
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
  known?: string[]; slots?: string[]; active?: boolean;
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
  spirits?: Spirit[]; accountScore?: number; evilMark?: number; deathBanked?: boolean; traitId?: string | null; female?: boolean; classMovesV?: number;
  ghostSlots?: number; jarLeft?: number;
};
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: string };
type Flo = { x: number; y: number; text: string; life: number; color: string };
type TurnStep = { side: "you" | "foe" | "spirit"; id: string };

const SAVE_KEY = "turbz-v3";
const HC_KEY = "turbz-hardcore-v1";
const emptySnap = (): Snap => ({
	mode: "title",
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
	region: "Crownfall Citadel",
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
	spiritCap: 20,
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
	unstuck: 0,
	unlocked: [],
	hint: "",
	foe: "",
	menu: null,
	mapX: 0,
	mapY: 0,
	party: [],
	autoplay: false,
	grind: "",
	accountScore: 0,
	turn: "",
	survival: null, nearCamp: false, nearWater: false, nearTree: false, sleeping: false,
	rules: "hunt",
	duel: null,
	classId: "",
	sheet: null,
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
function publish(p: Partial<Snap>): void {
	snap = {
		...snap,
		...p
	};
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
export class TurbzGame {
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	// recovered fields stay loose; combat fields are assigned in methods
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[k: string]: any;
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
		this.castLock = 0;
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
			if (this.typing() || snap.mode !== "play" || this.dead || e.ctrlKey || e.metaKey || e.altKey) return;
			this.keys.add(e.code);
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
			if (e.code === "KeyE") this.interact();
			if (e.code === "KeyI" || e.code === "KeyB") this.toggle("bag");
			if (e.code === "KeyK") this.toggle("skills");
			if (e.code === "KeyQ") this.toggle("quests");
			if (e.code === "KeyM") this.toggle("map");
			if (e.code === "KeyG") this.toggle("ghost");
			if (e.code === "KeyX") this.toggle("craft");
			if (e.code === "KeyV") this.toggle("moves");
			if (e.code === "KeyC") this.toggle("sheet");
			if (e.code === "KeyL") this.toggle("lobby");
			if (e.code === "KeyH" && this.rules === "hardcore") this.toggle("survival");
			if (e.code === "KeyT") this.toggleTrade();
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
			if (AC) this.audio = new AC();
		}
		this.audio?.resume();
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
			await audio.play();
		} catch {}
	}
	tone(freq, dur, type = "square") {
		if (!this.audio) return;
		const o = this.audio.createOscillator();
		const g = this.audio.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.value = .035;
		o.connect(g);
		g.connect(this.audio.destination);
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
	begin(name, race: RaceId, as, classId: ClassId = LEGACY_CLASS[race], traitId: string | null = null, female = true) {
		this.captureProgress(this.peekRuleSave());
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
		const home = hearthXY();
		const save = {
			v: 3,
			name: (name || "Huntress").slice(0, 16),
			race,
			classId,
			traitId: traitId && TRAIT_BY_ID[traitId] ? traitId : null,
			female: female !== false,
			classMovesV: 2,
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
			spirits: [],
			accountScore: 0,
			evilMark: 0,
			deathBanked: false
		};
		this.boot(save);
		save.hp = this.maxHp();
		this.say(this.rules === "hardcore" ? `${save.name} wakes in the frontier. Hunt, gather water, and build a fire. Healing spells mend lasting wounds.` : `${save.name} wakes at the Crownfall hearth.`);
		if (as) this.openRoom(as.role, as.code);
		this.tone(220, .12);
	}
	continueGame(as?: { role: "host" | "guest"; code: string }) {
		const cached = this.rules === "hardcore" ? this.cloudHard : this.cloudCache;
		const key = this.rules === "hardcore" ? HC_KEY : SAVE_KEY;
		const raw = cached ? JSON.stringify(cached) : localStorage.getItem(key);
		if (!raw) return false;
		try {
			this.boot(JSON.parse(raw));
			this.say("The hearth kept your skills.");
			if (as) this.openRoom(as.role, as.code);
			return true;
		} catch {
			return false;
		}
	}
	boot(save) {
		this.direction = "down";
		this.duel = null; this.sleeping = false;
		this.normalize(save);
		this.save = save;
		this.overworld = buildWorld(save.seed, this.rules === "hardcore");
		this.mobs = [];
		this.contract = [];
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
			panel: this.dead ? "rebirth" : null,
			hasSave: true
		});
		this.syncHud(true);
		this.persist();
	}
	loadMap(map, freshMobs) {
		const save = this.save;
		if (!save) return;
		if (map === "world") {
			if (!this.overworld) this.overworld = buildWorld(save.seed, this.rules === "hardcore");
			this.world = this.overworld;
			this.world.cache = null;
		} else if (map.startsWith("custom-")) {
			const file = savedMaps().find((m) => `custom-${m.id}` === map);
			if (!file) return this.loadMap("world", true);
			this.customFile = file;
			this.world = mapToWorld(file);
			this.world.spawns.push(...expandZones(file));
			this.world.entry = { x: (file.spawn?.tx ?? 1) * 32 + 16, y: (file.spawn?.ty ?? 1) * 32 + 16 };
		} else if (map.startsWith("rift-")) {
			const portal = save.dungeons.portals.find(p => p.id === map);
			if (!portal) return this.loadMap("world", true);
			this.world = buildProceduralDungeon(portal.seed, portal.level);
			this.world.spawns = this.world.spawns.filter(s => !portal.defeated.includes(s.id));
		} else {
			this.world = buildDungeon(map, save.seed);
			paintWorld(this.world);
		}
		const witch = this.mobs.find((m) => m.witch && m.alive && !m.bounty && !m.bountySpirit) ?? null;
		this.stashContract();
		if (freshMobs || this.mobs.length === 0 || map !== "world") {
			this.mobs = this.world.spawns.filter((s) => s.kind === "mob").map((s) => this.makeMob(s));
			if (map === "world" && witch) this.mobs.push(witch);
		}
		this.restoreContract(map);
		save.map = map;
	}
	makeMob(s) {
		const species = s.species ?? "onibi";
		const def = MONSTER_BY_ID[species] ?? ANIMAL_BY_ID[species] ?? MONSTER_BY_ID.onibi;
		const animal = !!(s.animal || def.animal);
		const spiritKind = def.type === "spirit" || def.template === 16 || def.template === 23;
		const ghost = !animal && (spiritKind || Math.random() < 0.55);
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
		return {
			id: s.id,
			species,
			name: s.name ?? (s.bossId ? bossName(s.bossId) : def.name),
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
			zone: s.zone ?? null
		};
	}
	step(dt) {
		if (!this.save || snap.mode !== "play" || this.dead) {
			this.vx = 0;
			this.vy = 0;
			return;
		}
		if (document.hidden) return;
		if (this.role !== "guest") this.tickContract(dt);
		this.tickUnstuck(dt);
		if (snap.panel === "pause" || snap.panel === "death") {
			this.vx = 0;
			this.vy = 0;
			if (this.unstuckT > 0 || this.liveBounty()) this.syncHud(false);
			return;
		}
		if (this.role !== "guest") this.tickDungeons(dt);
		this.tickPlayer(dt);
		if (this.dead) return;
		if (this.role !== "guest") {
			this.tickMobs(dt);
		} else this.tickGuestHurt(dt);
		this.tickSpirits(dt);
		this.tickTurns(dt);
		if (this.rules === "hardcore" && !this.dead) this.tickSurvival(dt);
		this.tickParty(dt);
		this.tickFx(dt);
		this.netAcc += dt;
		if (this.netAcc > .1) {
			this.netAcc = 0;
			this.broadcastPos();
		}
		this.mobAcc += dt;
		if (this.role === "host" && this.mobAcc > .25) {
			this.mobAcc = 0;
			this.broadcastMobs();
		}
		this.syncHud(false);
	}
	tickDungeons(dt) {
		const save = this.save;
		if (!save?.dungeons) return;
		const before = save.dungeons.elapsed;
		if (!advanceDungeonClock(save.dungeons, dt)) {
			if (Math.floor(before / 30) !== Math.floor(save.dungeons.elapsed / 30)) this.persist();
			return;
		}
		const state = save.dungeons;
		const world = this.overworld ?? this.world;
		const anchor = save.map === "world" ? save : hearthXY();
		const rng = mulberry32(save.seed ^ state.sequence * 7919);
		const at = nearestOpen(world, anchor.x + (rng() - .5) * 600, anchor.y + (rng() - .5) * 600);
		state.portals.push({ id: `rift-${state.sequence}`, seed: (save.seed ^ state.sequence * 104729) >>> 0, level: save.level, x: at.x, y: at.y, cleared: false, defeated: [] });
		this.say(`Dungeon ${state.sequence} has opened. Find its rift on the world map.`);
		this.room?.send({ t: "dungeons", dungeons: state });
		this.persist(); this.syncHud(true);
	}
	dungeonExitAt() { return this.world?.entry ?? dungeonExit(); }
	trackRift(id) {
		const portal = this.save?.dungeons?.portals.find(p => p.id === id && !p.cleared);
		if (!portal || this.save.map !== "world") return;
		if (Math.hypot(portal.x - this.save.x, portal.y - this.save.y) <= 120) { this.closePanel(); this.enterRift(id); }
		else { this.closePanel(); this.walkTo(portal.x, portal.y); this.say("Tracking the dungeon rift. Interact at its entrance."); }
	}
	enterRift(id) {
		const portal = this.save?.dungeons?.portals.find(p => p.id === id);
		if (!portal || portal.cleared || this.save.map !== "world" || Math.hypot(portal.x - this.save.x, portal.y - this.save.y) > 120) return false;
		const dungeon = buildProceduralDungeon(portal.seed, portal.level);
		this.travel(id, dungeon.entry); return true;
	}
	nearCamp() {
		const save = this.save;
		return !!save?.survival?.campfires.some(c => c.map === save.map && Math.hypot(c.x - save.x, c.y - save.y) <= 80);
	}
	tickSurvival(dt) {
		const s = this.save.survival, before = s.elapsed;
		if (this.sleeping && (!this.nearCamp() || this.combat > 0 || this.inFight())) this.sleeping = false;
		const damage = advanceSurvival(s, dt, this.sleeping);
		if (damage > 0) { this.save.hp -= damage; if (this.save.hp <= 0) this.die(); }
		if (this.sleeping && s.rest >= 100) { this.sleeping = false; this.say("Rested. Your wounds still need a healing spell."); }
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
			if (this.sleeping) this.sleeping = false;
			else {
				if (!this.nearCamp()) return this.say("Build a campfire before sleeping.");
				if (this.inFight() || this.combat > 0) return this.say("Clear nearby enemies before sleeping.");
				this.dest = null; this.sleeping = true; this.autoplay = false; this.channel = null; this.closePanel(); this.say("Sleeping by the fire. Food and water still drain.");
			}
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
			this.say(`Crafted ${Object.entries(made.outputs).map(([id, n]) => `${ITEM_BY_ID[id]?.name ?? id} x${n}`).join(", ")}.`);
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
		if (!this.duel) this.defFatigue = Math.max(0, (this.defFatigue ?? 0) - dt * 0.35);
		if (this.lunge) this.tickLunge(dt);
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
		this.cam.x += (save.x - this.cam.x) * Math.min(1, dt * 8);
		this.cam.y += (save.y - this.cam.y) * Math.min(1, dt * 8);
		for (const id of Object.keys(this.cds)) this.cds[id] = Math.max(0, (this.cds[id] ?? 0) - dt);
		this.status.forEach((s) => s.t -= dt);
		this.status = this.status.filter((s) => s.t > 0);
		if (this.buff.t > 0) this.buff.t -= dt;
		if ((save.jarLeft ?? 0) > 0) {
			save.jarLeft = Math.max(0, save.jarLeft - dt);
			if (save.jarLeft === 0) this.say("The jar's hum fades.");
		}
		this.hurt = Math.max(0, this.hurt - dt * 3);
		this.attackT = Math.max(0, this.attackT - dt * 3);
		if (this.status.find((s) => s.id === "burn")) this.hurtSelf(8 * dt, "burn");
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
				this.procSet(set.fx);
			}
		}
	}
	tryMove(dx, dy) {
		const save = this.save;
		const world = this.world;
		const x = save.x;
		const y = save.y;
		const hit = (x, y) => blocked(world, x, y) || blocked(world, x - 7, y) || blocked(world, x + 7, y) || blocked(world, x, y - 6);
		if (!hit(save.x + dx, save.y)) save.x += dx;
		if (!hit(save.x, save.y + dy)) save.y += dy;
		this.moving ||= save.x !== x || save.y !== y;
		this.direction = directionFromDelta(save.x - x, save.y - y, this.direction);
		if (save.x !== x) this.facing = save.x < x ? -1 : 1;
	}
	tickAutoplay(dt) {
		const save = this.save;
		if (this.dead || !this.world) return;
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
	planGrind() {
		const save = this.save;
		if (!save) return;
		const order = Object.keys(save.skills).sort((a, b) => {
			const A = save.skills[a];
			const B = save.skills[b];
			return A.level - B.level || A.xp - B.xp;
		});
		for (const id of order) if (this.aimSkill(id)) {
			this.grind = id;
			return;
		}
		this.grind = "wander";
		const ang = Math.random() * Math.PI * 2;
		this.walkTo(save.x + Math.cos(ang) * 180, save.y + Math.sin(ang) * 180);
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
		const foe = this.nearestMob(save.x, save.y, 2600);
		if (!foe) return false;
		if (Math.hypot(foe.x - save.x, foe.y - save.y) < 70) {
			this.path = [];
			return true;
		}
		return this.walkTo(foe.x, foe.y);
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
	/** A harvested node is destroyed. A replacement of the same kind appears elsewhere after a delay. */
	depleteNode(id) {
		const i = this.world.spawns.findIndex((n) => n.id === id && n.kind === "node");
		if (i < 0) return;
		const [node] = this.world.spawns.splice(i, 1);
		delete this.nodeCd[id];
		if (NODE_RESPAWN_SECONDS[node.node] != null) this.nodeRespawn.push({ node: node.node, auto: !!node.auto, map: this.save.map, t: NODE_RESPAWN_SECONDS[node.node] });
	}
	tickNodeRespawn(dt) {
		if (!this.nodeRespawn.length || !this.save || !this.world) return;
		const due = [];
		for (const r of this.nodeRespawn) {
			if (r.map !== this.save.map) continue;
			r.t -= dt;
			if (r.t <= 0) due.push(r);
		}
		if (!due.length) return;
		this.nodeRespawn = this.nodeRespawn.filter((r) => !due.includes(r));
		if (this.reachWorld !== this.world) { this.reachWorld = this.world; this.reachTiles = reachableFrom(this.world, this.save.x, this.save.y); }
		for (const r of due) {
			const spot = pickNodeSpot(this.world, this.reachTiles, this.save);
			if (!spot) { this.nodeRespawn.push({ ...r, t: 10 }); continue; }
			this.world.spawns.push({ id: `${r.node}-r${++this.nodeSeq}`, kind: "node", node: r.node, auto: r.auto, x: spot.x, y: spot.y, level: 1 });
		}
	}
	/** Fish from the nearest water tile. A bite takes 1-10 seconds; Fish Luck shortens it. */
	startFishing() {
		if (this.channel || this.dead || !this.save) return;
		const save = this.save;
		if (!nearestWaterTile(this.world, save.x, save.y, 80)) { this.say("Stand beside water to fish."); return; }
		const perk = 1 - Math.min(75, this.chan("fish_luck")) / 100;
		const skill = 1 - Math.min(70, this.skillN("fishing") * 0.175) / 100;
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
		return attackRange(MOVE_BY_ID[id] ?? MOVES[0]);
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
		dmg *= Math.max(.2, 1 + this.mod("might") / 100);
		dmg *= this.offenseFactor(mob, "melee");
		if (mob.boss) dmg *= 1 + this.chan("boss_bane") / 100;
		this.damageMob(mob, Math.max(1, dmg), false);
		this.gainSkill("physical", 2);
		this.combat = 3;
	}
	pointAt(x, y) {
		if (snap.mode !== "play" || this.dead || !this.save) return;
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
	/** TurboHunt always swings. Hardcore swings on its own only while autogrind is on. */
	autoAttacks() {
		return this.rules !== "hardcore" || !!this.autoplay;
	}
	isOffense(m) {
		const tac = moveTactic(m);
		return tac !== "heal" && tac !== "ward" && tac !== "roll" && tac !== "dash" && tac !== "surge" && m.effect !== "mend" && m.effect !== "shell";
	}
	moveReaches(m, dist) {
		const tac = moveTactic(m);
		const pad = tac === "blink" || tac === "lunge" ? 8 : 4;
		return dist <= attackRange(m) + pad;
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
		const pick = this.arsenal(save).filter((m) => (this.cds[m.id] ?? 0) <= 0 && this.isOffense(m) && this.moveReaches(m, dist))
			.sort((a, b) => this.moveScore(b, foe, magicBetter, dist) - this.moveScore(a, foe, magicBetter, dist))[0];
		if (!pick) return false;
		return this.castMove(pick, foe);
	}
	/** Manual swing. Always the nearest thing currently in range. */
	attack() {
		const save = this.save;
		if (!save || this.dead || snap.mode !== "play") return false;
		if (this.castLock > 0 || this.lunge) return false;
		const foe = this.fightTarget();
		if (foe && this.castOffense(foe)) return true;
		this.say(foe ? "Moves are still cooling." : "Nothing in range.");
		return false;
	}
	arsenal(save) {
		return Object.keys(save.abilityRanks ?? {}).filter(id => MOVE_BY_ID[id]).map(id => MOVE_BY_ID[id]);
	}
	spendAbility(id) {
		if (!this.save || this.dead || !spendAbilityPoint(this.save, id)) return false;
		this.syncArsenal(this.save);
		this.say(`${MOVE_BY_ID[id].name} rank ${this.save.abilityRanks[id]}.`);
		this.persist(); this.syncHud(true); return true;
	}
	syncArsenal(save) {
		const list = this.arsenal(save).map((m) => m.id);
		save.known = list;
		save.bar = list;
	}
	autoBattle() {
		const save = this.save;
		if (!save || this.dead || this.castLock > 0 || this.lunge) return false;
		const ready = this.arsenal(save).filter((m) => (this.cds[m.id] ?? 0) <= 0);
		const foe = this.fightTarget();
		const hpPct = save.hp / Math.max(1, this.maxHp());
		const by = (t: string) => ready.find((m) => moveTactic(m) === t);
		if (hpPct < .5) {
			const heal = by("heal");
			if (heal && this.castMove(heal)) return true;
		}
		if (foe && this.wardT < .25 && this.shield < 8 && hpPct < .75) {
			const ward = by("ward");
			if (ward && this.castMove(ward, foe)) return true;
		}
		if (foe && hpPct < .48) {
			const roll = by("roll");
			if (roll && Math.hypot(foe.x - save.x, foe.y - save.y) < 78 && this.castMove(roll, foe)) return true;
		}
		if (!foe) return false;
		return this.castOffense(foe);
	}
	moveScore(m, foe, magicBetter, dist) {
		const tac = moveTactic(m);
		const form = attackForm(m);
		let score = m.power + m.priority * 6;
		if (magicBetter === (form === "spell" || tac === "channel")) score += 28;
		score += typeChart(m.type, foe.type) * 18;
		if (tac === "blink" && dist > 48) score += 20;
		if (tac === "lunge" && dist > 40 && dist < 150) score += 16;
		if (tac === "heavy" && dist < 60) score += 14;
		if (tac === "channel" && dist < attackRange(m)) score += 10;
		return score;
	}
	castMove(move, prefer) {
		const save = this.save;
		if (!save || this.dead || snap.panel === "death" || !save.abilityRanks?.[move.id]) return false;
		if (this.castLock > 0 || this.lunge) return false;
		if (this.status.some((s) => s.id === "sleep")) return false;
		if ((this.cds[move.id] ?? 0) > 0) return false;
		if (this.status.some((s) => s.id === "silence") && move.priority < 2 && move.effect !== "mend") return false;
		const tactic = moveTactic(move);
		const selfCast = tactic === "heal" || tactic === "ward" || tactic === "roll" || tactic === "dash" || tactic === "surge" || move.effect === "mend" || move.effect === "shell";
		const reach = attackRange(move);
		const pad = tactic === "blink" || tactic === "lunge" ? 8 : 4;
		const distTo = (mob) => Math.hypot(mob.x - save.x, mob.y - save.y);
		let target = null;
		if (!selfCast) {
			if (prefer && prefer.alive && distTo(prefer) <= reach + pad) target = prefer;
			else target = this.nearestMob(save.x, save.y, reach + pad + 0.5);
		}
		if (!selfCast && !target && tactic !== "blink") return false;
		const rootedNow = this.status.some((s) => s.id === "root" && s.t > 0);
		if (tactic === "dash" && rootedNow) {
			this.float(save.x, save.y - 40, "ROOTED", "#6ecf6a");
			return false;
		}
		const swift = this.chan("swift");
		const form = attackForm(move);
		let cd = Math.max(.28, (.55 + move.power / 90 - move.priority * .08) * (1 - Math.min(.4, swift / 100)));
		if (tactic === "heavy" || tactic === "channel") cd *= 1.7;
		else if (form === "spell") cd *= 1.35 * (1 - Math.min(.45, this.skillN("magic") * 0.00113)) * (1 - Math.min(.35, this.chan("focus") / 100));
		else if (form === "melee") cd *= .8;
		if (tactic === "roll") cd = Math.max(cd, 2.6);
		if (tactic === "ward") cd = Math.max(cd, 5.5);
		if (tactic === "heal") cd = Math.max(cd, 3.2);
		if (tactic === "dash") cd = Math.max(cd, 1.6);
		if (tactic === "surge") cd = Math.max(cd, 8);
		cd = Math.max(.2, cd * (1 - Math.max(-.4, Math.min(.45, this.mod("haste") / 100))));
		this.cds[move.id] = cd;
		this.cdMax = this.cdMax ?? {};
		this.cdMax[move.id] = cd;
		this.attackT = tactic === "heavy" ? 1 : .8;
		this.combat = 3;
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
			this.tone(520, .08, "triangle");
			return true;
		}
		if (tactic === "dash") {
			const failPct = defenseFail(move, this.defFatigue ?? 0);
			const failed = Math.random() * 100 < failPct;
			this.defFatigue = (this.defFatigue ?? 0) + (failed ? 1 : 0.5);
			let dx = (this.held("KeyD") || this.held("ArrowRight") ? 1 : 0) - (this.held("KeyA") || this.held("ArrowLeft") ? 1 : 0) + this.stick.x;
			let dy = (this.held("KeyS") || this.held("ArrowDown") ? 1 : 0) - (this.held("KeyW") || this.held("ArrowUp") ? 1 : 0) + this.stick.y;
			if (Math.hypot(dx, dy) < .2) {
				const dir = this.direction ?? "down";
				dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
				dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
			}
			const l = Math.hypot(dx, dy) || 1;
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
			const wasRooted = this.status.some((s) => (s.id === "root" || s.id === "soak") && s.t > 0);
			this.status = this.status.filter((s) => s.id !== "root" && s.id !== "soak");
			if (wasRooted) this.float(save.x, save.y - 58, "BREAK FREE", "#6ecf6a");
			if (!target) {
				const dir = this.direction ?? "down";
				const bx = dir === "left" ? -1 : dir === "right" ? 1 : 0, by = dir === "up" ? -1 : dir === "down" ? 1 : 0;
				const x0 = save.x, y0 = save.y;
				for (let d = 84; d >= 12; d -= 12) if (!blocked(this.world, save.x + bx * d, save.y + by * d)) { save.x += bx * d; save.y += by * d; break; }
				this.dest = null;
				this.evadeT = .45;
				this.incoming = (this.incoming ?? []).filter((h) => h.form !== "melee");
				this.float(save.x, save.y - 46, "BLINK", "#b4a6ff");
				this.playMoveFx(move, x0, y0 - 20, save.x, save.y - 20);
				return true;
			}
			const failPct = defenseFail(move, this.defFatigue ?? 0);
			if (Math.random() * 100 < failPct) {
				this.defFatigue = (this.defFatigue ?? 0) + 1;
				this.float(save.x, save.y - 46, "SNAG", "#c4473a");
				this.playMoveFx(move, save.x, save.y - 20, target.x, target.y - 12);
				if (move.power > 0) this.resolveHit(move, target, false, 0.24);
				return true;
			}
			this.defFatigue = Math.max(0, (this.defFatigue ?? 0) - 0.2);
			this.evadeT = .45;
			this.incoming = (this.incoming ?? []).filter((h) => h.form !== "melee");
			const behind = target.x >= save.x ? 1 : -1;
			const nx = target.x + behind * 30;
			const ny = target.y + 4;
			if (!blocked(this.world, nx, ny)) {
				save.x = nx;
				save.y = ny;
			}
			this.facing = behind > 0 ? -1 : 1;
			this.float(save.x, save.y - 46, "BLINK", "#b4a6ff");
			this.playMoveFx(move, save.x, save.y - 20, target.x, target.y - 12);
			if (move.power > 0) this.resolveHit(move, target, false, 0.55);
			return true;
		}
		if (tactic === "lunge" && target) {
			const failPct = defenseFail(move, this.defFatigue ?? 0);
			const failed = Math.random() * 100 < failPct;
			this.defFatigue = (this.defFatigue ?? 0) + (failed ? 1 : 0.45);
			this.lunge = {
				t: 0,
				dur: .42,
				ox: save.x,
				oy: save.y,
				tx: target.x - this.facing * 18,
				ty: target.y,
				mob: target.id,
				hit: false,
				failed,
				power: move.power,
				moveId: move.id
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
		this.playMoveFx(move, save.x, save.y - 24, target ? target.x : save.x + this.facing * 30, target ? target.y - 16 : save.y - 20);
		this.tone(140 + move.priority * 40 + move.power, .06, move.type === "electric" ? "sawtooth" : "square");
		if (move.effect === "shell") {
			this.shield = Math.max(this.shield, 20 + move.power);
			this.wardT = Math.max(this.wardT, 1.2);
			this.say("Urn shell.");
			return true;
		}
		if (target) {
			if (tactic === "heavy") this.resolveHit(move, target, false, 1.7);
			else this.resolveHit(move, target, false, tactic === "channel" ? 1.25 : 1);
		}
		if (form === "spell" || tactic === "channel") this.gainSkill("magic", 3);
		else this.gainSkill("physical", 2);
		return true;
	}
	tickLunge(dt) {
		const save = this.save;
		const lung = this.lunge;
		if (!save || !lung) return;
		lung.t += dt;
		const u = Math.min(1, lung.t / lung.dur);
		const back = u < .45 ? u / .45 : 1 - (u - .45) / .55;
		save.x = lung.ox + (lung.tx - lung.ox) * Math.max(0, back);
		save.y = lung.oy + (lung.ty - lung.oy) * Math.max(0, back);
		this.attackT = 1;
		if (!lung.hit && u >= .4) {
			lung.hit = true;
			const mob = this.mobs.find((m) => m.id === lung.mob && m.alive);
			const move = MOVE_BY_ID[lung.moveId] ?? MOVES.find((m) => moveTactic(m) === "lunge") ?? MOVES[0];
			this.playMoveFx(move, save.x, save.y - 16, lung.tx, lung.ty);
			if (mob) this.resolveHit(move, mob, false, lung.failed ? 0.22 : 0.72);
		}
		if (u >= 1) this.lunge = null;
	}
	resolveHit(move, mob, fromPet, mult = 1) {
		const save = this.save;
		const form = attackForm(move);
		if (Math.random() * 100 > move.accuracy) {
			this.float(mob.x, mob.y - 36, "MISS", "#e8dcc4");
			return;
		}
		const pure = form === "spell";
		const tm = pure ? 1 : typeChart(move.type, mob.type);
		if (!pure && tm === 0) {
			this.float(mob.x, mob.y - 36, "IMMUNE", "#e7d9ff");
			return;
		}
		const gearStab = pure ? 1 : this.stab(move.type);
		const might = 1 + this.chan("might") / 100;
		const boss = mob.boss ? 1 + this.chan("boss_bane") / 100 : 1;
		const gloom = this.status.some((s) => s.id === "gloom") ? .8 : 1;
		const critChance = move.crit + this.chan("crit_edge") + (this.buff.t > 0 ? this.buff.crit : 0) + this.mod("crit");
		const crit = Math.random() * 100 < critChance;
		const phys = form === "spell" ? 1 : 1 + this.skillN("physical") * (form === "melee" ? .02 : .015);
		const mag = form === "spell" ? 1.45 * (1 + this.skillN("magic") * .025) * (1 + this.chan("spellweave") / 100) * (1 + this.chan("hymn") / 100) : 1;
		const melee = form === "melee" ? 1.35 : 1;
		const read = bodyRead(mob.type);
		const hide = form === "spell" || moveTactic(move) === "channel" ? read.kind === "magic" ? 1.2 : .8 : read.kind === "physical" ? 1.2 : .8;
		let dmg = (6 + move.power * .42 + (form !== "spell" && this.piece("weapon") ? equipmentStats(this.piece("weapon")).damage * .35 : 0)) * (1 + save.level * .045) * gearStab * tm * might * this.offenseFactor(mob, form) * boss * gloom * phys * mag * melee * hide * mult * (fromPet ? .62 : 1) * (crit ? 1.75 * (1 + Math.min(.8, this.chan("crit_force") / 100)) : 1);
		if (!fromPet) dmg *= abilityMultiplier(save, move.id);
		if (!fromPet) {
			dmg *= Math.max(.2, 1 + this.mod(form === "spell" || moveTactic(move) === "channel" ? "arcana" : "might") / 100);
			if (move.type === CLASS_BY_ID[save.classId]?.type) dmg *= 1 + this.mod("affinity") / 100;
		}
		if (form === "ranged") dmg = mitigate(dmg, this.mobArmor(mob) - this.chan("armor_crack"));
		if (mob.status.some((s) => s.id === "expose")) dmg *= 1.25;
		dmg = Math.max(1, dmg);
		let hits = Math.random() * 100 < Math.min(85, this.chan("double_strike")) ? 2 : 1;
		if (form === "ranged" && rangedStyle(move) === "volley") {
			hits = 3;
			dmg *= .55;
		}
		for (let i = 0; i < hits; i++) this.damageMob(mob, dmg, crit && i === 0);
		this.applyEffect(move, mob, true);
		if (!fromPet && this.mod("leech") > 0) save.hp = Math.min(this.maxHp(), save.hp + dmg * this.mod("leech") / 100);
		if (!fromPet && this.chan("leech_edge") > 0) save.hp = Math.min(this.maxHp(), save.hp + dmg * this.chan("leech_edge") / 100);
		if (move.effect === "leech" && (this.rules !== "hardcore" || attackForm(move) === "spell")) save.hp = Math.min(this.maxHp(), save.hp + dmg * .35);
		mob.status = mob.status.filter((s) => s.id !== "sleep");
	}
	damageMob(mob, dmg, crit) {
		const amount = Math.floor(dmg);
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
	}
	applyMobDamage(mob, amount, crit = false) {
		if (!mob?.alive || !Number.isFinite(amount) || amount <= 0 || this.dead) return;
		mob.hp -= amount;
		mob.hurt = 1;
		this.float(mob.x, mob.y - 30, `${amount}${crit ? "!" : ""}`, crit ? "#fff1a8" : "#f0e2c8");
		if (crit) this.shake = Math.max(this.shake, 5);
		this.combat = 3;
		if (mob.hp <= 0) this.killMob(mob);
	}
	killMob(mob) {
		const save = this.save;
		if (!save || !mob?.alive || this.dead) return;
		mob.alive = false;
		mob.hp = 0;
		mob.respawn = mob.zone?.respawn ?? (mob.boss ? 70 : 22);
		const portal = save.dungeons?.portals.find(p => p.id === save.map);
		if (portal) {
			if (!portal.defeated.includes(mob.id)) portal.defeated.push(mob.id);
			if (mob.boss) { portal.cleared = true; this.say("Dungeon cleared. Return through the entrance rift."); }
			this.room?.send({ t: "dungeons", dungeons: save.dungeons });
		}
		const xp = Math.floor((8 + mob.level * 3) * (mob.boss ? 4 : 1) * (1 + this.chan("xp_boost") / 100));
		this.gainXp(xp);
		this.gainSkill("hunting", mob.boss ? 28 : 10);
		save.kyo += Math.floor((2 + mob.level) * (mob.boss ? 6 : 1) * (1 + this.chan("kyo_find") / 100) * Math.max(.2, 1 + this.mod("kyo") / 100));
		save.wins += 1;
		const regen = this.chan("regen");
		if (regen && this.rules !== "hardcore") save.hp = Math.min(this.maxHp(), save.hp + regen * .4);
		this.say(`${mob.name} falls.`);
		this.tone(90, .08, "triangle");
		this.questKill(mob);
		if (mob.witch || mob.bounty) {
			if (mob.bounty) {
				for (const pool of [this.mobs, this.contract ?? []]) {
					for (const s of pool) if (s.bountySpirit && s.master === mob.id) {
						s.alive = false;
						s.hp = 0;
					}
				}
				this.contract = (this.contract ?? []).filter((m) => m.alive);
			}
			for (const g of mob.lootGear) this.receiveGear({
				...g,
				uid: nextUid()
			});
			for (const [id, n] of Object.entries(mob.lootBag)) if (n > 0) this.giveItem(id, n);
			save.kyo += mob.lootKyo;
			this.say(mob.bounty
				? `${mob.name} drops everything they carried. ${mob.lootKyo} kyo and ${mob.lootGear.length} pieces of gear.`
				: `${mob.name} drops everything. ${mob.lootKyo} kyo, her bag, her gear.`);
			this.gainSkill("hunting", 24);
			this.gainAccount(40 + mob.level * 4);
			this.persist();
			return;
		}
		if (mob.animal) {
			const meat = mob.species === "stag" || mob.species === "boar" ? 2 : 1;
			const hide = mob.species === "stag" ? 2 : mob.species === "crow" ? 1 : 1;
			this.giveItem("meat", meat);
			this.giveItem("leather", hide);
			this.say(`${mob.name}: meat ${meat}, leather ${hide}.`);
			this.gainSkill("hunting", 8);
			this.gainSkill("physical", 4);
			this.persist();
			return;
		}
		const luck = this.chan("loot_find") + this.chan("fortune");
		const dropP = mob.boss ? 1 : Math.min(0.92, 0.12 + mob.level * 0.016 + mob.rarity * 0.08 + luck / 200);
		if (Math.random() < dropP) {
			const floors = [null, "fine", "rare", "epic", "legendary"];
			const tier = Math.min(4, mob.rarity + (mob.level >= 24 ? 1 : 0) + (mob.level >= 40 ? 1 : 0));
			const piece = rollGear(mulberry32(Math.random() * 1e9 | 0), {
				level: Math.max(1, mob.level + mob.rarity * 2),
				luck: luck + mob.rarity * 14 + mob.level * 0.45,
				raceBias: save.race,
				floor: mob.boss ? mob.level > 14 ? "rare" : "fine" : floors[tier] ?? null,
				typeBias: mob.boss ? mob.type : null
			});
			this.receiveGear(piece);
			this.say(`Found ${piece.name}.`);
			this.tone(520, .1, "triangle");
		}
		if (mob.boss) {
			const piece = rollGear(mulberry32(Math.random() * 1e9 | 0), {
				level: mob.level + 2,
				luck: luck + 20,
				raceBias: save.race,
				floor: "epic"
			});
			this.receiveGear(piece);
			this.say(`Warlord relic: ${piece.name}.`);
			if (mob.bossId && !mob.dungeonBoss) save.bosses[mob.bossId] = (save.bosses[mob.bossId] ?? 0) + 1;
		}
		if (Math.random() < Math.min(0.8, 0.22 + mob.level * 0.012 + mob.rarity * 0.06)) this.giveItem(mob.type === "water" ? "fish" : mob.type === "earth" ? "mushroom" : "meat", 1 + (mob.level >= 20 ? 1 : 0));
		if (Math.random() < Math.min(0.55, 0.08 + mob.level * 0.008 + mob.rarity * 0.05)) this.giveItem("cleanse_salt", 1);
		if (mob.rarity >= 3 && Math.random() < 0.12 + mob.level * 0.004) this.giveItem("ghost_jar", 1);
		if (this.shrine && mob.id.startsWith("shrine")) this.shrineClear();
		if (this.role === "host") this.room?.send({
			t: "dead",
			id: mob.id,
			boss: mob.bossId ?? ""
		});
		this.tryRecruit(mob);
		this.persist();
	}
	tryRecruit(mob: Mob) {
		const save = this.save;
		if (!save || mob.animal || mob.boss || mob.witch || mob.id.startsWith("shrine") || mob.master) return;
		const jar = (save.jarLeft ?? 0) > 0 ? 0.45 : 0;
		const chance = Math.min(0.92, 0.12 + this.skillN("catching") * 0.0012 + this.chan("catch_boost") / 220 + mob.rarity * 0.03 + jar);
		if (Math.random() > chance) return;
		save.spirits = save.spirits ?? [];
		if (save.spirits.length >= 20) {
			this.say(`${mob.name} almost stayed. The spirit party is full (20). Dismiss one.`);
			return;
		}
		const spirit = this.spiritFrom(mob);
		const cap = this.spiritCap();
		const following = save.spirits.filter((s) => s.active).length;
		spirit.active = following < cap;
		save.spirits.push(spirit);
		this.say(spirit.active ? `${spirit.name} stays, and follows.` : `${spirit.name} stays in the party. Call them out from Spirits.`);
		this.gainSkill("catching", 16);
		save.catches[mob.type] = (save.catches[mob.type] ?? 0) + 1;
		this.noteCatch(mob);
	}
	spiritCap() {
		return 3 + Math.max(0, Math.min(7, this.save?.ghostSlots ?? 0));
	}
	activeSpirits() {
		const save = this.save;
		if (!save) return [];
		return (save.spirits ?? []).filter((s) => s.active).slice(0, this.spiritCap());
	}
	spiritFrom(mob: Mob): Spirit {
		const look = mob.look ?? rollGhostLook(mulberry32((Math.random() * 1e9 | 0) || 1), mob.rarity, mob.move, "hunt");
		const kit = rollSpiritKit(mob.type, mulberry32((Math.random() * 1e9 | 0) || 2), mob.move);
		const max = Math.max(18, Math.floor(mob.max * 0.72));
		return {
			uid: nextUid(), species: mob.species, name: mob.name, type: mob.type, template: mob.template,
			level: mob.level, rarity: mob.rarity, look, move: kit.slots[0] ?? mob.move, known: kit.known, slots: kit.slots,
			hp: max, max, speed: Math.max(6, (mob.speed ?? 10) - 1), active: false
		};
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
		this.say(`Quest complete: ${def.name}.`);
		this.tone(660, .15, "triangle");
	}
	giveItem(id, n) {
		const save = this.save;
		save.bag[id] = (save.bag[id] ?? 0) + n;
	}
	float(x, y, text, color) {
		this.floats.push({
			x,
			y,
			text,
			life: .85,
			color
		});
	}
	gainXp(n) {
		const save = this.save;
		n = Math.max(1, Math.round(n * Math.max(.2, 1 + this.mod("xp") / 100)));
		const grant = this.rules === "hardcore" ? Math.max(1, Math.floor(n * 0.72)) : n;
		save.xp += grant;
		this.gainAccount(grant);
		let need = xpNeed(save.level);
		while (save.xp >= need && save.level < MAX_CHARACTER_LEVEL) {
			save.xp -= need;
			save.level += 1;
			save.skillPoints = (save.skillPoints ?? 0) + POINTS_PER_LEVEL;
			if (this.rules !== "hardcore") save.hp = this.maxHp();
			this.say(save.level >= MAX_CHARACTER_LEVEL ? `Level ${MAX_CHARACTER_LEVEL}. The body cannot climb higher. Skills still can.` : `Level ${save.level}/${MAX_CHARACTER_LEVEL}. +${POINTS_PER_LEVEL} skill points.`);
			this.tone(480, .12, "square");
			this.maybeEvilWitch();
			need = xpNeed(save.level);
		}
		if (save.level >= MAX_CHARACTER_LEVEL) save.xp = Math.min(save.xp, need);
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
		const gear = [0, 1, 2].map(() => rollGear(rng, { level: lvl + 4, luck: 28, raceBias: race.id, floor: "epic", typeBias: race.type }));
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
		this.mobs.push(mob);
		for (let i = 0; i < 2; i++) {
			const pool = MONSTERS.filter((d) => d.type === "spirit" || d.type === race.type);
			const spec = pool[Math.floor(Math.random() * pool.length)] ?? MONSTERS[0]!;
			const pet = this.makeMob({
				id: `witch-spirit-${nextUid()}`, species: spec.id, x: x + (i === 0 ? -28 : 28), y: y + 16,
				level: Math.max(1, lvl - 1), template: spec.template, type: spec.type, name: spec.name
			});
			pet.master = mob.id;
			pet.aggro = true;
			if (pet.look) pet.look.aggression = "hunt";
			pet.rarity = Math.max(pet.rarity, 2);
			pet.hp = pet.max = Math.floor(pet.max * 1.35);
			this.mobs.push(pet);
		}
		this.say(`${name} is coming to hunt you. She brings two spirits.`);
		this.tone(90, .22, "sawtooth");
	}
	gainSkill(id, amount) {
		const st = this.save.skills[id];
		if (!st || st.level >= MAX_SKILL_LEVEL) return;
		amount = Math.max(1, Math.round(amount * aptitudeOf(this.save.classId, id)));
		const gain = this.rules === "hardcore" ? Math.max(1, Math.floor(amount * 2.4)) : amount;
		st.xp += gain;
		let ups = 0;
		while (st.xp >= skillNeed(st.level) && st.level < MAX_SKILL_LEVEL) {
			st.xp -= skillNeed(st.level);
			st.level += 1;
			ups += 1;
		}
		if (st.level >= MAX_SKILL_LEVEL) st.xp = 0;
		if (ups) {
			const name = SKILLS.find((sk) => sk.id === id)?.name ?? id;
			this.say(`${name} ${st.level}/${MAX_SKILL_LEVEL}. ${skillLine(id, st.level)}`);
			this.tone(700, .08, "triangle");
		}
	}
	skillN(id) {
		return Math.max(0, Math.min(MAX_SKILL_LEVEL, this.save?.skills?.[id]?.level ?? 1) - 1);
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
	tickMobs(dt) {
		const save = this.save;
		for (const m of this.mobs) {
			m.hurt = Math.max(0, m.hurt - dt * 3);
			m.walk += dt * 4;
			m.status.forEach((s) => s.t -= dt);
			m.status = m.status.filter((s) => s.t > 0);
			if (!m.alive) {
				if (this.save.map.startsWith("rift-") || m.id.startsWith("shrine") || m.witch || m.bounty || m.bountySpirit) continue;
				m.respawn -= dt;
				if (m.respawn <= 0) {
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
					const born = this.makeMob(m.zone ? {
						id: spec.id, species: spec.species, x: spec.x, y: spec.y, level: spec.level, boss: false, fixedLevel: true, zone: m.zone
					} : {
						...spec, boss: m.boss, bossId: m.bossId, template: m.template, type: m.type, animal: m.animal, fixedLevel: false, zone: null
					});
					const zone = m.zone;
					Object.assign(m, born);
					if (zone) m.zone = zone;
				}
				continue;
			}
			if (!m.boss && !m.witch && !m.master && Math.hypot(m.x - save.x, m.y - save.y) > 1200) continue;
			if (m.status.some((s) => s.id === "burn")) m.hp -= 6 * dt;
			if (m.hp <= 0) {
				this.killMob(m);
				continue;
			}
			if (m.status.some((s) => s.id === "sleep")) continue;
			const dx = save.x - m.x;
			const dy = save.y - m.y;
			const d = Math.hypot(dx, dy);
			const rooted = m.status.some((s) => s.id === "root");
			if (m.animal && m.species !== "wolf" && m.species !== "boar") {
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
		if (m.master) {
			const boss = this.mobs.find((x) => x.id === m.master && x.alive);
			if (boss && (boss.seen || boss.huntIn <= 0 || boss.hurt > 0 || boss.aggro)) return d < 240;
			return false;
		}
		if (m.hurt > 0 || m.aggro || m.hp < m.max) return d < (m.boss ? 280 : 240);
		if (m.look?.aggression === "drift" && !m.boss && !m.witch) return false;
		return d < (m.boss ? 240 : m.animal ? 110 : 168);
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
			if (engage && d > (hunting ? 42 : 96)) {
				const sp = (hunting ? 188 : 64) * agility;
				this.moveMob(m, dx / d * sp * dt, dy / d * sp * dt);
				m.facing = dx < 0 ? -1 : 1;
			} else if (!engage) {
				const hx = m.homeX - m.x;
				const hy = m.homeY - m.y;
				const hd = Math.hypot(hx, hy);
				if (hd > 36) this.moveMob(m, hx / hd * 26 * dt, hy / hd * 26 * dt);
			}
		}
		if (!engage) m.aggro = false;
		if (m.bounty && hunting && this.world) {
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
	mobHitsPlayer(m, move, dist = 99) {
		const save = this.save;
		const form = dist < 46 && (attackForm(move) === "melee" || m.animal) ? "melee" : attackForm(move);
		const pure = form === "spell";
		const tm = pure ? 1 : typeChart(move.type, this.armorType());
		let dmg = (4 + m.level * 1.25 + move.power * (form === "spell" ? .16 : .08)) * (pure ? 1 : tm === 0 ? .2 : tm) * (m.boss ? 1.35 : 1);
		if (form === "melee") dmg *= 1.3;
		else if (form === "ranged") dmg = mitigate(dmg, this.playerArmor());
		if (m.party) dmg *= 0.58;
		if (m.summoner) dmg *= 0.82;
		if (m.dungeonBoss) dmg *= .6;
		dmg *= m.power ?? 1;
		if (m.bounty) {
			const w = m.lootGear?.find((g) => g.slot === "weapon");
			if (w) dmg += equipmentStats(w).damage * 0.28 * (m.power ?? 1);
		}
		dmg *= this.threat().dmg;
		dmg *= 1 - Math.min(.45, this.chan("ward") / 160 + this.buff.ward);
		if (this.status.some((s) => s.id === "shell")) dmg *= .7;
		dmg *= 1 - Math.max(-.5, Math.min(.6, this.mod("guard") / 100));
		if (Math.random() * 100 < Math.min(40, this.chan("echo_guard"))) {
			this.float(save.x, save.y - 36, "ECHO", "#6a4cff");
			return;
		}
		const evaded = (this.evadeT ?? 0) > 0 || this.wardT > 0;
		this.hurtSelf(dmg, move.effect);
		if (!evaded) this.applyEffect(move, null, false);
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
		let dmg = amount;
		if (this.shield > 0) {
			const use = Math.min(this.shield, dmg);
			this.shield -= use;
			dmg -= use;
		}
		if (dmg <= 0) return;
		this.sleeping = false;
		save.hp -= dmg;
		if (this.rules === "hardcore") this.persist();
		this.hurt = 1;
		this.shake = Math.max(this.shake, 3);
		this.float(save.x, save.y - 42, `${Math.floor(dmg)}`, "#c4473a");
		this.combat = 3;
		const thorns = this.chan("thorns");
		if (thorns > 0) {
			const foe = this.nearestMob(save.x, save.y, 220);
			if (foe?.alive) this.applyMobDamage(foe, Math.max(1, Math.floor(dmg * Math.min(.35, thorns / 100))), false);
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
	die() {
		const save = this.save;
		if (this.rules !== "hardcore" && (this.shrine || save.map !== "world")) {
			this.knockOut();
			return;
		}
		for (const g of save.gear) this.noteFound(g);
		const scored = this.bankAccount(save);
		this.emitGrave(save, scored);
		this.dead = true;
		this.dest = null;
		publish({ panel: "rebirth" });
		this.persist();
		this.say("This witch is gone. Her levels and kit became Account Score. Skills, account level, and permanent bonuses stay.");
		this.tone(70, .3, "sawtooth");
		this.syncHud(true);
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
		this.lunge = null;
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
		const set = setId ? SET_BY_ID[setId] : null;
		const wear = set && set.race === race && this.isUnlocked(set.id) ? set.id : null;
		save.name = (name || "Huntress").slice(0, 16);
		save.race = race;
		save.classId = classId;
		save.traitId = traitId && TRAIT_BY_ID[traitId] ? traitId : null;
		save.female = female !== false;
		save.classMovesV = 2;
		save.level = 1;
		save.xp = 0;
		save.hp = 90;
		if (this.rules === "hardcore") { save.survival = normalizeSurvival(); this.sleeping = false; }
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
		const known = [...CLASS_BY_ID[classId].starterMoves];
		save.innate = known;
		save.known = known;
		save.bar = known;
		save.progressionVersion = undefined;
		normalizeAbilities(save);
		if (wear) this.wearSet(wear);
		else {
			const type = CLASS_BY_ID[save.classId].type;
			const weapon = rollGear(mulberry32(Math.random() * 1e9 | 0), {
				level: Math.max(1, save.accountLevel),
				slot: "weapon",
				floor: "common",
				typeBias: type,
				raceBias: race
			});
			save.gear = [weapon];
			save.equipped = { weapon: weapon.uid };
		}
		const tavern = this.pickTavern();
		save.lastTavern = tavern.id;
		save.map = "world";
		save.x = tavern.boardTx * 32 + 16;
		save.y = (tavern.boardTy + 1) * 32 + 8;
		this.secondUsed = false;
		this.status = [];
		this.shield = 0;
		this.shrine = null;
		this.dead = false;
		this.loadMap("world", false);
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
		this.say(`${save.name} wakes at ${tavern.name} in ${dressed}. Skills stayed with the account. The board is by the door.`);
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
			level: Math.max(1, save.accountLevel),
			slot,
			setId,
			floor,
			raceBias: race,
			typeBias: type,
			luck: 8
		}));
		const weapon = rollGear(rng, {
			level: Math.max(1, save.accountLevel),
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
		if (!save || !g.setId || g.slot === "weapon") return;
		const slots = new Set(save.found[g.setId] ?? []);
		slots.add(g.slot);
		save.found[g.setId] = [...slots];
	}
	isUnlocked(id) {
		const have = new Set(this.save?.found[id] ?? []);
		return [
			"head",
			"chest",
			"legs",
			"feet",
			"relic"
		].every((s) => have.has(s));
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
			this.gainSkill("mining", 14);
			this.say(`Ore x${n}.`);
		} else if (node === "tree") {
			const n = Math.max(1, Math.floor((1 + Math.random()) * luck * (1 + this.skillN("woodcutting") * 0.003)));
			this.giveItem("timber", n);
			this.gainSkill("woodcutting", 14);
			this.say(`Timber x${n}.`);
		} else if (node === "shroom") {
			const bonus = this.chan("shroom_sense");
			const extra = Math.random() < Math.min(0.8, this.skillN("shroom") * 0.002) ? 1 : 0;
			this.giveItem(Math.random() < .34 ? "dreamspore" : Math.random() < .5 ? "embercap" : "blue_lantern", 1 + (bonus > 20 ? 1 : 0) + extra);
			this.giveItem("mushroom", 1 + extra);
			this.gainSkill("shroom", 16);
			this.say("The patch gives.");
		}
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
	playerSpeed() {
		const save = this.save;
		if (!save) return 8;
		return 10 + save.level + Math.floor(this.chan("swift") / 8) + Math.min(6, (save.skills.physical?.level ?? 1) / 8);
	}
	buildTurns() {
		const save = this.save;
		if (!save) return;
		const foes = this.mobs.filter((m) => m.alive && this.wantsFight(m, Math.hypot(m.x - save.x, m.y - save.y))).sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0));
		const you = this.playerSpeed();
		const top = foes[0]?.speed ?? 0;
		const q: TurnStep[] = [];
		const spirits = this.activeSpirits().filter((s) => s.hp > 0);
		const pushYou = () => {
			q.push({ side: "you", id: "you" });
			for (const s of spirits) q.push({ side: "spirit", id: s.uid });
		};
		if (you >= top) {
			pushYou();
			for (const m of foes) q.push({ side: "foe", id: m.id });
		} else {
			for (const m of foes.filter((m) => (m.speed ?? 0) > you)) q.push({ side: "foe", id: m.id });
			pushYou();
			for (const m of foes.filter((m) => (m.speed ?? 0) <= you)) q.push({ side: "foe", id: m.id });
		}
		this.turnQ = q;
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
		this.fightGap = 0.34;
		if (!this.inFight()) {
			this.turnQ = [];
			this.fought = false;
		}
	}
	spiritTurn(spirit: Spirit) {
		const save = this.save!;
		const moves = (spirit.slots ?? []).map((id) => MOVE_BY_ID[id]).filter(Boolean);
		if (!moves.length) return;
		const aid = moves.filter((m) => spiritAidsPlayer(m));
		let move = null;
		if (save.hp < this.maxHp() * 0.5) move = aid.find((m) => m.effect === "mend" || moveTactic(m) === "heal") ?? null;
		if (!move && this.status.length && Math.random() < 0.7) move = aid.find((m) => m.effect === "cleanse") ?? null;
		if (!move && this.wardT <= 0 && save.hp < this.maxHp() * 0.8) move = aid.find((m) => m.effect === "shell" || moveTactic(m) === "ward") ?? null;
		if (!move && Math.random() < 0.18) move = aid.find((m) => moveTactic(m) === "surge") ?? null;
		if (!move) {
			const offs = moves.filter((m) => !spiritAidsPlayer(m));
			move = offs.length ? offs[Math.floor(Math.random() * offs.length)] : null;
		}
		if (!move) return;
		if (spiritAidsPlayer(move)) {
			this.applySpiritAid(spirit, move);
			return;
		}
		const foe = this.fightTarget();
		if (!foe) return;
		const slot = this.activeSpirits().indexOf(spirit);
		const at = this.mates[slot] ?? { x: save.x - 20, y: save.y, swing: 0 };
		at.swing = 1;
		if (slot >= 0) this.mates[slot] = at;
		this.playMoveFx(move, at.x, at.y - 12, foe.x, foe.y - 12);
		this.resolveHit(move, foe, true, 0.75 + spirit.rarity * 0.12);
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
			this.status = [];
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
		const save = this.save!;
		if (m.status.some((s) => s.id === "sleep")) {
			this.float(m.x, m.y - 36, "ASLEEP", "#e7d9ff");
			return;
		}
		const move = MOVE_BY_ID[m.move] ?? MOVES[0]!;
		const form = attackForm(move);
		m.cd = Math.max(0, (m.cd ?? 0) - 0.55);
		if (m.cd > 0) {
			this.float(m.x, m.y - 34, "WAIT", "#c8c0b0");
			return;
		}
		m.cd = (form === "spell" ? 1.05 : form === "ranged" ? 0.72 : 0.48) * (m.boss || m.witch ? 0.85 : 1);
		m.swing += 1;
		const spirits = this.activeSpirits().filter((s) => s.hp > 0);
		if (spirits.length && Math.random() < 0.28) {
			const spirit = spirits[Math.floor(Math.random() * spirits.length)]!;
			const slot = this.activeSpirits().indexOf(spirit);
			const at = this.mates[slot] ?? { x: save.x, y: save.y, swing: 0 };
			this.playMoveFx(move, m.x, m.y - 16, at.x, at.y - 10);
			const dmg = Math.max(4, Math.floor((6 + m.level * 1.4 + move.power * 0.08) * (m.power ?? 1)));
			spirit.hp -= dmg;
			this.float(at.x, at.y - 28, `${dmg}`, "#c4473a");
			if (spirit.hp <= 0) {
				spirit.hp = 0;
				this.say(`${spirit.name} drops.`);
			}
			return;
		}
		this.queueStrike(m, move);
	}
	queueStrike(m, move) {
		const save = this.save;
		const form = attackForm(move);
		const wind = (form === "melee" ? .34 : form === "ranged" ? .42 : .55) * (m.boss ? .85 : 1) * (this.rules === "hardcore" ? Math.max(.7, 1 - (save.level ?? 1) * .006) : 1);
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
			const dist = Math.hypot(save.x - m.x, save.y - m.y);
			const moved = Math.hypot(save.x - hit.ax, save.y - hit.ay);
			this.playMoveFx(move, m.x, m.y - 16, hit.form === "melee" ? save.x : hit.ax, (hit.form === "melee" ? save.y : hit.ay) - 18);
			const reach = hit.form === "melee" || m.animal ? 62 : attackRange(move) + 24;
			if (dist > reach || (hit.form !== "melee" && moved > 46)) {
				this.float(save.x, save.y - 44, "DODGED", "#9ad8c8");
				this.cfx?.evade(save.x, save.y - 18);
				this.gainSkill("adventuring", 1);
				continue;
			}
			this.mobHitsPlayer(m, move, dist);
		}
		this.incoming = keep;
	}
	tickSpirits(dt: number) {
		const save = this.save;
		if (!save) return;
		const list = this.activeSpirits();
		while (this.mates.length < list.length) this.mates.push({ x: save.x, y: save.y, swing: 0 });
		this.mates.length = list.length;
		list.forEach((spirit, i) => {
			const at = this.mates[i]!;
			at.swing = Math.max(0, at.swing - dt * 3);
			if (spirit.hp <= 0) {
				at.x += (save.x - this.facing * 18 - at.x) * Math.min(1, dt * 2);
				at.y += (save.y + 14 - at.y) * Math.min(1, dt * 2);
				return;
			}
			const foe = this.fightTarget();
			const ang = this.clock * 1.7 + i * 2.05;
			const rad = foe ? 34 + i * 16 : 22 + i * 12;
			const tx = foe ? foe.x + Math.cos(ang) * rad : save.x - this.facing * (26 + i * 16);
			const ty = foe ? foe.y + Math.sin(ang) * rad * 0.45 : save.y + 8 + i * 6;
			at.x += (tx - at.x) * Math.min(1, dt * 5);
			at.y += (ty - at.y) * Math.min(1, dt * 5);
		});
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
			const foe = this.nearestMob(save.x, save.y, 190);
			const px = this.mateCd[`${key}x`] ?? save.x;
			const py = this.mateCd[`${key}y`] ?? save.y;
			const dist = foe ? Math.hypot(foe.x - px, foe.y - py) : 999;
			const ang = this.clock * .9 + i * 2.1;
			const orbit = foe ? dist > 80 ? 70 : 36 : 28;
			const homeX = foe ? foe.x + Math.cos(ang) * (orbit + i * 10) : save.x + Math.cos(ang) * 28;
			const homeY = foe ? foe.y + Math.sin(ang) * 22 : save.y + 10 + i * 8;
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
			this.playMoveFx(move, this.mateCd[`${key}x`] ?? save.x, (this.mateCd[`${key}y`] ?? save.y) - 20, foe.x, foe.y - 12);
			this.damageMob(foe, (dist > 70 ? 6 : 9) + save.level * 1.4, false);
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
		for (const f of this.floats) {
			f.life -= dt;
			f.y -= dt * 22;
		}
		this.floats = this.floats.filter((f) => f.life > 0);
		this.shake = Math.max(0, this.shake - dt * 18);
		for (const id of Object.keys(this.nodeCd)) this.nodeCd[id] = Math.max(0, (this.nodeCd[id] ?? 0) - dt);
	}
	playMoveFx(move, x0, y0, x1, y1) {
		this.cfx = this.cfx ?? new CombatFx();
		this.cfx.cast(move, attackForm(move), moveTactic(move), x0, y0, x1, y1);
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
	procSet(fx) {
		const save = this.save;
		this.say(`Set: ${fx.replace(/([a-z])([A-Z])/g, "$1 $2")}.`);
		this.shake = 8;
		this.tone(180, .2, "sawtooth");
		for (let i = 0; i < 30; i++) {
			const a = i / 30 * Math.PI * 2;
			this.parts.push({
				x: save.x,
				y: save.y - 20,
				vx: Math.cos(a) * 120,
				vy: Math.sin(a) * 120,
				life: .5,
				max: .5,
				color: fxColor(fx),
				size: 4,
				kind: "burst"
			});
		}
		for (const m of this.mobs) {
			if (!m.alive) continue;
			if (Math.hypot(m.x - save.x, m.y - save.y) > 120) continue;
			const bonus = fx === "solarnova" || fx === "bloodmoon" ? 28 : 18;
			if (this.role !== "guest") this.applyMobDamage(m, bonus + save.level * 2, true);
			if (fx === "briarburst" || fx === "tidalsurge") m.status.push({
				id: fx === "tidalsurge" ? "soak" : "root",
				t: 2.5
			});
			if (fx === "whitestorm" || fx === "gravepulse") m.status.push({
				id: "sleep",
				t: 1.6
			});
			if (fx === "voidring" || fx === "stormcrown") m.status.push({
				id: "silence",
				t: 2
			});
		}
		if (this.rules !== "hardcore" && (fx === "lanternwake" || fx === "featherfall" || fx === "gravepulse")) save.hp = Math.min(this.maxHp(), save.hp + 20);
	}
	interact() {
		const save = this.save;
		if (!save || this.dead || !this.world) return;
		if (save.map !== "world") {
			const ex = this.dungeonExitAt();
			if (Math.hypot(save.x - ex.x, save.y - ex.y) < 36) {
				this.travel("world", save.dungeons?.portals.find(p => p.id === save.map) ?? WORLD_RETURN[save.map] ?? hearthXY());
				return;
			}
		}
		if (save.map === "world") {
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
			this.say(this.rules === "hardcore" ? "The hearth offers shelter. Only healing spells mend your wounds." : "The hearth mends you. Skills stay either way.");
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
		const need = Math.max(.45, 1.15 - lv * .008);
		this.dest = null;
		if (this.autoplay) { this.path = []; this.pathI = 0; }
		this.channel = {
			kind: `${node}:${id}`, x: this.save.x, y: this.save.y, map: this.save.map,
			t: 0,
			need
		};
		this.say(node === "ore" ? "Mining..." : node === "tree" ? "Chopping..." : "Foraging...");
	}
	finishChannel() {
		this.save;
		const ch = this.channel;
		this.channel = null;
		if (!ch) return;
		if (ch.kind === "water") {
			if (this.rules === "hardcore" && waterWithinReach(this.world, this.save.x, this.save.y)) { this.giveItem("raw_water", 1); this.say("Collected raw water. Purify it on a campfire."); this.persist(); }
			return;
		}
		if (ch.map && (ch.map !== this.save.map || Math.hypot(ch.x - this.save.x, ch.y - this.save.y) > 64)) { this.say(ch.kind === "fishing" ? "You reel the line in." : "Gathering stopped: too far away."); return; }
		if (ch.kind === "fishing") {
			if (!nearestWaterTile(this.world, this.save.x, this.save.y, 80)) return;
			const n = 1 + (this.chan("fish_luck") > 25 ? 1 : 0);
			this.giveItem("fish", n);
			this.gainSkill("fishing", 16);
			this.say(`A bite! Fish x${n}.`);
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
			const n = Math.max(1, Math.floor((1 + Math.random()) * luck * (1 + this.skillN("mining") * 0.003)));
			this.giveItem("ore", n);
			if (Math.random() < 0.45) this.giveItem("ironroot", 1);
			this.gainSkill("mining", 14);
			this.say(`Ore x${n}.`);
		} else if (node === "tree") {
			const n = Math.max(1, Math.floor((1 + Math.random()) * luck * (1 + this.skillN("woodcutting") * 0.003)));
			this.giveItem("timber", n);
			this.gainSkill("woodcutting", 14);
			this.say(`Timber x${n}.`);
		} else if (node === "shroom") {
			const bonus = this.chan("shroom_sense");
			const extra = Math.random() < Math.min(0.8, this.skillN("shroom") * 0.002) ? 1 : 0;
			this.giveItem(Math.random() < .34 ? "dreamspore" : Math.random() < .5 ? "embercap" : "blue_lantern", 1 + (bonus > 20 ? 1 : 0) + extra);
			this.giveItem("mushroom", 1 + extra);
			this.gainSkill("shroom", 16);
			this.say("The patch gives.");
		}
		this.persist();
		if (this.autoplay) this.autoPlan = 0;
	}
	openTalk(id) {
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
		mob.hp = mob.max = Math.floor(mob.max * (1 + this.shrine.round * .25));
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
				level: save.level + 3,
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
		return savedMaps().map((m) => ({ id: m.id, name: m.name, kind: m.kind ?? "world" }));
	}
	enterCustom(id) {
		const file = savedMaps().find((m) => m.id === id);
		if (!file || !this.save) return;
		this.closePanel();
		this.returnTo = this.save.map === "world" ? { x: this.save.x, y: this.save.y } : hearthXY();
		this.switchTo(`custom-${id}`, { x: (file.spawn?.tx ?? 1) * 32 + 16, y: (file.spawn?.ty ?? 1) * 32 + 16 });
		this.say(`You step into ${file.name}.`);
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
			const at = p.tx !== undefined ? nearestOpen(this.overworld ?? buildWorld(save.seed, this.rules === "hardcore"), p.tx * 32 + 16, p.ty * 32 + 16) : this.returnTo ?? hearthXY();
			this.switchTo("world", at);
			return;
		}
		const file = savedMaps().find((m) => m.id === p.map);
		if (!file) { this.say("This portal leads nowhere yet. Save the target map in the Map Builder."); return; }
		if (save.map === "world") this.returnTo = { x: save.x, y: save.y + 40 };
		const ax = p.tx ?? file.spawn?.tx ?? 1, ay = p.ty ?? file.spawn?.ty ?? 1;
		this.switchTo(`custom-${file.id}`, { x: ax * 32 + 16, y: ay * 32 + 16 });
		this.say(`The portal carries you to ${file.name}.`);
	}
	switchTo(map, at) {
		const save = this.save;
		save.x = at.x;
		save.y = at.y;
		this.loadMap(map, true);
		this.cam.x = save.x;
		this.cam.y = save.y;
		if (map.startsWith("custom-")) { this.persist(); return; }
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
				this.say("Tide Reach. Now catch a water spirit.");
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
		return itemUseProblem(def, { hardcore: this.rules === "hardcore", hp: save.hp, maxHp: this.maxHp(), hunger: save.survival?.hunger, thirst: save.survival?.thirst });
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
			this.status = [];
			this.say("Cleansed."); this.persist(); this.syncHud(true);
			return;
		}
		if (this.rules === "hardcore") {
			if (FOOD[id] || id === "drinking_water") {
				save.bag[id]--;
				if (id === "drinking_water") save.survival.thirst = Math.min(100, save.survival.thirst + 50);
				else save.survival.hunger = Math.min(100, save.survival.hunger + FOOD[id]);
				this.say(`Used ${def.name}.`); this.persist(); this.syncHud(true); return;
			}

		}
		if (def.heal || def.buff) save.bag[id] -= 1;
		if (def.heal && this.rules !== "hardcore") {
			const heal = Math.floor(def.heal * (1 + this.chan("potion_sip") / 100));
			save.hp = Math.min(this.maxHp(), save.hp + heal);
			this.say(`${def.name}.`);
		}
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
		const worn = this.piece(g.slot);
		if (!worn || gearScore(g) > gearScore(worn)) {
			save.equipped[g.slot] = g.uid;
			this.say(`Wore ${g.name}. Score ${gearScore(g)}.`);
		}
	}
	toggleAutoplay() {
		if (!this.save || this.dead) return;
		this.autoplay = !this.autoplay;
		this.path = [];
		this.pathI = 0;
		this.autoPlan = 0;
		this.grind = this.autoplay ? "looking" : "";
		this.dest = null;
		this.say(this.autoplay ? (this.rules === "hardcore" ? "Autogrind. She gathers and attacks whatever is nearest in range." : "Autoplay. She grinds and attacks whatever is nearest in range.") : "Autoplay off.");
		this.syncHud(true);
	}
	sell(uid) {
		const save = this.save;
		const i = save.gear.findIndex((g) => g.uid === uid);
		if (i < 0) return;
		const g = save.gear[i];
		if (Object.values(save.equipped).includes(uid)) return this.say("Equip a replacement before selling worn gear.");
		const mult = (1 + this.skillN("trading") * 0.002) * (1 + this.chan("sell_boost") / 100);
		save.kyo += Math.floor(gearPrice(g) * .45 * mult);
		save.gear.splice(i, 1);
		if (this.selected === uid) this.selected = null;
		this.gainSkill("trading", 8);
		this.say("Sold.");
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
		const save = this.save;
		const shop = Math.max(.5, 1 - this.skillN("trading") * 0.00125);
		const charm = 1 - this.chan("shop_charm") / 140;
		return Math.max(1, Math.floor(n * shop * charm));
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
		if (Math.random() < Math.min(0.5, this.skillN("alchemy") * 0.00125)) this.giveItem(recipe.output, recipe.n);
		this.gainSkill("alchemy", 18);
		this.say(`Brewed ${ITEM_BY_ID[recipe.output]?.name ?? recipe.name}.`);
		this.persist();
		this.syncHud(true);
	}
	teach() {
		this.toggle("moves");
		this.say("Spend character skill points to unlock or upgrade attacks and spells.");
	}
	setBar(_index, _moveId) {
		this.say("Auto uses your unlocked abilities. Upgrade them in Attacks & Spells.");
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
		if ((save.spirits ?? []).length >= 20) return this.say("The spirit party is full.");
		const def = MONSTER_BY_ID[pet.species] ?? ANIMAL_BY_ID[pet.species];
		if (!def) return;
		const kit = rollSpiritKit(def.type, mulberry32((Date.now() ^ index) >>> 0 || 1), pet.move);
		const max = 30 + (pet.level || 1) * 8;
		const spirit = {
			uid: nextUid(), species: pet.species, name: def.name, type: def.type, template: def.template,
			level: pet.level || 1, rarity: pet.rarity || 0,
			look: pet.look || rollGhostLook(mulberry32(save.seed || 1), pet.rarity || 0, kit.slots[0] || "measured", "hunt"),
			move: kit.slots[0] || "measured", known: kit.known, slots: kit.slots, hp: max, max, speed: 8 + (pet.level || 1),
			active: this.activeSpirits().length < this.spiritCap()
		};
		save.spirits = save.spirits ?? [];
		save.spirits.push(spirit);
		save.box.splice(index, 1);
		this.say(`${def.name} joins the spirit party.`);
		this.persist();
		this.syncHud(true);
	}
	setSpiritActive(uid, on) {
		const save = this.save;
		const spirit = save?.spirits?.find((s) => s.uid === uid);
		if (!save || !spirit) return;
		if (on) {
			const used = save.spirits.filter((s) => s.active && s.uid !== uid).length;
			if (used >= this.spiritCap()) return this.say(`Only ${this.spiritCap()} spirits can follow. Buy another ghost slot, or call one back.`);
			spirit.active = true;
			this.say(`${spirit.name} follows.`);
		} else {
			spirit.active = false;
			this.say(`${spirit.name} waits in the party.`);
		}
		this.persist();
		this.syncHud(true);
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
	spendGhostSlot() {
		const save = this.save;
		if (!save) return;
		if ((save.skillPoints ?? 0) < 1) return this.say("Need a skill point.");
		if ((save.ghostSlots ?? 0) >= 7) return this.say("No more ghost slots. Ten spirits is the hunt's limit.");
		save.skillPoints -= 1;
		save.ghostSlots = (save.ghostSlots ?? 0) + 1;
		this.say(`Ghost slots ${this.spiritCap()}. Another spirit can follow.`);
		this.persist();
		this.syncHud(true);
	}
	takeBounty() {
		const save = this.save;
		if (!save || !this.world) return this.say("The board is blank out here.");
		const live = this.liveBounty();
		if (live) {
			this.say(`You already hunt ${live.name}.`);
			publish({ panel: null });
			return;
		}
		const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)];
		if (!cls) return;
		const female = classGendered(cls.id) ? Math.random() < 0.5 : true;
		const raceId = CLASS_RACE[cls.id] ?? "vesper";
		const bonus = 5 + Math.floor(Math.random() * 46);
		const level = Math.max(1, save.level + bonus);
		const spot = this.bountySpot();
		const rng = mulberry32(((Date.now() ^ (Math.random() * 1e9)) >>> 0) || 7);
		const gear = (["weapon", "head", "chest", "legs", "feet", "relic"] as Slot[]).map((slot) => this.superiorPiece(slot, level, rng, raceId, cls.type));
		const offensive = cls.starterMoves.map((id) => MOVE_BY_ID[id]).filter((m) => m && !["heal", "ward", "roll", "dash", "surge"].includes(moveTactic(m)) && m.effect !== "mend" && m.effect !== "shell");
		const spell = [...offensive].sort((a, b) => b.power - a.power)[0] ?? huntMove(cls.type);
		const who = WITCH_NAMES[Math.floor(Math.random() * WITCH_NAMES.length)] ?? "Harrow Nia";
		const name = who;
		const hpMod = 1 + Math.max(0, (cls.stats.hp ?? 0) / 100) + Math.max(0, (cls.stats.guard ?? 0) / 220);
		const max = Math.floor((110 + level * 26) * hpMod);
		const mob = this.makeMob({
			id: `bounty-${nextUid()}`,
			species: "muma",
			x: spot.x,
			y: spot.y,
			level,
			fixedLevel: true,
			template: 20,
			type: cls.type,
			name
		});
		mob.bounty = true;
		mob.witch = true;
		mob.classId = cls.id;
		mob.female = female;
		mob.race = raceId;
		mob.map = save.map;
		mob.name = name;
		mob.level = level;
		mob.move = spell.id;
		mob.baseMax = max;
		mob.hp = mob.max = max;
		mob.power = 1;
		mob.enraged = false;
		mob.speed = 12 + Math.floor(level * 0.35) + Math.max(0, cls.stats.speed ?? 0) / 10;
		mob.lootGear = gear;
		mob.lootBag = {};
		mob.lootKyo = 40 + level * 24 + bonus * 8;
		mob.huntIn = 300;
		mob.seen = false;
		mob.aggro = false;
		mob.homeX = spot.x;
		mob.homeY = spot.y;
		const spirits = this.spawnBountySpirits(mob, level, bonus);
		this.mobs.push(mob, ...spirits);
		this.contract = [...(this.contract ?? []).filter((m) => m.alive), mob, ...spirits];
		publish({ panel: null });
		const tiles = Math.max(1, Math.round(Math.hypot(spot.x - save.x, spot.y - save.y) / 32));
		this.say(`Bounty: ${name} the ${cls.name}, level ${level}. ${spirits.length} spirits. ${tiles} tiles ${this.compass(spot.x - save.x, spot.y - save.y)}. Five minutes.`);
		this.tone(180, 0.14, "triangle");
		this.persist();
		this.syncHud(true);
	}
	liveBounty() {
		return (this.contract ?? []).find((m) => m.bounty && m.alive) ?? this.mobs.find((m) => m.bounty && m.alive) ?? null;
	}
	stashContract() {
		const live = this.mobs.filter((m) => (m.bounty || m.bountySpirit) && m.alive);
		if (!this.contract) this.contract = [];
		for (const m of live) {
			const i = this.contract.findIndex((c) => c.id === m.id);
			if (i >= 0) this.contract[i] = m;
			else this.contract.push(m);
		}
		this.contract = this.contract.filter((m) => m.alive);
	}
	restoreContract(map) {
		this.mobs = this.mobs.filter((m) => !m.bounty && !m.bountySpirit);
		for (const m of this.contract ?? []) if (m.alive && m.map === map) this.mobs.push(m);
	}
	tickContract(dt) {
		const lead = this.liveBounty();
		if (!lead || !this.save) return;
		if (!lead.enraged && lead.huntIn > 0) {
			lead.huntIn -= dt;
			if (lead.huntIn <= 0) {
				lead.huntIn = 0;
				this.enrageBounty(lead);
			}
		} else if (lead.enraged && lead.map !== this.save.map) this.bringBounty(lead);
	}
	enrageBounty(lead) {
		const bump = (m) => {
			if (!m || m.enraged) return;
			m.enraged = true;
			m.power = 2;
			m.baseMax = m.baseMax ?? m.max;
			m.max = Math.floor(m.baseMax * 2);
			m.hp = Math.min(m.max, Math.floor(m.hp * 2));
			m.speed = Math.floor((m.speed ?? 12) * 1.35);
			m.seen = true;
			m.aggro = true;
			m.huntIn = 0;
		};
		bump(lead);
		for (const s of this.contract ?? []) if (s.bountySpirit && s.master === lead.id && s.alive) bump(s);
		this.say(`${lead.name} is done waiting. Twice as strong, and hunting you.`);
		this.tone(90, 0.22, "sawtooth");
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
	superiorPiece(slot, level, rng, raceId, type) {
		const worn = this.piece(slot);
		const order = ["worn", "common", "fine", "rare", "epic", "legendary"];
		let q = worn ? Math.max(0, order.indexOf(worn.quality)) : 2;
		let gearLevel = Math.max(level, (worn?.level ?? 1) + 2);
		if (q < 5) q += 1;
		else gearLevel += 3;
		const target = worn ? gearScore(worn) : 0;
		let piece = rollGear(rng, { level: gearLevel, slot, luck: 48, raceBias: raceId, floor: order[Math.min(5, q)], typeBias: type });
		for (let n = 0; n < 8 && gearScore(piece) <= target; n++) {
			if (q < 5) q += 1;
			else gearLevel += 3;
			piece = rollGear(rng, { level: gearLevel, slot, luck: 48, raceBias: raceId, floor: order[Math.min(5, q)], typeBias: type });
		}
		return piece;
	}
	spawnBountySpirits(mob, level, bonus) {
		const save = this.save;
		const n = bonus >= 35 ? 4 : bonus >= 20 ? 3 : 2;
		const spirits = [];
		for (let i = 0; i < n; i++) {
			const pool = MONSTERS.filter((d) => d.type === "spirit" || d.type === mob.type);
			const spec = pool[Math.floor(Math.random() * pool.length)] ?? MONSTERS[0];
			const spiritLevel = Math.max((save?.level ?? 1) + 3, level - (1 + i));
			const at = nearestOpen(this.world, mob.x + (i - (n - 1) / 2) * 26, mob.y + 18);
			const pet = this.makeMob({
				id: `bounty-spirit-${nextUid()}`,
				species: spec.id,
				x: at.x,
				y: at.y,
				level: spiritLevel,
				fixedLevel: true,
				template: spec.template,
				type: spec.type,
				name: spec.name
			});
			pet.bountySpirit = true;
			pet.master = mob.id;
			pet.map = mob.map;
			pet.level = spiritLevel;
			pet.rarity = Math.min(4, 2 + Math.floor(bonus / 16));
			pet.aggro = false;
			pet.seen = false;
			pet.power = 1;
			pet.enraged = false;
			pet.baseMax = pet.max;
			pet.homeX = at.x;
			pet.homeY = at.y;
			if (pet.look) pet.look.aggression = "hunt";
			spirits.push(pet);
		}
		return spirits;
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
				const hx = lead.x - m.x;
				const hy = lead.y + 16 - m.y;
				const hd = Math.hypot(hx, hy);
				if (hd > 34) this.moveMob(m, hx / hd * 78 * dt, hy / hd * 78 * dt);
			}
		}
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
		if (save.perkPoints <= 0) {
			this.say("No perk points.");
			return;
		}
		const cur = save.perks[id] ?? 0;
		if (cur >= perk.max) {
			this.say(`${def.name} is full at ${perk.max}.`);
			return;
		}
		const next = Math.min(perk.max, cur + perk.step);
		save.perks[id] = next;
		save.perkPoints -= 1;
		this.say(`${def.name} ${next}/${perk.max}. ${perk.each}.`);
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
			level: Math.max(1, save.accountLevel),
			luck: 12 + save.accountLevel * 2,
			raceBias: save.race
		});
		this.receiveGear(piece);
		this.say(`Stitched ${piece.name} at account ${save.accountLevel}.`);
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
		if (snap.mode !== "play" || this.dead) return;
		publish({ panel: snap.panel === panel ? null : panel });
		this.syncHud(true);
	}
	escape() {
		if (this.dead) return;
		if (snap.panel) publish({ panel: null });
		else if (snap.mode === "play") publish({ panel: "pause" });
	}
	closePanel() {
		if (this.dead) return;
		publish({ panel: null });
	}
	toTitle() {
		this.persist();
		this.room?.close();
		this.room = null;
		this.role = "solo";
		this.save = null;
		this.mobs = [];
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
		if ((save.level | 0) > MAX_CHARACTER_LEVEL) save.level = MAX_CHARACTER_LEVEL;
		for (const sk of SKILLS) {
			const st = save.skills[sk.id];
			if (!st) continue;
			st.level = Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(st.level || 1)));
			st.xp = Math.max(0, Math.floor(st.xp || 0));
			if (st.level >= MAX_SKILL_LEVEL) st.xp = 0;
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
		save.ghostSlots = Math.max(0, Math.min(7, save.ghostSlots | 0));
		save.jarLeft = Math.max(0, save.jarLeft || 0);
		save.box = save.box ?? [];
		save.spirits = save.spirits ?? [];
		for (const pet of save.box) {
			if (save.spirits.length >= 20) break;
			const def = MONSTER_BY_ID[pet.species] ?? ANIMAL_BY_ID[pet.species];
			if (!def) continue;
			const kit = rollSpiritKit(def.type, mulberry32(((pet.level || 1) * 997 + (pet.rarity || 0) * 13) >>> 0 || 1), pet.move);
			const max = pet.max ?? 30 + (pet.level || 1) * 8;
			save.spirits.push({
				uid: nextUid(), species: pet.species, name: pet.name || def.name, type: pet.type || def.type, template: pet.template ?? def.template,
				level: pet.level || 1, rarity: pet.rarity || 0,
				look: pet.look || rollGhostLook(mulberry32((save.seed || 1) + save.spirits.length), pet.rarity || 0, kit.slots[0] || "measured", "hunt"),
				move: kit.slots[0] || "measured", known: kit.known, slots: kit.slots,
				hp: pet.hp ?? max, max, speed: pet.speed ?? 8 + (pet.level || 1), active: false
			});
		}
		save.box = [];
		if (save.spirits.length > 20) save.spirits.length = 20;
		const cap = 3 + save.ghostSlots;
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
			if (s.active) {
				if (following < cap) following += 1;
				else s.active = false;
			}
		}
		if (!following) {
			for (const s of save.spirits) {
				if (following >= cap) break;
				s.active = true;
				following += 1;
			}
		}
		if (!save.innate?.length) {
			const seed = save.seed || 1;
			save.innate = save.known?.length ? save.known.slice(0, 4) : rollInnate(mulberry32(seed));
		}
		normalizeAbilities(save);
		if (save.traitId && !TRAIT_BY_ID[save.traitId]) save.traitId = null;
		if (save.female === undefined) save.female = true;
		if (save.classMovesV !== 2) {
			for (const id of CLASS_BY_ID[save.classId].starterMoves) if (MOVE_BY_ID[id] && !save.abilityRanks[id]) save.abilityRanks[id] = 1;
			save.classMovesV = 2;
		}
		save.dungeons = normalizeDungeonState(save.dungeons);
		if (this.rules === "hardcore") {
			const fresh = !save.survival; save.survival = normalizeSurvival(save.survival);
			if (fresh) { save.bag.trail_ration = (save.bag.trail_ration ?? 0) + 2; }
		}
		if (save.map.startsWith("rift-") && !save.dungeons.portals.some(p => p.id === save.map)) { save.map = "world"; Object.assign(save, hearthXY()); }
		if (save.map.startsWith("custom-") && !savedMaps().some((m) => `custom-${m.id}` === save.map)) { save.map = "world"; Object.assign(save, hearthXY()); }
		for (const g of save.gear) migrateEquipment(g);
		this.foldAccount(save);
		this.syncArsenal(save);
	}
	gainAccount(n) {
		const save = this.save;
		save.accountXp += Math.max(0, n);
		let need = accountNeed(save.accountLevel);
		while (save.accountXp >= need && save.accountLevel < 40) {
			save.accountXp -= need;
			save.accountLevel += 1;
			save.perkPoints += 5;
			this.say(`Account ${save.accountLevel}. 5 perk points.`);
			this.tone(520, .14, "square");
			need = accountNeed(save.accountLevel);
		}
	}
	pickTavern() {
		const last = this.save?.lastTavern;
		const pool = TAVERNS.filter((t) => t.id !== last);
		return pool[Math.floor(Math.random() * pool.length)] ?? TAVERNS[0];
	}
	openBounty(tavern) {
		publish({ panel: "bounty" });
		this.say(`${tavern.name}. The board has a hunter's name.`);
		this.syncHud(true);
	}
	playerArmor() {
		return ["head", "chest", "legs", "feet", "relic"].reduce((sum, slot) => { const g = this.piece(slot); return sum + (g ? equipmentStats(g).armor : 0); }, 0);
	}
	mobArmor(mob) {
		if (mob.bounty && mob.lootGear?.length) return mob.lootGear.reduce((sum, g) => sum + equipmentStats(g).armor, 0);
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
		return n;
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
		return Math.max(20, Math.floor((78 + save.level * 12 + this.chan("spark_life") + this.chan("vitality")) * (1 + this.mod("hp") / 100)));
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
		if (onMob && mob) mob.status.push(st);
		else this.addStatus(st.id, st.t);
	}
	profile() {
		const save = this.save;
		const key = `${save?.classId}|${save?.traitId ?? ""}`;
		if (this.profileKey !== key) {
			this.profileKey = key;
			this.profileCache = save ? classProfile(save.classId, save.traitId) : { stats: {}, immune: [] };
		}
		return this.profileCache;
	}
	mod(id) {
		return this.save ? this.profile().stats[id] ?? 0 : 0;
	}
	speedMult() {
		const swift = this.status.some((s) => s.id === "swift") ? 1.45 : 1;
		return Math.max(.5, 1 + this.mod("speed") / 100) * swift * (1 + Math.min(.45, this.chan("swift_step") / 100));
	}
	addStatus(id, t) {
		if (id === "none") return;
		if (this.save && this.profile().immune.includes(id)) {
			this.float(this.save.x, this.save.y - 52, "IMMUNE", "#9ad8c8");
			return;
		}
		this.status.push({
			id,
			t
		});
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
			ghostSlots: raw.ghostSlots || 0
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
				const lv = Math.max(1, Math.min(MAX_SKILL_LEVEL, had.level | 0));
				const xp = Math.max(0, had.xp | 0);
				if (lv > cur.level || (lv === cur.level && xp > (cur.xp | 0))) {
					cur.level = lv;
					cur.xp = lv >= MAX_SKILL_LEVEL ? 0 : xp;
				}
			}
			save.accountLevel = Math.max(save.accountLevel || 1, meta.accountLevel | 0 || 1);
			save.accountXp = Math.max(save.accountXp || 0, meta.accountXp | 0 || 0);
			save.perkPoints = Math.max(save.perkPoints || 0, meta.perkPoints | 0 || 0);
			save.perks = save.perks || {};
			const perks = meta.perks && typeof meta.perks === "object" ? meta.perks : {};
			for (const [id, n] of Object.entries(perks)) {
				const v = Math.max(0, n | 0);
				if (v > (save.perks[id] ?? 0)) save.perks[id] = v;
			}
			save.accountScore = Math.max(save.accountScore ?? 0, meta.accountScore | 0 || 0);
			save.ghostSlots = Math.max(save.ghostSlots | 0, meta.ghostSlots | 0 || 0);
		}
		this.writeProgress(save);
	}
	writeProgress(save) {
		if (!save?.skills) return;
		const skills = {};
		for (const sk of SKILLS) {
			const st = save.skills[sk.id];
			skills[sk.id] = { level: Math.max(1, Math.min(MAX_SKILL_LEVEL, st?.level | 0 || 1)), xp: Math.max(0, st?.xp | 0 || 0) };
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
		for (const g of this.save.gear) this.noteFound(g);
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
		this.duel = null;
		this.save = null;
		this.mobs = [];
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
	openRoom(role, code) {
		this.room?.close();
		this.role = role;
		const room = `tz${code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
		publish({
			roomCode: code.toUpperCase(),
			net: "Seeking the veil..."
		});
		const opened: P2PRoom = new P2PRoom({
			room,
			selfId: this.selfId,
			name: this.save?.name ?? "Huntress",
			role: role === "host" ? "host" : "guest",
			onRejected: (reason) => {
				if (this.room !== opened) return;
				this.room = null;
				this.role = "solo";
				this.peers = [];
				this.remotes.clear();
				publish({ roomCode: "", net: "", peers: [] });
				this.say(
					reason === "no-lobby"
						? "No lobby with that code. The host has to create it first."
						: reason === "full"
							? "That lobby is full (3 witches max)."
							: "Someone is already hosting that code. Pick another."
				);
				this.syncHud(true);
			},
			onPeersChanged: (peers) => {
				this.peers = peers.map((p) => ({
					id: p.id,
					name: p.name,
					state: p.connectionState
				}));
				for (const id of [...this.remotes.keys()]) if (!peers.some((p) => p.id === id && p.connectionState !== "closed" && p.connectionState !== "failed")) this.remotes.delete(id);
				this.syncHud(true);
				publish({
					peers: peers.map((p) => p.name || p.id.slice(0, 4)),
					net: peers.length ? `${peers.length} linked` : "Lobby open"
				});
				if (this.role === "host") {
					this.room?.send({
						t: "world",
						dungeons: this.save?.dungeons,
						seed: this.save?.seed,
						map: this.save?.map,
						x: this.save?.x,
						y: this.save?.y
					});
					this.broadcastMobs();
				}
			},
			onMessage: (from, data) => this.onNet(from, data)
		});
		this.room = opened;
		opened.join();
	}
	onNet(from, data) {
		const msg = data;
		if (!msg || typeof msg.t !== "string") return;
		const save = this.save;
		if (msg.t === "p") this.remotes.set(from, {
			name: String(msg.name ?? "Hunter"),
			x: Number(msg.x),
			y: Number(msg.y),
			hp: Number(msg.hp),
			max: Number(msg.max),
			race: msg.race || "vesper",
			classId: Object.hasOwn(CLASS_BY_ID, msg.classId) ? msg.classId : undefined,
			host: !!msg.host,
			female: msg.female !== false,
			level: Number(msg.level) || 1,
			direction: ["up", "right", "down", "left"].includes(msg.direction) ? msg.direction : "down",
			facing: Number(msg.facing) || 1,
			map: msg.map || "world",
			pieces: Array.isArray(msg.pieces) ? msg.pieces : []
		});
		else if (msg.t === "dungeons" && this.role === "guest" && save) save.dungeons = normalizeDungeonState(msg.dungeons);
		else if (msg.t === "world" && this.role === "guest" && save) {
			save.dungeons = normalizeDungeonState(msg.dungeons);
			const seed = Number(msg.seed);
			if (Number.isFinite(seed) && (seed !== save.seed || msg.map !== save.map)) {
				save.seed = seed;
				this.overworld = null;
				this.switchTo(msg.map || "world", {
					x: Number(msg.x) || save.x,
					y: Number(msg.y) || save.y
				});
			}
		} else if (msg.t === "mobs" && this.role === "guest" && Array.isArray(msg.list)) this.applyMobSnap(msg.list);
		else if (msg.t === "dmg" && this.role === "host") {
			const mob = this.mobs.find((m) => m.id === msg.id && m.alive);
			if (mob) this.applyMobDamage(mob, Number(msg.amount) || 0);
		} else if (msg.t === "dead") {
			const mob = this.mobs.find((m) => m.id === msg.id);
			if (mob && mob.alive && this.role === "guest") {
				mob.alive = false;
				mob.hp = 0;
				this.say(`${mob.name} falls.`);
				const piece = rollGear(mulberry32(Math.random() * 1e9 | 0), {
					level: mob.level,
					raceBias: save?.race,
					luck: 10,
					floor: mob.boss ? "rare" : null
				});
				save?.gear && this.receiveGear(piece);
				this.say(`Your roll: ${piece.name}.`);
			}
		} else if (msg.t === "go" && save) {
			if (msg.dungeons) save.dungeons = normalizeDungeonState(msg.dungeons);
			this.switchTo(msg.map, { x: Number(msg.x), y: Number(msg.y) });
		}
		else if (msg.t === "chat") {
			this.chat.push({
				name: String(msg.name ?? "?"),
				text: String(msg.text ?? "").slice(0, 140)
			});
			this.chat = this.chat.slice(-8);
			publish({ chat: this.chat });
		} else if (msg.t === "trade") this.onTrade(from, msg);
	}
	applyMobSnap(list) {
		for (const row of list) {
			let mob = this.mobs.find((m) => m.id === row.id);
			if (!mob) continue;
			const prev = this.seenSwing.get(row.id) ?? 0;
			mob.x = row.x;
			mob.y = row.y;
			mob.hp = row.hp;
			mob.alive = row.alive;
			mob.move = row.move;
			if (row.swing > prev) {
				this.seenSwing.set(row.id, row.swing);
				const move = MOVE_BY_ID[row.move] ?? MOVES[0];
				const save = this.save;
				this.playMoveFx(move, mob.x, mob.y - 12, save.x, save.y - 18);
				if (Math.hypot(mob.x - save.x, mob.y - save.y) < attackRange(move) + 16) this.queueStrike(mob, move);
			}
		}
	}
	broadcastPos() {
		const save = this.save;
		if (!save || !this.room) return;
		const pieces = [
			"weapon",
			"head",
			"chest",
			"legs",
			"feet",
			"relic"
		].map((s) => this.piece(s)).filter((g) => !!g);
		this.room.broadcast({
			t: "p",
			name: save.name,
			x: save.x,
			y: save.y,
			hp: save.hp,
			max: this.maxHp(),
			race: save.race,
			classId: save.classId,
			female: save.female !== false,
			level: save.level,
			host: this.role === "host",
			direction: this.direction,
			facing: this.facing,
			map: save.map,
			pieces
		});
	}
	broadcastMobs() {
		if (!this.room) return;
		this.room.broadcast({
			t: "mobs",
			list: this.mobs.map((m) => ({
				id: m.id,
				x: m.x,
				y: m.y,
				hp: m.hp,
				alive: m.alive,
				swing: m.swing,
				move: m.move
			}))
		});
	}
	sendChat(text) {
		const save = this.save;
		if (!save) return;
		const line = text.trim().slice(0, 140);
		if (!line) return;
		this.chat.push({
			name: save.name,
			text: line
		});
		this.chat = this.chat.slice(-8);
		this.room?.send({
			t: "chat",
			name: save.name,
			text: line
		});
		publish({ chat: this.chat });
	}
	toggleTrade() {
		if (!this.save || this.dead) return;
		const near = this.nearestRemote();
		if (!near) return this.say("No hunter close enough to trade.");
		this.trade = {
			peer: near.id,
			mine: [],
			items: {},
			theirsGear: [],
			theirsItems: {},
			me: false,
			them: false,
			nonce: nextUid()
		};
		this.room?.send({
			t: "trade",
			op: "open",
			nonce: this.trade.nonce
		}, near.id);
		publish({ panel: "trade" });
		this.syncHud(true);
	}
	offerSelected() {
		if (!this.trade || !this.selected) return;
		if (!this.trade.mine.includes(this.selected)) this.trade.mine.push(this.selected);
		this.pushOffer();
	}
	offerItem(id) {
		if (!this.trade) return;
		this.trade.items[id] = (this.trade.items[id] ?? 0) + 1;
		this.pushOffer();
	}
	lockTrade() {
		if (!this.trade) return;
		this.trade.me = !this.trade.me;
		this.pushOffer();
		this.tryCommit();
	}
	pushOffer() {
		if (!this.trade || !this.save) return;
		const gear = this.trade.mine.map((id) => this.save.gear.find((g) => g.uid === id)).filter((g) => !!g);
		this.room?.send({
			t: "trade",
			op: "offer",
			gear,
			items: this.trade.items,
			lock: this.trade.me,
			nonce: this.trade.nonce
		}, this.trade.peer);
		this.syncHud(true);
	}
	onTrade(from, msg) {
		if (!this.save || this.dead) return;
		if (msg.op === "open") {
			this.trade = {
				peer: from,
				mine: [],
				items: {},
				theirsGear: [],
				theirsItems: {},
				me: false,
				them: false,
				nonce: String(msg.nonce ?? nextUid())
			};
			publish({ panel: "trade" });
		}
		if (!this.trade || this.trade.peer !== from) return;
		if (msg.op === "offer") {
			this.trade.theirsGear = msg.gear ?? [];
			this.trade.theirsItems = msg.items ?? {};
			this.trade.them = !!msg.lock;
			this.tryCommit();
		}
		this.syncHud(true);
	}
	tryCommit() {
		const tr = this.trade;
		const save = this.save;
		if (!tr || !save || !tr.me || !tr.them) return;
		for (const uid of tr.mine) {
			save.gear = save.gear.filter((g) => g.uid !== uid);
			for (const k of Object.keys(save.equipped)) if (save.equipped[k] === uid) delete save.equipped[k];
		}
		for (const [id, n] of Object.entries(tr.items)) save.bag[id] = Math.max(0, (save.bag[id] ?? 0) - n);
		for (const g of tr.theirsGear) this.receiveGear({
			...g,
			uid: nextUid()
		});
		for (const [id, n] of Object.entries(tr.theirsItems)) this.giveItem(id, n);
		this.trade = null;
		this.say("Trade sealed.");
		publish({
			panel: null,
			trade: null
		});
		this.persist();
	}
	nearestRemote() {
		const save = this.save;
		if (!save) return null;
		let best = null;
		let bd = 90;
		for (const [id, r] of this.remotes) {
			if (r.map !== save.map) continue;
			const d = Math.hypot(r.x - save.x, r.y - save.y);
			if (d < bd) {
				bd = d;
				best = {
					id,
					name: r.name
				};
			}
		}
		return best;
	}
	lobbyInfo() {
		const save = this.save;
		const members = [];
		if (save && this.room) members.push({ id: this.selfId, name: save.name, classId: save.classId, className: CLASS_BY_ID[save.classId]?.name ?? "", level: save.level, hp: Math.ceil(save.hp), max: this.maxHp(), map: save.map, self: true, host: this.role === "host" });
		for (const p of this.peers ?? []) {
			const r = this.remotes.get(p.id);
			members.push({ id: p.id, name: r?.name || p.name || p.id.slice(0, 4), classId: r?.classId ?? "", className: r?.classId ? CLASS_BY_ID[r.classId]?.name ?? "" : p.state === "connected" ? "Linked" : "Connecting", level: r?.level ?? 0, hp: Math.ceil(r?.hp ?? 0), max: r?.max ?? 0, map: r?.map ?? "", self: false, host: !!r?.host });
		}
		return { code: snap.roomCode || "", role: this.room ? this.role : "solo", net: snap.net || "", members };
	}
	hostLobby(code) {
		if (!this.save) return;
		this.openRoom("host", code);
		this.say(`Lobby ${code.toUpperCase()} is open. Share the code.`);
	}
	joinLobby(code) {
		if (!this.save || String(code).trim().length < 3) return;
		this.openRoom("guest", code);
		this.say(`Joining lobby ${code.toUpperCase()}...`);
	}
	leaveLobby() {
		this.room?.close();
		this.room = null;
		this.role = "solo";
		this.peers = [];
		this.remotes.clear();
		publish({ roomCode: "", net: "", peers: [] });
		this.say("You left the lobby.");
		this.syncHud(true);
	}
	buildSheet() {
		const save = this.save;
		const c = CLASS_BY_ID[save.classId];
		const prof = this.profile();
		const t = save.traitId ? TRAIT_BY_ID[save.traitId] : null;
		const cls = buffLines(c.stats, c.immune ?? []);
		const tr = t ? buffLines(t.stats, t.immune ?? []) : { buffs: [], debuffs: [] };
		const pct = (v) => `${v > 0 ? "+" : ""}${v}%`;
		const stats = Object.entries(STAT_LABEL).map(([id, l]) => ({ id, name: l.name, about: l.about, mod: prof.stats[id] ?? 0, value: id === "crit" ? `${prof.stats.crit > 0 ? "+" : ""}${prof.stats.crit}` : pct(prof.stats[id] ?? 0) }));
		const GOOD = new Set(["swift", "shell"]);
		const NAMES = { swift: "Swift (+45% speed)", shell: "Shell (-30% damage)", burn: "Burning", soak: "Soaked (slowed)", root: "Rooted", sleep: "Asleep", gloom: "Gloom (-20% damage)", silence: "Silenced", spark: "Sparked", expose: "Exposed", leech: "Drained" };
		const effects = this.status.filter((st) => st.t > 0).map((st) => ({ id: st.id, label: NAMES[st.id] ?? st.id, t: Math.ceil(st.t), good: GOOD.has(st.id) }));
		if (this.buff.t > 0) effects.push({ id: "edge", label: `Battle edge (+${this.buff.crit} crit)`, t: Math.ceil(this.buff.t), good: true });
		if (this.wardT > 0) effects.push({ id: "ward", label: "Ward (no harm)", t: Math.ceil(this.wardT), good: true });
		if (this.shield > 0) effects.push({ id: "shield", label: `Shield ${Math.ceil(this.shield)}`, t: 0, good: true });
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
				{ label: "Damage taken", value: `${Math.round((1 - Math.max(-.5, Math.min(.6, prof.stats.guard / 100))) * 100)}%` },
				{ label: "Cooldowns", value: `${Math.round((1 - Math.max(-.4, Math.min(.45, prof.stats.haste / 100))) * 100)}%` },
				{ label: "Element", value: TYPES[c.type].name },
				{ label: "Immunities", value: prof.immune.map((i) => IMMUNE_LABEL[i]).join(", ") || "None" },
				{ label: "Set", value: set.name ? `${set.name} ${set.count}/5` : "None" },
			],
			account: { level: save.accountLevel, score: save.accountScore ?? 0, perks: save.perkPoints },
		};
	}
	hudAt = 0;
	syncHud(force) {
		const now = performance.now();
		if (!force && now - this.hudAt < 120) return;
		this.hudAt = now;
		const save = this.save;
		if (!save) return;
		const set = this.setInfo();
		const q = QUESTS.find((d) => !save.quests[d.id]?.done) ?? QUESTS[QUESTS.length - 1];
		const region = this.world && save.map === "world" ? BIOME_LABEL[biomeNameAt(this.world, save.x, save.y)] : save.map === "crypt" ? "Tiny Crypt" : save.map.startsWith("rift-") ? `Dungeon ${save.map.slice(5)}` : save.map.startsWith("custom-") ? this.customFile?.name ?? "Custom map" : "Ash Kiln";
		const npc = NPCS.find((n) => n.id === this.talkId);
		publish({
			mode: "play",
			name: save.name,
			classId: save.classId,
			sheet: this.buildSheet(),
			lobby: this.lobbyInfo(),
			race: save.race,
			level: save.level,
			dungeonCountdown: Math.ceil(DUNGEON_INTERVAL - (save.dungeons?.elapsed ?? 0)),
			dungeonPortals: save.dungeons?.portals ?? [],
			skillPoints: save.skillPoints ?? 0,
			abilities: MOVES.map(m => ({ ...m, rank: save.abilityRanks?.[m.id] ?? 0 })),
			xp: save.xp,
			xpNeed: xpNeed(save.level),
			hp: Math.max(0, Math.ceil(save.hp)),
			maxHp: this.maxHp(),
			shield: Math.ceil(this.shield),
			kyo: save.kyo,
			region,
			map: save.map,
			log: this.log,
			questName: q.name,
			questAbout: q.about,
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
					tag: `${reactOf(m)} · ${formTag(m)}${defenseFail(m, 0) ? ` · ${defenseFail(m, 0)}% slip` : ""}`
				};
			}),
			gear: save.gear,
			equipped: Object.values(save.equipped).filter((x) => !!x),
			setLabel: set.name ? `${set.name} ${set.count}/5` : "No set",
			setBonus: set.on ? set.bonus : "Wear all 5 pieces of one set.",
			setCount: set.count,
			totals: Object.entries([
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
			skills: SKILLS.map((sk) => ({
				id: sk.id,
				name: sk.name,
				level: save.skills[sk.id].level,
				xp: save.skills[sk.id].xp,
				need: skillNeed(save.skills[sk.id].level),
				line: skillLine(sk.id, save.skills[sk.id].level)
			})),
			bag: ITEMS.filter((it) => (save.bag[it.id] ?? 0) > 0).map((it) => ({
				id: it.id,
				name: it.name,
				count: save.bag[it.id] ?? 0,
				about: it.about, useProblem: this.itemProblem(it)
			})),
			talk: npc ? {
				id: npc.id,
				name: npc.name,
				role: npc.role,
				line: npc.lines[this.talkI] ?? npc.lines[0],
				shop: npc.shop ?? null,
				shrine: npc.shrine ?? null
			} : null,
			shrine: this.shrine ? `${TYPES[this.shrine.type].name} shrine · round ${this.shrine.round}/3` : "",
			companion: this.activeSpirits().filter((s) => s.hp > 0).map((s) => `${s.name} lv${s.level}`).join(", ") || "No spirits out",
			spirits: (save.spirits ?? []).map((s) => ({
				uid: s.uid,
				name: s.name,
				type: s.type,
				level: s.level,
				rarity: s.rarity,
				hp: Math.max(0, Math.ceil(s.hp)),
				max: Math.max(1, Math.ceil(s.max)),
				active: !!s.active,
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
			spiritCap: 20,
			jarLeft: Math.ceil(save.jarLeft ?? 0),
			accountScore: save.accountScore ?? 0,
			turn: this.duel ? (this.duel.phase === "yours" ? "Your verse" : `${this.duel.lead?.name ?? "They"} readies`) : this.turnQ[0] ? (this.turnQ[0].side === "you" ? "Your turn" : this.turnQ[0].side === "spirit" ? "Spirit" : "Enemy") : "",
			survival: this.rules === "hardcore" ? { ...save.survival } : null,
			nearTree: !!this.nodeNear("tree", 64),
			nearCamp: this.nearCamp(), nearWater: waterWithinReach(this.world, save.x, save.y), sleeping: !!this.sleeping,
			rules: this.rules === "hardcore" ? "hardcore" : "hunt",
			duel: this.duel ? {
				phase: this.duel.phase === "yours" ? "yours" : "answer",
				attacker: this.duel.lead?.name ?? "",
				move: MOVE_BY_ID[this.duel.moveId]?.name ?? "",
				about: MOVE_BY_ID[this.duel.moveId]?.about ?? "",
				beat: this.duel.beat ?? ""
			} : null,
			box: save.box.map((p) => `${MONSTER_BY_ID[p.species]?.name ?? "Spirit"} lv ${p.level}`),
			known: save.known.map((id) => ({
				id,
				name: MOVE_BY_ID[id]?.name ?? id,
				type: MOVE_BY_ID[id]?.type ?? "normal"
			})),
			stash: save.stash.map((e) => `${ENCHANT_BY_ID[e.id]?.name ?? e.id} ${e.power}`),
			selected: this.selected,
			chat: this.chat,
			trade: this.trade ? {
				open: true,
				peer: this.remotes.get(this.trade.peer)?.name ?? "Hunter",
				mine: this.trade.mine.map((id) => save.gear.find((g) => g.uid === id)?.name ?? id).join(", ") || "—",
				theirs: this.trade.theirsGear.map((g) => g.name).join(", ") || "—",
				me: this.trade.me,
				them: this.trade.them
			} : null,
			stock: this.shopStock.map((g) => ({
				uid: g.uid,
				name: g.name,
				price: this.price(g.price),
				type: TYPES[g.type].name
			})),
			wares: [
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
			party: (save.party ?? []).map((id) => NPCS.find((n) => n.id === id)?.name ?? id),
			autoplay: this.autoplay,
			grind: this.autoplay ? this.grind : "",
			accountLevel: save.accountLevel,
			accountXp: save.accountXp,
			accountNeed: accountNeed(save.accountLevel),
			perkPoints: save.perkPoints,
			perks: ENCHANTS.filter((def) => def.perk).map((def) => ({
				id: def.id,
				name: def.name,
				power: save.perks[def.id] ?? 0,
				max: def.perk.max,
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
			unstuck: this.unstuckT > 0 ? Math.ceil(this.unstuckT) : 0,
			unlocked: SETS.filter((s) => this.isUnlocked(s.id)).map((s) => ({
				id: s.id,
				name: s.name,
				race: s.race,
				bonus: s.bonus
			}))
		});
	}
	draw() {
		const { w, h, dpr } = this.cssSize();
		const ctx = this.ctx;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = "#140e0c";
		ctx.fillRect(0, 0, w, h);
		if (!this.world || !this.save || snap.mode !== "play") {
			ctx.fillStyle = "#f0e2c8";
			ctx.font = "12px 'Press Start 2P', monospace";
			ctx.fillText("TURBZ", 24, 48);
			return;
		}
		const sx = (Math.random() - .5) * this.shake;
		const sy = (Math.random() - .5) * this.shake;
		ctx.translate(w / 2 + sx, h / 2 + sy);
		ctx.scale(this.zoom, this.zoom);
		ctx.translate(-this.cam.x, -this.cam.y);
		ctx.imageSmoothingEnabled = false;
		if (this.world.cache) ctx.drawImage(this.world.cache, 0, 0);
		else drawWorldSlice(ctx, this.world, this.cam.x, this.cam.y, w, h, this.zoom);
		const save = this.save;
		if (save.map === "world") for (const p of POIS) {
			const pos = poiPos(p);
			if (!pos) continue;
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
		else {
			const ex = this.dungeonExitAt();
			drawRift(ctx, ex.x, ex.y + 8);
			drawShadowName(ctx, "EXIT", ex.x, ex.y - 130, "#e7d9ff");
		}
		if (save.map === "world") for (const portal of save.dungeons?.portals ?? []) {
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
		for (const node of this.world.spawns) if (node.kind === "node") {
			if (Math.abs(node.x - this.cam.x) > w / this.zoom * 0.62 + 96 || Math.abs(node.y - this.cam.y) > h / this.zoom * 0.62 + 128) continue;
			paintNode(ctx, node.node, node.x, node.y + 2);
			drawShadowName(ctx, node.node === "tree" ? "LOGS" : node.node === "ore" ? "ORE" : "SHROOMS", node.x, node.y - (node.node === "tree" ? 66 : 22), node.node === "ore" ? "#e6c15a" : "#9ad8c8");
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
						quality: Math.max(0, qualities.indexOf(g.quality))
					})),
					setFx: null,
					setOn: false
				});
			} else drawMonster(ctx, {
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
				animal: !!m.animal,
				species: m.species,
				look: m.look ?? null,
				time: this.clock
			});
			const pct = m.hp / m.max;
			const near = Math.hypot(m.x - save.x, m.y - save.y) < 220;
			const show = near || m.boss || m.witch || this.combat > 0;
			const barW = m.boss || m.witch ? 78 : 56;
			const by = m.y - (m.witch ? 48 : m.boss ? 40 : 34);
			if (show) {
				ctx.fillStyle = "#1a1214";
				ctx.fillRect(m.x - barW / 2 - 1, by - 1, barW + 2, 8);
				ctx.fillStyle = m.witch ? "#c4473a" : TYPES[m.type].color;
				ctx.fillRect(m.x - barW / 2, by, barW * pct, 6);
				drawShadowName(ctx, `${Math.max(0, Math.ceil(m.hp))} ${TYPES[m.type].name}`, m.x, by - 2, "#fff6e8");
			}
			if (m.boss || m.witch || m.bounty || near) drawShadowName(ctx, m.bounty ? `${m.name} · ${CLASS_BY_ID[m.classId]?.name ?? "Hunter"} ${m.level}` : `${m.name} ${m.level}`, m.x, by - 18, m.bounty ? "#ff4d6a" : m.witch ? "#ff4d6a" : m.boss ? "#c4473a" : TYPES[m.type].color);
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
			quality: [
				"worn",
				"common",
				"fine",
				"rare",
				"epic",
				"legendary"
			].indexOf(g.quality)
		}));
		this.activeSpirits().forEach((spirit, i) => {
			const at = this.mates[i];
			if (!at || spirit.hp <= 0) return;
			drawMonster(ctx, {
				x: at.x,
				y: at.y,
				template: spirit.template,
				type: spirit.type,
				facing: this.facing,
				walk: this.walk + i,
				hurt: at.swing > 0 ? 0.2 : 0,
				boss: false,
				rarity: spirit.rarity,
				ghost: true,
				look: spirit.look,
				time: this.clock
			});
			drawShadowName(ctx, spirit.name, at.x, at.y - 36, TYPES[spirit.type].color);
		});
		for (const id of save.party ?? []) {
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
			drawShadowName(ctx, npc.name.split(" ").slice(-1)[0], px, py - 44, "#9ad8c8");
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
					quality: Math.max(0, ["worn", "common", "fine", "rare", "epic", "legendary"].indexOf(g.quality))
				})),
				setFx: null,
				setOn: false,
				time: this.clock
			});
			drawShadowName(ctx, r.name, r.x, r.y - 44, "#e6c15a");
		}
		drawActor(ctx, {
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
			time: this.clock,
			scale: 1
		});
		drawShadowName(ctx, save.name, save.x, save.y - 44, "#fff6e8");
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
			if (prompt) drawShadowName(ctx, prompt, save.x, save.y - 62, "#e6c15a");
		}
		if (this.combat > 0 || this.wardT > 0) {
			const pct = Math.max(0, save.hp / this.maxHp());
			ctx.fillStyle = "#1a1214";
			ctx.fillRect(save.x - 22, save.y - 52, 44, 6);
			ctx.fillStyle = "#c4473a";
			ctx.fillRect(save.x - 22, save.y - 52, 44 * pct, 4);
			if (this.wardT > 0) {
				ctx.strokeStyle = "#fff1a8";
				ctx.lineWidth = 2;
				ctx.strokeRect(save.x - 24, save.y - 54, 48, 10);
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
		for (const f of this.floats) {
			ctx.font = "26px VT323, monospace";
			ctx.textAlign = "center";
			ctx.fillStyle = "#140e0c";
			ctx.fillText(f.text, f.x + 1, f.y + 1);
			ctx.fillStyle = f.color;
			ctx.fillText(f.text, f.x, f.y);
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (this.channel || this.castLock > 0) {
			const p = this.channel ? this.channel.t / this.channel.need : 1 - this.castLock / Math.max(.05, this.castLockMax);
			ctx.fillStyle = "#1a1214";
			ctx.fillRect(w / 2 - 46, h / 2 - 78, 92, 6);
			ctx.fillStyle = this.castLock > 0 ? "#e6c15a" : "#f0e2c8";
			ctx.fillRect(w / 2 - 46, h / 2 - 78, 92 * Math.max(0, Math.min(1, p)), 6);
		}
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
	drawMap(canvas) {
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
			actions: [...info?.actions ?? [], ...(this.rules === "hardcore" ? [{ id: "menu:survival", label: "Survival & Camp" }] : []), ...shell]
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
					...(mob.bounty ? [
						mob.enraged ? "The hunt has turned. They are twice as strong." : `${Math.ceil(mob.huntIn)}s before they hunt you.`,
						`Wears ${mob.lootGear?.length ?? 0} pieces better than yours. Purse ${mob.lootKyo} kyo.`
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
			const info = { tree: ["Tree · chop for logs", "Resource tree", "Chop logs to build a campfire, cook meals, and purify water.", "Chop logs"], ore: ["Ore vein · mine", "Ore vein", "Mine ore to sell at Crownfall.", "Mine ore"], shroom: ["Mushroom patch · forage", "Mushroom patch", "Forage mushrooms and alchemy spores.", "Forage"] }[node.node];
			if (info) return { hint: info[0], title: info[1], lines: [info[2], "Press E beside it. Gathering destroys it. Another one grows somewhere else."], actions: [{ id: `chop:${node.id}`, label: info[3] }] };
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
				lines: ["A giant rift. Walk the lip and step through.", this.rules === "hardcore" ? "Hardcore death takes this body, including inside dungeons." : "Die in there and you are knocked out. Kyo bleeds. Gear stays."],
				actions: []
			};
			if (p.kind === "shrine") return {
				hint: `${p.name} · arena`,
				title: p.name,
				lines: ["A battle arena. Speak to the keeper at the door.", this.rules === "hardcore" ? "Hardcore death takes this body. The shrine does not heal injuries." : "A loss here is a knockout, not the veil."],
				actions: []
			};
			if (p.kind === "node") return {
				hint: `${p.node} node`,
				title: p.node,
				lines: ["Gather with Speak, or from this menu."],
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
	emitGrave(save, score) {
		if (!this.graveFn || !score) return;
		const gear = [];
		for (const slot of ["weapon", "head", "chest", "legs", "feet", "relic"]) {
			const g = this.piece(slot);
			if (!g) continue;
			gear.push({
				slot,
				name: g.name,
				level: g.level,
				quality: qualityName(g.quality),
				type: TYPES[g.type]?.name ?? g.type,
				enchants: (g.enchants ?? []).map((e) => ({ name: ENCHANT_BY_ID[e.id]?.name ?? e.id, power: e.power })),
				moves: (g.moves ?? []).map((id) => MOVE_BY_ID[id]?.name ?? id)
			});
		}
		const body: GraveBody = {
			mode: this.rules === "hardcore" ? "hardcore" : "hunt",
			score,
			name: save.name,
			race: RACES.find((r) => r.id === save.race)?.name ?? save.race,
			level: save.level,
			accountScore: save.accountScore ?? 0,
			skills: SKILLS.map((sk) => ({ name: sk.name, level: save.skills[sk.id]?.level ?? 1 })),
			gear,
			note: this.rules === "hardcore" ? "Died grinding the hardcore wilds." : "Died on the hunt."
		};
		try { this.graveFn(body); } catch { /* the board can wait */ }
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
		this.tone(110, .18, "sawtooth");
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
		const form = attackForm(move);
		const pure = form === "spell";
		const tm = pure ? 1 : typeChart(move.type, this.armorType());
		let dmg = (4 + mob.level * 1.25 + move.power * (form === "spell" ? .16 : .08)) * (pure ? 1 : tm === 0 ? .2 : tm) * (mob.boss ? 1.35 : 1);
		if (form === "melee") dmg *= 1.3;
		else if (form === "ranged") dmg = mitigate(dmg, this.playerArmor());
		if (mob.party) dmg *= .58;
		if (mob.summoner) dmg *= .82;
		if (mob.dungeonBoss) dmg *= .6;
		dmg *= 1 - Math.min(.45, this.chan("ward") / 160 + (this.buff?.ward ?? 0));
		return Math.max(1, dmg);
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
