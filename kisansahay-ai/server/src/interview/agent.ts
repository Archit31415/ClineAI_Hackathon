/**
 * Interview agent: slot-filling over a human-reviewed prompt bank (data/interview/prompts*.json).
 * Opens with ONE "survey" question (problem + place + crop/animals + land together). Every turn runs
 * the scripted multilingual extractor over the farmer's words (place via the all-India gazetteer), so
 * anything already said is never asked again. The optional LLM only ADDS facts not already known
 * (validated by Zod). The LLM never writes questions or decides anything.
 * Confirm-before-trust: land/loss facts are read back for tap-to-correct.
 */
import type { z } from "zod";
import { FarmerProfileZ, type FarmerProfile, type InterviewTurnRequest, type InterviewTurnResponse, type Lang } from "@kisansahay/contracts";
import { placeLabel } from "../geo/gazetteer";
import { llmJson } from "../lib/llm";
import { routeIntents } from "../router/intent";
import { extractFacts, mergeProfile } from "./extract";
import { normDigits } from "./lexicon";
import {
  applySlotAnswer, bank, chipsFor, confirmText, factsText, isNo, isYes, locationChips, nextSlot, say,
  type Slot, type SlotPrompt,
} from "./slots";

interface Session { asked: Slot[]; confirmed: boolean; awaitingConfirm: boolean; utterances: string[] }
const sessions = new Map<string, Session>();

const LlmFactsZ = FarmerProfileZ.partial().omit({ lang: true, land_hectares: true });

async function llmFacts(text: string, p: FarmerProfile) {
  return llmJson({
    system: "Extract farmer profile facts from the utterance (any Indian language). Only include facts explicitly stated. Never guess. Use English state/district names. For land, put the spoken number+unit in raw_units; do not convert units.",
    user: `Current profile: ${JSON.stringify(p)}\nUtterance: ${text}\nReturn a JSON object with only the FarmerProfile fields you are sure about.`,
    schema: LlmFactsZ as unknown as z.ZodType<Partial<FarmerProfile>>,
    timeoutMs: 6000,
  });
}

/** Which visible facts were newly learned this turn (for the "Got it: ..." acknowledgement). */
function learned(before: FarmerProfile, after: FarmerProfile): Set<string> {
  const k = new Set<string>();
  const diff = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  if (diff(after.district, before.district) || diff(after.state, before.state)) k.add("place");
  if (diff(after.crops, before.crops)) k.add("crops");
  if (diff(after.land_hectares, before.land_hectares)) k.add("land");
  if (diff(after.loss_event, before.loss_event)) k.add("loss");
  if (diff(after.livestock, before.livestock)) k.add("animals");
  if (diff(after.stock_to_sell, before.stock_to_sell)) k.add("stock");
  return k;
}

function ask(slot: Slot, profile: FarmerProfile, lang: Lang) {
  const prompt = bank()[slot] as SlotPrompt;
  if (slot === "location") {
    // State known but not district: ask only for the district, naming the state in their language.
    const q = profile.state && !profile.district && prompt.q_district
      ? say(prompt.q_district, lang).replace("{state}", placeLabel(profile.state, undefined, lang))
      : say(prompt.q, lang);
    return { text: q, chips: locationChips(prompt, lang) };
  }
  return { text: say(prompt.q, lang), chips: chipsFor(prompt.chips, lang) };
}

export async function interviewTurn(req: InterviewTurnRequest): Promise<InterviewTurnResponse> {
  const lang = req.lang;
  const b = bank();
  const sess: Session = sessions.get(req.session_id) ?? { asked: [], confirmed: false, awaitingConfirm: false, utterances: [] };
  sessions.set(req.session_id, sess);
  let profile: FarmerProfile = { ...req.profile, lang };
  const text = req.user_text.trim();
  const s = normDigits(text).toLowerCase();
  let provenance: "llm" | "scripted" = "scripted";
  const all = () => sess.utterances.join(" ");

  // Opening turn: one survey question that invites everything at once.
  if (!text && !sess.utterances.length && !sess.asked.length) {
    sess.asked.push("problem");
    return {
      assistant_text: say(b.welcome.q, lang), profile, intents: [], next_slot: "welcome", confirm_needed: false, done: false,
      chips: chipsFor((b.problem as SlotPrompt).chips, lang), provenance,
    };
  }

  let confirmationOnly = false;
  if (sess.awaitingConfirm && text) {
    sess.awaitingConfirm = false;
    if (isNo(s)) {
      sess.confirmed = false;
      return { assistant_text: say(b._fix, lang), profile, intents: routeIntents(profile, all()), next_slot: "fix", confirm_needed: false, done: false, provenance };
    }
    if (isYes(s)) { sess.confirmed = true; confirmationOnly = true; }
  }

  const before = profile;
  if (text && !confirmationOnly) {
    sess.utterances.push(text);
    const lastAsked = sess.asked[sess.asked.length - 1] ?? null;
    profile = mergeProfile(profile, applySlotAnswer(lastAsked, text, profile));
    profile = mergeProfile(profile, extractFacts(text, profile));
    const llm = await llmFacts(text, profile).catch(() => null);
    if (llm) {
      provenance = "llm";
      const additions = Object.fromEntries(Object.entries(llm).filter(([k, v]) => v !== undefined && (profile as unknown as Record<string, unknown>)[k] === undefined));
      profile = mergeProfile(profile, additions);
    }
  }

  const intents = routeIntents(profile, all());
  const needsConfirm = !sess.confirmed && (profile.raw_units !== undefined || profile.loss_event !== undefined) && !!profile.district;
  if (needsConfirm) {
    sess.awaitingConfirm = true;
    const ct = confirmText(profile, lang);
    return { assistant_text: ct, confirm_text: ct, profile, intents, next_slot: "confirm", confirm_needed: true, done: false, chips: chipsFor(b._confirm_chips, lang), provenance };
  }

  const k = learned(before, profile);
  const facts = k.size ? factsText(profile, lang, k) : "";
  const ack = facts ? `${say(b._got_it, lang).replace("{facts}", facts)} ` : "";

  const slot = nextSlot(profile, new Set(sess.asked));
  if (!slot) return { assistant_text: `${ack}${say(b._done, lang)}`, profile, intents, next_slot: null, confirm_needed: false, done: true, provenance };
  sess.asked.push(slot);
  const q = ask(slot, profile, lang);
  return { assistant_text: `${ack}${q.text}`, profile, intents, next_slot: slot, confirm_needed: false, done: false, chips: q.chips, provenance };
}

export function resetSession(id: string): void {
  sessions.delete(id);
}
