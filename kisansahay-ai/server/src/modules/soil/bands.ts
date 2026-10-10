/**
 * Soil bands + state tables. Bands come ONLY from data (never inferred by the LLM).
 */
import { z } from "zod";
import type { I18n, SoilBody } from "@kisansahay/contracts";
import { t } from "../../lib/i18n";
import { visionJson } from "../../lib/vision";
import { readJson, readJsonIfExists } from "../../lib/paths";

interface Band { max: number; band: string; note: I18n }
export interface BandsFile {
  _source: { label: string; url: string; verified_on: string };
  params: Record<string, { unit: string; bands: Band[] }>;
}
export interface FertTable {
  state: string;
  source: { label: string; url: string; verified_on: string };
  crops: Record<string, Record<string, Record<string, I18n>>>;
}

export const loadBands = () => readJson<BandsFile>("soil", "bands.json");

const ALIASES: Record<string, string> = {
  ph: "pH", ec: "EC", oc: "OC", organic_carbon: "OC", n: "N", nitrogen: "N", p: "P", phosphorus: "P",
  k: "K", potassium: "K", s: "S", sulphur: "S", sulfur: "S", zn: "Zn", zinc: "Zn",
};
export function canonicalParam(p: string): string | undefined {
  if (loadBands().params[p]) return p;
  return ALIASES[p.toLowerCase().replace(/[^a-z_]/g, "")];
}

export function rateParam(param: string, value: number): { band: string; note: I18n } | undefined {
  const def = loadBands().params[param];
  if (!def) return undefined;
  const b = def.bands.find((x) => value <= x.max) ?? def.bands[def.bands.length - 1];
  return { band: b.band, note: b.note };
}

const OcrZ = z.object({
  values: z.array(z.object({ param: z.string(), value: z.number(), ocr_confidence: z.number().min(0).max(1) })),
  printed_recommendation: z.array(z.object({ nutrient: z.string(), guidance: z.string() })).default([]),
});

export async function ocrCard(imageDataUrl: string) {
  return visionJson({
    system: "You read Indian Soil Health Cards. Extract ONLY numbers printed on the card. Never guess. Give ocr_confidence 0..1 per value (low if blurry). Params: pH, EC, OC, N, P, K, S, Zn. Also copy any fertilizer recommendation printed on the card verbatim.",
    user: 'Return {"values":[{"param":"pH","value":6.1,"ocr_confidence":0.9}],"printed_recommendation":[{"nutrient":"N","guidance":"..."}]}',
    imageDataUrl,
    schema: OcrZ,
    timeoutMs: 40000,
  });
}

const stateSlug = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");

export function buildPlan(
  crop: string,
  state: string | undefined,
  ratings: SoilBody["ratings"],
  printed: { nutrient: string; guidance: string }[],
): { plan: SoilBody["plan"]; source?: FertTable["source"] } {
  if (printed.length) {
    return { plan: { source: "card_printed", crop, items: printed.map((r) => ({ nutrient: r.nutrient, guidance: t(r.guidance) })) } };
  }
  const table = readJsonIfExists<FertTable>("soil", `fertilizer_${stateSlug(state)}.json`);
  const cropTable = table?.crops[crop];
  if (table && cropTable) {
    const items = (["N", "P", "K"] as const).flatMap((n) => {
      const band = ratings.find((r) => r.param === n)?.band;
      const g = band ? cropTable[n]?.[band] : undefined;
      return g ? [{ nutrient: n, guidance: g }] : [];
    });
    return { plan: { source: "state_table", crop, items }, source: table.source };
  }
  return {
    plan: {
      source: "none", crop, items: [{ nutrient: "all", guidance: t(
        "No verified fertilizer table for your state/crop yet. Take this card to the block agriculture office or KVK.",
        "आपके राज्य/फसल के लिए अभी सत्यापित उर्वरक तालिका नहीं है। यह कार्ड ब्लॉक कृषि कार्यालय या KVK ले जाएँ।",
        "আপোনাৰ ৰাজ্য/শস্যৰ বাবে এতিয়াও প্ৰমাণিত সাৰ তালিকা নাই। এই কাৰ্ড ব্লক কৃষি কাৰ্যালয় বা KVK লৈ লৈ যাওক।") }],
    },
  };
}
