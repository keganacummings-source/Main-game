/**
 * Two-frame animation: tiles animate only when switched on, enemies always animate.
 *
 * The rules worth pinning down are the ones a player would notice if they broke: a tile that was
 * drawn as a still picture must keep sitting still, an enemy must never lose the top of its head or
 * its feet to the generated idle frame, and every enemy already in the shipped roster must actually
 * move now that enemies animate by default.
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
const stub = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

const atlas = await import(moduleUrl("../src/game/tile-atlas.ts"));
const camp = await import(moduleUrl("../src/game/camp-assets.ts", { "./tile-atlas": moduleUrl("../src/game/tile-atlas.ts") }));

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const PNG2 = "data:image/png;base64,iVBORw0KGgoAAAA=";
const tile = (over = {}) => ({ id: "t1", name: "T", group: "tile", category: "floor", pixels: PNG, size: 32, created: 1, ...over });

// ─── tiles ─────────────────────────────────────────────────────────────────────────────────────

test("a tile with no second frame reads as a still picture", () => {
  const a = tile();
  assert.equal(camp.frameTwo(a), PNG, "frame 2 falls back to frame 1");
  assert.equal(camp.playsAnimation(a), false);
});

test("animation stays off until it is switched on AND a different frame exists", () => {
  // Switched on, but nothing painted in frame 2.
  assert.equal(camp.playsAnimation(tile({ animated: true })), false);
  // Frame 2 painted, but animation not switched on: a tile drawn as a still stays still.
  assert.equal(camp.playsAnimation(tile({ pixels2: PNG2 })), false);
  // Frame 2 is just a copy, so there is nothing to see.
  assert.equal(camp.playsAnimation(tile({ animated: true, pixels2: PNG })), false);
  // Both conditions met.
  assert.equal(camp.playsAnimation(tile({ animated: true, pixels2: PNG2 })), true);
});

test("loop speed is clamped into range and defaults when unset", () => {
  assert.equal(camp.animFpsOf({}), camp.ANIM_FPS_DEFAULT);
  assert.equal(camp.animFpsOf({ animFps: 0 }), camp.ANIM_FPS_MIN);
  assert.equal(camp.animFpsOf({ animFps: 9999 }), camp.ANIM_FPS_MAX);
  assert.equal(camp.animFpsOf({ animFps: Number.NaN }), camp.ANIM_FPS_DEFAULT);
  assert.equal(camp.animFpsOf({ animFps: 3 }), 3);
});

test("a junk second frame drops back to a one-frame tile instead of failing the piece", () => {
  const bad = tile({ pixels2: "not-an-image" });
  assert.equal(camp.validAsset(bad), true, "the piece itself is still valid");
  assert.equal(bad.pixels2, undefined, "the junk frame was dropped");
});

test("only animated tiles are registered as animated, and the frame alternates on the clock", () => {
  atlas.setTileOverrides({
    "/MapAssets/still.png": PNG,
    "/MapAssets/moving.png": { a: PNG, b: PNG2, fps: 4 },
  });
  assert.deepEqual([...atlas.animatedTilePaths()], ["/MapAssets/moving.png"]);
  assert.equal(atlas.isAnimatedTile("/MapAssets/still.png"), false);
  assert.equal(atlas.isAnimatedTile("/MapAssets/moving.png"), true);

  // A still tile is always on frame 0, whatever the clock says.
  for (const t of [0, 0.3, 1.1, 97.5]) assert.equal(atlas.tileFrameAt("/MapAssets/still.png", t), 0);
  // At 4 fps the frame flips every quarter second.
  assert.equal(atlas.tileFrameAt("/MapAssets/moving.png", 0), 0);
  assert.equal(atlas.tileFrameAt("/MapAssets/moving.png", 0.25), 1);
  assert.equal(atlas.tileFrameAt("/MapAssets/moving.png", 0.5), 0);
  assert.equal(atlas.tileFrameAt("/MapAssets/moving.png", 0.75), 1);
  // An unknown path never animates.
  assert.equal(atlas.tileFrameAt("/MapAssets/nope.png", 0.25), 0);
  atlas.setTileOverrides({});
  assert.equal(atlas.animatedTilePaths().length, 0);
});

test("the animated-tile revision moves when the animated set changes, so indexes rebuild", () => {
  const before = atlas.animatedTileRevision();
  atlas.setTileOverrides({ "/MapAssets/moving.png": { a: PNG, b: PNG2, fps: 2 } });
  const after = atlas.animatedTileRevision();
  assert.notEqual(before, after);
  // Setting the identical override again changes nothing, so cached work is not thrown away.
  atlas.setTileOverrides({ "/MapAssets/moving.png": { a: PNG, b: PNG2, fps: 2 } });
  assert.equal(atlas.animatedTileRevision(), after);
  atlas.setTileOverrides({});
});

// ─── enemies ───────────────────────────────────────────────────────────────────────────────────

// enemy-design pulls in the content and balance tables, so the real chain is wired up the same
// way scripts/map-gen-audit.mjs does it. Only the sprite renderer is stubbed, since it wants a DOM.
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const contentUrl = moduleUrl("../src/game/content.ts", {
  "./classes": moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl }),
  "./overmax": moduleUrl("../src/game/overmax.ts"),
  "./class-kits": kitsUrl,
});
const balanceUrl = moduleUrl("../src/game/balance.ts", { "./content": contentUrl, "./overmax": moduleUrl("../src/game/overmax.ts") });
const shippedJson = readFileSync(new URL("../src/game/enemies/custom-enemies.json", import.meta.url), "utf8");
const design = await import(moduleUrl("../src/game/enemy-design.ts", {
  "./enemies/custom-enemies.json": stub(`export default ${shippedJson}`),
  "./content": contentUrl,
  "./balance": balanceUrl,
  "./type-palettes": moduleUrl("../src/game/type-palettes.ts", { "./content": contentUrl }),
  "./creature-sprites": stub("export const CREATURE_CELLS={};export const frameTwoKey=(s)=>s+'f2';export const setCustomSprite=()=>{};export const clearCustomSprites=()=>{};export const setTypedSpriteResolver=()=>{};"),
}));

const SIDE = design.SPRITE_SIDE;
const CELLS = design.SPRITE_CELLS;
const topRow = (p) => p.slice(0, SIDE);
const bottomRow = (p) => p.slice((SIDE - 1) * SIDE);

/** A sprite with every cell painted, so nothing has room to move without clipping. */
function fullSprite() {
  return Array.from({ length: CELLS }, (_, i) => `#${(i % 9) + 1}${(i % 7) + 1}${(i % 5) + 1}${(i % 9) + 1}${(i % 7) + 1}${(i % 5) + 1}`);
}

test("the generated idle frame never clips the top of the head or the feet", () => {
  for (const sprite of [fullSprite(), Array(CELLS).fill("#ffffff")]) {
    const idle = design.idleFrame(sprite);
    assert.equal(idle.length, CELLS);
    assert.deepEqual(topRow(idle), topRow(sprite), "top row must survive");
    assert.deepEqual(bottomRow(idle), bottomRow(sprite), "bottom row must survive");
  }
});

test("the generated idle frame settles the body by one pixel", () => {
  const sprite = fullSprite();
  const idle = design.idleFrame(sprite);
  // Each row between the first and the last shows the row that was above it.
  for (let y = 1; y < SIDE - 1; y++) {
    for (let x = 0; x < SIDE; x++) {
      assert.equal(idle[y * SIDE + x], sprite[(y - 1) * SIDE + x], `cell ${x},${y}`);
    }
  }
});

test("a full sprite does animate, and an empty one has nothing to animate", () => {
  const full = fullSprite();
  assert.equal(design.framesDiffer(full, design.idleFrame(full)), true);
  const empty = Array(CELLS).fill(null);
  assert.equal(design.framesDiffer(empty, design.idleFrame(empty)), false);
});

test("framesDiffer is honest about a missing or mismatched frame", () => {
  const a = fullSprite();
  assert.equal(design.framesDiffer(a, undefined), false);
  assert.equal(design.framesDiffer(a, a.slice(0, 4)), false);
  assert.equal(design.framesDiffer(a, a.slice()), false);
});

const baseDesign = (sprite) => ({
  version: 1, id: "anim-test", name: "Anim Test", about: "", replaces: null, type: "earth",
  sprite, scale: 1, behaviour: "hunt", boss: false,
  flags: { witch: false, worldBoss: false, dungeonBoss: false, overworld: true, ghost: false, animal: false },
  stats: { hp: 1, dmg: 1, speed: 1, crit: 0.05, dodge: 0, physRes: 0, spellRes: 0 },
  enchants: [], extraEnchants: 0, moves: ["measured"], levelBonus: 0, biomes: ["verdant"], weight: 3, loot: 1,
});

test("a drawn design always comes back with a second frame, generated when absent", () => {
  const parsed = design.parseEnemyDesign(baseDesign({ kind: "pixels", pixels: fullSprite() }));
  assert.equal(parsed.sprite.kind, "pixels");
  assert.ok(Array.isArray(parsed.sprite.pixels2), "frame 2 was filled in");
  assert.equal(parsed.sprite.pixels2.length, CELLS);
  assert.equal(design.framesDiffer(parsed.sprite.pixels, parsed.sprite.pixels2), true, "and it animates");
});

test("a hand-painted second frame is kept exactly, not regenerated", () => {
  const mine = Array(CELLS).fill(null);
  mine[SIDE * 3 + 3] = "#abcdef";
  const parsed = design.parseEnemyDesign(baseDesign({ kind: "pixels", pixels: fullSprite(), pixels2: mine }));
  assert.deepEqual(parsed.sprite.pixels2, mine);
});

test("a wrong-sized second frame is replaced by a generated one rather than trusted", () => {
  const parsed = design.parseEnemyDesign(baseDesign({ kind: "pixels", pixels: fullSprite(), pixels2: ["#ffffff"] }));
  assert.equal(parsed.sprite.pixels2.length, CELLS);
});

test("every enemy shipped with the game animates now that enemies animate by default", () => {
  const shipped = JSON.parse(readFileSync(new URL("../src/game/enemies/custom-enemies.json", import.meta.url), "utf8"));
  assert.ok(shipped.length >= 20, "the shipped roster is still there");
  for (const raw of shipped) {
    const d = design.parseEnemyDesign(raw);
    assert.equal(d.sprite.kind, "pixels", `${d.name} is a drawn sprite`);
    assert.equal(design.framesDiffer(d.sprite.pixels, d.sprite.pixels2), true, `${d.name} must animate`);
    // And its silhouette is untouched at top and bottom.
    assert.deepEqual(topRow(d.sprite.pixels2), topRow(d.sprite.pixels), `${d.name} kept its top row`);
    assert.deepEqual(bottomRow(d.sprite.pixels2), bottomRow(d.sprite.pixels), `${d.name} kept its bottom row`);
  }
});
