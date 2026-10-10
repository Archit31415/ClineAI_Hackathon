import type { ClaimBody, Lang } from "@kisansahay/contracts/types";
import { pick, ui } from "../../lib/i18n";

export function ClaimView({ b, lang }: { b: ClaimBody; lang: Lang }) {
  const { deadline } = b;
  return (
    <div className="space-y-3">
      {deadline.hours_left > 0 && !deadline.expired && (
        <div className="rounded-xl bg-red-600 p-4 text-center text-white">
          <div className="text-5xl font-bold">{deadline.hours_left}</div>
          <div className="text-lg">{ui("hours_left", lang)} · {deadline.due_at.slice(0, 16).replace("T", " ")}</div>
        </div>
      )}
      {b.expired_message && <p className="rounded-xl bg-red-50 p-3 font-semibold text-red-800">{pick(b.expired_message, lang)}</p>}
      <div>
        <h4 className="font-semibold">📷 Evidence</h4>
        <ul className="mt-1 space-y-1">
          {b.evidence_checklist.map((e) => (
            <li key={e.shot_type} className={e.done ? "text-green-700" : ""}>{e.done ? "✅" : "⬜"} {pick(e.label, lang)}</li>
          ))}
        </ul>
      </div>
      <details className="rounded-xl bg-stone-50 p-3" open>
        <summary className="cursor-pointer font-semibold">📝 PMFBY loss intimation (draft · {b.intimation.provenance === "fixture" ? "cached run" : "Cline SDK"} · conf {b.intimation.confidence})</summary>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {Object.entries(b.intimation.form_values).map(([k, v]) => (
              <tr key={k} className="border-b border-stone-200">
                <td className="py-1 pr-2 text-stone-500">{k}</td>
                <td className={`py-1 ${v === null ? "text-red-600" : ""}`}>{v === null ? "— missing" : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {b.intimation.errors.map((e) => <p key={e.field} className="mt-1 text-sm text-red-700">✗ {e.message}</p>)}
        {b.intimation.warnings.map((w, i) => <p key={i} className="mt-1 text-sm text-amber-700">⚠ {w.field}: {w.message}</p>)}
        <p className="mt-2 text-xs text-stone-500">Not submitted anywhere. Take this to your bank / insurer / agriculture office.</p>
      </details>
      <div>
        <h4 className="font-semibold">📞 Where to report</h4>
        <ul className="mt-1 space-y-1 text-sm">
          {b.channels.map((c, i) => <li key={i}><b>{pick(c.label, lang)}:</b> {c.value}</li>)}
        </ul>
      </div>
    </div>
  );
}
