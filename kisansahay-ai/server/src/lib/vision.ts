/**
 * Vision router. VISION_PROVIDER = cline | llm | none.
 *   cline: image goes to a Cline-routed vision model (server/src/cline/vision.ts), billed to Cline credits.
 *   llm:   image goes to the generic LLM wrapper (LLM_PROVIDER / LLM_API_KEY).
 *   none:  photos are not interpreted; modules tell the farmer and ask for chips / typed values instead.
 * Default when unset: "llm" if an LLM key is configured, else "none".
 */
import type { z } from "zod";
import { clineVisionJson, clineVisionModel } from "../cline/vision";
import { llmEnabled, llmJson } from "./llm";
import { t } from "./i18n";

export type VisionProvider = "cline" | "llm" | "none";

export function visionProvider(): VisionProvider {
  const v = (process.env.VISION_PROVIDER ?? "").trim().toLowerCase();
  if (v === "cline") return "cline";
  if (v === "llm") return llmEnabled() ? "llm" : "none";
  if (v === "none") return "none";
  return llmEnabled() ? "llm" : "none";
}

export function visionStatus(): { provider: VisionProvider; model: string | null } {
  const p = visionProvider();
  return { provider: p, model: p === "cline" ? clineVisionModel() : p === "llm" ? process.env.LLM_MODEL || null : null };
}

export interface VisionJsonOpts<T> {
  system: string;
  user: string;
  imageDataUrl?: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  timeoutMs?: number;
}

/**
 * Image (+ text) -> validated JSON. Without an image this is a text-only extraction and uses the LLM
 * when configured (Cline vision is only spent on photos). Returns null when unavailable or failed.
 */
export async function visionJson<T>(o: VisionJsonOpts<T>): Promise<T | null> {
  const p = visionProvider();
  if (o.imageDataUrl && p === "cline") return clineVisionJson({ ...o, imageDataUrl: o.imageDataUrl });
  if (o.imageDataUrl && p === "none") return null;
  return llmJson(o);
}

/** Farmer-facing notices about what happened to their photo. */
export const PHOTO_NOTICE = {
  not_setup: t(
    "Your photo was not checked: photo reading is not set up on this server. The advice below uses the symptoms you told us.",
    "आपकी फ़ोटो नहीं जाँची गई: इस सर्वर पर फ़ोटो पढ़ना चालू नहीं है। नीचे की सलाह आपके बताए लक्षणों पर आधारित है।",
    "আপোনাৰ ফটো পৰীক্ষা কৰা নহ'ল: এই ছাৰ্ভাৰত ফটো পঢ়া ব্যৱস্থা নাই। তলৰ পৰামৰ্শ আপুনি কোৱা লক্ষণৰ ওপৰত আধাৰিত।",
  ),
  failed: t(
    "Your photo could not be checked right now (network or service problem). The advice below uses the symptoms you told us.",
    "आपकी फ़ोटो अभी नहीं जाँची जा सकी (नेटवर्क या सेवा की समस्या)। नीचे की सलाह आपके बताए लक्षणों पर आधारित है।",
    "আপোনাৰ ফটো এতিয়া পৰীক্ষা কৰিব পৰা নগ'ল (নেটৱৰ্ক বা সেৱাৰ সমস্যা)। তলৰ পৰামৰ্শ আপুনি কোৱা লক্ষণৰ ওপৰত আধাৰিত।",
  ),
  used: t(
    "Your photo was checked by AI (it only notes visible signs; the advice comes from verified rules).",
    "आपकी फ़ोटो AI ने देखी (यह सिर्फ़ दिखने वाले लक्षण बताता है; सलाह सत्यापित नियमों से आती है)।",
    "আপোনাৰ ফটো AI এ চালে (ই কেৱল দেখা লক্ষণ কয়; পৰামৰ্শ প্ৰমাণিত নিয়মৰ পৰা আহে)।",
  ),
  none_seen: t(
    "AI looked at your photo but did not see any of the signs we can check. Please tap or describe the symptoms, or show it to an expert.",
    "AI ने फ़ोटो देखी, पर हमारी सूची का कोई लक्षण नहीं दिखा। कृपया लक्षण चुनें या बताएं, या किसी विशेषज्ञ को दिखाएँ।",
    "AI এ ফটো চালে, কিন্তু আমি পৰীক্ষা কৰিব পৰা কোনো লক্ষণ দেখা নাপালে। অনুগ্ৰহ কৰি লক্ষণ বাছক বা কওক, বা বিশেষজ্ঞক দেখুৱাওক।",
  ),
  poor: t(
    "The photo is unclear. Retake it in daylight, close to the problem area.",
    "फ़ोटो साफ़ नहीं है। दिन की रोशनी में, समस्या वाली जगह के पास से फिर लें।",
    "ফটো স্পষ্ট নহয়। দিনৰ পোহৰত, সমস্যাৰ ঠাইৰ ওচৰৰ পৰা আকৌ লওক।",
  ),
};
