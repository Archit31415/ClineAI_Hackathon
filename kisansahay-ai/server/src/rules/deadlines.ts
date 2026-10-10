import type { FarmerProfile } from "@kisansahay/contracts";
import { addHours, now, toIst } from "../lib/clock";
import { deriveFacts, evalCondition, getPath } from "./evaluate";
import type { DeadlineRule } from "./schema";

export interface ResolvedDeadline {
  id: string;
  label: string;
  due_at: string;
  hours_left: number;
  expired: boolean;
}

export function hoursBetween(fromIso: Date, toIso: string): number {
  return Math.floor((new Date(toIso).getTime() - fromIso.getTime()) / 3600000);
}

/** Resolve deadline rules against a profile using the injectable clock. */
export function resolveDeadlines(rules: DeadlineRule[], profile: FarmerProfile): ResolvedDeadline[] {
  const facts = deriveFacts(profile as FarmerProfile & Record<string, unknown>);
  const current = now();
  const out: ResolvedDeadline[] = [];
  for (const r of rules) {
    if (r.applies_if && evalCondition(r.applies_if, facts) !== "pass") continue;
    let due: string | undefined;
    if (r.kind === "after_event" && r.field && r.hours) {
      const at = getPath(facts, r.field);
      if (typeof at === "string" && !Number.isNaN(new Date(at).getTime())) due = addHours(at, r.hours);
    } else if (r.kind === "season_cutoff" && r.dates) {
      const season = getPath(facts, r.season_field ?? "season");
      const mmdd = typeof season === "string" ? r.dates[season] : undefined;
      if (mmdd) {
        const y = Number(toIst(current).slice(0, 4));
        let d = new Date(`${y}-${mmdd}T23:59:00+05:30`);
        if (d.getTime() < current.getTime() - 30 * 86400000) d = new Date(`${y + 1}-${mmdd}T23:59:00+05:30`);
        due = toIst(d);
      }
    } else if (r.kind === "fixed" && r.due_at) {
      due = r.due_at;
    }
    if (!due) continue;
    const hl = hoursBetween(current, due);
    out.push({ id: r.id, label: r.label, due_at: due, hours_left: Math.max(0, hl), expired: hl < 0 });
  }
  return out;
}
