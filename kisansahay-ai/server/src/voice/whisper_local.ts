/**
 * Free, open-source Whisper running locally inside the Node server (no API key, no per-minute cost).
 * Uses @huggingface/transformers (ONNX Runtime) with the onnx-community Whisper weights.
 * The model is downloaded once from Hugging Face on first use and cached in data/models/ (gitignored).
 * Audio stays on this machine.
 *
 * Input: 16 kHz mono Float32 PCM (the browser resamples before upload, so no ffmpeg is needed).
 */
import { dataPath } from "../lib/paths";

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;

const WHISPER_LANG: Record<string, string> = { hi: "hindi", as: "assamese", en: "english" };

/**
 * Default is whisper-small: in our test it wrote Hindi correctly in Devanagari (~2 s per clip on a laptop CPU).
 * whisper-base is 4x smaller and faster but transliterated Hindi into Urdu script, which the keyword
 * extractor cannot read. Override with WHISPER_LOCAL_MODEL.
 */
export const localModelId = () => process.env.WHISPER_LOCAL_MODEL || "onnx-community/whisper-small";

let loading: Promise<Asr> | undefined;
let ready = false;

async function load(): Promise<Asr> {
  const tf = (await import("@huggingface/transformers")) as unknown as {
    pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<Asr>;
    env: { cacheDir: string; allowRemoteModels: boolean };
  };
  tf.env.cacheDir = dataPath("models");
  const asr = await tf.pipeline("automatic-speech-recognition", localModelId(), {
    // fp32 encoder for accuracy, 8-bit decoder for speed; works on any CPU
    dtype: { encoder_model: "fp32", decoder_model_merged: "q8" },
  });
  ready = true;
  return asr;
}

/** Start loading in the background (called at server start so the first request is fast). */
export function warmUpLocalWhisper(): void {
  loading ??= load();
  loading.catch((e) => {
    loading = undefined;
    console.warn(`[stt] local Whisper failed to load: ${(e as Error).message}`);
  });
}

export function localWhisperReady(): boolean {
  return ready;
}

export async function transcribeLocal(pcm: Float32Array, lang: string): Promise<string> {
  loading ??= load();
  const asr = await loading;
  const seconds = pcm.length / 16000;
  const out = await asr(pcm, {
    language: WHISPER_LANG[lang] ?? "hindi",
    task: "transcribe",
    chunk_length_s: 30, // long clips are processed in 30 s windows
    // Generous cap (Devanagari/Bengali use several tokens per word) that still stops runaway loops on noise.
    max_new_tokens: Math.min(440, Math.max(64, Math.ceil(seconds * 30))),
  });
  const r = Array.isArray(out) ? out[0] : out;
  return cleanTranscript(r?.text ?? "");
}

/** Signal energy check: skip the model entirely for near-silence. */
export function isSilent(pcm: Float32Array): boolean {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / Math.max(1, pcm.length)) < 0.004;
}

/**
 * Whisper hallucinates on non-speech (silence, tones, noise): it repeats one token ("अप अप अप …")
 * or emits stock phrases. Collapse runs and return "" when the result is mostly repetition.
 */
export function cleanTranscript(raw: string): string {
  const words = raw.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return "";
  const collapsed: string[] = [];
  for (const w of words) {
    const n = collapsed.length;
    if (n >= 2 && collapsed[n - 1] === w && collapsed[n - 2] === w) continue; // max 2 in a row
    collapsed.push(w);
  }
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const top = Math.max(...counts.values());
  if (words.length >= 6 && top / words.length > 0.5) return ""; // mostly one token → not real speech
  // Babble on tones/noise: many tiny, nearly all-distinct fragments ("अप अद अब अगर अव …").
  const short = words.filter((w) => [...w].length <= 2).length;
  if (words.length >= 5 && short / words.length > 0.7) return "";
  if (raw.includes("\uFFFD")) return ""; // broken multi-byte tokens = garbage decode
  const text = collapsed.join(" ");
  if (/^[\s.,!?।\-–—…()\[\]♪*]*$/.test(text)) return "";
  if (/^\(?\[?(music|silence|applause|noise|blank_audio)\]?\)?$/i.test(text)) return "";
  return text.slice(0, 500);
}

/** Decode base64 little-endian Float32 or Int16 PCM. */
export function decodePcm(b64: string, format: "f32" | "s16"): Float32Array {
  const buf = Buffer.from(b64, "base64");
  if (format === "s16") {
    const n = Math.floor(buf.length / 2);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
    return out;
  }
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)).slice();
}
