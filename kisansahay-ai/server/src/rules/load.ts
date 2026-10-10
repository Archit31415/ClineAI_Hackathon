import { readdirSync, readFileSync } from "node:fs";
import { dataPath } from "../lib/paths";
import { SchemeRuleZ, type SchemeRule } from "./schema";

/** Load published scheme rules (ignores `_` prefixed files and the _drafts folder). */
export function loadSchemes(): SchemeRule[] {
  const dir = dataPath("schemes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => SchemeRuleZ.parse(JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function loadScheme(id: string): SchemeRule | undefined {
  return loadSchemes().find((s) => s.id === id);
}
