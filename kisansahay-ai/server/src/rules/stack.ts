import type { Conflict, EligibilityResult } from "@kisansahay/contracts";
import type { SchemeRule } from "./schema";

const ACTIVE = new Set(["eligible", "likely"]);

/** Fill stack_notes on each result and compute pairwise conflicts. */
export function applyStacking(results: EligibilityResult[], rules: SchemeRule[]): Conflict[] {
  const byId = new Map(results.map((r) => [r.scheme_id, r]));
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    const me = byId.get(rule.id);
    if (!me || !ACTIVE.has(me.verdict)) continue;
    for (const rel of rule.stacks_with) {
      const other = byId.get(rel.id);
      if (other && ACTIVE.has(other.verdict)) me.stack_notes.push({ with: rel.id, relation: "stacks", note: rel.note });
    }
    for (const rel of rule.requires) {
      me.stack_notes.push({ with: rel.id, relation: "requires", note: rel.note });
    }
    for (const rel of rule.conflicts_with) {
      const other = byId.get(rel.id);
      if (other && ACTIVE.has(other.verdict)) {
        me.stack_notes.push({ with: rel.id, relation: "conflicts", note: rel.note });
        const key = [rule.id, rel.id].sort().join("|");
        if (!seen.has(key)) { seen.add(key); conflicts.push({ a: rule.id, b: rel.id, note: rel.note }); }
      }
    }
  }
  return conflicts;
}
