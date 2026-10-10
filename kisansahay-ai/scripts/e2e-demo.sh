#!/usr/bin/env bash
# Runs the three demo personas end to end against a running server (default http://localhost:8787).
# Usage: npm start (in another terminal) && bash scripts/e2e-demo.sh
set -euo pipefail
BASE="${BASE:-http://localhost:8787}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${OUT:-/tmp/kisansahay-e2e}"
mkdir -p "$OUT"

node --input-type=module - "$BASE" "$DIR" "$OUT" <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";
const [base, dir, out] = process.argv.slice(2);
const P = JSON.parse(readFileSync(`${dir}/data/fixtures/personas.json`, "utf8"));
const post = async (path, body) => {
  const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j)}`);
  return j;
};
const runs = {
  anita: [["claim"], ["schemes"], ["advisory"]],
  ramesh: [["schemes"], ["soil_card", { values: P.ramesh.soil_values, crop: "wheat" }], ["mandi", { commodity: "wheat", quintals: 20 }]],
  kamal: [["livestock", P.kamal.livestock_input], ["schemes"]],
};
for (const [who, mods] of Object.entries(runs)) {
  const t0 = Date.now();
  const p = P[who];
  const turn = await post("/api/interview/turn", { session_id: `e2e-${who}-${t0}`, lang: p.utterance.lang, user_text: p.utterance.text, profile: { lang: p.utterance.lang } });
  const results = [];
  for (const [id, input] of mods) results.push(await post(`/api/modules/${id}/run`, { profile: p.profile, input }));
  const plan = await post("/api/plan", { profile: p.profile, results });
  const d = await post("/api/dossier", { plan });
  writeFileSync(`${out}/${who}.pdf`, Buffer.from(d.pdf_base64, "base64"));
  writeFileSync(`${out}/${who}.txt`, d.whatsapp_text);
  console.log(`\n=== ${who} (${p.utterance.lang}) — ${Date.now() - t0} ms`);
  console.log(`router intents: ${turn.intents.join(" → ")}`);
  for (const r of results) console.log(`  [${r.module}] ${r.status}: ${r.headline.en}`);
  console.log(`  first action: ${plan.ordered_actions[0]?.label.en}`);
  console.log(`  WhatsApp: ${d.whatsapp_text.length} chars · PDF → ${out}/${who}.pdf`);
}
EOF
