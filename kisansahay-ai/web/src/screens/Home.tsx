import type { Lang, ModuleId, ModuleRegistryEntry } from "@kisansahay/contracts/types";
import { Btn, Card, TierBadge } from "../components/common";
import { LANGS, MODULE_META, pick, ui } from "../lib/i18n";

export function LanguagePicker({ onPick }: { onPick: (l: Lang) => void }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4">
      <div className="text-6xl">🌾</div>
      <h1 className="text-3xl font-bold text-green-800">KisanSahay · किसान सहाय</h1>
      <p className="text-stone-600 text-center text-sm">Select your language · अपनी भाषा चुनें · আপোনাৰ ভাষা বাছক</p>
      <div className="grid w-full max-w-lg grid-cols-2 sm:grid-cols-3 gap-3">
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => onPick(l.id)} className="rounded-2xl bg-white p-4 text-center font-bold shadow ring-1 ring-stone-200 hover:ring-green-700 hover:bg-green-50 transition">
            <span className="text-xl block">{l.label}</span>
            <span className="block text-xs font-normal text-stone-500 mt-0.5">{l.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Consent({ lang, onAgree }: { lang: Lang; onAgree: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-md space-y-4">
      <h2 className="text-2xl font-bold">🔒 {ui("consent_title", lang)}</h2>
      <p className="text-lg leading-relaxed">{ui("consent_body", lang)}</p>
      <Btn className="w-full text-lg" onClick={onAgree}>✓ {ui("agree", lang)}</Btn>
    </Card>
  );
}

export function Home({ lang, registry, onTalk, onTile, hasPlan, onOpenPlan }: {
  lang: Lang; registry: ModuleRegistryEntry[]; onTalk: () => void; onTile: (id: ModuleId) => void; hasPlan: boolean; onOpenPlan: () => void;
}) {
  return (
    <div className="space-y-4">
      <button onClick={onTalk} className="flex w-full items-center gap-4 rounded-3xl bg-green-700 p-5 text-left text-white shadow-lg">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl">🎤</span>
        <span className="text-2xl font-bold">{ui("tagline", lang)}</span>
      </button>
      {hasPlan && <Btn kind="ghost" className="w-full" onClick={onOpenPlan}>📋 {ui("plan", lang)}</Btn>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {registry.map((m) => (
          <button key={m.id} disabled={!m.enabled} onClick={() => onTile(m.id)}
            className={`flex flex-col items-start gap-1 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 ${m.enabled ? "hover:ring-green-700" : "opacity-40"}`}>
            <span className="text-4xl">{MODULE_META[m.id].icon}</span>
            <span className="text-lg font-bold leading-tight">{pick(MODULE_META[m.id].name, lang)}</span>
            {m.enabled ? <TierBadge tier={m.tier} lang={lang} /> : <span className="text-xs">{ui("coming_soon", lang)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
