# DeepTutor — Setup Kit (study + research)

A ready-to-run guide for adopting **DeepTutor** (HKUDS, Apache-2.0) on a MacBook Air M2 (16GB). It needs **two** providers: an LLM and a **separate embedding** provider (Anthropic has no embeddings, so pair Claude with OpenAI or Ollama embeddings).

## Prerequisites
- Git, Python 3.11+, Node.js 18+ (skip Node for CLI-only or Docker).
- At least one LLM API key. You already have Anthropic + OpenAI + Google keys from Studium.

## Install — pick one

**A. Docker (least friction, recommended for the Air):**
```bash
git clone https://github.com/HKUDS/DeepTutor.git
cd DeepTutor
cp .env.example .env          # then edit (see configs below)
docker compose -f docker-compose.ghcr.yml up -d
# open http://localhost:3782
```

**B. Setup Tour (guided, native):**
```bash
git clone https://github.com/HKUDS/DeepTutor.git && cd DeepTutor
python -m venv .venv && source .venv/bin/activate
python scripts/start_tour.py     # 7-step guided config
python scripts/start_web.py      # daily launch after that
```

**C. CLI only (research from the terminal):**
```bash
pip install -e ".[cli]"
cp .env.example .env             # edit, then:
deeptutor chat
```

## Config — paste into `.env`

**Cheap + smooth (API LLM + API embeddings) — recommended day-to-day:**
```dotenv
LLM_BINDING=anthropic
LLM_MODEL=claude-haiku-4-5            # bump to a sonnet model for Deep Solve / Deep Research
LLM_API_KEY=sk-ant-...
LLM_HOST=https://api.anthropic.com/v1

EMBEDDING_BINDING=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=sk-...
EMBEDDING_HOST=https://api.openai.com/v1
EMBEDDING_DIMENSION=1536

# optional web search for Deep Research:
# SEARCH_PROVIDER=tavily
# SEARCH_API_KEY=...
```

**Free + private (all local via Ollama) — for offline / sensitive notes:**
```dotenv
LLM_BINDING=ollama
LLM_MODEL=qwen2.5:7b-instruct
LLM_API_KEY=ollama
LLM_HOST=http://localhost:11434/v1

EMBEDDING_BINDING=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_API_KEY=ollama
EMBEDDING_HOST=http://localhost:11434/v1
EMBEDDING_DIMENSION=768
```
First-time local setup: `ollama pull qwen2.5:7b-instruct && ollama pull nomic-embed-text`.

> **16GB caveat:** backend + Next.js dev + Ollama 7B + a browser is tight. For routine use prefer the API config (text-embedding-3-small is pennies); reserve the local config for offline work, and use Docker so services are contained.

## Daily workflow

**Build a knowledge base per course/topic** (this is the RAG layer Studium intentionally lacks):
```bash
deeptutor kb create math8 --doc ~/Desktop/.../notes.pdf
deeptutor kb add math8 --docs-dir ~/Desktop/.../psets/
deeptutor kb set-default math8
```

**Study:**
- Chat with RAG + **Quiz Generation** grounded in the KB; bookmark to the **Question Bank**; save insights to **Notebooks**.
- `deeptutor run deep_question "Eigenvalues" --config num_questions=5`

**Research:**
- **Deep Research** (cited report): `deeptutor run deep_research "Attention mechanisms in transformers"`
- **Deep Solve** (multi-step, verified): `deeptutor run deep_solve "Prove √2 is irrational" -t reason`
- **Co-Writer** for drafting against your sources (web UI).

**Stay on track:** create a TutorBot with a heartbeat for recurring review check-ins:
```bash
deeptutor bot create math-tutor --persona "Socratic math tutor who uses probing questions"
```

**Agent angle:** DeepTutor ships a root `SKILL.md`, so a tool-using agent (or your Claude Code / Cowork workflow) can operate it autonomously — hand it the skill file and let it build KBs, generate quizzes, or run research.

## How this complements your own tools
- **DeepTutor** = RAG over your library + agentic research/solving + persistent tutors (the breadth Studium forgoes).
- **Studium** = private, opinionated spaced-repetition + comprehension trainer for your own notes (depth in method).
- Use DeepTutor to *learn and research broadly*; export the durable facts into Studium flashcards for *spaced retention*.

## Links
- Repo: https://github.com/HKUDS/DeepTutor
- Releases (capability history): https://github.com/HKUDS/DeepTutor/releases
- `SKILL.md`: https://github.com/HKUDS/DeepTutor/blob/main/SKILL.md
- LightRAG: https://github.com/HKUDS/LightRAG · nanobot: https://github.com/HKUDS/nanobot · ManimCat: https://github.com/Wing900/ManimCat
- Ollama: https://ollama.com
- Discord: https://discord.gg/eRsjPgMU4t
