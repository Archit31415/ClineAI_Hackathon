import type { Lang, SchemesBody } from "@kisansahay/contracts/types";
import { pick } from "../../lib/i18n";

const V = {
  eligible: "bg-green-100 text-green-800",
  likely: "bg-lime-100 text-lime-800",
  needs_info: "bg-amber-100 text-amber-800",
  not_eligible: "bg-stone-100 text-stone-500",
};

export function SchemesView({ b, lang }: { b: SchemesBody; lang: Lang }) {
  return (
    <div className="space-y-3">
      {b.stuck_payment && (
        <div className="rounded-xl bg-amber-50 p-3">
          <h4 className="font-semibold">🔎 PM-KISAN payment check</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {b.stuck_payment.checks.map((c) => (
              <li key={c.id}>
                {c.status === "ok" ? "✅" : c.status === "problem" ? "❌" : "❔"} {pick(c.label, lang)}
                {c.status !== "ok" && <div className="ml-6 text-amber-900">→ {pick(c.fix, lang)}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {b.results.filter((r) => r.verdict !== "not_eligible").map((r) => (
        <details key={r.scheme_id} className="rounded-xl ring-1 ring-stone-200 p-3">
          <summary className="flex cursor-pointer items-center justify-between gap-2">
            <span className="font-semibold">{pick(r.scheme_name, lang)}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${V[r.verdict]}`}>{r.verdict.replace("_", " ")}</span>
          </summary>
          <p className="mt-2 text-sm">{pick(r.benefit_summary, lang)}</p>
          <ul className="mt-2 text-sm text-stone-700">{(r.reasons[lang] ?? r.reasons.en).map((x, i) => <li key={i}>{x}</li>)}</ul>
          {r.explanation && <p className="mt-2 rounded bg-sky-50 p-2 text-sm text-sky-900">ℹ️ {pick(r.explanation, lang)}</p>}
          {r.stack_notes.map((n, i) => (
            <p key={i} className={`mt-1 text-sm ${n.relation === "conflicts" ? "text-red-700" : "text-green-800"}`}>
              {n.relation === "stacks" ? "🔗" : n.relation === "conflicts" ? "⛔" : "➡️"} {pick(n.note, lang)}
            </p>
          ))}
          {r.deadline && <p className="mt-1 text-sm text-red-700">⏰ {r.deadline.label}: {r.deadline.due_at.slice(0, 16).replace("T", " ")}</p>}
          <p className="mt-2 text-xs text-stone-500">📄 {r.documents.map((d) => pick(d.name, lang).split(" (")[0]).join(" · ")}</p>
          <a className="text-xs text-sky-700 underline" href={r.source.url} target="_blank" rel="noreferrer">source · verified {r.source.verified_on}</a>
        </details>
      ))}
      {b.conflicts.map((c, i) => <p key={i} className="text-sm text-red-700">⛔ {c.a} × {c.b}: {pick(c.note, lang)}</p>)}
    </div>
  );
}
