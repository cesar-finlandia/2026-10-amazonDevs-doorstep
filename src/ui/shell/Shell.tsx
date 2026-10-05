// src/ui/shell/Shell.tsx — app bar, banners and the routed page (DP-UI §3.3).
// Requirement IDs: FR-19
import { Outlet } from "react-router";
import { AppBar } from "./AppBar.js";
import { Banners } from "./Banners.js";

export function Shell(): React.JSX.Element {
  return (
    <>
      <AppBar />
      <Banners />
      <Outlet />
    </>
  );
}
