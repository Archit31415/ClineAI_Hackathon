/**
 * Mandi Advisor pure logic: net-of-transport comparison, trend, recommendation. No network here.
 */
import type { MandiBody } from "@kisansahay/contracts";
import { haversineKm } from "../../lib/geo";
import type { PriceRow } from "./data";

export interface MandiPoint { name: string; lat: number; lng: number; district: string }

export const SELL_THRESHOLD_PER_Q = 40; // best net must beat nearest by > ₹40/q to recommend travelling
export const WAIT_TREND_PCT = 2; // rising > 2% over the window and storage possible -> wait
export const WAIT_DAY_CAP = 5;

export function compareMandis(
  rows: PriceRow[],
  mandis: MandiPoint[],
  origin: { lat: number; lng: number },
  ratePerQKm: number,
): MandiBody["options"] {
  const latestByMarket = new Map<string, PriceRow>();
  for (const r of rows) {
    const cur = latestByMarket.get(r.market);
    if (!cur || r.arrival_date > cur.arrival_date) latestByMarket.set(r.market, r);
  }
  const opts: MandiBody["options"] = [];
  for (const [market, row] of latestByMarket) {
    const m = mandis.find((x) => x.name.toLowerCase() === market.toLowerCase())
      ?? mandis.find((x) => x.district.toLowerCase() === row.district.toLowerCase());
    if (!m) continue;
    const distance_km = Math.round(haversineKm(origin, m) * 1.25); // road factor
    const transport = Math.round(distance_km * ratePerQKm);
    opts.push({
      mandi: market,
      distance_km,
      modal_price: row.modal_price,
      transport_cost_per_q: transport,
      net_per_q: row.modal_price - transport,
      price_date: row.arrival_date,
    });
  }
  return opts.sort((a, b) => b.net_per_q - a.net_per_q);
}

export function trendFor(rows: PriceRow[], market: string): MandiBody["trend"] {
  const series = rows.filter((r) => r.market === market).sort((a, b) => a.arrival_date.localeCompare(b.arrival_date));
  if (series.length < 2) return { days: series.length, change_pct: 0 };
  const first = series[0].modal_price;
  const last = series[series.length - 1].modal_price;
  return { days: series.length, change_pct: Math.round(((last - first) / first) * 1000) / 10 };
}

export function recommend(
  options: MandiBody["options"],
  trend: MandiBody["trend"],
  storagePossible: boolean,
): { recommendation: MandiBody["recommendation"]; best?: string } {
  if (options.length < 2 || trend.days < 3) return { recommendation: "compare", best: options[0]?.mandi };
  const best = options[0];
  const nearest = [...options].sort((a, b) => a.distance_km - b.distance_km)[0];
  if (storagePossible && trend.change_pct > WAIT_TREND_PCT) return { recommendation: "wait", best: best.mandi };
  if (best.net_per_q - nearest.net_per_q > SELL_THRESHOLD_PER_Q || best.mandi === nearest.mandi) {
    return { recommendation: "sell_now", best: best.mandi };
  }
  return { recommendation: "sell_now", best: nearest.mandi };
}
