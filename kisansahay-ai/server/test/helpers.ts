import type { FarmerProfile } from "@kisansahay/contracts";
import { readJson } from "../src/lib/paths";

interface Personas {
  anita: { profile: FarmerProfile; utterance: { lang: "as"; text: string } };
  ramesh: { profile: FarmerProfile; utterance: { lang: "hi"; text: string }; soil_values: Record<string, number> };
  kamal: { profile: FarmerProfile; utterance: { lang: "as"; text: string }; livestock_input: { species: string; features: string[] } };
}

export const personas = () => readJson<Personas>("fixtures", "personas.json");
