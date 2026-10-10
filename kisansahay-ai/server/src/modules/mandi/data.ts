/**
 * Mandi price data: data.gov.in live feed (API key) with snapshot CSV fallback (stale:true).
 * Resource: "Current Daily Price of Various Commodities from Various Markets (Mandi)" — verify id/fields.
 */
import { readFileSync } from "node:fs";
import { dataPath } from "../../lib/paths";

export interface PriceRow {
  state: string;
  district: string;
  market: string;
  commodity: string;
  arrival_date: string; // YYYY-MM-DD
  modal_price: number;
}

export const DATA_GOV_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";

export function loadSnapshot(): PriceRow[] {
  const lines = readFileSync(dataPath("mandi", "snapshot.csv"), "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const idx = (k: string) => header.indexOf(k);
  return lines.slice(1).map((l) => {
    const c = l.split(",");
    return {
      state: c[idx("state")],
      district: c[idx("district")],
      market: c[idx("market")],
      commodity: c[idx("commodity")].toLowerCase(),
      arrival_date: c[idx("arrival_date")],
      modal_price: Number(c[idx("modal_price")]),
    };
  });
}

/** dd/mm/yyyy -> yyyy-mm-dd */
function normDate(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

export async function fetchLive(state: string, commodity: string): Promise<PriceRow[] | null> {
  const key = process.env.DATA_GOV_IN_API_KEY;
  const mode = process.env.MANDI_MODE ?? "auto";
  if (!key || mode === "snapshot") return null;
  const url = new URL(`https://api.data.gov.in/resource/${DATA_GOV_RESOURCE}`);
  url.searchParams.set("api-key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "500");
  url.searchParams.set("filters[state]", state);
  url.searchParams.set("filters[commodity]", commodity.charAt(0).toUpperCase() + commodity.slice(1));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { records?: Record<string, string>[] };
    const rows = (j.records ?? []).map((r) => ({
      state: r.state,
      district: r.district,
      market: r.market,
      commodity: String(r.commodity).toLowerCase(),
      arrival_date: normDate(r.arrival_date),
      modal_price: Number(r.modal_price),
    })).filter((r) => Number.isFinite(r.modal_price) && r.modal_price > 0);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}
