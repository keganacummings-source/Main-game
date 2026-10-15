import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Same loader as the other suites: transpile the real TypeScript and wire relative imports.
function moduleUrl(path, imports = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports)) {
    source = source.replaceAll(`from "${specifier}"`, `from "${url}"`);
  }
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const classesUrl = moduleUrl("../src/game/classes.ts");
const contentUrl = moduleUrl("../src/game/content.ts", { "./classes": classesUrl });
const content = await import(contentUrl);
const bal = await import(moduleUrl("../src/game/balance.ts", { "./content": contentUrl }));
const dn = await import(moduleUrl("../src/game/daynight.ts"));

test("gear drops start at the hunter's level and never compound", () => {
  for (const level of [1, 30, 120, 400]) {
    assert.equal(content.dropGearLevel(level, "common", 0, 0), level);
    const legend = content.dropGearLevel(level, "legendary", 0, 9999);
    assert.ok(legend >= level && legend <= Math.round(level * 1.25) + 3, `legendary at ${level} gave ${legend}`);
  }
  // A level-30 hunter cannot be handed level-1000 gear by a low-tier bounty.
  assert.ok(content.dropGearLevel(30, "legendary", bal.SOURCE_BONUS.bounty(3), 200) < 50);
  // The bounty ladder is the long road to max gear: very high tiers at max level can reach the cap.
  assert.equal(content.dropGearLevel(400, "legendary", bal.SOURCE_BONUS.bounty(80), 200), content.MAX_GEAR_LEVEL);
  // rollGear uses the same rule.
  for (let i = 0; i < 200; i++) {
    const g = content.rollGear(content.mulberry32(i + 1), { level: 75, luck: 40 });
    assert.ok(g.level >= 70 && g.level <= 100, `rolled ${g.level}`);
  }
});

test("hardcore foes are bigger, hit harder, sit higher and keep growing", () => {
  for (const kind of ["normal", "boss", "bounty", "hunter", "witch", "minion"]) {
    const std = bal.enemyTargets({ kind });
    const hc = bal.enemyTargets({ kind, hardcore: true });
    assert.ok(hc.hits > std.hits && hc.frac > std.frac && hc.levelOffset > std.levelOffset, kind);
  }
  assert.ok(bal.hardcoreGrowth(200, 10, 5) > bal.hardcoreGrowth(10, 0, 0));
  assert.ok(bal.hardcoreGrowth(400, 100, 100) <= 2.5);
  const late = bal.enemyTargets({ kind: "normal", hardcore: true, growth: bal.hardcoreGrowth(200, 8) });
  assert.ok(late.hits > bal.enemyTargets({ kind: "normal", hardcore: true }).hits);
});

test("foes are never below the hunter and each new bounty tier is stronger", () => {
  for (const kind of ["animal", "normal", "minion", "boss", "witch", "bounty", "hunter"]) assert.ok(bal.enemyTargets({ kind }).levelOffset >= 0, kind);
  let prev = bal.enemyTargets({ kind: "bounty", tier: 1 });
  for (let tier = 2; tier <= 20; tier++) {
    const next = bal.enemyTargets({ kind: "bounty", tier });
    assert.ok(next.hits >= prev.hits && next.frac >= prev.frac && next.levelOffset > prev.levelOffset, `tier ${tier}`);
    prev = next;
  }
});

test("enemy power reference rises fast and falls slow", () => {
  const up = bal.adaptToward(100, 200, 60, false);
  const down = bal.adaptToward(200, 100, 60, false);
  assert.ok(up > 130 && up < 200);
  assert.ok(down > 190);
  assert.ok(bal.adaptToward(100, 200, 60, true) > up, "hardcore adapts faster");
  assert.equal(bal.adaptToward(0, 50, 1, false), 50);
});

test("every foe rolls its own kit with sane caps", () => {
  const kits = new Set();
  for (let i = 0; i < 120; i++) {
    const m = content.MONSTERS[i % content.MONSTERS.length];
    const kit = bal.rollEnemyKit(content.mulberry32(i + 3), { species: m.id, type: m.type, kind: i % 7 === 0 ? "boss" : "normal", rarity: i % 4, playerLevel: 50, hardcore: i % 2 === 0 });
    assert.ok(kit.moves.length >= 1 && kit.moves.every((id) => content.MOVE_BY_ID[id]), m.id);
    assert.ok(kit.stats.dodge <= 0.35 && kit.stats.crit <= 0.45 && kit.stats.physRes <= 0.55 && kit.stats.spellRes <= 0.55);
    assert.ok(kit.enchants.every((id) => bal.MOB_ENCHANTS[id]) && new Set(kit.enchants).size === kit.enchants.length);
    kits.add(kit.moves.join("|") + kit.enchants.join("|"));
  }
  assert.ok(kits.size > 60, `only ${kits.size} distinct kits`);
  const wolf = bal.rollEnemyKit(content.mulberry32(9), { species: "wolf", type: "ghoul", kind: "animal" });
  assert.ok(wolf.moves.every((id) => content.attackForm(content.MOVE_BY_ID[id]) === "melee"));
});

test("one clean hit is a share of the hunter's health; armor helps within limits", () => {
  const base = { maxHpRef: 1000, frac: 0.05, dmgMult: 1, movePower: 60, form: "ranged", typeMult: 1, armor: 100, armorRef: 100, night: 1, enraged: false, frenzied: false };
  const hit = bal.enemyHitDamage(base);
  assert.ok(hit > 40 && hit < 60, `hit ${hit}`);
  assert.ok(bal.enemyHitDamage({ ...base, armor: 99999 }) >= hit * 0.65 - 0.01, "armor cannot erase damage");
  assert.ok(bal.enemyHitDamage({ ...base, night: 2 }) > hit * 1.9);
  assert.equal(bal.enemyHitDamage({ ...base, form: "spell", armor: 99999 }), bal.enemyHitDamage({ ...base, form: "spell" }), "spells ignore armor");
});

test("bounty stars only come from ordinary kills; bounties carry full bags", () => {
  assert.equal(bal.bountyStarChance("bounty", 3, false), 0);
  assert.equal(bal.bountyStarChance("hunter", 3, true), 0);
  assert.ok(bal.bountyStarChance("normal", 0, true) > bal.bountyStarChance("normal", 0, false));
  const bag = bal.bountyInventory(content.mulberry32(4), 5, true);
  assert.ok(Object.keys(bag).length >= 8 && bag.potion > 0 && bag.trail_ration > 0);
  for (const id of Object.keys(bag)) assert.ok(content.ITEM_BY_ID[id], id);
  assert.equal(bal.BOUNTY_BOARD_SIZE >= 2, true);
  assert.equal(bal.HUNTER_SQUAD, 5);
  assert.equal(bal.BOUNTY_STARS_NEEDED, 10);
});

test("sale prices are shared and always positive", () => {
  assert.equal(bal.gearSellValue(1000, 1), 450);
  assert.ok(bal.gearSellValue(1000, 1.2) > bal.gearSellValue(1000, 1));
  assert.ok(bal.itemSellValue(0, 1) >= 1);
});

test("hardcore day is 10 minutes and night is 15", () => {
  assert.equal(dn.DAY_SECONDS, 600);
  assert.equal(dn.NIGHT_SECONDS, 900);
});

test("an Enemy Designer kit uses the design's stats, enchantments and moves", () => {
  const design = { stats: { hp: 2, dmg: 1.5, speed: 1, crit: 0.1, dodge: 0.2, physRes: 0.3, spellRes: 0 }, enchants: ["thorned"], extraEnchants: 2, moves: ["thorn", "bogus"] };
  const kit = bal.rollEnemyKit(content.mulberry32(5), { species: "x", type: "earth", kind: "normal", design });
  assert.deepEqual(kit.moves, ["thorn"]);
  assert.ok(kit.enchants.includes("thorned") && kit.enchants.length === 3);
  assert.ok(kit.stats.hp >= 1.9 && kit.stats.dodge >= 0.2 && kit.stats.physRes >= 0.3);
  assert.ok(kit.stats.dodge <= 0.35 && kit.stats.physRes <= 0.55);
});
