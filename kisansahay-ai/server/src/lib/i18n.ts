import type { I18n, Lang } from "@kisansahay/contracts";

/** Build an I18n; missing translations fall back to English (shown, never blank). */
export function t(en: string, hi?: string, as?: string): I18n {
  return { en, hi: hi ?? en, as: as ?? hi ?? en };
}

export function pick(text: I18n | undefined, lang: Lang): string {
  if (!text) return "";
  return text[lang] || text.en;
}

/** Simple {name} interpolation across all languages. */
export function fill(text: I18n, vars: Record<string, string | number>): I18n {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
  return { en: f(text.en), hi: f(text.hi), as: f(text.as) };
}
