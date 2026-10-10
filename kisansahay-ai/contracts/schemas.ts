/**
 * Zod mirrors of contracts/types.ts. Used by route validation and `npm run contract`.
 */
import { z } from "zod";

export const LangZ = z.enum(["hi", "as", "en"]);
export const I18nZ = z.object({ hi: z.string(), as: z.string(), en: z.string() });
export const ModuleIdZ = z.enum([
  "schemes", "claim", "crop_doctor", "soil_card", "mandi", "advisory", "livestock",
]);
export const TierZ = z.enum(["deep", "working", "prototype"]);
const GpsZ = z.object({ lat: z.number(), lng: z.number() });

export const FarmerProfileZ = z.object({
  lang: LangZ,
  state: z.string().optional(),
  district: z.string().optional(),
  land_hectares: z.number().nonnegative().optional(),
  land_ownership: z.enum(["owner", "tenant", "sharecropper"]).optional(),
  crops: z.array(z.string()).optional(),
  season: z.enum(["kharif", "rabi", "zaid"]).optional(),
  sowing_date: z.string().optional(),
  category: z.enum(["general", "obc", "sc", "st"]).optional(),
  pain_point: z.enum([
    "crop_loss", "equipment", "credit", "organic", "irrigation", "stuck_payment",
    "disease", "sell_produce", "soil", "animal_health", "unknown",
  ]).optional(),
  loss_event: z.object({
    type: z.enum(["hail", "flood", "drought", "pest", "other"]),
    occurred_at: z.string(),
  }).optional(),
  existing_benefits: z.array(z.string()).optional(),
  has_bank_account: z.boolean().optional(),
  aadhaar_seeded: z.boolean().optional(),
  in_cluster_group: z.boolean().optional(),
  livestock: z.array(z.object({
    species: z.enum(["cattle", "buffalo", "goat", "poultry", "other"]),
    count: z.number(),
  })).optional(),
  stock_to_sell: z.array(z.object({ commodity: z.string(), quintals: z.number() })).optional(),
  gps: GpsZ.optional(),
  consent_gps: z.boolean().optional(),
  raw_units: z.object({ value: z.number(), unit: z.string() }).optional(),
  name: z.string().optional(),
  ekyc_done: z.boolean().optional(),
  land_record_matches: z.boolean().optional(),
  is_income_tax_payer: z.boolean().optional(),
  has_irrigation_pump: z.boolean().optional(),
});

export const ActionItemZ = z.object({
  id: z.string(),
  label: I18nZ,
  kind: z.enum(["do_now", "collect_doc", "visit", "call", "wait", "info"]),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  due_at: z.string().optional(),
  link: z.string().optional(),
});

export const SourceZ = z.object({ label: z.string(), url: z.string(), as_of: z.string() });

export const PhotoStatusZ = z.object({
  status: z.enum(["used", "not_setup", "failed", "poor"]),
  provider: z.enum(["cline", "llm", "none"]),
  model: z.string().optional(),
  notice: I18nZ,
});

export function moduleResultZ<B extends z.ZodTypeAny>(body: B, id?: z.infer<typeof ModuleIdZ>) {
  return z.object({
    module: id ? z.literal(id) : ModuleIdZ,
    status: z.enum(["ok", "needs_info", "degraded", "error"]),
    headline: I18nZ,
    body,
    actions: z.array(ActionItemZ),
    sources: z.array(SourceZ),
    confidence: z.number().min(0).max(1).optional(),
    provenance: z.enum(["live", "cached", "fixture"]),
    disclaimer: z.enum(["general", "agrochemical", "veterinary", "financial"]),
    missing_fields: z.array(z.string()).optional(),
    generated_at: z.string(),
    photo: PhotoStatusZ.optional(),
  });
}
export const ModuleResultZ = moduleResultZ(z.unknown());

export const ModuleRunRequestZ = z.object({
  profile: FarmerProfileZ,
  input: z.unknown().optional(),
});

/* ---------- bodies ---------- */
const DocumentItemZ = z.object({
  id: z.string(), name: I18nZ, where_to_get: I18nZ, have: z.boolean().optional(),
});
export const EligibilityResultZ = z.object({
  scheme_id: z.string(),
  scheme_name: I18nZ,
  verdict: z.enum(["eligible", "likely", "needs_info", "not_eligible"]),
  confidence: z.number().min(0).max(1),
  reasons: z.object({ hi: z.array(z.string()), as: z.array(z.string()), en: z.array(z.string()) }),
  missing_fields: z.array(z.string()),
  benefit_summary: I18nZ,
  documents: z.array(DocumentItemZ),
  deadline: z.object({ label: z.string(), due_at: z.string() }).optional(),
  stack_notes: z.array(z.object({
    with: z.string(), relation: z.enum(["stacks", "conflicts", "requires"]), note: I18nZ,
  })),
  source: z.object({ url: z.string(), verified_on: z.string() }),
  explanation: I18nZ.optional(),
});
export const SchemesBodyZ = z.object({
  results: z.array(EligibilityResultZ),
  conflicts: z.array(z.object({ a: z.string(), b: z.string(), note: I18nZ })),
  stuck_payment: z.object({
    scheme_id: z.string(),
    checks: z.array(z.object({
      id: z.string(), label: I18nZ, status: z.enum(["ok", "problem", "unknown"]), fix: I18nZ,
    })),
  }).optional(),
});

export const FormFillResultZ = z.object({
  scheme_id: z.string(),
  form_values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
  warnings: z.array(z.object({ field: z.string(), message: z.string() })),
  missing_documents: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  provenance: z.enum(["cline-sdk", "fixture"]),
});
export const ClaimInputZ = z.object({
  evidence: z.array(z.object({
    image_data_url: z.string(),
    captured_at: z.string(),
    gps: GpsZ.optional(),
    sha256: z.string(),
    shot_type: z.enum(["wide", "close", "boundary", "other"]),
  })).default([]),
});
export const ClaimBodyZ = z.object({
  deadline: z.object({ due_at: z.string(), hours_left: z.number(), expired: z.boolean() }),
  evidence_checklist: z.array(z.object({ shot_type: z.string(), label: I18nZ, done: z.boolean() })),
  intimation: FormFillResultZ,
  channels: z.array(z.object({ label: I18nZ, value: z.string(), verified_on: z.string() })),
  expired_message: I18nZ.optional(),
});

export const SoilInputZ = z.object({
  image_data_url: z.string().optional(),
  values: z.record(z.number()).optional(),
  printed_recommendation: z.array(z.object({ nutrient: z.string(), guidance: z.string() })).optional(),
  crop: z.string().optional(),
});
export const SoilBodyZ = z.object({
  parsed: z.array(z.object({
    param: z.string(), value: z.number(), unit: z.string(), ocr_confidence: z.number().min(0).max(1),
  })),
  confirmed: z.boolean(),
  ratings: z.array(z.object({ param: z.string(), band: z.string(), note: I18nZ })),
  plan: z.object({
    source: z.enum(["card_printed", "state_table", "none"]),
    crop: z.string(),
    items: z.array(z.object({ nutrient: z.string(), guidance: I18nZ })),
  }),
});

export const MandiInputZ = z.object({
  commodity: z.string().min(1),
  quintals: z.number().positive(),
  storage_possible: z.boolean().optional(),
});
export const MandiBodyZ = z.object({
  commodity: z.string(),
  quintals: z.number(),
  options: z.array(z.object({
    mandi: z.string(), distance_km: z.number(), modal_price: z.number(),
    transport_cost_per_q: z.number(), net_per_q: z.number(), price_date: z.string(),
  })),
  trend: z.object({ days: z.number(), change_pct: z.number() }),
  recommendation: z.enum(["sell_now", "wait", "compare"]),
  best_mandi: z.string().optional(),
  reason: I18nZ,
  stale: z.boolean(),
  assumptions: z.object({ transport_rate_per_q_km: z.number() }),
  msp: z.object({ price: z.number(), season: z.string(), source: z.string() }).optional(),
});

export const CropDoctorInputZ = z.object({
  image_data_url: z.string().optional(),
  symptoms_text: z.string().optional(),
  crop: z.string().optional(),
  features: z.array(z.string()).optional(),
});
export const CropDoctorBodyZ = z.object({
  photo_quality: z.enum(["ok", "poor"]),
  candidates: z.array(z.object({
    id: z.string(), name: I18nZ, confidence: z.number().min(0).max(1), why: I18nZ,
    confirm_by: I18nZ, safe_steps: I18nZ,
    advisory_source: z.object({ label: z.string(), url: z.string() }).optional(),
  })),
  escalate: z.boolean(),
  features_detected: z.array(z.string()).optional(),
});
export const LivestockInputZ = z.object({
  species: z.string().default("cattle"),
  symptoms_text: z.string().optional(),
  image_data_url: z.string().optional(),
  features: z.array(z.string()).optional(),
});
export const LivestockBodyZ = z.object({
  triage: z.enum(["monitor", "vet_within_24h", "vet_now"]),
  red_flags: z.array(I18nZ),
  possible_conditions: z.array(z.object({ id: z.string(), name: I18nZ, confidence: z.number() })),
  isolate: z.boolean(),
  notifiable_suspect: z.boolean(),
  do_now: z.array(I18nZ),
  do_not: z.array(I18nZ),
  features_detected: z.array(z.string()).optional(),
});

export const AdvisoryInputZ = z.object({ simulate_days_ahead: z.number().int().min(0).max(7).optional() });
export const AdvisoryBodyZ = z.object({
  crop_stage: z.string(),
  forecast: z.array(z.object({
    date: z.string(), rain_mm: z.number(), tmax: z.number(), tmin: z.number(), wind_kmph: z.number(),
  })),
  nudges: z.array(z.object({
    date: z.string(), severity: z.enum(["info", "watch", "act"]), text: I18nZ, rule_id: z.string(),
  })),
});

export const BODY_SCHEMAS = {
  schemes: SchemesBodyZ,
  claim: ClaimBodyZ,
  soil_card: SoilBodyZ,
  mandi: MandiBodyZ,
  crop_doctor: CropDoctorBodyZ,
  livestock: LivestockBodyZ,
  advisory: AdvisoryBodyZ,
} as const;

export const ActionPlanZ = z.object({
  generated_at: z.string(),
  lang: LangZ,
  results: z.array(ModuleResultZ),
  ordered_actions: z.array(ActionItemZ.extend({ from: ModuleIdZ })),
  cross_notes: z.array(I18nZ),
  provenance: z.enum(["deterministic", "cline-orchestrated"]),
  documents: z.array(z.object({ id: z.string(), name: I18nZ, from: z.array(ModuleIdZ) })).optional(),
  explanation: I18nZ.optional(),
});

/* ---------- API requests ---------- */
export const InterviewTurnRequestZ = z.object({
  session_id: z.string().min(1),
  lang: LangZ,
  user_text: z.string(),
  profile: FarmerProfileZ,
});
export const PlanRequestZ = z.object({ profile: FarmerProfileZ, results: z.array(ModuleResultZ) });
export const DossierRequestZ = z.object({ plan: ActionPlanZ });
export const ClineFillRequestZ = z.object({ profile: FarmerProfileZ, form_id: z.string().min(1) });
export const ClinePlanRequestZ = z.object({ profile: FarmerProfileZ, utterance: z.string().default("") });
export const ClineIngestRequestZ = z.object({
  url: z.string().optional(),
  text: z.string().optional(),
  sample_id: z.string().optional(),
  target_rule_id: z.string().optional(),
});
