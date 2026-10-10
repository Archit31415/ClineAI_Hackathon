import { useEffect, useState } from "react";
import type { ActionPlan, FarmerProfile, Lang, ModuleId, ModuleRegistryEntry } from "@kisansahay/contracts/types";
import { Btn, ErrorNote, Spinner } from "./components/common";
import { api, type Health } from "./lib/api";
import { LANGS, ui } from "./lib/i18n";
import { newSession, store } from "./lib/store";
import { usePlanBuilder } from "./lib/usePlanBuilder";
import { ActionPlanView } from "./screens/ActionPlanView";
import { ChatScreen } from "./screens/ChatScreen";
import { ClinePanel } from "./screens/ClinePanel";
import { Consent, Home, LanguagePicker } from "./screens/Home";
import { ModuleScreen } from "./screens/ModuleScreen";
import { setTtsEnabled, stopSpeaking, ttsEnabled } from "./voice/tts";

type View = { k: "home" } | { k: "chat" } | { k: "module"; id: ModuleId } | { k: "plan" } | { k: "cline" };

export default function App() {
  const [lang, setLangState] = useState<Lang | undefined>(store.lang());
  const [consent, setConsent] = useState(store.consent());
  const [profile, setProfileState] = useState<FarmerProfile>(store.profile() ?? { lang: store.lang() ?? "hi" });
  const [plan, setPlan] = useState<ActionPlan | undefined>(store.plan());
  const [registry, setRegistry] = useState<ModuleRegistryEntry[]>([]);
  const [view, setView] = useState<View>(store.plan() && !navigator.onLine ? { k: "plan" } : { k: "home" });
  const [offline, setOffline] = useState(!navigator.onLine);
  const [health, setHealth] = useState<Health>();
  const [tts, setTts] = useState(ttsEnabled());
  const [useCline, setUseCline] = useState(false);

  const setProfile = (p: FarmerProfile) => { setProfileState(p); store.setProfile(p); };
  const savePlan = (p: ActionPlan) => { setPlan(p); store.setPlan(p); setView({ k: "plan" }); };
  const builder = usePlanBuilder(registry, savePlan);

  useEffect(() => {
    api.modules().then(setRegistry).catch(() => setRegistry([]));
    api.health().then(setHealth).catch(() => undefined);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const setLang = (l: Lang) => { setLangState(l); store.setLang(l); setProfile({ ...profile, lang: l }); };

  function newFarmer() {
    stopSpeaking(); store.reset(); newSession();
    setProfile({ lang: lang ?? "hi" }); setPlan(undefined); setView({ k: "home" });
  }

  if (!lang) return <div className="mx-auto max-w-2xl p-4"><LanguagePicker onPick={setLang} /></div>;
  if (!consent) return <div className="mx-auto max-w-2xl p-4"><Consent lang={lang} onAgree={() => { store.setConsent(true); setConsent(true); }} /></div>;

  return (
    <div className="mx-auto max-w-2xl p-3 pb-16">
      <header className="no-print mb-3 flex items-center gap-2">
        <button onClick={() => setView({ k: "home" })} className="text-xl font-bold text-green-800">🌾 KisanSahay</button>
        <div className="ml-auto flex items-center gap-1">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border px-2 py-1">
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button title="voice output" onClick={() => { setTtsEnabled(!tts); setTts(!tts); }} className="px-2 text-xl">{tts ? "🔊" : "🔇"}</button>
          <button title="Cline agent" onClick={() => setView({ k: "cline" })} className="px-2 text-xl">🤖</button>
          <button title={ui("new_chat", lang)} onClick={newFarmer} className="px-2 text-xl">➕</button>
        </div>
      </header>
      {offline && view.k !== "plan" && (
        <p className="mb-2 rounded bg-amber-100 p-2 text-sm">📴 offline {plan && <button className="underline" onClick={() => setView({ k: "plan" })}>→ {ui("plan", lang)}</button>}</p>
      )}
      {builder.busy && <div className="mb-2"><Spinner label={builder.busy} /></div>}
      {builder.err && <div className="mb-2"><ErrorNote msg={builder.err} /></div>}

      {view.k === "home" && (
        <Home lang={lang} registry={registry} hasPlan={!!plan} onOpenPlan={() => setView({ k: "plan" })}
          onTalk={() => { newSession(); setView({ k: "chat" }); }} onTile={(id) => setView({ k: "module", id })} />
      )}
      {view.k === "chat" && (
        <>
          <label className="no-print mb-2 flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={useCline} onChange={(e) => setUseCline(e.target.checked)} /> 🤖 Let the Cline agent orchestrate the plan (Workflow C)
          </label>
          <ChatScreen lang={lang} profile={profile} setProfile={setProfile}
            onBuildPlan={(intents, utt) => builder.build(profile, intents, utt, useCline)} />
        </>
      )}
      {view.k === "module" && (
        <ModuleScreen key={view.id} id={view.id} tier={registry.find((m) => m.id === view.id)?.tier} lang={lang} profile={profile}
          onAddToPlan={(r) => builder.addResult(profile, plan, r)} />
      )}
      {view.k === "plan" && (plan
        ? <ActionPlanView plan={plan} lang={lang} registry={registry} offline={offline} />
        : <Btn onClick={() => setView({ k: "chat" })}>🎤 {ui("tagline", lang)}</Btn>)}
      {view.k === "cline" && <ClinePanel health={health} />}
    </div>
  );
}
