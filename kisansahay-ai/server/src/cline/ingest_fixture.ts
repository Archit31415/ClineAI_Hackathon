/**
 * Deterministic replay for Workflow A on the bundled sample circular.
 * Attempt 1 intentionally reproduces a typical first-draft mistake (income-tax condition treated as
 * a hard requirement), so the generated test from Example 4 fails and the repair loop is exercised
 * against the REAL evaluator. Attempt 2 is the repaired draft.
 */
import type { RuleTest, SchemeRule } from "../rules/schema";

export function sampleDraft(attempt: number, base: SchemeRule | undefined, sourceLabel: string): { rule: SchemeRule; tests: RuleTest[] } {
  const rule: SchemeRule = {
    ...(base ?? ({} as SchemeRule)),
    id: "pmkisan",
    name: base?.name ?? { en: "PM-KISAN (income support)", hi: "पीएम-किसान (आय सहायता)", as: "পিএম-কিষাণ (আয় সাহায্য)" },
    benefit_summary: base?.benefit_summary ?? { en: "Income support (see circular)", hi: "आय सहायता", as: "আয় সাহায্য" },
    source: { url: sourceLabel, verified_on: "TODO_VERIFY" },
    review_status: "draft_from_circular",
    relevant_pain_points: base?.relevant_pain_points ?? ["stuck_payment"],
    eligibility: {
      all: [
        { field: "land_ownership", op: "eq", value: "owner", source_page: 1, source_quote: "the family holds cultivable land recorded in the name of a family member",
          label: { en: "Cultivable land is in your family's name", hi: "खेती की ज़मीन परिवार के नाम पर है", as: "খেতিৰ মাটি পৰিয়ালৰ নামত" } },
        { field: "land_hectares", op: "gt", value: 0, source_page: 1, source_quote: "the landholding is greater than zero hectares",
          label: { en: "You hold some cultivable land", hi: "आपके पास खेती योग्य भूमि है", as: "আপোনাৰ খেতিৰ মাটি আছে" } },
        { field: "is_income_tax_payer", op: "eq", value: false, ...(attempt >= 2 ? { soft: true } : {}), source_page: 1,
          source_quote: "no member of the family paid income tax in the last assessment year",
          label: { en: "No family member paid income tax last year", hi: "पिछले साल परिवार में किसी ने आयकर नहीं भरा", as: "যোৱা বছৰ পৰিয়ালৰ কোনেও আয়কৰ দিয়া নাই" } },
        { field: "has_bank_account", op: "eq", value: true, source_page: 1, source_quote: "the family has an active bank account",
          label: { en: "Family has an active bank account", hi: "परिवार का सक्रिय बैंक खाता है", as: "পৰিয়ালৰ সক্ৰিয় বেংক একাউণ্ট আছে" } },
      ],
    },
    documents: ["aadhaar", "land_record", "bank_passbook"],
    stacks_with: base?.stacks_with ?? [],
    conflicts_with: base?.conflicts_with ?? [],
    requires: base?.requires ?? [],
    deadline_rules: base?.deadline_rules ?? [],
    action: base?.action ?? { label: { en: "Register at CSC", hi: "CSC पर पंजीकरण", as: "CSC ত পঞ্জীয়ন" }, kind: "visit" },
  };
  if (base?.stuck_payment_checks) rule.stuck_payment_checks = base.stuck_payment_checks;
  const tests: RuleTest[] = [
    { name: "Example 1: Ramesh, owner 1.2 ha, no income tax", profile: { land_ownership: "owner", land_hectares: 1.2, is_income_tax_payer: false, has_bank_account: true }, expect: "eligible", source_quote: "He is eligible." },
    { name: "Example 2: Sita, tenant 0.8 ha", profile: { land_ownership: "tenant", land_hectares: 0.8, is_income_tax_payer: false }, expect: "not_eligible", source_quote: "She is not eligible." },
    { name: "Example 3: Mohan, owner 2 ha, son paid income tax", profile: { land_ownership: "owner", land_hectares: 2, is_income_tax_payer: true, has_bank_account: true }, expect: "not_eligible", source_quote: "He is not eligible." },
    { name: "Example 4: Lata, owner 0.5 ha, income tax unknown", profile: { land_ownership: "owner", land_hectares: 0.5, has_bank_account: true }, expect: "likely", source_quote: "She is likely eligible pending that check." },
    { name: "Example 5: Arjun, owner 1 ha, no bank account", profile: { land_ownership: "owner", land_hectares: 1, is_income_tax_payer: false, has_bank_account: false }, expect: "not_eligible", source_quote: "He is not eligible." },
  ];
  return { rule, tests };
}

/** Generic fallback for unknown circulars in fixture mode: no extraction is invented. */
export function unknownDraft(base: SchemeRule | undefined, targetId: string, sourceLabel: string): { rule: SchemeRule; tests: RuleTest[] } {
  if (!base) throw new Error(`Fixture mode can only ingest the bundled sample or an existing rule id (got ${targetId}). Set CLINE_MODE=sdk for live extraction.`);
  return { rule: { ...base, source: { url: sourceLabel, verified_on: "TODO_VERIFY" }, review_status: "draft_needs_human_authoring" }, tests: [] };
}
