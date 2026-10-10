# API Contract (mirror of technical.md §5)

All routes validate with Zod (`contracts/schemas.ts`) and return `{ error: { code, message } }` on failure.

| Method & path | Request | Response |
|---|---|---|
| `GET /api/health` | – | `{ ok, cline_mode, llm, demo_now }` |
| `POST /api/interview/turn` | `{session_id, lang, user_text, profile}` | `{assistant_text, profile, intents[], next_slot, confirm_needed, done, chips?, confirm_text?}` |
| `GET /api/modules` | – | registry from `data/modules.json` |
| `POST /api/modules/:id/run` | `ModuleRunRequest<Input>` | `ModuleResult<Body>` |
| `POST /api/eligibility` | `ModuleRunRequest` | legacy alias of `schemes` |
| `POST /api/plan` | `{profile, results}` | `ActionPlan` (deterministic) |
| `POST /api/cline/plan` | `{profile, utterance}` | `{task_id}` (Workflow C) |
| `POST /api/cline/fill` | `{profile, form_id}` | `{task_id}` (Workflow B) |
| `POST /api/cline/ingest` | `{url}` \| `{text}` \| `{sample_id}` (+ `target_rule_id`) | `{task_id}` (Workflow A) |
| `GET /api/cline/tasks/:id` | – | `ClineTaskStatus` |
| `GET /api/cline/drafts` | – | list of pending drafts |
| `POST /api/cline/ingest/:id/approve` | `{reviewer}` | moves draft into `data/schemes/` |
| `POST /api/dossier` | `{plan}` | `{pdf_base64, whatsapp_text, whatsapp_link, json}` |
| `POST /api/stt` | `{audio_base64, mime, lang}` | `{text}` (Whisper, optional) |
