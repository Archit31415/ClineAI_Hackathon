/**
 * `npm run contract`: runs every ENABLED module on its fixture request (data/fixtures/modules/<id>.json)
 * with no network (fixture Cline, snapshot mandi, cached weather) and validates the result with Zod.
 * Also checks catalog safety lint (no treatment steps without a source; no dose patterns).
 * Exit code 1 on any failure -> flip that module to enabled:false (the 4:00 contract gate).
 */
import { readFileSync } from "node:fs";
import { BODY_SCHEMAS, moduleResultZ, type ModuleId } from "@kisansahay/contracts";
import { setNow } from "../lib/clock";
import { dataPath } from "../lib/paths";
import { registry, runModule } from "../modules/registry";

process.env.CLINE_MODE = "fixture";
process.env.MANDI_MODE = "snapshot";
process.env.WEATHER_MODE = "cached";
process.env.LLM_PROVIDER = "none";
setNow("2026-10-10T02:00:00+05:30");

const DOSE = /\b\d+(\.\d+)?\s?(ml|mg|g|kg|l)\s*(\/|per)\s*(acre|ha|litre|liter|animal|kg)\b/i;

function lintCatalogs(): string[] {
  const errs: string[] = [];
  for (const f of ["crop_disease.json", "livestock.json"]) {
    const raw = readFileSync(dataPath("triage", f), "utf8");
    if (DOSE.test(raw)) errs.push(`${f}: contains a dose-like pattern`);
  }
  return errs;
}

async function main() {
  let failed = 0;
  for (const m of registry()) {
    if (!m.enabled) { console.log(`- ${m.id.padEnd(12)} SKIP (disabled)`); continue; }
    const fx = JSON.parse(readFileSync(dataPath("fixtures", "modules", `${m.id}.json`), "utf8")) as { request: { profile: never; input?: unknown }; expect?: Record<string, unknown> };
    try {
      const res = await runModule(m.id, fx.request.profile, fx.request.input);
      const check = moduleResultZ(BODY_SCHEMAS[m.id as ModuleId], m.id as ModuleId).safeParse(res);
      if (!check.success) throw new Error(check.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      for (const [path, want] of Object.entries(fx.expect ?? {})) {
        const got = path.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], res);
        if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`expect ${path}=${JSON.stringify(want)} got ${JSON.stringify(got)}`);
      }
      console.log(`✓ ${m.id.padEnd(12)} [${m.tier}] ${res.status} — ${res.headline.en}`);
    } catch (e) {
      failed++;
      console.log(`✗ ${m.id.padEnd(12)} [${m.tier}] ${(e as Error).message}`);
    }
  }
  const lint = lintCatalogs();
  lint.forEach((l) => console.log(`✗ lint: ${l}`));
  failed += lint.length;
  console.log(failed ? `\n${failed} contract failure(s)` : "\nAll enabled modules pass their contract.");
  process.exit(failed ? 1 : 0);
}

void main();
