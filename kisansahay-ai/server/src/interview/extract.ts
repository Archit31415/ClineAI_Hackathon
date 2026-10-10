/**
 * Scripted fact extraction (deterministic, multilingual keyword based). Works without any LLM.
 */
import type { FarmerProfile, PainPoint } from "@kisansahay/contracts";
import { addDays, now, toIst } from "../lib/clock";
import {
  CATEGORY, CROPS, DISTRICTS, LOSS_TYPES, normDigits, NUMBER_WORDS, OWNERSHIP, PAIN, STATES, WHEN_WORDS,
} from "./lexicon";
import { toHectares } from "./units";

const has = (s: string, words: string[]) => words.some((w) => s.includes(w.toLowerCase()));
const NUM = String.raw`(\d+(?:\.\d+)?)`;
const EXTRA_NUM: Record<string, number> = { "দুটা": 2, "এটা": 1, "তিনিটা": 3, "দুখন": 2 };

function numberBefore(s: string, unitWords: string[]): { value: number; unit: string } | undefined {
  for (const u of unitWords) {
    const i = s.indexOf(u.toLowerCase());
    if (i < 0) continue;
    const before = s.slice(Math.max(0, i - 14), i);
    const m = new RegExp(`${NUM}\\s*$`).exec(before.trim());
    if (m) return { value: Number(m[1]), unit: u };
    const words = { ...NUMBER_WORDS, ...EXTRA_NUM };
    // glued forms like "দুবিঘা" or spaced "दो बीघा"
    const hit = Object.keys(words).sort((a, b) => b.length - a.length).find((w) => before.trimEnd().endsWith(w));
    if (hit) return { value: words[hit], unit: u };
  }
  return undefined;
}

const LAND_UNITS = ["hectare", "hectares", "ha", "acre", "acres", "bigha", "katha", "kattha", "हेक्टेयर", "एकड़", "बीघा", "कट्ठा", "বিঘা", "কঠা", "হেক্টৰ", "একৰ"];
const QUINTAL = ["quintal", "quintals", "qtl", "क्विंटल", "कुंतल", "कुन्तल", "কুইণ্টল"];
const ANIMALS: Record<string, string[]> = {
  cattle: ["cow", "cows", "cattle", "गाय", "গৰু"],
  buffalo: ["buffalo", "भैंस", "ম'হ"],
  goat: ["goat", "बकरी", "ছাগলী"],
  poultry: ["hen", "chicken", "मुर्गी", "কুকুৰা"],
};

export function extractFacts(rawText: string, profile: FarmerProfile): Partial<FarmerProfile> {
  const s = ` ${normDigits(rawText).toLowerCase()} `;
  const out: Partial<FarmerProfile> = {};

  for (const [d, def] of Object.entries(DISTRICTS)) if (has(s, def.words)) { out.district = d; out.state = def.state; break; }
  if (!out.state) for (const [st, words] of Object.entries(STATES)) if (has(s, words)) { out.state = st; break; }

  const crops = Object.entries(CROPS).filter(([, w]) => has(s, w)).map(([c]) => c);
  if (crops.length) out.crops = crops;

  const land = numberBefore(s, LAND_UNITS);
  if (land) {
    const conv = toHectares(land.value, land.unit, out.state ?? profile.state);
    if (conv) {
      out.land_hectares = conv.hectares;
      out.raw_units = { value: land.value, unit: land.unit };
    }
  }

  const loss = Object.entries(LOSS_TYPES).find(([, w]) => has(s, w))?.[0];
  if (loss) {
    const when = WHEN_WORDS.slice().reverse().find((w) => has(s, w.words));
    const days = when?.days ?? 0;
    const d = addDays(now(), -days);
    const date = toIst(d).slice(0, 10);
    // Afternoon assumption for "yesterday"; shown back to the farmer to confirm.
    const occurred = days === 0 ? toIst(now()) : `${date}T15:00:00+05:30`;
    out.loss_event = { type: loss as "hail", occurred_at: occurred };
    out.pain_point = "crop_loss";
  }

  if (!out.pain_point) {
    const pain = (Object.keys(PAIN) as PainPoint[]).find((p) => has(s, PAIN[p]));
    if (pain) out.pain_point = pain;
  }

  const qtl = numberBefore(s, QUINTAL);
  if (qtl) out.stock_to_sell = [{ commodity: (out.crops ?? profile.crops ?? ["wheat"])[0], quintals: qtl.value }];

  const livestock: NonNullable<FarmerProfile["livestock"]> = [];
  for (const [sp, words] of Object.entries(ANIMALS)) {
    if (!has(s, words)) continue;
    const n = numberBefore(s, words);
    livestock.push({ species: sp as "cattle", count: n?.value ?? 1 });
  }
  if (livestock.length) out.livestock = livestock;

  for (const [c, words] of Object.entries(CATEGORY)) {
    if (words.some((w) => new RegExp(`(^|[^a-z])${w.toLowerCase()}([^a-z]|$)`).test(s))) { out.category = c as "sc"; break; }
  }
  for (const [o, words] of Object.entries(OWNERSHIP)) if (has(s, words)) { out.land_ownership = o as "owner"; break; }

  if (/e-?kyc|ई-?केवाईसी|ই-?কেৱাইচি/.test(s)) out.ekyc_done = !/(not|nahi|नहीं|নাই|নহয়)/.test(s);
  return out;
}

/** Merge extracted facts into the profile without overwriting confirmed values with undefined. */
export function mergeProfile(p: FarmerProfile, f: Partial<FarmerProfile>): FarmerProfile {
  const out: FarmerProfile = { ...p };
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue;
    if (k === "crops" && p.crops?.length) { out.crops = [...new Set([...(p.crops ?? []), ...(v as string[])])]; continue; }
    (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}
