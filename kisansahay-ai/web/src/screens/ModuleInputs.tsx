/**
 * Module-specific inputs for direct tile entry (bypasses the router, still uses the shared profile).
 */
import { useState, type ReactNode } from "react";
import type { ClaimInput, Lang, ModuleId } from "@kisansahay/contracts/types";
import { CameraCapture, type Capture } from "../components/CameraCapture";
import { Btn } from "../components/common";
import { ui } from "../lib/i18n";
import { Chips, CROP_FEATURES, LIVESTOCK_FEATURES } from "./featureChips";

const SHOTS: ClaimInput["evidence"][number]["shot_type"][] = ["wide", "close", "other", "boundary"];
type Ev = ClaimInput["evidence"];

export function ModuleInputs({ id, lang, defaultCrop, busy, onRun }: {
  id: ModuleId; lang: Lang; defaultCrop?: string; busy: boolean; onRun: (input: unknown) => void;
}) {
  const [features, setFeatures] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Capture | null>(null);
  const [evidence, setEvidence] = useState<Ev>([]);
  const [commodity, setCommodity] = useState(defaultCrop ?? "wheat");
  const [quintals, setQuintals] = useState("20");
  const [species, setSpecies] = useState("cattle");
  const [soil, setSoil] = useState<Record<string, string>>({ pH: "", EC: "", OC: "", N: "", P: "", K: "", S: "", Zn: "" });
  const toggle = (f: string) => setFeatures((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));
  const runBtn = (input: unknown): ReactNode => <Btn className="w-full" disabled={busy} onClick={() => onRun(input)}>▶ {ui("run", lang)}</Btn>;
  const symptoms = <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ui("type_here", lang)} className="w-full rounded-xl border px-3 py-2" />;

  switch (id) {
    case "claim": {
      const add = (s: Ev[number]["shot_type"], c: Capture) =>
        setEvidence((ev) => [...ev.filter((e) => e.shot_type !== s), { image_data_url: c.data_url, captured_at: c.captured_at, sha256: c.sha256, gps: c.gps, shot_type: s }]);
      return (
        <div className="space-y-3">
          {SHOTS.map((s) => (
            <div key={s}>
              <p className="text-sm font-semibold capitalize">{s} {evidence.some((e) => e.shot_type === s) && "✅"}</p>
              <CameraCapture lang={lang} askGps={s === "wide"} onCapture={(c) => add(s, c)} />
            </div>
          ))}
          {/* Photos stay on the device: only hash + metadata are sent. */}
          {runBtn({ evidence: evidence.map((e) => ({ ...e, image_data_url: "data:image/jpeg;base64,omitted" })) })}
        </div>
      );
    }
    case "crop_doctor":
      return (
        <div className="space-y-3">
          <CameraCapture lang={lang} onCapture={setPhoto} aiRead />
          <Chips options={CROP_FEATURES} sel={features} toggle={toggle} />
          {symptoms}
          {runBtn({ crop: defaultCrop, features, symptoms_text: text || undefined, image_data_url: photo?.data_url })}
        </div>
      );
    case "livestock":
      return (
        <div className="space-y-3">
          <select value={species} onChange={(e) => setSpecies(e.target.value)} className="rounded-xl border px-3 py-2">
            {["cattle", "buffalo", "goat", "poultry"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <Chips options={LIVESTOCK_FEATURES} sel={features} toggle={toggle} />
          <CameraCapture lang={lang} onCapture={setPhoto} aiRead />
          {symptoms}
          {runBtn({ species, features, symptoms_text: text || undefined, image_data_url: photo?.data_url })}
        </div>
      );
    case "mandi":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select value={commodity} onChange={(e) => setCommodity(e.target.value)} className="flex-1 rounded-xl border px-3 py-2">
              {["wheat", "paddy", "mustard"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input inputMode="decimal" value={quintals} onChange={(e) => setQuintals(e.target.value)} className="w-24 rounded-xl border px-3 py-2" /> q
          </div>
          {runBtn({ commodity, quintals: Number(quintals) || 0 })}
        </div>
      );
    case "soil_card": {
      const values = Object.fromEntries(Object.entries(soil).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
      return (
        <div className="space-y-3">
          <CameraCapture lang={lang} onCapture={setPhoto} label="Soil Health Card" aiRead />
          <p className="text-sm text-stone-500">…or type the values:</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(soil).map((k) => (
              <label key={k} className="text-xs">{k}
                <input inputMode="decimal" value={soil[k]} onChange={(e) => setSoil({ ...soil, [k]: e.target.value })} className="w-full rounded border px-1 py-1 text-base" />
              </label>
            ))}
          </div>
          {runBtn(Object.keys(values).length ? { values, crop: defaultCrop } : { image_data_url: photo?.data_url, crop: defaultCrop })}
        </div>
      );
    }
    case "advisory":
      return (
        <div className="flex gap-2">
          <Btn className="flex-1" disabled={busy} onClick={() => onRun({})}>▶ {ui("run", lang)}</Btn>
          <Btn kind="ghost" disabled={busy} onClick={() => onRun({ simulate_days_ahead: 1 })}>⏭ Simulate tomorrow</Btn>
        </div>
      );
    default:
      return runBtn(undefined);
  }
}
