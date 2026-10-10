import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { ActionPlanZ, type ActionPlan } from "@kisansahay/contracts";
import { dataPath } from "../src/lib/paths";
import { post, waitTask } from "./app";
import { personas } from "./helpers";

describe("Cline workflows (fixture mode)", () => {
  const created: string[] = [];
  const pmkisanPath = dataPath("schemes", "pmkisan.json");
  const pmkisanOrig = readFileSync(pmkisanPath, "utf8");
  afterAll(() => {
    writeFileSync(pmkisanPath, pmkisanOrig);
    for (const id of created) for (const f of [`${id}.json`, `${id}.previous.json`]) {
      const p = dataPath("schemes", "_drafts", f);
      if (existsSync(p)) rmSync(p);
    }
  });

  it("Workflow A: sample circular -> generated tests -> repair -> passing draft + diff -> approve", async () => {
    const { body } = await post<{ task_id: string }>("/api/cline/ingest", { sample_id: "pmkisan_tenant_amendment" });
    const t = await waitTask<{ draft_id: string; status: string; attempts: { failed: number }[]; diff: { path: string }[]; tests: unknown[] }>(body.task_id);
    expect(t.status).toBe("done");
    created.push(t.result.draft_id);
    expect(t.result.tests.length).toBe(5);
    expect(t.result.diff.some((d: { path: string }) => d.path.startsWith("eligibility.all"))).toBe(true);
    expect(t.result.attempts[0].failed).toBeGreaterThan(0);
    expect(t.result.attempts.at(-1)!.failed).toBe(0);
    expect(t.result.status).toBe("tests_passing");
    expect(t.progress.some((p) => /repairing/.test(p.msg))).toBe(true);
    const ap = await post<{ status: string }>(`/api/cline/ingest/${t.result.draft_id}/approve`, { reviewer: "M2" });
    expect(ap.body.status).toBe("approved");
    expect(JSON.parse(readFileSync(pmkisanPath, "utf8")).review_status).toBe("approved_by:M2");
  });

  it("Workflow A: unknown text in fixture mode fails honestly (no invented extraction)", async () => {
    const { body } = await post<{ task_id: string }>("/api/cline/ingest", { text: "some circular" });
    const t = await waitTask(body.task_id);
    expect(t.status).toBe("failed");
  });

  it("Workflow B: fill task returns validated FormFillResult", async () => {
    const { body } = await post<{ task_id: string }>("/api/cline/fill", { profile: personas().ramesh.profile, form_id: "kcc_application" });
    const t = await waitTask<{ form_values: Record<string, unknown>; provenance: string }>(body.task_id);
    expect(t.result.form_values.district).toBe("Lucknow");
    expect(t.result.provenance).toBe("fixture");
  });

  it("Workflow C: orchestration returns a valid plan including livestock for Kamal", async () => {
    const k = personas().kamal;
    const { body } = await post<{ task_id: string }>("/api/cline/plan", { profile: k.profile, utterance: k.utterance.text });
    const t = await waitTask<ActionPlan>(body.task_id);
    expect(ActionPlanZ.safeParse(t.result).success).toBe(true);
    expect(t.result.results.map((r) => r.module)).toContain("livestock");
  });
});
