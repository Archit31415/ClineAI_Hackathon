/**
 * Workflow C (stretch): Cline orchestrates the Action Plan by calling our module runners as tools.
 * The deterministic plan is ALWAYS built first and is the fallback on any failure.
 */
import { z } from "zod";
import { I18nZ, ModuleIdZ, type ActionPlan, type FarmerProfile, type ModuleId, type ModuleResult } from "@kisansahay/contracts";
import { buildPlan } from "../plan/build";
import { isModuleId, registry, runModule } from "../modules/registry";
import { routeIntents } from "../router/intent";
import { clineTimeout, getCline } from "./index";

const OrchestrationZ = z.object({
  modules: z.array(ModuleIdZ).min(1),
  priority_order: z.array(z.string()).default([]), // action ids in desired order
  explanation: I18nZ,
});
type Orchestration = z.infer<typeof OrchestrationZ>;

export async function runPlanOrchestration(
  profile: FarmerProfile,
  utterance: string,
  progress: (m: string) => void,
): Promise<{ result: ActionPlan; provenance: "cline-sdk" | "fixture" }> {
  const enabled = new Set(registry().filter((m) => m.enabled).map((m) => m.id));
  const cache = new Map<ModuleId, ModuleResult>();
  const run = async (id: ModuleId) => {
    if (!cache.has(id)) cache.set(id, await runModule(id, profile));
    return cache.get(id)!;
  };

  // 1) deterministic baseline first
  const baseIds = routeIntents(profile, utterance).filter((m) => enabled.has(m));
  if (!baseIds.includes("schemes") && enabled.has("schemes")) baseIds.push("schemes");
  for (const id of baseIds) await run(id).catch((e) => progress(`module ${id} failed: ${(e as Error).message}`));
  const baseline = buildPlan(profile, [...cache.values()]);
  progress(`deterministic plan built (${baseline.ordered_actions.length} actions)`);

  // 2) Cline orchestration
  try {
    const { output, provenance } = await getCline().runTask<Orchestration>({
      kind: "plan",
      instructions:
        "Decide which farmer-help modules to run for this farmer, call run_module for each, then return the module list, " +
        "the action ids in the order the farmer should do them (deadlines and safety first), and a short explanation in en/hi/as of cross-module links " +
        "(e.g. 'claim first because of the deadline; KCC stacks with PMFBY'). Use only facts returned by run_module.",
      inputs: { profile, utterance, available_modules: [...enabled] },
      tools: [{
        name: "run_module",
        description: "Run a KisanSahay module for the current farmer profile. Returns its ModuleResult (headline, actions, body).",
        inputSchema: { type: "object", properties: { module_id: { type: "string", enum: [...enabled] } }, required: ["module_id"] },
        execute: async (input) => {
          const id = String(input.module_id);
          if (!isModuleId(id) || !enabled.has(id)) return { error: "unknown or disabled module" };
          const r = await run(id);
          return { module: r.module, headline: r.headline.en, status: r.status, actions: r.actions.map((a) => ({ id: a.id, label: a.label.en, priority: a.priority, due_at: a.due_at })) };
        },
      }],
      outputSchema: OrchestrationZ,
      outputHint: '{"modules": ["claim","schemes"], "priority_order": ["claim-report","claim-evidence"], "explanation": {"en":"...","hi":"...","as":"..."}}',
      timeoutMs: clineTimeout(),
      onProgress: progress,
      fixture: () => ({
        modules: baseIds.length ? baseIds : ["schemes"],
        priority_order: baseline.ordered_actions.map((a) => a.id),
        explanation: baseline.cross_notes[0] ?? { en: "Ordered by urgency and deadlines.", hi: "तात्कालिकता और समय-सीमा के अनुसार क्रम।", as: "জৰুৰীতা আৰু সময়সীমা অনুসৰি ক্ৰম।" },
      }),
    });
    // sanity check: only enabled modules; run any the agent chose that we haven't
    for (const id of output.modules) if (enabled.has(id)) await run(id).catch(() => undefined);
    const plan = buildPlan(profile, [...cache.values()].filter((r) => output.modules.includes(r.module) || r.module === "claim"));
    const rank = new Map(output.priority_order.map((id, i) => [id, i]));
    // Agent ordering applies within the same priority band only (safety: urgent stays first).
    plan.ordered_actions.sort((a, b) => a.priority - b.priority || (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
    plan.provenance = provenance === "cline-sdk" ? "cline-orchestrated" : "deterministic";
    plan.explanation = output.explanation;
    return { result: plan, provenance };
  } catch (e) {
    progress(`orchestration failed (${(e as Error).message}); using deterministic plan`);
    return { result: baseline, provenance: "fixture" };
  }
}
