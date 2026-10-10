/**
 * Module registry: data/modules.json (id, tier, enabled) + runners with Zod-validated input/output.
 * Setting enabled:false greys the tile ("coming soon") and blocks the route — the cut switch.
 */
import type { z } from "zod";
import {
  AdvisoryInputZ, BODY_SCHEMAS, ClaimInputZ, CropDoctorInputZ, LivestockInputZ, MandiInputZ, moduleResultZ, SoilInputZ,
  type FarmerProfile, type ModuleId, type ModuleRegistryEntry, type ModuleResult,
} from "@kisansahay/contracts";
import { ApiError } from "../lib/errors";
import { readJson } from "../lib/paths";
import { runAdvisory } from "./advisory";
import { runClaim } from "./claim";
import { runCropDoctor } from "./crop_doctor";
import { runLivestock } from "./livestock";
import { runMandi } from "./mandi";
import { runSchemes } from "./schemes";
import { runSoil } from "./soil";

type Runner = (profile: FarmerProfile, input: unknown) => Promise<ModuleResult>;

interface ModuleDef { input?: z.ZodTypeAny; run: Runner }

const MODULES: Record<ModuleId, ModuleDef> = {
  schemes: { run: (p) => runSchemes(p) },
  claim: { input: ClaimInputZ, run: (p, i) => runClaim(p, i as never) },
  soil_card: { input: SoilInputZ, run: (p, i) => runSoil(p, i as never) },
  mandi: { input: MandiInputZ.partial(), run: (p, i) => runMandi(p, i as never) },
  crop_doctor: { input: CropDoctorInputZ, run: (p, i) => runCropDoctor(p, i as never) },
  livestock: { input: LivestockInputZ.partial(), run: (p, i) => runLivestock(p, i as never) },
  advisory: { input: AdvisoryInputZ, run: (p, i) => runAdvisory(p, i as never) },
};

export function registry(): ModuleRegistryEntry[] {
  return readJson<ModuleRegistryEntry[]>("modules.json");
}

export function isModuleId(id: string): id is ModuleId {
  return id in MODULES;
}

export async function runModule(id: string, profile: FarmerProfile, input?: unknown): Promise<ModuleResult> {
  if (!isModuleId(id)) throw new ApiError(404, "unknown_module", `Unknown module ${id}`);
  const entry = registry().find((m) => m.id === id);
  if (!entry?.enabled) throw new ApiError(409, "module_disabled", `Module ${id} is coming soon`);
  const def = MODULES[id];
  let parsedInput: unknown = input;
  if (def.input) {
    const r = def.input.safeParse(input ?? {});
    if (!r.success) throw new ApiError(400, "invalid_input", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    parsedInput = r.data;
  }
  const result = await def.run(profile, parsedInput);
  // Contract enforcement on every response.
  const check = moduleResultZ(BODY_SCHEMAS[id], id).safeParse(result);
  if (!check.success) {
    throw new ApiError(500, "contract_violation", `${id} returned an invalid ModuleResult: ${check.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return result;
}
