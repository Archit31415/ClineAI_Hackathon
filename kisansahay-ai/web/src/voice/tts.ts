/**
 * TTS: speechSynthesis with a voice for the language if available; otherwise large on-screen text only.
 * (Bhashini TTS / pre-recorded clips are the documented next fallbacks.)
 */
import type { Lang } from "@kisansahay/contracts/types";
import { LANGS } from "../lib/i18n";

let enabled = true;
export const setTtsEnabled = (v: boolean) => { enabled = v; };
export const ttsEnabled = () => enabled;

export function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === "undefined") return undefined;
  const code = LANGS.find((l) => l.id === lang)?.bcp47 ?? "hi-IN";
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === code) ?? voices.find((v) => v.lang.startsWith(code.slice(0, 2)));
}

export function hasVoice(lang: Lang): boolean {
  return !!voiceFor(lang);
}

export function speak(text: string, lang: Lang): void {
  if (!enabled || typeof speechSynthesis === "undefined" || !text) return;
  const v = voiceFor(lang);
  if (!v) return; // no voice for language -> on-screen text only
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_]/g, ""));
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
