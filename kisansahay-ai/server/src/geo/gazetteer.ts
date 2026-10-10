/**
 * India gazetteer (data/geo/india.json, built from Wikidata by scripts/build-gazetteer.py):
 * finds state + district mentioned anywhere in free text, in any of our 9 languages / scripts,
 * including romanised spellings ("nashik", "naashik") and glued Indic case endings ("नासिकमध्ये").
 * Deterministic; no LLM needed.
 */
import { readJson } from "../lib/paths";

interface DistrictRec { name: string; names: Record<string, string>; aliases?: string[]; lat?: number; lng?: number }
interface StateRec { names: Record<string, string>; aliases?: string[]; districts: DistrictRec[] }
interface Gazetteer { states: Record<string, StateRec> }

export interface GeoHit { state?: string; district?: string; ambiguous_states?: string[] }

interface Term { norm: string; phon?: string; state: string; district?: string; latin: boolean }

let cache: { terms: Term[]; g: Gazetteer } | undefined;

/** Lowercase, strip diacritics/punctuation and nukta/ZWJ, collapse spaces; padded with spaces. */
export function normalise(s: string): string {
  const core = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u093c\u09bc\u0abc\u0b3c\u200c\u200d]/g, "")
    .replace(/[.,;:!?'"()[\]{}\-–—/|।॥]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ` ${core} `;
}

/** Collapse romanisation variants: aa->a, ee->i, oo->u, w->v, sh->s, doubled letters. */
export function phonetic(latin: string): string {
  return latin
    .replace(/aa/g, "a").replace(/ee|ii/g, "i").replace(/oo|uu/g, "u")
    .replace(/w/g, "v").replace(/sh/g, "s").replace(/z/g, "j").replace(/ph/g, "f")
    .replace(/(.)\1+/g, "$1");
}

const isLatin = (s: string) => /^[\sa-z0-9&]+$/.test(s);

/**
 * District names that are also everyday farmer words: "mandi" (market), "এটা" (Assamese "one"),
 * "sagar", "dang" ... These only count as a district when the text also names their state.
 */
const NEEDS_STATE = new Set([
  "mandi", "मंडी", "मण्डी", "মাণ্ডি", "মান্দি", "এটা", "mau", "मऊ", "una", "ऊना", "dang", "mon", "pali", "पाली", "sagar", "सागर",
  "anand", "आनंद", "sham", "tapi", "puri", "पुरी", "dhar", "धार", "guna", "गुना", "banda", "बांदा", "kota", "कोटा",
  "diu", "leh", "siang", "seoni", "durg", "rewa", "रीवा", "basti", "बस्ती", "patan", "kheda", "mansa", "bhind", "tonk",
]);
const SHORT_OK = new Set(["up", "mp", "ap", "hp"]);

function load() {
  if (cache) return cache;
  const g = readJson<Gazetteer>("geo", "india.json");
  const terms: Term[] = [];
  const add = (raw: string, state: string, district?: string) => {
    const norm = normalise(raw).trim();
    if (norm.length < 3 && !SHORT_OK.has(norm)) return;
    const latin = isLatin(norm);
    terms.push({ norm, state, district, latin, phon: latin && norm.length >= 5 ? phonetic(norm) : undefined });
  };
  for (const [st, rec] of Object.entries(g.states)) {
    add(st, st);
    for (const n of Object.values(rec.names)) add(n, st);
    for (const a of rec.aliases ?? []) add(a, st);
    for (const d of rec.districts) {
      add(d.name, st, d.name);
      for (const n of Object.values(d.names)) add(n, st, d.name);
      for (const a of d.aliases ?? []) add(a, st, d.name);
    }
  }
  // Longest first: "kamrup metropolitan" beats "kamrup", "west karbi anglong" beats "karbi anglong".
  terms.sort((a, b) => b.norm.length - a.norm.length);
  cache = { terms, g };
  return cache;
}

/** Indic vowel signs + virama: a name's final vowel sign/virama changes when a case ending is glued on
 * (தஞ்சாவூர் -> தஞ்சாவூரில், ಮೈಸೂರು -> ಮೈಸೂರಿನ), so we also match the name without its trailing sign. */
const INDIC_TAIL = /[\u093e-\u094d\u09be-\u09cd\u0bbe-\u0bcd\u0c3e-\u0c4d\u0cbe-\u0ccd\u0d3e-\u0d4d]+$/;

/** Latin: whole words only. Indic: word start (case endings like -में / -ৰ / -ில் may be glued on). */
function hits(hay: string, phonHay: string, t: Term): boolean {
  if (t.latin) return hay.includes(` ${t.norm} `) || (!!t.phon && phonHay.includes(` ${t.phon} `));
  if (hay.includes(` ${t.norm}`)) return true;
  const stem = t.norm.replace(INDIC_TAIL, "");
  // stem must stay specific enough (>= 3 code points) to avoid false hits
  return stem !== t.norm && [...stem].length >= 3 && hay.includes(` ${stem}`);
}

/**
 * Find state and district in free text. A district implies its state. If a district name exists in
 * two states (e.g. Aurangabad: Bihar / Maharashtra), the state named in the text (or the already
 * known state) decides; otherwise only `ambiguous_states` is returned.
 */
export function findPlace(text: string, knownState?: string): GeoHit {
  const { terms } = load();
  let hay = normalise(text);
  let phonHay = phonetic(hay);
  const stateHits: string[] = [];
  const districtHits = new Map<string, Set<string>>();
  const weakDistricts = new Set<string>();
  for (const t of terms) {
    if (!hits(hay, phonHay, t)) continue;
    if (t.district && NEEDS_STATE.has(t.norm)) weakDistricts.add(t.district);
    else if (t.district) weakDistricts.delete(t.district);
    if (t.district) {
      if (!districtHits.has(t.district)) districtHits.set(t.district, new Set());
      districtHits.get(t.district)!.add(t.state);
    } else if (!stateHits.includes(t.state)) stateHits.push(t.state);
    // consume the matched words so "karbi anglong" inside "west karbi anglong" is not matched again
    hay = hay.replace(` ${t.norm}`, " ").replace(` ${t.norm.replace(INDIC_TAIL, "")}`, " ");
    if (t.phon) phonHay = phonHay.replace(` ${t.phon} `, " ");
  }

  const out: GeoHit = {};
  if (stateHits.length === 1) out.state = stateHits[0];
  const prefer = out.state ?? knownState;
  for (const [district, states] of districtHits) {
    if (weakDistricts.has(district) && !stateHits.some((st) => states.has(st))) continue;
    const ss = [...states];
    const st = ss.length === 1 ? ss[0] : prefer && ss.includes(prefer) ? prefer : undefined;
    if (!st) { out.ambiguous_states = ss; continue; }
    if (out.state && out.state !== st) continue; // conflicts with the explicitly named state
    if (stateHits.length > 1 && !stateHits.includes(st)) continue;
    out.district = district;
    out.state = st;
    break;
  }
  return out;
}

function findDistrict(state: string, district: string): DistrictRec | undefined {
  const st = load().g.states[state];
  const k = district.toLowerCase();
  return st?.districts.find((x) => x.name.toLowerCase() === k || x.aliases?.some((a) => a.toLowerCase() === k));
}

/** District centroid, else any district centroid in the state. */
export function centroid(state?: string, district?: string): { lat: number; lng: number } | undefined {
  if (!state) return undefined;
  const st = load().g.states[state];
  if (!st) return undefined;
  const d = district ? findDistrict(state, district) : undefined;
  if (d?.lat !== undefined && d.lng !== undefined) return { lat: d.lat, lng: d.lng };
  const any = st.districts.find((x) => x.lat !== undefined);
  return any ? { lat: any.lat!, lng: any.lng! } : undefined;
}

/** Place names in the farmer's language (fall back to English). */
export function placeLabel(state: string | undefined, district: string | undefined, lang: string): string {
  if (!state) return district ?? "";
  const st = load().g.states[state];
  const sName = (st?.names[lang] as string | undefined) || state;
  if (!district) return sName;
  const d = findDistrict(state, district);
  return `${(d?.names[lang] as string | undefined) || district}, ${sName}`;
}

export function stateExists(state: string): boolean {
  return !!load().g.states[state];
}
