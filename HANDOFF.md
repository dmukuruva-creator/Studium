# HANDOFF — Quant Drill audit, improvements & containerization (2026-06-20)

> **Update 2026-07-20 — Exam-Prep Mode shipped (PLAN_PrepPipeline 4b).** Authorized
> build-lock exception (David, ahead of the Optiver OA sitting 2026-07-25; logged in
> System/logs/daily/2026-07-20.md). Shipped in `studium.html`: (1) new `oab` "Quant OA
> battery (Optiver-style)" playbook stage in `_prepPlaybooks` + its dropdown option;
> (2) `_prepAssess` is now **exam-aware** — a live countdown drives the top rec/pivot
> and points to the assessment's SCORE_LOG.md; (3) `_examContext()` + `askExamFeedback()`
> + an "🎯 Ask AI — exam readiness" button in the live countdown panel that sends
> goals/targets + the user's logged speed scores + drill perf to `callAI` (graceful
> no-key fallback). New state: `S.examFeedback`, `S.examFeedbackBusy`. Tests: +3 `oab`
> countdown cases (quant.test.js 104/0); lint + parseJSON + cache + math + server-security
> all green. **Not yet committed** (working tree was already dirty per PLAN_PrepPipeline H1).
> Follow-up deferred: reading the Quant-Prep-side SCORE_LOG.md file for AI context (would
> need a sandboxed text endpoint) — currently uses in-app `S.speedLog`/`S.quantLog`.
>
> **Same session — global Attention layer (UI/UX urgency pass).** New `_attentionItems()`
> aggregates pending tasks/TODOs (FSRS cards due, live assessment countdown, stale drill
> momentum, unmet Zetamac/80-in-8 gates) into one urgency-ranked list; `_attentionSummary()`
> is the pure headline formatter (unit-tested). Surfaced as (a) a pulsing **topbar chip**
> (`#topbar-attention`) showing the most-urgent item + "+N", click → `focusAttention()`
> jumps to its surface; (b) **sidebar count badges** (`.nb-badge` red=now/gold=soon) on the
> nav so pending work is visible from any tab. Defensive (every source try/caught) so it can
> never break the shell. Clicking the chip now opens a **dropdown** of *all* pending items
> (`toggleAttention`/`closeAttention`/`attnNavTo`, `S.attnOpen`), each row navigating to its
> surface — backdrop-click and Escape close it. Tests 107/0, lint green (41 ids, 466 fns).
>
> **Same session — per-row quick actions + system-wide Pomodoro.** (a) Attention dropdown rows
> gained a one-click action (`attnAct`/`_attnActionLabel`): cards→Review (`startTodaySession`),
> drill→Drill (`startPrepDrill`), exam→Ask AI (`askExamFeedback`), speed→Zetamac↗. (b) New
> **pomotroid-inspired Pomodoro** in the topbar (`#topbar-pomo`): SVG progress ring + MM:SS
> chip → opens a dial panel (mode tabs focus/short/long, round dots, Start/Pause/Reset/Skip,
> Web-Audio chime, sound toggle). Engine is pure-helper-driven (`_pomoFormat`/`_pomoNext`/
> `_pomoStats` unit-tested) over a 250 ms `_pomoTimer`; completed focus sessions log to
> `S.pomoLog` (persisted) and surface as a **Focus-time card in Progress** + live stats in the
> panel. New state: `pomo`, `pomoCfg`, `pomoLog`, `pomoOpen`. No deps (Web Audio only). Tests
> 112/0, lint green (42 ids, 493 fns).

Scope of this session: a deep audit of the **Quant Drill** (interface, functionality,
UI/UX) with concrete improvements **staged** for (a) intuition while using and
(b) usefulness/accessibility of the analytics; plus a lightweight, **double-click
container** for the app that stays strictly local; plus an appropriateness audit
of every follow-up task against Studium's nature as a *local quant-prep study app*.

Everything in §1 and §3 is in the working tree now. §2 is the audit. §4–§6 are the
appropriateness verdicts and the open task list.

> **Update 2026-07-18 — section-flood bug fixed + Mock Interview design staged
> (authorized by David's "fix these issues and make a pressure-tested plan" request;
> build-lock honor-active — no `System/logs/daily/2026-07-18.md`, so NOT committed).**
> - **Bug (reported via screenshots): the "Learn New → Choose a section" `<select>`
>   exploded into hundreds of junk options** on a PDF-extracted book ("The Quant
>   Compendium"). Root cause in `headingMatches` (`studium.html`): it treated ALL-CAPS
>   running page-headers (repeated every page), numeric data/table rows, `#`-prefixed
>   code comments, and printed table-of-contents dot-leader lines as headings. Every
>   section picker (Learn/Explain/Quiz/Exam) inherits `studySections()`, so all were
>   flooded. Fix: new pure `_looksLikeHeading()` guard (rejects ToC dot-leaders, pure-
>   numeric rows, and code) + a frequency dedup in `headingMatches` (a title recurring
>   >3× is a page-header → keep first only). On a representative 33-line sample: **9
>   bogus sections → 3 real headings.** +19 tests in new `tests/sections.test.js`.
>   Tests after fix: sections 19/0, quant 102/0, math 23/0, parseJSON 14/0, cache, lint —
>   all green. **David: reload the Studium tab** (section cache recomputes on load) and
>   re-open the Learn picker to confirm on the real doc. *Follow-up (not done, low
>   priority):* the Learn/Explain pickers still render a flat `<select>`; grouping by
>   document with `<optgroup>` + level indent (like `sectionPicker()`) would make even a
>   legitimately long book navigable — staged as a UX nit, not built.
> - **Mock Interview prep: pressure-tested design written to `docs/PLAN_MockInterview.md`**
>   — expands `PLAN_PrepPipeline.md` C1 + 4b into 3 tiers (instrument → text AI
>   interviewer → voice non-build), a concrete analytics spec, an assumptions→attacks
>   pressure test, and case-tailored accessible alternatives (Optiver 80-in-8, PuzzledQuant,
>   Pramp, peer mocks, Figgie/IMC Prosperity). Staged for a cycle; NOT built (new feature =
>   delegated per constitution). `PLAN_PrepPipeline.md` C1 now points at it.
> - **`/pressure-test` of that plan (2026-07-18) — §5 alternatives re-verified live; the
>   plan was corrected in place.** Findings: 🟠 **Pramp is deprecated for quant** — acquired
>   by Exponent, now SWE/PM-only, AI-mock removed (David's flag confirmed); retracted from the
>   plan. 🟠 Live quant-specific leaders were omitted — **QuantBrainteasers** (free timed mock
>   + readiness score), **QuantGuide**, **OpenQuant** — added. 🟠 F5: Tier-2 AI prob-screen
>   collides with QuantBrainteasers, so staging was **inverted to lead with market-making**
>   (the differentiated mode). 🟠 F9: the human-mock channel (the real P0) has **no verified
>   source** — added §5a making it the gating human-lane action. 🟡 IMC Prosperity 4 already
>   ended (Apr 2026); next ≈ Apr 2027. ✅ Confirmed live: Optiver 80-in-8 clones, Figgie,
>   PuzzledQuant (as a question source, not a mock). Internal refs + assumptions §4 sound.
> - **`/llm-council` second pass (2026-07-18) — 4-of-5 verdict: defer the build, book the
>   human mock.** The app risks being displacement activity; analytics over 0 logged mocks is
>   empty; the scarce resource is a human. Plan updated: new **§0.0 "Initiate now"** —
>   (1) book the Dartmouth Center for Career Design mock via Handshake TODAY (briefs already
>   exist), (2) use a PAPER rubric for the first ~5 mocks, (3) defer all Studium code until
>   ~5 real mocks justify Tier 1. Calibration axis to be *computed* from `S.meta.calibration`,
>   not self-rated. **Pramp purged** from `studium.html` (QUANT_LINKS Mocks group → Career
>   Design + QuantBrainteasers) and from `Quant Prep/{CLAUDE.md, Mock Interviews/MOCK_SCRIPTS.md,
>   Roadmaps & Guides/TRADING_PREP_MATERIALS.md}`. Lint + sections + quant tests green.
>
> **Update 2026-07-14 (4) — Quant Drill home navigability + countdown-aware
> protocol suggestions (authorized by David's "clean up the Quant Drill UI"
> request).** Four changes, all in `renderQuantHome`/`renderPrepToday` + one new
> state field:
> - **Section jump-nav** under the Drill-now card (Today · Dashboard · History ·
>   External · Banks) — pure `#anchor` links to new `qp-*` wrapper ids; no
>   handlers, no state.
> - **Daily protocol strip** replaces the prose "Every day:" line on the prep
>   card — numbered ①–④ (warm-up w/ Zetamac+Figgie links → timed set → fresh
>   firm-tagged question w/ links → grade & log).
> - **Next-interview countdown** (PLAN_PrepPipeline item 4b, pulled forward):
>   `S.nextInterview` ({date,firm,stage}, persisted `sd_nextinterview`), a
>   set/clear form on the prep card, and pure helpers `_prepPlaybooks()` +
>   `_prepCountdown(ni,nowMs)` that condense `Quant Prep/Mock Interviews/
>   INTERVIEW_COUNTDOWN.md` into per-horizon focus lines (T-7/T-3/T-1/day-of ·
>   stale → debrief prompt · far → standing-loop fallback). The panel highlights
>   gold at T≤7, red at T≤1. +6 unit tests.
> - **Setup collapse:** the intro paragraph + importer card fold into a
>   `<details>` once a bank is loaded — returning users land on drill/today/
>   analytics, not setup prose.
> Tests: quant 102/0, math 23/0, parseJSON 14/0, cache, lint, python
> server-security — all green; running server serves the new symbols (reload the
> tab). **Not committed to git** (H1 in `docs/PLAN_PrepPipeline.md`).
>
> **Update 2026-07-14 (3) — prep card pointed at the new Quant Prep materials
> (data-only edit, authorized by David's "organize the scheduler and Studium" request).**
> No logic touched. `PREP_SCHEDULE` `res` strings for weeks 3 and 8–12 now name the
> 2026-07-14 additions (`Mental Math/MENTAL_MATH_TRAINING.md`, `Mock Interviews/
> {MOCK_SCRIPTS,PIPELINE_GUIDE,BEHAVIORAL_BANK,INTERVIEW_COUNTDOWN}.md`,
> `Applications/Quant_Application_Tracker.xlsx`); `QUANT_LINKS` gains two Optiver 80-in-8 practice
> clones and the Pramp note points at the local mock scripts. T-minus interview
> playbooks live in `Quant Prep/Mock Interviews/INTERVIEW_COUNTDOWN.md` — a dated
> "next interview" assistant hook is staged as a cycle item in
> `docs/PLAN_PrepPipeline.md`, not built ad hoc. Tests after edit: quant 96/0,
> math 23/0, parseJSON 14/0, cache, lint — all green. **Not committed to git**
> (H1 in `docs/PLAN_PrepPipeline.md` covers committing the whole tree).
>
> **Update 2026-07-14 (2) — four behavioral fixes A–D (ad-hoc build-lock override,
> authorized by David).** All in `studium.html`; tests green (quant 96/0, math 23/0,
> parseJSON 14/0, cache, python SSRF, lint gate). **Not committed to git.**
> - **A · FSRS no longer depends on a live CDN.** The scheduler was a runtime
>   `import('https://esm.sh/ts-fsrs')` in a swallow-the-error try/catch; when it
>   failed (offline/CSP/esm.sh) `window._fsrsLib` was null and **every `rateCard`
>   silently no-oped** → due backlog never drained, Review re-served the same cards,
>   `recommendSession` jammed on "Review" (rule `due>=5`) and never reached
>   Learn/Drill/Explain/Exam. Replaced with a **self-contained built-in scheduler**
>   (same `createEmptyCard/generatorParameters/fsrs().next/Rating` interface,
>   FSRS-like stability/difficulty). ⚠ **Behavior change:** scheduling is now an
>   approximation of FSRS-6, not canonical ts-fsrs — the right trade for a local,
>   offline, no-network-dep app, but flag if canonical FSRS is wanted (would need
>   inlining the real lib). Verified: ratings advance due dates; a rated card is no
>   longer due.
> - **B · Quant Drill now has cross-session memory.** `sess.stats` was per-session,
>   so every question looked "unseen" each drill and mastery never stuck. Added
>   persistent `S.quantItemStats` (`sd_quantitemstats`, keyed by id or normalized
>   stem via `_quantItemKey`), seeded into each session; `_quantPickNext` now shows
>   every item **once before repeating** (`sessionSeen` pool) then weights by carried
>   history. +5 unit tests.
> - **C · Roadmap week selector.** `_prepToday()` only ever exposed the current week
>   and "Drill this week's focus" was hardwired to it — no way to revisit missed
>   weeks. Added `_prepViewWeek()` + `setPrepWeek()` + a week `<select>` on the prep
>   card (catch-up banner when off-current); `startPrepDrill` drills the selected
>   week. `_prepToday()` stays the true calendar position for assistant/checkpoints.
> - **D · Reset for polluted analytics.** `resetQuantLog()` + a "Reset analytics"
>   button in the Drill-history card — clears `S.quantLog` (weak-topic/calibration/
>   recommendation history corrupted by the earlier grading bug); banks + per-question
>   progress kept. **David should click it once** to clear the poisoned history.
>
> **Update 2026-07-14 — grader braceless-fraction bug fixed (ad-hoc build-lock
> override, authorized by David).** `_quantNumberCandidates` only expanded *braced*
> `\frac{a}{b}`; the bank's idiomatic braceless shorthand (`\tfrac13`, `\tfrac32`)
> was mangled into a bogus integer (`\tfrac13` → `"13"`), so a correct fraction
> answer graded **INCORRECT**. Surfaced on **QG-316 "sharpe-marbles"**: user typed
> the exact answer `1/3` and was marked wrong. Root-cause fix at
> `studium.html:4321` (expand braced **and** braceless single-token forms);
> ~377/982 bank problems used braceless fractions and were latently affected, plus
> the accuracy/calibration analytics built on grading. Note: the "(mean/variance)"
> definition is faithful to the QuantGuide source (the "Sharpe" title is the trap) —
> the math was **not** the bug. +3 regression tests. `node tests/quant.test.js` →
> 91/0, `lint.js`/`math.test.js`/`parseJSON`/`cache` green. **Not committed to git.**
>
> **Update 2026-07-05 — follow-up tasks A–F are done.** All six open tasks from §3
> were implemented and verified (`node tests/quant.test.js` → 88 passed / 0 failed,
> `tests/lint.js` green, `tests/parseJSON.test.js` + `tests/cache.test.js` green,
> `python3 tests/test_server_security.py` green). G remains declined by design.
> Details in the §3 table below. Nothing here is committed to git yet.

---

## 1. What was staged this session (done, tested)

### Quant Drill — intuition
- **Confidence is now a segmented control, not a dropdown.** `renderQuantActive`
  rendered a `<select>` (`Sure / Unsure / Guess`) that had to be *opened* every
  question — friction in a rapid-fire loop. Replaced with three inline buttons
  (`setQuantConfidence`) that set `S.quant.confidence` **without a full re-render**,
  so the answer you are typing is never wiped. Defaults to *Unsure*, resets to
  *Unsure* after each submit/skip. `aria-pressed` + a labelled `role="group"` keep
  it accessible. The old `getElementById('quant-confidence')` read in `quantSubmit`
  is gone (now reads `sess.confidence`).
- **Progress is visible mid-drill.** Added a `Seen X/N` stat to the active-drill
  stats bar so you know how much of the (filtered) bank you've actually covered —
  previously invisible, so a "sprint" felt open-ended.
- **Answer box has an `aria-label`** ("Your answer") — it had only a placeholder.

### Quant Drill — analytics usefulness & accessibility
- **End-of-drill reflection now shows the data it already collects.** The session
  logged rich per-topic + confidence data into `S.quantLog`, but the summary screen
  (`renderQuantSummary`) only showed five aggregate numbers and a flat missed list.
  Added, straight from `sess.attempts`:
  - a **per-topic breakdown** (correct/seen, an accuracy bar, %, weakest-first) with
    a one-click **Drill** button per topic → `startQuantWeakTopic`, so the next move
    is on-screen instead of buried in the dashboard;
  - a **calibration line** — of the answers you marked *Sure*, how many were wrong —
    surfaced at the exact moment of reflection (the costliest interview failure mode).
  - The mini accuracy bars use inline markup (not color alone): each row shows the
    fraction, the bar, **and** the % number.
- **Extracted `_quantSessionBreakdown(attempts)`** as a pure top-level helper (the
  codebase convention: pure logic stays unit-testable via `grab()`), and added
  **5 unit tests** in `tests/quant.test.js` (skips excluded, per-topic accuracy,
  confident-miss counting, untagged bucket, null-safe).

### Containerization — a real double-click "container", strictly local
- **`Build Studium App.command`** (new, double-clickable) builds a self-contained
  `Studium.app` **into the project folder**, ready to double-click. It calls
  `install_studium.sh --here`.
- **`install_studium.sh`**: added a `--here` target (build into the project dir vs
  `~/Applications`) and **hardened Python discovery in the bundled launcher** — a
  GUI-launched `.app` inherits a minimal `PATH` (often `/usr/bin:/bin`), so a
  Homebrew-only Python install made the old bundle fail *silently*. The launcher now
  probes `python3`, `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin` and shows a
  clear alert if none is found.
- `Studium.app/` added to `.gitignore` (it's a generated artifact).

**Tests:** `node tests/quant.test.js` → 77 passed / 0 failed · `node tests/lint.js`
→ all checks passed · server smoke test serves the page, new symbols present,
cross-origin request returns 403 (local-only enforcement intact).

---

## 2. Deep audit findings (Quant Drill)

**Overall: strong and well-aligned.** The drill is genuinely "true to Studium" —
grounded in *your* bank, instant deterministic grading (no LLM in the hot path),
bounded sessions, weak items resurface, FSRS hand-off for spaced review, and an
impact×urgency priority model that already beats generic trainers. The bug-report
log (`docs/bug-reports/2026-06-19-quant-drill.md`) is closed. What follows is what
remained rough, ranked.

### Intuition while using
1. **Confidence friction** — *fixed this session* (dropdown → segmented).
2. **No progress signal mid-drill** — *fixed* (`Seen X/N`).
3. **Keyboard loop is incomplete.** Enter submits and (after a miss) advances, but
   `Skip` and `Hint` are mouse-only. A true rapid-fire loop wants keyboard verbs.
   *Caveat:* the answer box captures digits, so `1/2/3` cannot be global shortcuts
   while typing — bind Skip/Hint only when a result is shown, or use a non-conflict
   key (e.g. `Tab`/`?`). See Task A.
4. **The home screen buries the drill.** `renderQuantHome` stacks Prep-today → new
   theme → dashboard → intro → importer → banks. A returning user scrolls past a
   lot to press "drill". A persistent "resume / drill recommended" affordance up top
   would shorten the path. See Task C.
5. **Timed-sprint end is abrupt** — the timer hits 0 and jumps straight to summary
   with no "time's up" beat. Minor. See Task D.

### Usefulness & accessibility of analytics
6. **Reflection-moment analytics** — *fixed this session* (per-topic + calibration
   on the summary).
7. **Dashboard leans on color.** `renderQuantDashboard` encodes skill via the
   Repair-button color and accuracy via text color; the numeric `skill` score isn't
   shown and there's no non-color cue for the skill band. Partly mitigated (acc% is
   text), but a skill label/`title` would finish it. See Task B.
8. **No history/trend view or export.** `S.quantLog` is capped at 300 sessions and
   holds a real time series, but the only longitudinal signal shown is a per-topic
   ▲/▼ trend arrow. No "last N sessions" sparkline, no CSV/JSON export for a study
   journal. See Task E (note the appropriateness caveat).
9. **Untagged banks get thin analytics.** Everything keys on `item.topic`; a plain
   `Q | A` bank collapses into `(untagged)` and the dashboard/priority model has
   little to say. Acceptable (the metadata-rich Problem Bank is the primary path),
   but worth a one-line in-UI nudge that tagging unlocks analytics. See Task F.

### Functionality / correctness
10. **Solid.** Grading tolerances, fraction/percent parsing, weighted next-item
    pick, theme capture, and the SSRF/path-sandbox on the server all hold up. No
    correctness defects found this pass. The `_mathNormalize` KaTeX fix is in place
    at every bank-render site.

---

## 3. Targeted follow-up tasks

| ID | Status | Task | How it landed (2026-07-05) |
|----|--------|------|----------------------------|
| A | ✅ done | Keyboard verbs for Skip/Hint | `Esc` skips, `?` toggles the hint — bound in the global keydown only while answering (never on the result screen, never stealing digits from the answer box); buttons now read `Skip (esc)` / `Hint (?)`, matching the `(Enter)` placeholder convention |
| B | ✅ done | Non-color skill cue in dashboard | Each topic row gains a skill column showing the numeric score + a text band (`strong`/`fair`/`weak`) with an explanatory `title`; the Repair button carries the same info in its tooltip — no signal is color-only anymore |
| C | ✅ done | Persistent drill affordance atop `renderQuantHome` | A "Drill now" card is pinned first on the quant home (before Prep-today/theme/dashboard) with the recommendation detail + a one-click `startQuantRecommended()` button; "Resume" isn't a state that exists (leaving the drill tears the session down), so the affordance is start-recommended |
| D | ✅ done | "Time's up" beat before the timed summary | `_quantTick` → `_quantTimeUp()`: input locks (`timeUp` guards on submit/skip/hint/next), a gold "TIME'S UP" banner renders for 1.5 s, then `endQuantDrill()` scores. Ending early via End during the beat stays safe |
| E | ✅ done | Drill-history view + CSV/JSON export | Collapsed "Drill history" card after the dashboard: last 15 sessions (date, bank, scope, score, acc%, q/m) + Export CSV / Export JSON as client-side Blob downloads — no server round-trip, data straight from `S.quantLog`. Pure helpers `_quantHistoryRows` / `_csvCell` / `_quantHistoryCSV` with 6 new unit tests |
| F | ✅ done | Tagging-unlocks-analytics nudge | One dim line in the paste-importer copy: topic tags unlock the dashboard, weak-topic drills, and per-topic analytics; plain `Q\|A` banks drill fine but stay analytically thin |
| G | ✗ declined | Zero-dependency bundle via PyInstaller | Unchanged — documented option, not the default (see §4) |

Effort was small for A–D and F; E was medium; G is explicitly *not* recommended as
the default (see §4).

---

## 4. Containerization — appropriateness audit (the important one)

**The brief said: "containerize into a singular container I can double-click and use,
but still local-only." The right container here is a macOS `.app` bundle — not Docker.**

Why Docker is the wrong tool for *this* app:
- **It would break the app's whole point — local reach.** Studium's value is host-file
  integration: it reads `~/.../Quant Prep/problems.json`, reads/writes
  `Quant_Themes.tex`, and opens `26X_Tracker.xlsx`. A container can't see those without
  broad host mounts — which re-introduces exactly the "overreach" you want to avoid.
- **macOS-only primitives don't exist in a Linux container.** The Keychain helper
  (`security` CLI) and `open` (open-tracker) are macOS. In a container, keys would
  fall back to env vars/files — strictly *less* secure than the current Keychain design.
- **Docker Desktop is not lightweight and not double-click.** It's a background VM
  (hundreds of MB) requiring a daemon — the opposite of "double-click and use".

What we shipped instead (and why it satisfies every constraint):
- **The `.app` bundle *is* the container.** One icon, double-click, runs. `index.html`
  + `studium_server.py` are bundled inside `Contents/Resources`; nothing else to
  install but a Python 3 that macOS dev tooling almost always already provides.
- **Local-only is enforced, not promised:** the server binds `127.0.0.1` only;
  `do_OPTIONS` and `_check_origin` reject cross-origin (verified: 403); the proxy's
  `validate_target_url` blocks private/link-local/cloud-metadata targets; the
  problem-bank reader is path-sandboxed to the home root. The *only* outbound traffic
  is HTTPS to the AI provider **you** configure — which is the feature, not a leak.
- **Lightweight & double-click:** `Build Studium App.command` → double-click →
  `Studium.app` appears in this folder → double-click to use.

Residual caveat (documented, not blocking): the bundle relies on a system `python3`.
Making it *truly* zero-dependency means embedding a Python runtime (PyInstaller / a
codesigned bundle) — heavier, needs notarization to dodge Gatekeeper, and buys little
for a single-user local tool. That's Task G: keep as a documented option, not the default.

---

## 5. Appropriateness of the tasks vs. Studium's nature

Studium is a **single-file, local, AI-optional study app**; the Quant Drill is its
**quant-interview-prep** surface. Measured against that:

- **In-scope and reinforcing the mission:** Tasks A, B, C, F and everything shipped in
  §1. They make fast, grounded, analytics-honest reps easier — the drill's reason to
  exist. The analytics work specifically serves the "close the loop on weak areas"
  goal the priority model already encodes.
- **Useful but guard the scope:** Task E (history/export). A study journal is on-mission,
  but it must stay client-side and lightweight — no server persistence, no account, no
  dependency. Cap it like `S.quantLog` already is.
- **Out of scope / declined:** Docker, and Task G as a default. Both pull against
  "local, lightweight, double-click." Recorded so they aren't re-litigated.

No task added this session introduces a network dependency, a build toolchain, or a
non-stdlib runtime requirement — consistent with the project's "stdlib-only Python +
one HTML file" constraint.

---

## 6. How to verify

```bash
node tests/quant.test.js     # 88 passed, 0 failed (5 for _quantSessionBreakdown, 6 for the history/CSV helpers)
node tests/lint.js           # all checks passed (handler/id/state integrity)
python3 tests/test_server_security.py   # SSRF / body-cap (unchanged this session)

# Build & run the container:
#   double-click "Build Studium App.command"  → Studium.app appears here
#   double-click Studium.app                  → opens at http://127.0.0.1:58743
# Or run in place:
python3 studium_server.py    # then open http://127.0.0.1:58743/studium.html
```

Manual UX check: start a drill on a metadata-rich bank, mark a few answers *Sure*
and miss one, end the drill → the summary now shows the calibration line and the
weakest-first per-topic breakdown with per-topic **Drill** buttons.