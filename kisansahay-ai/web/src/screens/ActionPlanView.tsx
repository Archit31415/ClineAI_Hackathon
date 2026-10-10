import { useState } from "react";
import type { ActionPlan, ClaimBody, Lang, ModuleRegistryEntry } from "@kisansahay/contracts/types";
import { Btn, Card, ErrorNote, ProvenanceBadge } from "../components/common";
import { ResultCard } from "../components/results/ResultCard";
import { api } from "../lib/api";
import { pick, ui } from "../lib/i18n";
import { store } from "../lib/store";
import { PlanChecklist } from "./PlanChecklist";

export function ActionPlanView({ plan, lang, registry, offline }: { plan: ActionPlan; lang: Lang; registry: ModuleRegistryEntry[]; offline: boolean }) {
  const [ticks, setTicks] = useState<Record<string, boolean>>(store.ticks());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const claim = plan.results.find((r) => r.module === "claim")?.body as ClaimBody | undefined;
  // hours_left is computed server-side with the injectable clock (DEMO_NOW), so demos are reproducible.
  const hours = claim && !claim.deadline.expired && claim.deadline.hours_left > 0 ? claim.deadline.hours_left : undefined;
  const tick = (id: string) => { const t = { ...ticks, [id]: !ticks[id] }; setTicks(t); store.setTicks(t); };

  async function dossier(kind: "pdf" | "wa") {
    setBusy(true); setErr("");
    try {
      const d = await api.dossier(plan);
      if (kind === "pdf") {
        const a = document.createElement("a");
        a.href = `data:application/pdf;base64,${d.pdf_base64}`;
        a.download = `kisansahay-plan-${plan.generated_at.slice(0, 10)}.pdf`;
        a.click();
      } else if (navigator.share) {
        await navigator.share({ text: d.whatsapp_text }).catch(() => window.open(d.whatsapp_link, "_blank"));
      } else {
        window.open(d.whatsapp_link, "_blank");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {offline && <p className="rounded-xl bg-amber-100 p-3 text-amber-900">📴 {ui("offline", lang)}</p>}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold">📋 {ui("plan", lang)}</h2>
          <ProvenanceBadge p={plan.provenance} />
        </div>
        <p className="text-xs text-stone-500">{plan.generated_at.replace("T", " ").slice(0, 16)} IST</p>
        {hours !== undefined && (
          <div className="mt-3 rounded-xl bg-red-600 p-3 text-center text-white">
            <span className="text-4xl font-bold">{hours}</span> <span className="text-lg">{ui("hours_left", lang)}</span>
          </div>
        )}
        {plan.explanation && <p className="mt-3 rounded-lg bg-sky-50 p-2 text-sm">🤖 {pick(plan.explanation, lang)}</p>}
        <PlanChecklist plan={plan} lang={lang} ticks={ticks} tick={tick} />
        <div className="no-print mt-4 grid grid-cols-3 gap-2">
          <Btn disabled={busy || offline} onClick={() => dossier("wa")}>💬 {ui("share_wa", lang)}</Btn>
          <Btn kind="ghost" disabled={busy || offline} onClick={() => dossier("pdf")}>📄 {ui("download_pdf", lang)}</Btn>
          <Btn kind="ghost" onClick={() => window.print()}>🖨 {ui("print", lang)}</Btn>
        </div>
        {err && <div className="mt-2"><ErrorNote msg={err} /></div>}
        <p className="mt-3 text-xs text-stone-500">{ui("disclaimer", lang)}</p>
      </Card>
      {plan.results.map((r) => (
        <ResultCard key={r.module} r={r} lang={lang} tier={registry.find((m) => m.id === r.module)?.tier} />
      ))}
    </div>
  );
}
