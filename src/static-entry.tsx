import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TurbzApp } from "./components/turbz-app";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./styles.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><TurbzApp /></StrictMode>);
