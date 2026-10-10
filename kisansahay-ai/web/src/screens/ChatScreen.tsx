/**
 * Interview: voice/typing/chips -> /api/interview/turn -> shared profile + intents.
 * When done (or anytime), the user can build the Action Plan from the routed intents.
 */
import { useEffect, useRef, useState } from "react";
import type { FarmerProfile, InterviewTurnResponse, Lang, ModuleId } from "@kisansahay/contracts/types";
import { Btn, Card, ErrorNote } from "../components/common";
import { MicInput } from "../components/MicInput";
import { api } from "../lib/api";
import { MODULE_META, pick, ui } from "../lib/i18n";
import { sessionId } from "../lib/store";
import { speak } from "../voice/tts";

interface Msg { who: "bot" | "me"; text: string }

export function ChatScreen({ lang, profile, setProfile, onBuildPlan, seed }: {
  lang: Lang; profile: FarmerProfile; setProfile: (p: FarmerProfile) => void;
  onBuildPlan: (intents: ModuleId[], utterance: string) => void; seed?: string;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [last, setLast] = useState<InterviewTurnResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const utterances = useRef<string[]>([]);
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  async function turn(text: string) {
    setBusy(true);
    setErr("");
    if (text) { setMsgs((m) => [...m, { who: "me", text }]); utterances.current.push(text); }
    try {
      const r = await api.turn(sessionId(), lang, text, profileRef.current);
      setProfile(r.profile);
      setLast(r);
      setMsgs((m) => [...m, { who: "bot", text: r.assistant_text }]);
      speak(r.assistant_text, lang);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void turn(seed ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [msgs]);

  const intents = last?.intents ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Card className="space-y-2">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.who === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-lg leading-snug ${m.who === "me" ? "bg-green-700 text-white" : "bg-stone-100"}`}>{m.text}</div>
          </div>
        ))}
        {busy && <div className="text-stone-400">…</div>}
        <div ref={bottom} />
      </Card>

      {last?.chips?.length ? (
        <div className="flex flex-wrap gap-2">
          {last.chips.map((c) => (
            <button key={c.value + c.label} disabled={busy} onClick={() => turn(c.value)}
              className={`rounded-full px-4 py-2 text-base font-medium ring-1 ${last.confirm_needed ? "bg-amber-50 ring-amber-500" : "bg-white ring-green-700 text-green-800"}`}>
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      <MicInput lang={lang} onSubmit={turn} disabled={busy} />
      {err && <ErrorNote msg={err} />}

      {intents.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {intents.map((id) => (
              <span key={id} className="rounded-full bg-green-50 px-3 py-1 text-green-800">{MODULE_META[id].icon} {pick(MODULE_META[id].name, lang)}</span>
            ))}
          </div>
          <Btn onClick={() => onBuildPlan(intents, utterances.current.join(" "))} disabled={busy} className="w-full text-lg">
            📋 {ui("build_plan", lang)}
          </Btn>
        </Card>
      )}
    </div>
  );
}
