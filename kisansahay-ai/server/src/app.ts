/**
 * Fastify app (route wiring). All routes validate with Zod and return {error:{code,message}} on failure.
 * Privacy: request bodies (photos, profile) are never logged.
 */
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { existsSync, readFileSync } from "node:fs";
import { z, ZodError } from "zod";
import {
  DossierRequestZ, InterviewTurnRequestZ, ModuleRunRequestZ, PlanRequestZ, type ActionPlan,
} from "@kisansahay/contracts";
import { getCline } from "./cline/index";
import { visionStatus } from "./lib/vision";
import { compileDossier } from "./dossier/compile";
import { interviewTurn } from "./interview/agent";
import { nowIso } from "./lib/clock";
import { ApiError, errorBody } from "./lib/errors";
import { llmProvider } from "./lib/llm";
import { ROOT } from "./lib/paths";
import { registry, runModule } from "./modules/registry";
import { buildPlan } from "./plan/build";
import { clineRoutes } from "./routes/cline";
import { sttEnabled, sttStatus, transcribe } from "./voice/stt";

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript", css: "text/css", json: "application/json",
  webmanifest: "application/manifest+json", svg: "image/svg+xml", png: "image/png", ico: "image/x-icon", woff2: "font/woff2",
};

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 15 * 1024 * 1024,
    logger: opts.logger
      ? { level: "info", serializers: { req: (r) => ({ method: r.method, url: r.url.split("?")[0] }), res: (r) => ({ statusCode: r.statusCode }) } }
      : false,
  });
  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) return reply.status(err.statusCode).send(errorBody(err.code, err.message));
    if (err instanceof ZodError) return reply.status(400).send(errorBody("invalid_request", err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")));
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(status).send(errorBody(status === 500 ? "internal" : "bad_request", (err as Error).message));
  });

  app.get("/api/health", async () => ({ ok: true, cline_mode: getCline().mode, llm: llmProvider(), vision: visionStatus(), stt: sttStatus(), demo_now: nowIso() }));

  app.post("/api/interview/turn", async (req) => interviewTurn(InterviewTurnRequestZ.parse(req.body)));

  app.get("/api/modules", async () => registry());

  app.post<{ Params: { id: string } }>("/api/modules/:id/run", async (req) => {
    const body = ModuleRunRequestZ.parse(req.body);
    return runModule(req.params.id, body.profile, body.input);
  });

  app.post("/api/eligibility", async (req) => runModule("schemes", ModuleRunRequestZ.parse(req.body).profile)); // legacy v1 alias

  app.post("/api/plan", async (req) => {
    const body = PlanRequestZ.parse(req.body);
    return buildPlan(body.profile, body.results as ActionPlan["results"]);
  });

  app.post("/api/dossier", async (req) => compileDossier(DossierRequestZ.parse(req.body).plan as ActionPlan));

  app.get("/api/stt/status", async () => sttStatus());

  app.post("/api/stt", async (req) => {
    const b = z.object({
      lang: z.string(),
      pcm_base64: z.string().min(10).optional(),
      pcm_format: z.enum(["f32", "s16"]).optional(),
      audio_base64: z.string().min(10).optional(),
      mime: z.string().optional(),
    }).refine((x) => x.pcm_base64 || x.audio_base64, "pcm_base64 or audio_base64 required").parse(req.body);
    if (!sttEnabled()) throw new ApiError(503, "stt_unavailable", "Server speech recognition is turned off; use typing or chips");
    const text = await transcribe(b);
    if (text === null) throw new ApiError(503, "stt_failed", "Could not transcribe this audio; please type or tap a chip");
    return { text, provider: sttStatus().provider };
  });

  await clineRoutes(app);

  // Serve the built web app (single-process deploy) if web/dist exists.
  const webDist = `${ROOT}/web/dist`;
  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split("?")[0];
    if (path.startsWith("/api/") || !existsSync(webDist)) return reply.status(404).send(errorBody("not_found", "no such route"));
    const safe = path.replace(/\.\.+/g, "").replace(/^\/+/, "");
    const file = safe && existsSync(`${webDist}/${safe}`) && !safe.endsWith("/") ? `${webDist}/${safe}` : `${webDist}/index.html`;
    const ext = file.split(".").pop() ?? "html";
    return reply.type(MIME[ext] ?? "application/octet-stream").send(readFileSync(file));
  });
  return app;
}
