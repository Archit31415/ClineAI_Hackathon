import { useState } from "react";
import type { Lang, SoilBody } from "@kisansahay/contracts/types";
import { pick, ui } from "../../lib/i18n";

/** Confirm table: values below 0.7 OCR confidence are highlighted; edits re-run the deterministic bands. */
export function SoilView({ b, lang, onConfirm }: { b: SoilBody; lang: Lang; onConfirm?: (values: Record<string, number>) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(b.parsed.map((p) => [p.param, String(p.value)])));
  const rating = (p: string) => b.ratings.find((r) => r.param === p);
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-stone-500"><th>Param</th><th>Value</th><th>Rating</th></tr></thead>
        <tbody>
          {b.parsed.map((p) => (
            <tr key={p.param} className={`border-t ${p.ocr_confidence < 0.7 ? "bg-amber-50" : ""}`}>
              <td className="py-1 font-semibold">{p.param} <span className="text-xs text-stone-400">{p.unit}</span></td>
              <td>
                <input inputMode="decimal" value={vals[p.param] ?? ""} onChange={(e) => setVals({ ...vals, [p.param]: e.target.value })}
                  className={`w-20 rounded border px-1 ${p.ocr_confidence < 0.7 ? "border-amber-500" : "border-stone-300"}`} />
              </td>
              <td title={pick(rating(p.param)?.note, lang)}>{rating(p.param)?.band ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {onConfirm && (
        <button className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => onConfirm(Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== "" && !Number.isNaN(Number(v))).map(([k, v]) => [k, Number(v)])))}>
          ✓ {ui("confirm_values", lang)}
        </button>
      )}
      <ul className="space-y-1 text-sm">{b.ratings.map((r) => <li key={r.param}><b>{r.param}</b>: {pick(r.note, lang)}</li>)}</ul>
      <div className="rounded-xl bg-green-50 p-3">
        <h4 className="font-semibold">🌱 Plan ({b.plan.source.replace("_", " ")}, {b.plan.crop})</h4>
        <ul className="text-sm">{b.plan.items.map((i) => <li key={i.nutrient}>• <b>{i.nutrient}</b>: {pick(i.guidance, lang)}</li>)}</ul>
      </div>
    </div>
  );
}
