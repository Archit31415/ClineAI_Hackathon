/**
 * Hyperlocal Advisory (Prototype): forecast + crop stage + sourced rules -> nudges.
 * "simulate_days_ahead" shifts the evaluation window for the demo ("simulate tomorrow").
 */
import type { ActionItem, AdvisoryBody, AdvisoryInput, FarmerProfile, I18n, ModuleResult } from "@kisansahay/contracts";
import { addDays, istDate, now } from "../../lib/clock";
import { envelope } from "../../lib/envelope";
import { locate } from "../../lib/geo";
import { t } from "../../lib/i18n";
import { readJson } from "../../lib/paths";
import { fetchForecast } from "./weather";

interface Calendar {
  _source: { label: string; url: string; verified_on: string };
  default_sowing: Record<string, Record<string, string>>;
  crops: Record<string, { stage: string; from: number; to: number }[]>;
}
type Cmp = { gte?: number; lte?: number; lt?: number; gt?: number; eq?: unknown; in?: string[] };
interface Rule { id: string; when: Record<string, Cmp>; severity: "info" | "watch" | "act"; text: I18n; source?: { label: string; url: string } }

export function cropStage(crop: string, sowingDate: string | undefined, season: string | undefined, at: Date): string {
  const cal = readJson<Calendar>("crops", "calendar.json");
  const stages = cal.crops[crop];
  if (!stages) return "unknown";
  let sow = sowingDate;
  if (!sow) {
    const def = cal.default_sowing[crop];
    const mmdd = def ? (season && def[season]) || Object.values(def)[0] : undefined;
    if (!mmdd) return "unknown";
    const y = Number(istDate(at).slice(0, 4));
    let d = new Date(`${y}-${mmdd}T00:00:00+05:30`);
    if (d > at) d = new Date(`${y - 1}-${mmdd}T00:00:00+05:30`);
    sow = d.toISOString();
  }
  const das = Math.floor((at.getTime() - new Date(sow).getTime()) / 86400000);
  return stages.find((s) => das >= s.from && das <= s.to)?.stage ?? (das < 0 ? "not_sown" : "post_harvest");
}

function cmp(v: unknown, c: Cmp): boolean {
  if (c.eq !== undefined && v !== c.eq) return false;
  if (c.in && !c.in.includes(String(v))) return false;
  const n = Number(v);
  if (c.gte !== undefined && !(n >= c.gte)) return false;
  if (c.gt !== undefined && !(n > c.gt)) return false;
  if (c.lte !== undefined && !(n <= c.lte)) return false;
  if (c.lt !== undefined && !(n < c.lt)) return false;
  return true;
}

export function evaluateAdvisory(forecast: AdvisoryBody["forecast"], stage: string, profile: FarmerProfile, startIdx = 0): AdvisoryBody["nudges"] {
  const rules = readJson<{ rules: Rule[] }>("crops", "advisory_rules.json").rules;
  const window = forecast.slice(startIdx);
  if (!window.length) return [];
  const facts: Record<string, unknown> = {
    rain_mm_48h: Math.round(((window[0]?.rain_mm ?? 0) + (window[1]?.rain_mm ?? 0) + (window[2]?.rain_mm ?? 0)) * 10) / 10,
    tmax: Math.max(...window.slice(0, 3).map((d) => d.tmax)),
    tmin: Math.min(...window.slice(0, 3).map((d) => d.tmin)),
    wind_kmph: Math.max(...window.slice(0, 2).map((d) => d.wind_kmph)),
    stage,
    has_loss_event: !!profile.loss_event,
  };
  const out: AdvisoryBody["nudges"] = [];
  for (const r of rules) {
    if (!Object.entries(r.when).every(([k, c]) => cmp(facts[k], c))) continue;
    out.push({ date: window[0].date, severity: r.source ? r.severity : "info", text: r.text, rule_id: r.id });
  }
  const order = { act: 0, watch: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export async function runAdvisory(profile: FarmerProfile, input: AdvisoryInput = {}): Promise<ModuleResult<AdvisoryBody>> {
  const loc = locate(profile);
  const crop = profile.crops?.[0] ?? "";
  if (!loc || !crop) {
    return envelope({
      module: "advisory", status: "needs_info", headline: t("Tell us your district and crop for local weather advice", "स्थानीय मौसम सलाह के लिए ज़िला और फसल बताइए", "স্থানীয় বতৰৰ পৰামৰ্শৰ বাবে জিলা আৰু শস্য কওক"),
      body: { crop_stage: "unknown", forecast: [], nudges: [] }, missing_fields: [!loc ? "district" : "", !crop ? "crops" : ""].filter(Boolean),
    });
  }
  const shift = input.simulate_days_ahead ?? 0;
  const at = addDays(now(), shift);
  const { forecast, provenance } = await fetchForecast(loc.lat, loc.lng);
  const todayIdx = Math.max(0, forecast.findIndex((d) => d.date >= istDate(at)));
  const stage = cropStage(crop, profile.sowing_date, profile.season, at);
  const nudges = evaluateAdvisory(forecast, stage, profile, todayIdx);
  const cal = readJson<Calendar>("crops", "calendar.json");

  const actions: ActionItem[] = nudges.filter((n) => n.severity !== "info").map((n) => ({
    id: `advisory-${n.rule_id}`, label: n.text, kind: n.severity === "act" ? "do_now" : "info", priority: n.severity === "act" ? 2 : 3,
  }));
  const top = nudges[0];
  return envelope({
    module: "advisory",
    status: "ok",
    headline: top ? top.text : t("No weather risks for your crop in the next 2 days", "अगले 2 दिनों में आपकी फसल के लिए मौसम का कोई खतरा नहीं", "পিছৰ ২ দিনত আপোনাৰ শস্যৰ বাবে বতৰৰ কোনো বিপদ নাই"),
    body: { crop_stage: stage, forecast, nudges },
    actions,
    sources: [
      { label: provenance === "live" ? "Open-Meteo forecast" : "Cached forecast", url: "https://open-meteo.com", as_of: forecast[0]?.date ?? "" },
      { label: cal._source.label, url: cal._source.url, as_of: cal._source.verified_on },
    ],
    confidence: 0.6,
    provenance,
    disclaimer: "agrochemical",
  });
}
