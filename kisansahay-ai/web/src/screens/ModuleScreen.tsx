import { useState } from "react";
import type { FarmerProfile, Lang, ModuleId, ModuleResult, Tier } from "@kisansahay/contracts/types";
import { Btn, Card, ErrorNote, Spinner } from "../components/common";
import { ResultCard } from "../components/results/ResultCard";
import { api } from "../lib/api";
import { MODULE_META, pick, ui } from "../lib/i18n";
import { ModuleInputs } from "./ModuleInputs";

export function ModuleScreen({ id, tier, lang, profile, onAddToPlan }: {
  id: ModuleId; tier?: Tier; lang: Lang; profile: FarmerProfile; onAddToPlan: (r: ModuleResult) => void;
}) {
  const [result, setResult] = useState<ModuleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(input: unknown) {
    setBusy(true);
    setErr("");
    try {
      setResult(await api.run(id, profile, input));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="mb-3 text-2xl font-bold">{MODULE_META[id].icon} {pick(MODULE_META[id].name, lang)}</h2>
        {!profile.district && <p className="mb-2 text-sm text-amber-700">Tip: talk to the assistant first so we know your district and crop.</p>}
        <ModuleInputs id={id} lang={lang} defaultCrop={profile.crops?.[0]} busy={busy} onRun={run} />
      </Card>
      {busy && <Spinner label="…" />}
      {err && <ErrorNote msg={err} />}
      {result && (
        <>
          <ResultCard r={result} lang={lang} tier={tier} onSoilConfirm={(values) => run({ values, crop: profile.crops?.[0] })} />
          <Btn className="w-full" onClick={() => onAddToPlan(result)}>📋 {ui("build_plan", lang)}</Btn>
        </>
      )}
    </div>
  );
}
