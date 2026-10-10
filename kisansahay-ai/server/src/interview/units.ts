/**
 * Land unit conversion with per-state factors. Bigha/katha vary by state, so the app ALWAYS confirms.
 * Factors are illustrative — verify with the state revenue department.
 */
export const HECTARE_PER: Record<string, Record<string, number>> = {
  default: { hectare: 1, acre: 0.4047, bigha: 0.2529, katha: 0.0127, guntha: 0.0101, cent: 0.004047 },
  Assam: { bigha: 0.1338, katha: 0.0268, lessa: 0.00134 },
  "Uttar Pradesh": { bigha: 0.2529, biswa: 0.0126 },
  Bihar: { bigha: 0.2529, katha: 0.0126 },
  "West Bengal": { bigha: 0.1338, katha: 0.0067 },
};

const UNIT_ALIASES: Record<string, string> = {
  ha: "hectare", hectare: "hectare", hectares: "hectare", हेक्टेयर: "hectare", हेक्टर: "hectare", হেক্টৰ: "hectare", হেক্টর: "hectare",
  హెక్టారు: "hectare", எக்டேர்: "hectare", ಹೆಕ್ಟೇರ್: "hectare", ഹെക്ടർ: "hectare",
  acre: "acre", acres: "acre", एकड़: "acre", एकर: "acre", একৰ: "acre", একর: "acre", ఎకరాలు: "acre", ఎకరం: "acre",
  ஏக்கர்: "acre", ಎಕರೆ: "acre", ഏക്കർ: "acre",
  bigha: "bigha", bighas: "bigha", बीघा: "bigha", বিঘা: "bigha", বিঘা_: "bigha",
  katha: "katha", kattha: "katha", कट्ठा: "katha", কঠা: "katha", কাঠা: "katha",
  biswa: "biswa", बिस्वा: "biswa", guntha: "guntha", गुंठा: "guntha", గుంట: "guntha", ಗುಂಟೆ: "guntha",
  cent: "cent", cents: "cent", സെന്റ്: "cent", சென்ட்: "cent",
  lessa: "lessa", লেছা: "lessa",
};

export function normUnit(u: string): string | undefined {
  return UNIT_ALIASES[u.toLowerCase()] ?? UNIT_ALIASES[u];
}

export function toHectares(value: number, unit: string, state?: string): { hectares: number; factor: number; confirm: boolean } | undefined {
  const u = normUnit(unit);
  if (!u) return undefined;
  const factor: number | undefined = (state ? HECTARE_PER[state]?.[u] : undefined) ?? HECTARE_PER.default[u];
  if (factor === undefined) return undefined;
  return { hectares: Math.round(value * factor * 100) / 100, factor, confirm: u !== "hectare" };
}

/** All unit words (for spotting "<number> <unit>" in free text). */
export const LAND_UNIT_WORDS = Object.keys(UNIT_ALIASES).filter((u) => !u.endsWith("_"));
