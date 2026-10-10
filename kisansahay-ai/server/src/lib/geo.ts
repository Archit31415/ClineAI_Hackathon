import type { FarmerProfile } from "@kisansahay/contracts";
import { centroid } from "../geo/gazetteer";
import { readJson } from "./paths";

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Districts = Record<string, Record<string, { lat: number; lng: number }>>;

/**
 * GPS if consented, else district centroid, else undefined.
 * Centroids: the hand-checked demo table (data/geo/districts.json) first, then the all-India
 * gazetteer (data/geo/india.json, Wikidata) for every other district.
 */
export function locate(profile: FarmerProfile): { lat: number; lng: number; source: "gps" | "district" } | undefined {
  if (profile.gps && profile.consent_gps) return { ...profile.gps, source: "gps" };
  const d = readJson<Districts>("geo", "districts.json");
  const st = profile.state && d[profile.state];
  if (st && profile.district) {
    const key = Object.keys(st).find((k) => k.toLowerCase() === profile.district!.toLowerCase());
    if (key) return { ...st[key], source: "district" };
  }
  const g = centroid(profile.state, profile.district);
  if (g && (profile.district || !st)) return { ...g, source: "district" };
  if (st) {
    const first = Object.values(st)[0];
    if (first) return { ...first, source: "district" };
  }
  return g ? { ...g, source: "district" } : undefined;
}
