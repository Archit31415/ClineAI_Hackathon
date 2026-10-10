/**
 * Livestock Triage (Prototype): red flags first (any match -> vet_now), then catalog scoring.
 * Triage level only. No drug doses, ever. Notifiable-disease prompt.
 */
import type { ActionItem, FarmerProfile, I18n, LivestockBody, LivestockInput, ModuleResult } from "@kisansahay/contracts";
import { envelope } from "../../lib/envelope";
import { t } from "../../lib/i18n";
import { readJson } from "../../lib/paths";
import { matchRedFlags, scoreCandidates, type Catalog } from "../../triage/engine";
import { aiFeatures, keywordFeatures } from "../../triage/vision";

type LivestockCatalog = Catalog & {
  advice: { do_now_base: I18n[]; do_now_isolate: I18n[]; do_now_notifiable: I18n[]; do_now_vet: I18n[]; do_not: I18n[] };
};

export async function runLivestock(profile: FarmerProfile, input: Partial<LivestockInput> = {}): Promise<ModuleResult<LivestockBody>> {
  const catalog = readJson<LivestockCatalog>("triage", "livestock.json");
  const species = (input.species ?? profile.livestock?.[0]?.species ?? "cattle").toLowerCase();
  const vocab = Object.keys(catalog.feature_vocab);
  let features = (input.features ?? []).filter((f) => vocab.includes(f));
  const provenance: ModuleResult["provenance"] = "live";
  let photo: ModuleResult["photo"];

  if (input.image_data_url || (input.symptoms_text && !features.length)) {
    const v = await aiFeatures(catalog.feature_vocab, `${species} (animal)`, input.symptoms_text, input.image_data_url);
    if (v) { features.push(...v.features); photo = v.photo; }
  }
  features.push(...keywordFeatures("livestock", input.symptoms_text));
  features = [...new Set(features)];

  if (!features.length) {
    return envelope({
      module: "livestock", status: "needs_info", disclaimer: "veterinary", provenance, photo,
      headline: t("Tell us the animal's symptoms (or tap them)", "पशु के लक्षण बताइए (या चुनिए)", "পশুটোৰ লক্ষণ কওক (বা বাছক)"),
      body: { triage: "monitor", red_flags: [], possible_conditions: [], isolate: false, notifiable_suspect: false, do_now: catalog.advice.do_now_base, do_not: catalog.advice.do_not, features_detected: [] },
      missing_fields: ["symptoms"],
    });
  }

  const flags = matchRedFlags(catalog, features);
  const scored = scoreCandidates(catalog, features, (e) => !e.species || e.species.includes(species)).slice(0, 3);
  const notifiable = flags.some((f) => f.notifiable);
  const isolate = flags.some((f) => f.isolate) || notifiable;

  let triage: LivestockBody["triage"];
  if (flags.length) triage = "vet_now";
  else if (features.includes("fever") || features.includes("not_eating") || (scored[0]?.confidence ?? 0) >= 0.5) triage = "vet_within_24h";
  else triage = "monitor";

  const do_now = [...catalog.advice.do_now_base];
  if (isolate) do_now.unshift(...catalog.advice.do_now_isolate);
  if (notifiable) do_now.unshift(...catalog.advice.do_now_notifiable);
  if (triage !== "monitor") do_now.unshift(...catalog.advice.do_now_vet);

  const body: LivestockBody = {
    triage,
    red_flags: flags.map((f) => f.text),
    possible_conditions: scored.map((s) => ({ id: s.entry.id, name: s.entry.name, confidence: s.confidence })),
    isolate,
    notifiable_suspect: notifiable,
    do_now,
    do_not: catalog.advice.do_not,
    features_detected: features,
  };

  const actions: ActionItem[] = [];
  if (triage === "vet_now") actions.push({ id: "vet-now", label: t("Call a veterinarian today", "आज ही पशु चिकित्सक को बुलाएँ", "আজিয়েই পশু চিকিৎসকক মাতক"), kind: "call", priority: 1 });
  if (triage === "vet_within_24h") actions.push({ id: "vet-24h", label: t("Get the animal seen by a vet within 24 hours", "24 घंटे में पशु चिकित्सक को दिखाएँ", "২৪ ঘণ্টাৰ ভিতৰত পশু চিকিৎসকক দেখুৱাওক"), kind: "visit", priority: 2 });
  if (isolate) actions.push({ id: "vet-isolate", label: catalog.advice.do_now_isolate[0], kind: "do_now", priority: 1 });
  if (notifiable) actions.push({ id: "vet-notify", label: catalog.advice.do_now_notifiable[0], kind: "call", priority: 1 });
  if (triage === "monitor") actions.push({ id: "vet-monitor", label: t("Watch the animal for 24 hours; call a vet if it gets worse", "24 घंटे पशु पर नज़र रखें; हालत बिगड़े तो पशु चिकित्सक को बुलाएँ", "২৪ ঘণ্টা পশুটোলৈ লক্ষ্য ৰাখক; বেয়া হ'লে চিকিৎসকক মাতক"), kind: "wait", priority: 3 });

  const headline =
    triage === "vet_now"
      ? isolate
        ? t("Call a vet today and keep this animal apart", "आज ही पशु चिकित्सक बुलाएँ और इस पशु को अलग रखें", "আজিয়েই পশু চিকিৎসক মাতক আৰু এই পশুটো আঁতৰাই ৰাখক")
        : t("Call a vet today", "आज ही पशु चिकित्सक बुलाएँ", "আজিয়েই পশু চিকিৎসক মাতক")
      : triage === "vet_within_24h"
        ? t("Get a vet to check the animal within 24 hours", "24 घंटे में पशु चिकित्सक से जाँच करवाएँ", "২৪ ঘণ্টাৰ ভিতৰত পশু চিকিৎসকৰ পৰা পৰীক্ষা কৰাওক")
        : t("Keep watching the animal", "पशु पर नज़र रखें", "পশুটোলৈ লক্ষ্য ৰাখক");

  return envelope({
    module: "livestock", status: "ok", headline, body, actions,
    sources: scored.flatMap((s) => (s.entry.advisory_source ? [{ label: s.entry.advisory_source.label, url: s.entry.advisory_source.url, as_of: "TODO_VERIFY" }] : [])),
    confidence: scored[0]?.confidence ?? 0.3,
    provenance, disclaimer: "veterinary", photo,
  });
}
