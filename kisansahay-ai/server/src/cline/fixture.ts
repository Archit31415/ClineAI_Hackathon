import type { ClineAdapter, ClineRunResult, RunTaskOpts } from "./adapter";

/**
 * Deterministic replay. Calls the task's fixture producer, which runs the same deterministic
 * logic (and the same tools) a real agent would use, so the full flow works offline.
 */
export class FixtureClineAdapter implements ClineAdapter {
  readonly mode = "fixture" as const;

  async runTask<T>(opts: RunTaskOpts<T>): Promise<ClineRunResult<T>> {
    opts.onProgress?.(`[fixture] ${opts.kind}: replaying deterministic run`);
    const out = await opts.fixture();
    const parsed = opts.outputSchema.parse(out);
    opts.onProgress?.(`[fixture] ${opts.kind}: output validated against schema`);
    return { output: parsed, provenance: "fixture" };
  }
}
