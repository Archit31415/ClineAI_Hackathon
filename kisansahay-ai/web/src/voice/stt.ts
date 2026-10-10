/**
 * STT fallback chain: Web Speech API (hi-IN / en-IN / as-IN where supported)
 *   -> MediaRecorder blob -> server Whisper (/api/stt) -> typed / chips (always visible).
 */
import type { Lang } from "@kisansahay/contracts/types";
import { api } from "../lib/api";
import { LANGS } from "../lib/i18n";
import { int16ToBase64 } from "./recorder";

type SR = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};

function getSR(): (new () => SR) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const webSpeechSupported = () => !!getSR();
export const recorderSupported = () => !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

export interface Listener { stop(): void }

/** Listen once. Resolves with transcript; rejects on failure so the caller can fall back. */
export function listenWebSpeech(lang: Lang, onText: (t: string) => void, onEnd: (err?: string) => void): Listener | null {
  const Ctor = getSR();
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = LANGS.find((l) => l.id === lang)?.bcp47 ?? "hi-IN";
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.continuous = false;
  let got = false;
  const timer = setTimeout(() => r.stop(), 12000);
  r.onresult = (e) => {
    const t = e.results[0]?.[0]?.transcript ?? "";
    if (t) { got = true; onText(t); }
  };
  r.onerror = (e) => { clearTimeout(timer); onEnd(e.error); };
  r.onend = () => { clearTimeout(timer); onEnd(got ? undefined : "no-speech"); };
  try { r.start(); } catch { return null; }
  return { stop: () => r.stop() };
}

/** Upload recorded 16 kHz PCM to the server STT (free local Whisper by default). */
export async function transcribePcm(pcm: Int16Array, lang: Lang): Promise<string> {
  const { text } = await api.stt(int16ToBase64(pcm), lang);
  return text;
}
