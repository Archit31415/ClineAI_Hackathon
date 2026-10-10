/**
 * Interview agent: slot-filling over a human-reviewed prompt bank (data/interview/prompts.json).
 * The scripted multilingual extractor ALWAYS runs; the optional LLM only ADDS facts not already known
 * (validated by Zod). The LLM never writes questions or decides anything.
 * Confirm-before-trust: land/loss facts are read back for tap-to-correct.
 */
import type { z } from "zod";
import { FarmerProfileZ, type FarmerProfile, type InterviewTurnRequest, type InterviewTurnResponse } from "@kisansahay/contracts";
import { llmJson } from "../lib/llm";
import { routeIntents } from "../router/intent";
import { extractFacts, mergeProfile } from "./extract";
import { normDigits } from "./lexicon";
import { applySlotAnswer, bank, chipsFor, confirmText, isNo, isYes, nextSlot, type Chips, type Slot } from "./slots";

interface Session { asked: Slot[]; confirmed: boolean; awaitingConfirm: boolean; utterances: string[] }
const sessions = new Map<string, Session>();

const LlmFactsZ = FarmerProfileZ.partial().omit({ lang: true, land_hectares: true });

async function llmFacts(text: string, p: FarmerProfile) {
  return llmJson({
    system: "Extract farmer profile facts from the utterance (any Indian language). Only include facts explicitly stated. Never guess. For land, put the spoken number+unit in raw_units; do not convert units.",
    user: `Current profile: ${JSON.stringify(p)}\nUtterance: ${text}\nReturn a JSON object with only the FarmerProfile fields you are sure about.`,
    schema: LlmFactsZ as unknown as z.ZodType<Partial<FarmerProfile>>,
    timeoutMs: 6000,
  });
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

  let confirmationOnly = false;
  if (sess.awaitingConfirm && text) {
    sess.awaitingConfirm = false;
    if (isNo(s)) {
      sess.confirmed = false;
      // allow correction on the next turn: re-confirm after new facts arrive
      return { assistant_text: b._fix[lang], profile, intents: routeIntents(profile, sess.utterances.join(" ")), next_slot: "fix", confirm_needed: false, done: false, provenance };
    }
    if (isYes(s)) { sess.confirmed = true; confirmationOnly = true; }
  }

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

  const intents = routeIntents(profile, sess.utterances.join(" "));
  const needsConfirm = !sess.confirmed && (profile.raw_units !== undefined || profile.loss_event !== undefined) && !!profile.district;
  if (needsConfirm) {
    sess.awaitingConfirm = true;
    const ct = confirmText(profile, lang);
    return { assistant_text: ct, confirm_text: ct, profile, intents, next_slot: "confirm", confirm_needed: true, done: false, chips: chipsFor(b._confirm_chips, lang), provenance };
  }

  const slot = nextSlot(profile, new Set(sess.asked));
  if (!slot) return { assistant_text: b._done[lang], profile, intents, next_slot: null, confirm_needed: false, done: true, provenance };
  sess.asked.push(slot);
  const prompt = b[slot] as { q: Record<string, string>; chips: Chips };
  return { assistant_text: prompt.q[lang], profile, intents, next_slot: slot, confirm_needed: false, done: false, chips: chipsFor(prompt.chips, lang), provenance };
}

export function resetSession(id: string): void {
  sessions.delete(id);
}
