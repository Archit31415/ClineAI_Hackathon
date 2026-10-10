# KisanSahay-AI (किसान सहाय)

> One voice conversation in Hindi, Assamese or English → seven farmer problems → one shareable **Farm Action Plan**.
> Cline AI Builder Hackathon · Round 2 · Agriculture

## Problem
Indian smallholders hit several walls at once: crop disease noticed too late, schemes they never heard of, insurance claims lost to a short reporting window, selling at whatever the local trader offers, an unread Soil Health Card, advice that ignores the weather, and a sick animal with the vet 20 km away. Underneath all of these sit language, literacy and paperwork. See `docs/blueprint.md`.

## Solution
A voice-first PWA. A short interview fills one shared farmer profile; an intent router picks the modules; each module returns a standard envelope; a plan builder merges them into one ordered checklist, shareable as PDF / WhatsApp / print and cached offline.

| Module | Tier | What it does |
|---|---|---|
| 🌩️ Claim Assistant | **Deep** | PMFBY reporting countdown, evidence-photo guide (time + hash + optional GPS), loss-intimation draft via **Cline Workflow B**, reporting channels |
| 🏛️ Scheme Finder | **Deep** | Rules engine over 7 schemes, stacking/conflicts, deadlines, documents, PM-KISAN stuck-payment diagnosis, RAG explanation for missing info |
| 🧪 Soil Card | Working | Photo OCR (LLM) or typed values → confirm table → bands from data → card-printed or state-table plan |
| ⚖️ Mandi Advisor | Working | data.gov.in feed or snapshot (labelled stale) → net-of-transport comparison, trend, sell/wait/compare |
| 🌾 Crop Doctor | Prototype | Shared triage engine: photo/text/chips → catalog features → ranked candidates, how to confirm, safe steps |
| 🌦️ Weather Advisory | Prototype | Open-Meteo + crop calendar + sourced rules → nudges; "simulate tomorrow" |
| 🐄 Livestock Triage | Prototype | Red flags first → `vet_now` / isolate / notifiable prompt; no drug doses |

**Principles:** deterministic where it matters (the LLM never decides verdicts, bands, deadlines or triage levels), confirm before trust, nothing submitted to portals, honest tier labels, works with no network or API key.

## Architecture
```
web (React + Vite + Tailwind, PWA)          server (Fastify + Zod, TypeScript)
  Language → Consent → Home tiles / 🎤         /api/interview/turn  → slot-filler (+optional LLM) → intents
  Chat (voice | typing | chips)          ───►  /api/modules/:id/run → registry → 7 modules → ModuleResult (Zod-checked)
  ModuleScreen (camera, chips)                 /api/plan            → deterministic plan builder
  ActionPlanView (checklist, PDF, WA)          /api/dossier         → PDF (Noto fonts, Indic shaping, QR) + WhatsApp ≤1000
  🤖 Cline panel                               /api/cline/*         → ClineAdapter → @cline/sdk | fixture
  localStorage: profile, plan, ticks           data/: rules-as-data (schemes, forms, soil, crops, triage, mandi, fixtures)
```
Contracts: `contracts/types.ts` (+ Zod mirror `contracts/schemas.ts`); API table: `contracts/api.md`.

## Tech stack
TypeScript · Node ≥ 22 · Fastify 5 · Zod 3 · React 19 · Vite 7 · Tailwind 4 · pdf-lib + fontkit (Noto Sans / Devanagari / Bengali) · Web Speech API + **free open-source Whisper** (whisper-small via @huggingface/transformers, runs in the server) · Open-Meteo · data.gov.in · **@cline/sdk** · Vitest.

## Setup
```bash
cd kisansahay-ai
cp .env.example .env          # works as-is: CLINE_MODE=fixture, no LLM, snapshot mandi
npm install
npm run dev                   # server :8787 + web :5173 (proxies /api)
# single process: npm run build && npm start  → http://localhost:8787
npm test                      # 45 tests: personas, modules, validators, flows, Cline workflows
npm run contract              # every enabled module vs its fixture (the Hour-4 gate)
npm start & bash scripts/e2e-demo.sh   # three personas end to end; PDFs in /tmp/kisansahay-e2e
```
**Voice:** server-side speech recognition uses the free open-source **Whisper** model locally (no key, no cost; audio never leaves your machine). The first `npm start` downloads `onnx-community/whisper-small` (~500 MB, one time) into `data/models/`; after that it loads in a few seconds and transcribes a sentence in ~1–2 s on a laptop CPU. Set `WHISPER_LOCAL_MODEL=onnx-community/whisper-base` for a smaller/faster model (worse Hindi), or `STT_PROVIDER=openai` + `WHISPER_API_KEY` to use the paid API instead.

Optional `.env` keys: `VISION_PROVIDER=cline` + `VISION_MODEL` (photo reading for Livestock / Crop Doctor / Soil Card through a Cline-routed vision model; uses Cline credits, auth via `CLINE_API_KEY` or your `cline auth` login), `LLM_PROVIDER/LLM_API_KEY/LLM_MODEL` (richer text extraction), `CLINE_MODE=sdk` + `CLINE_API_KEY` (live Cline), `DATA_GOV_IN_API_KEY` (live mandi). `DEMO_NOW` freezes the clock so Anita's countdown reads **61 hours**.

**Degradation ladder:** Level 0 live voice + LLM + Cline SDK + live feeds → Level 1 fixture Cline + snapshot → **Level 2 typed/chips + scripted slot-filler + fixture Cline + snapshot (the default)**.
**Cut switch:** `"enabled": false` in `data/modules.json` greys the tile ("coming soon") and the route returns 409.

## How Cline was used
- **In the build:** `docs/cline-evidence.md`.
- **In the product (bonus):** Workflow A (rule ingestion → generated tests → repair loop → diff → human approval), Workflow B (form fill re-checked by code validators), Workflow C (plan orchestration with a `run_module` tool and deterministic fallback), Workflow D (photo reading through a Cline-routed vision model). All go through one `ClineAdapter` (`server/src/cline/adapter.ts`).

## Demo personas (`data/fixtures/personas.json`)
- **Anita, Nagaon (Assamese):** "মই নগাঁও জিলাৰ। দুবিঘা মাটি, ধান খেতি। কালি শিলাবৃষ্টি হ'ল।" → claim first, 61 h countdown, PMFBY + KCC + PKVY, "KCC stacks with PMFBY".
- **Ramesh, Lucknow (Hindi):** PM-KISAN stuck → Aadhaar seeding flagged; soil card N low; mandi comparison net of transport.
- **Kamal, Kamrup:** cow with fever + skin nodules → `vet_now`, isolate, notifiable prompt; Assam dairy + KCC.

## Honest limits
- **Scheme amounts, deadlines, helplines, soil bands, MSPs, catalogs and the mandi snapshot are illustrative and marked `TODO_VERIFY`.** Verify against official sources before real use.
- The Workflow A sample circular is fictional. In fixture mode, ingesting arbitrary text fails honestly; live extraction needs `CLINE_MODE=sdk`.
- Photo triage is a prototype; photo reading needs `VISION_PROVIDER` (otherwise the farmer is told the photo was not checked); land units are always confirmed.
- Hindi/Assamese strings need native-speaker review; browsers have no Assamese speech recognition, so Assamese always uses local Whisper (Whisper's Assamese accuracy is limited — test with a native speaker); typing and chips always work.
- No portal submission, no pesticide/drug doses, no price forecasts. Personal data stays in the browser; claim photos never leave the device (hash + metadata only).

## Future scope
WhatsApp bot / IVR, DigiLocker + state portals, proactive seasonal nudges, more crops and languages, CSC "scheme camp" mode, outcome tracking.
