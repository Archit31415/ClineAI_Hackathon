/**
 * Shared camera component: returns data_url (downscaled JPEG), timestamp, SHA-256, optional GPS (explicit consent),
 * plus a client-side quality check (brightness + blur via Laplacian variance) that prompts a retake.
 */
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@kisansahay/contracts/types";
import { cachedHealth } from "../lib/api";
import { ui } from "../lib/i18n";

export interface Capture {
  data_url: string;
  captured_at: string;
  sha256: string;
  gps?: { lat: number; lng: number };
  quality: "ok" | "poor";
}

async function sha256(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl);
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function istNow(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, "+05:30");
}

async function process(file: File): Promise<{ dataUrl: string; quality: "ok" | "poor" }> {
  const img = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  // quality: sample a grey 128px thumbnail
  const s = 128;
  const t = document.createElement("canvas");
  t.width = s; t.height = s;
  const tc = t.getContext("2d")!;
  tc.drawImage(c, 0, 0, s, s);
  const px = tc.getImageData(0, 0, s, s).data;
  const g = new Float32Array(s * s);
  let mean = 0;
  for (let i = 0; i < s * s; i++) { g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; mean += g[i]; }
  mean /= s * s;
  let lapSum = 0, lapSq = 0, n = 0;
  for (let y = 1; y < s - 1; y++) for (let x = 1; x < s - 1; x++) {
    const i = y * s + x;
    const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - s] - g[i + s];
    lapSum += l; lapSq += l * l; n++;
  }
  const variance = lapSq / n - (lapSum / n) ** 2;
  const quality = mean < 40 || mean > 235 || variance < 60 || img.width < 300 ? "poor" : "ok";
  return { dataUrl: c.toDataURL("image/jpeg", 0.82), quality };
}

export function CameraCapture({ lang, onCapture, label, askGps = false, aiRead = false }: {
  lang: Lang; onCapture: (c: Capture) => void; label?: string; askGps?: boolean;
  /** True when the server would interpret this photo with AI; shows a hint if vision is not set up. */
  aiRead?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [aiHint, setAiHint] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!aiRead) return;
    let live = true;
    cachedHealth().then((h) => { if (live) setAiHint((h.vision?.provider ?? "none") !== "none"); }).catch(() => undefined);
    return () => { live = false; };
  }, [aiRead]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Capture | null>(null);
  const [gpsConsent, setGpsConsent] = useState(false);

  async function handle(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const { dataUrl, quality } = await process(file);
      const cap: Capture = { data_url: dataUrl, captured_at: istNow(), sha256: await sha256(dataUrl), quality };
      if (askGps && gpsConsent && navigator.geolocation) {
        cap.gps = await new Promise((res) =>
          navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(undefined), { timeout: 6000 }),
        );
      }
      setPreview(cap);
      onCapture(cap);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {askGps && (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={gpsConsent} onChange={(e) => setGpsConsent(e.target.checked)} />
          📍 {ui("share_location", lang)}
        </label>
      )}
      {aiHint === false && (
        <p className="rounded-lg bg-stone-100 p-2 text-xs text-stone-600">ℹ️ {ui("photo_needs_ai", lang)}</p>
      )}
      <button onClick={() => ref.current?.click()} disabled={busy} className="w-full rounded-xl border-2 border-dashed border-green-700 bg-green-50 p-4 text-lg font-semibold text-green-800">
        📷 {busy ? "…" : preview ? ui("retake", lang) : label ?? ui("take_photo", lang)}
      </button>
      {preview && (
        <div className="flex items-center gap-3">
          <img src={preview.data_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
          <div className="text-xs text-stone-600">
            <div>{preview.captured_at.replace("T", " ").slice(0, 16)}</div>
            {preview.gps && <div>📍 {preview.gps.lat.toFixed(4)}, {preview.gps.lng.toFixed(4)}</div>}
            <div className="font-mono">#{preview.sha256.slice(0, 10)}</div>
            {preview.quality === "poor" && <div className="font-semibold text-red-700">⚠️ blurry / dark — please retake</div>}
          </div>
        </div>
      )}
    </div>
  );
}
