/**
 * Slot selection, confirm text and direct slot answers (deterministic).
 */
import type { FarmerProfile, Lang } from "@kisansahay/contracts";
import { readJson } from "../lib/paths";
import { extractFacts } from "./extract";
import { NO, normDigits, YES } from "./lexicon";

export type Slot = "problem" | "location" | "crops" | "land" | "loss_when" | "stock" | "animal" | "ownership" | "category" | "bank";
export type Chips = Record<string, [string, string][]>;
export interface PromptBank {
  [slot: string]: unknown;
  _confirm_chips: Chips;
  _done: Record<Lang, string>;
  _fix: Record<Lang, string>;
}
export const bank = () => readJson<PromptBank>("interview", "prompts.json");

export function chipsFor(chips: Chips, lang: Lang) {
  return (chips[lang] ?? chips["*"] ?? chips.en ?? []).map(([label, value]) => ({ label, value }));
}

export const isYes = (s: string) => YES.some((w) => s === w || s.startsWith(w + " "));
export const isNo = (s: string) => NO.some((w) => s === w || s.startsWith(w + " "));

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

export function confirmText(p: FarmerProfile, lang: Lang): string {
  const parts: string[] = [];
  if (p.raw_units && p.land_hectares !== undefined) parts.push(`${p.raw_units.value} ${p.raw_units.unit} ≈ ${p.land_hectares} ha`);
  else if (p.land_hectares !== undefined) parts.push(`${p.land_hectares} ha`);
  if (p.crops?.length) parts.push(p.crops.join(", "));
  if (p.district) parts.push(`${p.district}${p.state ? `, ${p.state}` : ""}`);
  if (p.loss_event) parts.push(`${p.loss_event.type} @ ${p.loss_event.occurred_at.slice(0, 16).replace("T", " ")}`);
  const q = { en: "Correct?", hi: "सही है?", as: "শুদ্ধ নে?" }[lang];
  return `${parts.join(" · ")}. ${q}`;
}

/** Apply direct slot answers (chip values like "owner", "sc", "yes") deterministically. */
export function applySlotAnswer(slot: Slot | null, text: string, p: FarmerProfile): Partial<FarmerProfile> {
  const s = normDigits(text).toLowerCase().trim();
  if (slot === "bank") {
    if (/not linked|जुड़ा नहीं|সংযুক্ত নহয়/.test(s)) return { has_bank_account: true, aadhaar_seeded: false };
    if (isYes(s)) return { has_bank_account: true, aadhaar_seeded: true };
    if (isNo(s)) return { has_bank_account: false, aadhaar_seeded: false };
  }
  if (slot === "ownership" && /sharecrop/.test(s)) return { land_ownership: "sharecropper" };
  if (slot === "category" && ["general", "obc", "sc", "st"].includes(s)) return { category: s as "sc" };
  if (slot === "loss_when" && !p.loss_event) {
    const f = extractFacts(`${s} hail`, p);
    return f.loss_event ? { loss_event: f.loss_event } : {};
  }
  return {};
}
