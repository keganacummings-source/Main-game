#!/usr/bin/env node
/**
 * Builds the TURBZ player wiki.
 *
 *   node --import ./scripts/wiki/register.mjs scripts/wiki/build-wiki.mjs [outDir] [--check]
 *
 * Hand-written pages live in docs/wiki/pages/*.md. Every `<!-- gen:name -->` marker in them is
 * replaced with a table built from the game's own data (src/game/*.ts), so numbers in the wiki can
 * never drift from the game. The Glossary is generated last: every term, where it is defined, and a
 * link to every section of every page that mentions it.
 *
 * --check builds into a temp folder and fails on broken links, unknown markers or missing terms.
 * The GitHub workflow (.github/workflows/wiki.yml) runs the build and publishes it to the repo wiki.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SRC = join(ROOT, "docs", "wiki");
const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const OUT = args.find((a) => !a.startsWith("--")) ?? (CHECK ? join(tmpdir(), `turbz-wiki-${process.pid}`) : join(ROOT, "wiki-out"));
const REPO = "keganacummings-source/V6-TURBZ";

const game = async (name) => import(pathToFileURL(join(ROOT, "src", "game", `${name}.ts`)).href);
const C = await game("content");
const CL = await game("classes");
const B = await game("balance");
const SR = await game("status-rules");
const SV = await game("survival");
const DN = await game("daynight");
const QB = await game("quest-board");
const IU = await game("item-use");
const AP = await game("ability-progression");
const W = await game("world");
const BD = await game("building");
const GS = await game("ghost-style");
const GA = await game("ghost-abilities");
const PD = await game("procedural-dungeon");
const FG = await game("fx-gene");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pct = (n, d = 0) => `${(n * 100).toFixed(d)}%`;
const num = (n, d = 2) => (Number.isInteger(n) ? String(n) : n.toFixed(d).replace(/0+$/, "").replace(/\.$/, ""));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/\|/g, "\\|");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map((c) => esc(c ?? "")).join(" | ")} |`)].join("\n");
const typeName = (t) => C.TYPES[t]?.name ?? t;
const moveName = (id) => C.MOVE_BY_ID[id]?.name ?? id;
const itemName = (id) => C.ITEM_BY_ID[id]?.name ?? id;
const link = (text, page, anchor) => `[${text}](${page}${anchor ? `#${slug(anchor)}` : ""})`;
/** GitHub's heading anchor rule. */
function slug(text) {
  return String(text).trim().toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\- _]/gu, "").replace(/ /g, "-");
}
const EFFECT_LABEL = { none: "—", burn: "Burn", soak: "Soak", root: "Root", sleep: "Sleep", gloom: "Gloom", silence: "Silence", spark: "Spark", expose: "Expose", leech: "Leech", mend: "Mend", shell: "Shell", cleanse: "Cleanse", drain: "Drain" };

/** The cooldown a verse has with no gear, skills or class haste (the engine's moveCooldown with zero modifiers). */
function baseCooldown(m) {
  const tactic = C.moveTactic(m);
  const form = C.attackForm(m);
  let cd = Math.max(0.28, 0.55 + m.power / 90 - m.priority * 0.08);
  if (tactic === "heavy" || tactic === "channel") cd *= 1.7;
  else if (form === "spell") cd *= 1.35;
  else if (form === "melee") cd *= 0.8;
  if (tactic === "roll") cd = Math.max(cd, 2.6);
  if (tactic === "ward") cd = Math.max(cd, 5.5);
  if (tactic === "heal") cd = Math.max(cd, 3.2);
  if (tactic === "dash") cd = Math.max(cd, 1.6);
  if (tactic === "surge") cd = Math.max(cd, 8);
  return Math.max(0.2, cd);
}
const formLabel = (m) => {
  const f = C.attackForm(m);
  if (f !== "ranged") return cap(f);
  const s = C.rangedStyle(m);
  return s === "volley" ? "Ranged (volley)" : s === "reload" ? "Ranged (fast)" : "Ranged (long)";
};

// ---------------------------------------------------------------------------
// Generated blocks. Each key is a `<!-- gen:key -->` marker.
// ---------------------------------------------------------------------------

const GEN = {};

GEN["type-chart"] = () => {
  const ids = C.TYPE_IDS;
  const head = ["Attacker ↓ / Defender →", ...ids.map(typeName)];
  const cell = (a, d) => {
    const m = C.typeMult(a, d);
    return m === 0 ? "**0**" : m === 2 ? "**2×**" : m === 0.5 ? "½" : "·";
  };
  return table(head, ids.map((a) => [`**${typeName(a)}**`, ...ids.map((d) => cell(a, d))]));
};
GEN["type-list"] = () =>
  table(["Element", "Strong against (2×)", "Weak against (½)", "Cannot hurt (0×)", "Takes no damage from", "Hide"], C.TYPE_IDS.map((t) => {
    const T = C.TYPES[t];
    return [
      `**${T.name}**`,
      T.strong.map(typeName).join(", ") || "—",
      T.weak.map(typeName).join(", ") || "—",
      C.TYPE_IDS.filter((d) => C.TYPES[d].immune.includes(t)).map(typeName).join(", ") || "—",
      T.immune.map(typeName).join(", ") || "—",
      C.bodyRead(t).kind === "magic" ? "Ethereal: magic hits harder" : "Solid: physical hits harder",
    ];
  }));

GEN["verses"] = () => {
  const rows = [...C.MOVES].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)).map((m) => [
    `**${m.name}**`, typeName(m.type), cap(C.moveTactic(m)), formLabel(m), m.power, `${m.accuracy}%`, `${m.crit}%`, m.priority, EFFECT_LABEL[m.effect] ?? cap(m.effect), C.attackRange(m), `${num(baseCooldown(m))}s`, m.about,
  ]);
  return table(["Verse", "Element", "Tactic", "Form", "Power", "Accuracy", "Crit", "Priority", "Effect", "Reach", "Base cooldown", "Description"], rows);
};
GEN["verse-count"] = () => String(C.MOVES.length);
GEN["verse-batch"] = () => {
  const area = (m) => [m.nova ? `hits every foe within ${m.nova}px of you (85%)` : "", m.splash ? `splash ${m.splash.radius}px at ${Math.round(m.splash.mult * 100)}%` : "", m.chain ? `chains to ${m.chain.jumps} more within ${m.chain.range}px, ${Math.round(m.chain.mult * 100)}% per jump` : "", m.echo ? `returns for a ${Math.round(m.echo * 100)}% second cut` : ""].filter(Boolean).join("; ") || "—";
  return table(["Verse", "Element", "Tactic", "Animation", "Power", "Effect", "Area", "Description"], C.MOVES.filter((m) => m.fx).map((m) => [`**${m.name}**`, typeName(m.type), cap(C.moveTactic(m)), cap(m.fx), m.power, EFFECT_LABEL[m.effect] ?? cap(m.effect), area(m), m.about]));
};
GEN["ghost-rarities"] = () => table(["Rarity", "Abilities", "Ability strength", "Hit strength", "Look"], GS.GHOST_RARITIES.map((r) => [`**${r.name}**`, GA.abilityCount(r.id), `×${GA.RARITY_POWER[r.id]}`, `×${num(0.75 + r.id * 0.12)}`, [r.wash ? "colour wash" : "plain", `glow ${Math.round(r.glow * 100)}%`, `${Math.round(r.alpha * 100)}% solid`, r.gleam ? "moving gleam" : ""].filter(Boolean).join(", ")]));
GEN["ghost-palettes"] = () => table(["Palette", "Tier", "Odds (Common ghost)", "Odds (Epic ghost)", "Odds (Mythic ghost)"], GS.SHINY_PALETTES.map((p) => [`**${p.name}**`, ["Common", "Uncommon", "Rare", "Very rare"][p.tier], pct(GS.paletteOdds(p.id, 0), 1), pct(GS.paletteOdds(p.id, 3), 1), pct(GS.paletteOdds(p.id, 5), 1)]));
GEN["ghost-abilities"] = () => table(["Ability", "Kind", "Value at Lv 1 Common (mid quality)", "Cap (all ghosts)", "Cooldown", "What it does"], GA.GHOST_ABILITIES.map((a) => {
  const v = GA.abilityValue({ id: a.id, q: 0.5 }, { level: 1, rarity: 0 });
  return [`**${a.name}**${a.shiny ? " ✦" : ""}`, a.kind === "timed" ? "Timed" : "Passive", a.unit === "block" ? "1 hit" : a.unit === "dmg" ? `${v} dmg (+${a.perLevel}/level)` : `${v}${a.unit === "pct-hp" ? "% health" : ""}`, a.cap ? String(a.cap) : "2× best", a.cd ? `${a.cd}s` : "—", a.about.replace("{v}", "X").replace("{cd}", "N")];
}));
GEN["tactics"] = () => {
  const count = {};
  for (const m of C.MOVES) count[C.moveTactic(m)] = (count[C.moveTactic(m)] ?? 0) + 1;
  const about = {
    strike: "A normal attack. Melee, ranged or spell depending on the verse.",
    heavy: "A slow, big hit: you are locked in place for 0.62s, it deals 1.7× damage and its cooldown is 1.7× longer.",
    channel: "A charged spell: locked in place for 1.15s, then 1.25× damage. Cooldown 1.7× longer. Counts as magic.",
    lunge: "Dash in, hit at 0.72× and dash back. You are untouchable for 0.42s. Can slip (Snag).",
    blink: "Teleport behind the target and hit at 0.55×. Breaks roots and soak, clears incoming melee, 0.45s of evasion. Can slip (Snag: 0.24× hit, no teleport). With no target, blinks 84px the way you face.",
    dash: "Burst of movement in the direction you hold. 0.42s of evasion, clears incoming melee, clips the nearest foe for 0.6×. Cooldown at least 1.6s. Cannot be used while rooted.",
    roll: "Dodge roll. Covers you from a blow depending on how far you get (see Defense and Evasion). Clips a close target at 0.36×. Cooldown at least 2.6s.",
    ward: "3 seconds where nothing hurts you, plus a shield of (12 + power) × rank bonus. Cooldown at least 5.5s.",
    heal: "Restore (18 + 0.45 × power) × rank bonus health. Cooldown at least 3.2s. The only way to heal in Hardcore.",
    surge: "4 seconds of Swift (+45% move speed) and +6 crit (+12 for Rally Cry and Battle Rush); your element hits harder while it lasts. Cooldown at least 8s.",
  };
  return table(["Tactic", "Verses", "What it does"], Object.keys(about).map((t) => [`**${cap(t)}**`, count[t] ?? 0, about[t]]));
};

GEN["classes"] = () => {
  const parts = [];
  for (const role of CL.ROLES) {
    const list = CL.CLASSES.filter((c) => c.role === role);
    if (!list.length) continue;
    parts.push(`### ${role}s\n`);
    for (const c of list) {
      const { buffs, debuffs } = CL.buffLines(c.stats, c.immune ?? []);
      const apt = Object.entries(c.aptitudes ?? {}).map(([k, v]) => `${C.SKILLS.find((s) => s.id === k)?.name ?? k} ×${v}`).join(", ");
      parts.push(`#### ${c.name}\n`);
      parts.push(`*${c.blurb}* ${c.specialty}.\n`);
      parts.push(table(["", ""], [
        ["Element / race", `${typeName(c.type)} · ${C.RACES.find((r) => r.id === C.CLASS_RACE[c.id])?.name ?? ""}`],
        ["Role", c.role],
        ["Buffs", buffs.join(", ") || "—"],
        ["Drawbacks", debuffs.join(", ") || "—"],
        ["Passive", c.passive],
        ["Signature verse", moveName(c.signature)],
        ["Starting verses", c.starterMoves.map(moveName).join(", ")],
        ["Skill aptitudes", apt || "—"],
      ]));
      parts.push("");
    }
  }
  return parts.join("\n");
};
GEN["class-summary"] = () =>
  table(["Class", "Element", "Role", "Signature verse", "Key stats"], CL.CLASSES.map((c) => [link(c.name, "Classes", c.name), typeName(c.type), c.role, moveName(c.signature), CL.buffLines(c.stats, c.immune ?? []).buffs.join(", ")]));
GEN["class-count"] = () => String(CL.CLASSES.length);
GEN["stat-keys"] = () => table(["Stat", "What it changes"], Object.values(CL.STAT_LABEL).map((s) => [`**${s.name}**`, s.about]));
GEN["traits"] = () => table(["Trait", "Effect", "Flavour"], CL.TRAITS.map((t) => {
  const { buffs, debuffs } = CL.buffLines(t.stats, t.immune ?? []);
  return [`**${t.name}**`, [...buffs, ...debuffs].join(", "), t.about];
}));
GEN["races"] = () => table(["Race", "Element", "Classes", "Description"], C.RACES.map((r) => [`**${r.name}**`, typeName(r.type), CL.CLASSES.filter((c) => C.CLASS_RACE[c.id] === r.id).map((c) => c.name).join(", "), r.blurb]));

GEN["skills"] = () => {
  const effect = (id) => C.skillLine(id, 2).replace(/^\+?[\d.]+% /, "").replace(/^Out of combat, restore [\d.]+ health per second\. /, "Out-of-combat healing: ");
  return table(["Skill", "Effect at level L (per level above 1)", "At level 100", "At level 400", "Main ways to train"], C.SKILLS.map((s) => [
    `**${s.name}**`, C.skillLine(s.id, 2).replace(/0\.[0-9]%|[0-9.]+%/, "…"), C.skillLine(s.id, 100).split(". ")[0], C.skillLine(s.id, 400).split(". ")[0], SKILL_TRAIN[s.id] ?? "",
  ]));
};
const SKILL_TRAIN = {
  mining: "Mining ore nodes (+14 XP)", woodcutting: "Chopping trees (+14 XP)", hunting: "Every kill (+10, bosses +28, bounties +24+2×tier)",
  catching: "A spirit staying after a fight (+16)", trading: "Buying (+4), selling gear (+8), selling materials (+10)", fishing: "Landing a fish (+16), cooking a fish meal (+18)",
  social: "Finishing story quests (+12) and contracts (+8)", shroom: "Picking mushroom patches (+16)", alchemy: "Brewing (+18), stitching gear (+22)",
  adventuring: "New regions (+10), shrines (+6/+30), quests (+24), contracts (12–45), dodging hits (+1)", physical: "Casting melee/ranged verses (+2), hunting animals (+4)", magic: "Casting spells and channels (+3)",
  wayfinding: "Walking (+1 per 10 tiles), first visit to a town (+30) or continent (+20). Fast travel gives none",
  survival: "Hardcore: eating or drinking (+3), collecting water (+3), building a campfire (+12), waking rested (+15), living through a night (+40)",
  cooking: "Hardcore: campfire recipes (cook meat +8, cook fish +10, purify water +6)",
};
GEN["skill-need"] = () => table(["Skill level", "XP to next level"], [1, 2, 5, 10, 20, 30, 50, 100, 200, 300, 399].map((l) => [l, C.skillNeed(l).toLocaleString("en-US")]));
GEN["xp-need"] = () => table(["Character level", "XP to next level"], [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 399].map((l) => [l, C.xpNeed(l).toLocaleString("en-US")]));
GEN["account-need"] = () => table(["Account level", "Account XP to next level"], [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 35, 39].map((l) => [l, C.accountNeed(l).toLocaleString("en-US")]));
GEN["perks"] = () => table(["Perk", "Each point", "Max points"], C.ENCHANTS.filter((e) => e.perk).map((e) => [`**${e.name}**`, e.perk.each, e.perk.max]));

GEN["qualities"] = () => table(["Quality", "Price multiplier rank", "Level bonus over your level", "Enchantments (rarity part)", "Gear stat bonus"], C.QUALITIES.map((q, i) => {
  const lv = C.QUALITY_LEVEL[q.id];
  const ench = { worn: 0, common: 1, fine: 2, rare: 4, epic: 6, legendary: 8 }[q.id];
  return [`**${q.name}**`, i + 1, `${lv.pct >= 0 ? "+" : ""}${pct(lv.pct)} ${lv.flat >= 0 ? "+" : ""}${lv.flat}`, `+${ench}`, `+${i * 6} weapon damage / +${i * 5} armor`];
}));
GEN["enchants"] = () => table(["Enchantment", "Best on", "Max roll (on a level-1000 piece)", "What it does (shown at max)", "Also an account perk"], C.ENCHANTS.map((e) => [
  `**${e.name}**`, e.tag ? cap(e.tag) : "Any", `${e.max}${e.unit === "%" ? "" : " (flat)"}`, e.gear(e.max), e.perk ? `Yes, up to ${e.perk.max}` : "No",
]));
GEN["enchant-count"] = () => String(C.ENCHANTS.length);
GEN["drop-levels"] = () => {
  const levels = [1, 10, 30, 75, 150, 300, 400];
  return table(["Your level", ...C.QUALITIES.map((q) => q.name)], levels.map((l) => [l, ...C.QUALITIES.map((q) => C.dropGearLevel(l, q.id, 0, 0))]));
};
GEN["source-bonus"] = () => table(["Source", "Extra levels (share of your level)"], [
  ["Normal foe", `+${pct(B.SOURCE_BONUS.mob(1))} per rarity step`], ["World or dungeon boss", `+${pct(B.SOURCE_BONUS.boss)}`], ["Evil witch", `+${pct(B.SOURCE_BONUS.witch)}`], ["Shrine (round 3)", `+${pct(B.SOURCE_BONUS.shrine)}`],
  ["Hunter squad", `+${pct(B.SOURCE_BONUS.hunter(1))} at Wanted 1, +1% per Wanted level`], ["Bounty", `+${pct(B.SOURCE_BONUS.bounty(0))} + 2% per tier (tier 10: +${pct(B.SOURCE_BONUS.bounty(10))})`], ["Black market", "+0–10%"],
]);
GEN["sets"] = () => {
  const out = [];
  for (const r of C.RACES) {
    out.push(`### ${r.name} sets\n`);
    out.push(table(["Set", "Aura", "Bonus"], C.SETS.filter((s) => s.race === r.id).map((s) => [`**${s.name}**`, FX_NAME[s.fx] ?? s.fx, s.bonus])));
    out.push("");
  }
  return out.join("\n");
};
const FX_NAME = { voidring: "Void Ring", solarnova: "Solar Nova", tidalsurge: "Tidal Surge", briarburst: "Briar Burst", whitestorm: "Whitestorm", gravepulse: "Grave Pulse", stormcrown: "Storm Crown", lanternwake: "Lantern Wake", featherfall: "Featherfall", bloodmoon: "Blood Moon" };
GEN["set-auras"] = () => table(["Aura", "Sets using it", "Pulse effect (every 6.2s in combat, 120px around you)"], Object.entries(FX_NAME).map(([id, name]) => [
  `**${name}**`, C.SETS.filter((s) => s.fx === id).length,
  {
    voidring: "Damage + 2s Silence", solarnova: "Bigger damage (28 + 2×level)", tidalsurge: "Damage + 2.5s Soak", briarburst: "Damage + 2.5s Root", whitestorm: "Damage + 1.6s Sleep",
    gravepulse: "Damage + 1.6s Sleep; heals you 20 (TurboHunt)", stormcrown: "Damage + 2s Silence", lanternwake: "Damage; heals you 20 (TurboHunt)", featherfall: "Damage; heals you 20 (TurboHunt)", bloodmoon: "Bigger damage (28 + 2×level)",
  }[id],
]));
GEN["fx-patterns"] = () => FG.FX_PATTERNS.map((p) => `\`${p}\``).join(", ");
GEN["fx-shapes"] = () => FG.FX_SHAPES.map((p) => `\`${p}\``).join(", ");

GEN["mob-enchants"] = () => table(["Trait", "Tag on nameplate", "Effect"], Object.entries(B.MOB_ENCHANTS).map(([id, e]) => [`**${e.name}**`, TRAIT_TAG[id] ?? "", e.about]));
const TRAIT_TAG = { vampiric: "VAMP", thorned: "THRN", warded: "WARD", frenzied: "FRNZ", swift: "SWFT", brutal: "BRUT", regenerating: "REGN", evasive: "EVAS", armored: "ARMR", spellward: "SPWD", giant: "GIAN" };
GEN["enemy-kinds"] = () => {
  const label = { animal: "Animal", normal: "Normal foe", minion: "Minion (summons, bounty spirits)", boss: "Boss", witch: "Evil witch", bounty: "Bounty mark (tier 1)", hunter: "Hunter (Wanted 1)" };
  return table(["Kind", "Health (your hits)", "One hit (share of your max HP)", "Levels above you", "Hardcore health", "Hardcore hit", "Hardcore levels"], Object.keys(B.BASE).map((k) => {
    const s = B.enemyTargets({ kind: k, tier: k === "bounty" ? 1 : 0 });
    const h = B.enemyTargets({ kind: k, tier: k === "bounty" ? 1 : 0, hardcore: true });
    return [`**${label[k]}**`, num(s.hits, 1), pct(s.frac, 1), `+${s.levelOffset}`, num(h.hits, 1), pct(h.frac, 1), `+${h.levelOffset}`];
  }));
};
GEN["element-archetypes"] = () => table(["Element", "Health", "Damage", "Speed", "Crit", "Dodge", "Phys. resist", "Spell resist", "Likes traits", "Prefers"], C.TYPE_IDS.map((t) => {
  const a = B.TYPE_ARCHETYPE[t] ?? {};
  return [`**${typeName(t)}**`, `×${a.hp ?? 1}`, `×${a.dmg ?? 1}`, `×${a.speed ?? 1}`, pct(a.crit ?? 0.03), pct(a.dodge ?? 0), pct(a.physRes ?? 0), pct(a.spellRes ?? 0), (a.bias ?? []).map((id) => B.MOB_ENCHANTS[id].name).join(", ") || "—", (a.forms ?? ["any"]).join(", ")];
}));
GEN["monsters"] = () => {
  const biomes = (id) => Object.entries(C.BIOME_MONSTERS).filter(([, l]) => l.includes(id)).map(([b]) => W.BIOME_LABEL[b]).join(", ");
  return table(["Monster", "Element", "Found in", "Twist (on top of its element)", "Description"], C.MONSTERS.map((m) => {
    const s = B.SPECIES_ARCHETYPE[m.id] ?? {};
    const twist = [s.hp && `health ×${s.hp}`, s.dmg && `damage ×${s.dmg}`, s.speed && `speed ×${s.speed}`, s.dodge && `+${pct(s.dodge)} dodge`, s.crit && `+${pct(s.crit)} crit`, s.physRes && `+${pct(s.physRes)} phys. resist`, s.spellRes && `+${pct(s.spellRes)} spell resist`, s.bias?.length && `likes ${s.bias.map((id) => B.MOB_ENCHANTS[id].name).join(", ")}`].filter(Boolean).join("; ");
    return [`**${m.name}**`, typeName(m.type), biomes(m.id) || "Dungeons", twist || "—", m.about];
  }));
};
GEN["animals"] = () => table(["Animal", "Element", "Found in", "Behaviour", "Drops", "Description"], C.ANIMALS.map((a) => {
  const s = B.SPECIES_ARCHETYPE[a.id] ?? {};
  const where = Object.entries(C.ANIMAL_BIOME).filter(([, l]) => l.includes(a.id)).map(([b]) => W.BIOME_LABEL[b]).join(", ");
  const meat = a.id === "stag" || a.id === "boar" ? 2 : 1;
  const hide = a.id === "stag" ? 2 : 1;
  return [`**${a.name}**`, typeName(a.type), where, a.id === "wolf" || a.id === "boar" ? "Fights back" : "Flees", `${meat} meat, ${hide} leather`, `${a.about}${s.speed ? ` Speed ×${s.speed}.` : ""}`];
}));
GEN["biomes"] = () => table(["Region", "Monsters", "Animals", "Tavern"], W.BIOMES.map((b) => [
  `**${W.BIOME_LABEL[b]}**`, (C.BIOME_MONSTERS[b] ?? []).map((id) => C.MONSTER_BY_ID[id].name).join(", "), (C.ANIMAL_BIOME[b] ?? []).map((id) => C.ANIMAL_BY_ID[id].name).join(", ") || "—", W.TAVERNS.filter((t) => t.biome === b).map((t) => t.name).join(", ") || "—",
]));
GEN["world-bosses"] = () => table(["Boss", "Element", "Where", "Base level"], [
  ...C.POIS.filter((p) => p.kind === "boss").map((p) => [`**${p.name}**`, typeName(p.type), "Overworld (see the Map)", p.level]),
  ["**Bone King**", "Ghoul", "Tiny Crypt (last room)", 18],
  ["**Ash Regent**", "Fire", "Ash Kiln (last room)", 16],
]);
GEN["npcs"] = () => table(["NPC", "Role", "Offers", "Notes"], C.NPCS.map((n) => {
  const offers = C.npcOffers(n);
  const shop = n.shop ? { general: "General store", armor: "Armor peddler", fence: "Fence (gear)", alchemy: "Alchemy stall", cook: "Cook" }[n.shop] : "";
  const shrine = n.shrine ? `${typeName(n.shrine)} shrine keeper` : "";
  const quests = C.QUESTS.filter((q) => n.name.toLowerCase().includes(q.giver.toLowerCase())).map((q) => q.name);
  return [`**${n.name}**`, n.role, offers.join(", ") || "Talk", [shop, shrine, quests.length ? `Quests: ${quests.join(", ")}` : ""].filter(Boolean).join(" · ") || "—"];
}));
GEN["taverns"] = () => table(["Tavern", "Region"], W.TAVERNS.map((t) => [`**${t.name}**`, W.BIOME_LABEL[t.biome]]));

GEN["items"] = () => table(["Item", "Base price", "Use"], C.ITEMS.map((i) => [`**${i.name}**`, i.price ? `${i.price} kyo` : "—", `${i.about}${i.heal ? ` Heals ${i.heal} (or ${num(i.heal / 3, 1)}% of max HP, whichever is more) in TurboHunt.` : ""}${i.buff ? " 25-second buff." : ""}`]));
GEN["alchemy"] = () => table(["Brew", "Ingredients", "Makes", "Notes"], C.ALCHEMY_RECIPES.map((r) => [`**${r.name}**`, Object.entries(r.costs).map(([id, n]) => `${n}× ${itemName(id)}`).join(", "), `${r.n}× ${itemName(r.output)}`, r.about]));
GEN["camp-recipes"] = () => table(["Recipe", "Costs", "Makes"], SV.CAMP_RECIPE_LIST.map((r) => [`**${r.name}**`, Object.entries(r.costs).map(([id, n]) => `${n}× ${itemName(id)}`).join(", "), Object.entries(r.outputs).map(([id, n]) => `${n}× ${itemName(id)}`).join(", ")]));
GEN["food"] = () => table(["Food", "Hunger restored"], Object.entries(SV.FOOD).map(([id, n]) => [`**${itemName(id)}**`, n]).concat([["**Drinking Water**", "50 thirst"]]));
GEN["story-quests"] = () => table(["Chapter", "Quest", "Giver", "Goal", "Reward"], C.QUESTS.map((q) => [q.chapter, `**${q.name}**`, q.giver, q.about, [`${q.rewardKyo} kyo`, ...Object.entries(q.rewardItems ?? {}).filter(([id, n]) => n > 0 && C.ITEM_BY_ID[id]).map(([id, n]) => `${n}× ${itemName(id)}`)].join(", ")]));
GEN["contract-kinds"] = () => {
  const total = QB.KIND_WEIGHT.reduce((s, [, w]) => s + w, 0);
  const about = { kills: "Defeat any foes", kill_type: "Defeat foes of one element", kill_species: "Defeat one named monster", boss: "Defeat bosses (level 5+)", ore: "Mine ore", tree: "Fell trees", shroom: "Pick mushroom patches", fish: "Land fish", catch: "Have spirits stay with you", craft: "Craft at a campfire" };
  return table(["Contract", "Goal", "How common", "Base count", "Kyo per unit (level 1)"], QB.KIND_WEIGHT.map(([k, w]) => [`**${cap(k.replace("_", " "))}**`, about[k], pct(w / total), QB.BASE_NEED[k], QB.UNIT_KYO[k]]));
};
GEN["contract-tiers"] = () => {
  const total = QB.TIER_WEIGHT.reduce((s, [, w]) => s + w, 0);
  return table(["Tier", "How common", "Count multiplier", "Pay multiplier", "Adventuring XP"], QB.TIER_WEIGHT.map(([t, w]) => [`**${cap(t)}**`, pct(w / total), `×${QB.TIER_NEED[t]}`, `×${QB.TIER_PAY[t]}`, QB.TIER_XP[t]]));
};
GEN["bounty-tiers"] = () => table(["Tier", "Mark level", "Health (your hits)", "Hit (share of your HP)", "Spirits", "Traits", "Gear quality", "Kyo at level 50"], [1, 2, 3, 5, 8, 10, 15, 20, 30].map((t) => {
  const s = B.enemyTargets({ kind: "bounty", tier: t });
  const q = t >= 15 ? "Legendary" : t >= 10 ? "Epic / Legendary (50%)" : t >= 5 ? "Epic (15% Legendary)" : t >= 2 ? "Rare (45% Epic)" : "Rare (20% Epic)";
  return [t, `you + ${3 + t}`, num(s.hits, 1), pct(s.frac, 1), Math.min(4, 2 + Math.floor(t / 6)), Math.min(7, 3 + Math.floor(t / 3)), q, B.bountyKyo(50, t).toLocaleString("en-US")];
}));
GEN["bounty-stars"] = () => table(["Kill", "TurboHunt", "Hardcore"], [["Normal foe", "normal"], ["Rare foe (rarity 3)", "normal", 3], ["Boss", "boss"], ["Evil witch", "witch"], ["Animal", "animal"], ["Bounty or hunter", "bounty"]].map(([label, kind, r = 0]) => [label, pct(B.bountyStarChance(kind, r, false), 1), pct(B.bountyStarChance(kind, r, true), 1)]));
GEN["clear-name"] = () => table(["Your level", "Wanted 1", "Wanted 2", "Wanted 3"], [10, 30, 60, 100, 200].map((l) => [l, ...[1, 2, 3].map((w) => `${B.clearNameCost(l, w).toLocaleString("en-US")} kyo`)]));
GEN["status-table"] = () => {
  const rows = [
    ["Burn", "You: 15 s, and a new flame never restarts one already burning. Foes: the verse's duration (about 3–4 s)", "You lose 5% of max health every second (shields soak it). Foes lose max(6, 1% of max health) per second.", "Cleanse; Survivor trait"],
    ["Soak", `refreshes, up to ${SR.SOFT_CAP.soak} s`, "You move at 62% speed; foes move at 70%.", "Blink; Cleanse; Survivor trait"],
    ["Root", `at most ${SR.HARD_CC.root.cap} s · ${SR.HARD_CC.root.immune} s immunity after`, "Can't move or Dash (you can still cast).", "Blink breaks it; mash keys; Cleanse"],
    ["Sleep", `at most ${SR.HARD_CC.sleep.cap} s · ${SR.HARD_CC.sleep.immune} s immunity after`, "Can't move or cast. Sleeping foes do nothing.", "Any hit wakes; mash keys; Cleanse; Unshakable trait"],
    ["Silence", `at most ${SR.HARD_CC.silence.cap} s · ${SR.HARD_CC.silence.immune} s immunity after`, "You can only cast priority-2 verses and mends. Silenced foes can't cast spells.", "Priority-2 verses still work; Cleanse"],
    ["Gloom", `refreshes, up to ${SR.SOFT_CAP.gloom} s`, "On you: your damage ×0.8. On foes: no effect yet.", "Cleanse; Unshakable trait"],
    ["Expose", `refreshes, up to ${SR.SOFT_CAP.expose} s`, "On foes: they take 25% more damage from you. On you: no effect yet.", "Cleanse"],
    ["Spark", `refreshes, up to ${SR.SOFT_CAP.spark} s`, "A lightning mark (crackling arcs). No extra effect yet.", "Cleanse"],
    ["Leech / Drain", `refreshes, up to ${SR.SOFT_CAP.leech} s`, "A drain mark. The healing comes from the Leech verse itself (35% of its damage), not the mark.", "Cleanse"],
    ["Swift (good)", `up to ${SR.SOFT_CAP.swift} s`, "+45% movement speed. Surge verses give 4 s of it.", "—"],
  ];
  return table(["Status", "Duration", "Effect", "Counters"], rows.map((r) => [`**${r[0]}**`, r[1], r[2], r[3]]));
};
GEN["hardcore-vs-hunt"] = () => {
  const n = B.enemyTargets({ kind: "normal" });
  const h = B.enemyTargets({ kind: "normal", hardcore: true });
  return table(["Rule", "TurboHunt", "Hardcore"], [
    ["Lives", "Death in the overworld starts a new witch; dungeons and shrines only knock you out", "One life. Every death starts a new witch"],
    ["Healing", "Out-of-combat regeneration, potions, level-ups heal you", "Healing verses, potions (¾ strength) and meals heal. No regeneration, level-ups don't heal"],
    ["Attacking", "Your witch attacks automatically", "You cast verses yourself (or turn on Autogrind)"],
    ["Foe health (normal foe)", `${num(n.hits, 1)} of your hits`, `${num(h.hits, 1)} of your hits, ×${DN.NIGHT.strength} at night`],
    ["Foe hit (normal foe)", pct(n.frac, 1), `${pct(h.frac, 1)}, ×${DN.NIGHT.strength} at night`],
    ["Foe level", `your level +${n.levelOffset}`, `your level +${h.levelOffset}, plus growth`],
    ["Foe traits", "rarity-based", "+1 trait on everything but animals"],
    ["Foe attack speed", "normal", "15% faster, shorter wind-ups at high level"],
    ["Foes catch up to new gear", `about ${B.ADAPT.upStandard / 60} minutes`, `about ${B.ADAPT.upHardcore / 60} minutes`],
    ["Difficulty growth", "up to ×1.45 (level, bounty tier)", "up to ×2.5 (level, nights survived, bounty tier)"],
    ["Experience", "100%", "72%, ×3 at night"],
    ["Skill experience", "100%", "240%"],
    ["Day and night", "none", `${DN.DAY_SECONDS / 60} min day, ${DN.NIGHT_SECONDS / 60} min night`],
    ["Survival", "none", "Hunger, thirst, rest, campfires, building"],
    ["Hunter waves", `every ${B.HUNTER_WAVE_GAP.standard}s`, `every ${B.HUNTER_WAVE_GAP.hardcore}s`],
    ["Evil witches every 20 levels", "yes", "no"],
    ["Green Cave", "no", "yes, level 30+"],
  ]);
};
GEN["patch-notes"] = () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const sections = readme.split(/\n(?=## )/).filter((s) => s.startsWith("## "));
  const start = sections.findIndex((s) => /Balance patch/i.test(s));
  const notes = (start >= 0 ? sections.slice(start) : sections).reverse();
  return notes.map((s) => s.replace(/^## /, "## ").trim()).join("\n\n");
};
GEN["growth"] = () => table(["", "TurboHunt", "Hardcore"], [
  ["Formula", "1 + 0.1% × level + 0.8% × bounty tier (max ×1.45)", "1 + 0.25% × level + 4% × nights survived + 2% × bounty tier (max ×2.5)"],
  ["Level 50, tier 5", `×${num(B.standardGrowth(50, 5))}`, `×${num(B.hardcoreGrowth(50, 5, 5))} (5 nights)`],
  ["Level 200, tier 15", `×${num(B.standardGrowth(200, 15))}`, `×${num(B.hardcoreGrowth(200, 20, 15))} (20 nights)`],
]);

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const pageFiles = readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".md")).sort();
const pages = new Map(); // name -> markdown
const problems = [];
for (const f of pageFiles) {
  const name = basename(f, ".md");
  let md = readFileSync(join(SRC, "pages", f), "utf8");
  md = md.replace(/<!-- gen:([a-z0-9-]+) -->/g, (_, key) => {
    if (!GEN[key]) {
      problems.push(`${name}: unknown generator "${key}"`);
      return "";
    }
    return GEN[key]();
  });
  pages.set(name, md.trim() + "\n");
}

// ---------------------------------------------------------------------------
// Glossary: hand-written terms plus every named thing in the game
// ---------------------------------------------------------------------------

const terms = new Map(); // key (lower) -> { term, defs: [{text, page, anchor}], aliases:Set, category }
function addTerm(term, def, page, anchor, aliases = [], category = "Mechanic") {
  const key = term.toLowerCase();
  const t = terms.get(key) ?? { term, defs: [], aliases: new Set(), categories: new Set() };
  if (!t.defs.some((d) => d.text === def)) t.defs.push({ text: def, page, anchor });
  for (const a of aliases) if (a && a.toLowerCase() !== key) t.aliases.add(a);
  t.categories.add(category);
  terms.set(key, t);
}
const handTerms = JSON.parse(readFileSync(join(SRC, "terms.json"), "utf8"));
for (const t of handTerms) addTerm(t.term, t.def, t.page, t.anchor, t.aliases ?? [], t.category ?? "Mechanic");
for (const m of C.MOVES) addTerm(m.name, `${typeName(m.type)} verse (${C.moveTactic(m)}, ${C.attackForm(m)}). Power ${m.power}, ${m.accuracy}% accuracy${m.effect !== "none" ? `, ${EFFECT_LABEL[m.effect] ?? m.effect}` : ""}. ${m.about}`, "Verses", "All verses", [], "Verse");
for (const c of CL.CLASSES) addTerm(c.name, `${typeName(c.type)} ${c.role} class. ${c.blurb}`, "Classes", c.name, [], "Class");
for (const t of CL.TRAITS) addTerm(t.name, `Character trait. ${t.about}`, "Races-and-Traits", "Traits", [], "Trait");
for (const r of C.RACES) addTerm(r.name, `${typeName(r.type)} race. ${r.blurb}`, "Races-and-Traits", "Races", [], "Race");
for (const t of C.TYPE_IDS) addTerm(typeName(t), `Element. Strong against ${C.TYPES[t].strong.map(typeName).join(", ") || "nothing"}; weak against ${C.TYPES[t].weak.map(typeName).join(", ") || "nothing"}.`, "Elements", "Element list", [], "Element");
for (const e of C.ENCHANTS) addTerm(e.name, `Gear enchantment. ${e.gear(e.max)}`, "Enchantments", "All enchantments", [], "Enchantment");
for (const [id, e] of Object.entries(B.MOB_ENCHANTS)) addTerm(e.name, `Enemy trait (${TRAIT_TAG[id]}). ${e.about}`, "Enemies", "Enemy traits", [TRAIT_TAG[id]], "Enemy trait");
for (const i of C.ITEMS) addTerm(i.name, `Item. ${i.about}`, "Items", "All items", [], "Item");
for (const m of C.MONSTERS) addTerm(m.name, `${typeName(m.type)} monster. ${m.about}`, "Enemies", "Monsters", [], "Monster");
for (const a of C.ANIMALS) addTerm(a.name, `${typeName(a.type)} animal. ${a.about}`, "Enemies", "Animals", [], "Animal");
for (const n of C.NPCS) addTerm(n.name, `NPC: ${n.role}.`, "World-and-Regions", "NPCs", [n.name.split(" ").slice(-1)[0]], "NPC");
for (const s of C.SKILLS) addTerm(s.name, `Account skill. ${C.skillLine(s.id, 2).split(". ").slice(-2).join(". ")}`, "Leveling-and-Skills", "Skills", [], "Skill");
for (const b of W.BIOMES) addTerm(W.BIOME_LABEL[b], "Overworld region.", "World-and-Regions", "Regions", [], "Place");
for (const t of W.TAVERNS) addTerm(t.name, `Tavern with a bounty board in ${W.BIOME_LABEL[t.biome]}.`, "World-and-Regions", "Taverns", [], "Place");
for (const s of C.SETS) addTerm(s.name, `${C.RACES.find((r) => r.id === s.race)?.name} armor set (${FX_NAME[s.fx]} aura). ${s.bonus}`, "Sets", `${C.RACES.find((r) => r.id === s.race)?.name} sets`, [], "Set");
for (const q of C.QUESTS) addTerm(q.name, `Story quest from ${q.giver}. ${q.about}`, "Quests", "Story quests", [], "Quest");
for (const p of C.POIS.filter((p) => p.kind === "boss")) addTerm(p.name, `${typeName(p.type)} world boss.`, "Bosses-and-Dungeons", "World bosses", [], "Boss");
for (const q of C.QUALITIES) addTerm(q.name, `Gear quality (×${q.mult} value).`, "Gear", "Quality", [], "Quality");

// Section index: page -> [{heading, anchor, text}]
const sectionsOf = (md) => {
  const out = [];
  let cur = { heading: null, text: "" };
  for (const line of md.split("\n")) {
    const h = /^(#{2,4}) (.+)$/.exec(line);
    if (h) {
      out.push(cur);
      cur = { heading: h[2].replace(/[*_`]/g, "").trim(), text: "" };
    } else cur.text += line + "\n";
  }
  out.push(cur);
  return out.filter((s) => s.text.trim() || s.heading);
};
const refs = new Map();
const reCache = new Map();
const wordRe = (w) => {
  if (!reCache.has(w)) reCache.set(w, new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu"));
  return reCache.get(w);
};
for (const [name, md] of pages) {
  for (const sec of sectionsOf(md)) {
    const hay = `${sec.heading ?? ""}\n${sec.text}`;
    for (const [key, t] of terms) {
      const words = [t.term, ...t.aliases];
      if (!words.some((w) => w.length >= 3 && wordRe(w).test(hay))) continue;
      const list = refs.get(key) ?? [];
      const anchor = sec.heading ? slug(sec.heading) : "";
      if (!list.some((r) => r.page === name && r.anchor === anchor)) list.push({ page: name, heading: sec.heading, anchor });
      refs.set(key, list);
    }
  }
}

const pretty = (p) => p.replace(/-/g, " ");
const glossary = [];
glossary.push("# Glossary\n");
glossary.push("Every term in TURBZ, what it means, and **every place in this wiki that mentions it**. Press **Ctrl+F** (Cmd+F on Mac) and type any word, or jump by letter. Each term also has a *search everywhere* link that runs GitHub's full-text wiki search.\n");
const sorted = [...terms.values()].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
const letters = [...new Set(sorted.map((t) => t.term[0].toUpperCase().replace(/[^A-Z]/, "#")))];
glossary.push(letters.map((l) => `[${l}](#${l === "#" ? "other" : l.toLowerCase()})`).join(" · ") + "\n");
glossary.push(`*${sorted.length} terms.*\n`);
let letter = "";
for (const t of sorted) {
  const L = t.term[0].toUpperCase().replace(/[^A-Z]/, "#");
  if (L !== letter) {
    letter = L;
    glossary.push(`## ${L === "#" ? "Other" : L}\n`);
  }
  glossary.push(`### ${t.term}\n`);
  const cats = [...t.categories].join(", ");
  for (const d of t.defs) glossary.push(`- ${d.text} — ${link(pretty(d.page) + (d.anchor ? ` › ${d.anchor}` : ""), d.page, d.anchor)}`);
  if (t.aliases.size) glossary.push(`- *Also written:* ${[...t.aliases].join(", ")}`);
  const r = (refs.get(t.term.toLowerCase()) ?? []).filter((x) => x.page !== "Glossary");
  if (r.length) {
    const byPage = new Map();
    for (const x of r) byPage.set(x.page, [...(byPage.get(x.page) ?? []), x]);
    const items = [...byPage].map(([p, xs]) => `${link(pretty(p), p)} (${xs.filter((x) => x.heading).map((x) => `[${x.heading}](${p}#${x.anchor})`).join(", ") || "top"})`);
    glossary.push(`- *Mentioned in:* ${items.join(" · ")}`);
  }
  glossary.push(`- *${cats}* · [search everywhere](https://github.com/${REPO}/search?q=${encodeURIComponent(`"${t.term}"`)}&type=wikis)\n`);
}
pages.set("Glossary", glossary.join("\n"));

// ---------------------------------------------------------------------------
// Sidebar, footer, index, link check
// ---------------------------------------------------------------------------

const sidebar = readFileSync(join(SRC, "sidebar.md"), "utf8");
let commit = "local";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {}
const stamp = new Date().toISOString().slice(0, 10);
const footer = `*Built from the game's own data on ${stamp} (commit \`${commit}\`). Tables update automatically every time the game changes. Looking for a word? Use the [Glossary](Glossary) or [search the wiki](https://github.com/${REPO}/search?type=wikis&q=).*\n`;

// Link check: every [x](Page#anchor) must exist.
const anchorsOf = new Map([...pages].map(([n, md]) => [n, new Set(sectionsOf(md).filter((s) => s.heading).map((s) => slug(s.heading)))]));
for (const [n, md] of [...pages, ["_Sidebar", sidebar]]) {
  for (const m of md.matchAll(/\]\(([A-Za-z0-9-]+)(?:#([^)\s]+))?\)/g)) {
    const [, page, anchor] = m;
    if (!pages.has(page)) problems.push(`${n}: link to missing page "${page}"`);
    else if (anchor && !anchorsOf.get(page).has(anchor)) problems.push(`${n}: link to missing section "${page}#${anchor}"`);
  }
}
for (const t of handTerms) if (!pages.has(t.page)) problems.push(`terms.json: "${t.term}" points at missing page "${t.page}"`);

// Machine-readable index for the in-game wiki: pages, sections and terms with their references.
const index = {
  version: 1,
  built: stamp,
  commit,
  rawBase: `https://raw.githubusercontent.com/wiki/${REPO}/`,
  pages: [...pages.keys()].map((p) => ({ page: p, title: pretty(p), sections: sectionsOf(pages.get(p)).filter((s) => s.heading).map((s) => ({ heading: s.heading, anchor: slug(s.heading) })) })),
  terms: sorted.map((t) => ({ term: t.term, aliases: [...t.aliases], categories: [...t.categories], defs: t.defs.map((d) => ({ text: d.text, page: d.page, anchor: d.anchor ? slug(d.anchor) : "" })), refs: (refs.get(t.term.toLowerCase()) ?? []).map((r) => ({ page: r.page, anchor: r.anchor })) })),
};

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [n, md] of pages) writeFileSync(join(OUT, `${n}.md`), md);
writeFileSync(join(OUT, "_Sidebar.md"), sidebar);
writeFileSync(join(OUT, "_Footer.md"), footer);
writeFileSync(join(OUT, "wiki-index.json"), JSON.stringify(index));

console.log(`Wiki: ${pages.size} pages, ${sorted.length} glossary terms → ${OUT}`);
if (problems.length) {
  console.error(problems.map((p) => `  ✗ ${p}`).join("\n"));
  if (CHECK) process.exit(1);
}
if (CHECK) rmSync(OUT, { recursive: true, force: true });
