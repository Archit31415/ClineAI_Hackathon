import type { I18n, Lang } from "@kisansahay/contracts";
import { ALL_LANGS } from "@kisansahay/contracts";

export type ExtraI18n = Partial<Record<"bn" | "mr" | "te" | "ta" | "kn" | "ml", string>>;

/**
 * Build an I18n; missing translations fall back to English (shown, never blank).
 * Optional 4th arg adds the newer languages: t(en, hi, as, { bn, mr, te, ta, kn, ml }).
 */
export function t(en: string, hi?: string, as?: string, extra: ExtraI18n = {}): I18n {
  const out: I18n = { en, hi: hi ?? en, as: as ?? hi ?? en };
  for (const [k, v] of Object.entries(extra)) if (v) (out as Record<string, string>)[k] = v;
  return out;
}

export function pick(text: I18n | undefined, lang: Lang): string {
  if (!text) return "";
  return (text as Record<string, string | undefined>)[lang] || text.en;
}

/** Map every language present in `text` through f (keeps en/hi/as, plus any extra languages). */
export function mapI18n(text: I18n, f: (s: string, lang: Lang) => string): I18n {
  const out = {} as Record<string, string>;
  for (const l of ALL_LANGS) {
    const v = (text as Record<string, string | undefined>)[l];
    if (v !== undefined) out[l] = f(v, l);
  }
  return out as I18n;
}

/** Combine several I18n values per language (missing languages fall back to English for that part). */
export function joinI18n(parts: I18n[], sep = ""): I18n {
  const langs = ALL_LANGS.filter((l) => parts.some((p) => (p as Record<string, string | undefined>)[l] !== undefined));
  const out = {} as Record<string, string>;
  for (const l of langs) out[l] = parts.map((p) => pick(p, l)).join(sep);
  return out as I18n;
}

/** Simple {name} interpolation across all languages present. */
export function fill(text: I18n, vars: Record<string, string | number>): I18n {
  return mapI18n(text, (s) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)));
}
