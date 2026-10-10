# Visual Identity Plan — Doorstep Rhythm

> Written at plan time, in the same run as the blueprint, so the implementor only transcribes. **Every value below is literal.** The single consumer is `DP-UI`, which reproduces §2–§5 verbatim in its own §5. No other plan defines a colour, a font, a radius, a shadow or an animation; `DP-3D` reads the scene tokens through `readTokensFromCss`, `DP-SCRIPT` imports `cinematic-tokens.json` and the brandmark.
> Colour contrast ratios in this file were computed by script (WCAG 2.x relative luminance) at plan time; `DP-UI` WU-03 re-computes them and fails on any pair below its minimum.
> Slogan (final, identical in the header, the cover, both slides and the spoken close): **Know her day without calling.**

## §1 Audience, register, references, memorable idea

**Who it is for.** A daughter or son who lives a train ride from a parent who lives alone (persona-01 in `../../hackathons/hackathon-projects/2026-10-amazonDevs/personas.json`: *long-distance daughter watching solo-living mum*, grounded in mined posts `frust-0001` and `frust-0002`). She is not a technician. She opens the page on a laptop in the evening, wants to know in ten seconds whether this was an ordinary week for her mother, and distrusts anything that feels like surveillance. In the demo the household is a labelled synthetic one ("Rosa Alvarez, 84"; the daughter is "Marta").

**Visual register: warm-editorial.** A household almanac, not a security console. Justification: the audience trusts the look of a printed family calendar and a well-set magazine page — unhurried, legible, personal — and distrusts the black-grid, red-dot look of camera software. The palette is a consequence of the register: paper ground, pencil ink, one verdigris accent, and amber that means "look here" rather than "alarm".

**The one feeling: settled.** The page should feel like coming home and finding things as they should be; when something is off, it is still said in a calm sentence with a pencil circle around it.

**Subject-matter anchor outside software.** A paper wall calendar hung by the front door with a pencil on a string: one column per day, a tick for every arrival, a circle round the one that did not belong. The paper ground, the pencil-ink ticks, the serif headings and the hairline grid all descend from it.

**Three references, with the property borrowed from each.**
1. *Aeon (the magazine's article pages)* — a serif display face against a humane sans text face on a warm light page. Borrowed: the pairing and the generous leading; not its layout or wordmark.
2. *Apple Health "Highlights"* — a plain-language sentence that states what changed before any chart. Borrowed: the lead sentence above the data (the week summary line).
3. *Fantastical's week strip* — the day columns as the primary object you navigate by. Borrowed: the week as seven named columns that double as navigation.

**Three anti-references.** (1) A network-video-recorder wall — black grid of live feeds with red recording dots. (2) A hospital telemetry console — clinical blue, dense alarm lists. (3) The generic dark "AI agent dashboard" — glowing gradients, neon accents, glass cards.

**The one thing a judge will remember.** The week is a paper calendar by the door: a column of pencil ticks per day, and the one tick that does not belong gets a pencil circle that draws itself.

## §2A Brandmark

**§2A.1 The idea.** The rhythm of one door: three pencil strokes of different heights standing under a door arch, on a threshold line — arrivals and departures as ticks, the arch as the doorway they belong to. (A mechanism, not an industry: the product's central claim is "a week has a shape; learn it".)

**§2A.2 The geometry (viewBox `0 0 32 32`, one stroke weight 2.5, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`, every stroke `currentColor`).** Three paths:
- Arch: `M5 23V14A11 11 0 0 1 27 14V23` — two vertical legs 22 units apart joined by a semicircle of radius 11 centred at (16, 14).
- Ticks: `M11 23V18M16 23V12M21 23V16` — three vertical strokes 5 units apart, heights 5, 11 and 7 (the middle tick is the tallest; none touches the arch: the gap between the tallest tick's top (y 12) and the arch's inner top (y 3) is 9 units; the gap between a leg and its nearest tick is 6 units, between ticks 5 units, so negative space stays open at 16 px).
- Threshold: `M3 29H29` — a horizontal stroke, 26 units wide, 6 units below the feet of the ticks.
The mark is optically centred with a 1.75-unit margin on all four sides (1.75 to 30.25 on both axes, stroke included). It contains no `<text>`, no gradient, no filter, no mask and no literal hex. Rendered at 16, 24, 32, 64 and 256 px in both themes during planning; at 16 px the arch, the three ticks and the threshold remain distinct.

**§2A.3 The wordmark.** `Doorstep Rhythm` — capital D, capital R, one space, no hyphen. Family `var(--font-display)` (Fraunces), weight 700, letter-spacing `-0.012em`, colour `--text`. Both words identical in weight and colour.

**§2A.3b The slogan.** `Know her day without calling.` (five words, sentence case, one full stop). Family `var(--font-text)`, weight 500, letter-spacing `0.01em`, colour `--text-muted`, set at 0.62 of the name's size (13.6 px under a 22 px name).

**§2A.3c The designer's device: one hairline** — a 1 px vertical rule in `--border-strong` between the mark and the text stack, as high as the stack. No other device in the lockup.

**§2A.4 Colour.** Mark colour is `--accent`. Header surface is `--bg-elevated`. Light: `#1B6A62` on `#FFFDF8` = **6.29:1**. Dark: `#5CC0B3` on `#1B2226` = **7.40:1**. Slogan `--text-muted` on `--bg-elevated`: **7.65:1** light, **6.26:1** dark. Hairline `--border-strong` on `--bg-elevated`: **4.32:1** light, **3.87:1** dark. Every graphical ratio is ≥ 3:1.

**§2A.5 Clear space and minimum sizes.** Clear space 0.5× the mark's rendered height on all four sides. Minimum mark: 16 px. Minimum full lockup: name at 16 px (slogan 9.9 px); below a 480 px viewport the app bar shows the mark alone (its `aria-label` is `Doorstep Rhythm`) and the slogan is not rendered.

**§2A.6 Lockup CSS (verbatim; one `font-size` scales everything).**

```css
.brandmark { display: inline-flex; align-items: center; gap: 0.5em; line-height: 1;
  color: var(--accent); white-space: nowrap; }
.brandmark__mark { width: 2.05em; height: 2.05em; flex: none; display: block; }
.brandmark__stack { display: flex; flex-direction: column; gap: 0.18em;
  padding-left: 0.5em; border-left: 1px solid var(--border-strong); }
.brandmark__word { font-family: var(--font-display); font-size: 1em; font-weight: 700;
  letter-spacing: -0.012em; color: var(--text); }
.brandmark__slogan { font-family: var(--font-text); font-size: 0.62em; font-weight: 500;
  letter-spacing: 0.01em; color: var(--text-muted); }
.brandmark--header { font-size: 22px; }
.brandmark--slide { font-size: 34px; }
.brandmark--cover { font-size: 64px; }
```

**§2A.7 `brand/mark.svg` (verbatim).**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" role="img" aria-label="Doorstep Rhythm mark">
  <path d="M5 23V14A11 11 0 0 1 27 14V23" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 23V18M16 23V12M21 23V16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 29H29" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**§2A.8 Placement.** The lockup is the first element of the app bar on every route in both themes (`.brandmark--header`); it is the favicon (`public/brand/mark.svg` referenced by `<link rel="icon" type="image/svg+xml">`, plus a 32 px PNG fallback exported by DP-UI WU-02); the cover carries the *mark alone* above the title block; slide 1 and slide 2 carry the small lockup (`.brandmark--slide`) in the **top-left** corner at the same size, over the flat slide background. The portable copies live at `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/mark.svg` and `../../hackathons/hackathon-projects/2026-10-amazonDevs/brand/brandmark.css` and are byte-identical to the entry copies.

## §2 Colour system

Two themes, designed separately: **light "paper"** (the video's theme) and **dark "dusk"**. The page never uses pure `#000` or `#FFF`. Dark mode lifts the accent and gets its elevation from lighter surfaces, not heavier shadows.

| Token | Light (paper) | Dark (dusk) | Usage | Contrast light | Contrast dark |
|---|---|---|---|---|---|
| `--bg` | `#F6F1E7` | `#12171A` | Page ground (the wall the calendar hangs on) | `--text` 14.86:1 | `--text` 14.92:1 |
| `--bg-elevated` | `#FFFDF8` | `#1B2226` | Cards, app bar, rail, workbench panels | `--text` on it 16.46:1 | `--text` on it 13.32:1 |
| `--bg-sunken` | `#EBE4D3` | `#0C1012` | Wells: activity feed, logs, code, the 3D stage ground | `--text` on it 13.20:1 | `--text` on it 15.80:1 |
| `--bg-overlay` | `#FFFEFB` | `#222B30` | Popovers, dialogs, toasts (elevation 2 and 3) | `--text` on it 16.59:1 | `--text` on it 11.92:1 |
| `--border` | `#D8CDB6` | `#2A343A` | Hairline around every surface (decorative, not the only cue) | decorative (never the only cue) | decorative (never the only cue) |
| `--border-strong` | `#857758` | `#6C7F8A` | Control borders, the lockup hairline, focus-adjacent edges (≥3:1) | on `--bg-elevated` 4.32:1 | on `--bg-elevated` 3.87:1 |
| `--pencil` | `#3D372D` | `#CFC8B8` | Event ticks, day numerals, calendar grid ink | on `--bg-elevated` 11.59:1 | on `--bg-elevated` 9.67:1 |
| `--text` | `#221D16` | `#EFE9DC` | Body and subject text | on `--bg` 14.86:1 | on `--bg` 14.92:1 |
| `--text-muted` | `#5B5142` | `#A8A190` | Support and eyebrow roles only | on `--bg` 6.91:1 | on `--bg` 7.02:1 |
| `--text-inverse` | `#FFFDF8` | `#12171A` | Label on a `--text`-filled chip (YOU badge) | on `--text` 16.46:1 | on `--text` 14.92:1 |
| `--accent` | `#1B6A62` | `#5CC0B3` | Primary action fill, active day, selected event, mark, links, focus ring | on `--bg-elevated` 6.29:1 | on `--bg-elevated` 7.40:1 |
| `--accent-hover` | `#145650` | `#7ED3C8` | Primary action hover fill | n/a (hover state of `--accent`) | n/a (hover state of `--accent`) |
| `--accent-contrast` | `#FFFDF8` | `#0C1012` | Label on an accent fill | on `--accent` 6.29:1 | on `--accent` 8.78:1 |
| `--success` | `#3B6A2B` | `#8CC274` | Resolved / approved glyph and word | on `--bg-success` 5.35:1 | on `--bg-success` 6.49:1 |
| `--warning` | `#8F4B00` | `#F0A24A` | Needs-a-look glyph and word; the pencil circle on the ribbon | on `--bg-warning` 5.45:1 | on `--bg-warning` 6.56:1 |
| `--danger` | `#A32D2A` | `#F08077` | Error glyph and word; unresolved check | on `--bg-danger` 5.44:1 | on `--bg-danger` 5.73:1 |
| `--degraded` | `#3F5E85` | `#8FB0DC` | Degraded-mode glyph and word; fallback rung; duplicate burst | on `--bg-degraded` 5.25:1 | on `--bg-degraded` 6.31:1 |
| `--bg-accent` | `#D9EAE6` | `#183B38` | Tint behind an accent state (selected row, AGENT badge) | `--accent` on it 5.13:1 | `--accent` on it 5.60:1 |
| `--bg-success` | `#E4EEDC` | `#1F3320` | Tint behind success | `--success` on it 5.35:1 | `--success` on it 6.49:1 |
| `--bg-warning` | `#F8E7CC` | `#3A2A12` | Tint behind warning | `--warning` on it 5.45:1 | `--warning` on it 6.56:1 |
| `--bg-danger` | `#F6DCD8` | `#3C1F1D` | Tint behind danger | `--danger` on it 5.44:1 | `--danger` on it 5.73:1 |
| `--bg-degraded` | `#DDE5F0` | `#1D2C42` | Tint behind degraded | `--degraded` on it 5.25:1 | `--degraded` on it 6.31:1 |
| `--chart-1` | `#0B6FA8` | `#56B4E9` | Series 1 (also: device `dev-door`) | on `--bg-elevated` 5.36:1 | on `--bg-elevated` 6.98:1 |
| `--chart-2` | `#B84F00` | `#F08A3C` | Series 2 (also: device `dev-elite` component 0) | on `--bg-elevated` 4.97:1 | on `--bg-elevated` 6.45:1 |
| `--chart-3` | `#00735A` | `#3FC9A0` | Series 3 (also: device `dev-elite` component 1) | on `--bg-elevated` 5.74:1 | on `--bg-elevated` 7.73:1 |
| `--chart-4` | `#9C4F7D` | `#E08FBF` | Series 4 | on `--bg-elevated` 5.40:1 | on `--bg-elevated` 6.79:1 |
| `--chart-5` | `#8A6A00` | `#E6C84A` | Series 5 | on `--bg-elevated` 4.99:1 | on `--bg-elevated` 9.76:1 |
| `--chart-6` | `#4B4B9C` | `#A6A6F2` | Series 6 | on `--bg-elevated` 7.42:1 | on `--bg-elevated` 7.18:1 |
Charts use an Okabe-Ito-derived sequence, darkened for the paper ground and lightened for dusk. Series are never separated by hue alone: every series also gets a marker shape (circle, square, triangle, diamond, cross, ring) and lines a dash pattern, which keeps the six distinguishable under deuteranopia.

Contrast pairs asserted by `DP-UI` WU-03 (`contrast: N pairs OK`, exit non-zero on any failure), each computed in both themes:

| Pair (text on surface) | Needs | Light | Dark | Used for |
|---|---|---|---|---|
| `--text` on `--bg` | 4.5:1 | 14.86 | 14.92 | body |
| `--text-muted` on `--bg` | 4.5:1 | 6.91 | 7.02 | support text |
| `--accent` on `--bg` | 4.5:1 | 5.68 | 8.29 | accent text and links |
| `--border-strong` on `--bg` | 3.0:1 | 3.91 | 4.33 | control borders, focus |
| `--text` on `--bg-elevated` | 4.5:1 | 16.46 | 13.32 | body |
| `--text-muted` on `--bg-elevated` | 4.5:1 | 7.65 | 6.26 | support text |
| `--accent` on `--bg-elevated` | 4.5:1 | 6.29 | 7.40 | accent text and links |
| `--border-strong` on `--bg-elevated` | 3.0:1 | 4.32 | 3.87 | control borders, focus |
| `--text` on `--bg-sunken` | 4.5:1 | 13.20 | 15.80 | body |
| `--text-muted` on `--bg-sunken` | 4.5:1 | 6.14 | 7.43 | support text |
| `--accent` on `--bg-sunken` | 4.5:1 | 5.04 | 8.78 | accent text and links |
| `--border-strong` on `--bg-sunken` | 3.0:1 | 3.47 | 4.59 | control borders, focus |
| `--text` on `--bg-overlay` | 4.5:1 | 16.59 | 11.92 | body |
| `--text-muted` on `--bg-overlay` | 4.5:1 | 7.71 | 5.61 | support text |
| `--accent` on `--bg-overlay` | 4.5:1 | 6.34 | 6.62 | accent text and links |
| `--border-strong` on `--bg-overlay` | 3.0:1 | 4.36 | 3.46 | control borders, focus |
| `--success` on `--bg-elevated` | 4.5:1 | 6.29 | 7.74 | success glyph and word on card |
| `--success` on `--bg-success` | 4.5:1 | 5.35 | 6.49 | success word on its tint |
| `--text` on `--bg-success` | 4.5:1 | 13.99 | 11.18 | body on success tint |
| `--warning` on `--bg-elevated` | 4.5:1 | 6.51 | 7.65 | warning glyph and word on card |
| `--warning` on `--bg-warning` | 4.5:1 | 5.45 | 6.56 | warning word on its tint |
| `--text` on `--bg-warning` | 4.5:1 | 13.78 | 11.42 | body on warning tint |
| `--danger` on `--bg-elevated` | 4.5:1 | 6.96 | 6.18 | danger glyph and word on card |
| `--danger` on `--bg-danger` | 4.5:1 | 5.44 | 5.73 | danger word on its tint |
| `--text` on `--bg-danger` | 4.5:1 | 12.86 | 12.35 | body on danger tint |
| `--degraded` on `--bg-elevated` | 4.5:1 | 6.56 | 7.22 | degraded glyph and word on card |
| `--degraded` on `--bg-degraded` | 4.5:1 | 5.25 | 6.31 | degraded word on its tint |
| `--text` on `--bg-degraded` | 4.5:1 | 13.18 | 11.64 | body on degraded tint |
| `--pencil` on `--bg-elevated` | 4.5:1 | 11.59 | 9.67 | event ticks and day numerals |
| `--accent` on `--bg-accent` | 4.5:1 | 5.13 | 5.60 | accent on accent tint |
| `--text` on `--bg-accent` | 4.5:1 | 13.43 | 10.08 | body on accent tint |
| `--accent-contrast` on `--accent` | 4.5:1 | 6.29 | 8.78 | primary button label |
| `--accent-contrast` on `--accent-hover` | 4.5:1 | 8.34 | 10.96 | primary button hover label |
| `--text-inverse` on `--text` | 4.5:1 | 16.46 | 14.92 | inverse chip |
| `--chart-1` on `--bg-elevated` | 3.0:1 | 5.36 | 6.98 | chart mark vs card |
| `--chart-2` on `--bg-elevated` | 3.0:1 | 4.97 | 6.45 | chart mark vs card |
| `--chart-3` on `--bg-elevated` | 3.0:1 | 5.74 | 7.73 | chart mark vs card |
| `--chart-4` on `--bg-elevated` | 3.0:1 | 5.40 | 6.79 | chart mark vs card |
| `--chart-5` on `--bg-elevated` | 3.0:1 | 4.99 | 9.76 | chart mark vs card |
| `--chart-6` on `--bg-elevated` | 3.0:1 | 7.42 | 7.18 | chart mark vs card |
**The complete token stylesheet, exactly as it appears in `src/ui/tokens/tokens.css`** (includes the type, spacing, radius, motion, layout and scene tokens of §3–§5 and §7):

```css
:root {
  /* typography — families */
  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-text: "Atkinson Hyperlegible Next", "Segoe UI", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  /* typography — sizes and line heights */
  --text-eyebrow: 12px;  --lh-eyebrow: 16px;
  --text-support: 14px;  --lh-support: 20px;
  --text-body: 18px;     --lh-body: 28px;
  --text-subject: 18px;  --lh-subject: 24px;
  --text-h3: 22px;       --lh-h3: 30px;
  --text-h2: 28px;       --lh-h2: 36px;
  --text-h1: 36px;       --lh-h1: 44px;
  --text-display: 56px;  --lh-display: 60px;
  --metric-md: 28px;     --metric-lg: 40px;   --metric-xl: 64px;
  --track-eyebrow: 0.07em;  --track-heading: -0.01em;  --track-metric: -0.02em;
  /* spacing scale */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  /* radius */
  --radius-control: 8px;  --radius-card: 14px;  --radius-dialog: 18px;  --radius-chip: 999px;
  /* motion */
  --dur-fast: 200ms;  --dur-base: 280ms;  --dur-slow: 400ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-inout: cubic-bezier(0.4, 0, 0.2, 1);
  /* layout */
  --rail-w: 208px;  --workbench-w: 360px;  --gutter: 16px;  --container-max: 1680px;
  --appbar-h: 64px;
  /* focus */
  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}
@media (min-width: 1440px) { :root { --rail-w: 240px; --workbench-w: 380px; --gutter: 24px; } }
@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 1ms; --dur-base: 1ms; --dur-slow: 1ms; } }

:root {   /* light "paper" */
  color-scheme: light;
  --bg: #F6F1E7;
  --bg-elevated: #FFFDF8;
  --bg-sunken: #EBE4D3;
  --bg-overlay: #FFFEFB;
  --border: #D8CDB6;
  --border-strong: #857758;
  --pencil: #3D372D;
  --text: #221D16;
  --text-muted: #5B5142;
  --text-inverse: #FFFDF8;
  --accent: #1B6A62;
  --accent-hover: #145650;
  --accent-contrast: #FFFDF8;
  --success: #3B6A2B;
  --warning: #8F4B00;
  --danger: #A32D2A;
  --degraded: #3F5E85;
  --bg-accent: #D9EAE6;
  --bg-success: #E4EEDC;
  --bg-warning: #F8E7CC;
  --bg-danger: #F6DCD8;
  --bg-degraded: #DDE5F0;
  --chart-1: #0B6FA8;
  --chart-2: #B84F00;
  --chart-3: #00735A;
  --chart-4: #9C4F7D;
  --chart-5: #8A6A00;
  --chart-6: #4B4B9C;
  --scene-bg: #EBE4D3;
  --scene-ground: #D8CDB6;
  --scene-accent: #1B6A62;
  --scene-text: #221D16;
  --scene-mat-wall: #FFFDF8;
  --scene-mat-door: #857758;
  --scene-mat-stoop: #D8CDB6;
  --scene-mat-frustum: #3F5E85;
  --scene-mat-pillar: #3D372D;
  --scene-mat-pillar-warn: #8F4B00;
  --scene-mat-pillar-danger: #A32D2A;
  --scene-mat-pillar-dup: #3F5E85;
  --scene-mat-gap: #857758;
  --scene-mat-resolved: #3B6A2B;
  --scene-mat-arc: #1B6A62;
  --elev-1: 0 1px 2px rgba(34,29,22,0.06);
  --elev-2: 0 4px 14px rgba(34,29,22,0.10), 0 1px 3px rgba(34,29,22,0.08);
  --elev-3: 0 18px 44px rgba(34,29,22,0.20), 0 2px 8px rgba(34,29,22,0.10);
}

[data-theme="dark"] {   /* dark "dusk" */
  color-scheme: dark;
  --bg: #12171A;
  --bg-elevated: #1B2226;
  --bg-sunken: #0C1012;
  --bg-overlay: #222B30;
  --border: #2A343A;
  --border-strong: #6C7F8A;
  --pencil: #CFC8B8;
  --text: #EFE9DC;
  --text-muted: #A8A190;
  --text-inverse: #12171A;
  --accent: #5CC0B3;
  --accent-hover: #7ED3C8;
  --accent-contrast: #0C1012;
  --success: #8CC274;
  --warning: #F0A24A;
  --danger: #F08077;
  --degraded: #8FB0DC;
  --bg-accent: #183B38;
  --bg-success: #1F3320;
  --bg-warning: #3A2A12;
  --bg-danger: #3C1F1D;
  --bg-degraded: #1D2C42;
  --chart-1: #56B4E9;
  --chart-2: #F08A3C;
  --chart-3: #3FC9A0;
  --chart-4: #E08FBF;
  --chart-5: #E6C84A;
  --chart-6: #A6A6F2;
  --scene-bg: #0C1012;
  --scene-ground: #2A343A;
  --scene-accent: #5CC0B3;
  --scene-text: #EFE9DC;
  --scene-mat-wall: #1B2226;
  --scene-mat-door: #6C7F8A;
  --scene-mat-stoop: #2A343A;
  --scene-mat-frustum: #8FB0DC;
  --scene-mat-pillar: #CFC8B8;
  --scene-mat-pillar-warn: #F0A24A;
  --scene-mat-pillar-danger: #F08077;
  --scene-mat-pillar-dup: #8FB0DC;
  --scene-mat-gap: #6C7F8A;
  --scene-mat-resolved: #8CC274;
  --scene-mat-arc: #5CC0B3;
  --elev-1: 0 1px 2px rgba(0,0,0,0.40);
  --elev-2: 0 6px 18px rgba(0,0,0,0.50);
  --elev-3: 0 20px 48px rgba(0,0,0,0.60);
}
```
**Scene tokens.** The `--scene-*` custom properties are literal copies of existing tokens (generated from the same table), so the 3D view can never introduce a colour the design system does not own. `DP-3D` reads them with `readTokensFromCss` and defines no colour of its own.

**Cinematic tokens.** `DP-UI` WU-03 writes `cinematic-tokens.json` at the entry root and a byte-identical copy at `../../hackathons/hackathon-projects/2026-10-amazonDevs/cinematic-tokens.json`. Contents (verbatim):

```json
{
  "version": "1.0.0",
  "product": "Doorstep Rhythm",
  "slogan": "Know her day without calling.",
  "video_theme": "paper",
  "themes": {
    "paper": {
      "bg": "#F6F1E7",
      "bg-elevated": "#FFFDF8",
      "bg-sunken": "#EBE4D3",
      "bg-overlay": "#FFFEFB",
      "border": "#D8CDB6",
      "border-strong": "#857758",
      "pencil": "#3D372D",
      "text": "#221D16",
      "text-muted": "#5B5142",
      "text-inverse": "#FFFDF8",
      "accent": "#1B6A62",
      "accent-hover": "#145650",
      "accent-contrast": "#FFFDF8",
      "success": "#3B6A2B",
      "warning": "#8F4B00",
      "danger": "#A32D2A",
      "degraded": "#3F5E85",
      "bg-accent": "#D9EAE6",
      "bg-success": "#E4EEDC",
      "bg-warning": "#F8E7CC",
      "bg-danger": "#F6DCD8",
      "bg-degraded": "#DDE5F0",
      "chart-1": "#0B6FA8",
      "chart-2": "#B84F00",
      "chart-3": "#00735A",
      "chart-4": "#9C4F7D",
      "chart-5": "#8A6A00",
      "chart-6": "#4B4B9C"
    },
    "dusk": {
      "bg": "#12171A",
      "bg-elevated": "#1B2226",
      "bg-sunken": "#0C1012",
      "bg-overlay": "#222B30",
      "border": "#2A343A",
      "border-strong": "#6C7F8A",
      "pencil": "#CFC8B8",
      "text": "#EFE9DC",
      "text-muted": "#A8A190",
      "text-inverse": "#12171A",
      "accent": "#5CC0B3",
      "accent-hover": "#7ED3C8",
      "accent-contrast": "#0C1012",
      "success": "#8CC274",
      "warning": "#F0A24A",
      "danger": "#F08077",
      "degraded": "#8FB0DC",
      "bg-accent": "#183B38",
      "bg-success": "#1F3320",
      "bg-warning": "#3A2A12",
      "bg-danger": "#3C1F1D",
      "bg-degraded": "#1D2C42",
      "chart-1": "#56B4E9",
      "chart-2": "#F08A3C",
      "chart-3": "#3FC9A0",
      "chart-4": "#E08FBF",
      "chart-5": "#E6C84A",
      "chart-6": "#A6A6F2"
    }
  },
  "fonts": {
    "display": "Fraunces",
    "text": "Atkinson Hyperlegible Next",
    "mono": "JetBrains Mono"
  },
  "motion": {
    "fast_ms": 200,
    "base_ms": 280,
    "slow_ms": 400,
    "ease_out": "cubic-bezier(0.2, 0, 0, 1)"
  },
  "radius": {
    "control": 8,
    "card": 14,
    "dialog": 18
  }
}
```
## §3 Typography

Two families plus one mono, all **self-hosted variable `woff2`** (SIL OFL), copied by `DP-UI` WU-03 from the pinned fontsource packages: `@fontsource-variable/fraunces@5.3.0`, `@fontsource-variable/atkinson-hyperlegible-next@5.3.0`, `@fontsource-variable/jetbrains-mono@5.3.0` (files `files/<name>-latin-wght-normal.woff2`) into `public/fonts/`.

| Role | Family | Why |
|---|---|---|
| Display / headings | **Fraunces** (variable, wght 100–900) | The magazine-and-almanac voice; used for words only — Fraunces has no tabular figures, so it never sets a number that updates |
| Text, controls, **all numerals and metrics** | **Atkinson Hyperlegible Next** (variable, wght 200–800) | Designed for legibility at a glance; verified at plan time to carry the `tnum` feature, so live numbers align |
| Identifiers, ids, request ids, trace lines | **JetBrains Mono** (variable, wght 100–800) | Third role, used only for identifiers and code wells |

**`@font-face` lines (verbatim, in `src/ui/tokens/fonts.css`):**

```css
@font-face { font-family: "Fraunces"; src: url("/fonts/fraunces-latin-wght-normal.woff2") format("woff2");
  font-weight: 100 900; font-style: normal; font-display: swap; }
@font-face { font-family: "Atkinson Hyperlegible Next"; src: url("/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2") format("woff2");
  font-weight: 200 800; font-style: normal; font-display: swap; }
@font-face { font-family: "JetBrains Mono"; src: url("/fonts/jetbrains-mono-latin-wght-normal.woff2") format("woff2");
  font-weight: 100 800; font-style: normal; font-display: swap; }
```

`index.html` `<head>` preloads the first two files (`<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/…">`). The fallback stacks (`Georgia`; `Segoe UI`/`system-ui`) are metrically close enough that the swap does not reflow the 1280×720 layout. Body rule: `body { font-family: var(--font-text); font-size: var(--text-body); line-height: var(--lh-body); font-feature-settings: "tnum" 1; }` is **not** applied globally — `tnum` is applied by the metric and by any element with `data-metric` or class `tnum` (`font-variant-numeric: tabular-nums`).

**Type scale (literal):**

| Role | Token / size | Line height | Weight | Tracking | Family | Colour | Used for |
|---|---|---|---|---|---|---|---|
| display | `--text-display` 56 px | 60 px | 700 | `-0.01em` | Fraunces | `--text` | empty-state headline, explainer title |
| h1 | `--text-h1` 36 px | 44 px | 650 | `-0.01em` | Fraunces | `--text` | page title "The week of 12 October" |
| h2 | `--text-h2` 28 px | 36 px | 650 | `-0.01em` | Fraunces | `--text` | incident headline |
| h3 | `--text-h3` 22 px | 30 px | 650 | `-0.01em` | Fraunces | `--text` | surface titles |
| body | `--text-body` 18 px | 28 px | 400 | 0 | Atkinson | `--text` | paragraphs, lead sentence, list items |
| **subject** | `--text-subject` 18 px | 24 px | 650 | `-0.01em` | Atkinson | `--text` | the value or name in a group |
| **support** | `--text-support` 14 px | 20 px | 400 | 0 | Atkinson | `--text-muted` | qualifier, time, source, unit |
| **eyebrow** | `--text-eyebrow` 12 px | 16 px | 700 | `+0.07em`, uppercase | Atkinson | `--text-muted` | what this thing is |
| control | 16 px | 24 px | 600 | 0 | Atkinson | `--text` | buttons, inputs, switches |
| primary control | 18 px | 24 px | 650 | 0 | Atkinson | `--accent-contrast` | the one filled primary per region |
| mono | 14 px | 20 px | 400 | 0 | JetBrains Mono | `--text` | ids, request ids, code wells |
| **metric-md** | `--metric-md` 28 px | 1.05 | 700 | `-0.02em` | Atkinson, `tnum` | `--text` | per-device and per-day counts |
| **metric-lg** | `--metric-lg` 40 px | 1.05 | 700 | `-0.02em` | Atkinson, `tnum` | `--text` | dwell minutes in the incident card |
| **metric-xl** | `--metric-xl` 64 px | 1.05 | 700 | `-0.02em` | Atkinson, `tnum` | `--text` (accent when 0) | the hero metric: open checks |

**Camera rule inside `[data-demo-focus]`:** any string the camera must read is body size (18 px) or larger; eyebrow and support text never carry the only copy of a fact. Numerals the camera reads are ≥ 28 px; the hero metric is 64 px.

**Digit budgets.** Hero metric (open checks): budget `99` plus a unit word — at 64 px Atkinson tabular figures a 3-digit value is ≈ 120 px, inside the 164 px minimum metric cell; ≥ 100 shows `99+` with the exact value in `title`. Dwell minutes: budget `999` (`999 min`); counts above 9 999 abbreviate (`12.8k`). Tokens/cost: `$0.0000`–`$99.9999`. Clock times are `HH:MM` (24-hour, tabular).

## §4 Spacing, radius, elevation, borders

**Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px = `--space-1…--space-8`. Rules: gap between a label and its value 4 px; between lines inside a group 8 px; between groups inside a surface 16 px; surface padding 24 px (never below 16 px); between surfaces 16 px at < 1440 px and 24 px at ≥ 1440 px (`--gutter`); between page sections 32 px. No other spacing number appears.

**Radius:** `--radius-control` 8 px (buttons, inputs, chips' containers), `--radius-card` 14 px (every surface), `--radius-dialog` 18 px (dialogs, popovers), `--radius-chip` 999 px (chips, badges, the switch track).

**Elevation — three steps, named (literal values are the `--elev-*` tokens in §2):**

| Step | Token | Use | Light | Dark |
|---|---|---|---|---|
| 1 rest | `--elev-1` | every resting surface | `0 1px 2px rgba(34,29,22,0.06)` + 1 px `--border` | `0 1px 2px rgba(0,0,0,0.40)` + 1 px `--border`, surface `--bg-elevated` |
| 2 float | `--elev-2` | popovers, sticky approval bar, toasts, dropdowns | `0 4px 14px rgba(34,29,22,0.10), 0 1px 3px rgba(34,29,22,0.08)` on `--bg-overlay` | `0 6px 18px rgba(0,0,0,0.50)` on `--bg-overlay` (lighter than `--bg-elevated`) |
| 3 modal | `--elev-3` | dialogs (explainer panel), the Connect dialog | `0 18px 44px rgba(34,29,22,0.20), 0 2px 8px rgba(34,29,22,0.10)` | `0 20px 48px rgba(0,0,0,0.60)` on `--bg-overlay` |

**Surface recipe — every card obeys it (`[data-surface]`, verbatim):**

```css
[data-surface] { background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-card); padding: var(--space-5); box-shadow: var(--elev-1);
  min-width: 0; }
[data-surface] > header { display: flex; align-items: center; gap: var(--space-2);
  padding-bottom: var(--space-3); margin-bottom: var(--space-4); border-bottom: 1px solid var(--border); }
[data-surface][data-well] { background: var(--bg-sunken); border-radius: var(--radius-control);
  padding: var(--space-4); box-shadow: none; }                /* nested wells: bg-sunken inside bg-elevated, border kept */
[data-surface][data-elevation="2"] { background: var(--bg-overlay); box-shadow: var(--elev-2); }
[data-surface][data-elevation="3"] { background: var(--bg-overlay); box-shadow: var(--elev-3);
  border-radius: var(--radius-dialog); }
/* THE ONE DEVICE: a 3 px accent rule on the leading edge of the primary panel — at most one per column */
[data-surface][data-emphasis="primary"] { border-left: 3px solid var(--accent); }
```

A card never sits on a card of the same token; nested wells step to `--bg-sunken`; two cards never touch (a `--space-4` or `--space-5` gap). Titled surfaces use a header row: eyebrow above subject/h3, divider below.

**Calendar grid hairlines (the ribbon only):** 1 px `--border`, `--pencil` ticks 2 px thick with round caps.

## §5 Motion

All durations come from `--dur-fast` 200 ms, `--dur-base` 280 ms, `--dur-slow` 400 ms; easings `--ease-out` `cubic-bezier(0.2, 0, 0, 1)` and `--ease-inout` `cubic-bezier(0.4, 0, 0.2, 1)`. Motion is reserved for state change; nothing animates on load except the section enter. Under `prefers-reduced-motion: reduce` the three duration tokens become 1 ms (so every transition below collapses to an instant change) and the loops in the work indicator become static.

| Name | What moves | Trigger | Duration / easing | Reduced-motion substitute |
|---|---|---|---|---|
| `section-enter` | opacity 0→1, translateY 8px→0 on a route's surfaces | route change | 280 ms `--ease-out`, 40 ms stagger (max 4 children) | instant |
| `feed-in` | a new activity row: height 0→auto (via grid-rows 0fr→1fr), opacity 0→1 | trace entry appended (`li.feed-in`) | 280 ms `--ease-out` | instant |
| `changed-flash` | background tint `--bg-accent` → transparent behind the changed entity (kit `ChangedFlash` class `changed-flash`) | store entity changed | 400 ms `--ease-inout` (the kit holds the class for 900 ms; the CSS animation is 400 ms) | instant, tint held 900 ms |
| `count-up` | metric value tweens from previous to next | metric value changes | 360 ms `--ease-out` (JS tween, integers only) | instant |
| `pencil-circle` | SVG circle `stroke-dashoffset` from full length → 0 around an incident cluster | incident opened or selected | 360 ms `--ease-out` | full circle, no draw |
| `tick-in` | a new event tick scales Y 0→1 from its baseline | event ingested | 240 ms `--ease-out` (within 200–400 ms) | instant |
| `work-indicator` | three pencil ticks pulse in sequence | an action or model call in flight > 400 ms | 1200 ms loop (ambient, allowed) | static three ticks and the text |
| `success-confirm` | border-colour and tint flash to `--success`/`--bg-success` then settle | approval accepted, check at 0 | 400 ms `--ease-inout` | tint held 400 ms |
| `error-flash` | border-colour and tint flash to `--danger`/`--bg-danger` then settle (no shake) | action failed | 360 ms `--ease-inout` | tint held 360 ms |
| `theme-fade` | `background-color`, `color`, `border-color` on `body` and surfaces | theme toggle | 240 ms `--ease-inout` | instant |
| `dialog-enter` | dialog opacity 0→1 and scale 0.98→1; backdrop opacity 0→0.5 | explainer / connect dialog | 280 ms `--ease-out` | instant |
| `popover-enter` | opacity 0→1 and translateY 4px→0 | `?` popover | 200 ms `--ease-out` | instant |
| `scene-rise` | 3D pillar height 0→h and camera shot transition | store change / shot call | the scene reads `--dur-slow` for pillars and 800 ms for shot moves (the 3D contract's 600–1200 ms) | instant cut |

## §6 Component specs

**§6.0 The interactive-state recipe (every control).** Default: 1 px `--border-strong` border, transparent background, `--text` label, `--radius-control`, min-height 40 px (44 px at ≤ 1024 px). Hover: background `--bg-sunken`. Focus-visible: `box-shadow: var(--focus-ring)` (never `outline: none` without it). Active: `transform: translateY(1px)`. Disabled: `--text-muted` label on `--bg-sunken`, `aria-disabled="true"`, `cursor: not-allowed`. Loading: the label stays, a 14 px spinner glyph (three ticks) replaces the leading icon, `aria-busy="true"`. **Primary** (one per region): `--accent` fill, `--accent-contrast` label at 18/650, hover `--accent-hover`, border none. **Ghost**: no border, `--text` label, hover `--bg-sunken`. **Danger**: border and label `--danger`, hover fill `--bg-danger`. Icons are `lucide-react` 18 px, stroke 2, `aria-hidden` unless icon-only (then `aria-label` is mandatory).

**§6.1 AppBar** — purpose: identity and the three global controls. Anatomy: `header` height 64 px, `--bg-elevated`, bottom border 1 px `--border`, content inset to the page grid. Left to right: **Brandmark lockup** (`.brandmark--header`), **"How this works"** (ghost button with a `CircleHelp` icon, `data-app-explainer`), spacer, **Ring status chip**, **Agent status chip**, and — below 1024 px only — the **ThemeToggle**. Below 480 px the lockup collapses to the mark. Roles: chips are eyebrow (label) + subject (value). States: default only; chips show the degraded tint (§9A) when not on the top rung. Motion: `theme-fade`.

**§6.2 ThemeToggle** — placement: the **rail footer at ≥ 1024 px** (the rail is sticky to the viewport bottom, so the toggle is always visible without scrolling or opening a menu; it sits there because it is a quiet setting belonging with the household preferences), and in the app bar's right cluster below 1024 px where the rail becomes a drawer. Anatomy: a two-segment control "Paper" / "Dusk" (`role="radiogroup"`, each segment a `button role="radio"` with `aria-checked`), icons `Sun` and `Moon`. Persists to `localStorage` key `dr-theme` (`"light"` or `"dark"`); first load honours `prefers-color-scheme` through an inline script in `index.html` that sets `document.documentElement.dataset.theme` before first paint. States: selected segment `--bg-accent` fill, `--accent` label and a 2 px `--accent` bottom rule; focus ring per §6.0. Motion: `theme-fade`.

**§6.3 Surface** — §4 recipe; component `Surface({ title?, eyebrow?, emphasis?, elevation?, well?, help?, children })` renders `[data-surface]`, an optional `header` (eyebrow above the title, `HelpTip` at the end), and sets `data-result-region="<id>"` when it renders a result.

**§6.4 Metric** — `Metric({ label, value, unit?, support?, size, tone? })`. Anatomy (three roles): `eyebrow` label; value at `--metric-md|lg|xl`, weight 700, `font-variant-numeric: tabular-nums`, `white-space: nowrap`; unit as a separate muted 14/500 element; optional `support`. Paired values use `<span class="metric__sep">/</span>`. Class names: `.metric`, `.metric__value`, `.metric__unit`, `.metric__sep`; `data-metric` on the value. Abbreviate past 10 000 (`12.8k`), exact value in `title`. The hero metric's colour is `--accent` when the value is 0, `--warning` when > 0 and ≤ 5 errors-and-warnings, `--danger` when the check has errors. States: default; loading (value replaced by three muted ticks, same box so the layout does not jump); empty (`—`); error (value `—` plus an inline callout in the owning surface). Motion: `count-up`.

```css
.metric{display:flex;flex-direction:column;gap:var(--space-1);min-width:0}
.metric__value{font-family:var(--font-text);font-variant-numeric:tabular-nums;white-space:nowrap;
  font-size:var(--metric-lg);font-weight:700;letter-spacing:var(--track-metric);line-height:1.05;color:var(--text)}
.metric__value--xl{font-size:var(--metric-xl)} .metric__value--md{font-size:var(--metric-md)}
.metric__sep{color:var(--text-muted);font-weight:400;padding:0 0.25em}
.metric__unit{font-size:var(--text-support);font-weight:500;letter-spacing:0;color:var(--text-muted);margin-left:var(--space-2)}
```

**§6.5 HelpTip (`?`)** — a 20 px circular glyph inside a 44 px touch target (32 px visual button at ≥ 1024), `--text-muted`, `--accent` on hover and focus, placed at the end of a surface header. Click-activated popover (`role="dialog"`, `data-elevation="2"`, max-width 320 px, support-size copy), closes on `Esc`, on outside click and on a second press. `aria-label` is the subject-naming string from §6A (never "Help"). `data-help-for="<region id>"`. States: default, hover, focus-visible, open. Motion: `popover-enter`.

**§6.6 WorkIndicator** — three pencil ticks (the brand's own shape) pulsing, plus a text line from the live step: `{label}` from the phase table in §9 (fallback sentence "Working on the week"). It lives **inside the surface that owns the work** (the Agent panel header while a review runs; the Check panel while the check runs), `role="status"`, `aria-live="polite"`. Motion: `work-indicator`.

**§6.7 System messages (three tiers, craft §5)** — *Banner*: directly beneath the app bar, full-bleed tint background, content inset to the page grid (same left edge as the main column), anatomy: glyph (shape, 20 px) + subject-weight title + support-role detail (a sentence or a `dl` of "step → what happened") + optional single action button; `role="status"` (or `role="alert"` for errors); tint/border/glyph per tone (§9A). *Callout*: inside the owning surface above its body, same anatomy, `--radius-control`, 3 px left rule in the tone colour. *Toast*: bottom-right, `data-elevation="2"`, auto-dismiss 4 s, `role="status"`, never the only carrier of information. Tones: info (accent), success, warning, danger, degraded — glyphs `Info`, `CircleCheck`, `TriangleAlert`, `OctagonX`, `Layers`. All copy is a total template (§9).

**§6.8 Badge / chip** — `SourceBadge`: eyebrow type, `--radius-chip`, 1 px border; AGENT = `--bg-accent` fill, `--accent` text and border; YOU = `--text` fill, `--text-inverse` text; SYSTEM = `--bg-sunken` fill, `--text-muted` text, `--border-strong` border. `StatusChip`: tone tint + border + glyph + word (needs a look / resolved / failed / degraded / simulated). `SyntheticBadge`: the words "Sample week · synthetic" in `--bg-sunken` with `--border-strong`, shown on the household card and beside the page title whenever `ring.mode === "bundle"`.

**§6.9 Rail** (240 px at ≥ 1440, 208 px at 1280–1439, drawer below 1024 px; `--bg` ground, no outer card; sticky; the theme toggle is its footer). Surfaces, top to bottom:
- *HouseholdCard*: eyebrow "Household", subject "Rosa Alvarez · 84" (display name from `WeekModel.household`), support "Front door and hall camera", the `SyntheticBadge`.
- *DeviceList*: two rows (doorbell, hall camera); each row = state chip (online / offline word + glyph), subject name, support "2 cameras" for the Elite device; the offline row gets `--bg-danger` + `--danger` left rule only when truly offline.
- *QuietHoursEditor* (`data-result-region="quiet-hours"`, with `HelpTip`): eyebrow "Quiet hours", subject "22:00–07:00", support "±30 min margin"; two `input type="time"` controls and a margin stepper; changes dispatch `set_quiet_hours`; shows the effective window as support text ("Checks from 22:30 to 06:30").
- *ConsentList* (`data-result-region="consent"`): three rows with `role="switch"` controls — "Family messages", "Chime announcements", "Weekly brief"; each row: subject label, support line saying who it reaches ("Marta by message", "Spoken on the hall chime", "Marta, Sunday evening"), switch; switching on dispatches `set_consent` with `actor: "human"`; the agent can never do it.
- *ConnectPanel*: primary-less ghost button "Connect Ring" opening the Connect dialog (paste a Playground token; shows "Token expires in {m} min" afterwards); disabled-state copy "Using the sample week".
- *WebhookInboxPill*: eyebrow "Webhooks", metric-md count, support "waiting"; a "Simulate a doorbell press" ghost button appears only when the server reports `simulate: true`.
- *ThemeToggle* (footer).

**§6.10 Main column** (flex, min 560 px), top to bottom:
- *WeekTitle*: h1 "The week of 12 October" (date computed from the model; template total), support line "Rosa's front door · {sourceLabel}" with the `SyntheticBadge` when applicable.
- *WeekSummary* (`data-result-region="open-checks"`, `HelpTip`): left, the **hero Metric** (`xl`, label "Open checks", unit "to look at" or "all clear"); right, the **lead sentence** in body size (Apple-Health-Highlights borrowing), composed by a total template from the check counts: `0` → "All clear — the week matched the usual rhythm."; `n` → "{n} moment(s) broke the usual rhythm. Start with the first circled day." (singular/plural branch).
- *SceneStage* (`DP-3D` renders here): a `[data-surface][data-well]` of fixed aspect 16:5 (min-height 240 px at 1280, 300 px at ≥ 1440), carries `data-demo-3d`, `data-result-region="scene-3d"`, `HelpTip`, and a toolbar of three shot buttons (Overview, Focus, Walk) — ghost buttons, `aria-pressed`.
- *WeekRibbon* (`data-result-region="week-ribbon"`, `HelpTip`): the paper calendar — see §6.11.

**§6.11 WeekRibbon (the memorable object).** Seven day columns Mon–Sun, each a button (`aria-label="Tuesday 13 October, 3 events, 1 moment to look at"`; selecting dispatches `set_ui` and the day gets a 2 px `--accent` bottom rule and `--bg-accent` header band). Column header: eyebrow weekday (`MON`), subject day number (tabular, `--pencil`). Column body: height 200 px at 1280 (240 px at ≥ 1440), time axis top = 00:00, bottom = 24:00; hour hairlines every 6 hours (`--border`); **quiet-hours bands** (`--bg-sunken` fill, 0–06:30 and 22:30–24:00 for the effective window); **event ticks** — 2 px `--pencil` horizontal strokes 14 px wide at the event's time; **visits** — 6 px wide `--pencil` vertical bars spanning arrival→departure; **duplicate marks** — a tick drawn in `--degraded` and doubled (appears only before repair); **outage band** — diagonal hatch (`repeating-linear-gradient(135deg, var(--degraded) 0 2px, transparent 2px 6px)`) at 40 % opacity over the offline interval, labelled with the duration in support text ("47 min offline"); **webhook/history seam** — a 1 px dashed `--degraded` line at the instant the history poll took over, with an eyebrow label "from history". **Incident circle** — an SVG ellipse in `--warning` (error: `--danger`; resolved: `--success`) 2.5 px stroke, drawn around the incident's cluster, `pencil-circle` motion, a 44 px target that selects the incident. Row below the columns: baseline strip — support text "Usual: visits under {p90} min; busiest {hour}". States: default; day selected; loading (columns show three muted ticks); empty (columns blank with the empty-state surface below); error (callout above the grid); degraded (outage hatch and seam are the degraded indicators). Digit rule: counts ≤ 99 per day column.

**§6.12 Workbench** (360 px at 1280–1439, 380 px at ≥ 1440; carries the route's single `data-demo-focus="workbench"` on its container; stacks, `--space-4` between):
- *AgentPanel* (`data-surface`, `data-emphasis="primary"` — the one accent-rule surface in this column): header = eyebrow "Agent" + subject provider label ("Amazon Bedrock · {modelLabel}") + `HelpTip` (`agent-status`); body = the **primary button "Review the week"** (18/650, full width), the `WorkIndicator` line while running, and, below, the phase list (7 phase names, the current one in `--accent` with a filled tick, finished ones with a check glyph — each phase also has its word, so colour is never the only cue).
- *CheckPanel* (`data-result-region="check-panel"`): header eyebrow "Checks" + count badge (`errors + warnings`, tabular) + `HelpTip`; body = `IssueRow`s — each row: state chip (Error / Warning with glyph), subject = the issue message with units ("2 duplicate events within 38 s at the front door"), support = rule name in plain words ("Duplicate events") and the day/time; a row with `fix` shows a ghost button "Merge duplicates" (runs the fix action as `source: "human"`); tinted row background (`--bg-danger` / `--bg-warning`) + left rule; when the list is empty, the template "No open checks — the last run found nothing to fix."
- *IncidentCard* (`data-result-region="incident-card"`): eyebrow = day and time ("TUE 13 OCT · 02:14"), h2 headline (narrator's one-line title), body (≤ 3 lines, clamped with Show more), a support line with the facts (duration `Metric md` "22 min", "usual under 6 min", "quiet hours"), the evidence snapshot (aspect 16:9, `--bg-sunken` well, caption "Snapshot · hall camera · {time}" — or the callout "No snapshot for this moment" ), notes list, status chip, and the actions "Mark as explained", "Dismiss" (ghost). `ChangedFlash` wraps it.
- *NudgeCard* (`data-result-region="nudge-card"`): eyebrow "Suggested message", subject the proposed text (clamped), support "To Marta · family messages {on|off}", actions "Approve" (primary) / "Reject" (ghost) which dispatch `decide_nudge` as `source: "human"`.
- *ApprovalBar* (kit `ApprovalBar` in a wrapper `[data-surface][data-elevation="2"]`, `data-result-region="approval-bar"`, sticky to the bottom of the workbench while a request is pending): the kit's "AGENT WANTS TO {summary}" line at subject weight in a `--bg-warning` band with a `ShieldQuestion` glyph, **Approve** (primary) and **Reject** (danger-ghost) buttons side by side, the "Require approval" checkbox restyled as a switch in the surface footer. When nothing is pending the wrapper collapses to the footer row (support text "Nothing is waiting for you.").
- *ActivityFeedPanel* (`data-result-region="activity-feed"`, flex-fill): `[data-surface][data-well]` containing the kit's `ActivityFeed` fed by a **friendly trace view** (`createFriendlyTrace`, DP-UI): action names replaced by their descriptor titles, role names by "Reader / Planner / Agent / Writer", `state_change` and `truth` folded into the sentence. Row anatomy by descendant selectors on the kit markup (`li > span:first-child` = source badge in eyebrow type with a 1 px border; `li > strong` = subject; remaining `span` = support): grid `auto 1fr`, 8 px gap, rows separated by 1 px `--border`, 56 px max height clamp with Show more. Newest at the bottom; the well scrolls (`max-height` fills the column; `overflow: auto`). Motion `feed-in`, `changed-flash`.
- *ManualRunner* (kit `ManualRunner` in a `<details>` surface titled "Run an action by hand", closed by default; the field labels come from the schema; result line in support type; `data-result-region="manual-runner"` is **not** set because it shows no verdict).
- *LiveViewPanel* (`data-result-region="live-view"`): shown only after "Live view" is pressed in the incident card or the device row; a `<video>` in a 16:9 `--bg-sunken` well, an eyebrow "Live · hall camera", a countdown metric-md "{n} s left", ghost "Close" button. Auto-closes at 30 s (battery) / 60 s (line-powered), per `RingStatus`.

**§6.13 Dialogs.** *ExplainerPanel* (`data-app-explainer-panel`, §6A copy; `data-surface data-elevation="3"`, max-width 640 px, scrolls past 90 vh, `role="dialog" aria-modal="true"`, traps focus, closes on `Esc` and backdrop). *ConnectDialog* (paste a Playground token into a mono `input`, "Use this token" primary, "Cancel" ghost; helper text "The token stays in this tab's memory and is never written to a file."). Motion `dialog-enter`.

**§6.14 EmptyState** — a `[data-surface]` with a display-size headline, body sentence and the one primary action; includes a single 120 px pencil-circle motif (SVG, `--border-strong` stroke, the only decoration, confined to empty states).

## §6A Help content (`src/ui/help/helpContent.ts`, one module, keyed by region id)

| Region id | `aria-label` of the `?` | Popover copy |
|---|---|---|
| `week-ribbon` | What is the week calendar? | One column per day, from midnight at the top to midnight at the bottom. Each pencil tick is something at the door; a circle means the usual rhythm broke there. Shaded bands are quiet hours. |
| `open-checks` | What does the open checks number mean? | How many things the checker still wants a person to look at, counting errors and warnings from the latest check. A calm week reads 0. |
| `check-panel` | What is the check panel? | A fixed set of rules runs over the week every time anything changes: quiet hours, long visits, a device that went quiet, consent and duplicate events. Each line says what it found, in minutes. |
| `incident-card` | What is an incident? | A moment that broke the usual rhythm, written up in plain words. The agent drafts it, a person reads it, and nothing leaves this app until a person says so. |
| `nudge-card` | What is a suggested message? | A short note the agent proposes to send. It stays a suggestion until you approve it, and only reaches channels you have switched on. |
| `activity-feed` | What is the activity feed? | Every step in order: who did it (AGENT, YOU or SYSTEM), what it was and whether it worked. The same list is saved as the run trace. |
| `approval-bar` | What is the approval bar? | Anything that reaches outside this app waits here until you press Approve or Reject. If you reject, the agent is told and asks what to do instead. |
| `baseline` | What is the usual rhythm? | The household's own normal, learned from the earlier days: how long visits usually last and when the door is busy. Each day is compared with it. |
| `scene-3d` | What is the doorway view? | The same week drawn as a doorway with a column for each day. Pillars mark events and rise as new ones arrive. Pick one to see it in the calendar. |
| `live-view` | What is live view? | A short look through the camera, opened only when you press the button and closed by itself after 30 seconds. |
| `ring-status` | What does the Ring status show? | Whether this page is reading the sample week or a real Ring account, and how long a pasted token has left. |
| `agent-status` | What does the agent status show? | Which model is doing the thinking right now and how much of the demo budget is used. If it falls back to another model, this says so. |
| `consent` | What are the consent switches? | Each outgoing channel is off until a person turns it on here. The agent cannot switch these on. |
| `quiet-hours` | What are quiet hours? | The hours when activity at the door is unusual for this house. They start as 10 pm to 7 am with a 30-minute margin on each side. |

**Primary explainer panel copy (verbatim).**
- Title (display): **How Doorstep Rhythm works**
- *What it does:* Doorstep Rhythm turns a doorway's comings and goings into a calm week you can read at a glance, and points out only the moments that broke the household's usual rhythm.
- *Who it is for:* Someone who lives far from a parent who lives alone. A daily check-in call can feel like surveillance; the doorway can answer the same question without a call.
- *How it flows:* 1. Events from the Ring doorbell and camera arrive and are placed on the week. 2. An agent reads the week, opens an incident for each broken rhythm and runs the checker. 3. It fixes what the checker finds, then explains each incident in plain words. 4. Anything that would leave the app, such as a message or a chime, waits for your approval.
- *How to read it:* Ticks are events. A pencil circle is a moment worth a look. The number at the top is how many checks are still open; the goal is zero.
- *Try it:* primary button **Review the sample week** (loads the sample week if needed and starts the review).

## §7 Layout

**Grid.** One container, `max-width: var(--container-max)` (1680 px), centred, side padding `--gutter`; three columns `var(--rail-w) minmax(0, 1fr) var(--workbench-w)` with `--gutter` gaps. Every banner, card and header shares the same left edge as its column.

| Width | Behaviour |
|---|---|
| **≥ 1440 px** (the judge's screen) | rail 240, main flexible, workbench 380; gutters 24; ribbon columns 240 px tall; scene stage 300 px min height |
| **1280×720** (the recording viewport) | rail 208, main ≈ 656, workbench 360; gutters 16; ribbon columns 200 px tall; scene stage 240 px min height; the route's single demo focus is the workbench |
| **1024 px** | rail becomes a left drawer opened by a "Household" ghost button in the app bar; main and workbench two columns (workbench 340); the ThemeToggle moves into the app bar |
| **390 px** | single column in this order: title, summary, ribbon (horizontally scrollable columns, 72 px each, snap), scene stage (16:9), Agent panel, Check panel, incident card, nudge card, activity feed; the primary "Review the week" button is sticky to the bottom; the rail is a drawer; the app bar shows the mark alone |

**Which region carries the memorable idea:** the WeekRibbon, directly under the 3D stage, with the hero metric above it; the camera's focus on `/` is the workbench (where the agent's work is visible), the 3D stage carries `data-demo-3d`.

**Routes.** `/` — the full product. `/watch` — a replay of the saved run (owned by DP-SHOWCASE; same shell, a labelled "Replay" banner, its own single `data-demo-focus="replay"`). `/lab` — the 3D tuning page (owned by DP-3D; its own single `data-demo-focus="lab"`).

**Quiet frame per route.** `/`: the state after a finished review with all checks at 0, no toast, no running indicator, no pending approval. `/watch`: the replay paused at its end. `/lab`: the scene idle with the panel closed.

## §8 Library stack

| Package | Pinned version | Used for | If it fails to load |
|---|---|---|---|
| `react`, `react-dom` | 19.3.0 | UI | n/a (required) |
| `vite` | ^8.3.2 (already ^8.2.2 in the repo; kept) | dev server and build | n/a |
| `@vitejs/plugin-react` | 6.1.2 | JSX | n/a |
| `react-router` | 8.4.0 | routes `/`, `/watch`, `/lab` | n/a |
| `lucide-react` | 1.52.0 | 18 px icons (tree-shaken) | glyphs absent; every control keeps its text label or `aria-label` |
| `@fontsource-variable/fraunces`, `…/atkinson-hyperlegible-next`, `…/jetbrains-mono` | 5.3.0 each (dev dependencies; files copied to `public/fonts/`) | typefaces | fallback stacks of §3 |
| `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, `leva` | 0.186.1, 9.8.1, 10.7.9, 3.1.3, 6.39.5, 0.10.1 | the 3D view via the hee `three-scene` kit | capability fallback (§9) |
| `@playwright/test` | 1.62.1 (the repo's existing pin; shared with DP-E2E) | screenshots and measurements | n/a |

No CSS framework, no animation library (CSS transitions plus one 25-line JS tween for `count-up`), no chart library (the ribbon is hand-built SVG/CSS). Zero-dependency CSS: the token stylesheet is the whole styling system.

## §9 Empty, loading, error and degraded states (total templates)

Every template below is a function of typed inputs with a branch for each optional input; no slot can render empty, and no rendered message matches `/(:\s*[.。]|\s\.\s*$|\bvia none\b|\bundefined\b|\bnull\b)/`.

| State | Title | Detail (support role) | Action |
|---|---|---|---|
| Empty — no events | **No doorway events yet** | Load the sample week, or paste a Ring Playground token to read your own devices. | Primary "Load the sample week"; ghost "Connect Ring" |
| Empty — no incidents | **Nothing broke the rhythm** | Every visit this week matched the usual pattern. | — |
| Empty — no checks | **No open checks** | The last run found nothing to fix. | — |
| Loading (phase) | *Work indicator text:* `{label}` | `reader` → "Reading doorway events"; `planner` → "Planning the review"; `actor` → "Checking each day against the usual rhythm"; `verify` → "Running the checks"; `repair` → "Fixing what the checks found"; `narrator` → "Writing plain-language notes"; `checkpoint` → "Waiting for your decision"; any other or missing → "Working on the week" | — |
| Error — Ring | **Couldn't read Ring** | with a status: "Ring answered with an error ({status}). The sample week is still available." / without: "Ring didn't answer. The sample week is still available." | "Use the sample week"; "Try again" |
| Error — action | **That didn't work** | `{message}` (the registry's sentence) / when absent: "The action stopped before it finished. Nothing was changed." | "Show details" |
| Degraded — backup model | **Using a backup model** | Amazon Bedrock isn't answering, so a different model is doing this review. Its notes are labelled. | "Show details" |
| Degraded — recorded run | **Replaying a recorded run** | with a date: "The live model isn't reachable, so this is the run saved on {date}." / without: "The live model isn't reachable, so this is a saved run." | — |
| Degraded — by hand | **Running by hand** | No model is available. Every action still works from the action list. | "Open the action list" |
| Degraded — sample week | **Showing the sample week** | Ring couldn't be reached with that token, so this is the synthetic sample week. | "Connect Ring" |
| Warning — token | **Token ending soon** | with minutes ≥ 1: "Your Playground token has {minutes} minutes left." / under one: "Your Playground token has less than a minute left." (singular for 1: "1 minute") | "Paste a new token" |
| Warning — budget | **Demo budget at {pct}%** | The review will stop at the limit. | — |
| Not supported — 3D | **3D view unavailable** | This browser can't draw the doorway, so the flat week below shows the same events. | — |
| Rejected | **Declined** | You declined "{summary}". The agent will ask what to do instead. | — |

## §9A Colour deployment

| Screen | Accent roles (≥ 3) | Semantic states |
|---|---|---|
| `/` | (1) the primary "Review the week" fill; (2) the active day's bottom rule and header band, and the Agent panel's leading rule; (3) data emphasis — the hero metric at 0, the selected event tick and the scene's selected pillar, the AGENT badge | a failed or unresolved check: `--bg-danger` row + `--danger` left rule + glyph + word "Error"; needs-a-look: `--bg-warning` + `--warning` + `TriangleAlert` + "Warning"; resolved: `--bg-success` + `--success` + `CircleCheck` + "Resolved"; degraded: `--bg-degraded` + `--degraded` + `Layers` + "Backup" / "Replay" |
| `/watch` | the paused-end marker, the AGENT badge, the replay control's play fill | degraded banner "Replaying a recorded run" always shown |
| `/lab` | the selected control, the scene accent, the reset button | none |

## §10 Screenshot acceptance list (DP-UI WU-14 writes all to `design_documents/ui-screenshots/`, 1440×900 unless stated)

`home-paper.png`, `home-dusk.png`, `home-1280x720-paper.png` (the recording viewport), `appbar-paper.png`, `appbar-dusk.png`, `explainer-open-paper.png`, `help-popover-paper.png`, `working-paper.png` (in-flight indicator with its text), `empty-paper.png`, `error-paper.png`, `degraded-paper.png` (banner with icon, title, detail), `metrics-widest-paper.png` (hero metric at `99+`, dwell at `999`, cost at `$99.9999`), `approval-pending-paper.png`, `incident-selected-paper.png`, `ribbon-detail-paper.png`, `lockup-contact-sheet.png` (mark at 16/24/32/64/512 px in both themes), `home-390-paper.png`, `home-390-dusk.png`, `lab-paper.png`, `watch-paper.png` — 20 files; the command prints the list and `screenshots: 20 written`.
