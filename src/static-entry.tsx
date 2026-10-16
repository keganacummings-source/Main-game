import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TurbzApp } from "./components/turbz-app";
import { initDesignerStore } from "./game/map-format";
import { loadPlayableWorlds } from "./game/builtin-maps";
import { initLifeWorlds } from "./game/life-world";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./styles.css";

const root = document.getElementById("root");
// Load designer maps from IndexedDB first so saved maps are there when the game starts (never wait long).
const ready = Promise.race([Promise.all([initDesignerStore(), loadPlayableWorlds(), initLifeWorlds()]), new Promise((r) => setTimeout(r, 4000))]);
if (root) void ready.finally(() => createRoot(root).render(<StrictMode><TurbzApp /></StrictMode>));
