# Studium

Local study app: upload notes, generate quizzes, flashcards, and concept maps with AI.

## Run locally

Studium must be served over HTTP (not opened as `file://`) so PDF.js and API calls work correctly.

**Option A — double-click**

1. Double-click `Studium.command` in this folder.
2. The app opens in your browser at `http://127.0.0.1:58743/studium.html`.

**Option B — terminal**

```bash
cd /path/to/Studium
python3 studium_server.py
```

Then open [http://127.0.0.1:58743/studium.html](http://127.0.0.1:58743/studium.html).

**Option C — install as macOS app**

```bash
./install_studium.sh
```

This copies the app to `~/Applications/Studium.app`.

## Use AI models

1. Open **Settings** (gear icon).
2. Paste API keys for the providers you use:
   - **Anthropic** — [console.anthropic.com](https://console.anthropic.com) (Claude models)
   - **OpenAI** — [platform.openai.com](https://platform.openai.com) (GPT-4o)
   - **Google** — [aistudio.google.com](https://aistudio.google.com) (Gemini)
   - **OpenAI-compatible** — use a provider such as OpenRouter
3. Click a model card to select it. Locked models unlock once their provider key is saved.

### Best models for Studium workflows
- **Claude Opus 4.5**, **GPT-4o**, **Gemini 2.5 Pro**: best for deep analytics, complex concept maps, high-quality question generation, and detailed study explanations.
- **Claude Sonnet 4.6**: best all-round model for balanced quiz generation, flashcards, concept mapping, and general note analysis.
- **Claude Haiku 4.5**, **GPT-4o Mini**, **Gemini 2.5 Flash**: best for fast summaries, quick review flashcards, and lightweight quizzes when speed or cost is more important than depth.
- **GPT-OSS 120b**, **Gemma 3 27b**, **Qwen3.5 122b**: best free/OpenAI-compatible options for budget-friendly note summaries, flashcards, and draft quiz generation.

API keys are saved in **macOS Keychain** and reused automatically. The OpenAI-compatible base URL is stored locally in this browser.

The `Studium.command` launcher and the macOS app installer automatically start the local keychain helper for you.

## Files

| File | Purpose |
|------|---------|
| `studium.html` | Standalone app (used by installer & `Studium.command`) |
| `studium.jsx` | React version for Claude artifact / component hosts |
| `studium_server.py` | Local HTTP server and macOS Keychain helper |
| `install_studium.sh` | Builds `Studium.app` in Applications |
| `Studium.command` | Quick launcher from this folder |
