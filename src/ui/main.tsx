// src/ui/main.tsx — mount (DP-UI WU-UI-04).
// Requirement IDs: FR-19
import "./tokens/tokens.css";
import "./tokens/fonts.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/controls.css";
import "./styles/message.css";
import "./styles/platform-skin.css";
import "./styles/motion.css";
import { createRoot } from "react-dom/client";
import App from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(<App />);
