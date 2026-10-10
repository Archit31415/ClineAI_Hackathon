import type {
  AdvisoryBody, ClaimBody, CropDoctorBody, Lang, LivestockBody, MandiBody, ModuleResult, SchemesBody, SoilBody, Tier,
} from "@kisansahay/contracts/types";
import { MODULE_META, pick } from "../../lib/i18n";
import { Card, Disclaimer, PhotoNotice, ProvenanceBadge, Speak, TierBadge } from "../common";
import { ClaimView } from "./ClaimView";
import { AdvisoryView, CropDoctorView, LivestockView, MandiView } from "./OtherViews";
import { SchemesView } from "./SchemesView";
import { SoilView } from "./SoilView";

export function ResultCard({ r, lang, tier, onSoilConfirm }: {
  r: ModuleResult; lang: Lang; tier?: Tier; onSoilConfirm?: (v: Record<string, number>) => void;
}) {
  const meta = MODULE_META[r.module];
  const headline = pick(r.headline, lang);
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-2xl">{meta.icon}</span>
        <h3 className="text-lg font-bold">{pick(meta.name, lang)}</h3>
        <TierBadge tier={tier} lang={lang} />
        <ProvenanceBadge p={r.provenance} />
        {r.confidence !== undefined && <span className="text-xs text-stone-500">conf {r.confidence}</span>}
      </div>
      <p className="mb-3 text-xl font-semibold leading-snug">{headline} <Speak text={headline} lang={lang} /></p>
      <PhotoNotice photo={r.photo} lang={lang} />
      {r.module === "claim" && <ClaimView b={r.body as ClaimBody} lang={lang} />}
      {r.module === "schemes" && <SchemesView b={r.body as SchemesBody} lang={lang} />}
      {r.module === "soil_card" && <SoilView b={r.body as SoilBody} lang={lang} onConfirm={onSoilConfirm} />}
      {r.module === "mandi" && <MandiView b={r.body as MandiBody} lang={lang} />}
      {r.module === "crop_doctor" && <CropDoctorView b={r.body as CropDoctorBody} lang={lang} />}
      {r.module === "livestock" && <LivestockView b={r.body as LivestockBody} lang={lang} />}
      {r.module === "advisory" && <AdvisoryView b={r.body as AdvisoryBody} lang={lang} />}
      <Disclaimer r={r} lang={lang} />
      {r.sources.length > 0 && (
        <p className="mt-2 text-xs text-stone-400">Sources: {r.sources.slice(0, 3).map((s) => `${s.label} (${s.as_of})`).join(" · ")}</p>
      )}
    </Card>
  );
}
