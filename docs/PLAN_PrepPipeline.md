# Studium Prep-Pipeline hardening — cycle-ready plan

*Drafted 2026-07-14 out of a `/pressure-test` of the whole Quant Prep framework (findings
in that session's report; framework-side fixes were applied directly in Quant Prep). This
file carries only the **Studium-side** items, staged for `project-cycle-loop` per the
constitution — David ratifies scope into a `GOALS.md` (Gate 0/1) before any cycle runs.
Follows the `docs/PLAN_Worklog.md` convention. Items H1–H3 are hygiene, not features —
they need David, not a cycle.*

## H — Hygiene (human, ~10 min total, do before any cycle)

- **H1 · Commit the working tree.** `studium.html`, `tests/quant.test.js`, `HANDOFF.md`
  modified + `CLAUDE.md`, `docs/PLAN_Worklog.md`, `tests/math.test.js` untracked — this
  includes the 2026-07-14 grader fix (braceless `\tfrac` marking correct answers wrong,
  ~377/982 bank problems latently affected) and behavioral fixes A–D (FSRS offline
  scheduler, cross-session drill memory, week selector, analytics reset). All tests green
  (quant 96/0, math 23/0, lint, parseJSON, cache, server-security — re-verified
  2026-07-14). One commit protects a month of fixes currently existing only on disk.
- **H2 · Rebuild the stale `Studium.app` bundle.** `Studium.app/Contents/Resources/index.html`
  is dated 2026-06-20 — it still *contains* the grading bug and the CDN-dependent FSRS.
  Double-click `Build Studium App.command`. (The `python3 studium_server.py` path is fine —
  it serves the live file; only the .app bundle is stale.)
- **H3 · Click "Reset analytics" once** (Drill-history card) — per HANDOFF 2026-07-14 (2)
  item D, the pre-fix grading bug poisoned `S.quantLog`; the weak-topic/calibration
  history is untrustworthy until cleared.

## C — Cycle candidates (3–7 tasks; all extend existing surfaces, no new deps)

1. **Mock-round instrument.** The new `Quant Prep/Mock Interviews/MOCK_SCRIPTS.md` defines
   a weekly mock with five 1–5 rubric axes (method, correctness, communication,
   speed/composure, calibration). Studium tracks Zetamac/80-in-8/Figgie (`SPEED_TYPES`)
   but has nowhere to log mock scores — the framework's weakest-leg metric would live in
   no instrument. Add a `Mock` entry (5 sub-scores + note + link to script used), persisted
   like `S.speedLog`, surfaced in the weekly-review export. *Done when:* a mock can be
   logged in <30s and appears in the assistant's week summary. *Fails if:* it grows
   scheduling/recording features (out of scope). **→ Fully specified, pressure-tested, and
   expanded (Tiers 1–3 + accessible alternatives) in `docs/PLAN_MockInterview.md`
   (2026-07-18); item 4b below is folded into that design's §3.5.**
2. **Add `sequences` to `SPEED_TYPES`.** (`tradermath` turned out to already exist —
   corrected 2026-07-14.) The 26-in-25 sequence drill is a gate with no instrument.
   *Done when:* loggable with a week-ramped target in `_speedTarget`.
3. **Retarget `/open-tracker`** from the deprecated `26X_Tracker.xlsx` to
   `System/metrics/week-NN.md` (already flagged in CLAUDE.md as W-C1-adjacent; belongs to
   whichever of this or the Worklog cycle runs first — do not implement twice).
4. ~~**PREP_SCHEDULE week-8+ mock ramp.**~~ *Done 2026-07-14 as a data-only edit
   (authorized; see HANDOFF update 3): weeks 3 + 8–12 `res` strings now point at
   `MENTAL_MATH_TRAINING.md`, the mock scripts, the tracker, and the countdown playbooks;
   `QUANT_LINKS` gained two 80-in-8 clones. Tests green.*
4b. ~~**Countdown-aware assistant.**~~ *Shipped 2026-07-20 as "Exam-Prep Mode"
   (authorized build-lock exception, ahead of the Optiver OA). `S.nextInterview` +
   countdown panel already existed; this session made `_prepAssess` **exam-aware** (live
   countdown → top rec/pivot + SCORE_LOG pointer), added the `oab` "Quant OA battery"
   playbook stage, and added `_examContext()` + `askExamFeedback()` (an "Ask AI — exam
   readiness" button feeding goals + logged scores + drill perf to `callAI`). Stayed
   within the non-goal (no calendar/notifications — the OS calendar owns reminders; this
   only reacts to a date). Tests 104/0 + lint green. See HANDOFF 2026-07-20.*
5. *(Carry-over, unchanged priority)* Quant_Themes integration items #1/#2/#4 from
   `Roadmaps & Guides/CLAUDE.md` (topic-tag joins instead of raw IDs, cue-only cloze
   export, taxonomy validation) — already flagged 2026-07-05, still open.

## Non-goals (anti-drift)

No mock *content* inside Studium (scripts stay in Quant Prep — library vs. trainer
separation); no scheduling/calendar features; no network deps; feature-freeze rules apply —
items 1–2 are instrumentation of already-sanctioned measurement surfaces, but David rules
on that at Gate 0, not this document.
