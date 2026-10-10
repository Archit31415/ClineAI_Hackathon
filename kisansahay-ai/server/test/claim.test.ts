import { describe, expect, it } from "vitest";
import type { ClaimBody } from "@kisansahay/contracts";
import { loadForm } from "../src/cline/fill";
import { validateForm, type FormSchema } from "../src/cline/validators";
import { runModule } from "../src/modules/registry";
import { personas } from "./helpers";

describe("claim assistant", () => {
  it("Anita: 61 hours left, evidence checklist, intimation drafted via Workflow B (fixture)", async () => {
    const r = await runModule("claim", personas().anita.profile, { evidence: [] });
    const b = r.body as ClaimBody;
    expect(b.deadline.hours_left).toBe(61);
    expect(b.evidence_checklist.map((e) => e.shot_type)).toEqual(["wide", "close", "other", "boundary"]);
    expect(b.intimation.provenance).toBe("fixture");
    expect(b.intimation.form_values.cause_of_loss).toBe("hail");
    expect(b.intimation.form_values.date_of_loss).toBe("2026-10-09");
    expect(b.intimation.form_values.survey_number).toBeNull();
    expect(b.intimation.errors.some((e) => e.field === "survey_number")).toBe(true);
    expect(b.intimation.warnings.some((w) => /bigha/.test(w.message))).toBe(true);
    expect(r.actions[0]).toMatchObject({ id: "claim-report", priority: 1, kind: "do_now" });
  });

  it("evidence marks checklist done (hashes/metadata only)", async () => {
    const ev = [{ image_data_url: "data:image/jpeg;base64,AAAA", captured_at: "2026-10-10T01:00:00+05:30", sha256: "x", shot_type: "wide" as const }];
    const b = (await runModule("claim", personas().anita.profile, { evidence: ev })).body as ClaimBody;
    expect(b.evidence_checklist.find((e) => e.shot_type === "wide")!.done).toBe(true);
  });

  it("expired window reads clearly", async () => {
    const p = { ...personas().anita.profile, loss_event: { type: "hail" as const, occurred_at: "2026-10-01T10:00:00+05:30" } };
    const b = (await runModule("claim", p, {})).body as ClaimBody;
    expect(b.deadline.expired).toBe(true);
    expect(b.expired_message?.en).toMatch(/Report anyway/);
  });
});

describe("Workflow B validators", () => {
  const schema = loadForm("pmfby_loss_intimation") as FormSchema;
  const base = { farmer_name: "A", state: "Assam", district: "Nagaon", crop: "paddy", season: "kharif", cause_of_loss: "hail", area_affected_ha: 0.27 };
  it("IFSC, survey number and future date are re-checked in code", () => {
    const { errors } = validateForm(schema, { ...base, date_of_loss: "2027-01-01", survey_number: "12//", bank_ifsc: "SBIN123" });
    const fields = errors.map((e) => e.field);
    expect(fields).toContain("bank_ifsc");
    expect(fields).toContain("survey_number");
    expect(fields).toContain("date_of_loss");
  });
  it("valid values pass", () => {
    const { errors } = validateForm(schema, { ...base, date_of_loss: "2026-10-09", survey_number: "123/4", bank_ifsc: "SBIN0001234" });
    expect(errors).toEqual([]);
  });
});
