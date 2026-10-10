/**
 * ClineAdapter — the ONLY interface the app uses to talk to Cline (technical.md §7 M3).
 * Implementations: SdkClineAdapter (@cline/sdk ClineCore) and FixtureClineAdapter (deterministic replay).
 * Mode via CLINE_MODE=sdk|fixture. Any SDK failure falls back to the fixture, labelled "cached run".
 */
import type { z } from "zod";

export type ClineTaskKind = "ingest_rule" | "fill_form" | "plan";

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON schema
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface RunTaskOpts<T> {
  kind: ClineTaskKind;
  instructions: string;
  inputs: Record<string, unknown>;
  tools?: ToolSpec[];
  outputSchema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Describes the output shape to the agent (JSON example or JSON schema). */
  outputHint: string;
  onProgress?: (msg: string) => void;
  timeoutMs: number;
  /** Deterministic fixture producer used by FixtureClineAdapter and as SDK fallback. */
  fixture: () => Promise<T> | T;
}

export interface ClineRunResult<T> {
  output: T;
  provenance: "cline-sdk" | "fixture";
}

export interface ClineAdapter {
  readonly mode: "sdk" | "fixture";
  runTask<T>(opts: RunTaskOpts<T>): Promise<ClineRunResult<T>>;
}

/** Safety rails appended to every Cline instruction (technical.md §7 M3 item 8). */
export const SAFETY_RAILS = `
SAFETY RULES (mandatory):
- Never invent values. If a value is unknown, use null and list the field as missing.
- Never contact or submit to external portals. You only prepare drafts for human review.
- Do not read or modify files. Use only the tools explicitly provided to you.
- Output ONLY the JSON object matching the schema, as your final message, with no prose and no code fences.`;
