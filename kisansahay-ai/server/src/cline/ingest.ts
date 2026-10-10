/**
 * Workflow A: rule ingestion with generated tests.
 * source text -> Cline task (draft rule citing source_page/source_quote + tests from the circular's own examples,
 * with a run_rule_tests tool) -> we re-run tests with OUR evaluator -> repair loop (max 3) ->
 * draft + diff in data/schemes/_drafts. The engine ignores drafts until a human approves.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { nowIso } from "../lib/clock";
import { runRuleTests } from "../rules/evaluate";
import { loadScheme } from "../rules/load";
import { RuleTestZ, SchemeRuleZ } from "../rules/schema";
import { jsonDiff } from "./diff";
import { extractSource, saveDraft, type DraftRecord, type IngestRequest } from "./drafts";
import { clineTimeout, getCline } from "./index";
import { sampleDraft, unknownDraft } from "./ingest_fixture";

export { approveDraft, listDrafts, type DraftRecord, type IngestRequest } from "./drafts";

export const MAX_REPAIR_LOOPS = 3;

const DraftOutZ = z.object({ rule: SchemeRuleZ, tests: z.array(RuleTestZ) });
type DraftOut = z.infer<typeof DraftOutZ>;

const INSTRUCTIONS = `Extract ONE government scheme eligibility rule from the circular into our JSON rule schema.
- Every eligibility condition must cite source_page and a verbatim source_quote from the circular.
- Allowed ops: eq, ne, gt, gte, lt, lte, in, not_in, intersects, exists, not_exists. Profile fields: land_ownership(owner|tenant|sharecropper), land_hectares, is_income_tax_payer, category(general|obc|sc|st), state, crops, has_bank_account, in_cluster_group, cultivates, has_livestock.
- Use "soft": true for conditions that, when unknown, should still allow a "likely" verdict.
- Write test cases from the circular's OWN examples (profile + expected verdict: eligible|likely|needs_info|not_eligible).
- Call the run_rule_tests tool with your draft and tests, read failures, and repair the draft until all tests pass.
- Keep review_status "draft_from_circular" and verified_on "TODO_VERIFY". Never invent amounts or dates not in the text.`;

const runRuleTestsTool = {
  name: "run_rule_tests",
  description: "Run test cases against a draft rule with the production evaluator. Returns pass/fail per test.",
  inputSchema: { type: "object", properties: { rule: { type: "object" }, tests: { type: "array", items: { type: "object" } } }, required: ["rule", "tests"] },
  execute: async (input: Record<string, unknown>) => {
    const r = SchemeRuleZ.safeParse(input.rule);
    if (!r.success) return { error: `rule schema invalid: ${r.error.message.slice(0, 400)}` };
    const tests = z.array(RuleTestZ).safeParse(input.tests);
    if (!tests.success) return { error: "tests invalid" };
    return runRuleTests(r.data, tests.data);
  },
};

export async function runIngest(req: IngestRequest, progress: (m: string) => void): Promise<{ result: DraftRecord; provenance: "cline-sdk" | "fixture" }> {
  const src = await extractSource(req);
  progress(`extracted ${src.text.length} chars from ${src.label}`);
  const targetId = req.target_rule_id ?? src.sampleTarget ?? "";
  const base = targetId ? loadScheme(targetId) : undefined;
  const attempts: DraftRecord["attempts"] = [];
  let feedback = "";
  let last: DraftOut | undefined;
  let prov: "cline-sdk" | "fixture" = "fixture";
  let results: ReturnType<typeof runRuleTests> = { passed: 0, failed: 0, results: [] };

  for (let attempt = 1; attempt <= MAX_REPAIR_LOOPS; attempt++) {
    progress(`attempt ${attempt}: drafting rule + generating tests from the circular's examples`);
    const { output, provenance } = await getCline().runTask<DraftOut>({
      kind: "ingest_rule",
      instructions: INSTRUCTIONS,
      inputs: { circular_text: src.text, current_rule: base ?? null, previous_draft: last ?? null, test_failures: feedback || null },
      tools: [runRuleTestsTool],
      outputSchema: DraftOutZ,
      outputHint: '{"rule": <SchemeRule JSON>, "tests": [{"name": "...", "profile": {...}, "expect": "eligible|likely|needs_info|not_eligible", "source_quote": "..."}]}',
      timeoutMs: Math.max(clineTimeout(), 60000),
      onProgress: progress,
      fixture: () => (src.kind === "sample" ? sampleDraft(attempt, base, src.label) : unknownDraft(base, targetId, src.label)),
    });
    last = output;
    prov = provenance;
    results = runRuleTests(output.rule, output.tests); // our evaluator is the judge, not the agent
    const failures = results.results.filter((r) => !r.pass).map((r) => `${r.name}: expected ${r.expect}, got ${r.got}`);
    attempts.push({ attempt, passed: results.passed, failed: results.failed, failures });
    progress(`attempt ${attempt}: ${results.passed}/${results.results.length} generated tests pass`);
    if (!results.failed) break;
    feedback = failures.join("\n");
    if (attempt < MAX_REPAIR_LOOPS) progress(`repairing draft (${results.failed} failing): ${failures[0]}`);
  }

  const draft: DraftRecord = {
    draft_id: randomUUID().slice(0, 8),
    status: results.failed === 0 && last!.tests.length > 0 ? "tests_passing" : "tests_failing",
    rule: last!.rule,
    tests: last!.tests,
    test_results: results,
    attempts,
    diff: jsonDiff(base ?? {}, last!.rule),
    source: { kind: src.kind, label: src.label },
    provenance: prov,
    created_at: nowIso(),
  };
  saveDraft(draft);
  progress(`draft ${draft.draft_id} saved for human review (${draft.diff.length} change(s), status ${draft.status})`);
  return { result: draft, provenance: prov };
}
