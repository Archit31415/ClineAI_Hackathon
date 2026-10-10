/**
 * Voice + typing (+ parent-rendered chips).
 * Chain: browser Web Speech (hi-IN / en-IN) → free local Whisper on our server (always used for Assamese,
 * which browsers don't support) → typing / chips. Tap the mic again to stop recording.
 */
import { useRef, useState } from "react";
import type { Lang } from "@kisansahay/contracts/types";
import { ui } from "../lib/i18n";
import { startPcmRecording, type PcmRecording } from "../voice/recorder";
import { listenWebSpeech, recorderSupported, transcribePcm, webSpeechSupported, type Listener } from "../voice/stt";

type Mode = "idle" | "browser" | "recording" | "transcribing";
const FALLBACK = "🎤 ✗ — type or tap a chip";

export function MicInput({ lang, onSubmit, disabled }: { lang: Lang; onSubmit: (t: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const rec = useRef<PcmRecording | null>(null);
  const listener = useRef<Listener | null>(null);
  const append = (t: string) => t && setText((p) => (p ? `${p} ${t}` : t));

  async function startWhisper() {
    if (!recorderSupported()) { setNote(FALLBACK); setMode("idle"); return; }
    try {
      setNote("");
      rec.current = await startPcmRecording(15000, () => void stopWhisper());
      setMode("recording");
    } catch {
      setNote(FALLBACK);
      setMode("idle");
    }
  }

  async function stopWhisper() {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setMode("transcribing");
    try {
      const pcm = await r.stop();
      if (pcm.length < 8000) { setNote("🎤 too short — tap, speak, then tap ⏹"); return; }
      const heard = await transcribePcm(pcm, lang);
      if (!heard.trim()) setNote("🎤 didn't catch any words — speak closer to the phone, or type / tap a chip");
      else append(heard);
    } catch (e) {
      setNote(`${FALLBACK} (${(e as Error).message})`);
    } finally {
      setMode("idle");
    }
  }

  async function onMic() {
    if (mode === "recording") return stopWhisper();
    if (mode === "browser") { listener.current?.stop(); return; }
    if (mode !== "idle") return;
    // Browsers have no Assamese speech recognition: go straight to Whisper.
    if (lang !== "as" && webSpeechSupported()) {
      setNote("");
      const l = listenWebSpeech(lang, append, (err) => {
        listener.current = null;
        setMode("idle");
        if (err && err !== "aborted" && err !== "no-speech") void startWhisper(); // network / unsupported → Whisper
        else if (err === "no-speech") setNote("🎤 didn't hear anything — try again");
      });
      if (l) { listener.current = l; setMode("browser"); return; }
    }
    await startWhisper();
  }

  function send() {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText("");
  }

  const live = mode === "browser" || mode === "recording";
  const placeholder = mode === "transcribing" ? "…" : live ? ui("listening", lang) : ui("type_here", lang);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          aria-label="microphone"
          onClick={onMic}
          disabled={disabled || mode === "transcribing"}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl text-white ${mode === "recording" ? "bg-red-600" : "bg-green-700"} ${live ? "mic-live" : ""}`}
        >{mode === "recording" ? "⏹" : mode === "transcribing" ? "⏳" : "🎤"}</button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-3 text-lg"
          disabled={disabled}
        />
        <button onClick={send} disabled={disabled || !text.trim()} className="rounded-xl bg-green-700 px-4 py-3 font-semibold text-white disabled:opacity-40">
          {ui("send", lang)}
        </button>
      </div>
      {mode === "recording" && <p className="text-xs text-red-700">● Recording (free Whisper) — tap ⏹ when done</p>}
      {mode === "transcribing" && <p className="text-xs text-stone-500">Transcribing with Whisper…</p>}
      {note && <p className="text-xs text-stone-500">{note}</p>}
    </div>
  );
}
