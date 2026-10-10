import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** Repo root (kisansahay-ai/). */
export const ROOT = resolve(here, "../../..");
export const DATA = resolve(ROOT, "data");

export function dataPath(...parts: string[]): string {
  return resolve(DATA, ...parts);
}

export function readJson<T = unknown>(...parts: string[]): T {
  return JSON.parse(readFileSync(dataPath(...parts), "utf8")) as T;
}

export function readJsonIfExists<T = unknown>(...parts: string[]): T | undefined {
  const p = dataPath(...parts);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : undefined;
}
