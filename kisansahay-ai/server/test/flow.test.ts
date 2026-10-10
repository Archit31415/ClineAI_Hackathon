import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ActionPlanZ, type ActionPlan } from "@kisansahay/contracts";
import { whatsappText, WHATSAPP_LIMIT } from "../src/dossier/whatsapp";
import { dataPath } from "../src/lib/paths";
import { post } from "./app";
import { personas } from "./helpers";

describe("interview + router", () => {
  it("Anita's Assamese utterance routes to claim first, converts 2 bigha, asks to confirm", async () => {
    const a = personas().anita;
    const { body } = await post<{ profile: Record<string, unknown>; intents: string[]; confirm_needed: boolean }>("/api/interview/turn", {
      session_id: "t-anita", lang: "as", user_text: a.utterance.text, profile: { lang: "as" },
    });
    expect(body.intents[0]).toBe("claim");
    expect(body.profile).toMatchObject({ district: "Nagaon", state: "Assam", land_hectares: 0.27, crops: ["paddy"], pain_point: "crop_loss" });
    expect((body.profile.loss_event as { type: string }).type).toBe("hail");
    expect(body.confirm_needed).toBe(true);
  });

  it("chips-only interview completes", async () => {
    let profile: Record<string, unknown> = { lang: "en" };
    let done = false;
    for (const t of ["I want to sell my crop", "Lucknow Uttar Pradesh", "wheat", "20 quintal"]) {
      const { body } = await post<{ profile: Record<string, unknown>; done: boolean }>("/api/interview/turn", { session_id: "t-chips", lang: "en", user_text: t, profile });
      profile = body.profile;
      done = body.done;
    }
    expect(profile.stock_to_sell).toEqual([{ commodity: "wheat", quintals: 20 }]);
    expect(done).toBe(true);
  });
});

describe("plan + dossier", () => {
  it("Anita end-to-end: claim first, cross notes, PDF + WhatsApp under limit", async () => {
    const p = personas().anita.profile;
    const results = [];
    for (const id of ["claim", "schemes", "advisory"]) results.push((await post(`/api/modules/${id}/run`, { profile: p })).body);
    const { body: plan } = await post<ActionPlan>("/api/plan", { profile: p, results });
    expect(ActionPlanZ.safeParse(plan).success).toBe(true);
    expect(plan.ordered_actions[0].from).toBe("claim");
    expect(plan.cross_notes.some((n) => /KCC stacks with PMFBY/.test(n.en))).toBe(true);
    const { status, body: d } = await post<{ pdf_base64: string; whatsapp_text: string }>("/api/dossier", { plan });
    expect(status).toBe(200);
    expect(Buffer.from(d.pdf_base64, "base64").subarray(0, 4).toString()).toBe("%PDF");
    for (const lang of ["en", "hi", "as"] as const) expect(whatsappText(plan, lang).length).toBeLessThanOrEqual(WHATSAPP_LIMIT);
  });

  it("Ramesh end-to-end (Hindi): schemes + soil + mandi -> Plan, stuck payment diagnosed, PDF + WhatsApp", async () => {
    const r = personas().ramesh;
    const p = r.profile;
    const results = [];
    results.push((await post("/api/modules/schemes/run", { profile: p })).body);
    results.push((await post("/api/modules/soil_card/run", { profile: p, input: { values: r.soil_values, crop: "wheat" } })).body);
    results.push((await post("/api/modules/mandi/run", { profile: p, input: { commodity: "wheat", quintals: 20 } })).body);

    const { body: plan } = await post<ActionPlan>("/api/plan", { profile: p, results });
    expect(ActionPlanZ.safeParse(plan).success).toBe(true);
    expect(plan.results.map((x) => x.module)).toEqual(["schemes", "soil_card", "mandi"]);

    // Schemes diagnosed stuck PM-KISAN
    const sch = plan.results.find((x) => x.module === "schemes")?.body as { stuck_payment?: { checks: { id: string; status: string }[] } };
    expect(sch.stuck_payment?.checks.find((c) => c.id === "aadhaar_seeding")?.status).toBe("problem");

    // Dossier compilation
    const { status, body: d } = await post<{ pdf_base64: string; whatsapp_text: string }>("/api/dossier", { plan });
    expect(status).toBe(200);
    expect(Buffer.from(d.pdf_base64, "base64").subarray(0, 4).toString()).toBe("%PDF");
    expect(d.whatsapp_text.length).toBeLessThanOrEqual(WHATSAPP_LIMIT);
  });

  it("Kamal end-to-end (Assamese): livestock triage + schemes -> Action Plan, vet_now alert, PDF + WhatsApp", async () => {
    const k = personas().kamal;
    const p = k.profile;
    const results = [];
    results.push((await post("/api/modules/livestock/run", { profile: p, input: k.livestock_input })).body);
    results.push((await post("/api/modules/schemes/run", { profile: p })).body);

    const { body: plan } = await post<ActionPlan>("/api/plan", { profile: p, results });
    expect(ActionPlanZ.safeParse(plan).success).toBe(true);
    expect(plan.ordered_actions[0].from).toBe("livestock");
    expect(plan.ordered_actions[0].priority).toBe(1);

    // Livestock triage identified urgent emergency
    const ls = plan.results.find((x) => x.module === "livestock")?.body as { triage: string; isolate: boolean; notifiable_suspect: boolean };
    expect(ls.triage).toBe("vet_now");
    expect(ls.isolate).toBe(true);
    expect(ls.notifiable_suspect).toBe(true);

    const { status, body: d } = await post<{ pdf_base64: string; whatsapp_text: string }>("/api/dossier", { plan });
    expect(status).toBe(200);
    expect(Buffer.from(d.pdf_base64, "base64").subarray(0, 4).toString()).toBe("%PDF");
    expect(d.whatsapp_text.length).toBeLessThanOrEqual(WHATSAPP_LIMIT);
  });

  it("disabled module is blocked (cut switch)", async () => {
    const file = dataPath("modules.json");
    const orig = readFileSync(file, "utf8");
    try {
      writeFileSync(file, JSON.stringify(JSON.parse(orig).map((m: { id: string }) => (m.id === "livestock" ? { ...m, enabled: false } : m))));
      expect((await post("/api/modules/livestock/run", { profile: { lang: "en" } })).status).toBe(409);
    } finally {
      writeFileSync(file, orig);
    }
  });

  it("invalid request returns {error:{code,message}}", async () => {
    const { status, body } = await post<{ error: { code: string } }>("/api/modules/claim/run", { profile: { lang: "xx" } });
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_request");
  });
});
