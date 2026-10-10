# KisanSahay-AI — Technical Architecture & Execution Guide v2 (7 modules)

Companion to `blueprint.md`. Execution contract for 4 developers over 8 hours.

> **Hour-0 checks (whole team, 20 minutes):**
> 1. **Cline SDK:** package name, install, auth, how to run a task, how to get structured output. We only touch `server/src/cline/sdk.ts` if this differs from expectation.
> 2. **Assamese voice:** test `as-IN` STT and TTS on the demo device/browser. Assume Hindi works and Assamese may not.
> 3. **Data access:** data.gov.in API key for mandi prices; Open-Meteo reachable; sample Soil Health Card photos collected; 5–10 leaf photos and animal-symptom descriptions gathered.
> 4. **All sample values in this doc are illustrative.** Verify anything that ships.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    FARMER (phone browser / PWA, offline-cached)               │
│  🎤 / keyboard / chips ──► VOICE LAYER (M1) ──► CHAT + MODULE TILES (M1)      │
│  📷 camera (shared component, M1) ───────────────────────────┐                │
│                                      ACTION PLAN VIEW (M4) ◄─┼─ PDF/WhatsApp  │
└──────────────────────┬────────────────────────────────────────┼───────────────┘
                       ▼                                        │
┌──────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node 20+, Fastify, TypeScript, Zod)            │
│                                                                              │
│  INTERVIEW AGENT + INTENT ROUTER (M1)   FarmerProfile  ◄── shared state      │
│        │ intents[]                                                           │
│        ▼                                                                     │
│  MODULE RUNNER   POST /api/modules/:id/run  →  ModuleResult<Body>            │
│  (registry: data/modules.json, enabled flags, contract tests)                │
│   ├─ schemes      (M2)  rules engine + stacking + RAG                [DEEP]  │
│   ├─ claim        (M3)  deadline + evidence + intimation via Cline B [DEEP]  │
│   ├─ soil_card    (M2)  OCR→confirm→bands→plan                    [WORKING]  │
│   ├─ mandi        (M4)  data.gov.in feed + snapshot → net-of-transport[WORKING]│
│   ├─ crop_doctor  (M1)  ┐ shared TRIAGE ENGINE (feature vocab →     [PROTO] │
│   ├─ livestock    (M1)  ┘ deterministic scoring + red flags)         [PROTO] │
│   └─ advisory     (M2)  Open-Meteo + crop calendar + rules          [PROTO]  │
│                                                                              │
│  CLINE AGENT SERVICE (M3)  ClineAdapter ─► Cline SDK │ Fixture               │
│   A) rule ingestion + generated tests + repair   B) form fill + validate     │
│   C) action-plan orchestration (stretch; deterministic fallback)            │
│                                                                              │
│  PLAN BUILDER (M4)  ModuleResult[] ─► ActionPlan ─► PDF / WhatsApp / JSON    │
└──────────────────────────────────────────────────────────────────────────────┘

 Data (file-based): /data/schemes  /data/soil  /data/triage  /data/crops
                    /data/mandi (snapshot + mandis.json)  /data/fixtures  /data/modules.json
 Browser: localStorage = profile + last ActionPlan + checklist ticks
```

### Data flow (happy path)
1. Voice/typing/chips → text (M1).
2. `POST /api/interview/turn` fills the shared `FarmerProfile` slot by slot; the router adds `intents[]`.
3. For each intent the UI (or the plan builder) calls `POST /api/modules/:id/run` with `{profile, input}`.
4. Each module returns the same `ModuleResult` envelope.
5. `POST /api/plan` merges results into an ordered `ActionPlan` (deterministic builder by default; Cline Workflow C optional).
6. `POST /api/dossier` renders the plan to PDF / WhatsApp text / JSON.
7. Independent background path: `POST /api/cline/ingest` turns a circular into a draft rule with generated tests.

---

## 2. Tech Stack

| Layer | Choice | Fallback |
|---|---|---|
| Frontend | Vite + React + TypeScript + Tailwind, PWA manifest | Single HTML + Tailwind CDN |
| Audio | Web Speech API; `MediaRecorder` blob upload | Typed input and tap chips (always visible) |
| STT | Web Speech (`hi-IN`, `en-IN`); Bhashini ASR for Assamese; Whisper API for blobs | Typed / chips |
| TTS | `speechSynthesis`; Bhashini TTS | Pre-recorded clips for fixed prompts; on-screen text |
| LLM | Provider-agnostic wrapper `llm.ts`, JSON output, temperature ≤ 0.3, vision-capable model for photos | Cached transcripts/outputs for demo personas |
| Rules | Pure TS evaluator over JSON | n/a |
| Triage engine | LLM extracts features from a **fixed vocabulary** → deterministic scoring → red-flag overrides | Text-symptom chips only |
| RAG | Embeddings + cosine over scheme chunks in JSON | Keyword search |
| Mandi data | data.gov.in daily mandi price dataset via API key | Cached CSV snapshot + `stale` flag |
| Weather | Open-Meteo forecast (no key) | Cached forecast JSON |
| Cline | Cline SDK behind `ClineAdapter` | `FixtureClineAdapter` |
| Backend | Node 20+, Fastify, Zod | n/a |
| PDF | `pdf-lib` or `pdfmake` with embedded Noto fonts (Devanagari, Bengali script covers Assamese) | HTML print stylesheet |
| Sharing | `wa.me/?text=` + Web Share API | Download + copy |
| Offline | `localStorage`, minimal service worker | n/a |

---

## 3. Repository Layout

```
kisansahay-ai/
├── README.md                    # M4
├── docs/ blueprint.md technical.md demo-script.md cline-evidence.md architecture.png   # M4
├── contracts/                   # SHARED. Changes announced to all.
│   ├── types.ts  schemas.ts  api.md
├── web/
│   ├── src/voice/               # M1
│   ├── src/chat/                # M1 (ChatScreen, ModuleTiles, i18n)
│   ├── src/camera/              # M1 (shared CameraCapture component)
│   ├── src/modules/<id>/        # each module owner's UI card (small)
│   ├── src/plan/                # M4 (ActionPlanView, countdown, checklist)
│   └── src/lib/api.ts           # M1
├── server/src/
│   ├── index.ts                 # M3 (route wiring; others add one line)
│   ├── interview/ router/       # M1
│   ├── triage/                  # M1 (engine.ts, vision.ts)
│   ├── modules/
│   │   ├── schemes/  soil/  advisory/     # M2
│   │   ├── claim/                         # M3
│   │   ├── mandi/                         # M4
│   │   ├── crop_doctor/  livestock/       # M1 (thin wrappers around triage/)
│   │   └── registry.ts                    # M3
│   ├── cline/                   # M3 (adapter, sdk, fixture, ingest, fill, plan)
│   ├── plan/                    # M4 (build.ts)
│   └── dossier/                 # M4 (compile, pdf, whatsapp)
├── data/
│   ├── modules.json             # M3
│   ├── schemes/  (+ _drafts/)   # M2
│   ├── soil/                    # M2 (bands.json, fertilizer_<state>.json)
│   ├── crops/                   # M2 (calendar.json, advisory_rules.json)
│   ├── triage/                  # M1 (crop_disease.json, livestock.json)
│   ├── mandi/                   # M4 (mandis.json, snapshot.csv)
│   ├── fixtures/                # everyone
│   └── samples/                 # circular PDFs, soil card photos, leaf photos
├── .clinerules/                 # per-module Cline instructions
└── package.json                 # npm workspaces: contracts, server, web
```

**Rules:** each member edits only their folders. Shared files are `contracts/*`, `server/src/index.ts` (one-line additions) and `web/src/lib/api.ts`. Never rename a contract field; add fields instead.

---

## 4. Shared Contracts (`contracts/types.ts`)

```ts
export type Lang = "hi" | "as" | "en";
export type I18n = Record<Lang, string>;
export type Category = "general" | "obc" | "sc" | "st";
export type ModuleId =
  "schemes" | "claim" | "crop_doctor" | "soil_card" | "mandi" | "advisory" | "livestock";
export type Tier = "deep" | "working" | "prototype";

export interface FarmerProfile {
  lang: Lang;
  state?: string; district?: string;
  land_hectares?: number; land_ownership?: "owner"|"tenant"|"sharecropper";
  crops?: string[]; season?: "kharif"|"rabi"|"zaid";
  sowing_date?: string;                       // ISO date, for advisory
  category?: Category;
  pain_point?: "crop_loss"|"equipment"|"credit"|"organic"|"irrigation"
              |"stuck_payment"|"disease"|"sell_produce"|"soil"|"animal_health"|"unknown";
  loss_event?: { type: "hail"|"flood"|"drought"|"pest"|"other"; occurred_at: string };
  existing_benefits?: string[];
  has_bank_account?: boolean; aadhaar_seeded?: boolean; in_cluster_group?: boolean;
  livestock?: { species: "cattle"|"buffalo"|"goat"|"poultry"|"other"; count: number }[];
  stock_to_sell?: { commodity: string; quintals: number }[];
  gps?: { lat: number; lng: number }; consent_gps?: boolean;
  raw_units?: { value: number; unit: string };
}

/* ---------- Universal module envelope ---------- */
export interface ModuleResult<B = unknown> {
  module: ModuleId;
  status: "ok" | "needs_info" | "degraded" | "error";
  headline: I18n;
  body: B;
  actions: ActionItem[];                      // merged into the Action Plan
  sources: { label: string; url: string; as_of: string }[];
  confidence?: number;                        // 0..1
  provenance: "live" | "cached" | "fixture";
  disclaimer: "general" | "agrochemical" | "veterinary" | "financial";
  missing_fields?: string[];
  generated_at: string;
}
export interface ActionItem {
  id: string; label: I18n;
  kind: "do_now" | "collect_doc" | "visit" | "call" | "wait" | "info";
  priority: 1 | 2 | 3;                        // 1 = urgent
  due_at?: string; link?: string;
}

export interface ModuleRunRequest<I = unknown> { profile: FarmerProfile; input?: I }

export interface ActionPlan {
  generated_at: string; lang: Lang;
  results: ModuleResult[];
  ordered_actions: (ActionItem & { from: ModuleId })[];
  cross_notes: I18n[];                        // e.g. "KCC stacks with PMFBY"
  provenance: "deterministic" | "cline-orchestrated";
}
```

### Module bodies

```ts
// schemes (M2): unchanged from v1
export interface SchemesBody { results: EligibilityResult[]; conflicts: Conflict[] }
export type Verdict = "eligible"|"likely"|"needs_info"|"not_eligible";
export interface EligibilityResult {
  scheme_id: string; scheme_name: I18n; verdict: Verdict; confidence: number;
  reasons: Record<Lang,string[]>; missing_fields: string[]; benefit_summary: I18n;
  documents: DocumentItem[];
  deadline?: { label: string; due_at: string };
  stack_notes: { with: string; relation: "stacks"|"conflicts"|"requires"; note: I18n }[];
  source: { url: string; verified_on: string };
}
export interface DocumentItem { id: string; name: I18n; where_to_get: I18n; have?: boolean }

// claim (M3)
export interface ClaimInput {
  evidence: { image_data_url: string; captured_at: string;
              gps?: { lat: number; lng: number }; sha256: string; shot_type: "wide"|"close"|"boundary"|"other" }[];
}
export interface ClaimBody {
  deadline: { due_at: string; hours_left: number; expired: boolean };
  evidence_checklist: { shot_type: string; label: I18n; done: boolean }[];
  intimation: FormFillResult;                 // from Cline Workflow B
  channels: { label: I18n; value: string; verified_on: string }[];
}
export interface FormFillResult {
  scheme_id: string; form_values: Record<string, string|number|boolean|null>;
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  missing_documents: string[]; confidence: number; provenance: "cline-sdk"|"fixture";
}

// soil_card (M2)
export interface SoilInput { image_data_url?: string; values?: Record<string, number> }
export interface SoilBody {
  parsed: { param: string; value: number; unit: string; ocr_confidence: number }[];
  confirmed: boolean;
  ratings: { param: string; band: string; note: I18n }[];
  plan: { source: "card_printed"|"state_table"; crop: string; items: { nutrient: string; guidance: I18n }[] };
}

// mandi (M4)
export interface MandiInput { commodity: string; quintals: number }
export interface MandiBody {
  commodity: string; quintals: number;
  options: { mandi: string; distance_km: number; modal_price: number; transport_cost_per_q: number;
             net_per_q: number; price_date: string }[];
  trend: { days: number; change_pct: number };
  recommendation: "sell_now"|"wait"|"compare";
  best_mandi?: string; reason: I18n; stale: boolean;
  assumptions: { transport_rate_per_q_km: number };
}

// triage engine bodies (M1): crop_doctor and livestock
export interface CropDoctorInput { image_data_url?: string; symptoms_text?: string; crop?: string }
export interface CropDoctorBody {
  photo_quality: "ok"|"poor";
  candidates: { id: string; name: I18n; confidence: number; why: I18n; confirm_by: I18n;
                safe_steps: I18n; advisory_source?: { label: string; url: string } }[];
  escalate: boolean;                          // true → see agriculture officer / KVK
}
export interface LivestockInput { species: string; symptoms_text?: string; image_data_url?: string }
export interface LivestockBody {
  triage: "monitor"|"vet_within_24h"|"vet_now";
  red_flags: I18n[]; possible_conditions: { id: string; name: I18n; confidence: number }[];
  isolate: boolean; notifiable_suspect: boolean;
  do_now: I18n[]; do_not: I18n[];
}

// advisory (M2)
export interface AdvisoryBody {
  crop_stage: string;
  forecast: { date: string; rain_mm: number; tmax: number; tmin: number; wind_kmph: number }[];
  nudges: { date: string; severity: "info"|"watch"|"act"; text: I18n; rule_id: string }[];
}
```

---

## 5. API Contract

| Method & path | Owner | Request | Response |
|---|---|---|---|
| `POST /api/interview/turn` | M1 | `{session_id, lang, user_text, profile}` | `{assistant_text, profile, intents[], next_slot, confirm_needed, done}` |
| `GET /api/modules` | M3 | none | registry from `data/modules.json` (id, tier, enabled) |
| `POST /api/modules/:id/run` | module owner | `ModuleRunRequest<Input>` | `ModuleResult<Body>` |
| `POST /api/plan` | M4 | `{profile, results: ModuleResult[]}` | `ActionPlan` |
| `POST /api/cline/plan` | M3 | `{profile, utterance}` | `{task_id}` (Workflow C, stretch) |
| `POST /api/cline/fill` | M3 | `{profile, form_id}` | `{task_id}` (Workflow B) |
| `POST /api/cline/ingest` | M3 | multipart PDF or `{url}` | `{task_id}` (Workflow A) |
| `GET /api/cline/tasks/:id` | M3 | none | `{status, progress[], result?}` |
| `POST /api/cline/ingest/:id/approve` | M3 | `{reviewer}` | moves draft into `data/` |
| `POST /api/dossier` | M4 | `{plan}` | `{pdf_base64, whatsapp_text, json}` |

Legacy v1 `/api/eligibility` stays as an alias to the `schemes` module. All routes validate with Zod and return `{error:{code,message}}` on failure.

**Module registry (`data/modules.json`)**
```json
[
  { "id": "schemes",     "tier": "deep",      "enabled": true,  "owner": "M2" },
  { "id": "claim",       "tier": "deep",      "enabled": true,  "owner": "M3" },
  { "id": "soil_card",   "tier": "working",   "enabled": true,  "owner": "M2" },
  { "id": "mandi",       "tier": "working",   "enabled": true,  "owner": "M4" },
  { "id": "crop_doctor", "tier": "prototype", "enabled": true,  "owner": "M1" },
  { "id": "advisory",    "tier": "prototype", "enabled": true,  "owner": "M2" },
  { "id": "livestock",   "tier": "prototype", "enabled": true,  "owner": "M1" }
]
```
The UI renders tiles from this file. Setting `enabled:false` greys a tile as "coming soon." This is the cut switch.

---

## 6. Module Specs (algorithms, data, guardrails, fixtures)

Fixtures live in `data/fixtures/modules/<id>.json` and contain a request and the full `ModuleResult`. The envelope is abbreviated below (`…`); each fixture must be complete and Zod-valid.

### 6.1 Schemes (Deep, M2)
Same JSON rule schema and operators as v1 (`eq, ne, gt, gte, lt, lte, in, not_in, intersects, exists, not_exists`). Missing field → `needs_info`. Stacking via `stacks_with` / `conflicts_with` / `requires`. Deadlines via `deadline_rules` with injectable clock (`DEMO_NOW`). RAG only explains `needs_info` cases and never changes a verdict. MVP files: `pmkisan, pmfby, kcc, smam, pkvy, pmkusum`, plus 1–2 state schemes. Add a **stuck-payment diagnosis** checklist for PM-KISAN (eKYC, Aadhaar–bank seeding, land-record mismatch), written from the official FAQ and verified.

### 6.2 Claim Assistant (Deep, M3)
- Deadline from `loss_event.occurred_at` + rule hours (verified; commonly cited as 72 h for localized calamities). Show `hours_left`, and if expired a clear "report anyway and contact your insurer or agriculture office" message.
- Evidence guide: wide shot, close-up, second location, boundary landmark. Each capture stores `captured_at`, optional GPS (only with consent), and a SHA-256 of the image. Do not rely on EXIF; browsers and messaging apps often strip it.
- Intimation draft via Workflow B against `forms/pmfby_loss_intimation.json`.
- `channels` come from data and must be verified (national helpline, crop insurance app, bank, insurer, agriculture office).

```json
{
  "request": { "profile": { "lang": "as", "state": "Assam", "district": "Nagaon", "crops": ["paddy"],
               "loss_event": { "type": "hail", "occurred_at": "2026-10-09T15:00:00+05:30" } } },
  "result": {
    "module": "claim", "status": "ok",
    "headline": { "en": "Report your hail loss now: about 61 hours left", "hi": "…", "as": "…" },
    "body": {
      "deadline": { "due_at": "2026-10-12T15:00:00+05:30", "hours_left": 61, "expired": false },
      "evidence_checklist": [
        { "shot_type": "wide", "label": { "en": "Wide photo of the whole field", "hi": "…", "as": "…" }, "done": false },
        { "shot_type": "close", "label": { "en": "Close-up of damaged plants", "hi": "…", "as": "…" }, "done": false }
      ],
      "intimation": { "scheme_id": "pmfby", "form_values": { "district": "Nagaon", "crop": "paddy", "cause_of_loss": "hail", "date_of_loss": "2026-10-09", "survey_number": null },
                      "errors": [], "warnings": [ { "field": "area_affected_ha", "message": "Converted from 2 bigha; confirm with land record" } ],
                      "missing_documents": ["land_record", "bank_passbook"], "confidence": 0.82, "provenance": "fixture" },
      "channels": [ { "label": { "en": "Crop insurance helpline", "hi": "…", "as": "…" }, "value": "VERIFY_BEFORE_SHOWING", "verified_on": "YYYY-MM-DD" } ]
    },
    "actions": [ { "id": "claim-report", "label": { "en": "Report loss to insurer/bank/agri office", "hi": "…", "as": "…" }, "kind": "do_now", "priority": 1, "due_at": "2026-10-12T15:00:00+05:30" } ],
    "sources": [ { "label": "PMFBY", "url": "https://pmfby.gov.in", "as_of": "YYYY-MM-DD" } ],
    "provenance": "fixture", "disclaimer": "general", "generated_at": "2026-10-10T09:00:00+05:30"
  }
}
```

### 6.3 Soil Card Interpreter (Working, M2)
1. Vision LLM extracts parameters from a card photo into `SoilBody.parsed` with per-field `ocr_confidence` (card typically lists pH, EC, organic carbon, N, P, K, S, and micronutrients; verify the exact list).
2. **Confirm table:** farmer edits any value. Values below confidence 0.7 are highlighted.
3. `bands.json` (verified): thresholds per parameter → `band` and plain-language note. Never infer a band with the LLM.
4. Plan: use the fertilizer recommendation **printed on the card** if parsed; otherwise a verified state table in `data/soil/fertilizer_<state>.json`. If neither exists, say so and refer to the local agriculture office.
5. Typed-values path (`input.values`) exists as the OCR fallback.

### 6.4 Mandi Advisor (Working, M4)
- Data: daily mandi price dataset from data.gov.in via API key (verify resource, fields and update lag). A cached snapshot `data/mandi/snapshot.csv` loaded at build time is the fallback; set `stale: true` and show the price date whenever it's used.
- `mandis.json`: demo-state mandi names with lat/lng. Distance by haversine from `profile.gps` or district centroid.
- Transport: `transport_rate_per_q_km` is a **configurable assumption**, shown in the UI and the plan.
- `net_per_q = modal_price − transport_cost_per_q`.
- Trend: percent change in the best mandi's modal price over the last N days with data.
- Rule: best net beats local by > threshold → `sell_now` at that mandi; rising trend and storage possible → `wait` with a day cap; thin data → `compare`. Always include "not a price forecast." If MSP data is available and verified, show it as a reference.

### 6.5 Triage Engine → Crop Doctor and Livestock (Prototype, M1)
One engine, two catalogs (`data/triage/crop_disease.json`, `data/triage/livestock.json`).

```
photo/text ─► vision.ts: LLM returns ONLY feature ids from catalog.feature_vocab
          ─► engine.ts: weighted match vs each catalog entry → ranked candidates + confidence
          ─► red_flags[] evaluated first (deterministic) → triage level / escalate
          ─► output uses catalog text only (names, confirm_by, safe_steps, source)
```

Catalog entry example (illustrative, to be verified against ICAR / state university sources):
```json
{ "id": "rice_blast", "crop": "paddy",
  "name": { "en": "Rice blast", "hi": "…", "as": "…" },
  "features": { "diamond_lesions": 3, "grey_centre_brown_margin": 2, "leaf_spots": 1 },
  "confirm_by": { "en": "Check several leaves; lesions with grey centre and brown edge", "hi": "…", "as": "…" },
  "safe_steps": { "en": "Avoid excess nitrogen; manage standing water; get local advice on control", "hi": "…", "as": "…" },
  "advisory_source": { "label": "VERIFY", "url": "VERIFY" } }
```
**Rules**
- A catalog entry with no `advisory_source` returns candidates and "ask the agriculture officer," and **no treatment steps**.
- Never output pesticide names or doses. Always show an agrochemical disclaimer (registered products only, read the label, protective gear, ask the KVK/agriculture officer).
- Photo quality check (blur/size/lighting heuristic) before scoring; `photo_quality: "poor"` asks for a retake.
- `confidence < 0.5` for the top candidate → `escalate: true`.

Livestock red flags (illustrative; verify with the state animal husbandry department): inability to stand, bloody discharge, high fever with skin nodules, swelling with milk change, bloated abdomen, sudden death in the herd. Any match → `vet_now`. Skin nodules plus fever → `notifiable_suspect: true`, `isolate: true`. No drug doses, ever.

```json
{ "module": "livestock", "status": "ok", "disclaimer": "veterinary",
  "headline": { "en": "Call a vet today and keep this animal apart", "hi": "…", "as": "…" },
  "body": { "triage": "vet_now",
    "red_flags": [ { "en": "Fever with skin nodules", "hi": "…", "as": "…" } ],
    "possible_conditions": [ { "id": "lsd", "name": { "en": "Lumpy skin disease (suspected)", "hi": "…", "as": "…" }, "confidence": 0.55 } ],
    "isolate": true, "notifiable_suspect": true,
    "do_now": [ { "en": "Separate from the herd; inform the veterinary officer", "hi": "…", "as": "…" } ],
    "do_not": [ { "en": "Do not give human medicines or unverified remedies", "hi": "…", "as": "…" } ] },
  "provenance": "fixture" }
```

### 6.6 Hyperlocal Advisory (Prototype, M2)
- Forecast: Open-Meteo for `profile.gps` or district centroid; cache JSON.
- `crop_stage`: from `sowing_date` + `data/crops/calendar.json` (days-after-sowing windows per crop; verify).
- `advisory_rules.json` example: `{ id:"delay_spray_rain", when: { rain_mm_48h:{gte:10}, stage:{in:["tillering","flowering"]} }, severity:"act", text:{…} }`. Rules cite an advisory source; unsourced rules stay `info` only.
- Delivery: in-app card and WhatsApp text. The demo uses a "simulate tomorrow" button. Real scheduling is out of scope for the MVP.

---

## 7. Four-Person Execution Contract

| Member | Core ownership | Modules | Load note |
|---|---|---|---|
| **M1** | Voice, chat UI, interview, intent router, camera component | Crop Doctor + Livestock via the shared triage engine | Voice baseline must be done by Hour 3 to free time for triage |
| **M2** | Knowledge and rules | Schemes (Deep), Soil Card (Working), Advisory (Prototype) | Heaviest data-authoring load; use Cline to draft, humans to verify |
| **M3** | Cline adapter and workflows A/B/C, module registry, route wiring | Claim Assistant (Deep) | Claim leans on Workflow B so work overlaps |
| **M4** | Plan builder, dossier, offline, docs | Mandi (Working) | Docs are shared: each member writes their README section; Cline drafts the rest |

### M1: Voice, Chat, Interview, Router, Triage
**Deliverables**
1. `stt.ts`, `tts.ts`: fallback chains from §2; the typed box and chips are always visible.
2. `ChatScreen`, `ModuleTiles` (reads `/api/modules`), `CameraCapture` (shared; returns `data_url`, timestamp, optional GPS with explicit consent).
3. `interview/agent.ts`: slot-filling with a human-reviewed prompt bank; the LLM extracts and lightly rephrases only.
4. `router/intent.ts`: maps profile + utterance → `intents[]`. **Keyword/rule router first**, LLM classifier second. Tile taps bypass it.
5. `units.ts`: acre/hectare/bigha/katha with per-state factors and a confirm flag.
6. `triage/engine.ts`, `triage/vision.ts`, `modules/crop_doctor`, `modules/livestock`, catalogs (Hour 3.5 onward).
7. Mock `/api/interview/turn` and fixtures in Hour 1.

**Interview fixture** (unchanged contract from v1, plus `intents`):
```json
{ "request": { "session_id": "s1", "lang": "as", "user_text": "মই নগাঁও জিলাৰ, দুবিঘা মাটি, ধান, কালি শিলাবৃষ্টি হ'ল", "profile": { "lang": "as" } },
  "response": { "assistant_text": "আপুনি নগাঁও, অসমৰ। প্ৰায় ০.২৭ হেক্টৰ ধান। আপোনাৰ শ্ৰেণী কি?",
    "profile": { "lang": "as", "state": "Assam", "district": "Nagaon", "land_hectares": 0.27, "raw_units": { "value": 2, "unit": "bigha" },
                 "crops": ["paddy"], "pain_point": "crop_loss",
                 "loss_event": { "type": "hail", "occurred_at": "2026-10-09T15:00:00+05:30" } },
    "intents": ["claim", "schemes"], "next_slot": "category", "confirm_needed": false, "done": false } }
```
**DoD:** all 7 tiles open; the interview completes via voice-only, typed-only and chips-only; router sends the Anita utterance to `claim` first; triage engine returns a Zod-valid `CropDoctorBody` and `LivestockBody` for 3 sample cases each.

### M2: Schemes, Soil Card, Advisory
**Deliverables**
1. Scheme JSON for `pmkisan, pmfby, kcc, smam, pkvy, pmkusum` (+1–2 state schemes), each with `source`, `verified_on`, `review_status`.
2. `evaluate.ts`, `stack.ts`, `deadlines.ts` (injectable clock), `rag.ts`; persona unit tests.
3. `soil/` parse + bands + plan; `data/soil/bands.json`, one state fertilizer table.
4. `advisory/` Open-Meteo client, crop calendar (3–4 crops), 6–8 sourced rules.
5. Module endpoints for `schemes`, `soil_card`, `advisory` that return `ModuleResult`.
**DoD:** `npm test` passes the persona suite; each module returns a Zod-valid result from fixtures with no network; live paths work with network.

### M3: Cline, Claim Assistant, Registry
**Deliverables**
1. `cline/adapter.ts` (the only interface the app sees):
```ts
export interface ClineAdapter {
  runTask<T>(opts: {
    kind: "ingest_rule" | "fill_form" | "plan";
    instructions: string;
    inputs: Record<string, unknown>;
    tools?: ToolSpec[];                       // e.g. run_rule_tests, run_module
    outputSchema: object;
    onProgress?: (msg: string) => void;
    timeoutMs: number;
  }): Promise<T>;
}
```
2. `fixture.ts` (**first**, so everyone can proceed), then `sdk.ts` after the Hour-0 check. Mode via `CLINE_MODE=sdk|fixture`.
3. **Workflow A** `ingest.ts`: text extraction → Cline task → draft rule with `source_page`/`source_quote` per field → **generated tests from the circular's examples** → `run_rule_tests` tool → repair loop (max 3) → draft + diff in `_drafts/`. The engine ignores drafts until `/approve`.
4. **Workflow B** `fill.ts`: profile + form schema → `FormFillResult`; deterministic validators run after Cline.
5. **Workflow C** `plan.ts` (stretch): Cline calls `run_module` as a tool and returns an ordered plan; always validated against `ActionPlan`; falls back to M4's deterministic builder on any failure.
6. `modules/claim`: deadline logic, evidence checklist, intimation via Workflow B, channel data.
7. `modules/registry.ts`, `GET /api/modules`, contract-test runner (`npm run contract`) that runs every enabled module on its fixture request and validates the result with Zod.
8. Safety rails in every Cline instruction: never invent values (unknown → `null` and list it as missing), never contact external portals, output only the schema.
**DoD:** with `CLINE_MODE=fixture` the full flow runs deterministically; with `sdk` at least one real ingest (with generated tests) and one real fill succeed, and their outputs are saved as new fixtures.

### M4: Plan, Dossier, Offline, Docs, Mandi
**Deliverables**
1. `plan/build.ts`: dedupe documents, sort actions by `priority` then `due_at`, generate `cross_notes` from module relationships (e.g. claim ↔ KCC ↔ PMFBY). Deterministic; this is the baseline for Workflow C.
2. `dossier/pdf.ts`: A4, large type, language-aware, embedded Noto fonts, disclaimer footer, QR to official portals; one section per module with its tier label and `provenance`.
3. `whatsapp.ts`: ≤ 1,000-char summary + `wa.me` link + Web Share API.
4. `ActionPlanView`: countdown, tick-box checklist (persisted), download/share/print.
5. Offline: `localStorage` save/restore, service worker, PWA manifest.
6. `modules/mandi`: data client, snapshot fallback, haversine, net-of-transport logic, trend, recommendation.
7. Docs: README, architecture image, PPT, demo script, **`docs/cline-evidence.md`** (start screen recording at Hour 0).
8. `scripts/e2e-demo.sh`: runs all three personas end to end.
**DoD:** PDF renders all three scripts and opens on a phone; WhatsApp text under limit; mandi works live and from the snapshot.

---

## 8. Hour-by-Hour Plan

| Hour | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| 0:00–0:30 | **All:** Hour-0 checks, scaffold with Cline, agree contracts, **start screen recording** | | | |
| 0:30–2:00 | STT/TTS + chips + mock turn + fixtures | Scheme JSON ×3, evaluator skeleton | **Fixture adapter**, registry, route wiring | Plan builder on fixtures, font test |
| 2:00–3:30 | Interview agent, units, router | Remaining schemes, stack logic, tests; soil bands | Claim module + Workflow B | PDF + WhatsApp + ActionPlanView |
| 3:30–4:00 | Camera + triage engine skeleton | Soil parse + confirm API | Workflow A skeleton | Mandi client + snapshot |
| **4:00** | **Contract gate:** `npm run contract`; any failing module → `enabled:false` (fix later if time) | | | |
| 4:00–5:30 | Crop Doctor + Livestock catalogs and tests | Advisory + RAG | Workflow A with generated tests; SDK adapter | Mandi logic, offline, README draft |
| **5:30** | **Integration checkpoint:** real endpoints wired; run all three personas | | | |
| 5:30–6:30 | Fix integration bugs; native-speaker review of prompts | Verify rules and sources | Record real SDK outputs as fixtures; Workflow C if healthy | e2e script, PPT, evidence log |
| 6:30–7:15 | Polish voice fallbacks; tile states | Source review | Retry/timeout hardening | Final docs |
| **7:15** | **Feature freeze** | | | |
| 7:15–8:00 | Rehearse twice; record demo; publish repo; social post | | | |

---

## 9. Environment & Setup

```bash
# .env.example
LLM_API_KEY=            LLM_MODEL=              # vision-capable model
CLINE_MODE=fixture      CLINE_API_KEY=          # per Cline SDK docs
BHASHINI_USER_ID=       BHASHINI_API_KEY=       WHISPER_API_KEY=
DATA_GOV_IN_API_KEY=                            # mandi dataset
TRANSPORT_RATE_PER_Q_KM=                        # explicit assumption, shown in UI
DEMO_NOW=                                       # freeze clock for countdowns
```
```bash
git clone <repo> && cd kisansahay-ai && cp .env.example .env
npm install && npm run dev        # server :8787, web :5173
npm test                          # rules + validators
npm run contract                  # every enabled module vs its fixture
```

## 10. `.clinerules` (one per module owner)

```
# .clinerules/m2.md
- Edit only server/src/modules/{schemes,soil,advisory}/, server/src/rules/, data/{schemes,soil,crops}/.
- Types come from contracts/types.ts. Do not edit them; ask in chat.
- Every data file needs source + verified_on. If a source is unclear, write "TODO_VERIFY" and stop.
- Never let the LLM produce a verdict, rating band, or threshold; those come from data files.
- Add a unit test for every new rule.
```
Write equivalents for M1 (triage: LLM may only emit feature ids from the vocabulary), M3 (never invent values; output only the schema) and M4 (no network in the plan builder).

## 11. Privacy, Safety and Responsible Use

- **Sensitive data:** Aadhaar, land records, bank details, location, photos. Keep them in the browser for the MVP, mask in the UI, and never log them. GPS only with an explicit tap and a stated reason (evidence and local weather).
- **Consent screen** in the chosen language before the interview.
- **No submission** to government portals.
- **Agrochemicals:** no product names or doses from the model; always the agrochemical disclaimer; refer to the KVK or agriculture officer.
- **Veterinary:** triage level only, no drug doses; notifiable-disease prompt; always "call a vet."
- **Finance:** the mandi output is a comparison with stated assumptions, not a forecast or advice.
- **Photos:** do not store them on the server in the MVP. Claim evidence stays on the device and is added to the dossier locally; only hashes and metadata go in the JSON.
- **Disclaimer footer on every dossier:** "Prepared with AI assistance. Confirm with the official portal, your agriculture office or a veterinarian."

## 12. Risk Mitigation & Fallback Matrix

| # | Risk | Likelihood | Detection | Fallback (in order) |
|---|---|---|---|---|
| 1 | **Scope: 7 modules in 8 h** | High | 4:00 contract gate | `enabled:false` on failing modules; ship them as "coming soon." Cut order in §13 |
| 2 | **M1/M2/M4 overload** | High | Hour 4 progress check | Move thin modules to the first free person; use Cline for data drafting; cut Livestock and Advisory first |
| 3 | **LLM latency > 6 s** | Medium | Turn timer | Filler utterance → retry smaller model → **scripted slot-filler** → cached transcripts |
| 4 | **LLM returns malformed JSON** | Medium | Zod failure | Retry once with the error; else keep previous state and re-ask |
| 5 | **Web Speech unsupported (esp. Assamese)** | High | `onerror`/timeout | Bhashini/Whisper blob → typed → chips |
| 6 | **No TTS voice for language** | High | `getVoices()` check | Bhashini TTS → pre-recorded clips → large on-screen text |
| 7 | **Spotty venue network** | High | `navigator.onLine` | Backend on laptop; `CLINE_MODE=fixture`; snapshot mandi data; cached forecast; backup video |
| 8 | **Cline SDK mismatch/unstable** | Medium | Hour-0 smoke test | `ClineAdapter` → `fixture`; fixtures recorded from real runs where possible; be honest in the video |
| 9 | **Cline task slow (> 20 s)** | Medium | Timeout | Stream progress; fall back to fixture labelled "cached run" |
| 10 | **Cline output hallucinated** | Medium | Zod + deterministic validators | Retry once; unknown → `null` + missing list; never auto-approve a draft rule |
| 11 | **Workflow A tests don't converge** | Medium | 3-loop cap | Return draft flagged `tests_failing` for human review; demo with the pre-tested sample circular |
| 12 | **Workflow C picks wrong modules** | Medium | Schema + sanity check | Deterministic plan builder (always built first) |
| 13 | **Crop/livestock misclassification** | High | Low confidence, poor photo | Show confidence, `escalate`, retake prompt; label as prototype; demo only with catalog-covered cases |
| 14 | **Unsafe agrochemical or vet advice** | Medium | Catalog lint test | Engine can emit only catalog text; entries without `advisory_source` give no treatment steps |
| 15 | **Soil card OCR errors / layout variance** | High | OCR confidence < 0.7 | Highlight and confirm; typed-values path |
| 16 | **Mandi API empty/stale/rate-limited** | High | Empty response, old date | Snapshot CSV + `stale:true` + visible price date |
| 17 | **Weather API failure** | Low | HTTP error | Cached forecast JSON; hide advisory nudges that need rain data |
| 18 | **Wrong land conversion** | High | Confirm-card mismatch | Always confirm; keep `raw_units`; warn in output |
| 19 | **Rule or catalog data wrong/stale** | Medium | Persona tests, source check | `source` + `verified_on` on everything; two-person review; engine ignores drafts |
| 20 | **PDF garbles Devanagari/Assamese** | Medium | Visual check in Hour 1 | Embed Noto fonts; HTML print fallback |
| 21 | **GPS denied** | Medium | Permission result | District centroid; claim evidence without GPS but with timestamp |
| 22 | **Contract drift** | Medium | `npm run contract` in CI | Folder ownership; fixtures in Hour 1; 5:30 checkpoint; 7:15 freeze |
| 23 | **Judges mistake breadth for shallowness** | Medium | Rehearsal feedback | Tier labels, lead with the Claim → Schemes flow, show metrics you actually measured |

### Degradation ladder (what the demo must always show)
```
Level 0: live voice → live LLM → live Cline SDK → live data feeds
Level 1: live voice → live LLM → FIXTURE Cline  → snapshot data
Level 2: typed/chips → scripted slot-filler → FIXTURE Cline → snapshot data
Level 3: pre-recorded video of Level 0
```
Rehearse switching levels once before recording.

## 13. Cut Order (if behind schedule)

1. Livestock Triage
2. Hyperlocal Advisory (keep one static "simulate tomorrow" card if time)
3. Crop Doctor live vision (use catalog-backed cached cases)
4. Workflow C (use the deterministic plan)
5. RAG
6. State-specific schemes
7. Soil OCR (typed values only)
8. Live mandi API (snapshot only)
9. Second regional language voice (typed/chips for Assamese)

**Never cut:** interview + router, Scheme Finder, Claim Assistant, Action Plan/dossier, Workflow B, demo video.

## 14. Testing Checklist (M4 runs it at 6:30)

- [ ] `npm run contract` passes for every enabled module
- [ ] Persona 1 (Anita), 2 (Ramesh), 3 (Kamal) complete end to end in their language
- [ ] Router sends Anita's utterance to `claim` first
- [ ] Claim countdown correct with `DEMO_NOW`; expired state reads clearly
- [ ] Soil: low-confidence values highlighted; edited values change the ratings
- [ ] Mandi: live path and snapshot path both render; `stale` label shown on snapshot
- [ ] Triage: poor-quality photo prompts a retake; no entry without a source produces treatment steps
- [ ] Livestock red flag forces `vet_now`
- [ ] Workflow A: sample circular → generated tests → repair → draft diff → approve
- [ ] Workflow B: fill returns in < 20 s or falls back with a label
- [ ] PDF renders all three scripts; WhatsApp text < 1,000 chars
- [ ] Airplane-mode reload shows the last Action Plan
- [ ] No PII in server logs
- [ ] README setup works from a clean clone

## 15. Submission Checklist

- [ ] Public GitHub repo with README (problem, solution, architecture, stack, setup, **how Cline was used** in build and in product)
- [ ] PPT (outline in `blueprint.md` §13)
- [ ] **Demo video** with a real user scenario and Cline visible during the build (mandatory)
- [ ] Social post tagging Cline (bonus)
- [ ] `docs/cline-evidence.md` linked from the README
