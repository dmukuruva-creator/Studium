# CLAUDE.md — Studium

Local, single-file, AI-optional **quant-interview prep study app**. The headline
surface is the **Quant Drill**, which is wired directly into the user's
`Quant Prep` library (see that folder's `CLAUDE.md`). The goal is a **one-stop,
self-contained prep**: roadmap, daily loop, drills, speed/live-game tracking,
analytics, theme capture, and references to external resources — all in one place.

> Companion folder: `~/Desktop/Academics/Academic Work/Quant Prep` (the materials
> this app drills and writes back into). Keep the two in sync.

## Architecture (deliberately tiny)

| File | What it is |
|------|------------|
| `studium.html` | The **entire app** — one ~430 KB file, all UI + logic + state. No bundler, no framework, no third-party JS deps (KaTeX/fonts are the only CDN links). |
| `studium_server.py` | Local HTTP server (stdlib only), macOS **Keychain** helper, and AI **proxy**. Binds `127.0.0.1:58743`. |
| `install_studium.sh` | Builds `Studium.app` (`--here` builds into this folder). |
| `Build Studium App.command` / `Studium.command` | Double-click launchers. |
| `tests/` | JS unit tests + lint + Python server-security test. **Keep green.** |
| `HANDOFF.md` | Quant Drill audit; follow-up tasks A–F done 2026-07-05 (G declined by design). Read it before non-trivial Quant Drill work. |
| `TASK.md` | Product spec. The guided-session IA (intent-first, 3 surfaces + settings) it describes is **shipped** — status is "use, not build." Read before deciding whether a new feature belongs as a session intent or a hardening item. |

## Run & test

```bash
python3 studium_server.py        # → http://127.0.0.1:58743/studium.html
# or double-click Studium.command / Build Studium App.command

node tests/quant.test.js         # quant logic (was 77 passing)
node tests/parseJSON.test.js
node tests/cache.test.js
node tests/lint.js               # integrity gates — see below
python3 tests/test_server_security.py   # SSRF / origin / body-cap
```

**`tests/lint.js` is a hard gate.** It statically checks `studium.html` and fails
if: an inline `onclick=` handler names a function that isn't defined; a
`getElementById('x')` has no matching `id="x"`; or a `S.<field>` is read but never
declared in the state object. So when you add UI: declare every state key, give
every element you query a matching `id`, and define every handler you reference.

## Conventions (follow them — they're load-bearing)

- **Pure logic stays a top-level function** so it's unit-testable. Tests pull
  functions out of the HTML via a `grab()` helper; mirror that for new pure helpers
  (`_quant*`, `_prep*`, `_speed*` naming).
- **No third-party runtime deps. Python is stdlib-only.** This is what keeps the app
  "double-click local, no install." Don't add a build step or a package.
- **Local-only is enforced, not promised:** server binds loopback; `_check_origin`
  rejects cross-origin (403); the proxy's `validate_target_url` blocks
  private/link-local/cloud-metadata targets; the bank reader is **path-sandboxed**
  to the home root. The only outbound traffic is HTTPS to the AI provider the user
  configures. Preserve all of this — it's the product's whole premise.
- API keys live in **macOS Keychain** via the `security` CLI (macOS-only by design).

## Quant Drill ↔ Quant Prep wiring (the integration — already built)

This is the core of "tie Studium to Quant Prep." The map, all in `studium.html`
unless noted:

- **12-week trader roadmap** — `PREP_SCHEDULE` (mirrors
  `Quant Prep/Roadmaps & Guides/Quant_Recruiting_Roadmap_26X`). Each week has
  `topics`, optional `difficulty`/`firm`, and a `res` string of resources. Program
  starts **2026-06-15**, 12 weeks.
- **"What to do today"** — `_prepToday()` → `renderPrepToday()` renders the current
  week, the daily loop, a one-click **"Drill this week's focus"** (`startPrepDrill`,
  which scopes the tag filter to the week's topic/difficulty), and the Assistant.
- **Speed & live-game gates** — `SPEED_TYPES` (Zetamac / Optiver 80-in-8 / Figgie),
  `logSpeedScore`, `_speedPerf`, `_speedTarget` (week-ramped targets; Figgie is
  reps/recency, no fixed target). `S.speedLog` persists to localStorage.
- **Assistant** — `_prepAssess` + `_quantRecommendation` turn drill analytics
  (`S.quantLog`) + schedule position into recs/pivots: overconfidence ("sure but
  wrong"), weak/slipping topics, decay, coverage gaps, speed gates, Figgie recency,
  Saturday checkpoint nudge, Monday 26X-tracker review.
- **Reading recommendations** — `_quantReadingFor(topic)` maps a topic → specific
  books in the user's library (Green Book, Blitzstein-Hwang, Norris, Natenberg/Hull,
  Mosteller, etc.). Deterministic, no LLM.
- **Theme capture** — the drill reads `Quant_Themes.tex` (`/quant/themes` GET) to
  know which themes are written up; a bank topic that isn't there prompts the user to
  note it, which is **written back** into `Quant_Themes.tex` (`/quant/themes` POST).
- **26X accountability tracker** — `/open-tracker` opens `26X_Tracker.xlsx` in
  `Projects/26X-Planning`. **⚠ The xlsx was deprecated 2026-07-12** (frozen as Wk 1–5
  history; canonical weekly actuals now `System/metrics/week-NN.md`) — the button is a
  historical view. Retargeting `/open-tracker` to the week file is a W-C1-adjacent task
  for the Worklog cycle (`docs/PLAN_Worklog.md`), not an ad-hoc edit.

### Server endpoints (`studium_server.py`)
`/keychain/status`, `/keychain/keys`, `/models/*`, `/quant/problem-bank` (sandboxed
JSON/JSONL/CSV reader), `/quant/themes` (GET reads / POST appends `Quant_Themes.tex`),
`/open-tracker`, `/proxy/*` (SSRF-guarded AI proxy).

### Paths it reads/writes (override via env)
- `STUDIUM_QUANT_PROBLEM_BANK` → default `problems.json` under the Problem Bank dir.
- `STUDIUM_QUANT_THEMES` → `…/Quant Prep/Roadmaps & Guides/Quant_Themes.tex`.
- 26X tracker → `…/Projects/26X-Planning/26X_Tracker.xlsx`.

If those paths or the roadmap weeks change in `Quant Prep`, update `PREP_SCHEDULE`,
`_speedTarget`, the env defaults, and this file together.

## Overriding constraint
This is a **minors-safety-aware, single-user, local** study tool. Don't add network
dependencies, accounts, server-side persistence, or a build toolchain. Keep
everything client-side + stdlib. New prep features must keep `tests/lint.js` and the
unit tests green.
