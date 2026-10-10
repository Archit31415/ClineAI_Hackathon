/**
 * Photo reading routed through Cline. The Cline SDK call is stubbed: tests never spend credits.
 * Live check: src/scripts/vision-smoke.ts (see README).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CropDoctorBody, LivestockBody, SoilBody } from "@kisansahay/contracts";
import { ModuleResultZ } from "@kisansahay/contracts";
import { runModule } from "../src/modules/registry";

const clineVisionJson = vi.fn();
vi.mock("../src/cline/vision", () => ({
  clineVisionJson: (o: unknown) => clineVisionJson(o),
  clineVisionModel: () => "test/vision-model",
  disposeClineVision: async () => undefined,
}));

// Large enough to pass the server's tiny-image heuristic (>15 KB).
const PHOTO = `data:image/jpeg;base64,${"A".repeat(24_000)}`;

afterEach(() => {
  delete process.env.VISION_PROVIDER;
  clineVisionJson.mockReset();
});

describe("vision via Cline", () => {
  it("livestock photo: Cline sees nodules -> red flag -> vet_now + notifiable; photo marked used", async () => {
    process.env.VISION_PROVIDER = "cline";
    clineVisionJson.mockResolvedValue({ features: ["skin_nodules", "made_up_feature"], photo_quality: "ok" });
    const r = await runModule("livestock", { lang: "en" }, { species: "cattle", image_data_url: PHOTO });
    const b = r.body as LivestockBody;
    expect(clineVisionJson).toHaveBeenCalledOnce();
    const call = clineVisionJson.mock.calls[0][0] as { imageDataUrl: string; system: string };
    expect(call.imageDataUrl).toBe(PHOTO);
    expect(call.system).toContain("skin_nodules (");
    expect(b.features_detected).toEqual(["skin_nodules"]); // off-vocab ids dropped
    expect(b.triage).toBe("vet_now");
    expect(b.notifiable_suspect).toBe(true);
    expect(r.photo).toMatchObject({ status: "used", provider: "cline", model: "test/vision-model" });
    expect(r.provenance).toBe("live");
    expect(ModuleResultZ.safeParse(r).success).toBe(true);
  });

  it("Cline failure: farmer is told the photo was not checked; typed symptoms still triaged", async () => {
    process.env.VISION_PROVIDER = "cline";
    clineVisionJson.mockResolvedValue(null);
    const r = await runModule("livestock", { lang: "en" }, { species: "cattle", image_data_url: PHOTO, features: ["cannot_stand"] });
    expect(r.photo?.status).toBe("failed");
    expect(r.photo?.notice.en).toMatch(/could not be checked/);
    expect((r.body as LivestockBody).triage).toBe("vet_now");
  });

  it("crop photo judged poor by the model -> retake prompt", async () => {
    process.env.VISION_PROVIDER = "cline";
    clineVisionJson.mockResolvedValue({ features: [], photo_quality: "poor" });
    const r = await runModule("crop_doctor", { lang: "en", crops: ["paddy"] }, { image_data_url: PHOTO });
    expect(r.status).toBe("needs_info");
    expect((r.body as CropDoctorBody).photo_quality).toBe("poor");
    expect(r.photo?.status).toBe("poor");
  });

  it("soil card OCR goes through Cline; bands still come from data", async () => {
    process.env.VISION_PROVIDER = "cline";
    clineVisionJson.mockResolvedValue({ values: [{ param: "N", value: 200, ocr_confidence: 0.6 }], printed_recommendation: [] });
    const r = await runModule("soil_card", { lang: "en", state: "Assam", crops: ["paddy"] }, { image_data_url: PHOTO });
    const b = r.body as SoilBody;
    expect(b.ratings.find((x) => x.param === "N")?.band).toBe("low");
    expect(b.confirmed).toBe(false);
    expect(r.missing_fields).toContain("confirm:N");
    expect(r.photo?.status).toBe("used");
  });

  it("no vision configured: no Cline call, photo marked not_setup (never silently ignored)", async () => {
    process.env.VISION_PROVIDER = "none";
    const r = await runModule("livestock", { lang: "en" }, { species: "cattle", image_data_url: PHOTO });
    expect(clineVisionJson).not.toHaveBeenCalled();
    expect(r.photo?.status).toBe("not_setup");
    expect(r.status).toBe("needs_info");
    const s = await runModule("soil_card", { lang: "en" }, { image_data_url: PHOTO });
    expect(s.photo?.status).toBe("not_setup");
    expect(s.provenance).toBe("live");
  });

  it("photo read but no known sign seen: honest notice, no guessed diagnosis", async () => {
    process.env.VISION_PROVIDER = "cline";
    clineVisionJson.mockResolvedValue({ features: [], photo_quality: "ok" });
    const r = await runModule("crop_doctor", { lang: "en", crops: ["paddy"] }, { image_data_url: PHOTO });
    expect(r.status).toBe("needs_info");
    expect((r.body as CropDoctorBody).candidates).toEqual([]);
    expect(r.photo?.notice.en).toMatch(/did not see any of the signs/);
  });

  it("text-only input never spends Cline vision", async () => {
    process.env.VISION_PROVIDER = "cline";
    await runModule("livestock", { lang: "en" }, { species: "cattle", symptoms_text: "fever and lumps on skin" });
    expect(clineVisionJson).not.toHaveBeenCalled();
  });
});
