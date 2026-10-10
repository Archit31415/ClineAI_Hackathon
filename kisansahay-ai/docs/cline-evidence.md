# How Cline was used

## 1. Build time (Cline as AI pair programmer)

| Phase | What Cline did | Evidence to capture |
|---|---|---|
| Hour 0 | Read `blueprint.md` + `technical.md` + the hackathon PDF; inspected the published `@cline/sdk` package (v0.0.92) to confirm the real API (`ClineCore.create()`, `start({config, prompt})`, `extraTools` via `createTool`, `result.text`) before writing the adapter | Screen recording of the session |
| Scaffold | Created the npm-workspace monorepo (`contracts/`, `server/`, `web/`), Zod contracts mirroring technical.md §4, module registry and fixtures | First commit |
| Modules | Implemented all 7 modules against the uniform `ModuleResult` envelope, plus rules engine, triage engine, plan builder, dossier | Commit history |
| Data authoring | Drafted scheme rules, soil bands, crop calendar, triage catalogs, prompt bank — all marked `TODO_VERIFY` for human verification | `data/` diffs |
| Testing | Wrote persona-driven tests (45) + contract gate; ran them and fixed failures | `npm test`, `npm run contract` output |
| Debugging | Found and fixed: Indic PDF shaping (`regeneratorRuntime` missing in `@pdf-lib/fontkit`, and pdf-lib dropping GPOS positions → glyph-by-glyph drawing); React effect returning a non-function cleanup; Zod input/output type variance | Before/after PDF screenshots |
| UI verification | Drove headless Chrome through the Anita, Kamal and Workflow A flows and inspected screenshots | Screenshots |

> TODO (team): add screen-recording links and per-member clips here before submission.

## 2. Run time (Cline SDK inside the product)

All product code calls Cline only through `server/src/cline/adapter.ts` (`ClineAdapter.runTask`).
`CLINE_MODE=sdk` uses `@cline/sdk`; `CLINE_MODE=fixture` replays deterministic runs (labelled "cached run" in the UI). Any SDK error/timeout falls back to the fixture.

| Workflow | Where | What the agent does | Guard rails |
|---|---|---|---|
| **A — Rule ingestion with generated tests** | `server/src/cline/ingest.ts`, UI 🤖 panel | Circular → draft rule with `source_page`/`source_quote` → test cases from the circular's own examples → `run_rule_tests` tool → repair loop (max 3) → draft + diff | Our evaluator re-runs tests; drafts are ignored by the engine until a human approves; approve re-runs tests and backs up the old rule |
| **B — Form fill + validation** | `server/src/cline/fill.ts`, used by the Claim Assistant | Profile + form schema → `form_values` | Code validators (IFSC, survey number, date not in future, enums, required) always re-check; unknown → `null`; never submits |
| **C — Plan orchestration** | `server/src/cline/plan.ts`, "Let the Cline agent orchestrate" toggle | Calls `run_module` as a tool, orders actions, explains cross-module links | Deterministic plan is built first; agent ordering only applies within a priority band (urgent stays first); fallback on any failure |
| **D — Photo reading (vision via Cline)** | `server/src/cline/vision.ts` via `server/src/lib/vision.ts`; used by Livestock, Crop Doctor, Soil Card | `ClineCore.start({ providerId: "cline", modelId: VISION_MODEL, userImages: [photo] })` returns visible features from a fixed vocabulary, or printed soil-card numbers | Off-vocabulary ids dropped; triage levels / bands still come from data; soil values must be confirmed; failure → farmer told "photo not checked"; text-only input never spends vision credits. Live check: `src/scripts/vision-smoke.ts` (calf photo → `skin_nodules` → vet_now, ~6 s, ~$0.001) |
