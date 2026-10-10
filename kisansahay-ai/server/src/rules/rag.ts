/**
 * Minimal retrieval over scheme chunks (keyword fallback per technical.md §2).
 * RAG only EXPLAINS needs_info cases; it never changes a verdict.
 */
import type { I18n } from "@kisansahay/contracts";
import { readJsonIfExists } from "../lib/paths";

interface Chunk { scheme_id: string; field: string; text: I18n }

let cache: Chunk[] | undefined;
function chunks(): Chunk[] {
  cache ??= readJsonIfExists<Chunk[]>("schemes", "_chunks.json") ?? [];
  return cache;
}

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9_]+/).filter((w) => w.length > 2));
}

/** Best chunk for a scheme + missing fields (field match first, then keyword overlap). */
export function explainMissing(schemeId: string, missingFields: string[]): I18n | undefined {
  const mine = chunks().filter((c) => c.scheme_id === schemeId);
  if (!mine.length) return undefined;
  const direct = mine.find((c) => missingFields.includes(c.field));
  if (direct) return direct.text;
  const q = tokens(missingFields.join(" "));
  let best: Chunk | undefined;
  let bestScore = 0;
  for (const c of mine) {
    const ct = tokens(`${c.field} ${c.text.en}`);
    const score = [...q].filter((w) => ct.has(w)).length;
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return best?.text;
}
