/**
 * Real Cline SDK adapter. Uses @cline/sdk (alias of @cline/core):
 *   ClineCore.create() -> cline.start({ config: { providerId, modelId, apiKey, systemPrompt, extraTools, ... }, prompt })
 *   result.result?.text  -> final agent text (we parse JSON from it and validate with Zod)
 * Our tools are exposed with createTool(); built-in file/shell tools are disabled (enableTools:false).
 * This is the only file to touch if the SDK API changes.
 */
import { extractJson } from "../lib/llm";
import { SAFETY_RAILS, type ClineAdapter, type ClineRunResult, type RunTaskOpts } from "./adapter";
import { FixtureClineAdapter } from "./fixture";

type SdkModule = {
  ClineCore: { create(o?: Record<string, unknown>): Promise<SdkCore> };
  createTool: (cfg: {
    name: string; description: string; inputSchema: Record<string, unknown>;
    execute: (input: Record<string, unknown>) => Promise<unknown>;
  }) => unknown;
};
type SdkCore = {
  start(input: Record<string, unknown>): Promise<{ result?: { text: string; iterations?: number } }>;
  dispose(): Promise<void>;
};

let sdkPromise: Promise<SdkModule> | undefined;
async function loadSdk(): Promise<SdkModule> {
  // Dynamic import keeps fixture mode free of SDK startup cost.
  sdkPromise ??= import("@cline/sdk") as unknown as Promise<SdkModule>;
  return sdkPromise;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Cline task timed out after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export class SdkClineAdapter implements ClineAdapter {
  readonly mode = "sdk" as const;
  private fallback = new FixtureClineAdapter();

  async runTask<T>(opts: RunTaskOpts<T>): Promise<ClineRunResult<T>> {
    try {
      return await withTimeout(this.runSdk(opts), opts.timeoutMs);
    } catch (e) {
      opts.onProgress?.(`Cline SDK unavailable (${(e as Error).message}); using cached run`);
      return this.fallback.runTask(opts);
    }
  }

  private async runSdk<T>(opts: RunTaskOpts<T>): Promise<ClineRunResult<T>> {
    const apiKey = process.env.CLINE_API_KEY;
    if (!apiKey) throw new Error("CLINE_API_KEY not set");
    const sdk = await loadSdk();
    const extraTools = (opts.tools ?? []).map((tool) =>
      sdk.createTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (input) => {
          opts.onProgress?.(`tool ${tool.name} called`);
          const out = await tool.execute(input);
          return out;
        },
      }),
    );
    const systemPrompt = `You are a KisanSahay-AI background agent (task: ${opts.kind}).\n${opts.instructions}\n${SAFETY_RAILS}\n\nOUTPUT SHAPE:\n${opts.outputHint}`;
    const prompt = `INPUTS (JSON):\n${JSON.stringify(opts.inputs, null, 2)}\n\nComplete the task and reply with the final JSON object only.`;

    opts.onProgress?.("starting Cline SDK session");
    const cline = await sdk.ClineCore.create({ clientName: "kisansahay-ai" });
    try {
      let lastError = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await cline.start({
          config: {
            providerId: process.env.CLINE_PROVIDER || "anthropic",
            modelId: process.env.CLINE_MODEL || "claude-sonnet-4-5",
            apiKey,
            mode: "act",
            enableTools: false,
            enableSpawnAgent: false,
            enableAgentTeams: false,
            systemPrompt,
            extraTools,
          },
          prompt: attempt === 0 ? prompt : `${prompt}\n\nYour previous output was invalid: ${lastError}. Return corrected JSON only.`,
          interactive: false,
        });
        const text = res.result?.text ?? "";
        opts.onProgress?.(`Cline SDK replied (${res.result?.iterations ?? "?"} iterations); validating`);
        try {
          const parsed = opts.outputSchema.safeParse(extractJson(text));
          if (parsed.success) return { output: parsed.data, provenance: "cline-sdk" };
          lastError = parsed.error.message.slice(0, 500);
        } catch (e) {
          lastError = (e as Error).message;
        }
      }
      throw new Error(`Cline output failed validation: ${lastError}`);
    } finally {
      await cline.dispose().catch(() => undefined);
    }
  }
}
