/**
 * KisanSahay-AI shared contracts (technical.md §4).
 * Rule: never rename a field; add fields instead.
 */
/** UI / conversation languages. hi/as/en are fully authored; the others are authored for farmer-facing
 * strings and fall back to English elsewhere (see pick()). */
export type Lang = "hi" | "as" | "en" | "bn" | "mr" | "te" | "ta" | "kn" | "ml";
export const CORE_LANGS = ["en", "hi", "as"] as const;
export const EXTRA_LANGS = ["bn", "mr", "te", "ta", "kn", "ml"] as const;
export const ALL_LANGS = [...CORE_LANGS, ...EXTRA_LANGS] as const;
export type CoreLang = (typeof CORE_LANGS)[number];
/** en/hi/as are required; the newer languages are optional (missing -> English fallback). */
export type I18n = Record<CoreLang, string> & Partial<Record<(typeof EXTRA_LANGS)[number], string>>;
export type Category = "general" | "obc" | "sc" | "st";
export type ModuleId =
  | "schemes"
  | "claim"
  | "crop_doctor"
  | "soil_card"
  | "mandi"
  | "advisory"
  | "livestock";
export type Tier = "deep" | "working" | "prototype";

export type PainPoint =
  | "crop_loss" | "equipment" | "credit" | "organic" | "irrigation"
  | "stuck_payment" | "disease" | "sell_produce" | "soil" | "animal_health" | "unknown";

export interface FarmerProfile {
  lang: Lang;
  state?: string;
  district?: string;
  land_hectares?: number;
  land_ownership?: "owner" | "tenant" | "sharecropper";
  crops?: string[];
  season?: "kharif" | "rabi" | "zaid";
  sowing_date?: string; // ISO date, for advisory
  category?: Category;
  pain_point?: PainPoint;
  loss_event?: { type: "hail" | "flood" | "drought" | "pest" | "other"; occurred_at: string };
  existing_benefits?: string[];
  has_bank_account?: boolean;
  aadhaar_seeded?: boolean;
  in_cluster_group?: boolean;
  livestock?: { species: "cattle" | "buffalo" | "goat" | "poultry" | "other"; count: number }[];
  stock_to_sell?: { commodity: string; quintals: number }[];
  gps?: { lat: number; lng: number };
  consent_gps?: boolean;
  raw_units?: { value: number; unit: string };
  // v2 additions (additive only)
  name?: string;
  ekyc_done?: boolean;
  land_record_matches?: boolean;
  is_income_tax_payer?: boolean;
  has_irrigation_pump?: boolean;
}

/* ---------- Universal module envelope ---------- */
export interface ModuleResult<B = unknown> {
  module: ModuleId;
  status: "ok" | "needs_info" | "degraded" | "error";
  headline: I18n;
  body: B;
  actions: ActionItem[];
  sources: { label: string; url: string; as_of: string }[];
  confidence?: number;
  provenance: "live" | "cached" | "fixture";
  disclaimer: "general" | "agrochemical" | "veterinary" | "financial";
  missing_fields?: string[];
  generated_at: string;
  /** What happened to an uploaded photo. Absent when no photo was sent. */
  photo?: PhotoStatus;
}
export interface PhotoStatus {
  /** used = AI read it; not_setup = no vision provider; failed = provider error; poor = unclear photo */
  status: "used" | "not_setup" | "failed" | "poor";
  provider: "cline" | "llm" | "none";
  model?: string;
  notice: I18n;
}
export interface ActionItem {
  id: string;
  label: I18n;
  kind: "do_now" | "collect_doc" | "visit" | "call" | "wait" | "info";
  priority: 1 | 2 | 3; // 1 = urgent
  due_at?: string;
  link?: string;
}

export interface ModuleRunRequest<I = unknown> {
  profile: FarmerProfile;
  input?: I;
}

export interface ActionPlan {
  generated_at: string;
  lang: Lang;
  results: ModuleResult[];
  ordered_actions: (ActionItem & { from: ModuleId })[];
  cross_notes: I18n[];
  provenance: "deterministic" | "cline-orchestrated";
  documents?: { id: string; name: I18n; from: ModuleId[] }[];
  explanation?: I18n;
}

/* ---------- schemes ---------- */
export interface SchemesBody {
  results: EligibilityResult[];
  conflicts: Conflict[];
  stuck_payment?: StuckPaymentDiagnosis;
}
export type Verdict = "eligible" | "likely" | "needs_info" | "not_eligible";
export interface EligibilityResult {
  scheme_id: string;
  scheme_name: I18n;
  verdict: Verdict;
  confidence: number;
  reasons: Record<CoreLang, string[]> & Partial<Record<Lang, string[]>>;
  missing_fields: string[];
  benefit_summary: I18n;
  documents: DocumentItem[];
  deadline?: { label: string; due_at: string };
  stack_notes: { with: string; relation: "stacks" | "conflicts" | "requires"; note: I18n }[];
  source: { url: string; verified_on: string };
  explanation?: I18n; // RAG explanation for needs_info; never changes verdict
}
export interface Conflict { a: string; b: string; note: I18n }
export interface DocumentItem { id: string; name: I18n; where_to_get: I18n; have?: boolean }
export interface StuckPaymentDiagnosis {
  scheme_id: string;
  checks: { id: string; label: I18n; status: "ok" | "problem" | "unknown"; fix: I18n }[];
}

/* ---------- claim ---------- */
export interface ClaimInput {
  evidence: {
    image_data_url: string;
    captured_at: string;
    gps?: { lat: number; lng: number };
    sha256: string;
    shot_type: "wide" | "close" | "boundary" | "other";
  }[];
}
export interface ClaimBody {
  deadline: { due_at: string; hours_left: number; expired: boolean };
  evidence_checklist: { shot_type: string; label: I18n; done: boolean }[];
  intimation: FormFillResult; // from Cline Workflow B
  channels: { label: I18n; value: string; verified_on: string }[];
  expired_message?: I18n;
}
export interface FormFillResult {
  scheme_id: string;
  form_values: Record<string, string | number | boolean | null>;
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  missing_documents: string[];
  confidence: number;
  provenance: "cline-sdk" | "fixture";
}

/* ---------- soil_card ---------- */
export interface SoilInput {
  image_data_url?: string;
  values?: Record<string, number>;
  printed_recommendation?: { nutrient: string; guidance: string }[];
  crop?: string;
}
export interface SoilBody {
  parsed: { param: string; value: number; unit: string; ocr_confidence: number }[];
  confirmed: boolean;
  ratings: { param: string; band: string; note: I18n }[];
  plan: {
    source: "card_printed" | "state_table" | "none";
    crop: string;
    items: { nutrient: string; guidance: I18n }[];
  };
}

/* ---------- mandi ---------- */
export interface MandiInput { commodity: string; quintals: number; storage_possible?: boolean }
export interface MandiBody {
  commodity: string;
  quintals: number;
  options: {
    mandi: string; distance_km: number; modal_price: number;
    transport_cost_per_q: number; net_per_q: number; price_date: string;
  }[];
  trend: { days: number; change_pct: number };
  recommendation: "sell_now" | "wait" | "compare";
  best_mandi?: string;
  reason: I18n;
  stale: boolean;
  assumptions: { transport_rate_per_q_km: number };
  msp?: { price: number; season: string; source: string };
}

/* ---------- triage: crop_doctor / livestock ---------- */
export interface CropDoctorInput {
  image_data_url?: string;
  symptoms_text?: string;
  crop?: string;
  features?: string[]; // chip-selected feature ids (no-LLM path)
}
export interface CropDoctorBody {
  photo_quality: "ok" | "poor";
  candidates: {
    id: string; name: I18n; confidence: number; why: I18n; confirm_by: I18n;
    safe_steps: I18n; advisory_source?: { label: string; url: string };
  }[];
  escalate: boolean;
  features_detected?: string[];
}
export interface LivestockInput {
  species: string;
  symptoms_text?: string;
  image_data_url?: string;
  features?: string[];
}
export interface LivestockBody {
  triage: "monitor" | "vet_within_24h" | "vet_now";
  red_flags: I18n[];
  possible_conditions: { id: string; name: I18n; confidence: number }[];
  isolate: boolean;
  notifiable_suspect: boolean;
  do_now: I18n[];
  do_not: I18n[];
  features_detected?: string[];
}

/* ---------- advisory ---------- */
export interface AdvisoryInput { simulate_days_ahead?: number }
export interface AdvisoryBody {
  crop_stage: string;
  forecast: { date: string; rain_mm: number; tmax: number; tmin: number; wind_kmph: number }[];
  nudges: { date: string; severity: "info" | "watch" | "act"; text: I18n; rule_id: string }[];
}

/* ---------- API ---------- */
export interface InterviewTurnRequest {
  session_id: string;
  lang: Lang;
  user_text: string;
  profile: FarmerProfile;
}
export interface InterviewTurnResponse {
  assistant_text: string;
  profile: FarmerProfile;
  intents: ModuleId[];
  next_slot: string | null;
  confirm_needed: boolean;
  done: boolean;
  chips?: { label: string; value: string }[];
  confirm_text?: string;
  provenance?: "llm" | "scripted";
}
export interface ModuleRegistryEntry { id: ModuleId; tier: Tier; enabled: boolean; owner: string }
export interface ClineTaskStatus<R = unknown> {
  id: string;
  kind: "ingest_rule" | "fill_form" | "plan";
  status: "queued" | "running" | "done" | "failed";
  progress: { at: string; msg: string }[];
  result?: R;
  error?: string;
  provenance?: "cline-sdk" | "fixture";
}
export interface DossierResponse {
  pdf_base64: string;
  whatsapp_text: string;
  whatsapp_link: string;
  json: ActionPlan;
}
export interface ClineIngestRequest {
  url?: string;
  text?: string;
  sample_id?: string;
  pdf_base64?: string;
  target_rule_id?: string;
}
