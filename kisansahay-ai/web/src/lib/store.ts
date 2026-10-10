/**
 * Browser-only persistence (privacy: profile, plan and checklist never leave the device except in API calls).
 */
import type { ActionPlan, FarmerProfile, Lang } from "@kisansahay/contracts/types";

const K = { profile: "ks.profile", plan: "ks.plan", ticks: "ks.ticks", lang: "ks.lang", consent: "ks.consent" };

function get<T>(k: string): T | undefined {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}
function set(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
}

export const store = {
  lang: () => get<Lang>(K.lang),
  setLang: (l: Lang) => set(K.lang, l),
  consent: () => get<boolean>(K.consent) ?? false,
  setConsent: (v: boolean) => set(K.consent, v),
  profile: () => get<FarmerProfile>(K.profile),
  setProfile: (p: FarmerProfile) => set(K.profile, p),
  plan: () => get<ActionPlan>(K.plan),
  setPlan: (p: ActionPlan) => set(K.plan, p),
  ticks: () => get<Record<string, boolean>>(K.ticks) ?? {},
  setTicks: (t: Record<string, boolean>) => set(K.ticks, t),
  reset: () => Object.values(K).filter((k) => k !== K.lang && k !== K.consent).forEach((k) => localStorage.removeItem(k)),
};

export function sessionId(): string {
  let id = sessionStorage.getItem("ks.session");
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("ks.session", id); }
  return id;
}

export function newSession(): string {
  const id = crypto.randomUUID();
  sessionStorage.setItem("ks.session", id);
  return id;
}
