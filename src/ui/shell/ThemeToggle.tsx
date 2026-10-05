// src/ui/shell/ThemeToggle.tsx — Paper | Dusk radiogroup (DP-UI §5.6 §6.2).
// Requirement IDs: FR-19
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/theme.js";

export function ThemeToggle(): React.JSX.Element {
  const { theme, set } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="theme-toggle">
      <button type="button" role="radio" aria-checked={theme === "light"} onClick={() => set("light")}>
        <Sun size={16} aria-hidden="true" />
        Paper
      </button>
      <button type="button" role="radio" aria-checked={theme === "dark"} onClick={() => set("dark")}>
        <Moon size={16} aria-hidden="true" />
        Dusk
      </button>
    </div>
  );
}
