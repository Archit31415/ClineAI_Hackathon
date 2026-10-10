/**
 * Pure rules evaluator. Deterministic: same profile + rule => same verdict.
 * Missing hard field => needs_info. Missing soft field => likely.
 */
import type { FarmerProfile, Lang, Verdict } from "@kisansahay/contracts";
import type { Condition, SchemeRule } from "./schema";
import { ALL_LANGS } from "@kisansahay/contracts";
import { pick } from "../lib/i18n";

export type CondOutcome = "pass" | "fail" | "unknown";

/** Derived facts the rules can reference (keeps rule files simple). */
export function deriveFacts(p: Partial<FarmerProfile> & Record<string, unknown>): Record<string, unknown> {
  const facts: Record<string, unknown> = { ...p };
  if (facts.cultivates === undefined) {
    if ((p.crops && p.crops.length > 0) || (p.land_hectares ?? 0) > 0) facts.cultivates = true;
    else if (p.crops && p.crops.length === 0 && p.land_hectares === 0) facts.cultivates = false;
  }
  if (facts.has_livestock === undefined && p.livestock !== undefined) {
    facts.has_livestock = p.livestock.some((l) => l.count > 0);
  }
  if (facts.has_cattle === undefined && p.livestock !== undefined) {
    facts.has_cattle = p.livestock.some((l) => (l.species === "cattle" || l.species === "buffalo") && l.count > 0);
  }
  return facts;
}

export function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

export function evalCondition(c: Condition, facts: Record<string, unknown>): CondOutcome {
  const actual = getPath(facts, c.field);
  if (c.op === "exists") return actual === undefined || actual === null ? "fail" : "pass";
  if (c.op === "not_exists") return actual === undefined || actual === null ? "pass" : "fail";
  if (actual === undefined || actual === null) return "unknown";
  const a = norm(actual);
  const v = Array.isArray(c.value) ? c.value.map(norm) : norm(c.value);
  switch (c.op) {
    case "eq": return a === v ? "pass" : "fail";
    case "ne": return a !== v ? "pass" : "fail";
    case "gt": return Number(a) > Number(v) ? "pass" : "fail";
    case "gte": return Number(a) >= Number(v) ? "pass" : "fail";
    case "lt": return Number(a) < Number(v) ? "pass" : "fail";
    case "lte": return Number(a) <= Number(v) ? "pass" : "fail";
    case "in": return Array.isArray(v) && v.includes(a) ? "pass" : "fail";
    case "not_in": return Array.isArray(v) && !v.includes(a) ? "pass" : "fail";
    case "intersects": {
      const arr = Array.isArray(a) ? a.map(norm) : [a];
      return Array.isArray(v) && arr.some((x) => v.includes(x)) ? "pass" : "fail";
    }
    default: return "unknown";
  }
}

export interface EvalDetail {
  verdict: Verdict;
  confidence: number;
  passed: Condition[];
  failed: Condition[];
  unknown_hard: Condition[];
  unknown_soft: Condition[];
}

export function evaluateRule(rule: SchemeRule, profile: Partial<FarmerProfile> & Record<string, unknown>): EvalDetail {
  const facts = deriveFacts(profile);
  const passed: Condition[] = [];
  const failed: Condition[] = [];
  const unknownHard: Condition[] = [];
  const unknownSoft: Condition[] = [];

  if (rule.state && facts.state && norm(rule.state) !== norm(facts.state)) {
    return { verdict: "not_eligible", confidence: 0.95, passed, failed: [{ field: "state", op: "eq", value: rule.state }], unknown_hard: [], unknown_soft: [] };
  }

  for (const c of rule.eligibility.all ?? []) {
    const o = evalCondition(c, facts);
    if (o === "pass") passed.push(c);
    else if (o === "fail") failed.push(c);
    else (c.soft ? unknownSoft : unknownHard).push(c);
  }
  const any = rule.eligibility.any ?? [];
  if (any.length) {
    const outs = any.map((c) => [c, evalCondition(c, facts)] as const);
    const hit = outs.find(([, o]) => o === "pass");
    if (hit) passed.push(hit[0]);
    else if (outs.every(([, o]) => o === "fail")) failed.push(...any);
    else unknownHard.push(...outs.filter(([, o]) => o === "unknown").map(([c]) => c));
  }

  let verdict: Verdict;
  let confidence: number;
  if (failed.length) { verdict = "not_eligible"; confidence = 0.9; }
  else if (unknownHard.length) { verdict = "needs_info"; confidence = 0.4; }
  else if (unknownSoft.length) { verdict = "likely"; confidence = 0.7; }
  else { verdict = "eligible"; confidence = 0.9; }
  if (rule.review_status !== "verified" && verdict !== "not_eligible") confidence -= 0.05;
  return { verdict, confidence: Math.round(confidence * 100) / 100, passed, failed, unknown_hard: unknownHard, unknown_soft: unknownSoft };
}

const NOT: Record<Lang, string> = {
  en: "Not met: ", hi: "पूरा नहीं: ", as: "পূৰণ হোৱা নাই: ", bn: "পূরণ হয়নি: ", mr: "पूर्ण नाही: ",
  te: "నెరవేరలేదు: ", ta: "பூர்த்தி ஆகவில்லை: ", kn: "ಪೂರೈಸಿಲ್ಲ: ", ml: "പാലിച്ചില്ല: ",
};
const UNK: Record<Lang, string> = {
  en: "Need to know: ", hi: "जानना ज़रूरी: ", as: "জানিব লাগিব: ", bn: "জানা দরকার: ", mr: "माहिती हवी: ",
  te: "తెలుసుకోవాలి: ", ta: "தெரிய வேண்டும்: ", kn: "ತಿಳಿಯಬೇಕು: ", ml: "അറിയേണ്ടത്: ",
};

export function reasonsFor(d: EvalDetail): Record<Lang, string[]> {
  const out = Object.fromEntries(ALL_LANGS.map((l) => [l, [] as string[]])) as Record<Lang, string[]>;
  for (const lang of ALL_LANGS as readonly Lang[]) {
    const lbl = (c: Condition) => (c.label ? pick(c.label, lang) : c.field);
    out[lang].push(...d.passed.map((c) => `✓ ${lbl(c)}`));
    out[lang].push(...d.failed.map((c) => `✗ ${NOT[lang]}${lbl(c)}`));
    out[lang].push(...[...d.unknown_hard, ...d.unknown_soft].map((c) => `? ${UNK[lang]}${lbl(c)}`));
  }
  return out;
}

/** Run generated tests against a rule (used by Workflow A's run_rule_tests tool). */
export function runRuleTests(rule: SchemeRule, tests: { name: string; profile: Record<string, unknown>; expect: Verdict }[]) {
  const results = tests.map((t) => {
    const got = evaluateRule(rule, t.profile as Partial<FarmerProfile> & Record<string, unknown>).verdict;
    return { name: t.name, expect: t.expect, got, pass: got === t.expect };
  });
  return { passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results };
}
