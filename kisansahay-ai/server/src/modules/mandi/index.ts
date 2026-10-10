/**
 * Mandi Advisor (Working). Comparison with stated assumptions — not a price forecast.
 */
import type { ActionItem, FarmerProfile, MandiBody, MandiInput, ModuleResult } from "@kisansahay/contracts";
import { envelope } from "../../lib/envelope";
import { locate } from "../../lib/geo";
import { t } from "../../lib/i18n";
import { readJson } from "../../lib/paths";
import { DATA_GOV_RESOURCE, fetchLive, loadSnapshot } from "./data";
import { compareMandis, recommend, trendFor, WAIT_DAY_CAP, type MandiPoint } from "./logic";
import { headlineText, reasonText } from "./text";

interface MandisFile {
  mandis: (MandiPoint & { state: string })[];
  msp: Record<string, { price: number; season: string } | string>;
}

export async function runMandi(profile: FarmerProfile, input?: Partial<MandiInput>): Promise<ModuleResult<MandiBody>> {
  const commodity = (input?.commodity ?? profile.stock_to_sell?.[0]?.commodity ?? profile.crops?.[0] ?? "").toLowerCase();
  const quintals = input?.quintals ?? profile.stock_to_sell?.[0]?.quintals ?? 0;
  const rate = Number(process.env.TRANSPORT_RATE_PER_Q_KM || 2);
  const state = profile.state ?? "Uttar Pradesh";
  const file = readJson<MandisFile>("mandi", "mandis.json");
  const mandis = file.mandis.filter((m) => m.state === state);
  const origin = locate(profile) ?? (mandis[0] ? { lat: mandis[0].lat, lng: mandis[0].lng } : undefined);

  if (!commodity || !quintals || !origin) {
    const missing = [!commodity && "commodity", !quintals && "quintals", !origin && "district"].filter(Boolean) as string[];
    return envelope({
      module: "mandi", status: "needs_info",
      headline: t("Which crop do you want to sell, and how much?", "कौन सी फसल और कितनी बेचनी है?", "কোন শস্য আৰু কিমান বিক্ৰী কৰিব?"),
      body: {
        commodity, quintals, options: [], trend: { days: 0, change_pct: 0 }, recommendation: "compare",
        reason: t("Tell us which crop and how many quintals you want to sell.", "बताइए कौन सी फसल और कितने क्विंटल बेचना है।", "কোন শস্য আৰু কিমান কুইণ্টল বিক্ৰী কৰিব কওক।"),
        stale: true, assumptions: { transport_rate_per_q_km: rate },
      },
      disclaimer: "financial", missing_fields: missing,
    });
  }

  const live = await fetchLive(state, commodity);
  const stale = !live;
  const rows = (live ?? loadSnapshot()).filter((r) => r.commodity === commodity && r.state === state);
  const options = compareMandis(rows, mandis, origin, rate);
  const trend = options[0] ? trendFor(rows, options[0].mandi) : { days: 0, change_pct: 0 };
  const { recommendation, best } = recommend(options, trend, input?.storage_possible ?? true);
  const bestOpt = options.find((o) => o.mandi === best);
  const nearest = [...options].sort((a, b) => a.distance_km - b.distance_km)[0];

  const body: MandiBody = {
    commodity, quintals, options, trend, recommendation,
    reason: reasonText({ recommendation, bestOpt, nearest, trend, commodity, state, quintals }),
    stale, assumptions: { transport_rate_per_q_km: rate },
  };
  if (best) body.best_mandi = best;
  const msp = file.msp[commodity];
  if (msp && typeof msp === "object") body.msp = { price: msp.price, season: msp.season, source: String(file.msp._source) };

  const actions: ActionItem[] = [];
  if (recommendation === "sell_now" && bestOpt) {
    actions.push({ id: "mandi-sell", label: t(`Sell ${commodity} at ${bestOpt.mandi} (≈₹${bestOpt.net_per_q}/q net)`, `${commodity} ${bestOpt.mandi} में बेचें (≈₹${bestOpt.net_per_q}/क्विंटल शुद्ध)`, `${commodity} ${bestOpt.mandi} ত বিক্ৰী কৰক (≈₹${bestOpt.net_per_q}/কুইণ্টল নিকা)`), kind: "visit", priority: 2 });
  } else if (recommendation === "wait") {
    actions.push({ id: "mandi-wait", label: t(`Store safely and re-check prices in ${WAIT_DAY_CAP} days`, `सुरक्षित रखें और ${WAIT_DAY_CAP} दिन में फिर भाव देखें`, `নিৰাপদে ৰাখক আৰু ${WAIT_DAY_CAP} দিনত আকৌ দাম চাওক`), kind: "wait", priority: 3 });
  } else {
    actions.push({ id: "mandi-compare", label: t("Call 2–3 nearby mandis for today's price", "आज का भाव जानने के लिए 2–3 नज़दीकी मंडियों में फ़ोन करें", "আজিৰ দাম জানিবলৈ ২–৩ টা ওচৰৰ মাণ্ডীলৈ ফোন কৰক"), kind: "call", priority: 3 });
  }

  const latest = options.map((o) => o.price_date).sort().pop() ?? "";
  return envelope({
    module: "mandi",
    status: options.length ? (stale ? "degraded" : "ok") : "needs_info",
    headline: headlineText(recommendation, bestOpt),
    body,
    actions,
    sources: [{
      label: stale ? `Snapshot CSV (illustrative) — price date ${latest}` : "data.gov.in daily mandi prices",
      url: `https://data.gov.in/resource/${DATA_GOV_RESOURCE}`, as_of: latest,
    }],
    confidence: stale ? 0.5 : 0.75,
    provenance: stale ? "cached" : "live",
    disclaimer: "financial",
  });
}
