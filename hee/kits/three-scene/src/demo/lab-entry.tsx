// Requirement IDs: HEE-KIT-01
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LabApp } from "./lab.js";

const root = document.getElementById("root");
if (!root) throw new Error("three-scene lab: #root element is missing");
createRoot(root).render(
  <StrictMode>
    <LabApp />
  </StrictMode>,
);
