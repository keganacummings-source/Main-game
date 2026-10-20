import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TurbzApp } from "./components/turbz-app";
import { initDesignerStore } from "./game/map-format";
import { loadPlayableWorlds } from "./game/builtin-maps";
import { initLifeWorlds } from "./game/life-world";
import { syncTileOverrides } from "./game/camp-assets";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./styles.css";

const root = document.getElementById("root");
// Designer-made map tiles marked "use in game" replace the pack tiles before anything draws.
try { syncTileOverrides(); } catch { /* a broken pack must never stop the game */ }
// Load designer maps from IndexedDB first so saved maps are there when the game starts (never wait long).
const ready = Promise.race([Promise.all([initDesignerStore(), loadPlayableWorlds(), initLifeWorlds()]), new Promise((r) => setTimeout(r, 4000))]);
if (root) void ready.finally(() => createRoot(root).render(<StrictMode><TurbzApp /></StrictMode>));
