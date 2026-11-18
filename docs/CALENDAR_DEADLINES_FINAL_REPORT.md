# Study Zone — Final Calendar & Deadlines Redesign Report (v2.0.8)

Date: 2026-11-18
Branch: `main` (working tree: Calendar/Deadlines redesign changes uncommitted on top of `2a4ff8b`)
App version: `2.0.8`
Scope: Calendar screen + Deadlines screen only. No data model / SQL / sync-engine changes.

## 1. What was built

Two screens were redesigned in place (no new screens, no deleted features):

- **Calendar** (`#calendar`): toolbar (search, All Events / Study / Personal / Archived
  filters, Add Event, views Month / Week / Day / Agenda, Today, prev / next), month grid
  6×7 from Sunday with today highlight, out-of-month dimming, thin borders, dark
  theme-consistent background, coloured rounded event pills (name, time, classification
  colour, done state), per-day cap with an elegant `+N more` affordance, day detail sheet
  with the full list, full CRUD through the existing task modal + delete confirmation.
- **Deadlines** (`#deadlines`): dedicated horizontal Project / Deadline Timeline only.
  Header (title, New Deadline / New Project, All / Backlog / Active / Completed / Overdue /
  Archived filters, filter toggle, Timeline | List view switch, Today, prev / next, zoom
  Day / Week / Month / Quarter), sticky left name column + sticky date header, vertical
  today column + today line, dots for important days, light vertical day borders, horizontal
  scrolling, one row per item, expandable project phases, backlog / active / completed /
  overdue / on-hold states, progress, start/end dates, total span, open-ended bars, deadline
  markers (end date only), and incomplete-data rows when dates are missing.

## 2. Files changed

Modified:

- `app.js` — state block (new calendar + timeline state), `timeline-core` helpers
  (`kindOfTask`, `getTimelineItems`, `getFilteredTimeline`, …), new page renderers
  (`calendarPage`, `deadlinesPage` + timeline sub-renderers), handlers block
  (`calendar-*`, `timeline-*`), `openTaskModal` item-type row, task/deadline form saves,
  `render()` wiring, `pageRenderers.calendar` registration.
- `index.html` — nav link `data-page="calendar"`, `<link sz-calendar.css>`, `<script
  timeline-core.js defer>`, `#task-item-type-row`, `#deadline-modal` Type / Parent project
  selects, new `#calendar-day-modal`, new `#timeline-item-modal`.
- `service-worker.js` — cache `studyzone-shell-v38`, precaches `./sz-calendar.css` and
  `./timeline-core.js`.
- `package.json` — `check` script runs the new `timeline-core` suite.
- `scripts/build-web.js` — copies `timeline-core.js` and `sz-calendar.css` into `www/`.

New:

- `timeline-core.js` — dependency-free date / geometry / classification core (UMD).
- `tests/timeline-core.js` — 82-assertion unit suite (all passing).
- `sz-calendar.css` — full stylesheet for both screens, token-derived, animations, RTL,
  responsive breakpoints, light-theme tuning.

New (task 1 artifacts):

- `backup-calendar-deadlines-20261118/` — pre-change backups.

## 3. Task vs deadline separation (method)

- Explicit classification lives in the device-local map `studyzone.task-meta.v1`
  (`project` / `deadline` / `phase:<parentId>` / `task`), mirrored onto the task row in
  memory only. No Supabase schema / RLS / RPC change was made.
- Legacy fallback: a task with a `starts_at` is treated as a `deadline`; without it, as a
  `task`. Routines / virtual tasks and undated items are excluded from the timeline.
- Ordinary daily / quick / small / recurring tasks never enter the Deadlines screen; only the
  projects / deadlines / phases that ALSO span two or more real days satisfy it (see §7 —
  mandatory filter applied to every Deadlines view).
- No item ever appears from a single date alone; incomplete or single-day items stay out of
  Deadlines (they remain fully visible in Tasks and Calendar).

## 4. Bar width calculation (bar must equal real duration in days)

- `timeline-core.js`:
  - `itemRange(item)` → `{ startKey, endKey, hasStart, hasEnd }` from `starts_at` / `due_at`
    (defensive swap if inverted; never invents dates).
  - `spanDays(range)` → `end - start + 1` days (min 1) when both dates exist.
  - `barGeometry(range, startKey, days, width)` → `left = offset * dayWidth`,
    `width = (visibleEnd - visibleStart) * dayWidth`; open-ended bars run to the window edge
    flagged `openEnded`; end-only items use `markerGeometry` (pin at the day centre).
- Zoom → scale only: `day: 7×168, week: 21×76, month: 45×34, quarter: 92×14` (window days ×
  day width), lead offsets 1 / 4 / 10 / 25.
- Width is therefore proportional to the real day count (3 < 7 < 14 < 30 days) and changes
  only with zoom; cross-month / cross-year / leap-year boundaries come from real date keys.

## 5. Theme results

- All colours come from existing tokens (`--color-primary`, `--color-info`, `--color-success`,
  `--color-danger`, `--color-muted`, `--color-warning` + `-rgb` components) via `color-mix()`
  over rgba fallbacks; **0 hardcoded hex colours** in `sz-calendar.css`.
- Subject greens (`#06D6A0`, …) are not used anywhere in the new screens.
- Supports dark + light for all presets: original, ocean, emerald, purple, crimson, midnight,
  orange, sky, cyan, turquoise, teal, mint, lime, violet, lavender, indigo, rose, pink, magenta,
  coral, amber, yellow, graphite (15 required presets included).

## 6. Test results

Automated (this session):

- `node --check app.js` ✅ · `node --check timeline-core.js` ✅
- `tests/timeline-core.js` → **82 / 82 passed** ✅
- `tests/platform-checks.js` → **77 / 77 passed** ✅
- `scripts/i18n-audit.js` → **96 translated literals, 684 keys, en/ar parity OK** ✅
- `npm run check` → only the **8 pre-existing** `tests/static-checks.js` failures (missing
  `supabase/migrations/` directory in this checkout) + `tests/comms-repair-checks.js` ENOENT on
  `012_…sql` — both confirmed unrelated to this work.
- `npm run build:web` ✅ (copies `timeline-core.js` + `sz-calendar.css` into `www/`).

Browser (Playwright headless Chromium 159, desktop 1440×900, local static server):

- Calendar: `.calendar-month-grid` rendered with **42 cells** (6×7), **60 events**, **18
  `+More` affordances**, **12 out-of-month cells**, today highlighted as `18`, event pills
  resolved with theme-derived background (`color-mix`) and readable text; no console errors.
- Deadlines: toolbar / filters / zoom / period label rendered; demo workspace had no timeline
  items yet, so the empty state correctly replaced the canvas (expected with demo data only).
- Offline (CDP `Network.emulateNetworkConditions` offline): app kept running, offline banner
  shown, auth modal closed, workspace data retained, no new console errors beyond network
  disconnects.

## 7. Mandatory Deadlines display rule (applied after the redesign)

**Rule.** An item appears in the Deadlines screen (every view — Timeline and List, desktop and
mobile) **only when it spans two or more real calendar days**, computed from its actual
`starts_at` and `due_at`.

- 1 day or less / same start+end day      → hidden (still present in Tasks and Calendar).
- 2, 3, 7, 14, 30+ days                   → shown (bar width = real day span × zoom day-width).
- due-date-only / start-only / undated    → hidden (never auto-shown).
- daily recurring tasks / routines        → hidden.

Implementation (`timeline-core.js` → `isMultiDayItem(item)`):
`routine_id` / `routine:` id prefix → `false`; `recurrence_type` in `daily|hourly|weekdays` →
`false`; otherwise `spanDays(itemRange(task)) >= 2`, computed from real start/due dates only —
no invented or default dates, never from task creation time.

Wired into:
- `getTimelineItems()` (timeline roots/phases and the archived counter)
- `getDeadlinesForScreen()` used by the Deadlines **list view** empty state, `deadlineStats`
  and `getFilteredDeadlines()` (search, status filter, sort)

Dashboards, Tasks, Calendar and notifications were **not** changed (display-only rule); excluded
tasks are not deleted and keep their dates/status.

Tests (mandatory cases) — `tests/timeline-core.js`, **93/93 passed**:
1-day task → false · 2-day task → true · 3-day task → true · 7-day task → true ·
30-day task → true · due-date-only → false · start-only → false · undated → false ·
daily recurring → false · routine → false.

Browser check (headless Chromium): Deadlines timeline renders without console errors; with demo
data (no multi-day items) it shows the empty state, as required; the List view renders and shows
0 multi-day items with its stats grid.

## 8. Priority colour coding + subtle soft styling (applied 2026-11-18)

**Mapping (from the task's recorded priority, never invented from dates):**

- `urgent` → **red `#f0443f`** (critical) · `high` → **coral `#fb7c3c`** · `medium` → **amber
  `#f5b942`** · `low` → **cyan `#38bdf8`** · `none` → neutral muted
- `status === 'completed'` → **calm mint `#35c48d`** (completed never treated as urgent)
- overdue keeps the item's priority hue and adds a dedicated **dark-red `#c0392b`**
  `Overdue` badge on the bar (priority stays an independent statement)

**Surfaces:** colour appears in the bar tint/border, a name-cell priority dot (`.timeline-prio-dot`,
mint when completed), the details-modal priority chip, and the list-view priority pills — all with
translucent fills over theme surfaces. No fixed purple/green leftovers; light theme has dedicated
legibility overrides.

**Radius & weight:** bars / markers / chips / dots / cards / animations' radii → **6–8 px**;
containers and cards → **10–12 px** (`.deadline-card` 12, `.deadline-stat` 12, `.timeline-item-facts`
10); no pill-shaped radii on bars, shadows on bars removed (hover relies on z-index only).

Verification: `tests/timeline-priority-colors.js` → **36/36** (all states: urgent/high/medium/low/
none/completed/overdue; radius bounds; no heavy bar hover shadow); wired into `npm run check`;
`platform 77/77`, i18n audit OK, browser render check → no console errors.

Contact: `timeline-bar-progress` per priority hue,
`.timeline-chip.prio-*` in the details modal, `.priority.none` neutral pill.

## 9. Remaining issues

1. `supabase/migrations/` is absent from this checkout → 8 static-check failures + comms-repair
   ENOENT (pre-existing, environment/data issue, not code).
2. Reference design images were described but never attached to the conversation; the design
   was implemented strictly from the written specification.
3. Touch/pen drag on timeline bars is skipped for coarse pointers (track scrolls instead) — CSS
   `@media (hover: none) and (pointer: coarse)` rule added.
4. Real-device visual validation (Android WebView, light theme on device) still pending.
