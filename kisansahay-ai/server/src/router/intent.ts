/**
 * Intent router: keyword/rule router first (deterministic). Tile taps bypass it.
 * Ordering rule: anything with a running deadline (claim) or animal emergency comes first.
 */
import type { FarmerProfile, ModuleId } from "@kisansahay/contracts";
import { normDigits, PAIN } from "../interview/lexicon";

const SOIL_WORDS = PAIN.soil;
const SELL_WORDS = PAIN.sell_produce;
const DISEASE_WORDS = PAIN.disease;
const ANIMAL_WORDS = PAIN.animal_health;

export function routeIntents(profile: FarmerProfile, utterance = ""): ModuleId[] {
  const s = normDigits(utterance).toLowerCase();
  const has = (w: string[]) => w.some((x) => s.includes(x.toLowerCase()));
  const out: ModuleId[] = [];
  const add = (m: ModuleId) => { if (!out.includes(m)) out.push(m); };

  if (profile.loss_event || profile.pain_point === "crop_loss") add("claim");
  if (profile.pain_point === "animal_health" || has(ANIMAL_WORDS) || (profile.livestock?.length && /fever|बुखार|জ্বৰ|nodule|गांठ|গুটি/.test(s))) add("livestock");
  if (profile.pain_point === "disease" || has(DISEASE_WORDS)) add("crop_doctor");
  if (profile.pain_point === "stuck_payment") add("schemes");
  if (profile.pain_point === "soil" || has(SOIL_WORDS)) add("soil_card");
  if (profile.pain_point === "sell_produce" || has(SELL_WORDS) || profile.stock_to_sell?.length) add("mandi");
  if (out.includes("claim") || out.includes("crop_doctor")) add("advisory");
  add("schemes"); // always check entitlements
  return out;
}
