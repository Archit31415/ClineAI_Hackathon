import { describe, expect, it } from "vitest";
import { evaluateSchemes } from "../src/modules/schemes";
import { resolveDeadlines } from "../src/rules/deadlines";
import { evalCondition, evaluateRule } from "../src/rules/evaluate";
import { loadScheme, loadSchemes } from "../src/rules/load";
import { personas } from "./helpers";

const verdicts = (body: ReturnType<typeof evaluateSchemes>) => Object.fromEntries(body.results.map((r) => [r.scheme_id, r.verdict]));

describe("rule operators", () => {
  const f = { a: 5, s: "Owner", arr: ["paddy", "wheat"] };
  it.each([
    [{ field: "a", op: "gt", value: 4 }, "pass"],
    [{ field: "a", op: "lte", value: 4 }, "fail"],
    [{ field: "s", op: "eq", value: "owner" }, "pass"],
    [{ field: "s", op: "in", value: ["tenant", "owner"] }, "pass"],
    [{ field: "s", op: "not_in", value: ["owner"] }, "fail"],
    [{ field: "arr", op: "intersects", value: ["wheat"] }, "pass"],
    [{ field: "missing", op: "eq", value: 1 }, "unknown"],
    [{ field: "missing", op: "not_exists" }, "pass"],
    [{ field: "a", op: "exists" }, "pass"],
  ] as const)("%o -> %s", (c, want) => {
    expect(evalCondition(c as never, f)).toBe(want);
  });
});

describe("all scheme files are valid and sourced", () => {
  it("every rule has source + verified_on + review_status", () => {
    const rules = loadSchemes();
    expect(rules.length).toBeGreaterThanOrEqual(7);
    for (const r of rules) {
      expect(r.source.url).toMatch(/^https?:\/\//);
      expect(r.source.verified_on).toBeTruthy();
      expect(r.review_status).toBeTruthy();
    }
  });
});

describe("persona suite (schemes)", () => {
  it("Anita (Assam, owner, paddy, hail): PMFBY + KCC + PKVY eligible, KCC stacks with PMFBY", () => {
    const body = evaluateSchemes(personas().anita.profile);
    const v = verdicts(body);
    expect(v.pmfby).toBe("eligible");
    expect(v.kcc).toBe("eligible");
    expect(v.pkvy).toBe("eligible");
    expect(v.assam_dairy).toBe("needs_info");
    const kcc = body.results.find((r) => r.scheme_id === "kcc")!;
    expect(kcc.stack_notes.some((n) => n.with === "pmfby" && n.relation === "stacks")).toBe(true);
    const pmfby = body.results.find((r) => r.scheme_id === "pmfby")!;
    expect(pmfby.deadline?.due_at).toBe("2026-10-12T15:00:00+05:30");
  });

  it("Ramesh (UP, owner, wheat, PM-KISAN stuck): stuck-payment diagnosis flags Aadhaar seeding", () => {
    const body = evaluateSchemes(personas().ramesh.profile);
    const v = verdicts(body);
    expect(v.pmkisan).toBe("eligible");
    expect(v.smam).toBe("eligible");
    expect(v.pmkusum).toBe("eligible");
    expect(v.assam_dairy).toBe("not_eligible");
    const sp = body.stuck_payment!;
    expect(sp.checks.find((c) => c.id === "aadhaar_seeding")!.status).toBe("problem");
    expect(sp.checks.find((c) => c.id === "ekyc")!.status).toBe("ok");
  });

  it("Kamal (Assam, cattle): dairy support + KCC eligible", () => {
    const v = verdicts(evaluateSchemes(personas().kamal.profile));
    expect(v.assam_dairy).toBe("eligible");
    expect(v.kcc).toBe("eligible");
  });

  it("tenant is not eligible for PM-KISAN but can get PMFBY", () => {
    const p = { ...personas().ramesh.profile, land_ownership: "tenant" as const };
    const v = verdicts(evaluateSchemes(p));
    expect(v.pmkisan).toBe("not_eligible");
    expect(v.pmfby).toBe("eligible");
  });

  it("missing hard field -> needs_info with a RAG explanation that does not change the verdict", () => {
    const body = evaluateSchemes({ lang: "en", crops: ["paddy"], land_hectares: 1 });
    const pmk = body.results.find((r) => r.scheme_id === "pmkisan")!;
    expect(pmk.verdict).toBe("needs_info");
    expect(pmk.missing_fields).toContain("land_ownership");
    expect(pmk.explanation?.en).toMatch(/land records/);
  });

  it("missing soft field -> likely", () => {
    const rule = loadScheme("pmkisan")!;
    expect(evaluateRule(rule, { land_ownership: "owner", land_hectares: 1 }).verdict).toBe("likely");
  });
});

describe("deadlines (injectable clock)", () => {
  it("72h after loss event", () => {
    const rule = loadScheme("pmfby")!;
    const d = resolveDeadlines(rule.deadline_rules, personas().anita.profile).find((x) => x.id === "localized_loss_report")!;
    expect(d.hours_left).toBe(61);
    expect(d.expired).toBe(false);
  });
  it("expired when loss is older than the window", () => {
    const rule = loadScheme("pmfby")!;
    const p = { ...personas().anita.profile, loss_event: { type: "hail" as const, occurred_at: "2026-10-05T10:00:00+05:30" } };
    const d = resolveDeadlines(rule.deadline_rules, p).find((x) => x.id === "localized_loss_report")!;
    expect(d.expired).toBe(true);
  });
});
