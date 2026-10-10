/**
 * Injectable clock. DEMO_NOW freezes "now" so countdowns are reproducible in demos/tests.
 */
let override: string | undefined;

export function setNow(iso: string | undefined): void {
  override = iso;
}

export function now(): Date {
  const iso = override ?? process.env.DEMO_NOW;
  if (iso && iso.trim()) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function nowIso(): string {
  return toIst(now());
}

/** Format a Date as ISO-8601 with +05:30 offset (IST), seconds precision. */
export function toIst(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().replace(/\.\d{3}Z$/, "+05:30");
}

export function addHours(iso: string, hours: number): string {
  return toIst(new Date(new Date(iso).getTime() + hours * 3600 * 1000));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400 * 1000);
}

/** YYYY-MM-DD in IST. */
export function istDate(d: Date): string {
  return toIst(d).slice(0, 10);
}
