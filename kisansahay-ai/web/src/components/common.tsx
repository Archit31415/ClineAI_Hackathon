import type { ReactNode } from "react";
import type { Lang, ModuleResult } from "@kisansahay/contracts/types";
import { pick, TIER_LABEL, ui } from "../lib/i18n";
import { speak } from "../voice/tts";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 ${className}`}>{children}</div>;
}

export function Btn({ children, onClick, kind = "primary", disabled, className = "" }: {
  children: ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger"; disabled?: boolean; className?: string;
}) {
  const styles = {
    primary: "bg-green-700 text-white hover:bg-green-800",
    ghost: "bg-white text-green-800 ring-1 ring-green-700 hover:bg-green-50",
    danger: "bg-red-700 text-white hover:bg-red-800",
  }[kind];
  return (
    <button disabled={disabled} onClick={onClick} className={`rounded-xl px-4 py-3 text-base font-semibold disabled:opacity-50 ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function TierBadge({ tier, lang }: { tier?: string; lang: Lang }) {
  if (!tier) return null;
  const c = { deep: "bg-green-100 text-green-800", working: "bg-amber-100 text-amber-800", prototype: "bg-stone-200 text-stone-700" }[tier] ?? "";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{pick(TIER_LABEL[tier], lang)}</span>;
}

const PROVENANCE_LABEL: Record<string, string> = {
  fixture: "cached run",
  cached: "saved data",
  live: "live",
  "cline-sdk": "Cline SDK",
  "cline-orchestrated": "Cline orchestrated",
  deterministic: "rules",
};

export function ProvenanceBadge({ p }: { p: string }) {
  const c = p === "live" || p === "cline-sdk" || p === "cline-orchestrated" ? "bg-sky-100 text-sky-800" : "bg-stone-100 text-stone-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${c}`}>{PROVENANCE_LABEL[p] ?? p}</span>;
}

/** Tells the farmer what happened to their photo (read by AI / not set up / failed / unclear). */
export function PhotoNotice({ photo, lang }: { photo?: ModuleResult["photo"]; lang: Lang }) {
  if (!photo) return null;
  const style = {
    used: "bg-sky-50 text-sky-900",
    not_setup: "bg-stone-100 text-stone-700",
    failed: "bg-amber-50 text-amber-900",
    poor: "bg-amber-50 text-amber-900",
  }[photo.status];
  const icon = { used: "🔍", not_setup: "📷", failed: "⚠️", poor: "📷" }[photo.status];
  return (
    <p className={`mb-3 rounded-lg p-2 text-sm ${style}`}>
      {icon} {pick(photo.notice, lang)}
      {photo.status === "used" && photo.model && <span className="ml-1 text-xs opacity-70">({photo.provider === "cline" ? "via Cline" : "AI"} · {photo.model})</span>}
    </p>
  );
}

export function Speak({ text, lang }: { text: string; lang: Lang }) {
  return (
    <button aria-label="speak" className="no-print rounded-full px-2 text-lg" onClick={() => speak(text, lang)}>🔊</button>
  );
}

export function Disclaimer({ r, lang }: { r: Pick<ModuleResult, "disclaimer">; lang: Lang }) {
  const key = { general: null, agrochemical: "agro_disclaimer", veterinary: "vet_disclaimer", financial: "fin_disclaimer" }[r.disclaimer] as Parameters<typeof ui>[0] | null;
  if (!key) return null;
  return <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">⚠️ {ui(key, lang)}</p>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-stone-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorNote({ msg }: { msg: string }) {
  return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{msg}</p>;
}
