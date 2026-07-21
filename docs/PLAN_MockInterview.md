# Mock Interview prep in Studium — pressure-tested design

*Drafted 2026-07-18. Expands `PLAN_PrepPipeline.md` items **C1 (Mock-round instrument)**
and **4b (Countdown-aware assistant)** into a concrete, staged wiring plan with the
analytics fleshed out and the "or use an accessible alternative" branch made explicit.
Staged for `project-cycle-loop` — David ratifies scope into `GOALS.md` (Gate 0/1) before a
cycle runs. Nothing here is built ad hoc.*

---

## 0.0 — INITIATE NOW (post-`llm-council`, 2026-07-18) — the concrete, do-it-today plan

*An `/llm-council` second pass (2026-07-18) returned a 4-of-5 verdict: **the app is at risk
of being displacement activity; the scarce resource is a human mock, not code; analytics over
an empty log is "a spreadsheet admiring itself" (you have 0 logged mocks).** The full design
(§1–§6) stands, but the **build is deferred behind evidence**. Do this, in order:*

**This week — human lane, needs NO build-lock / `/frog` (it's not code):**
1. **TODAY — book the Center for Career Design mock.** Log into **Handshake** → request a
   30-min mock interview with a career coach, quant-trading focus (or email
   `careerdesign@dartmouth.edu`; office 63 S. Main St.). In the request, name
   `Quant Prep/Mock Interviews/MOCK_SCRIPTS.md` (4 rounds + 5-axis rubric) + `BEHAVIORAL_BANK.md`
   as the interviewer brief. **Both briefs already exist and are ready — booking is fully
   unblocked.** This is the single highest-leverage action; slots fill, so lead time is the
   constraint.
2. **This week — the instrument is PAPER, not code.** The "Mock log" for the first ~3–5 mocks
   is one sheet: the 5 rubric axes (Method · Correctness · Communication · Speed/composure ·
   Calibration, 1–5) + firm + note, copied straight from `MOCK_SCRIPTS.md`. Ships in 10
   minutes, survives contact with reality, and *proves* whether an in-app version is worth a
   build gate.
3. **Before the CCD mock — one free rep, out loud:** a **QuantBrainteasers** timed mock (free
   + readiness score) or one **Figgie** round + one **80-in-8** run. Reps, not planning.
4. **Log each mock's 5 axes into `System/metrics/week-NN.md`** — the weekly review already
   ingests it; that *is* the instrument until code exists.

**Deferred — build, gated, needs a `/frog` daily log + a delegated cycle:**
5. **After ~5 logged mocks:** open **Cycle A — Tier 1 Mock log** in Studium (§2). The paper
   rubric's friction is the trigger; don't build the analytics dashboard over an empty log.
6. **Then Tier 2 (market-making-first, §2/§6)** — but at the gate, first satisfy the
   Contrarian's challenge (§4-A1): show the deterministic-P&L text mock beats *just playing
   Figgie*, or don't spend the gate. **Resolved decision:** compute the **Calibration** axis
   from the drill's existing "sure-but-wrong" data (`S.meta.calibration`), don't rely on pure
   self-rating (council: self-rated axes decay into vanity numbers; the objective join is the
   one with teeth).

**Done this session:** Pramp purged from `studium.html` + `Quant Prep/{CLAUDE.md, Mock
Interviews/MOCK_SCRIPTS.md, Roadmaps & Guides/TRADING_PREP_MATERIALS.md}` and replaced with
Career Design + QuantBrainteasers (verified live). Studium lint + tests green.

---

## 0. The problem, stated honestly

The `Quant Prep/Mock Interviews/README.md` names the gap precisely: **the bank builds
*solving*, the trainers build *speed*, but neither builds *performing under interview
conditions*** — and the still-open P0 is **sourcing real mocks**. Studium tracks
Zetamac / 80-in-8 / Figgie (`SPEED_TYPES`) but has **no instrument for mock performance**,
so the framework's weakest-leg metric (the 5-axis rubric in `MOCK_SCRIPTS.md`) currently
lives in no file the assistant or weekly review can see.

"Wire a Mock Interview prep function with strong analytics" therefore splits into two
questions that must be answered separately:

1. **What can Studium legitimately *be* for mocks** without breaking its nature (local,
   single-file, stdlib-Python, no deps, library-vs-trainer separation)?
2. **Where do real mocks actually come from** — because the highest-value mock is a human
   on the other side, and no local app manufactures that.

The design below answers both. It is deliberately **three tiers, each independently
shippable and each with a hard stop** where it would start reinventing something better
done elsewhere.

---

## 1. Boundary conditions (inherited, non-negotiable)

From `CLAUDE.md` + `PLAN_PrepPipeline.md` non-goals — any design that violates one of these
is rejected before it's scored:

- **No mock *content* inside Studium.** The 4 scripts stay in `MOCK_SCRIPTS.md` (library
  vs. trainer separation). Studium *runs* and *scores*, it does not *store the questions*.
- **No scheduling / calendar / notifications.** The OS calendar + `/today` own reminders.
- **No new runtime deps, no build step, no server-side persistence.** Client-side state
  (localStorage, the `S.speedLog` pattern) + the existing AI proxy only.
- **Analytics are an instrument, never a second source of truth.** Mock axis scores feed
  `System/metrics/week-NN.md` and the weekly review; they don't replace it.
- **Tests + lint stay green.** Every pure helper is top-level and unit-tested (`_mock*`).

---

## 2. The design — three tiers

### Tier 1 — The Mock instrument (the must-build; = C1)

**What:** a `Mock` log alongside `S.speedLog`. After running any script from
`MOCK_SCRIPTS.md` (with a peer, alone-recorded, or Tier-2 AI), you log:

- round type (Prob screen · Market-making · Betting/calibration · Behavioral · Full superday),
- the **five 1–5 axes** verbatim from the rubric (Method · Correctness · Communication ·
  Speed/composure · Calibration),
- optional firm tag + a one-line note + which script was used.

**State:** `S.mockLog` → `sd_mocklog`, capped like `S.quantLog` (300). Pure helpers
`_mockAgg(log)`, `_mockAxisTrend(log, axis)`, `_mockReadiness(log)`; a `renderMockLog`
card and a `logMock()` form. Reuses the `logSpeedScore` / `_speedPerf` shape exactly.

**Done when:** a mock is loggable in <30 s and shows up in the assistant's week summary and
the weekly-review export. **Fails if:** it grows recording/scheduling/content features.

**Why this first:** zero deps, zero AI, closes the "metric lives nowhere" hole, and every
higher tier writes into the same log. High value, low risk, ~½ a cycle.

### Tier 2 — AI interviewer mode, text (the "performing" surrogate)

**What:** an in-app, timed, structured mock that plays the interviewer through the
**existing AI proxy** (same path as `streamGrade` / the quant coach — no new call path).
Four modes, mapped to the four scripts:

| Mode | How the AI drives it | Reuses |
|---|---|---|
| **Probability screen** | Serves one brainteaser at a time, demands narration, asks one follow-up ("now with a biased coin?"), refuses to reveal until you commit | `renderMockExam` flow + `_quantCoachSys` persona |
| **Market-making game** | Streams a scenario ("I'll trade the sum of 3 dice; make me a market"), takes your bid/ask, sends *informed* flow, tracks a simple position/P&L, penalises frozen quotes | new `_mockMarket` state machine (bounded, deterministic P&L) |
| **Betting / calibration** | Poses estimation bets, forces a probability + size, scores Brier-style | existing calibration plumbing (`S.meta.calibration`) |
| **Behavioral** | Pulls *your* STAR slots from `BEHAVIORAL_BANK.md` by title only, asks, critiques structure (S-T-A-R completeness, specificity) | text-only, no content stored in-app |

At the end, the AI **scores all five rubric axes with justification**, and the scores
**pre-fill the Tier-1 log** (you can override — human calibration wins). Misses → review
cards via the existing `_upsertReviewCard`.

**Done when:** a full round runs end-to-end, produces 5 axis scores + per-axis feedback,
and one click logs it. **Fails if:** the AI market-maker's P&L can't be made deterministic
and honest (see pressure test §4) — then ship Prob/Behavioral only and leave MM to a human.

### Tier 3 — Voice / true realism (explicit non-build)

Real-time spoken mock (barge-in, latency pressure, tone) is **out of scope for a local
single-file stdlib app** — it needs streaming audio I/O, a realtime model, and a media
pipeline that violates the no-deps / no-build constraints. **Do not build it.** This is
exactly what the "accessible alternatives" in §5 are for. If voice ever matters enough,
it's a *separate* tool, not a Studium feature (skills-before-products rule).

---

## 3. "Strong analytics" — made concrete

Vague "analytics" is a trap; here is the exact instrument set, all from `S.mockLog`:

1. **Axis profile over time** — a small multiples / radar of the 5 axes across your last
   N mocks (non-color-safe: number + bar per axis, per the a11y convention already in the
   quant dashboard). Answers "which axis is my ceiling?"
2. **Weakest-axis → action handoff.** Lowest axis names the next move on-screen:
   Correctness↓ → weak-topic drill; Communication↓ → record-and-narrate; Speed↓ → 80-in-8;
   Calibration↓ → the existing overconfidence card. One click, not buried.
3. **Calibration join.** Mock "Calibration" axis + the drill's "sure-but-wrong" number
   (`S.meta.calibration`) shown together — the single costliest interview failure mode,
   now measured from two independent instruments.
4. **Readiness by round type.** Not one blob: separate rolling scores for Prob / MM /
   Betting / Behavioral, so "ready for a JS phone screen" ≠ "ready for an Optiver MM round."
5. **Countdown-aware surfacing (= 4b).** When `S.nextInterview` is set, the assistant
   promotes the matching `INTERVIEW_COUNTDOWN.md` playbook row *and* the readiness for
   **that** round type at T-7 / T-3 / T-1. Clearing the date restores normal week logic.
6. **Weekly-review + export.** Axis scores flow into `System/metrics/week-NN.md` and the
   existing CSV/JSON export — a real longitudinal record of the weakest leg.

---

## 4. Pressure test (assumptions → attacks → verdict)

**A1 — "An LLM can be a credible market-making interviewer."**
*Attack:* a text LLM can't reliably run a live order book, track P&L across turns, or price
adverse selection consistently; it will hallucinate fills and contradict its own blotter,
teaching *wrong* habits — worse than no mock.
*Verdict: PARTIALLY SURVIVES.* Mitigation: the **P&L and position are tracked in JS
deterministically** (a bounded `_mockMarket` state machine), and the LLM only supplies
*flow and commentary*, never the accounting. Unit-test the P&L. If that separation proves
clean, ship MM; if not, **cut MM from Tier 2** and route it to a human (§5). Prob screen,
betting, and behavioral don't have this problem — the AI's job there is questioning and
rubric-scoring, which it does well.

**A2 — "AI rubric scores are trustworthy enough to track."**
*Attack:* LLM self-scoring is noisy and inflates; a trend built on it is fiction.
*Verdict: SURVIVES with a guardrail.* The AI score **pre-fills but never overrides** the
human score in the Tier-1 log; the log records which was used. Treat AI scores as a *draft*,
human/peer scores as ground truth — and the analytics can filter to human-scored mocks only.

**A3 — "The performing gap is closable in-app at all."**
*Attack:* typing at your own pace with no human across the table isn't "performing under
pressure" — the thing the README says is missing.
*Verdict: SURVIVES, narrowly.* Tier 2 closes the *structure/narration/rubric* half (real
value: reps on saying the recurrence out loud, committing to a market, STAR completeness).
It does **not** close the *human-pressure* half — and the plan doesn't claim to. That half
is §5's job. Being explicit about this is what keeps the feature honest.

**A4 — "This stays inside the boundary."**
*Attack:* AI interviewer + P&L engine + voice temptation = scope creep into a network-heavy
product.
*Verdict: SURVIVES* iff Tier 3 is held as a hard non-build and MM P&L stays local/deterministic.
The tiering exists precisely so the cycle can stop after Tier 1 and still have shipped real
value.

**A5 — "Sourcing real mocks (the actual P0) is addressed."**
*Attack:* building an app feature is the *easy* substitute for the *hard, correct* action —
getting real humans to mock you.
*Verdict: this is the sharpest risk.* The instrument must **not** become an excuse to skip
real mocks. Mitigation: Tier 1's log treats a **human/peer mock as the gold standard row**
and the assistant nudges "≥1 human-scored mock this week" — the app measures the real thing,
it doesn't replace it. §5 is therefore **first-class, not a footnote.** ⚠ *Updated by the
2026-07-18 pressure-test (F9): this mitigation is currently **unfunded** — no reliable human
quant-mock source is verified (Pramp doesn't serve quant). See §5a: the channel must be stood
up and one mock completed before this verdict holds.*

**Overall verdict:** Tier 1 is unambiguously worth building. Tier 2 is worth building for
Prob/Betting/Behavioral; MM is conditional on the deterministic-P&L test. Tier 3 is a
non-build. The plan survives if §5 is pursued **in parallel**, not deferred.

---

## 5. Accessible alternatives — tailored to your case (VERIFIED 2026-07-18)

You are recruiting for Summer-2027 quant off a Dartmouth '27 base; the four round types map
to concrete, mostly-free sources. **The app is the trainer/instrument; these are the mocks.**
*Every entry below was re-verified live on 2026-07-18 (see `/pressure-test` findings in the
2026-07-18 HANDOFF note). The original draft's Pramp recommendation was **retracted** — it is
now Exponent, SWE/PM-only, and its AI mock was deprecated (F1); the live quant-specific
leaders it omitted are added here (F2).*

| Round type | Best accessible mock (ranked, verified) |
|---|---|
| **Mental-math / cognitive OA** | **Optiver 80-in-8** free clones — QuantVault (no-login, format "verified June 2026"), EverythingQuant, QuantPrep, OpenQuant "Quant Game Room" — + the two clones already in `QUANT_LINKS`; **Zetamac** at overload config; sequence sets. These *are* the real OA format (which now bundles cognitive games like Zap-N — see `INTERVIEW_COUNTDOWN.md` Playbook A). Closest realism of any tier, free. |
| **Probability phone screen** | **QuantBrainteasers** (quantbrainteasers.com — timed mock mode with a **readiness score** + instant feedback, free tier) · **QuantGuide** (quantguide.io — hundreds of prob/brainteaser problems w/ video; your bank already derives from it) · **PuzzledQuant** (firm-tagged *question* source + newsletter — **not** a live mock partner) · a **peer** running `MOCK_SCRIPTS.md` Mock 1 over a call (source = §5a). ~~Pramp~~ retracted (F1). |
| **Market-making game** | A **friend running Mock 2** from the script (zero prep — the rubric is on the page) · **Figgie** (figgie.com + iOS/Android; already a `SPEED_TYPES` gate) for live MM intuition · **IMC Prosperity** — *annual* algo-MM challenge; Prosperity 4 ended Apr 2026, **next window ≈ Apr 2027** (well-timed for the Summer-2027 cycle), not available now. |
| **Betting / calibration** | Mock 3 with a peer · self-run estimation bets logged Brier-style · poker EV drills (`The Mathematics of Poker`). |
| **Behavioral / fit** | Record yourself answering `BEHAVIORAL_BANK.md` on your phone, score STAR completeness cold the next day · one peer swap. **Exponent** (formerly Pramp — generic behavioral/delivery reps only, no quant) or plain Zoom-record for delivery. |

### 5a. The human-mock channel is an unverified P0 (F9) — resolve before relying on §6's loop

The pressure-test's sharpest finding: the "one human-scored mock/week" loop (§6) currently
has **no verified reliable source of a human quant counterpart** — Pramp doesn't serve quant,
and no standing quant-mock-matching community was found. This must be *actively stood up and
verified*, as a **human-lane action, not an engineering task**, before it's treated as a
backstop. Channels, ranked by leverage:

1. **Dartmouth Center for Career Design (PRIMARY).** Schedule a mock through the career
   center — a real practitioner/advisor, a booked slot (institutional accountability the
   weekend self-mock lacks), and they'll run *your* material: bring `MOCK_SCRIPTS.md` (the 4
   rounds + rubric) and `BEHAVIORAL_BANK.md` so the advisor uses the right quant questions,
   the 5-axis metric, and the firm context. This converts "find a human" from a cold-outreach
   gamble into a **bookable appointment** — the strongest available channel. *Action: check
   the Center's booking system for the first open mock-interview slot and reserve it; attach
   the two files as the interviewer brief.*
2. **Dartmouth-local peers:** Math/CS depts, a quant/trading club, or classmates also
   recruiting for 2027 — a standing weekly swap costs them nothing (rubric is on the page).
3. **Broader:** Wall Street Oasis + r/quant "mock swap" threads; QuantNet forums.
4. **Fallback if no human lands:** the **Tier-2 AI interviewer becomes the primary mock
   partner**, not a surrogate — which raises the stakes on assumptions A1/A2 and is the reason
   to build it. QuantBrainteasers' readiness-mock is the interim external stand-in.

**Verify one channel actually works (one completed mock) before §6 assumes it exists — and
the Center for Career Design booking is the fastest path to that.**

**The tailored move:** run **one human-or-recorded mock per week** (the weekend slot the
README already defines), score it on the 5 axes, log it in Studium (Tier 1), send misses to
cards. That is the whole loop — the app makes it *measured and un-aspirational*; the humans
and the official OAs make it *real*. When a round gets a date, `INTERVIEW_COUNTDOWN.md` +
Studium's countdown (4b) pick the right playbook.

---

## 6. Staging (maps onto existing cycle items)

- **Cycle A (½–1 cycle): Tier 1 instrument** — this *is* `PLAN_PrepPipeline.md` C1, now
  fully specified above. Ship first. Human/peer mock = gold-standard row.
- **Cycle B (1 cycle): Tier 2 AI interviewer** — **staging revised by the 2026-07-18
  pressure-test (F5):** the generic *probability-screen* mock is now commoditized by free
  external tools (QuantBrainteasers' readiness-mock), so it is the **weakest** build case;
  the **market-making** mode is the one no free tool does well and is Studium's real
  differentiation. Build order therefore leads with **MM** (once its deterministic-P&L unit
  test passes, A1) + Behavioral; build the Prob-screen mode **only if** the external tools
  prove insufficient. Gated review with prediction-before-reveal per `/gate2`.
- **4b Countdown-aware assistant** — already staged; folds `S.nextInterview` into the
  round-type readiness (§3.5). Can ride Cycle A.
- **Non-build:** Tier 3 voice. Recorded as declined here so it isn't re-litigated.
- **In parallel, human lane (not a cycle) — now the gating P0 (F9):** stand up and *verify*
  the §5a human-mock channel (one completed peer mock) before the §6 weekly loop assumes it
  exists. This is a David action, not an engineering task, and per the pressure-test it is
  the single least-funded assumption in the whole design.

*Ready for `/gate2` scope ratification or an independent `/llm-council` / `/pressure-test`
pass before any cycle opens.*
