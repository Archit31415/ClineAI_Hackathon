/**
 * Deterministic Action Plan builder (no network). Baseline for Workflow C.
 * Dedupe actions/documents, sort by priority then due_at, generate cross-module notes.
 */
import type { ActionPlan, FarmerProfile, I18n, ModuleId, ModuleResult, SchemesBody } from "@kisansahay/contracts";
import { nowIso } from "../lib/clock";
import { t } from "../lib/i18n";

const MODULE_ORDER: ModuleId[] = ["claim", "livestock", "crop_doctor", "advisory", "schemes", "soil_card", "mandi"];

function activeSchemes(results: ModuleResult[]): Set<string> {
  const s = results.find((r) => r.module === "schemes")?.body as SchemesBody | undefined;
  return new Set((s?.results ?? []).filter((r) => r.verdict === "eligible" || r.verdict === "likely").map((r) => r.scheme_id));
}

export function crossNotes(profile: FarmerProfile, results: ModuleResult[]): I18n[] {
  const mods = new Set(results.map((r) => r.module));
  const schemes = activeSchemes(results);
  const notes: I18n[] = [];
  if (mods.has("claim")) {
    notes.push(t("Claim first: the insurance reporting window is running.", "पहले दावा: बीमा सूचना की समय-सीमा चल रही है।", "প্ৰথমে দাবী: বীমা জনোৱাৰ সময়সীমা চলি আছে।"));
    if (schemes.has("kcc")) notes.push(t("KCC stacks with PMFBY: a KCC loan does not block your claim, and insured loans are protected.", "KCC और PMFBY साथ चलते हैं: KCC ऋण दावे को नहीं रोकता, बीमित ऋण सुरक्षित रहता है।", "KCC আৰু PMFBY একেলগে চলে: KCC ঋণে দাবী বন্ধ নকৰে, বীমাকৃত ঋণ সুৰক্ষিত।"));
  }
  if (mods.has("advisory") && mods.has("claim")) {
    const adv = results.find((r) => r.module === "advisory");
    const rainy = (adv?.body as { nudges?: { rule_id: string }[] })?.nudges?.some((n) => n.rule_id.includes("rain"));
    if (rainy) notes.push(t("Rain is forecast: take claim evidence photos before it rains.", "बारिश का पूर्वानुमान: बारिश से पहले दावे की फ़ोटो लें।", "বৰষুণৰ পূৰ্বানুমান: বৰষুণৰ আগতে দাবীৰ ফটো লওক।"));
  }
  if (mods.has("soil_card") && mods.has("crop_doctor")) notes.push(t("Some leaf problems are linked to soil nutrition — check the soil card ratings.", "पत्ती की कुछ समस्याएँ मिट्टी के पोषण से जुड़ी हैं — मृदा कार्ड रेटिंग देखें।", "পাতৰ কিছুমান সমস্যা মাটিৰ পুষ্টিৰ সৈতে জড়িত — মাটি কাৰ্ডৰ ৰেটিং চাওক।"));
  if (mods.has("livestock") && schemes.has("kcc")) notes.push(t("KCC can also cover animal husbandry costs.", "KCC पशुपालन खर्च भी कवर कर सकता है।", "KCC এ পশুপালনৰ খৰচো বহন কৰিব পাৰে।"));
  if (mods.has("mandi") && schemes.has("pmkisan")) notes.push(t("Selling now? Keep the receipt — it helps with KCC and land-record checks.", "अभी बेच रहे हैं? रसीद रखें — KCC और भूमि अभिलेख जाँच में मदद करती है।", "এতিয়া বিক্ৰী কৰিছে? ৰচিদ ৰাখক — KCC আৰু মাটিৰ নথিৰ পৰীক্ষাত সহায় কৰে।"));
  if (profile.land_ownership && profile.land_ownership !== "owner" && schemes.has("pmfby")) notes.push(t("Tenants and sharecroppers can still get crop insurance — carry your tenancy proof.", "किरायेदार/बटाईदार भी फसल बीमा ले सकते हैं — किरायेदारी प्रमाण साथ रखें।", "ভাড়াতীয়া/আধিয়াৰেও শস্য বীমা পাব পাৰে — ভাড়াৰ প্ৰমাণ লগত ৰাখক।"));
  return notes;
}

export function buildPlan(profile: FarmerProfile, results: ModuleResult[]): ActionPlan {
  const seen = new Set<string>();
  const ordered: ActionPlan["ordered_actions"] = [];
  const docs = new Map<string, { id: string; name: I18n; from: ModuleId[] }>();

  const sortedResults = [...results].sort((a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module));
  for (const r of sortedResults) {
    for (const a of r.actions) {
      if (a.kind === "collect_doc" && a.id.startsWith("doc-")) {
        const key = a.id.replace(/^doc-/, "");
        const d = docs.get(key);
        if (d) { if (!d.from.includes(r.module)) d.from.push(r.module); continue; }
        docs.set(key, { id: key, name: a.label, from: [r.module] });
      }
      const key = a.id;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push({ ...a, from: r.module });
    }
  }
  ordered.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return MODULE_ORDER.indexOf(a.from) - MODULE_ORDER.indexOf(b.from);
  });

  return {
    generated_at: nowIso(),
    lang: profile.lang,
    results: sortedResults,
    ordered_actions: ordered,
    cross_notes: crossNotes(profile, results),
    provenance: "deterministic",
    documents: [...docs.values()],
  };
}
