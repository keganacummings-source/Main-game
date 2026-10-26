/**
 * Spending skill points across verses.
 *
 * The Auto-level button did nothing for a player sitting on two hundred points. The algorithm was
 * fine; what it could not survive was the shape of a real save — a missing `loadout`, a
 * `skillPoints` that had come back from storage as something other than a number. It threw part
 * way through and looked like a dead button, with nothing said.
 *
 * These tests run the same loop the engine runs against the save shapes that broke it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(path, imports = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports)) source = source.replaceAll(`from "${specifier}"`, `from "${url}"`);
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const overmaxUrl = moduleUrl("../src/game/overmax.ts");
const contentUrl = moduleUrl("../src/game/content.ts", {
  "./classes": moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl }),
  "./overmax": overmaxUrl,
  "./class-kits": kitsUrl,
});
const content = await import(contentUrl);
const ability = await import(moduleUrl("../src/game/ability-progression.ts", { "./content": contentUrl, "./overmax": overmaxUrl }));

const MAX_EQUIPPED = 9;

/** The engine's autoLevelVerses loop, including the repairs it does to the save first. */
function autoLevel(save, only) {
  save.abilityRanks = save.abilityRanks ?? {};
  save.loadout = Array.isArray(save.loadout) ? save.loadout : [];
  const points = Math.floor(Number(save.skillPoints) || 0);
  save.skillPoints = points;
  if (points < 1) return { spent: 0, reason: "no points" };

  const wanted = only && only.length ? only : Object.keys(save.abilityRanks);
  const pick = wanted.filter((id) => content.MOVE_BY_ID[id]);
  if (!pick.length) return { spent: 0, reason: "no verses" };

  let spent = 0;
  let capped = 0;
  while ((save.skillPoints ?? 0) > 0) {
    let low = null, lowRank = Infinity;
    for (const id of pick) {
      const rank = save.abilityRanks[id] ?? 0;
      if (rank >= ability.RANK_MAX) continue;
      if (rank < lowRank) { lowRank = rank; low = id; }
    }
    if (!low) { capped = pick.length; break; }
    const first = !save.abilityRanks[low];
    if (!ability.spendAbilityPoint(save, low)) break;
    if (first && save.loadout.length < MAX_EQUIPPED) save.loadout.push(low);
    spent++;
  }
  return { spent, reason: capped ? "all capped" : "done" };
}

const IDS = content.MOVES.slice(0, 9).map((m) => m.id);
const save = (over = {}) => ({ skillPoints: 200, abilityRanks: Object.fromEntries(IDS.map((i) => [i, 1])), loadout: IDS.slice(), ...over });

test("two hundred points are actually spent", () => {
  const s = save();
  const r = autoLevel(s, null);
  assert.equal(r.spent, 200);
  assert.equal(s.skillPoints, 0);
});

test("it spends evenly, not all into one verse", () => {
  const s = save({ skillPoints: 90 });
  autoLevel(s, null);
  const ranks = IDS.map((i) => s.abilityRanks[i]);
  // Nine verses, ninety points, all starting level: they should come out within one of each other.
  assert.ok(Math.max(...ranks) - Math.min(...ranks) <= 1, `uneven: ${ranks.join(",")}`);
});

test("the lowest verse is always topped up first", () => {
  const s = save({ skillPoints: 4, abilityRanks: { ...Object.fromEntries(IDS.map((i) => [i, 9])), [IDS[0]]: 1 } });
  autoLevel(s, null);
  assert.ok(s.abilityRanks[IDS[0]] > 1, "the one that was behind got the points");
  assert.equal(s.abilityRanks[IDS[1]], 9, "the ones that were ahead were left alone");
});

// ── the shapes that actually broke it ──────────────────────────────────────────────────────────

test("a save with no loadout at all still spends", () => {
  const s = save({ loadout: undefined, abilityRanks: Object.fromEntries(IDS.map((i) => [i, 0])) });
  const r = autoLevel(s, null);
  assert.equal(r.spent, 200, "this is the one that threw and looked like a dead button");
  assert.ok(Array.isArray(s.loadout));
});

test("skillPoints that came back as a string still spends", () => {
  const s = save({ skillPoints: "200" });
  assert.equal(autoLevel(s, null).spent, 200);
});

test("junk in skillPoints is treated as none, not as a crash", () => {
  for (const junk of [null, undefined, NaN, "lots", {}]) {
    const s = save({ skillPoints: junk });
    assert.equal(autoLevel(s, null).spent, 0, String(junk));
  }
});

test("a verse on the bar that has never been ranked is handled", () => {
  const s = { skillPoints: 20, abilityRanks: {}, loadout: [], bar: IDS.slice() };
  assert.equal(autoLevel(s, IDS).spent, 20);
  assert.ok(s.loadout.length > 0, "newly learned verses go onto the bar");
});

test("every verse at the top rank reports it instead of spending", () => {
  const s = save({ abilityRanks: Object.fromEntries(IDS.map((i) => [i, ability.RANK_MAX])) });
  const r = autoLevel(s, null);
  assert.equal(r.spent, 0);
  assert.equal(r.reason, "all capped");
  assert.equal(s.skillPoints, 200, "the points are left for you, not eaten");
});

test("it never spends past the top rank", () => {
  const s = save({ skillPoints: 100000 });
  autoLevel(s, null);
  for (const id of IDS) assert.ok(s.abilityRanks[id] <= ability.RANK_MAX, `${id} went past the cap`);
});

test("narrowing to the bar only levels those verses", () => {
  const s = save({ skillPoints: 20 });
  const only = IDS.slice(0, 3);
  autoLevel(s, only);
  for (const id of IDS.slice(3)) assert.equal(s.abilityRanks[id], 1, `${id} should have been left alone`);
});
