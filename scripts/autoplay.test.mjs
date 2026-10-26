/**
 * Autoplay's task model.
 *
 * The bug this file exists to stop coming back: every skill must belong to a task, because the old
 * system only mapped a handful by hand and let the rest fall through to "walk at the nearest foe".
 * That is why turning Fight off barely changed anything — autoplay just trained Evasion or Looting
 * or an element mastery and fought anyway.
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

const auto = await import(moduleUrl("../src/game/autoplay.ts"));
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const content = await import(moduleUrl("../src/game/content.ts", {
  "./classes": moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl }),
  "./overmax": moduleUrl("../src/game/overmax.ts"),
  "./class-kits": kitsUrl,
}));

test("every skill in the game belongs to a task that can switch it off", () => {
  for (const skill of content.SKILLS) {
    const task = auto.taskOfSkill(skill.id);
    assert.ok(auto.AUTO_TASK_BY_ID[task], `${skill.id} -> ${task} is not a real task`);
  }
});

test("the skills that used to slip through Fight-off are covered by Fight", () => {
  // These had no mapping before, so they trained by fighting while Fight was switched off.
  for (const id of ["magic", "evasion", "looting", "skinning", "physical", "hunting", "bountyhunting", "m_fire", "m_void"]) {
    assert.equal(auto.taskOfSkill(id), "combat", id);
  }
});

test("gathering, crafting, spirits, dungeons, trading and talking each map to their own task", () => {
  const expected = {
    mining: "mining", woodcutting: "woodcutting", fishing: "fishing", shroom: "shroom",
    alchemy: "crafting", cooking: "crafting",
    catching: "spirits", ghostkeeping: "spirits",
    adventuring: "dungeon", trading: "trading", social: "social",
  };
  for (const [skill, task] of Object.entries(expected)) assert.equal(auto.taskOfSkill(skill), task, skill);
});

test("trading and talking are switchable at all, which they were not before", () => {
  assert.ok(auto.AUTO_TASK_IDS.includes("trading"));
  assert.ok(auto.AUTO_TASK_IDS.includes("social"));
});

test("a fresh character has every task switched on", () => {
  const on = auto.allTasksOn();
  assert.equal(Object.keys(on).length, auto.AUTO_TASK_IDS.length);
  for (const id of auto.AUTO_TASK_IDS) assert.equal(on[id], true, id);
});

test("task ids and labels are unique, so nothing is unreachable in the panel", () => {
  assert.equal(new Set(auto.AUTO_TASK_IDS).size, auto.AUTO_TASK_IDS.length);
  assert.equal(new Set(auto.AUTO_TASKS.map((t) => t.label)).size, auto.AUTO_TASKS.length);
  for (const t of auto.AUTO_TASKS) assert.ok(t.label && t.about, `${t.id} needs a label and a description`);
});

test("a stored priority order is kept, and anything missing is added rather than lost", () => {
  const partial = auto.normalizePriority(["fishing", "combat"]);
  assert.deepEqual(partial.slice(0, 2), ["fishing", "combat"], "your order comes first");
  assert.equal(partial.length, auto.AUTO_TASK_IDS.length, "every task is present");
  assert.equal(new Set(partial).size, partial.length, "no duplicates");
});

test("junk in a stored priority is dropped without losing real tasks", () => {
  for (const junk of [null, undefined, "fishing", 7, {}, ["nope", "combat", "combat", "nope"]]) {
    const out = auto.normalizePriority(junk);
    assert.equal(out.length, auto.AUTO_TASK_IDS.length, JSON.stringify(junk));
    assert.equal(new Set(out).size, out.length);
    for (const id of out) assert.ok(auto.AUTO_TASK_BY_ID[id]);
  }
  assert.equal(auto.normalizePriority(["nope", "combat"])[0], "combat", "a known task keeps its place");
});

test("moving a task reorders it, and the ends of the list hold", () => {
  const base = auto.normalizePriority([]);
  const first = base[0], second = base[1], last = base[base.length - 1];

  const down = auto.movePriority(base, first, 1);
  assert.deepEqual(down.slice(0, 2), [second, first], "moved down past its neighbour");
  assert.equal(down.length, base.length);

  const up = auto.movePriority(base, second, -1);
  assert.deepEqual(up.slice(0, 2), [second, first], "moved up past its neighbour");

  assert.deepEqual(auto.movePriority(base, first, -1), base, "the top cannot move up");
  assert.deepEqual(auto.movePriority(base, last, 1), base, "the bottom cannot move down");
  assert.deepEqual(auto.movePriority(base, "nope", 1), base, "an unknown task changes nothing");
});

test("moving never drops or duplicates a task, however much it is shuffled", () => {
  let list = auto.normalizePriority([]);
  for (let i = 0; i < 200; i++) {
    const id = list[Math.floor(Math.random() * list.length)];
    list = auto.movePriority(list, id, Math.random() < 0.5 ? -1 : 1);
    assert.equal(list.length, auto.AUTO_TASK_IDS.length);
    assert.equal(new Set(list).size, list.length);
  }
});
