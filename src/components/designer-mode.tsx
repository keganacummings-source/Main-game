import { useEffect, useState } from "react";
import { MapBuilder } from "./map-builder";
import { EnemyDesigner } from "./enemy-designer";
import { CampAssetBuilder } from "./camp-asset-builder";
import { CharacterRedesigner } from "./character-redesigner";
import { installEnemyDesigns, localEnemyDesigns } from "@/game/enemy-design";
import { savedMaps } from "@/game/map-format";
import { Tile } from "./ui-kit";
import { loadPack } from "@/game/camp-assets";
import { loadRedraws } from "@/game/class-redraws";

export function DesignerMode({ onBack }: { onBack: () => void }) {
  const [tool, setTool] = useState<"map" | "enemy" | "camp" | "redesign" | null>(null);
  // Designed enemies show up in the Map Builder's spawn-zone lists too.
  useEffect(() => {
    try {
      installEnemyDesigns();
    } catch {
      /* a broken design must not block the tools */
    }
  }, [tool]);
  if (tool === "map") return <MapBuilder onBack={() => setTool(null)} />;
  if (tool === "enemy") return <EnemyDesigner onBack={() => setTool(null)} />;
  if (tool === "camp") return <CampAssetBuilder onBack={() => setTool(null)} />;
  if (tool === "redesign") return <CharacterRedesigner onBack={() => setTool(null)} />;
  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">DESIGNER MODE</p>
          <h1 className="screen-title">Builder tools</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back to main menu</button>
      </header>
      <div className="tile-grid designer-tiles">
        <Tile primary title="Map Builder" about="Bossrooms, dungeons and whole worlds: terrain, collision, spawn zones, NPCs, quests, import / export." onClick={() => setTool("map")} badge={`${savedMaps().length} saved`} />
        <Tile title="Enemy Designer" about="Make new enemies or replace built-in ones: sprite, element, stats, enchantments, moves, where they spawn and what they drop." onClick={() => setTool("enemy")} badge={`${localEnemyDesigns().length} saved`} />
        <Tile title="Camp & Tile Asset Builder" about="Pixel-paint camp pieces and map tiles. Give tiles properties: hold items (kyo, ghost gear…), spawn in Dungeons/Temples/Houses, is Deco, walk-on effects (burn, poison, movement reduction…). Export packs as JSON." onClick={() => setTool("camp")} badge={`${loadPack().length} saved`} />
        <Tile title="Character Redesigner" about="Draw over any class's 16 frames (4 directions × 4 steps). The original art is already loaded, so just paint over it. Saves automatically; export JSON for a future update." onClick={() => setTool("redesign")} badge={`${loadRedraws().length} saved`} />
      </div>
      <p className="designer-status">Designs are saved on this device and are live in your games. Export JSON to ship them in a game update.</p>
    </div>
  );
}