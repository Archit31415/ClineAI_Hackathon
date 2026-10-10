/**
 * Scripted fact extraction (deterministic, multilingual keyword based). Works without any LLM.
 * Pulls EVERYTHING it can from any utterance (place, crop, land, loss, animals, stock, category...),
 * so the interview never re-asks something the farmer already said.
 */
import type { FarmerProfile, PainPoint } from "@kisansahay/contracts";
import { findPlace } from "../geo/gazetteer";
import { addDays, now, toIst } from "../lib/clock";
import {
  CATEGORY, CROPS, LOSS_TYPES, normDigits, NUMBER_WORDS, OWNERSHIP, PAIN, WHEN_WORDS,
} from "./lexicon";
import { LAND_UNIT_WORDS, toHectares } from "./units";

const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Latin words match whole words only ("ola" must not match "cola"); Indic words may carry glued case endings. */
function wordRe(w: string): RegExp {
  const esc = escapeRe(w.toLowerCase());
  return /^[\x00-\x7f]+$/.test(w)
    ? new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`)
    : new RegExp(`(^|[^\\u0900-\\u0d7f])${esc}`);
}
export const has = (s: string, words: string[]) => words.some((w) => wordRe(w).test(s));
const NUM = String.raw`(\d+(?:\.\d+)?)`;
const EXTRA_NUM: Record<string, number> = { "দুটা": 2, "এটা": 1, "তিনিটা": 3, "দুখন": 2, "দুটো": 2, "একটা": 1 };

function numberBefore(s: string, unitWords: string[]): { value: number; unit: string } | undefined {
  for (const u of [...unitWords].sort((a, b) => b.length - a.length)) {
    // Indic units may be glued to a number word ("দুবিঘা" = two bigha), so search them as substrings.
    const latin = /^[\x00-\x7f]+$/.test(u);
    const m = latin ? wordRe(u).exec(s) : (() => { const j = s.indexOf(u); return j < 0 ? null : Object.assign([u], { index: j }); })();
    if (!m) continue;
    const i = m.index + m[0].indexOf(u.toLowerCase());
    const before = s.slice(Math.max(0, i - 14), i);
    const n = new RegExp(`${NUM}\\s*$`).exec(before.trim());
    if (n) return { value: Number(n[1]), unit: u };
    const words = { ...NUMBER_WORDS, ...EXTRA_NUM };
    // glued forms like "দুবিঘা" or spaced "दो बीघा"
    const hit = Object.keys(words).sort((a, b) => b.length - a.length).find((w) => before.trimEnd().endsWith(w));
    if (hit) return { value: words[hit], unit: u };
  }
  return undefined;
}

const QUINTAL = ["quintal", "quintals", "qtl", "क्विंटल", "कुंतल", "कुन्तल", "কুইণ্টল", "কুইন্টাল", "క్వింటాల్", "குவிண்டால்", "ಕ್ವಿಂಟಾಲ್", "ക്വിന്റൽ"];
const ANIMALS: Record<string, string[]> = {
  cattle: ["cow", "cows", "cattle", "calf", "गाय", "गायें", "गायी", "वासरू", "গৰু", "গরু", "ఆవు", "பசு", "ಹಸು", "ಆವು", "പശു"],
  buffalo: ["buffalo", "भैंस", "म्हशी", "म्हैस", "ম'হ", "মহিষ", "గేదె", "எருமை", "ಎಮ್ಮೆ", "എരുമ"],
  goat: ["goat", "goats", "बकरी", "शेळी", "ছাগলী", "ছাগল", "మేక", "ஆடு", "ಮೇಕೆ", "ആട്"],
  poultry: ["hen", "chicken", "poultry", "मुर्गी", "कोंबडी", "কুকুৰা", "মুরগি", "కోడి", "கோழி", "ಕೋಳಿ", "കോഴി"],
};

export function extractFacts(rawText: string, profile: FarmerProfile): Partial<FarmerProfile> {
  const s = ` ${normDigits(rawText).toLowerCase()} `;
  const out: Partial<FarmerProfile> = {};

  const place = findPlace(rawText, profile.state);
  if (place.state) out.state = place.state;
  if (place.district) out.district = place.district;

  const crops = Object.entries(CROPS).filter(([, w]) => has(s, w)).map(([c]) => c);
  if (crops.length) out.crops = crops;

  const land = numberBefore(s, LAND_UNIT_WORDS);
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

  for (const [c, words] of Object.entries(CATEGORY)) if (has(s, words)) { out.category = c as "sc"; break; }
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
