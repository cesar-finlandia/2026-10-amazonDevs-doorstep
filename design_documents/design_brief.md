# Design brief — Doorstep Rhythm

Slogan, identical everywhere it appears: Know her day without calling.

## Concept

**Concept sentence:** A paper wall calendar hung beside a front door, where every arrival is a pencil tick and the one visit that did not belong is circled, so a daughter can read her mother's week at a glance.
**Material:** Warm cotton paper, graphite pencil ticks, and one verdigris ink used for everything that can be pressed.
**Light:** Soft low morning daylight from a hallway window, warm and slightly yellow, with a dusk-lamp variant for the evening theme.
**Era:** Mid-century household almanacs and printed family wall calendars.
**Emotion:** Settled, like coming home and finding things as they should be.
**Hero frame:** The 3D doorway scene of the whole week standing above the paper calendar, with one pencil circle drawn round the visit that did not belong.
**Not this:** A black grid of live camera feeds with red recording dots, or a glowing neon agent dashboard.

## Audience and register

The reader is a daughter or son who lives a train ride from a parent who lives alone. She is not a technician, opens the page in the evening on a laptop, wants to know within ten seconds whether this was an ordinary week, and distrusts anything that feels like surveillance. The register is warm-editorial: a household almanac, not a security console. The memorable idea: the week is a paper calendar by the door, and the one tick that does not belong gets a pencil circle that draws itself.

## Derivation of the tokens

- `--bg` and `--bg-elevated` (cream paper, lighter card stock) — from Material: the wall and the calendar sheet.
- `--bg-sunken` (a darker paper well) — from Material: the shadow a thick page casts on the wall.
- `--pencil`, `--text` (graphite, warm near-black) — from Material: pencil ticks and ink on paper, never pure black.
- `--text-muted` (faded graphite) — from Material: pencil pressed lightly.
- `--accent` (verdigris, a copper-green) — from Material: the one ink used for everything that can be pressed.
- `--warning` (burnt amber) — from Light: low sun on the page, meaning "look here", not alarm.
- `--danger` (brick red) — from Era: the red pencil of a printed almanac proof.
- `--degraded` (slate blue) — from Era: the blue of a carbon-copy form, meaning "this is a copy".
- `--success` (leaf green) — from Emotion: things as they should be.
- Dark theme grounds `#12171A`, `#1B2226` — from Light: the room after the lamp is turned down, a blue-black night window.
- Dark `--accent` (lifted verdigris) — from Light: the lamp on the same copper-green ink.
- `--font-display` Fraunces — from Era: the warm, soft-serif voice of printed almanacs.
- `--font-text` Atkinson Hyperlegible Next — from Emotion: unhurried legibility at a glance.
- Hairline borders and the pencil-circle motion — from Material: a ruled calendar and a pencil drawn on it.

## Placement of the theme toggle

The theme toggle lives in the footer of the sticky household rail at 1024 px and wider, because it is a quiet household preference that is always in view without opening a menu; below 1024 px it moves into the app bar.

## Review

### Pass 1 — the nine defects of the craft contract, checked against this identity

- Defect 1 (status printed over the layout): every state has a home in the banner, callout or toast of the identity plan section 6.7.
- Defect 2 (a broken message template): every message is a total template written in section 9 and asserted by a script.
- Defect 3 (cards that are not containers): one surface recipe with border, radius, elevation and a header row.
- Defect 4 (numbers that wrap): one metric component with a stated digit budget and tabular figures.
- Defect 5 (every line identical): the eyebrow, subject and support roles are fixed for every group.
- Defect 6 (a monochrome screen): the accent appears in at least three roles and each state is a tinted surface with a glyph and a word.
- Defect 7 (no way to learn what anything does): an explainer button beside the title and a question-mark popover on every result region.
- Defect 8 (raw text dumped into a panel): every long text is clamped with a Show more control, and logs sit in a sunken well.
- Defect 9 (the system font everywhere): three self-hosted variable typefaces with stated roles.

### Pass 2 — accessibility and the camera

- Check 1: body text and muted text meet 4.5:1 on every surface in both themes, asserted by a script.
- Check 2: every control shows a focus ring, and no state is carried by colour alone.
- Check 3: every motion has a reduced-motion substitute.
- Check 4: anything the camera must read is 18 px or larger, numerals 28 px or larger, the hero metric 64 px.
- Check 5: the layout holds at 1440, 1280, 1024 and 390 px without horizontal scrolling.
