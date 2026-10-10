import { useState } from "react";
import type { ActionPlan, FarmerProfile, ModuleId, ModuleRegistryEntry, ModuleResult } from "@kisansahay/contracts/types";
import { api, pollTask } from "./api";

/** Builds the Action Plan: deterministic (run each routed module, then /api/plan) or Cline-orchestrated (Workflow C). */
export function usePlanBuilder(registry: ModuleRegistryEntry[], savePlan: (p: ActionPlan) => void) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function build(profile: FarmerProfile, intents: ModuleId[], utterance: string, useCline: boolean) {
    setErr("");
    const enabled = new Set(registry.filter((m) => m.enabled).map((m) => m.id));
    try {
      if (useCline) {
        setBusy("Cline is planning…");
        const { task_id } = await api.clinePlan(profile, utterance);
        const t = await pollTask<ActionPlan>(task_id, (s) => setBusy(s.progress.at(-1)?.msg ?? "…"));
        if (t.result) return savePlan(t.result);
        throw new Error(t.error ?? "planning failed");
      }
      const results: ModuleResult[] = [];
      for (const id of intents.filter((i) => enabled.has(i))) {
        setBusy(`${id}…`);
        try { results.push(await api.run(id, profile)); } catch { /* a failing module never blocks the plan */ }
      }
      savePlan(await api.plan(profile, results));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function addResult(profile: FarmerProfile, plan: ActionPlan | undefined, r: ModuleResult) {
    const others = (plan?.results ?? []).filter((x) => x.module !== r.module);
    try { savePlan(await api.plan(profile, [...others, r])); } catch (e) { setErr((e as Error).message); }
  }

  return { busy, err, build, addResult };
}
