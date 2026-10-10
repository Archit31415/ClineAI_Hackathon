/**
 * Feature extraction for the triage engine.
 * The LLM may ONLY return feature ids from catalog.feature_vocab (anything else is dropped).
 * Fallback: keyword matching over typed/voice symptoms. Chips pass ids directly.
 */
import { z } from "zod";
import type { I18n, PhotoStatus } from "@kisansahay/contracts";
import { readJson } from "../lib/paths";
import { PHOTO_NOTICE, visionJson, visionStatus } from "../lib/vision";

type Keywords = { crop: Record<string, string[]>; livestock: Record<string, string[]> };

export function keywordFeatures(kind: "crop" | "livestock", text: string | undefined): string[] {
  if (!text) return [];
  const kw = readJson<Keywords>("triage", "keywords.json")[kind];
  const s = text.toLowerCase();
  return Object.entries(kw).filter(([, words]) => words.some((w) => s.includes(w.toLowerCase()))).map(([id]) => id);
}

const FeaturesZ = z.object({ features: z.array(z.string()), photo_quality: z.enum(["ok", "poor"]).default("ok") });

/** Vocab ids plus their English labels, so the model knows what each id means. */
function describeVocab(vocab: Record<string, I18n | string> | string[]): string {
  if (Array.isArray(vocab)) return vocab.join(", ");
  return Object.entries(vocab).map(([id, v]) => `${id} (${typeof v === "string" ? v : v.en})`).join("; ");
}

export interface FeatureExtraction {
  features: string[];
  photo_quality: "ok" | "poor";
  /** Set only when an image was supplied. */
  photo?: PhotoStatus;
}

/**
 * Features from photo and/or free text, via the configured vision provider (Cline / LLM).
 * Returns null only for text-only requests that could not be served (caller uses keywords).
 * With an image it always returns, carrying a PhotoStatus the farmer will see.
 */
export async function aiFeatures(
  vocab: Record<string, I18n | string> | string[],
  subject: string,
  text?: string,
  imageDataUrl?: string,
): Promise<FeatureExtraction | null> {
  const ids = Array.isArray(vocab) ? vocab : Object.keys(vocab);
  const vp = visionStatus();
  const providerTag = { provider: vp.provider, ...(vp.model ? { model: vp.model } : {}) };
  if (imageDataUrl && vp.provider === "none") {
    return { features: [], photo_quality: "ok", photo: { status: "not_setup", ...providerTag, notice: PHOTO_NOTICE.not_setup } };
  }
  const out = await visionJson({
    system:
      `You describe what you SEE in a ${subject} photo/description. You do not diagnose. ` +
      `Return ONLY feature ids from this fixed vocabulary: ${describeVocab(vocab)}. ` +
      `Only include a feature if it is clearly visible or clearly stated. ` +
      `If the photo is blurry, too dark or does not show the ${subject} clearly, set photo_quality to "poor".`,
    user: `Symptoms text: ${text ?? "(none)"}\nReturn {"features":["id",...],"photo_quality":"ok|poor"}`,
    imageDataUrl,
    schema: FeaturesZ,
    timeoutMs: imageDataUrl ? 30000 : 15000,
  });
  if (!out) {
    return imageDataUrl ? { features: [], photo_quality: "ok", photo: { status: "failed", ...providerTag, notice: PHOTO_NOTICE.failed } } : null;
  }
  const allowed = new Set(ids);
  const features = [...new Set(out.features.filter((f) => allowed.has(f)))];
  const photo_quality = out.photo_quality ?? "ok";
  const res: FeatureExtraction = { features, photo_quality };
  if (imageDataUrl) {
    res.photo = photo_quality === "poor"
      ? { status: "poor", ...providerTag, notice: PHOTO_NOTICE.poor }
      : { status: "used", ...providerTag, notice: features.length ? PHOTO_NOTICE.used : PHOTO_NOTICE.none_seen };
  }
  return res;
}

/**
 * Cheap photo-quality heuristic (server side, no decoding): rejects tiny or truncated images.
 * The browser also runs a blur/brightness check before upload (web/src/camera).
 */
export function photoQualityHeuristic(dataUrl: string | undefined): "ok" | "poor" | undefined {
  if (!dataUrl) return undefined;
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,/i.exec(dataUrl);
  if (!m) return "poor";
  const bytes = Math.floor((dataUrl.length - m[0].length) * 0.75);
  return bytes < 15_000 ? "poor" : "ok";
}
