import type { ClineAdapter } from "./adapter";
import { FixtureClineAdapter } from "./fixture";
import { SdkClineAdapter } from "./sdk";

let instance: ClineAdapter | undefined;

export function getCline(): ClineAdapter {
  if (!instance) {
    instance = (process.env.CLINE_MODE ?? "fixture") === "sdk" ? new SdkClineAdapter() : new FixtureClineAdapter();
  }
  return instance;
}

/** For tests. */
export function setCline(a: ClineAdapter | undefined): void {
  instance = a;
}

export function clineTimeout(): number {
  return Number(process.env.CLINE_TIMEOUT_MS || 20000);
}
