/**
 * Slot selection, confirm text and direct slot answers (deterministic).
 * Prompt bank: data/interview/prompts.json (en/hi/as, reviewed) + prompts.extra.json (bn/mr/te/ta/kn/ml).
 */
import type { FarmerProfile, Lang } from "@kisansahay/contracts";
import { placeLabel } from "../geo/gazetteer";
import { readJson, readJsonIfExists } from "../lib/paths";
import { extractFacts } from "./extract";
import { NO, normDigits, YES } from "./lexicon";

export type Slot = "problem" | "location" | "crops" | "land" | "loss_when" | "stock" | "animal" | "ownership" | "category" | "bank";
export type Chips = Record<string, [string, string][]>;
type Text = Partial<Record<Lang, string>> & { en: string };
export interface SlotPrompt { q: Text; q_district?: Text; chips?: Chips; chips_by_lang?: Chips }
export interface PromptBank {
  [slot: string]: unknown;
  welcome: SlotPrompt;
  _confirm_chips: Chips;
  _confirm_q: Text;
  _got_it: Text;
  _done: Text;
  _fix: Text;
}

let bankCache: PromptBank | undefined;
/** Deep-merge the extra-language bank over the reviewed one. */
export function bank(): PromptBank {
  if (bankCache && process.env.NODE_ENV !== "test") return bankCache;
  const base = readJson<Record<string, unknown>>("interview", "prompts.json");
  const extra = readJsonIfExists<Record<string, unknown>>("interview", "prompts.extra.json") ?? {};
  const merge = (a: unknown, b: unknown): unknown => {
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
      for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = k in out ? merge(out[k], v) : v;
      return out;
    }
    return b ?? a;
  };
  bankCache = merge(base, extra) as PromptBank;
  return bankCache;
}

export const say = (t: Text | undefined, lang: Lang): string => (t ? t[lang] ?? t.en : "");

export function chipsFor(chips: Chips | undefined, lang: Lang) {
  if (!chips) return [];
  return (chips[lang] ?? chips["*"] ?? chips.en ?? []).map(([label, value]) => ({ label, value }));
}

/** Location chips: language-specific examples first, then the shared demo districts. */
export function locationChips(p: SlotPrompt, lang: Lang) {
  return [...chipsFor(p.chips_by_lang, lang), ...chipsFor(p.chips, lang)].slice(0, 6);
}

const norm = (s: string) => s.trim().replace(/[.!।]+$/, "");
export const isYes = (s: string) => YES.some((w) => norm(s) === w || s.startsWith(w + " ") || s.startsWith(w + ","));
export const isNo = (s: string) => NO.some((w) => norm(s) === w || s.startsWith(w + " ") || s.startsWith(w + ","));

export function nextSlot(p: FarmerProfile, asked: Set<Slot>): Slot | null {
  const animal = p.pain_point === "animal_health";
  const sell = p.pain_point === "sell_produce";
  const need: [Slot, boolean][] = [
    ["problem", !p.pain_point],
    ["location", !p.district || !p.state],
    ["crops", !p.crops?.length && !animal],
    ["loss_when", p.pain_point === "crop_loss" && !p.loss_event],
    ["land", p.land_hectares === undefined && !animal && !sell],
    ["stock", sell && !p.stock_to_sell?.length],
    ["animal", animal && !p.livestock?.length],
    ["ownership", !p.land_ownership && !animal && !sell],
    ["bank", p.pain_point === "stuck_payment" && p.aadhaar_seeded === undefined],
    ["category", !p.category && !sell],
  ];
  return need.find(([s, missing]) => missing && !asked.has(s))?.[0] ?? null;
}

/** Short, language-aware summary of what we understood (used for confirm and acknowledgements). */
export function factsText(p: FarmerProfile, lang: Lang, keys?: Set<string>): string {
  const want = (k: string) => !keys || keys.has(k);
  const parts: string[] = [];
  if (want("place") && (p.district || p.state)) parts.push(placeLabel(p.state, p.district, lang));
  if (want("crops") && p.crops?.length) parts.push(p.crops.join(", "));
  if (want("land")) {
    if (p.raw_units && p.land_hectares !== undefined) parts.push(`${p.raw_units.value} ${p.raw_units.unit} ≈ ${p.land_hectares} ha`);
    else if (p.land_hectares !== undefined) parts.push(`${p.land_hectares} ha`);
  }
  if (want("loss") && p.loss_event) parts.push(`${p.loss_event.type} @ ${p.loss_event.occurred_at.slice(0, 16).replace("T", " ")}`);
  if (want("animals") && p.livestock?.length) parts.push(p.livestock.map((l) => `${l.count} ${l.species}`).join(", "));
  if (want("stock") && p.stock_to_sell?.length) parts.push(p.stock_to_sell.map((s) => `${s.quintals} q ${s.commodity}`).join(", "));
  return parts.join(" · ");
}

export function confirmText(p: FarmerProfile, lang: Lang): string {
  return `${factsText(p, lang)}. ${say(bank()._confirm_q, lang)}`;
}

/** Apply direct slot answers (chip values like "owner", "sc", "yes") deterministically. */
export function applySlotAnswer(slot: Slot | null, text: string, p: FarmerProfile): Partial<FarmerProfile> {
  const s = normDigits(text).toLowerCase().trim();
  if (slot === "bank") {
    if (/not linked|जुड़ा नहीं|জোড়া নয়|সংযুক্ত নহয়|जोडलेले नाही|లింక్ లేదు|இணைக்கவில்லை|ಜೋಡಿಸಿಲ್ಲ|ബന്ധിപ്പിച്ചിട്ടില്ല/.test(s)) return { has_bank_account: true, aadhaar_seeded: false };
    if (isYes(s)) return { has_bank_account: true, aadhaar_seeded: true };
    if (isNo(s)) return { has_bank_account: false, aadhaar_seeded: false };
  }
  if (slot === "ownership" && /sharecrop/.test(s)) return { land_ownership: "sharecropper" };
  if (slot === "ownership" && s === "tenant") return { land_ownership: "tenant" };
  if (slot === "ownership" && s === "owner") return { land_ownership: "owner" };
  if (slot === "category" && ["general", "obc", "sc", "st"].includes(s)) return { category: s as "sc" };
  if (slot === "loss_when" && !p.loss_event) {
    const f = extractFacts(`${s} hail`, p);
    return f.loss_event ? { loss_event: f.loss_event } : {};
  }
  return {};
}
