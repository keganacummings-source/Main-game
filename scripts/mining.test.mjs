import assert from "node:assert/strict";
import test from "node:test";
import * as m from "../src/game/mining.ts";

const NT = "/MapAssets/NewTex/";
const wall = (name, biome = 2, floor = 0) => ({ floor, biome, block: 1, decor: 0, sprite: `${NT}${name}.png` });
const info = (t) => m.mineInfo(t, 50, 50, 450, 450);

test("walls turn into their matching floor, anything else into dirt", () => {
  assert.deepEqual(info(wall("stone_wall")).floor, { floor: 3, sprite: `${NT}stone_floor.png` });
  assert.equal(info(wall("sand_wall")).floor.sprite, `${NT}sand.png`);
  assert.equal(info(wall("snow_wall")).floor.sprite, `${NT}snow.png`);
  assert.equal(info(wall("hell_wall", 6)).floor.sprite, `${NT}hell_floor.png`);
  assert.equal(info(wall("temple_wall")).floor.sprite, `${NT}temple_floor.png`);
  assert.equal(info(wall("wood_wall")).floor.sprite, `${NT}wood_floor.png`);
  assert.deepEqual(info(wall("mystery_wall")).floor, { floor: 4, sprite: `${NT}dirt_floor.png` });
});

test("drops follow the tile and the biome", () => {
  assert.equal(info(wall("hell_wall", 6)).drop, "hell_ore");
  assert.equal(info(wall("stone_wall", 6)).drop, "hell_ore", "stone in a hell biome is hell ore");
  assert.equal(info(wall("stone_wall", 2)).drop, "rock_ore");
  assert.equal(info(wall("snow_wall", 1)).drop, "rock_ore");
  assert.equal(info(wall("sand_wall", 3)).drop, "sand");
  assert.equal(info(wall("sand_wall", 6)).drop, "sand", "sandstone is sand even in hell");
  assert.equal(info(wall("dirt_wall", 2)).drop, "dirt");
  assert.equal(info({ floor: 4, biome: 2, block: 0, decor: 0, sprite: `${NT}dirt_floor.png` }).drop, "dirt");
  assert.equal(info({ floor: 4, biome: 2, block: 0, decor: 0, sprite: `${NT}dirt_floor.png` }).floor.sprite, `${NT}grass.png`);
  assert.equal(info(wall("wood_wall")).drop, "timber");
  assert.equal(info(wall("stone_wall")).chance, 0.25);
  assert.equal(info(wall("hell_wall", 6)).chance, 0.25);
  assert.equal(info(wall("wood_wall")).chance, 1);
  assert.equal(info(wall("sand_wall")).chance, 1);
});

test("25% rolls", () => {
  const i = info(wall("stone_wall"));
  assert.equal(m.rollMineDrop(i, 0.24), "rock_ore");
  assert.equal(m.rollMineDrop(i, 0.25), null);
});

test("open ground, water, lava, portals and the world edge cannot be mined", () => {
  assert.equal(info({ ...wall("stone_wall"), block: 0 }), null);
  assert.equal(info({ ...wall("lava"), floor: 11 }), null);
  assert.equal(info(wall("water", 5, 2)), null);
  assert.equal(info(wall("deep_water")), null);
  assert.equal(info(wall("stone_wall", 2, 0) && { ...wall("stone_wall"), portal: { map: "x" } }), null);
  assert.equal(m.mineInfo(wall("stone_wall"), 1, 50, 450, 450), null);
  assert.equal(m.mineInfo(wall("stone_wall"), 50, 448, 450, 450), null);
});

test("it takes two clicks on the same block, and the crack fades", () => {
  let r = m.mineClick(null, "custom-turbz", 10, 0);
  assert.equal(r.broke, false);
  assert.equal(m.mineClick(r.progress, "custom-turbz", 11, 100).broke, false, "a different block starts over");
  assert.equal(m.mineClick(r.progress, "custom-turbz", 10, m.MINE_WINDOW_MS + 1).broke, false, "too slow");
  assert.equal(m.mineClick(r.progress, "custom-turbz", 10, 800).broke, true);
});

test("breaking a block leaves walkable floor", () => {
  const t = { ...wall("stone_wall"), layers: ["x"] };
  m.breakBlock(t, info(t));
  assert.equal(t.block, 0);
  assert.equal(t.sprite, `${NT}stone_floor.png`);
  assert.equal(t.layers, undefined);
});

test("every block kind pays Mining XP, ore drops pay a bonus", () => {
  assert.equal(info(wall("hell_wall", 6)).xp, m.MINE_XP.hell);
  assert.equal(info(wall("stone_wall")).xp, m.MINE_XP.stone);
  assert.equal(info(wall("sand_wall")).xp, m.MINE_XP.sand);
  assert.equal(info(wall("wood_wall")).xp, m.MINE_XP.wood);
  assert.equal(info(wall("dirt_wall")).xp, m.MINE_XP.dirt);
  assert.equal(info({ floor: 4, biome: 2, block: 0, decor: 0, sprite: `${NT}dirt_floor.png` }).xp, m.MINE_XP.dirt, "digging dirt ground");
  for (const k of Object.keys(m.MINE_XP)) assert.ok(m.MINE_XP[k] > 0, `${k} xp`);
  assert.ok(m.MINE_XP.hell > m.MINE_XP.stone && m.MINE_XP.stone > m.MINE_XP.dirt, "harder rock pays more");
  const stone = info(wall("stone_wall"));
  assert.equal(m.mineXp(stone, null), m.MINE_XP.stone);
  assert.equal(m.mineXp(stone, "rock_ore"), m.MINE_XP.stone + m.ORE_BONUS_XP);
  const hell = info(wall("hell_wall", 6));
  assert.equal(m.mineXp(hell, "hell_ore"), m.MINE_XP.hell + m.ORE_BONUS_XP);
  const sand = info(wall("sand_wall"));
  assert.equal(m.mineXp(sand, "sand"), m.MINE_XP.sand, "sand is not an ore, so no bonus");
  assert.equal(m.mineXp(info(wall("wood_wall")), "timber"), m.MINE_XP.wood, "timber is not an ore, so no bonus");
});
