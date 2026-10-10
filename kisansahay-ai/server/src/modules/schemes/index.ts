/**
 * Scheme Finder (Deep) module runner.
 */
import type { ActionItem, FarmerProfile, I18n, ModuleResult, SchemesBody } from "@kisansahay/contracts";
import { envelope } from "../../lib/envelope";
import { t } from "../../lib/i18n";
import { loadSchemes } from "../../rules/load";
import { evaluateSchemes } from "./evaluate";

export { evaluateSchemes, documentsFor } from "./evaluate";

const short = (s: string) => s.split(" (")[0];

/** Human labels for profile fields asked about in "needs info" actions. */
const FIELD_LABEL: Record<string, I18n> = {
  land_ownership: t("whether the land is in your name", "ज़मीन आपके नाम पर है या नहीं", "মাটি আপোনাৰ নামত নে নহয়"),
  land_hectares: t("how much land you farm", "कितनी ज़मीन पर खेती", "কিমান মাটিত খেতি"),
  is_income_tax_payer: t("whether anyone in the family pays income tax", "क्या परिवार में कोई आयकर देता है", "পৰিয়ালৰ কোনোবাই আয়কৰ দিয়ে নে"),
  in_cluster_group: t("whether you are in a farmer group", "क्या आप किसान समूह में हैं", "আপুনি কৃষক গোটত আছে নে"),
  has_cattle: t("whether you keep cows or buffaloes", "क्या आप गाय/भैंस पालते हैं", "আপুনি গৰু/ম'হ পোহে নে"),
  has_livestock: t("whether you keep animals", "क्या आप पशु पालते हैं", "আপুনি পশু পোহে নে"),
  has_bank_account: t("whether you have a bank account", "क्या आपका बैंक खाता है", "আপোনাৰ বেংক একাউণ্ট আছে নে"),
  cultivates: t("which crop you grow", "आप कौन सी फसल उगाते हैं", "আপুনি কি শস্য খেতি কৰে"),
  state: t("your state", "आपका राज्य", "আপোনাৰ ৰাজ্য"),
};
const fieldText = (fields: string[], lang: keyof I18n) =>
  fields.map((f) => FIELD_LABEL[f]?.[lang] ?? f).join(", ");

export async function runSchemes(profile: FarmerProfile): Promise<ModuleResult<SchemesBody>> {
  const rules = loadSchemes();
  const body = evaluateSchemes(profile, rules);
  const active = body.results.filter((r) => r.verdict === "eligible" || r.verdict === "likely");
  const needs = body.results.filter((r) => r.verdict === "needs_info");
  const actions: ActionItem[] = [];

  if (body.stuck_payment) {
    for (const c of body.stuck_payment.checks.filter((c) => c.status !== "ok")) {
      actions.push({ id: `pmkisan-fix-${c.id}`, label: c.fix, kind: "visit", priority: c.status === "problem" ? 1 : 2 });
    }
  }
  for (const r of active) {
    const rule = rules.find((x) => x.id === r.scheme_id)!;
    const a: ActionItem = { id: `scheme-${r.scheme_id}`, label: rule.action.label, kind: rule.action.kind, priority: 2 };
    if (rule.action.link) a.link = rule.action.link;
    if (r.deadline) a.due_at = r.deadline.due_at;
    actions.push(a);
  }
  for (const r of needs.slice(0, 2)) {
    const f = r.missing_fields;
    actions.push({
      id: `scheme-info-${r.scheme_id}`,
      label: t(`Check eligibility for ${short(r.scheme_name.en)}: tell us ${fieldText(f, "en")}`,
        `${short(r.scheme_name.hi)} की पात्रता जाँचें: बताएं ${fieldText(f, "hi")}`,
        `${short(r.scheme_name.as)} ৰ যোগ্যতা চাওক: কওক ${fieldText(f, "as")}`),
      kind: "info", priority: 3,
    });
  }
  const docIds = new Set<string>();
  for (const r of active) for (const d of r.documents) {
    if (docIds.has(d.id)) continue;
    docIds.add(d.id);
    actions.push({ id: `doc-${d.id}`, label: d.name, kind: "collect_doc", priority: 3 });
  }

  const names = active.slice(0, 3).map((r) => r.scheme_name);
  const headline = active.length
    ? t(`You may qualify for ${active.length} scheme(s): ${names.map((n) => short(n.en)).join(", ")}`,
        `आप ${active.length} योजना(ओं) के पात्र हो सकते हैं: ${names.map((n) => short(n.hi)).join(", ")}`,
        `আপুনি ${active.length} টা আঁচনিৰ যোগ্য হ'ব পাৰে: ${names.map((n) => short(n.as)).join(", ")}`)
    : t("We need a few more details to match schemes", "योजनाएँ मिलाने के लिए कुछ और जानकारी चाहिए", "আঁচনি মিলাবলৈ আৰু কিছু তথ্য লাগে");

  return envelope({
    module: "schemes",
    status: active.length ? "ok" : "needs_info",
    headline,
    body,
    actions,
    sources: rules.map((r) => ({ label: short(r.name.en), url: r.source.url, as_of: r.source.verified_on })),
    confidence: active.length ? Math.max(...active.map((r) => r.confidence)) : 0.4,
    provenance: "live",
    disclaimer: "financial",
    missing_fields: [...new Set(needs.flatMap((r) => r.missing_fields))],
  });
}
