import type {
  ActionPlan, ClineTaskStatus, DossierResponse, FarmerProfile, InterviewTurnResponse, Lang, ModuleId,
  ModuleRegistryEntry, ModuleResult,
} from "@kisansahay/contracts/types";

async function req<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
  return json as T;
}

export interface Health {
  ok: boolean; cline_mode: string; llm: string; stt: unknown; demo_now: string;
  vision?: { provider: "cline" | "llm" | "none"; model: string | null };
}

let healthOnce: Promise<Health> | undefined;
/** Health fetched once per page load (used for capability hints like "photo reading not set up"). */
export function cachedHealth(): Promise<Health> {
  healthOnce ??= api.health().catch((e) => { healthOnce = undefined; throw e; });
  return healthOnce;
}

export const api = {
  health: () => req<Health>("/api/health"),
  modules: () => req<ModuleRegistryEntry[]>("/api/modules"),
  turn: (session_id: string, lang: Lang, user_text: string, profile: FarmerProfile) =>
    req<InterviewTurnResponse>("/api/interview/turn", { session_id, lang, user_text, profile }),
  run: <B = unknown>(id: ModuleId, profile: FarmerProfile, input?: unknown) =>
    req<ModuleResult<B>>(`/api/modules/${id}/run`, { profile, input }),
  plan: (profile: FarmerProfile, results: ModuleResult[]) => req<ActionPlan>("/api/plan", { profile, results }),
  dossier: (plan: ActionPlan) => req<DossierResponse>("/api/dossier", { plan }),
  stt: (pcm_base64: string, lang: Lang) => req<{ text: string; provider: string }>("/api/stt", { pcm_base64, pcm_format: "s16", lang }),
  sttStatus: () => req<{ provider: string; model: string | null; ready: boolean }>("/api/stt/status"),
  clinePlan: (profile: FarmerProfile, utterance: string) => req<{ task_id: string }>("/api/cline/plan", { profile, utterance }),
  clineFill: (profile: FarmerProfile, form_id: string) => req<{ task_id: string }>("/api/cline/fill", { profile, form_id }),
  clineIngest: (body: { sample_id?: string; text?: string; url?: string; target_rule_id?: string }) => req<{ task_id: string }>("/api/cline/ingest", body),
  clineSamples: () => req<{ id: string; title: string; target_rule_id: string }[]>("/api/cline/samples"),
  clineDrafts: () => req<unknown[]>("/api/cline/drafts"),
  clineApprove: (id: string, reviewer: string) => req<unknown>(`/api/cline/ingest/${id}/approve`, { reviewer }),
  task: <R>(id: string) => req<ClineTaskStatus<R>>(`/api/cline/tasks/${id}`),
};

/** Poll a Cline task until done/failed, reporting progress. */
export async function pollTask<R>(id: string, onUpdate: (t: ClineTaskStatus<R>) => void, timeoutMs = 90000): Promise<ClineTaskStatus<R>> {
  const start = Date.now();
  for (;;) {
    const t = await api.task<R>(id);
    onUpdate(t);
    if (t.status === "done" || t.status === "failed") return t;
    if (Date.now() - start > timeoutMs) throw new Error("Cline task timed out");
    await new Promise((r) => setTimeout(r, 400));
  }
}
