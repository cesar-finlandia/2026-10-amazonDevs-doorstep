# Brandmark — Doorstep Rhythm

One mark, one lockup, one definition (DP-UI owns all five files).

| File | What it is | Imported by |
|---|---|---|
| `brand/mark.svg` | The mark: three pencil ticks under a door arch on a threshold line. Geometry only, `currentColor`, no text, no hex. | The app header (`Brandmark.tsx`), the favicon, DP-SCRIPT slides and cover |
| `brand/favicon.svg` | The same mark with `currentColor` replaced by the paper accent `#1B6A62`, for contexts with no stylesheet. | `public/favicon.svg`, `scripts/export-favicon.ts` |
| `brand/brandmark.css` | The lockup: mark + `Doorstep Rhythm` + the slogan `Know her day without calling.`, one hairline device, one `font-size` knob (`.brandmark--header` 22 px, `--slide` 34 px, `--cover` 64 px). | `brand/lockup.html`, the app header styles |
| `brand/lockup.html` | Static page showing the three lockup sizes in both themes plus the mark contact sheet. | Screenshots, DP-SCRIPT placement checks |
| `brand/README.md` | This file. | — |

Single colour rule: the mark is always `currentColor` resolving to the theme accent token, never a literal colour in the geometry file. The slogan reads `Know her day without calling.` everywhere it appears.
