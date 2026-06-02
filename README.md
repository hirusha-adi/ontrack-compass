# OnTrack Compass

A **Firefox extension** that reads your [Deakin OnTrack](https://ontrack.deakin.edu.au/) data and opens a local dashboard: tasks sorted by due date, grade-based time estimates, interactive charts, and a private todo list (stored only in your browser).

## Install in Firefox (temporary — for development)

1. **Build extension assets** (once, or after changing styles or chart dependencies):

   ```bash
   cd extension
   npm install
   npm run build
   ```

   This runs three steps:
   - **`build:vendor`** — copies Chart.js and plugins into `extension/vendor/` (required; Firefox extension pages cannot load scripts from a CDN)
   - **`build:css`** — compiles Tailwind styles to `dashboard/styles.css`
   - **`build:icons`** — generates toolbar icons

2. **Sign in to OnTrack** in Firefox and open any OnTrack page (e.g. your unit dashboard). The extension captures your session headers from normal API traffic — no password is stored by Compass.

3. **Load the extension:**
   - Open `about:debugging#/runtime/this-firefox`
   - Click **Load Temporary Add-on…**
   - Select `extension/manifest.json` from this repo

4. Click the **OnTrack Compass** toolbar icon to open the dashboard.

> Temporary add-ons are removed when Firefox closes. For a permanent install, package a `.xpi` with `web-ext build` or sign through Mozilla AMO.

## Install in Firefox (signed / permanent)

1. Run `npm run build` in `extension/` as above.
2. Install [web-ext](https://github.com/mozilla/web-ext): `npm install -g web-ext`
3. From `extension/`:

   ```bash
   web-ext build
   ```

4. Install the generated `.xpi` from `extension/web-ext-artifacts/`, or submit it to [Firefox Add-ons](https://addons.mozilla.org/) for signing.

## Using the dashboard

### Views and loading

1. Open OnTrack in a tab so auth can be captured.
2. Click the extension icon.
3. Choose **Single unit** or **All enrolled units** — data loads automatically when you pick a unit or switch view (no manual “Load” button).
4. **Single unit** — one subject from the dropdown, with per-unit local todos.
5. **All enrolled units** — merges tasks across units in your current teaching period (only units whose `start_date`–`end_date` range includes today; past trimesters are excluded). Shows a per-unit breakdown and combined stats.

### Layout

| Area | What it shows |
|------|----------------|
| **Task list** (left) | Tasks sorted by due date; click to select. Toggle **Completed** to include finished work. |
| **Stats** (right top) | Total tasks, open count, estimated hours remaining. |
| **Task details** (right bottom) | Status, description, due / submitted / completed dates, estimate, link to OnTrack. |
| **Footer row** | Local todos, grade time-estimate legend, OnTrack status colour legend. |
| **Charts** (below) | Interactive charts (see below). |

### Task dates

For completed work, the list and detail panel show **submitted** and **completed** dates from OnTrack when available (`submission_date`, `completion_date`), plus the original **due** date.

### Time estimates

Estimates are guessed from the grade letter in each task abbreviation:

| Grade | Hours |
|-------|-------|
| P     | 1.5   |
| C     | 2.5   |
| D     | 5     |
| HD    | 12    |

Group-pass tasks (`GP` suffix) are counted as **P**. Hours appear in stats and task rows, not in the progress bar chart.

### Local todos

Per-unit todos in **Single unit** view only, saved with `browser.storage.local` on your machine.

### Charts (Chart.js)

All charts are interactive (hover tooltips, legend toggles). They update when task data reloads.

| Chart | Description |
|-------|-------------|
| **Status breakdown** | Doughnut chart of tasks by OnTrack status, using official status colours. |
| **Progress** | Horizontal stacked bars: complete vs remaining **task counts** (overall and per unit in “All enrolled” mode). |
| **Progress timeline** | Line chart on a real date axis: cumulative tasks due, complete (by submission/completion date), and still open. Purple points mark individual **submission** dates; hover for task name and dates. A **Today** marker shows the current date. |

Charts are bundled under `extension/vendor/` at build time — no internet connection is needed to view them after `npm run build`.

### OnTrack status colours

Task list accents, badges, and the status pie chart use colours aligned with OnTrack’s status legend (e.g. Working On It, Ready for Feedback, Complete, Time Exceeded).

## How it talks to OnTrack

Based on captured traffic when visiting a project dashboard, Compass uses the same APIs OnTrack’s web app uses:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/projects/?include_in_active=false` | List your projects |
| `GET /api/projects/{id}` | Task statuses, due dates, submission/completion dates |
| `GET /api/units/{unit_id}` | Task names, abbreviations, weights |

Requests include your existing `Auth-Token` and `Username` headers (captured while you use OnTrack). Data never leaves your browser except to Deakin’s OnTrack servers.

## Project layout

```
extension/
  manifest.json         # Firefox MV3 manifest
  background.js         # Opens dashboard; proxies API calls
  content/              # Captures auth from OnTrack pages
  dashboard/            # Compass UI (HTML, app.js, compiled CSS)
  lib/
    ontrack-api.js      # Fetch/merge tasks, stats
    enrollment.js       # Current teaching-period filter
    grades.js           # Grade parsing and hour estimates
    task-status.js      # Status labels and colours
    charts.js           # Chart.js rendering
    todos.js            # Local todo storage
  vendor/               # Chart.js + adapters (from npm run build:vendor)
  icons/                # Generated by npm run build:icons
  scripts/              # Build helpers (icons, vendor copy)
sample_request_data/    # Example HAR captures (not shipped with extension)
```

## Privacy

- Auth tokens are stored locally in extension storage after you use OnTrack.
- Todos and view preferences are local only.
- Chart libraries are vendored in the extension package; no third-party script CDN is used.
- This project is not affiliated with Deakin University.
