import { describe, expect, it } from "vitest";
import type { AdvisoryBody, CropDoctorBody, LivestockBody, MandiBody, SoilBody } from "@kisansahay/contracts";
import { toHectares } from "../src/interview/units";
import { evaluateAdvisory } from "../src/modules/advisory";
import { compareMandis, recommend } from "../src/modules/mandi/logic";
import { runModule } from "../src/modules/registry";
import { personas } from "./helpers";

describe("soil card", () => {
  it("bands come from data; state table plan; edited value changes rating", async () => {
    const p = personas().ramesh;
    const b = (await runModule("soil_card", p.profile, { values: p.soil_values, crop: "wheat" })).body as SoilBody;
    expect(b.ratings.find((r) => r.param === "N")!.band).toBe("low");
    expect(b.plan.source).toBe("state_table");
    const b2 = (await runModule("soil_card", p.profile, { values: { ...p.soil_values, N: 600 }, crop: "wheat" })).body as SoilBody;
    expect(b2.ratings.find((r) => r.param === "N")!.band).toBe("high");
  });
  it("no table for state -> refers to agriculture office", async () => {
    const b = (await runModule("soil_card", { lang: "en", state: "Assam", crops: ["paddy"] }, { values: { N: 200 } })).body as SoilBody;
    expect(b.plan.source).toBe("none");
  });
});

describe("mandi", () => {
  it("snapshot path is labelled stale and shows price date; net = modal - transport", async () => {
    const b = (await runModule("mandi", personas().ramesh.profile, { commodity: "wheat", quintals: 20 })).body as MandiBody;
    expect(b.stale).toBe(true);
    expect(b.options.length).toBeGreaterThan(2);
    expect(b.options[0].price_date).toBe("2026-10-08");
    expect(b.reason.en).toMatch(/not a price forecast/);
    for (const o of b.options) expect(o.net_per_q).toBe(o.modal_price - o.transport_cost_per_q);
  });
  it("recommendation rules", () => {
    const rows = [
      { state: "X", district: "A", market: "A", commodity: "wheat", arrival_date: "2026-10-08", modal_price: 2000 },
      { state: "X", district: "B", market: "B", commodity: "wheat", arrival_date: "2026-10-08", modal_price: 2300 },
    ];
    const opts = compareMandis(rows, [{ name: "A", district: "A", lat: 0, lng: 0 }, { name: "B", district: "B", lat: 0.2, lng: 0 }], { lat: 0, lng: 0 }, 2);
    expect(opts[0].mandi).toBe("B");
    expect(recommend(opts, { days: 7, change_pct: 0 }, true)).toEqual({ recommendation: "sell_now", best: "B" });
    expect(recommend(opts, { days: 7, change_pct: 5 }, true).recommendation).toBe("wait");
    expect(recommend(opts.slice(0, 1), { days: 7, change_pct: 0 }, true).recommendation).toBe("compare");
  });
});

describe("triage safety", () => {
  it("livestock: fever + nodules -> vet_now, isolate, notifiable", async () => {
    const k = personas().kamal;
    const b = (await runModule("livestock", k.profile, k.livestock_input)).body as LivestockBody;
    expect(b.triage).toBe("vet_now");
    expect(b.isolate).toBe(true);
    expect(b.notifiable_suspect).toBe(true);
    expect(b.possible_conditions[0].id).toBe("lsd");
  });
  it("livestock red flag alone forces vet_now", async () => {
    const b = (await runModule("livestock", { lang: "en" }, { species: "cattle", features: ["cannot_stand"] })).body as LivestockBody;
    expect(b.triage).toBe("vet_now");
  });
  it("crop: entry without advisory_source gives no treatment steps", async () => {
    const b = (await runModule("crop_doctor", { lang: "en", crops: ["paddy"] }, { features: ["brown_oval_spots", "yellow_halo"] })).body as CropDoctorBody;
    expect(b.candidates[0].id).toBe("brown_spot");
    expect(b.candidates[0].advisory_source).toBeUndefined();
    expect(b.candidates[0].safe_steps.en).toMatch(/Ask the agriculture officer/);
  });
  it("crop: poor photo with no symptoms asks for retake", async () => {
    const r = await runModule("crop_doctor", { lang: "en" }, { image_data_url: "data:image/jpeg;base64,AAAA" });
    expect((r.body as CropDoctorBody).photo_quality).toBe("poor");
    expect(r.status).toBe("needs_info");
  });
  it("crop: keyword path from typed Hindi symptoms", async () => {
    const b = (await runModule("crop_doctor", { lang: "hi", crops: ["wheat"] }, { symptoms_text: "पत्तियों पर नारंगी पाउडर, पीली धारियाँ" })).body as CropDoctorBody;
    expect(b.candidates[0].id).toBe("wheat_rust");
  });
});

describe("advisory", () => {
  it("rain in 48h at tillering -> delay spray (act)", () => {
    const fc = [0, 6, 12, 0].map((r, i) => ({ date: `2026-10-1${i}`, rain_mm: r, tmax: 30, tmin: 20, wind_kmph: 8 }));
    const n = evaluateAdvisory(fc, "tillering", { lang: "en" });
    expect(n[0]).toMatchObject({ rule_id: "delay_spray_rain", severity: "act" });
  });
  it("module returns forecast + stage from cache/demo", async () => {
    const b = (await runModule("advisory", personas().anita.profile, {})).body as AdvisoryBody;
    expect(b.forecast.length).toBeGreaterThan(2);
    expect(b.crop_stage).not.toBe("unknown");
  });
});

describe("units", () => {
  it("Assam bigha differs from UP bigha and always needs confirm", () => {
    expect(toHectares(2, "bigha", "Assam")).toMatchObject({ hectares: 0.27, confirm: true });
    expect(toHectares(2, "बीघा", "Uttar Pradesh")!.hectares).toBe(0.51);
    expect(toHectares(1.2, "hectare")).toMatchObject({ hectares: 1.2, confirm: false });
  });
});

describe("module gating", () => {
  it("unknown module 404s", async () => {
    await expect(runModule("nope", { lang: "en" })).rejects.toMatchObject({ statusCode: 404 });
  });
});
