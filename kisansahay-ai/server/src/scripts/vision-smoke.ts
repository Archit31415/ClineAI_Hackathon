/**
 * Live smoke test for photo reading (spends a little Cline credit, ~$0.001 per photo with gemini-2.5-flash).
 *   cd server && VISION_PROVIDER=cline npx tsx --env-file-if-exists=../.env src/scripts/vision-smoke.ts <image> [livestock|crop_doctor|soil_card]
 * Prints the photo status, the features the model saw, and the deterministic verdict.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { disposeClineVision } from "../cline/vision";
import { visionStatus } from "../lib/vision";
import { runModule } from "../modules/registry";

const [file, mod = "livestock"] = process.argv.slice(2);
if (!file) {
  console.error("usage: vision-smoke.ts <image> [livestock|crop_doctor|soil_card]");
  process.exit(2);
}
const mime = { ".png": "image/png", ".webp": "image/webp" }[extname(file).toLowerCase()] ?? "image/jpeg";
const image_data_url = `data:${mime};base64,${readFileSync(file).toString("base64")}`;
const profile = { lang: "en" as const, state: "Assam", crops: ["paddy"] };
const input = mod === "soil_card" ? { image_data_url, crop: "paddy" } : mod === "livestock" ? { species: "cattle", image_data_url } : { crop: "paddy", image_data_url };

console.log("vision:", visionStatus());
const t0 = Date.now();
const r = await runModule(mod as "livestock", profile, input);
console.log(`took ${Date.now() - t0} ms`);
console.log("photo:", JSON.stringify(r.photo ?? null));
console.log("status:", r.status, "| headline:", r.headline.en);
console.log("body:", JSON.stringify(r.body).slice(0, 700));
await disposeClineVision();
