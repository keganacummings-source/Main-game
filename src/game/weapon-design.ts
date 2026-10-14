import { TYPES, type TypeId } from "./content";
export type WeaponDesign = {
  version: 1;
  id: string;
  name: string;
  type: TypeId;
  damage: number;
  speed: number;
  range: number;
  pixels: (string | null)[];
};
export function newWeaponDesign(): WeaponDesign {
  const pixels: (string | null)[] = Array(256).fill(null);
  for (let y = 2; y < 11; y++) {
    pixels[y * 16 + 8] = "#f0e2c8";
    pixels[y * 16 + 9] = "#8ca4ae";
  }
  for (let x = 5; x <= 12; x++) pixels[11 * 16 + x] = "#e6c15a";
  for (let y = 12; y < 15; y++) pixels[y * 16 + 8] = "#885038";
  return {
    version: 1,
    id: "new-weapon",
    name: "Hearthblade",
    type: "normal",
    damage: 12,
    speed: 1,
    range: 48,
    pixels,
  };
}
export function parseWeaponDesign(raw: unknown): WeaponDesign {
  const w = raw as WeaponDesign;
  if (
    !w ||
    w.version !== 1 ||
    typeof w.id !== "string" ||
    !/^[a-z0-9_-]{1,80}$/i.test(w.id) ||
    typeof w.name !== "string" ||
    !w.name.trim() ||
    w.name.length > 100 ||
    !Object.hasOwn(TYPES, w.type)
  )
    throw Error("Invalid weapon identity or element.");
  if (
    !Number.isFinite(w.damage) ||
    w.damage < 1 ||
    w.damage > 500 ||
    !Number.isFinite(w.speed) ||
    w.speed < 0.2 ||
    w.speed > 5 ||
    !Number.isFinite(w.range) ||
    w.range < 16 ||
    w.range > 500
  )
    throw Error("Damage: 1–500; speed: 0.2–5; range: 16–500.");
  if (
    !Array.isArray(w.pixels) ||
    w.pixels.length !== 256 ||
    w.pixels.some((p) => p !== null && (typeof p !== "string" || !/^#[0-9a-f]{6}$/i.test(p)))
  )
    throw Error("Weapon art needs 256 pixels, each transparent or a hex color.");
  return {
    version: 1,
    id: w.id,
    name: w.name.trim(),
    type: w.type,
    damage: w.damage,
    speed: w.speed,
    range: w.range,
    pixels: [...w.pixels],
  };
}
