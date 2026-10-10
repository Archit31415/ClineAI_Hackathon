/**
 * Plain-code validators that re-check every Cline form fill (Workflow B). Deterministic.
 */
import { now } from "../lib/clock";

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
/** Survey/khasra/dag numbers: digits with optional / - and letter suffix, e.g. 123, 45/2, 112-A, 78/1/K. */
export const SURVEY_RE = /^[0-9]{1,6}([\/-][0-9A-Za-z]{1,4}){0,3}$/;

export interface FormField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "date" | "enum";
  required: boolean;
  options?: string[];
  from?: string;
  validate?: "ifsc" | "survey_number" | "not_future" | "positive";
}
export interface FormSchema {
  id: string;
  scheme_id: string;
  title: string;
  fields: FormField[];
  required_documents: string[];
  source: { url: string; verified_on: string };
}

export type FormValue = string | number | boolean | null;

export function validateForm(schema: FormSchema, values: Record<string, FormValue>) {
  const errors: { field: string; message: string }[] = [];
  const warnings: { field: string; message: string }[] = [];
  for (const f of schema.fields) {
    const v = values[f.key];
    if (v === undefined || v === null || v === "") {
      if (f.required) errors.push({ field: f.key, message: `${f.label} is required (unknown — ask the farmer or check documents)` });
      continue;
    }
    if (f.type === "number" && typeof v !== "number") errors.push({ field: f.key, message: `${f.label} must be a number` });
    if (f.type === "boolean" && typeof v !== "boolean") errors.push({ field: f.key, message: `${f.label} must be yes/no` });
    if (f.type === "enum" && f.options && !f.options.includes(String(v))) errors.push({ field: f.key, message: `${f.label} must be one of ${f.options.join(", ")}` });
    if (f.type === "date" && Number.isNaN(new Date(String(v)).getTime())) errors.push({ field: f.key, message: `${f.label} is not a valid date` });
    switch (f.validate) {
      case "ifsc":
        if (!IFSC_RE.test(String(v).toUpperCase())) errors.push({ field: f.key, message: "IFSC must look like ABCD0123456" });
        break;
      case "survey_number":
        if (!SURVEY_RE.test(String(v))) errors.push({ field: f.key, message: "Survey number format looks wrong (e.g. 123/4)" });
        break;
      case "not_future": {
        const d = new Date(String(v));
        if (d.getTime() > now().getTime() + 86400000) errors.push({ field: f.key, message: `${f.label} cannot be in the future` });
        break;
      }
      case "positive":
        if (typeof v === "number" && v <= 0) errors.push({ field: f.key, message: `${f.label} must be greater than 0` });
        if (typeof v === "number" && v > 50) warnings.push({ field: f.key, message: `${f.label} is unusually large; please confirm` });
        break;
    }
  }
  // unknown keys are dropped by the caller; flag them
  for (const k of Object.keys(values)) {
    if (!schema.fields.some((f) => f.key === k)) warnings.push({ field: k, message: "Not part of the form; ignored" });
  }
  return { errors, warnings };
}
