# KisanSahay-AI — shared rules for every Cline session

- Read `docs/blueprint.md` and `docs/technical.md` before changing behaviour.
- Contracts live in `contracts/types.ts` + `contracts/schemas.ts`. Never rename a field; add fields instead. Ask in chat before editing.
- Deterministic where it matters: verdicts, deadlines, soil bands, price comparisons, triage levels come from data + code. The LLM extracts, explains and translates only.
- Every data file carries `source` + `verified_on`. Unknown source → `TODO_VERIFY`, never invent.
- No pesticide names/doses, no veterinary drug doses, no price forecasts, no portal submission.
- Never log request bodies (photos, Aadhaar, land records, bank details).
- Before finishing: `npm run typecheck && npm test && npm run contract`.
