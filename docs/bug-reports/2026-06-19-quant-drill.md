# Bug Report — Quant Drill (2026-06-19)

> **STATUS: RESOLVED & DEPRECATED — all issues fixed 2026-06-19.**
> Both bugs below were fixed the same day they were filed. This report is kept
> for history; the per-issue **✅ Fixed** boxes record exactly what changed and
> where. No open items remain — do not action this file further.

Running log of issues, flaws, and improvement ideas observed by the user while
using Studium. One section per issue: what was seen, where it lives in the code,
why it happens, and the smallest fix that closes it. "Cross-module reuse" notes
are included **only** where generalizing the fix has a real upshot — most fixes
should stay local to the Quant Drill.

Screenshots referenced below live in
`~/Desktop/Academics/Screenshots/` and are dated to this session.

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | KaTeX misrender (raw LaTeX leaks) | High | ✅ Fixed 2026-06-19 |
| 2 | Unfocused chapter numbers / titles | Medium | ✅ Fixed 2026-06-19 |

---

## BUG-1 — Misrendering KaTeX in Quant Drill

- **Severity:** High (questions are unreadable / look broken)
- **Area:** Quant Drill — question prompt, answer reveal, AI coach panel
- **Evidence:**
  - `Screenshot 2026-06-19 at 14.50.23.png` — prompt shows literal
    `\textbf{Hint.}`, `\par`, `\$1`, `\$2` mixed into the question text.
  - `Screenshot 2026-06-19 at 14.54.45.png` — worse case: a full wall of raw
    LaTeX (`\textbf{Hint.}`, `\par\textbf{Explanation.}`, `\frac23`, `\$1`,
    `\par\textbf{Answer.}`, `\par\small\url(...)`) rendered verbatim with no
    math typesetting at all.

### What's happening

The drill renders the question with:

```js
// studium.html:5315 (renderQuantActive)
'<p class="math-rich" ...>' + esc(item.q) + '</p>'
```

KaTeX is applied afterward by `renderMathInElement` over `.math-rich`
([studium.html:2341-2346](../../studium.html#L2341-L2346)) using `_katexOpts`
([studium.html:2388-2405](../../studium.html#L2388-L2405)). Auto-render **only
typesets text that sits inside a delimiter pair** (`$…$`, `$$…$$`, `\(…\)`,
`\[…\]`). Everything else is left exactly as `esc()` produced it.

The bank questions in the screenshots are authored in **document-level LaTeX**
(a textbook/Green-Book-style export), not inline-math LaTeX. So:

1. Commands like `\textbf{…}`, `\par`, `\url(…)`, `\small` are **outside** any
   `$…$` delimiter → auto-render skips them → they print as raw backslash text.
2. `\$1` / `\$2` are an escaped dollar sign in LaTeX, but here they are *also*
   acting as accidental/half delimiters, which both prints the backslash and
   throws the `$…$` pairing off for the rest of the line.
3. Even bare math such as `\frac23` is not wrapped in `$…$`, so it never reaches
   KaTeX and prints literally.
4. Where a `$…$` pair *does* form around document-level commands, KaTeX has no
   `\par` / `\url` / `\textbf` in math mode; with `throwOnError:false` it
   renders them in error red rather than as intended.

Root cause in one line: **the app supports inline-math LaTeX only, but the bank
content is full LaTeX, and nothing normalizes the gap before KaTeX runs.**

### Fix

Add a single preprocessing pass — `_mathNormalize(raw)` — applied to bank text
*before* it goes into the `.math-rich` node, that:

- maps document-level markup to HTML: `\textbf{X}`→`<strong>`, `\textit{X}`/
  `\emph{X}`→`<em>`, `\par`→paragraph break, `\url{X}`/`\url(X)`→anchor,
  `\small`/`\large`→drop;
- unescapes `\$` → a literal `$` that is **not** treated as a delimiter (e.g.
  convert to `&#36;` so auto-render ignores it);
- wraps bare math runs (`\frac…`, `\sqrt…`, `^`, `_`, Greek macros) that are not
  already inside a delimiter in `\( … \)` so KaTeX picks them up;
- runs **before** `esc()`/insertion so the HTML it emits survives.

Apply it everywhere a bank field is shown: the prompt
([studium.html:5315](../../studium.html#L5315)), "You answered" / "Answer"
([studium.html:5327](../../studium.html#L5327),
[5330](../../studium.html#L5330)), and the missed-question list
([studium.html:5376-5377](../../studium.html#L5376-L5377)).

### Cross-module reuse (justified)

`_mathNormalize` has a **real** upshot beyond the drill: every `.math-rich`
consumer shares the same `renderMathInElement` + `_katexOpts` path and the same
blind spot — notably the quiz grader stream
([studium.html:2240](../../studium.html#L2240)), the Today panel, and the coach
panel ([studium.html:5110](../../studium.html#L5110)). Any of these can receive
model output or imported notes containing `\textbf`/`\par`/bare `\frac`. Putting
the normalizer next to `_katexOpts` and calling it from the shared render helper
fixes all of them in one place with no per-view duplication — this is the one
generalization worth making. Keep everything else in this report local to the
drill.

### ✅ Fixed — 2026-06-19

- Added **`_mathNormalize(raw)`** next to `_katexOpts` in
  [studium.html](../../studium.html): protects already-delimited math, escapes
  HTML, maps document-level LaTeX (`\textbf`→`<strong>`, `\textit`/`\emph`→`<em>`,
  `\url`→link with an `http(s)` scheme guard, `\par`/`\\`→breaks, sizing commands
  dropped), keeps `\$` a literal dollar via a `tex-literal` span, and wraps bare
  math (`\frac23`, `\alpha`, …) in `\( … \)`.
- Added `ignoredClasses: ['tex-literal']` to `_katexOpts` so the literal `$`
  can never be re-read as a delimiter.
- Wired it into every bank-content render site in `renderQuantActive` /
  `renderQuantSummary`: prompt, "You answered", "Answer", and the missed-question
  list (replacing the bare `esc(...)` calls).
- Verified with a Node harness over the exact screenshot strings: `\frac23`,
  the `\$1 … \$2` pair, `\par`/`\textbf`/`\url`, and non-math text like
  "Particle M0" all render correctly; `\url{javascript:...}` is not linked.

---

## BUG-2 — Unfocused chapter numbers / titles for missed questions

- **Severity:** Medium (readability / study UX, not correctness)
- **Area:** Quant Drill — AI "Verify & coach" panel, "Study next" section
- **Evidence:** `Screenshot 2026-06-19 at 15.38.32.png` — after a missed
  question, the coach's **Study next** list shows three numbered resources
  ("A Practical Guide to Quantitative Finance Interviews", "Game Theory Through
  Examples", "An Introduction to Game Theory") with chapter pointers. The list
  numbers and the book/chapter titles render as flat, same-weight serif prose —
  no visual hierarchy, nothing marking them as the actionable study targets.

### What's happening

The coach output is rendered by `_quantMdLite`
([studium.html:5076-5081](../../studium.html#L5076-L5081)):

```js
function _quantMdLite(s) {
  var h = esc(s || '');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  return h;
}
```

It only handles `**bold**` and `` `code` ``. The coach prompt
([studium.html:5067](../../studium.html#L5067)) asks for titles "by exact title
and a chapter/topic," and the model returns them as a **numbered list with
quoted titles** (`1. "Title" — Chapter on …`). Because:

- numbered list markers (`1.` `2.` `3.`) are passed through as plain text (no
  `<ol>`/indent), and
- quoted titles are not bold, so `_quantMdLite` gives them no emphasis,

the whole "Study next" block collapses into an undifferentiated paragraph held
together only by `white-space:pre-wrap` ([studium.html:5133](../../studium.html#L5133)).
The chapter numbers and titles — the parts the user actually needs to scan —
are the least visually distinct elements on screen. Hence "unfocused."

### Fix

Two small, local changes:

1. Teach `_quantMdLite` to render ordered/bulleted list lines: detect leading
   `^\s*\d+\.\s` / `^\s*[-*]\s` and wrap them in a styled `<ol>`/`<ul>` (tighter
   line-height, hanging indent) so each resource is its own row.
2. Emphasize titles: render `"…"`-quoted spans (and a trailing `— Chapter …`
   pointer) with a stronger weight / accent color so the title and chapter jump
   out. Optionally nudge the prompt at
   [studium.html:5067](../../studium.html#L5067) to wrap titles in `**bold**` so
   the existing bold rule already lights them up — the cheaper half of the fix.

Keep `$…$` handling intact: apply list/title styling line-by-line *before* KaTeX
runs over the panel, mirroring how `_quantMdLite` already preserves math
delimiters.

### Cross-module reuse

Low priority. `_quantMdLite` is deliberately a "lite" renderer scoped to the
coach panel; the rest of the app renders via `esc()` + KaTeX and has no shared
markdown layer to upgrade. Generalizing here would mean *building* a markdown
renderer the program doesn't currently have — out of proportion to the fix.
**Keep this one local to the drill.**

### ✅ Fixed — 2026-06-19

Rendering (`_quantMdLite`):
- Quoted resource titles → accented bold; `Chapter/Ch./Section N` references →
  highlighted; ordered/bulleted list markers → accented, so the reading **order**
  (1, 2, 3) is the most prominent thing on each line. `$ … $` math preserved.

Content / closing the loop (the extra ask this session):
- `_quantCoachSys` now requires **Study next** to be a *numbered, ordered* reading
  plan — each line gives the exact title **and a specific chapter number** — and
  to order items so the highest-leverage chapter for the student's **weak areas**
  comes first.
- `quantAIExplain` now passes the student's weakest topics (lowest accuracy
  first, from `_quantAnalytics()`) into the coach prompt so that ordering targets
  real gaps rather than guessing.

---

## Related improvement shipped this session — problem-bank retrieval no longer hardcoded

Not one of the two filed bugs, but fixed in the same session at the user's
request, so recorded here for completeness.

- **Was:** the drill always loaded a baked-in `problems.json` from a personal
  absolute path (`/Users/davidmukuruva/.../Quant Prep/Problem Bank/problems.json`),
  hardcoded in both the server default dir and the UI label.
- **Now:**
  - UI exposes an editable **bank-file field** (`quant-bank-file`, state
    `quantBankFile`, persisted to `localStorage` as `sd_quantbankfile`) — accepts
    a name, sub-path, or full path; remembered between sessions.
  - `importQuantProblemBank()` reads that user input when no explicit file is
    passed (recommendation flows still work via the `'problems.json'` fallback).
  - Server `QUANT_PROBLEM_BANK_DIR` default changed from the personal path to the
    **portable home directory** (still overridable via `STUDIUM_QUANT_PROBLEM_BANK`),
    and `_handle_quant_problem_bank` now resolves relative *and* absolute/`~`
    paths while keeping the sandbox: the resolved file must stay inside the root,
    allowed extension, no traversal. Verified relative/`~`/abs-in-root succeed and
    `/etc/...`, outside-root, and `..` are rejected.

✅ **Fixed — 2026-06-19.**

---

## Summary

| # | Issue | Severity | Fix scope | Generalize? | Status |
|---|-------|----------|-----------|-------------|--------|
| 1 | KaTeX misrender (raw LaTeX leaks) | High | `_mathNormalize` pre-pass | **Yes** — shared `.math-rich` path | ✅ Fixed 2026-06-19 |
| 2 | Unfocused chapter numbers / titles | Medium | `_quantMdLite` lists/titles + ordered weak-area plan | No — keep local | ✅ Fixed 2026-06-19 |
| + | Hardcoded problem-bank retrieval | — | user-input bank file + portable sandboxed root | n/a | ✅ Fixed 2026-06-19 |
