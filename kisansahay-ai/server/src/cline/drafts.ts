/**
 * Workflow A support: source text extraction + draft store + human approval.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { nowIso } from "../lib/clock";
import { dataPath, readJson } from "../lib/paths";
import { runRuleTests } from "../rules/evaluate";
import { SchemeRuleZ, type RuleTest, type SchemeRule } from "../rules/schema";
import type { DiffEntry } from "./diff";

export interface DraftRecord {
  draft_id: string;
  status: "tests_passing" | "tests_failing" | "approved";
  rule: SchemeRule;
  tests: RuleTest[];
  test_results: ReturnType<typeof runRuleTests>;
  attempts: { attempt: number; passed: number; failed: number; failures: string[] }[];
  diff: DiffEntry[];
  source: { kind: "sample" | "text" | "url" | "pdf"; label: string };
  provenance: "cline-sdk" | "fixture";
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export interface IngestRequest { sample_id?: string; text?: string; url?: string; pdf_base64?: string; target_rule_id?: string }

export async function extractSource(req: IngestRequest): Promise<{ text: string; kind: DraftRecord["source"]["kind"]; label: string; sampleTarget?: string }> {
  if (req.sample_id) {
    const idx = readJson<{ id: string; file: string; target_rule_id: string }[]>("samples", "circulars", "index.json");
    const s = idx.find((x) => x.id === req.sample_id);
    if (!s) throw new Error(`unknown sample ${req.sample_id}`);
    return { text: readFileSync(dataPath("samples", "circulars", s.file), "utf8"), kind: "sample", label: `sample:${s.id}`, sampleTarget: s.target_rule_id };
  }
  if (req.text) return { text: req.text.slice(0, 60000), kind: "text", label: "pasted text" };
  if (req.url) {
    const res = await fetch(req.url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`fetch ${req.url} -> ${res.status}`);
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    return { text: text.slice(0, 60000), kind: "url", label: req.url };
  }
  throw new Error("provide sample_id, text or url");
}

export function saveDraft(d: DraftRecord): void {
  writeFileSync(dataPath("schemes", "_drafts", `${d.draft_id}.json`), JSON.stringify(d, null, 2));
}

export function listDrafts(): DraftRecord[] {
  const dir = dataPath("schemes", "_drafts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.includes(".previous"))
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as DraftRecord)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Human approval: re-validate, re-run tests, back up the current rule, publish. */
export function approveDraft(draftId: string, reviewer: string): DraftRecord {
  if (!/^[a-z0-9-]+$/i.test(draftId)) throw new Error("bad draft id");
  const file = dataPath("schemes", "_drafts", `${draftId}.json`);
  if (!existsSync(file)) throw new Error(`draft ${draftId} not found`);
  const draft = JSON.parse(readFileSync(file, "utf8")) as DraftRecord;
  if (draft.status === "approved") return draft;
  const rule = SchemeRuleZ.parse(draft.rule);
  const check = runRuleTests(rule, draft.tests);
  if (check.failed > 0 || draft.tests.length === 0) throw new Error("cannot approve: generated tests are not all passing");
  const target = dataPath("schemes", `${rule.id}.json`);
  if (existsSync(target)) writeFileSync(dataPath("schemes", "_drafts", `${draftId}.previous.json`), readFileSync(target, "utf8"));
  writeFileSync(target, JSON.stringify({ ...rule, review_status: `approved_by:${reviewer}` }, null, 2) + "\n");
  draft.status = "approved";
  draft.approved_by = reviewer;
  draft.approved_at = nowIso();
  writeFileSync(file, JSON.stringify(draft, null, 2));
  return draft;
}
