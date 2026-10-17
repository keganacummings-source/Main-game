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
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const classesUrl = moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl });
const overmaxUrl = moduleUrl("../src/game/overmax.ts");
const contentUrl = moduleUrl("../src/game/content.ts", { "./classes": classesUrl, "./overmax": overmaxUrl, "./class-kits": kitsUrl });
const content = await import(contentUrl);
const bal = await import(moduleUrl("../src/game/balance.ts", { "./content": contentUrl, "./overmax": overmaxUrl }));
const respawn = await import(moduleUrl("../src/game/respawn.ts"));
const overmax = await import(overmaxUrl);
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

test("levels pull ahead of the road, and bosses stay a real bite", () => {
  assert.equal(bal.openWorldLevelEdge(1), 0);
  assert.ok(bal.openWorldLevelEdge(40) > bal.openWorldLevelEdge(10));
  assert.ok(bal.openWorldLevelEdge(500) <= 0.34);
  const early = bal.expectedHunterPower(10);
  const late = bal.expectedHunterPower(80);
  assert.ok(late.hit > early.hit * 2 && late.maxHp > early.maxHp * 2 && late.armor > early.armor);
  assert.ok(bal.standardGrowth(500, 0) <= 2);
  assert.ok(bal.standardGrowth(100, 0) > bal.standardGrowth(1, 0));
  const n = bal.enemyTargets({ kind: "normal" });
  const b = bal.enemyTargets({ kind: "boss" });
  const w = bal.enemyTargets({ kind: "witch" });
  assert.ok(b.frac > n.frac && w.frac > n.frac && b.hits >= 10 && w.hits >= 9);
  const lateN = bal.enemyTargets({ kind: "normal", growth: bal.standardGrowth(200, 0) });
  const lateB = bal.enemyTargets({ kind: "boss", growth: bal.standardGrowth(200, 0) });
  assert.ok(lateN.frac < 0.2, `late trash bite ${lateN.frac}`);
  assert.ok(lateB.frac > 0.14 && lateB.frac < 0.4, `late boss bite ${lateB.frac}`);
});

test("xp rushes early, weighs late, and dangerous kills pay more", () => {
  const kills = (lv) => Math.ceil(content.xpNeed(lv) / bal.killXpAmount(lv, {}));
  assert.ok(kills(1) <= 3, `level 1 took ${kills(1)} kills`);
  assert.ok(kills(10) < kills(30));
  assert.ok(kills(30) < kills(100));
  assert.ok(kills(100) >= 16 && kills(100) <= 22, `level 100 took ${kills(100)} kills`);
  assert.ok(bal.killXpAmount(20, { boss: true }) >= bal.killXpAmount(20, {}) * 4);
  assert.ok(bal.killXpAmount(20, { dungeon: true, boss: true }) > bal.killXpAmount(20, { boss: true }));
  assert.ok(bal.killXpAmount(20, { witch: true }) > bal.killXpAmount(20, {}) * 3);
  assert.ok(bal.killXpAmount(20, { shrine: true }) > bal.killXpAmount(20, { dungeon: true }));
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

test("enemy power reference catches up over minutes and falls slower", () => {
  const up = bal.adaptToward(100, 200, 60, false);
  const down = bal.adaptToward(200, 100, 60, false);
  assert.ok(up > 110 && up < 200);
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
    assert.ok(Number.isFinite(kit.stats.dodge) && kit.stats.dodge >= 0 && kit.stats.crit >= 0);
    assert.ok(overmax.bend(kit.stats.dodge, 0.35, 0.8) < 0.8, "dodge bends under 80%");
    assert.ok(overmax.bend(kit.stats.physRes, 0.55, 0.88) < 0.88 && overmax.bend(kit.stats.spellRes, 0.55, 0.88) < 0.88);
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
  assert.ok(overmax.bend(kit.stats.dodge, 0.35, 0.8) < 0.8 && overmax.bend(kit.stats.physRes, 0.55, 0.88) < 0.88);
});

test("overmax bends past the old knee and never reaches the ceiling", () => {
  assert.equal(overmax.bend(0.2, 0.35, 0.8), 0.2);
  assert.equal(overmax.bend(0.35, 0.35, 0.8), 0.35);
  const over = overmax.bend(2, 0.35, 0.8);
  assert.ok(over > 0.35 && over < 0.8);
  assert.ok(overmax.bend(1e9, 0.35, 0.8) < 0.8);
  assert.ok(overmax.bendDown(-5, 0.2, 0.05) > 0.05 && overmax.bendDown(-5, 0.2, 0.05) < 0.2);
  assert.equal(overmax.bendDown(3, 0.2, 0.05), 3);
  assert.equal(overmax.bendChance(4), 1);
  assert.equal(overmax.bend(NaN, 0.35, 0.8), 0);
});

test("hardcore overworld foes return in two minutes; specials do not", () => {
  assert.equal(respawn.HC_OVERWORLD_RESPAWN, 120);
  assert.equal(respawn.respawnSeconds({ hardcore: true, map: "world", zoneRespawn: 45, boss: true }), 120);
  assert.equal(respawn.respawnSeconds({ hardcore: true, map: "world", boss: false }), 120);
  assert.equal(respawn.respawnSeconds({ hardcore: true, map: "rift-1", boss: false }), null);
  assert.equal(respawn.respawnSeconds({ hardcore: true, map: "world", special: true }), null);
  assert.equal(respawn.respawnSeconds({ hardcore: false, map: "world", zoneRespawn: 45, boss: false }), 45);
  assert.equal(respawn.respawnSeconds({ hardcore: false, map: "world", boss: true }), 70);
  assert.equal(respawn.respawnSeconds({ hardcore: false, map: "crypt", boss: false }), null);
  assert.equal(respawn.respawnSeconds({ hardcore: true, map: "kiln", boss: true }), null);
  assert.equal(respawn.respawnSeconds({ hardcore: false, map: "world", boss: false }), 22);
});

test("gear FX genes give pieces of one element many distinct looks", async () => {
  const fx = await import(moduleUrl("../src/game/fx-gene.ts"));
  const looks = new Set();
  const patterns = new Set();
  for (let i = 0; i < 400; i++) {
    const g = content.rollGear(content.mulberry32(i + 1), { level: 50, slot: "chest", floor: "rare" });
    assert.ok(g.fxGene > 0, "every roll stores a gene");
    const gene = fx.fxGene(fx.geneSeedOf(g), "fire", 4);
    patterns.add(gene.pattern);
    looks.add(`${gene.pattern}|${gene.shape}|${gene.accent}|${gene.dir}`);
  }
  assert.equal(patterns.size, fx.FX_PATTERNS.length);
  assert.ok(looks.size > 250, `only ${looks.size} looks`);
  // Old gear without a gene still gets a stable one from its uid.
  assert.equal(fx.geneSeedOf({ uid: "gabc1" }), fx.geneSeedOf({ uid: "gabc1" }));
  assert.notEqual(fx.geneSeedOf({ uid: "gabc1" }), fx.geneSeedOf({ uid: "gabc2" }));
});

test("control effects never stack, stay short and leave immunity behind", async () => {
  const st = await import(moduleUrl("../src/game/status-rules.ts"));
  const list = [];
  assert.equal(st.applyStatus(list, "sleep", 9), "applied");
  assert.equal(st.applyStatus(list, "sleep", 9), "ignored");
  assert.equal(list.filter((s) => s.id === "sleep").length, 1);
  assert.ok(list[0].t <= st.HARD_CC.sleep.cap);
  let next = st.tickStatuses(list, 3);
  assert.ok(!st.hasStatus(next, "sleep") && st.isImmune(next, "sleep"));
  assert.equal(st.applyStatus(next, "sleep", 2), "resisted");
  next = st.tickStatuses(next, st.HARD_CC.sleep.immune + 0.1);
  assert.equal(st.applyStatus(next, "sleep", 2), "applied");
  // Soft effects refresh instead of stacking.
  const soft = [];
  st.applyStatus(soft, "soak", 2);
  st.applyStatus(soft, "soak", 3);
  assert.equal(soft.length, 1);
  assert.equal(soft[0].t, 3);
  // Breaking an effect early (blink, wake, cleanse) also grants immunity.
  const root = [];
  st.applyStatus(root, "root", 2);
  st.endStatus(root, "root");
  assert.equal(st.applyStatus(root, "root", 2), "resisted");
  // Tough foes get half the duration.
  const boss = [];
  st.applyStatus(boss, "root", 2, { tough: true });
  assert.equal(boss[0].t, 1);
});

test("Hardcore chests that drop close together merge into one pile and show what is inside", async () => {
  const cl = await import(moduleUrl("../src/game/chest-loot.ts"));
  const mk = (id, x, y, extra = {}) => ({ id, map: "world", x, y, t: 200, max: 300, gear: [], items: {}, title: id, drops: 1, ...extra });
  const a = mk("a", 100, 100, { items: { potion: 1 } });
  const b = mk("b", 140, 120, { gear: [{ uid: "g1", quality: "rare" }], t: 290 });
  const far = mk("c", 600, 600, { items: { ore: 2 } });
  const other = mk("d", 110, 100, { map: "crypt", items: { ore: 1 } });
  const { list, folded } = cl.mergeNearbyChests([a, b, far, other]);
  assert.equal(list.length, 3);
  assert.equal(folded.b, "a");
  assert.equal(a.drops, 2);
  assert.equal(a.t, 290);
  assert.equal(a.gear.length, 1);
  assert.equal(a.items.potion, 1);
  assert.equal(cl.chestToJoin(list, "world", 120, 110)?.id, "a");
  assert.equal(cl.chestToJoin(list, "world", 400, 400), null);
  // The look: supplies, gear coloured by the best piece, boss loot.
  assert.equal(cl.chestLook(far).kind, "supplies");
  assert.equal(cl.chestLook(far).best, null);
  const look = cl.chestLook(a);
  assert.equal(look.kind, "gear");
  assert.equal(look.best, "rare");
  assert.equal(look.color, cl.QUALITY_COLOR.rare);
  a.gear.push({ uid: "g2", quality: "legendary" }, { uid: "g3", quality: "worn" });
  assert.equal(cl.chestLook(a).best, "legendary");
  assert.match(cl.chestLook(a).label, /LEGENDARY GEAR ×3/);
  const boss = mk("e", 900, 900, { boss: true, title: "Saint · world boss" });
  assert.equal(cl.chestLook(boss).kind, "boss");
  const pile = mk("f", 905, 905);
  cl.mergeChestInto(pile, boss);
  assert.equal(pile.boss, true);
  assert.equal(pile.title, "Saint · world boss");
});

test("dungeon instances keep their dead dead until you walk into a new one", async () => {
  for (const map of ["crypt", "kiln", "rift-3"]) {
    assert.equal(respawn.isInstanceMap(map), true);
    assert.equal(respawn.respawnSeconds({ hardcore: false, map, boss: false }), null);
    assert.equal(respawn.respawnSeconds({ hardcore: true, map, boss: true }), null);
  }
  assert.equal(respawn.isInstanceMap("world"), false);
});

test("melee works within 2 tiles, ranged and spells stay beyond it, and melee ignores every defense", async () => {
  for (const m of content.MOVES) {
    const tac = content.moveTactic(m);
    if (tac === "aura") continue;
    const r = content.attackRange(m);
    if (content.attackForm(m) === "melee") {
      const travel = content.movementReach(m);
      if (travel) assert.equal(r, travel, `${m.id} starts from its written travel range`);
      else assert.ok(r >= 32 && r <= 64, `${m.id} melee reach ${r} must be 1-2 tiles`);
    } else if (!["heal", "ward", "roll", "dash", "surge"].includes(tac)) {
      assert.ok(r > content.MELEE_MAX_REACH && r >= Math.min(content.RANGED_MIN_REACH, m.nova ?? Infinity), `${m.id} ranged/spell reach ${r} must stay beyond melee`);
    }
  }
  assert.equal(content.MELEE_MAX_REACH, 64);
  assert.equal(bal.MELEE_ARMOR_PIERCE, 1);
  assert.equal(bal.defenseVs("melee", 80), 0);
  assert.equal(bal.defenseVs("melee", 0.9), 0);
  assert.equal(bal.defenseVs("ranged", 80), 80);
  assert.equal(bal.defenseVs("spell", 80), 80);
  const base = { maxHpRef: 500, frac: 0.05, dmgMult: 1, movePower: 60, typeMult: 1, armor: 200, armorRef: 100, night: 1, enraged: false, frenzied: false };
  const melee = bal.enemyHitDamage({ ...base, form: "melee" }) / 1.1;
  const ranged = bal.enemyHitDamage({ ...base, form: "ranged" });
  assert.ok(melee > ranged, "your armor does not stop melee at all");
  // Melee does not care how much armor you wear, or how fast foes have adapted to it.
  const naked = bal.enemyHitDamage({ ...base, form: "melee", armor: 0 });
  const plated = bal.enemyHitDamage({ ...base, form: "melee", armor: 5000 });
  const adapted = bal.enemyHitDamage({ ...base, form: "melee", armor: 5000, armorRef: 9000 });
  assert.equal(plated, naked, "armor makes no difference against melee");
  assert.equal(adapted, naked, "foes' armor adaptation makes no difference against melee");
  assert.ok(bal.enemyHitDamage({ ...base, form: "ranged", armor: 5000 }) < bal.enemyHitDamage({ ...base, form: "ranged", armor: 0 }), "ranged hits still face armor");
});
