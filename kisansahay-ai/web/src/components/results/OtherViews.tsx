import type { AdvisoryBody, CropDoctorBody, Lang, LivestockBody, MandiBody } from "@kisansahay/contracts/types";
import { pick } from "../../lib/i18n";

export function MandiView({ b, lang }: { b: MandiBody; lang: Lang }) {
  return (
    <div className="space-y-2">
      {b.stale && <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">⚠️ Snapshot data (stale) — price date {b.options[0]?.price_date}</p>}
      <p className="text-base">{pick(b.reason, lang)}</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-stone-500"><th>Mandi</th><th>km</th><th>₹/q</th><th>−transport</th><th>net</th></tr></thead>
        <tbody>
          {b.options.map((o) => (
            <tr key={o.mandi} className={`border-t ${o.mandi === b.best_mandi ? "bg-green-50 font-semibold" : ""}`}>
              <td>{o.mandi}</td><td>{o.distance_km}</td><td>{o.modal_price}</td><td>{o.transport_cost_per_q}</td><td>{o.net_per_q}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-stone-500">
        Trend ({b.trend.days}d at best mandi): {b.trend.change_pct > 0 ? "+" : ""}{b.trend.change_pct}% · Assumption: transport ₹{b.assumptions.transport_rate_per_q_km}/q/km
        {b.msp && ` · MSP ref ₹${b.msp.price} (${b.msp.season})`}
      </p>
    </div>
  );
}

export function CropDoctorView({ b, lang }: { b: CropDoctorBody; lang: Lang }) {
  return (
    <div className="space-y-2">
      {b.photo_quality === "poor" && <p className="rounded bg-amber-50 p-2 text-sm">📷 Photo unclear — retake in daylight</p>}
      {b.candidates.map((c, i) => (
        <div key={c.id} className="rounded-xl ring-1 ring-stone-200 p-3">
          <div className="flex justify-between"><b>{i + 1}. {pick(c.name, lang)}</b><span className="text-sm text-stone-500">{Math.round(c.confidence * 100)}%</span></div>
          <p className="text-sm text-stone-600">👁 {pick(c.why, lang)}</p>
          <p className="text-sm">✔ {pick(c.confirm_by, lang)}</p>
          <p className="text-sm text-green-800">🛡 {pick(c.safe_steps, lang)}</p>
          {c.advisory_source && <a className="text-xs text-sky-700 underline" href={c.advisory_source.url} target="_blank" rel="noreferrer">{c.advisory_source.label}</a>}
        </div>
      ))}
      {b.escalate && <p className="rounded bg-sky-50 p-2 text-sm">👩‍🌾 Show the crop to the KVK / agriculture officer before spraying.</p>}
    </div>
  );
}

export function LivestockView({ b, lang }: { b: LivestockBody; lang: Lang }) {
  const color = { vet_now: "bg-red-600", vet_within_24h: "bg-amber-500", monitor: "bg-green-600" }[b.triage];
  return (
    <div className="space-y-2">
      <div className={`rounded-xl p-3 text-center text-xl font-bold text-white ${color}`}>{b.triage.replace(/_/g, " ").toUpperCase()}</div>
      {b.notifiable_suspect && <p className="rounded bg-red-50 p-2 font-semibold text-red-800">⚠️ Possible notifiable disease — inform the veterinary officer</p>}
      {b.red_flags.length > 0 && <p className="text-sm">🚩 {b.red_flags.map((f) => pick(f, lang)).join(" · ")}</p>}
      {b.possible_conditions.length > 0 && <p className="text-sm text-stone-600">Possible: {b.possible_conditions.map((c) => `${pick(c.name, lang)} (${Math.round(c.confidence * 100)}%)`).join(", ")}</p>}
      <ul className="text-sm">{b.do_now.map((d, i) => <li key={i}>✅ {pick(d, lang)}</li>)}</ul>
      <ul className="text-sm text-red-800">{b.do_not.map((d, i) => <li key={i}>🚫 {pick(d, lang)}</li>)}</ul>
    </div>
  );
}

export function AdvisoryView({ b, lang }: { b: AdvisoryBody; lang: Lang }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-600">Crop stage: <b>{b.crop_stage}</b></p>
      {b.nudges.map((n) => (
        <p key={n.rule_id} className={`rounded p-2 text-sm ${n.severity === "act" ? "bg-red-50 text-red-900" : n.severity === "watch" ? "bg-amber-50" : "bg-stone-50"}`}>
          {n.severity === "act" ? "⛔" : n.severity === "watch" ? "👀" : "ℹ️"} {pick(n.text, lang)}
        </p>
      ))}
      <div className="flex gap-1 overflow-x-auto text-center text-xs">
        {b.forecast.slice(0, 7).map((d) => (
          <div key={d.date} className="min-w-14 rounded bg-sky-50 p-1">
            <div>{d.date.slice(5)}</div><div>{d.rain_mm > 5 ? "🌧" : d.rain_mm > 0.5 ? "🌦" : "☀️"}</div>
            <div>{Math.round(d.rain_mm)}mm</div><div>{Math.round(d.tmax)}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}
