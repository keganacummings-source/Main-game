import { useState } from "react";
import { MapBuilder } from "./map-builder";
import { WeaponDesigner } from "./weapon-designer";
export function DesignerMode({ onBack }: { onBack: () => void }) {
  const [tool, setTool] = useState<"map" | "weapon" | null>(null);
  if (tool === "map") return <MapBuilder onBack={() => setTool(null)} />;
  if (tool === "weapon") return <WeaponDesigner onBack={() => setTool(null)} />;
  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="font-display text-xs text-blood">DESIGNER MODE</p>
          <h1 className="font-display text-lg">Builder Tools</h1>
        </div>
        <button className="px-btn" onClick={onBack}>
          Back to main menu
        </button>
      </header>
      <div className="designer-tool-list">
        <button className="px-panel designer-tool" onClick={() => setTool("map")}>
          <span className="font-display text-kyo">Map Builder</span>
          <p>Build Bossrooms, Dungeons, and full Worlds with the supplied tile collection.</p>
          <p className="text-dim">Paint terrain · collision · spawns · save · import / export</p>
        </button>
        <button className="px-panel designer-tool" onClick={() => setTool("weapon")}>
          <span className="font-display text-kyo">Weapon Designer</span>
          <p>Create pixel weapon art and choose combat stats.</p>
          <p className="text-dim">
            Pixel editor · element · damage · speed · range · import / export
          </p>
        </button>
      </div>
      <p className="designer-status">
        Designs are saved on this device. Export JSON files for future game updates.
      </p>
    </div>
  );
}
