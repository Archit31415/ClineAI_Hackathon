/**
 * Server-side STT, used when the browser's Web Speech API lacks the language (e.g. Assamese) or is unavailable.
 * STT_PROVIDER:
 *   local  (default) — free open-source Whisper running in this server (see whisper_local.ts). No key, audio stays local.
 *   openai           — OpenAI Whisper API (paid, needs WHISPER_API_KEY). Optional alternative.
 *   none             — disabled; the UI falls back to typing and chips.
 * Audio is never stored.
 */
import { decodePcm, isSilent, localModelId, localWhisperReady, transcribeLocal, warmUpLocalWhisper } from "./whisper_local";

export type SttProvider = "local" | "openai" | "none";

export function sttProvider(): SttProvider {
  const p = (process.env.STT_PROVIDER ?? "local").toLowerCase();
  if (p === "openai") return process.env.WHISPER_API_KEY ? "openai" : "none";
  if (p === "none") return "none";
  return "local";
}

export function sttEnabled(): boolean {
  return sttProvider() !== "none";
}

export function sttStatus() {
  const provider = sttProvider();
  return {
    provider,
    model: provider === "local" ? localModelId() : provider === "openai" ? "whisper-1" : null,
    ready: provider === "local" ? localWhisperReady() : provider === "openai",
  };
}

export function warmUpStt(): void {
  if (sttProvider() === "local" && process.env.STT_WARMUP !== "false") warmUpLocalWhisper();
}

const MAX_SECONDS = 60;

export interface SttRequest {
  lang: string;
  /** 16 kHz mono PCM (preferred; produced by the browser). */
  pcm_base64?: string;
  pcm_format?: "f32" | "s16";
  /** Compressed audio blob (only usable with the OpenAI provider). */
  audio_base64?: string;
  mime?: string;
}

export async function transcribe(req: SttRequest): Promise<string | null> {
  const provider = sttProvider();
  if (provider === "local") {
    if (!req.pcm_base64) return null;
    const pcm = decodePcm(req.pcm_base64, req.pcm_format ?? "s16");
    if (pcm.length < 1600 || pcm.length > MAX_SECONDS * 16000) return null; // 0.1 s .. 60 s
    if (isSilent(pcm)) return "";
    try {
      return await transcribeLocal(pcm, req.lang);
    } catch (e) {
      console.warn(`[stt] local Whisper error: ${(e as Error).message}`);
      return null;
    }
  }
  if (provider === "openai") return transcribeOpenAI(req);
  return null;
}

/** Minimal 16-bit PCM WAV wrapper so the OpenAI API can accept browser PCM too. */
export function pcmToWav(pcm: Float32Array): Buffer {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

async function transcribeOpenAI(req: SttRequest): Promise<string | null> {
  const key = process.env.WHISPER_API_KEY;
  if (!key) return null;
  let file: Blob;
  if (req.pcm_base64) file = new Blob([pcmToWav(decodePcm(req.pcm_base64, req.pcm_format ?? "s16"))], { type: "audio/wav" });
  else if (req.audio_base64) file = new Blob([Buffer.from(req.audio_base64, "base64")], { type: req.mime ?? "audio/webm" });
  else return null;
  if (file.size > 10 * 1024 * 1024) return null;
  const form = new FormData();
  form.append("file", file, file.type === "audio/wav" ? "audio.wav" : "audio.webm");
  form.append("model", "whisper-1");
  if (["hi", "as", "en"].includes(req.lang)) form.append("language", req.lang);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { text?: string }).text ?? null;
  } catch {
    return null;
  }
}
