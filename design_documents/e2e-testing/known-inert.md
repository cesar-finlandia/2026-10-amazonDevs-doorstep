# Known-inert elements — interactive-looking things that are not controls

Every row mirrors one `inert[]` entry of `e2e/controls.json` by id. `static` rows are marks drawn on the calendar, never focusable. `delegated` rows are interactive but proven by another plan's scripts, not by the sweep.

| id | route | selector | kind | reason |
|---|---|---|---|---|
| inert-001 | `/` | `[data-surface] header h2` | static | headings are not interactive |
| inert-002 | `/` | `.hour-line` | static | marks drawn on the calendar, not controls |
| inert-003 | `/` | `.quiet-band` | static | marks drawn on the calendar, not controls |
| inert-004 | `/` | `.outage-band` | static | marks drawn on the calendar, not controls |
| inert-005 | `/` | `.seam` | static | marks drawn on the calendar, not controls |
| inert-006 | `/` | `.baseline-strip` | static | marks drawn on the calendar, not controls |
| inert-007 | `/watch` | `[data-demo-focus="replay"]` | delegated | the replay body belongs to DP-SHOWCASE and its own scripts; scene-tuning controls on shared shells are proven by 3d-06-lab |
| inert-008 | `/lab` | `[data-lab-panel]` | delegated | the tuning panel belongs to DP-3D and is proven by 3d-06-lab |
