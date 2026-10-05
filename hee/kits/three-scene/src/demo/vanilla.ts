// Requirement IDs: HEE-KIT-01
import { createThreeScene } from "../vanilla/index.js";
import { NEUTRAL_DEMO_TOKENS } from "../core/tokens.js";
import { buildSampleScene } from "./sample-scene.js";

function qualityFromUrl(): "high" | "low" {
  try {
    return new URLSearchParams(window.location.search).get("quality") === "low" ? "low" : "high";
  } catch {
    return "high";
  }
}

const stage = document.getElementById("stage");
if (!stage) throw new Error("three-scene vanilla demo: #stage element is missing");
stage.setAttribute("data-demo-3d", "widget-bay");

const scene = buildSampleScene();
const handle = createThreeScene(stage, {
  tokens: NEUTRAL_DEMO_TOKENS,
  name: "widget-bay",
  quality: qualityFromUrl(),
  onSelect: (id) => {
    for (const li of document.querySelectorAll("#entities button")) {
      const btn = li as HTMLButtonElement;
      btn.style.background = btn.dataset["id"] === id ? "#6f9fd8" : "transparent";
    }
  },
});
handle.update(scene);

const shots = document.getElementById("shots");
for (const name of ["overview", "detail"]) {
  const btn = document.createElement("button");
  btn.textContent = name;
  btn.onclick = () => handle.play(name);
  shots?.appendChild(btn);
}
const list = document.getElementById("entities");
for (const e of scene.entities) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.textContent = e.id;
  btn.dataset["id"] = e.id;
  btn.onclick = () => {
    handle.select(e.id);
  };
  li.appendChild(btn);
  list?.appendChild(li);
}
