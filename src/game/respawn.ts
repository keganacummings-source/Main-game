/** Hardcore overworld foes come back on this cadence, wherever they fell. */
export const HC_OVERWORLD_RESPAWN = 120;

/**
 * Seconds until this foe returns, or null when it must not respawn
 * (rifts, shrines, bounties, witches, hunter squads, and every dungeon: the Crypt and the Kiln stay
 * cleared until you leave and walk into a new instance).
 */
export function respawnSeconds(o: {
  hardcore: boolean;
  map: string;
  zoneRespawn?: number | null;
  boss?: boolean;
  special?: boolean;
}): number | null {
  if (o.special || isInstanceMap(o.map)) return null;
  if (o.hardcore && o.map === "world") return HC_OVERWORLD_RESPAWN;
  const zone = o.zoneRespawn;
  if (typeof zone === "number" && Number.isFinite(zone) && zone > 0) return zone;
  return o.boss ? 70 : 22;
}

/** Dungeons run as instances: foes you kill stay dead until you leave and enter a new instance. */
export function isInstanceMap(map: string | null | undefined): boolean {
  const m = map ?? "";
  return m === "crypt" || m === "kiln" || m.startsWith("rift-");
}
