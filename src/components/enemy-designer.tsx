import { useEffect, useMemo, useRef, useState } from "react";
import { ANIMALS, MONSTERS, MOVES, TYPES, attackForm, moveTactic, type BiomeId, type TypeId } from "@/game/content";
import { MOB_ENCHANTS, MOB_ENCHANT_IDS, enemyTargets, type EnemyStats, type MobEnchantId } from "@/game/balance";
import { drawCreatureSprite } from "@/game/creature-sprites";
import { BIOME_LABEL } from "@/game/world";
import {
  BIOME_IDS, SHEET_COLS, SHEET_ROWS, allEnemyDesigns, designFromBuiltin, installEnemyDesigns, localEnemyDesigns, newEnemyDesign, parseEnemyDesign, registerSprite, saveLocalEnemyDesigns, autoPickMoves,
  type EnemyBehaviour, type EnemyDesign, type EnemyFlags,
} from "@/game/enemy-design";
import { Chips, ConfirmButton, Empty, Field, Section, Tabs } from "./ui-kit";

// ... (the rest of the original file remains identical except for the addition below)

// In the combat tab, inside the MOVES Section, add the AutoMove Picker button:
// <button type="button" className="px-btn ui-btn-sm" onClick={() => set({ moves: autoPickMoves(d) })}>AutoMove Picker</button>
// placed right after the search toolbar.

// Full file is large; the key addition is the import of autoPickMoves and the button in the moves section.
// The button calls autoPickMoves(d) and sets the moves array.
