> **ARCHIVED — historical (2026-06).** This critique predates the proxy/security
> fixes (server-side AI proxy, SSRF + body-size guards) and references files that
> no longer exist (`studium.jsx`). It is superseded by `TASK.md` and the project
> audit. Kept for context only; do not treat its "what's broken" list as current.

# Studium — Brutal Critique & Improvement Plan

A rigorous teardown of the current build, why the AI calls are silently failing, and a concrete path to a genuinely AI-native study app. Findings are grounded in the actual source: `studium.jsx`, `studium.html`, and `studium_server.py`.

---

## TL;DR — what's actually broken

1. **OpenAI (and OpenAI-compatible) calls cannot work from the browser.** `api.openai.com` does not return CORS headers for browser origins. Every GPT-4o / GPT-4o-mini / OpenRouter call from `fetch()` dies as a `TypeError: Failed to fetch`. This is the single most likely reason "AI calls aren't returning output."
2. **At least one shipped model ID is fictional.** `claude-opus-4-5-20251101` is not a real Anthropic model string (the real Opus is `claude-opus-4-6`). Selecting Opus → instant 404. Same risk for the OpenRouter slugs (`qwen/qwen3.5-32b` mislabeled "Qwen3.5 122b", `openai/gpt-oss-120b`, `google/gemma-3-27b-it`).
3. **Auto-fallback only triggers on rate-limits**, so a CORS failure, 401, or 404 throws straight to an `alert()` instead of trying the next provider. The user sees "generation failed" with an opaque message and no recovery.
4. **No request timeout or `AbortController`.** A hung connection spins the loader forever — literally "not returning output."
5. **Critical security hole:** the local keychain server returns your *plaintext API keys* over HTTP with `Access-Control-Allow-Origin: *`. Any website open in your browser can `fetch('http://127.0.0.1:58743/keychain/keys')` and exfiltrate every key while Studium is running.
6. **Two divergent codebases** (`studium.jsx` 1,415 lines and `studium.html` 2,480 lines) implement the same app differently — the HTML one even has streaming the JSX lacks. They will drift apart forever.

---

## 1. Why the AI calls fail (root-cause, by provider)

### OpenAI / OpenAI-compatible — CORS wall (the big one)
`studium.jsx:99` and `studium.html:614` call `https://api.openai.com/v1/chat/completions` directly from the page. OpenAI does **not** send `Access-Control-Allow-Origin` for browser requests, so the fetch is blocked before a response is ever read. Anthropic explicitly supports this via the `anthropic-dangerous-direct-browser-access` header (which you correctly set) — OpenAI has no equivalent. Result: GPT-4o looks "selected and unlocked" but never returns. OpenRouter *does* allow browser CORS, so the free models may work while GPT-4o never does — confusing, inconsistent behavior.

**Fix:** proxy OpenAI (and ideally all providers) through your existing local Python server. You already run a server on `:58743`; add a `/proxy/openai` route that forwards the request server-side. This also gets your keys out of the browser entirely (see §3).

### Anthropic — bad model ID
`MODELS` ships `claude-opus-4-5-20251101` (`studium.jsx:10`, `studium.html:187`). That string doesn't exist; the API returns 404 `model: ...not found`. Sonnet (`claude-sonnet-4-6`) and Haiku (`claude-haiku-4-5-20251001`) are plausibly valid, so "Anthropic sometimes works, Opus never does" is the tell.

**Fix:** verify every ID against the provider's `/models` endpoint at startup and disable/relabel any that 404. Never hard-code speculative future IDs.

### Google — usually works, but fragile
Direct browser calls to `generativelanguage.googleapis.com` generally pass CORS, but the API key is in the URL query string (`studium.jsx:111`) — it lands in logs, history, and `Referer` headers. Also no `safetySettings`, so academic content (anatomy, chemistry, history of conflict) can trip `blockReason` and you surface a bare "No response from Gemini."

### The fallback logic makes all of the above worse
`callAI` (`studium.jsx:140-165`) only advances to the next model when `isRateLimit(e)` is true. CORS errors, 401 (bad key), 404 (bad model), 5xx, and timeouts all `throw e` immediately. So the one feature meant to provide resilience does nothing for the failure modes you actually hit.

**Fix:** fall back on *any* retryable error (network/CORS/5xx/429), distinguish *fatal* errors (401 bad key → tell the user to fix the key; 400 → log the payload), and surface a structured error object instead of `alert(e.message)`.

### No timeouts
None of the four `fetch` calls pass a `signal`. Add `AbortController` with a sensible deadline (e.g. 60–90s) and a visible "still working… cancel?" affordance.

---

## 2. Reliability of the generation pipeline

- **JSON-by-prompt is brittle.** Every generator begs the model to "Reply ONLY with valid JSON" and then runs a 40-line `parseJSON` repair gauntlet (`studium.jsx:167-206`). This is a workaround for not using the platforms' native structured-output features. Use them instead:
  - OpenAI: `response_format: { type: "json_schema", json_schema: {...} }`
  - Anthropic: tool-use with an `input_schema`, then read `tool_use.input`
  - Gemini: `responseMimeType: "application/json"` + `responseSchema`
  These *guarantee* parseable, schema-valid output and delete most of `parseJSON`.
- **Token truncation corrupts output.** Quiz `max_tokens` is `quizCount*260` (`studium.jsx:1349`). A 16-question quiz with verbose answers can exceed that, and the JSON gets cut mid-string → parse failure → "generation failed." Budget generously, or stream and assemble.
- **Whole-document truncation loses content.** `trimDoc(text, 5200)` (and 4600/3600 elsewhere) just slices the first N characters. A 40-page PDF is silently reduced to its first few pages. Quizzes then "miss half the material" — a correctness bug masquerading as a model limitation. This needs chunking/retrieval (see §4).
- **`d.content[0].text` assumes a text block.** If Anthropic returns a non-text first block (tool use, or `stop_reason: "max_tokens"` edge cases), this throws. Guard it.
- **No retries with backoff.** Transient 529/503 from any provider = hard failure.

---

## 3. Security & privacy (this is the part to fix today)

The local helper (`studium_server.py`) is the weak point:

- **`GET /keychain/keys` returns all secrets in plaintext** (line 109-112) and **every response sets `Access-Control-Allow-Origin: *`** (line 84). Combined, *any* page in your browser — an ad iframe, a malicious tab — can read `http://127.0.0.1:58743/keychain/keys` cross-origin and steal your Anthropic/OpenAI/Google keys while Studium is open. This is a real, exploitable key-exfiltration vector.
  - **Fix:** drop the wildcard CORS entirely (the app is same-origin with the server). At minimum, validate the `Origin`/`Host` header and reject anything that isn't the app itself. Better: require a per-launch secret token (printed by `Studium.command`, injected into the page) on every `/keychain/*` request. Never expose a GET that echoes secrets — only let the page *use* keys via a server-side proxy, so the browser never holds them.
- **Keys live in browser memory and go out on every direct API call.** Any XSS or rogue browser extension can read them. Routing all model calls through the local proxy means the browser holds no secrets at all.
- **No bind-address hardening / no auth.** You bind `127.0.0.1` (good) but anything on the machine can hit it. The token approach closes this.
- **Google key in URL** (§1) — move to a server-side proxy or at least a header.

---

## 4. Architecture & maintainability

- **Kill the dual codebase.** `studium.jsx` and `studium.html` are the same product implemented twice and already out of sync (HTML has `streamGrade`; JSX doesn't). Pick one source of truth. Recommended: keep a real source (JSX/TS) and *build* the standalone `studium.html` from it (esbuild/vite single-file bundle). Hand-maintaining a 2,480-line HTML file is how bugs like the fictional model ID end up in only one place.
- **No build, no types, no tests.** A 1,400-line single file with dense one-liners (`studium.jsx:1349` is one statement spanning a full quiz pipeline) is unreviewable. Introduce TypeScript for the model/response contracts and a handful of unit tests around `parseJSON`, `studySections`, and `quizQuestionCount`.
- **`migrateModelId` silently downgrades to `MODELS[0]`** for any unknown ID — so a renamed model quietly becomes Sonnet without telling the user.
- **`localStorage` for everything**, including full document text (`sd_docs`). Large PDFs will blow the ~5MB quota and throw on write, silently losing data. Move documents to IndexedDB.
- **No error boundary / telemetry.** When a generation fails you `alert()`. You can't see *why* across users. Add a console-visible structured error log and an in-app error panel.

---

## 5. Maximal AI-nativity — where this should go

Right now the AI is a one-shot "text in, JSON out" box. An AI-native study app should be adaptive, grounded, and conversational. In rough priority order:

1. **Server-side proxy + native structured outputs.** (Foundational; fixes §1 and §2.) One `/proxy/:provider` route, JSON-schema/tool-use responses, streaming passthrough. Everything below depends on this.
2. **Streaming everywhere.** The HTML build already streams grading — extend SSE streaming to quiz/flashcard/map generation so the UI fills in progressively instead of a frozen spinner. This alone makes it *feel* like it's "returning output."
3. **Retrieval over truncation.** Chunk documents, embed them (e.g. an embeddings endpoint), and retrieve the top-k relevant chunks per question/section instead of `slice(0, 5200)`. This is the difference between "quizzes the first 3 pages" and "quizzes the whole course." Cache embeddings by document hash.
4. **Grounded generation with citations.** Have the model cite the source section/offset for each question and flashcard (you already compute `studySections` with offsets — feed those IDs in and require them back). Show "from §2.3" on each card. Kills hallucinated questions.
5. **Adaptive practice / spaced repetition.** You store a `mastered` flag but never schedule with it. Implement SM-2 (or FSRS) so flashcards resurface on a real forgetting curve, and let the quiz generator *target the user's weak topics* using `hist` (their past scores by topic) instead of generating blind.
6. **A tutor chat per document/section.** A conversational "explain this," "quiz me harder," "why was my answer wrong" loop grounded in the retrieved chunks — the natural Aorm for AI-native studying. Reuse the grader's rubric as tool-use.
7. **Multimodal ingestion.** PDFs are flattened to text via PDF.js, so diagrams, equations-as-images, and figures are lost. Send page images to a vision-capable model for figure-heavy material (anatomy, circuits, plots).
8. **Caching of generated artifacts** keyed by `(docHash, section, model, task)` so re-opening a deck doesn't re-bill and re-wait.
9. **Difficulty calibration & answer-aware hints.** Use the model to tag each item's Bloom's level and adapt count/depth to measured performance rather than the heuristic word-count formula in `quizQuestionCount`.

---

## 6. Prioritized action list

**P0 — do this first (correctness + security)**
- [ ] Add a server-side `/proxy/:provider` route; route OpenAI + OpenAI-compatible through it (fixes the CORS dead-end). Move all keys server-side.
- [ ] Remove `Access-Control-Allow-Origin: *` from the keychain server; add an origin/host check + per-launch token. Stop returning secrets over GET.
- [ ] Fix/verify all model IDs at startup against each provider's `/models`; replace `claude-opus-4-5-20251101`.
- [ ] Add `AbortController` timeouts (60–90s) and a Cancel button to every AI call.
- [ ] Make `callAI` fall back on network/CORS/5xx (not just 429) and distinguish fatal 401/400 with actionable messages.

**P1 — reliability**
- [ ] Switch to native structured outputs (JSON-schema / tool-use / responseSchema); shrink `parseJSON` to a fallback.
- [ ] Raise/auto-size `max_tokens`; handle `stop_reason: max_tokens` by continuing or warning.
- [ ] Replace `trimDoc` truncation with chunking + retrieval.
- [ ] Move document storage to IndexedDB; guard `localStorage` quota errors.
- [ ] Add retries with exponential backoff.

**P2 — single source of truth**
- [ ] Collapse `studium.jsx` + `studium.html` into one TS source; generate the standalone HTML via a bundler.
- [ ] Add types for the model/response contracts and unit tests for `parseJSON`, `studySections`, `quizQuestionCount`.

**P3 — AI-native features**
- [ ] Streaming for all generators.
- [ ] Grounded citations back to `studySections` offsets.
- [ ] Spaced repetition (SM-2/FSRS) using the existing `mastered` flag + `hist`.
- [ ] Per-section tutor chat.
- [ ] Multimodal PDF figure ingestion.
- [ ] Artifact caching by content hash.

---

## Verification notes
The CORS diagnosis is the highest-leverage hypothesis and is easy to confirm: open DevTools → Console while generating with GPT-4o selected. A red `Access-Control-Allow-Origin` / `Failed to fetch` entry confirms it. Anthropic-with-Opus failing while Anthropic-with-Sonnet works confirms the model-ID issue. Both are addressed by the P0 items above.
