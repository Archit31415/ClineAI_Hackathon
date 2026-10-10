import type { ActionItem, I18n, ModuleId, ModuleResult } from "@kisansahay/contracts";
import { nowIso } from "./clock";

/** Helper so every module builds the same envelope. */
export function envelope<B>(p: {
  module: ModuleId;
  status?: ModuleResult["status"];
  headline: I18n;
  body: B;
  actions?: ActionItem[];
  sources?: ModuleResult["sources"];
  confidence?: number;
  provenance?: ModuleResult["provenance"];
  disclaimer?: ModuleResult["disclaimer"];
  missing_fields?: string[];
  photo?: ModuleResult["photo"];
}): ModuleResult<B> {
  const r: ModuleResult<B> = {
    module: p.module,
    status: p.status ?? "ok",
    headline: p.headline,
    body: p.body,
    actions: p.actions ?? [],
    sources: p.sources ?? [],
    provenance: p.provenance ?? "live",
    disclaimer: p.disclaimer ?? "general",
    generated_at: nowIso(),
  };
  if (p.confidence !== undefined) r.confidence = Math.max(0, Math.min(1, round2(p.confidence)));
  if (p.missing_fields && p.missing_fields.length) r.missing_fields = p.missing_fields;
  if (p.photo) r.photo = p.photo;
  return r;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
