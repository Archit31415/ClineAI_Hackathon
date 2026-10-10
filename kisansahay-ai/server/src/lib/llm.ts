/**
 * Provider-agnostic LLM wrapper (technical.md §2). JSON output only, temperature <= 0.3.
 * The LLM extracts, explains and translates. It never decides verdicts, bands or triage levels.
 * Returns null when no provider is configured or the call fails: callers MUST have a deterministic fallback.
 */
import type { z } from "zod";

export type LlmProvider = "openai" | "anthropic" | "none";

export function llmProvider(): LlmProvider {
  const p = (process.env.LLM_PROVIDER ?? "none").toLowerCase();
  if (!process.env.LLM_API_KEY) return "none";
  return p === "openai" || p === "anthropic" ? p : "none";
}

export function llmEnabled(): boolean {
  return llmProvider() !== "none";
}

export interface LlmJsonOpts<T> {
  system: string;
  user: string;
  imageDataUrl?: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  timeoutMs?: number;
}

async function callOpenAI(o: LlmJsonOpts<unknown>, signal: AbortSignal): Promise<string> {
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const content: unknown[] = [{ type: "text", text: o.user }];
  if (o.imageDataUrl) content.push({ type: "image_url", image_url: { url: o.imageDataUrl } });
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: o.system + "\nRespond with a single JSON object only." },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  return j.choices[0]?.message?.content ?? "";
}

async function callAnthropic(o: LlmJsonOpts<unknown>, signal: AbortSignal): Promise<string> {
  const content: unknown[] = [];
  if (o.imageDataUrl) {
    const m = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(o.imageDataUrl);
    if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  content.push({ type: "text", text: o.user });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.LLM_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "claude-sonnet-4-5",
      max_tokens: 1500,
      temperature: 0.2,
      system: o.system + "\nRespond with a single JSON object only, no prose, no code fences.",
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const j = (await res.json()) as { content: { type: string; text?: string }[] };
  return j.content.find((c) => c.type === "text")?.text ?? "";
}

/** Extract the first JSON object from a model reply (tolerates code fences). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Ask for JSON; validate with Zod; retry once with the validation error (risk #4).
 * Returns null on any failure.
 */
export async function llmJson<T>(o: LlmJsonOpts<T>): Promise<T | null> {
  const provider = llmProvider();
  if (provider === "none") return null;
  let user = o.user;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 12000);
    try {
      const call = provider === "openai" ? callOpenAI : callAnthropic;
      const text = await call({ ...o, user } as LlmJsonOpts<unknown>, ctrl.signal);
      const parsed = o.schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      user = `${o.user}\n\nYour previous reply failed validation: ${parsed.error.message.slice(0, 400)}. Return corrected JSON only.`;
    } catch {
      if (attempt === 1) return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
