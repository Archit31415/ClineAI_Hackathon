/**
 * Scheme Finder core: rules engine + stacking + deadlines + stuck-payment diagnosis + RAG explanation.
 */
import type {
  DocumentItem, EligibilityResult, FarmerProfile, I18n, SchemesBody, StuckPaymentDiagnosis,
} from "@kisansahay/contracts";
import { readJson } from "../../lib/paths";
import { resolveDeadlines } from "../../rules/deadlines";
import { deriveFacts, evaluateRule, getPath, reasonsFor } from "../../rules/evaluate";
import { loadSchemes } from "../../rules/load";
import { explainMissing } from "../../rules/rag";
import type { SchemeRule } from "../../rules/schema";
import { applyStacking } from "../../rules/stack";

type DocCatalog = Record<string, { name: I18n; where_to_get: I18n }>;

export function documentsFor(ids: string[], profile?: FarmerProfile): DocumentItem[] {
  const cat = readJson<DocCatalog>("schemes", "_documents.json");
  return ids
    .filter((id) => {
      if (id === "tenancy_agreement") return profile?.land_ownership !== "owner";
      if (id === "caste_certificate") return profile?.category !== undefined && profile.category !== "general";
      if (id === "loss_photos") return !!profile?.loss_event;
      return true;
    })
    .filter((id) => cat[id])
    .map((id) => ({ id, name: cat[id].name, where_to_get: cat[id].where_to_get }));
}

const VERDICT_RANK = { eligible: 0, likely: 1, needs_info: 2, not_eligible: 3 } as const;

export function stuckPayment(rule: SchemeRule, profile: FarmerProfile): StuckPaymentDiagnosis | undefined {
  if (!rule.stuck_payment_checks) return undefined;
  const facts = deriveFacts(profile as FarmerProfile & Record<string, unknown>);
  return {
    scheme_id: rule.id,
    checks: rule.stuck_payment_checks.map((c) => {
      const v = getPath(facts, c.field);
      const status = v === undefined ? "unknown" : v === c.expect ? "ok" : "problem";
      return { id: c.id, label: c.label, status, fix: c.fix };
    }),
  };
}

export function evaluateSchemes(profile: FarmerProfile, rules: SchemeRule[] = loadSchemes()): SchemesBody {
  const results: EligibilityResult[] = rules.map((rule) => {
    const d = evaluateRule(rule, profile as FarmerProfile & Record<string, unknown>);
    const missing = [...d.unknown_hard, ...d.unknown_soft].map((c) => c.field);
    const deadlines = resolveDeadlines(rule.deadline_rules, profile).filter((x) => !x.expired);
    const r: EligibilityResult = {
      scheme_id: rule.id,
      scheme_name: rule.name,
      verdict: d.verdict,
      confidence: d.confidence,
      reasons: reasonsFor(d),
      missing_fields: missing,
      benefit_summary: rule.benefit_summary,
      documents: documentsFor(rule.documents, profile),
      stack_notes: [],
      source: rule.source,
    };
    if (deadlines.length && d.verdict !== "not_eligible") {
      const soonest = deadlines.sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
      r.deadline = { label: soonest.label, due_at: soonest.due_at };
    }
    if (d.verdict === "needs_info") {
      const ex = explainMissing(rule.id, missing);
      if (ex) r.explanation = ex;
    }
    return r;
  });
  const conflicts = applyStacking(results, rules);
  const pain = profile.pain_point;
  const rel = (id: string) => (pain && rules.find((r) => r.id === id)?.relevant_pain_points.includes(pain) ? 0 : 1);
  results.sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || rel(a.scheme_id) - rel(b.scheme_id));

  const body: SchemesBody = { results, conflicts };
  const pmkisan = rules.find((r) => r.id === "pmkisan");
  if (pmkisan && (pain === "stuck_payment" || profile.existing_benefits?.includes("pmkisan"))) {
    body.stuck_payment = stuckPayment(pmkisan, profile);
  }
  return body;
}
