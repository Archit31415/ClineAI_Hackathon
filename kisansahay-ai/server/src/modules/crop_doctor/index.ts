/**
 * Crop Doctor (Prototype): thin wrapper around the shared triage engine.
 * Never outputs pesticide names or doses; entries without advisory_source give no treatment steps.
 */
import type { ActionItem, CropDoctorBody, CropDoctorInput, FarmerProfile, ModuleResult } from "@kisansahay/contracts";
import { envelope } from "../../lib/envelope";
import { t } from "../../lib/i18n";
import { readJson } from "../../lib/paths";
import { featureNames, matchRedFlags, scoreCandidates, type Catalog } from "../../triage/engine";
import { PHOTO_NOTICE, visionStatus } from "../../lib/vision";
import { aiFeatures, keywordFeatures, photoQualityHeuristic } from "../../triage/vision";

const NO_SOURCE_STEPS = t(
  "Ask the agriculture officer or KVK before doing anything — we don't have a verified advisory for this yet.",
  "कुछ भी करने से पहले कृषि अधिकारी या KVK से पूछें — इसके लिए अभी सत्यापित सलाह नहीं है।",
  "একো কৰাৰ আগতে কৃষি বিষয়া বা KVK ক সোধক — ইয়াৰ বাবে এতিয়াও প্ৰমাণিত পৰামৰ্শ নাই।",
);

export async function runCropDoctor(profile: FarmerProfile, input: CropDoctorInput = {}): Promise<ModuleResult<CropDoctorBody>> {
  const catalog = readJson<Catalog>("triage", "crop_disease.json");
  const crop = (input.crop ?? profile.crops?.[0] ?? "").toLowerCase();
  const vocab = Object.keys(catalog.feature_vocab);

  let photo_quality: "ok" | "poor" = photoQualityHeuristic(input.image_data_url) ?? "ok";
  let features = (input.features ?? []).filter((f) => vocab.includes(f));
  const provenance: ModuleResult["provenance"] = "live";
  let photo: ModuleResult["photo"];

  if (input.image_data_url && photo_quality === "poor") {
    const vs = visionStatus();
    photo = { status: "poor", provider: vs.provider, ...(vs.model ? { model: vs.model } : {}), notice: PHOTO_NOTICE.poor };
  } else if (input.image_data_url || (input.symptoms_text && !features.length)) {
    const v = await aiFeatures(catalog.feature_vocab, `${crop || "crop"} leaf/plant`, input.symptoms_text, input.image_data_url);
    if (v) { photo_quality = v.photo_quality; features.push(...v.features); photo = v.photo; }
  }
  features.push(...keywordFeatures("crop", input.symptoms_text));
  features = [...new Set(features)];

  if (photo_quality === "poor" && !features.length) {
    return envelope({
      module: "crop_doctor", status: "needs_info",
      headline: t("Photo is unclear — please retake in daylight, close to one leaf", "फ़ोटो साफ़ नहीं — दिन की रोशनी में एक पत्ती के पास से फिर लें", "ফটো স্পষ্ট নহয় — দিনৰ পোহৰত এখিলা পাতৰ ওচৰৰ পৰা আকৌ লওক"),
      body: { photo_quality, candidates: [], escalate: false, features_detected: [] },
      actions: [{ id: "crop-retake", label: t("Retake the leaf photo", "पत्ती की फ़ोटो फिर लें", "পাতৰ ফটো আকৌ লওক"), kind: "do_now", priority: 2 }],
      disclaimer: "agrochemical", provenance, photo, missing_fields: ["photo_or_symptoms"],
    });
  }

  const scored = scoreCandidates(catalog, features, (e) => !crop || e.crop === crop || e.crop === "any").slice(0, 3);
  const redFlags = matchRedFlags(catalog, features);
  const candidates: CropDoctorBody["candidates"] = scored.map((s) => {
    const c: CropDoctorBody["candidates"][number] = {
      id: s.entry.id,
      name: s.entry.name,
      confidence: s.confidence,
      why: featureNames(catalog, s.matched),
      confirm_by: s.entry.confirm_by ?? t("Show the plant to the agriculture officer", "पौधा कृषि अधिकारी को दिखाएँ", "গছটো কৃষি বিষয়াক দেখুৱাওক"),
      safe_steps: s.entry.advisory_source && s.entry.safe_steps ? s.entry.safe_steps : NO_SOURCE_STEPS,
    };
    if (s.entry.advisory_source) c.advisory_source = s.entry.advisory_source;
    return c;
  });
  const top = candidates[0];
  const escalate = !top || top.confidence < 0.5 || redFlags.length > 0;

  const actions: ActionItem[] = [];
  for (const rf of redFlags) actions.push({ id: `crop-flag-${rf.id}`, label: rf.text, kind: "do_now", priority: 1 });
  if (top) actions.push({ id: "crop-confirm", label: top.confirm_by, kind: "do_now", priority: 2 });
  if (escalate) actions.push({ id: "crop-kvk", label: t("Show the crop to the agriculture officer / KVK before spraying anything", "कुछ भी छिड़कने से पहले फसल कृषि अधिकारी / KVK को दिखाएँ", "একো স্প্ৰে কৰাৰ আগতে শস্য কৃষি বিষয়া / KVK ক দেখুৱাওক"), kind: "visit", priority: 2 });

  return envelope({
    module: "crop_doctor",
    status: top ? "ok" : "needs_info",
    headline: top
      ? t(`Most likely: ${top.name.en} — confirm before acting`, `सबसे संभावित: ${top.name.hi} — कुछ करने से पहले पुष्टि करें`, `আটাইতকৈ সম্ভাৱ্য: ${top.name.as} — কাম কৰাৰ আগতে নিশ্চিত কৰক`)
      : t("Could not match the symptoms — please describe or photograph again", "लक्षण मेल नहीं खाए — फिर से बताएं या फ़ोटो लें", "লক্ষণ মিলা নাই — আকৌ কওক বা ফটো লওক"),
    body: { photo_quality, candidates, escalate, features_detected: features },
    actions,
    sources: candidates.flatMap((c) => (c.advisory_source ? [{ label: c.advisory_source.label, url: c.advisory_source.url, as_of: "TODO_VERIFY" }] : [])),
    confidence: top?.confidence ?? 0,
    provenance,
    disclaimer: "agrochemical",
    photo,
  });
}
