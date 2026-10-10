/**
 * Workflow B: form fill + validation. Cline proposes form_values from profile + schema;
 * deterministic validators ALWAYS re-check the output. Never submits anywhere.
 */
import { z } from "zod";
import type { FarmerProfile, FormFillResult } from "@kisansahay/contracts";
import { readJsonIfExists } from "../lib/paths";
import { getPath } from "../rules/evaluate";
import { getCline, clineTimeout } from "./index";
import { validateForm, type FormSchema, type FormValue } from "./validators";

export function loadForm(formId: string): FormSchema | undefined {
  if (!/^[a-z0-9_]+$/.test(formId)) return undefined;
  return readJsonIfExists<FormSchema>("forms", `${formId}.json`);
}

const FillOutputZ = z.object({
  form_values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  notes: z.array(z.string()).default([]),
});
type FillOutput = z.infer<typeof FillOutputZ>;

export interface FillExtras { evidence_count?: number }

/** Deterministic mapping: what the fixture (and a well-behaved agent) produces. */
export function deterministicFill(schema: FormSchema, profile: FarmerProfile, extras: FillExtras = {}): FillOutput {
  const facts: Record<string, unknown> = {
    ...profile,
    _evidence_count: extras.evidence_count ?? 0,
    _has_pmkisan: profile.existing_benefits ? profile.existing_benefits.includes("pmkisan") : undefined,
  };
  const values: Record<string, FormValue> = {};
  for (const f of schema.fields) {
    if (!f.from) { values[f.key] = null; continue; }
    let v = getPath(facts, f.from);
    if (Array.isArray(v)) v = v.join(", ");
    if (f.type === "date" && typeof v === "string") v = v.slice(0, 10);
    if (f.key === "area_affected_ha" && typeof v === "number") v = Math.round(v * 100) / 100;
    values[f.key] = v === undefined ? null : (v as FormValue);
  }
  const notes: string[] = [];
  if (profile.raw_units && schema.fields.some((f) => f.key === "area_affected_ha" || f.key === "land_hectares")) {
    notes.push(`area converted from ${profile.raw_units.value} ${profile.raw_units.unit}`);
  }
  return { form_values: values, notes };
}

export async function fillForm(
  formId: string,
  profile: FarmerProfile,
  extras: FillExtras = {},
  onProgress?: (m: string) => void,
): Promise<FormFillResult> {
  const schema = loadForm(formId);
  if (!schema) throw new Error(`unknown form ${formId}`);
  const cline = getCline();
  const { output, provenance } = await cline.runTask<FillOutput>({
    kind: "fill_form",
    instructions:
      "Fill the given government form schema from the farmer profile. Map each field key to a value taken ONLY from the profile. " +
      "Dates as YYYY-MM-DD. If a value is not present in the profile, set it to null. Add short notes about any conversions.",
    inputs: { form_schema: schema, profile, extras },
    outputSchema: FillOutputZ,
    outputHint: '{"form_values": {"<field key>": "<string|number|boolean|null>"}, "notes": ["..."]}',
    timeoutMs: clineTimeout(),
    onProgress,
    fixture: () => deterministicFill(schema, profile, extras),
  });

  // Keep only schema keys; anything else is dropped (and flagged by validator).
  const values: Record<string, FormValue> = {};
  for (const f of schema.fields) values[f.key] = output.form_values[f.key] ?? null;
  const { errors, warnings } = validateForm(schema, output.form_values);
  for (const n of output.notes) {
    if (/convert/i.test(n)) warnings.push({ field: "area_affected_ha" in values ? "area_affected_ha" : "land_hectares", message: `${n}; confirm with land record` });
  }
  onProgress?.(`validators: ${errors.length} error(s), ${warnings.length} warning(s)`);

  const missing_documents = schema.required_documents.filter((d) => !(d === "loss_photos" && (extras.evidence_count ?? 0) >= 2));
  const requiredCount = schema.fields.filter((f) => f.required).length;
  const filledRequired = schema.fields.filter((f) => f.required && values[f.key] !== null && values[f.key] !== "").length;
  const confidence = Math.round((0.5 + 0.45 * (filledRequired / Math.max(1, requiredCount)) - 0.03 * errors.length) * 100) / 100;

  return {
    scheme_id: schema.scheme_id,
    form_values: values,
    errors,
    warnings,
    missing_documents,
    confidence: Math.max(0.1, Math.min(0.95, confidence)),
    provenance,
  };
}
