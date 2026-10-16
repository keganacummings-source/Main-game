import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const src = ts.transpileModule(readFileSync(new URL("../src/game/sfx-bank.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { renderSfx, SFX_NAMES } = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);

test("every synthesised sound renders clean, level-matched audio", () => {
  assert.ok(SFX_NAMES.length >= 15);
  for (const name of SFX_NAMES) {
    const b = renderSfx(name, 44100);
    assert.ok(b.length > 2000, `${name} has length`);
    let peak = 0;
    for (const v of b) { assert.ok(Number.isFinite(v), `${name} is finite`); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(peak > 0.8 && peak <= 0.9, `${name} peak ${peak} is normalised`);
    assert.ok(Math.abs(b[b.length - 1]) < 0.05, `${name} ends without a click`);
  }
});
