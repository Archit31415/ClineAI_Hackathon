/**
 * Cline-in-product routes (Workflows A, B, C). Async tasks polled via GET /api/cline/tasks/:id.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ClineFillRequestZ, ClineIngestRequestZ, ClinePlanRequestZ } from "@kisansahay/contracts";
import { fillForm } from "../cline/fill";
import { approveDraft, listDrafts, runIngest } from "../cline/ingest";
import { runPlanOrchestration } from "../cline/plan";
import { createTask, getTask } from "../cline/tasks";
import { ApiError } from "../lib/errors";
import { readJson } from "../lib/paths";

export async function clineRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/cline/fill", async (req) => {
    const body = ClineFillRequestZ.parse(req.body);
    const task_id = createTask("fill_form", async (progress) => {
      const r = await fillForm(body.form_id, body.profile, {}, progress);
      return { result: r, provenance: r.provenance };
    });
    return { task_id };
  });

  app.post("/api/cline/plan", async (req) => {
    const body = ClinePlanRequestZ.parse(req.body);
    const task_id = createTask("plan", (progress) => runPlanOrchestration(body.profile, body.utterance, progress));
    return { task_id };
  });

  app.post("/api/cline/ingest", async (req) => {
    const body = ClineIngestRequestZ.parse(req.body);
    if (!body.sample_id && !body.text && !body.url && !body.pdf_base64) {
      throw new ApiError(400, "invalid_request", "provide sample_id, text, url or pdf_base64");
    }
    const task_id = createTask("ingest_rule", (progress) => runIngest(body, progress));
    return { task_id };
  });

  app.get("/api/cline/samples", async () => readJson("samples", "circulars", "index.json"));
  app.get("/api/cline/drafts", async () => listDrafts());

  app.post<{ Params: { id: string } }>("/api/cline/ingest/:id/approve", async (req) => {
    const { reviewer } = z.object({ reviewer: z.string().min(2) }).parse(req.body);
    try {
      return approveDraft(req.params.id, reviewer);
    } catch (e) {
      throw new ApiError(409, "approve_failed", (e as Error).message);
    }
  });

  app.get<{ Params: { id: string } }>("/api/cline/tasks/:id", async (req) => {
    const t = getTask(req.params.id);
    if (!t) throw new ApiError(404, "not_found", "unknown task");
    return t;
  });
}
