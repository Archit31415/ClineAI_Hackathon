# KisanSahay-AI (किसान सहाय) — Blueprint v2

> **One-liner:** One voice conversation in Hindi or any regional language, seven farmer problems: schemes, insurance claims, soil cards, mandi prices, crop disease, weather advisories and livestock triage. The output is a single, shareable **Farm Action Plan**.

**Hackathon:** Cline AI Builder Hackathon, Round 2 · **Domain:** Agriculture · **Team:** 4 developers · **Build window:** 8 hours

> **Data accuracy note.** Scheme amounts, deadlines, helpline numbers, soil rating bands and disease/livestock catalogs in this document are illustrative and come from memory. Every fact that ships in the product must be verified against an official source (myScheme.gov.in, pmfby.gov.in, soilhealth.dac.gov.in, ICAR / state agricultural university advisories, state animal husbandry departments) and carry `source` and `verified_on` fields.

## 1. Problem Statement

Indian smallholders hit the same walls every season, and they hit several at once:

| # | The wall | Typical moment | Module |
|---|---|---|---|
| 1 | Can't tell what's wrong with the crop until damage is done | Yellow spots on paddy leaves, no expert nearby | **Crop Doctor** |
| 2 | Entitled to schemes they never heard of | PM-KISAN installment stuck; has never heard of SMAM or PKVY | **Scheme Finder** |
| 3 | Insurance claims lost to a short reporting window | Hail yesterday; PMFBY localized-loss window is commonly cited as 72 hours | **Claim Assistant** |
| 4 | Sells at whatever the local trader offers | Wheat sold at the nearest mandi without comparing | **Mandi Advisor** |
| 5 | Soil Health Card issued but not understood | Card in a drawer; fertilizer applied by habit | **Soil Card Interpreter** |
| 6 | Advice that ignores local weather and crop stage | Sprays pesticide the day before heavy rain | **Hyperlocal Advisory** |
| 7 | Vets are scarce and the animal is the family's income | Cow with skin nodules and fever; vet is 20 km away | **Livestock Triage** |

Under all seven sits the same exclusion: **language, literacy and paperwork friction**. Guidelines and portals are in English or formal Hindi, and many farmers think in a regional language.

**Brief alignment:** this answers the hackathon's opening lines directly: "A farmer cannot tell what is wrong with his crop until the damage is done" (modules 1, 6) and "A citizen loses months to a government scheme he qualified for but never heard about" (modules 2, 3).

## 2. Solution Statement

KisanSahay-AI is a voice-first web app (installable PWA) for a basic smartphone.

1. **Speak or tap.** Language tiles: हिन्दी · regional · English. Home shows seven big icon tiles and a mic: "Tell me your problem."
2. **Router.** A short interview builds one shared **farmer profile** (state/district, land, crops, category, pain point, plus module-specific details). An intent router picks the relevant module(s).
3. **Modules run** against a uniform contract and return a standard result envelope (headline, actions, sources, confidence, provenance).
4. **Action Plan.** Results are merged into one ordered plan: what to do today (urgent), what to collect, what to wait for.
5. **Share.** PDF, print or WhatsApp text, cached for offline reopen.
6. **Cline inside the runtime** keeps rules current (ingestion with generated tests), fills and validates forms and claims, and optionally orchestrates a multi-module plan.

## 3. Design Principles

1. **Deterministic where it matters.** Eligibility, deadlines, soil ratings, price comparisons and livestock red flags come from data and code. The LLM extracts, explains, translates and describes what it sees; it does not decide.
2. **Triage, not diagnosis.** For crops and animals the output is "most likely candidates, how to confirm, what is safe to do now, when to call an expert." No pesticide doses and no veterinary drug doses come from the model.
3. **Honest depth.** Each module is labelled **Deep / Working / Prototype** in the UI and the pitch.
4. **Confirm before trust.** Anything read from a photo or heard from voice (land units, soil values, claim facts) is shown back for a tap-to-correct step.
5. **Human in the loop.** We prepare documents and advice. We do not submit to portals, and we say so.
6. **Works on a bad phone and a bad network.** Voice, chips and typing are always all available; last result is cached offline.

## 4. Examples

| Persona | Context | Modules touched |
|---|---|---|
| **Anita Das, 35, Nagaon, Assam** | 0.8 ha paddy, Assamese speaker, hailstorm yesterday | Claim → Schemes (PMFBY, KCC, PKVY) → Advisory |
| **Ramesh Yadav, 42, Uttar Pradesh** | 1.2 ha wheat, Hindi speaker, PM-KISAN stuck, wants to sell stored wheat | Schemes → Soil Card → Mandi |
| **Kamal Rabha, 50, Assam** | 2 cows, 0.5 ha, a cow with fever and skin nodules | Livestock Triage → Schemes (dairy/KCC) |
| **CSC operator / extension worker** | Serves 30+ farmers a week | Needs fast intake and printable plans |

## 5. End-to-End User Journeys

### Common entry
Language tile → spoken greeting → home with seven tiles + mic. Tapping a tile goes straight to that module (still using the shared profile); speaking a problem lets the router choose.

### Journey A: Anita (hero demo, Claim-led)
1. **Voice (Assamese):** "মই নগাঁও জিলাৰ। দুবিঘা মাটি, ধান খেতি। কালি শিলাবৃষ্টি হ'ল।"
2. **Router** detects `crop_loss` and `hail`, starts the **Claim Assistant** first because a deadline is running.
3. **Profile confirmation:** "2 bigha ≈ 0.27 ha, paddy, Nagaon, hail yesterday. Correct?" (tap to fix)
4. **Claim Assistant:** countdown ("**61 hours left**"), evidence capture guide (wide shot, close-ups, two different spots, boundary landmark), photos stamped with time and location (with consent), a drafted loss-intimation form, and the reporting channels (verified before display).
5. **Scheme Finder** runs in the background: KCC, PKVY, and stacking with PMFBY.
6. **Hyperlocal Advisory:** "More rain forecast in 2 days; delay field work and drain standing water."
7. **Action Plan:** one list ordered by urgency, shareable on WhatsApp.

### Journey B: Ramesh (data-heavy)
1. **Scheme Finder:** diagnoses a stuck PM-KISAN installment (eKYC, Aadhaar seeding, land-record mismatch are common causes), then finds SMAM and PM-KUSUM.
2. **Soil Card Interpreter:** photograph the card, confirm the parsed values, get plain-language ratings and a fertilizer plan based on the card's printed recommendation or the verified state table.
3. **Mandi Advisor:** wheat, 20 quintals; compares nearby mandis net of transport cost; "sell at X" or "wait a few days" with the reason and data date.

### Journey C: Kamal (prototype-tier, but important)
Voice + photo of nodules → **Livestock Triage** returns `vet_now`, "isolate the animal," "this may be a notifiable disease, inform the veterinary officer," and what not to do. Then the Scheme Finder checks dairy-related support.

### Prototype demo moments (fast tiles)
**Crop Doctor:** photo of a paddy leaf → candidate diseases, how to confirm, safe steps, "ask the KVK or agriculture officer before spraying."

## 6. Module Catalog and Depth Tiers

| # | Module | Tier | What it does | Core data | Hard guardrail |
|---|---|---|---|---|---|
| 2 | **Scheme Finder** | **Deep** | Rules engine over structured scheme data, stacking/conflicts, document checklist, stuck-payment diagnosis | `data/schemes/*.json` (verified) | LLM never decides eligibility; every verdict shows a source link |
| 3 | **Claim Assistant** | **Deep** | Deadline countdown, guided evidence capture, intimation draft, channel list | PMFBY rules, form schema | Prepares only; farmer submits. Dates/channels verified |
| 5 | **Soil Card Interpreter** | **Working** | OCR of card → confirm → ratings → plan | Rating bands + state fertilizer table | Show parsed values for correction; use card's printed recommendation when available |
| 4 | **Mandi Advisor** | **Working** | Compare nearby mandis net of transport; trend; sell/wait | data.gov.in daily mandi price dataset (needs API key) + cached snapshot | "Not a price forecast"; show the data date; stale-data warning |
| 1 | **Crop Doctor** | **Prototype** | Photo + symptoms → candidate diseases from a curated catalog | Small catalog of common crops/diseases | Triage only; no doses; refer to KVK/agri officer; show confidence |
| 6 | **Hyperlocal Advisory** | **Prototype** | Weather forecast + crop stage → nudges | Open-Meteo forecast (no key) + crop calendar + advisory rules | Rules from cited advisories; "check official advisory" link |
| 7 | **Livestock Triage** | **Prototype** | Symptoms/photo → urgency level, isolate, call-vet | Red-flag rules + small catalog | Triage level only; no drug doses; notifiable-disease prompt |

**Why tiers:** with four people and eight hours, seven modules cannot all be deep. Deep modules carry the story and the demo; working modules prove breadth with real data; prototypes show the platform generalises. Every prototype is built on a shared **triage engine** or **rules engine**, so it costs a fraction of a bespoke module.

**Module gating rule:** each module is enabled only if it passes its contract test by **Hour 4** (see `technical.md`). Anything that fails ships as a greyed-out "coming soon" tile, not as a broken feature.

## 7. Dual Cline Integration Strategy

### 7.1 Cline as AI pair programmer (build time)

| Phase | Use of Cline | Evidence to capture |
|---|---|---|
| Hour 0 | Plan mode: agree architecture from `technical.md`; Act mode: scaffold monorepo, `contracts/`, module registry, fixtures | First-commit recording |
| Hours 1–5 | Per-member `.clinerules` keep each session in its folder; Cline implements modules against contracts and fixtures | Commit history, short clips per member |
| Data authoring | Cline drafts scheme rules, soil bands, crop calendar and triage catalogs from official PDFs; **humans verify** against sources | PDF → JSON before/after |
| Testing | Cline writes table-driven tests from the personas; runs and fixes failures | Test output screenshot |
| Debugging | Cline diagnoses voice, OCR and contract mismatches | Debug clip |
| Docs | Cline drafts README sections from real code | README "How Cline was used" |

**Mandatory for the demo video:** show Cline in action during the build. Member 4 starts screen recording at Hour 0 and keeps `docs/cline-evidence.md`.

### 7.2 Cline SDK inside the product (run time)

> **Implementation note:** confirm the Cline SDK's real package name, entry points, auth and how to get structured output in **Hour 0**. All product code calls Cline only through our `ClineAdapter`, with a fixture-replay implementation behind it, so an API mismatch is a one-file fix.

**Workflow A: Rule ingestion with generated tests (background agent)**
A new circular/PDF/HTML goes in → the agent extracts a draft rule (scheme eligibility, soil bands, advisory thresholds) in our schema, citing page and quote → **writes test cases from the circular's own examples** → runs them against our evaluator → repairs the draft until tests pass (max 3 loops) → emits a draft + diff against the current rule → **human approves** → published. This is a real generate-test-repair loop, not a one-shot extraction.

**Workflow B: Form fill and claim validation**
Profile + form schema → agent produces `form_values`, then plain-code validators (IFSC, survey-number pattern, date logic) re-check the output. Used for scheme application data and the PMFBY loss-intimation draft. Returns errors, warnings, missing documents and confidence. It never submits anywhere.

**Workflow C: Action-plan orchestration (stretch)**
Given a farmer's utterance and profile, a Cline agent calls our module runners as tools (`run_module`) and assembles an ordered Action Plan, explaining cross-module links ("claim first because of the deadline; KCC stacks with PMFBY"). A deterministic plan-builder is the fallback and is always built first.

**Why this counts as real Cline-in-product value:** keeping rules current across many schemes and advisories is the hard part of the agriculture-information problem; Workflow A turns it into a reviewable, test-backed pipeline.

## 8. Demo Plan (mandatory video, target ≤ 4:00)

| Time | Scene |
|---|---|
| 0:00–0:20 | Hook: one farmer, seven problems, one phone |
| 0:20–0:45 | Build montage: Cline Plan/Act, four members, commit graph |
| 0:45–1:45 | Anita speaks Assamese → router → Claim Assistant: countdown, evidence guide, drafted intimation |
| 1:45–2:10 | Scheme Finder: PMFBY + KCC + PKVY, stacking panel, document checklist |
| 2:10–2:30 | Soil card photo → confirm → plan |
| 2:30–2:50 | Mandi: sell-or-wait with net-of-transport comparison |
| 2:50–3:10 | Fast tiles, labelled prototype: Crop Doctor, Advisory, Livestock |
| 3:10–3:40 | Cline in the product: form-fill progress; ingest a circular → generated tests → rule diff |
| 3:40–4:00 | Action Plan on WhatsApp, impact, honest limits, future scope |

If a real farmer or extension worker can try it, even for 2 minutes, include that clip. It does more for "real-world usefulness" than any slide.

## 9. Evaluation Criteria Mapping

| Criterion | Our answer |
|---|---|
| Creativity & uniqueness | A single voice companion across seven farmer problems with a shared profile and one Action Plan; most entries pick a single feature |
| Innovation | Rules-as-data pipeline with agent-generated tests; triage engine that constrains the LLM to a verified feature vocabulary |
| Real-world usefulness | Time-critical claim help, unclaimed schemes, soil and price decisions, animal triage; output usable by a CSC operator today |
| Effective use of Cline | Build time (§7.1) and run time (§7.2), documented with evidence |
| Product usability & execution | Voice, chips and typing; honest tier labels; offline last result; module gating |
| Technical implementation | Uniform module contract, deterministic engines, adapter pattern, fallback ladder |
| Bonus: Cline in product | Workflows A, B and (stretch) C |

## 10. Success Metrics (quote only what you measure)

- Time from first utterance to Action Plan: target under 3 minutes
- Modules passing contract tests: target 7 of 7, minimum 4 (Schemes, Claim, Soil or Mandi, Dossier)
- Interview completion without typing: ≥ 80% in rehearsals
- New circular → reviewable draft with passing tests: under 3 minutes

## 11. Honest Limits to State in the PPT and Video

- Crop and livestock photo triage is a **prototype**; photo-based diagnosis can be wrong and the product says so.
- Soil OCR depends on card layout and photo quality; the confirm step is the safeguard.
- Mandi data can be missing or stale on a given day; the app shows the data date and falls back to a snapshot.
- Land units (bigha, katha) vary by state; the app always confirms.
- No portal submission; no pesticide or drug doses; no price forecasts.
- Sensitive data (Aadhaar, land records, bank details) stays in the browser for the MVP.

## 12. Future Scope

WhatsApp bot and IVR for feature phones · DigiLocker and state-portal integration · proactive seasonal nudges · more crops, diseases and languages · village "scheme camp" mode for CSC operators · outcome tracking (which plans led to successful claims) · deeper vision models once validated with agronomists and veterinarians.

## 13. PPT Outline (Member 4)

1. Title and team
2. Seven walls, one farmer (problem table, §1)
3. Why now (Indic voice, vision, agent runtimes)
4. Solution overview and screenshot
5. Journeys (A, B, C)
6. Module tiers: Deep / Working / Prototype (§6)
7. Architecture diagram
8. AI models and tools
9. Cline at build time
10. Cline in the product (Workflows A, B, C)
11. Safety and guardrails
12. Challenges and honest limits
13. Metrics from rehearsal
14. Future scope
15. Links: repo, demo video, post

## 14. Things to Verify Before Showing Anything to Judges

- Cline SDK package, API and structured-output method (Hour 0)
- Assamese STT/TTS availability on the demo device
- All scheme rules, deadlines and reporting channels (including any helpline numbers)
- Soil rating bands and the state fertilizer table
- Mandi dataset access, API key, and column names
- Disease and livestock catalogs against ICAR / state university / animal husbandry sources
- Whether the hackathon allows pre-recorded fixtures and third-party datasets
