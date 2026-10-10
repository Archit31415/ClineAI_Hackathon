/**
 * Open-Meteo forecast (no key) with on-disk cache + synthetic offline fallback.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AdvisoryBody } from "@kisansahay/contracts";
import { addDays, istDate, now } from "../../lib/clock";
import { dataPath } from "../../lib/paths";

type Forecast = AdvisoryBody["forecast"];

function cacheFile(lat: number, lng: number) {
  return dataPath("weather", "cache", `${lat.toFixed(2)}_${lng.toFixed(2)}.json`);
}

export async function fetchForecast(lat: number, lng: number): Promise<{ forecast: Forecast; provenance: "live" | "cached" }> {
  const mode = process.env.WEATHER_MODE ?? "auto";
  if (mode !== "cached") {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lng));
      url.searchParams.set("daily", "precipitation_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max");
      url.searchParams.set("timezone", "Asia/Kolkata");
      url.searchParams.set("forecast_days", "7");
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const j = (await res.json()) as { daily: { time: string[]; precipitation_sum: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; wind_speed_10m_max: number[] } };
        const d = j.daily;
        const forecast = d.time.map((date, i) => ({
          date, rain_mm: d.precipitation_sum[i] ?? 0, tmax: d.temperature_2m_max[i] ?? 0, tmin: d.temperature_2m_min[i] ?? 0, wind_kmph: d.wind_speed_10m_max[i] ?? 0,
        }));
        try {
          mkdirSync(dataPath("weather", "cache"), { recursive: true });
          writeFileSync(cacheFile(lat, lng), JSON.stringify({ fetched_at: new Date().toISOString(), forecast }));
        } catch { /* cache is best effort */ }
        return { forecast, provenance: "live" };
      }
    } catch { /* fall through */ }
  }
  const f = cacheFile(lat, lng);
  if (existsSync(f)) return { forecast: JSON.parse(readFileSync(f, "utf8")).forecast, provenance: "cached" };
  return { forecast: demoForecast(), provenance: "cached" };
}

/** Deterministic demo forecast (rain in 2 days) — used only when offline with no cache. */
export function demoForecast(): Forecast {
  const base = now();
  const rain = [0, 4, 18, 26, 6, 0, 0];
  return rain.map((r, i) => ({ date: istDate(addDays(base, i)), rain_mm: r, tmax: 31 - (r > 10 ? 3 : 0), tmin: 22, wind_kmph: 12 + (r > 20 ? 10 : 0) }));
}
