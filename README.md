# KisanSahay-AI (किसान सहाय)

A voice-first web app for Indian smallholder farmers. A farmer speaks or taps in Hindi, Assamese, English, or other regional languages, and gets help across seven problems in one place. The output is a single, prioritized Farm Action Plan that works offline, downloads as a PDF, or shares directly to WhatsApp.

Built for the Cline AI Builder Hackathon (Round 2, Agriculture).

## The Problems It Solves

Smallholder farmers deal with several issues at once every season:
1. **Insurance deadlines:** Localized crop damage must be reported within 72 hours under PMFBY, but farmers miss it due to paperwork confusion.
2. **Unclaimed schemes:** Farmers qualify for schemes like PM-KISAN, KCC, or PM-KUSUM, but payments get stuck or schemes go undiscovered.
3. **Unused soil cards:** Soil Health Cards sit in drawers because nutrient values are hard to read.
4. **Mandi pricing:** Farmers sell to local traders without knowing net prices after transport at nearby markets.
5. **Crop disease:** Leaf infections get spotted too late.
6. **Weather timing:** Farmers spray pesticides right before rain washes them off.
7. **Sick livestock:** Vets are far away and critical warning signs get missed.

Underneath all of these is language, literacy, and paperwork friction.

## What the App Does

A brief voice or tap interview builds a shared farmer profile. An intent router picks the right modules, runs them against verified rules, and merges everything into one action checklist:
- **Do today:** Urgent claim deadlines, emergency animal care.
- **Documents to collect:** Land records, bank passbooks, photos.
- **Wait / Info:** Weather nudges, price re-checks.

### The 7 Modules

| Module | Tier | Description |
|---|---|---|
| Claim Assistant | Deep | Live countdown for PMFBY 72-hour window, photo guide with time and hash stamps, drafted loss intimation form. |
| Scheme Finder | Deep | Rules engine over major schemes (PM-KISAN, KCC, PMFBY, PKVY, SMAM, PM-KUSUM), benefits stacking, and stuck payment diagnostics. |
| Soil Card | Working | Photo OCR or typed readings, ratings against official bands, fertilizer advice from state tables. |
| Mandi Advisor | Working | Net-of-transport price comparison across nearby mandis, trend analysis, clear sell or wait advice. |
| Crop Doctor | Prototype | Leaf photo and symptom triage against a curated catalog, confirmation steps, and safety warnings. |
| Weather Advisory | Prototype | Hyperlocal forecast matched to crop stage, warns against wasted spraying before rain. |
| Livestock Triage | Prototype | Red-flag symptom checks (like lumpy skin disease), isolation guidelines, urgent vet referral. |

### Core Safety Rules
- **Deterministic where it matters:** Deadlines, scheme eligibility, soil bands, price comparisons, and triage levels are calculated by code from verified data. The LLM never decides eligibility or deadlines.
- **No medical or chemical doses:** The app never outputs pesticide or veterinary drug dosages. It directs farmers to local agriculture officers or vets.
- **No portal submissions:** The app drafts documents for the farmer to submit. It does not submit to government portals on its own.
- **Privacy:** Personal details stay on the device in local storage. Photos stay on the phone; only hashes and metadata are sent.

## Tech Stack

- **Backend:** Node.js (v22+), Fastify, TypeScript, Zod.
- **Frontend:** React 19, Vite, Tailwind CSS, installable PWA.
- **Voice:** Web Speech API, browser MediaRecorder, and free local Whisper via Hugging Face Transformers.
- **PDF & Sharing:** pdf-lib with embedded Noto fonts (Latin, Devanagari, Bengali/Assamese scripts), WhatsApp link generator.
- **Cline:** Cline SDK (@cline/sdk) with a deterministic fixture fallback.

## Quick Start

```bash
cd kisansahay-ai
cp .env.example .env
npm install

# Run dev server (backend on :8787, frontend on :5173)
npm run dev

# Run test suite (64 unit and flow tests)
npm test

# Run contract tests (validates all 7 modules against contract schemas)
npm run contract

# Build production bundle
npm run build
```

## Voice and Offline Support

- **Speech recognition:** Runs locally using an ONNX Whisper model by default (no external API keys needed). You can also use browser speech recognition or set `STT_PROVIDER=openai` with `WHISPER_API_KEY`.
- **Offline mode:** If network drops, the web app reloads your last generated Farm Action Plan from localStorage.

## How Cline is Used

### At Build Time
- Monorepo scaffolding across contracts, backend, and frontend.
- Writing table-driven test suites from real farmer personas.
- Resolving Indic font shaping and canvas drawing for Devanagari and Assamese PDFs.

### In the Product (Runtime Agent Workflows)
- **Workflow A (Rule Ingestion):** Ingests new policy circulars (PDF, URL, or text), generates test cases from policy examples, runs them against the evaluator, repairs drafts until tests pass, and prepares a review diff for human approval.
- **Workflow B (Form Filling):** Maps farmer profile facts into official scheme and insurance forms, followed by strict code validators (IFSC, survey numbers, dates).
- **Workflow C (Plan Orchestration):** Optional agent that calls module runners as tools and orders actions by priority, backed by a deterministic fallback.
- **Workflow D (Vision):** Routes photos through vision models to match features against a strict catalog vocabulary. Off-vocabulary items are ignored.

## Demo Personas

Run the demo script to test all three personas against a running server:
```bash
npm start &
bash scripts/e2e-demo.sh
```

- **Anita Das (Assam, paddy):** Hailstorm damage -> Claim Assistant opens with live countdown (61 hours left), PMFBY intimation drafted, checks KCC and PKVY, warns of upcoming rain.
- **Ramesh Yadav (Uttar Pradesh, wheat):** PM-KISAN installment stuck -> Diagnoses missing Aadhaar-bank seeding, reads soil card, compares mandi prices net of transport.
- **Kamal Rabha (Assam, cattle):** Cow with fever and skin nodules -> Livestock triage flags suspected notifiable disease, orders immediate isolation, prompts vet call, checks dairy schemes.
