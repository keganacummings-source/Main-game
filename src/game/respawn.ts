/** Hardcore overworld foes come back on this cadence, wherever they fell. */
export const HC_OVERWORLD_RESPAWN = 120;

/**
 * Seconds until this foe returns, or null when it must not respawn
 * (rifts, shrines, bounties, witches, hunter squads).
 */
export function respawnSeconds(o: {
  hardcore: boolean;
  map: string;
  zoneRespawn?: number | null;
  boss?: boolean;
  special?: boolean;
}): number | null {
  if (o.special || (o.map ?? "").startsWith("rift-")) return null;
  if (o.hardcore && o.map === "world") return HC_OVERWORLD_RESPAWN;
  const zone = o.zoneRespawn;
  if (typeof zone === "number" && Number.isFinite(zone) && zone > 0) return zone;
  return o.boss ? 70 : 22;
}
