/**
 * Soil Card Interpreter (Working): OCR (LLM vision) or typed values -> confirm -> bands -> plan.
 */
import type { ActionItem, FarmerProfile, ModuleResult, SoilBody, SoilInput } from "@kisansahay/contracts";
import { envelope } from "../../lib/envelope";
import { t } from "../../lib/i18n";
import { visionStatus } from "../../lib/vision";
import { buildPlan, canonicalParam, loadBands, ocrCard, rateParam } from "./bands";

export { rateParam, canonicalParam } from "./bands";

const SOIL_NOT_SETUP = t(
  "Card photo reading is not set up on this server. Please type the values from your card.",
  "इस सर्वर पर कार्ड की फ़ोटो पढ़ना चालू नहीं है। कृपया कार्ड के मान टाइप करें।",
  "এই ছাৰ্ভাৰত কাৰ্ডৰ ফটো পঢ়া ব্যৱস্থা নাই। অনুগ্ৰহ কৰি কাৰ্ডৰ মান টাইপ কৰক।",
);

const SOIL_READ_FAILED = t(
  "Could not read the card photo right now (network or service problem). Please type the values or try again.",
  "कार्ड की फ़ोटो अभी नहीं पढ़ी जा सकी (नेटवर्क या सेवा की समस्या)। कृपया मान टाइप करें या फिर कोशिश करें।",
  "কাৰ্ডৰ ফটো এতিয়া পঢ়িব পৰা নগ'ল (নেটৱৰ্ক বা ছেৱাৰ সমস্যা)। অনুগ্ৰহ কৰি মান টাইপ কৰক বা আকৌ চেষ্টা কৰক।",
);
const SOIL_READ_OK = t(
  "Values were read from your card photo by AI. Please check them against the card before using the plan.",
  "आपके कार्ड की फ़ोटो से मान AI ने पढ़े हैं। योजना अपनाने से पहले कार्ड से मिलाएँ।",
  "আপোনাৰ কাৰ্ডৰ ফটোৰ পৰা AI এ মানবোৰ পঢ়িছে। পৰিকল্পনা মানি চলাৰ আগতে কাৰ্ডৰ সৈতে মিলাই চাওক।",
);

const PROBLEM_BANDS = new Set(["low", "deficient", "acidic", "alkaline"]);

export async function runSoil(profile: FarmerProfile, input: SoilInput = {}): Promise<ModuleResult<SoilBody>> {
  const bandsFile = loadBands();
  const sources = [{ label: bandsFile._source.label, url: bandsFile._source.url, as_of: bandsFile._source.verified_on }];
  let parsed: SoilBody["parsed"] = [];
  let printed = input.printed_recommendation ?? [];
  let confirmed = false;
  const provenance: ModuleResult["provenance"] = "live";
  let photo: ModuleResult["photo"];

  if (input.values && Object.keys(input.values).length) {
    for (const [k, v] of Object.entries(input.values)) {
      const p = canonicalParam(k);
      if (p && Number.isFinite(v)) parsed.push({ param: p, value: v, unit: bandsFile.params[p].unit, ocr_confidence: 1 });
    }
    confirmed = true; // typed or confirmed-by-farmer values
  } else if (input.image_data_url) {
    const vs = visionStatus();
    const tag = { provider: vs.provider, ...(vs.model ? { model: vs.model } : {}) };
    const ocr = vs.provider === "none" ? null : await ocrCard(input.image_data_url);
    if (vs.provider === "none") photo = { status: "not_setup", ...tag, notice: SOIL_NOT_SETUP };
    else if (!ocr) photo = { status: "failed", ...tag, notice: SOIL_READ_FAILED };
    else photo = { status: "used", ...tag, notice: SOIL_READ_OK };
    if (ocr) {
      parsed = ocr.values.flatMap((v) => {
        const p = canonicalParam(v.param);
        return p ? [{ param: p, value: v.value, unit: bandsFile.params[p].unit, ocr_confidence: v.ocr_confidence }] : [];
      });
      if (!printed.length) printed = ocr.printed_recommendation ?? [];
    }
  }

  const crop = input.crop ?? profile.crops?.[0] ?? "wheat";
  if (!parsed.length) {
    return envelope({
      module: "soil_card",
      status: input.image_data_url ? "degraded" : "needs_info",
      headline: input.image_data_url
        ? t("Could not read the card automatically — please type the values", "कार्ड अपने-आप नहीं पढ़ा जा सका — कृपया मान टाइप करें", "কাৰ্ডখন নিজে পঢ়িব পৰা নগ'ল — অনুগ্ৰহ কৰি মান টাইপ কৰক")
        : t("Photograph your Soil Health Card or type the values", "अपने मृदा स्वास्थ्य कार्ड की फ़ोटो लें या मान टाइप करें", "আপোনাৰ মাটি স্বাস্থ্য কাৰ্ডৰ ফটো লওক বা মান টাইপ কৰক"),
      body: { parsed: [], confirmed: false, ratings: [], plan: { source: "none", crop, items: [] } },
      provenance,
      photo,
      missing_fields: ["soil_values"],
      sources,
      disclaimer: "agrochemical",
    });
  }

  const ratings = parsed.flatMap((p) => {
    const r = rateParam(p.param, p.value);
    return r ? [{ param: p.param, band: r.band, note: r.note }] : [];
  });
  const { plan, source } = buildPlan(crop, profile.state, ratings, printed);
  if (source) sources.push({ label: source.label, url: source.url, as_of: source.verified_on });

  const lowConf = parsed.filter((p) => p.ocr_confidence < 0.7).map((p) => p.param);
  const problems = ratings.filter((r) => PROBLEM_BANDS.has(r.band) || (r.band === "high" && r.param === "EC"));
  const actions: ActionItem[] = [];
  if (!confirmed) actions.push({ id: "soil-confirm", label: t("Confirm the values read from your card", "कार्ड से पढ़े गए मानों की पुष्टि करें", "কাৰ্ডৰ পৰা পঢ়া মানবোৰ নিশ্চিত কৰক"), kind: "do_now", priority: 2 });
  for (const it of plan.items.slice(0, 3)) actions.push({ id: `soil-plan-${it.nutrient}`, label: it.guidance, kind: "info", priority: 3 });
  if (ratings.some((r) => r.param === "OC" && r.band === "low")) {
    actions.push({ id: "soil-oc", label: t("Add compost / farmyard manure before next sowing", "अगली बुवाई से पहले कम्पोस्ट / गोबर खाद डालें", "পিছৰ সিঁচাৰ আগতে কম্পোষ্ট / গোবৰ সাৰ দিয়ক"), kind: "do_now", priority: 3 });
  }

  return envelope({
    module: "soil_card",
    status: "ok",
    headline: t(`Soil card read: ${problems.length} parameter(s) need attention`, `मृदा कार्ड: ${problems.length} मानकों पर ध्यान चाहिए`, `মাটি কাৰ্ড: ${problems.length} টা মানত মনোযোগ লাগে`),
    body: { parsed, confirmed, ratings, plan },
    actions,
    sources,
    confidence: confirmed ? 0.9 : Math.min(...parsed.map((p) => p.ocr_confidence)),
    provenance,
    photo,
    disclaimer: "agrochemical",
    missing_fields: !confirmed ? lowConf.map((p) => `confirm:${p}`) : [],
  });
}
