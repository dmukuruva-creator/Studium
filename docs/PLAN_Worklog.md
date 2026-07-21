# Studium Worklog — Pomodoro + Work-Efficiency Module (cycle-ready plan)

*Drafted 2026-07-12. This is the design spec for a delegated build via `project-cycle-loop`;
David ratifies it into `Studium/GOALS.md` before any cycle runs. It is the **one sanctioned
feature exception** to Studium's feature freeze (`Smart_AI_Usage_v2.md` §5): it builds the
measurement layer the whole framework's metrics depend on, and it stays inside the build
ration as delegated work — David gates, Claude builds.*

---

## 1. What it is

A Worklog surface inside Studium: a **Pomodoro timer bound to real tasks**, a **work-hours
log by lane/project**, and **efficiency analytics** that join logged focused time with the
productive output Studium already measures (drill accuracy, problems solved, calibration).
Local-first like everything else in Studium; exports feed the `/weekly-review` skill and the
26X tracker automatically.

**Why build this in Studium instead of adopting a Pomodoro app** (Session, Flow, Focus
To-Do, Super Productivity all exist and are fine timers): none of them can **join time with
output**. Studium already knows what you produced in a session (`S.quantLog`, per-topic
accuracy, the calibration line); putting the timer next to that data is the unique value —
efficiency = output per focused hour, computed, not felt. A standalone timer would log hours
and leave the join as manual work forever. The passive cross-check layer, however, is
**adopted, not built** (§6).

## 2. Data model

New store `S.workLog` (localStorage, included in the existing backup export round-trip),
one record per session:

```json
{
  "id": "wl_...", "kind": "pomodoro" | "manual",
  "ts_start": "...", "ts_end": "...",
  "planned_min": 25, "actual_min": 27, "pauses": 1,
  "task": "Green book ch. 4 timed set", "lane": "recruiting",
  "project": "Quant Prep", "src": "TODAY.md" | "adhoc",
  "focus": 4,                       // 1–5 self-rating at session end
  "output": {                       // auto-filled when the session wraps a Studium activity
    "problems": 12, "correct": 10, "drill_topic": "combinatorics",
    "cards_reviewed": 0, "proofs": 0, "pages": 0, "note": ""
  },
  "est_min": 30                     // optional pre-session estimate → effort-calibration gap
}
```

Lanes match the dispatcher's (`System/Constitution/Framework_Implementation_Report.md` §3.2): `human · recruiting
· research · math · gate · build · errand` — so Studium's hours roll up into the same
categories as the 26X replan quotas and the touch-time ratio. A gate review done under a
`lane: gate` pomodoro automatically supplies the touch-time denominator (this can eventually
replace the planned ration-meter hook).

## 3. The Pomodoro tracker (UI behavior)

- Timer widget available on every surface (Study home, Quant Drill, Library): 25/5 default,
  long break every 4, all configurable; visible count of today's completed pomodoros.
- **Start = bind to a task.** The picker offers today's dispatched tasks (from
  `System/tasks/TODAY.md`, served by a new sandboxed `GET /tasks/today` endpoint on
  `studium_server.py`, mirroring the `/quant/themes` pattern) plus free-text ad-hoc.
  Optional effort estimate (`est_min`) at start — feeds the v1 project-calibration habit.
- **End = one-tap close-out:** focus rating (1–5) + auto-captured output. If the pomodoro
  wrapped a Quant Drill run, `output` is filled from the drill's own stats with zero typing;
  otherwise two optional quick-count fields (problems/proofs/pages) and done.
- **Interruptions:** pause increments `pauses`; abandoning a pomodoro logs it as partial
  (honest data, no streak-gaming — an abandoned pomodoro is a datum, not a shame event).
- **Non-negotiable UX constraints** (Studium has fixed this class of bug before — reuse the
  Quant Drill patterns): the countdown must never wipe in-progress input anywhere in the
  app; timer state survives tab refresh (persist to `S.workLog` draft on every tick-minute);
  respects `prefers-reduced-motion`; keyboard accessible.

## 4. Efficiency analytics (the new view)

A Worklog tab inside the existing analytics surface, plus a weekly rollup. Metrics —
chosen to reward depth and honesty, per the v1 anti-goals (no raw-volume vanity):

| Metric | Definition | Serves |
|---|---|---|
| Focused hours by lane (day/week) | Σ actual_min of completed sessions | Replan §3 quota check — planned vs actual hrs/wk per primary |
| Plan adherence | pomodoros completed ÷ dispatched-task sessions planned | dispatch-vs-done (report §8) |
| **Output per focused hour** | depth-weighted output ÷ focused hours, by lane/topic | the actual "efficiency" number |
| Effort-calibration gap | mean \|est_min − actual_min\| ÷ est_min | the v1 project-calibration habit, now measured |
| Interruption rate | pauses + abandons per completed pomodoro | environment/defense signal |
| **Focus-by-hour histogram** | mean focus rating by time-of-day | **evidence for re-anchoring blocks when the employment schedule lands** — put deep work where measured focus is highest, not where habit put it |
| Touch-time contribution | gate/build-lane hours vs everything else | feeds the ≥10:1 ratio |

Guardrail: the view leads with output-per-hour and calibration, never with total hours or
pomodoro counts — hours are the denominator, not the score.

## 5. Export & integration (how the rest of the system consumes it)

- `studium_server.py` gains `POST /worklog/export` (and an auto-append on session close):
  writes/appends `System/metrics/worklog.jsonl` — same sandboxed-path discipline as the
  existing endpoints, path via `STUDIUM_WORKLOG` env (default `Academics/System/metrics/`).
- `/weekly-review` (skill S-5) reads the JSONL: hours-by-lane vs replan quotas, efficiency
  trends, focus histogram, effort-calibration gap → into the Monday review and the
  public-safe metrics render. The 26X tracker's "hours by track" column is now computed,
  not recalled.
- Backup round-trip: `S.workLog` included in Studium's export/import (extend the existing
  test).

## 6. Adopt, don't build: the passive cross-check layer

**ActivityWatch** (open-source, free, fully local — matches the privacy posture) runs as the
automatic tracker: window/app-level time capture with a local REST API. Its role is the
**honesty audit**: `/weekly-review` compares ActivityWatch's actual computer-time totals
against Studium's *logged* hours — the gap is unlogged drift (or untracked leisure), and a
persistently large gap means the log is fiction. This is be-your-own-oracle applied to
time-tracking: the intentional log (Studium) and the passive record (ActivityWatch) must
reconcile. Commercial alternatives (Toggl Track free tier, RescueTime paid) offer less for
this use and ship data off-device — skip.

Not built: idle detection, screenshots, browser extensions, any surveillance surface —
ActivityWatch covers passive capture; Studium stays the intentional layer only.

## 7. Delivery — two cycles, delegated

| Cycle | Scope | Done when |
|---|---|---|
| **W-C1: timer + log + export** | Pomodoro widget, task binding via `GET /tasks/today`, `S.workLog` + close-out flow, JSONL export, backup round-trip, tests (timer persistence, no input-wipe, sandboxed endpoints). Also: retarget `/open-tracker` to `System/metrics/` (the xlsx it opens was deprecated 2026-07-12; keep an "open historical xlsx" fallback) | A full day's sessions logged and exported with zero manual file editing; `node tests/*.test.js` green incl. new worklog tests |
| **W-C2: analytics + join + cross-check** | Worklog analytics tab (§4 metrics), auto-join with Quant Drill output, effort-estimate flow, ActivityWatch reconcile in `/weekly-review`, focus-by-hour view | One real week produces a weekly efficiency report consumed by `/weekly-review` automatically; drill sessions show output/hour with no manual entry |

**Definition of Done (module):** after one representative week, ≥80% of work sessions were
logged via the timer; the Monday review renders hours-by-lane vs the replan quotas,
output-per-hour, calibration gap, and the ActivityWatch reconciliation — all without David
editing a data file. **Definition of out-of-lane:** if this module starts growing team
features, cloud sync, or its own goal-setting UI, it has left its lane — the dispatcher owns
planning; Studium owns measurement. And measurement flows one way: Studium's logs (quant
drill, worklog) are **instruments feeding the canonical System store**
(`System/metrics/week-NN.md`, which superseded `26X_Tracker.xlsx` on 2026-07-12) — Studium
never becomes a second source of truth for hours, goals, or history.
