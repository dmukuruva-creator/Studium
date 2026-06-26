# HANDOFF — Quant Drill audit, improvements & containerization (2026-06-20)

Scope of this session: a deep audit of the **Quant Drill** (interface, functionality,
UI/UX) with concrete improvements **staged** for (a) intuition while using and
(b) usefulness/accessibility of the analytics; plus a lightweight, **double-click
container** for the app that stays strictly local; plus an appropriateness audit
of every follow-up task against Studium's nature as a *local quant-prep study app*.

Everything in §1 and §3 is in the working tree now. §2 is the audit. §4–§6 are the
appropriateness verdicts and the open task list.

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

| ID | Task | Why | Scope / files | Appropriate? |
|----|------|-----|---------------|--------------|
| A | Keyboard verbs for Skip/Hint (result-shown only, or `?`/`Tab`) | Completes the rapid-fire loop without fighting numeric answers | `renderQuantActive`, global keydown (`studium.html` ~7545) | ✅ Core to fast reps |
| B | Non-color skill cue in dashboard (skill label / `title`) | Accessibility; finishes the a11y pass | `renderQuantDashboard` | ✅ Cheap, on-goal |
| C | Persistent "Resume / Drill recommended" affordance atop `renderQuantHome` | Shortens path to the one thing that matters | `renderQuantHome` ordering | ✅ Intuition |
| D | "Time's up" beat before the timed summary | Removes the abrupt cut | `_quantTick` / `endQuantDrill` | ◐ Polish, low priority |
| E | Drill-history view + CSV/JSON export | Longitudinal insight; study journal | new render + small export helper; data already in `S.quantLog` | ◐ Useful but watch scope — keep it lightweight, no server round-trip |
| F | One-line nudge that tagging a pasted bank unlocks analytics | Sets expectations for plain `Q\|A` banks | `renderQuantHome` importer copy | ✅ Tiny |
| G | (Optional) Zero-dependency bundle via PyInstaller | Removes the "needs system python3" caveat | new build path | ✗ Heavyweight — see §4; document, don't default |

Effort is small for A–D and F; E is medium; G is explicitly *not* recommended as
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
node tests/quant.test.js     # 77 passed, 0 failed (5 new for _quantSessionBreakdown)
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
