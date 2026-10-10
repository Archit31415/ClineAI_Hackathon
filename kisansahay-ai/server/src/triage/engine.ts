/**
 * Shared triage engine: weighted feature match vs catalog -> ranked candidates + confidence;
 * red flags evaluated first (deterministic). Output text comes ONLY from the catalog.
 */
import type { I18n } from "@kisansahay/contracts";

export interface CatalogEntry {
  id: string;
  name: I18n;
  features: Record<string, number>;
  crop?: string;
  species?: string[];
  confirm_by?: I18n;
  safe_steps?: I18n;
  advisory_source?: { label: string; url: string };
}
export interface RedFlag { id: string; features: string[]; text: I18n; notifiable?: boolean; isolate?: boolean }
export interface Catalog {
  feature_vocab: Record<string, I18n>;
  red_flags: RedFlag[];
  entries: CatalogEntry[];
}

export interface Scored { entry: CatalogEntry; score: number; confidence: number; matched: string[] }

/**
 * Confidence = matched weight / total weight of the entry, scaled by coverage of observed features.
 * Deterministic and explainable.
 */
export function scoreCandidates(catalog: Catalog, observed: string[], filter?: (e: CatalogEntry) => boolean): Scored[] {
  const obs = new Set(observed);
  const out: Scored[] = [];
  for (const e of catalog.entries) {
    if (filter && !filter(e)) continue;
    const total = Object.values(e.features).reduce((a, b) => a + b, 0);
    const matched = Object.keys(e.features).filter((f) => obs.has(f));
    if (!matched.length) continue;
    const score = matched.reduce((a, f) => a + e.features[f], 0);
    const explained = observed.length ? matched.length / observed.length : 0;
    const confidence = Math.round(Math.min(0.9, (score / total) * (0.6 + 0.4 * explained)) * 100) / 100;
    out.push({ entry: e, score, confidence, matched });
  }
  return out.sort((a, b) => b.confidence - a.confidence || b.score - a.score);
}

export function matchRedFlags(catalog: Catalog, observed: string[]): RedFlag[] {
  const obs = new Set(observed);
  return catalog.red_flags.filter((rf) => rf.features.every((f) => obs.has(f)));
}

export function featureNames(catalog: Catalog, ids: string[]): I18n {
  const names = ids.map((id) => catalog.feature_vocab[id]).filter(Boolean);
  return {
    en: names.map((n) => n.en).join(", "),
    hi: names.map((n) => n.hi).join(", "),
    as: names.map((n) => n.as).join(", "),
  };
}
