/**
 * Script-aware text runs for pdf-lib: Devanagari -> Noto Sans Devanagari, Bengali/Assamese -> Noto Sans Bengali,
 * everything else -> Noto Sans. Unsupported glyphs are replaced so the PDF never breaks.
 */
import { readFileSync } from "node:fs";
// @pdf-lib/fontkit's Indic (Devanagari/Bengali) shaper expects a global regeneratorRuntime.
import "regenerator-runtime/runtime.js";
import fontkit from "@pdf-lib/fontkit";
import {
  beginText, endText, PDFHexString, setFillingRgbColor, setFontAndSize, setTextMatrix, showText,
  type PDFDocument, type PDFFont, type PDFPage, type RGB,
} from "pdf-lib";
import { dataPath } from "../lib/paths";

export type Script = "latin" | "deva" | "beng";

const FILES: Record<Script, string> = {
  latin: "NotoSans-Regular.ttf",
  deva: "NotoSansDevanagari-Regular.ttf",
  beng: "NotoSansBengali-Regular.ttf",
};

const bytesCache = new Map<Script, Buffer>();
const fkCache = new Map<Script, { hasGlyphForCodePoint(cp: number): boolean }>();

function fontBytes(s: Script): Buffer {
  if (!bytesCache.has(s)) bytesCache.set(s, readFileSync(dataPath("fonts", FILES[s])));
  return bytesCache.get(s)!;
}
function fkFont(s: Script) {
  if (!fkCache.has(s)) fkCache.set(s, (fontkit as unknown as { create(b: Buffer): { hasGlyphForCodePoint(cp: number): boolean } }).create(fontBytes(s)));
  return fkCache.get(s)!;
}

export type Fonts = Record<Script, PDFFont>;

export async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  // subset:false keeps Indic shaping tables intact (conjuncts / matras)
  const [latin, deva, beng] = await Promise.all((["latin", "deva", "beng"] as Script[]).map((s) => doc.embedFont(fontBytes(s), { subset: false })));
  return { latin, deva, beng };
}

const SUBST: Record<string, string> = { "✓": "+", "✗": "x", "⏰": "", "🔴": "", "🟡": "", "📄": "", "💡": "" };

export function scriptOf(cp: number): Script | null {
  if (cp >= 0x0900 && cp <= 0x097f) return "deva";
  if (cp >= 0x0980 && cp <= 0x09ff) return "beng";
  // Shared combining marks / danda / ZWJ stay with the current run
  if (cp === 0x200c || cp === 0x200d || cp === 0x0964 || cp === 0x0965) return null;
  return "latin";
}

/** Split text into runs of a single script; replace glyphs the chosen font lacks. */
export function runs(text: string): { script: Script; text: string }[] {
  const out: { script: Script; text: string }[] = [];
  for (const ch of text) {
    const sub = SUBST[ch];
    const c = sub !== undefined ? sub : ch;
    if (!c) continue;
    const cp = c.codePointAt(0)!;
    let sc = scriptOf(cp) ?? out[out.length - 1]?.script ?? "deva";
    if (sc === "latin" && c.trim() && !fkFont("latin").hasGlyphForCodePoint(cp)) {
      out.push({ script: "latin", text: "?" });
      continue;
    }
    // spaces/punctuation join the previous run to keep runs long
    if (sc === "latin" && /[\s.,:;()\-–—/·!?'"%+0-9₹]/.test(c) && out.length && out[out.length - 1].script !== "latin" && fkFont(out[out.length - 1].script).hasGlyphForCodePoint(cp)) {
      sc = out[out.length - 1].script;
    }
    const last = out[out.length - 1];
    if (last && last.script === sc) last.text += c;
    else out.push({ script: sc, text: c });
  }
  return out;
}

type Shaped = { glyphs: { id: number }[]; positions: { xAdvance: number; xOffset: number; yOffset: number }[] };
type FkFont = { layout(t: string): Shaped; unitsPerEm: number };
const fkLayout = (s: Script) => fkFont(s) as unknown as FkFont;

/** Width from the shaped run (includes GPOS advances), consistent with drawing. */
function runWidth(s: Script, text: string, size: number): number {
  const f = fkLayout(s);
  const { positions } = f.layout(text);
  return (positions.reduce((a, p) => a + p.xAdvance, 0) * size) / f.unitsPerEm;
}

export function measure(text: string, _fonts: Fonts, size: number): number {
  return runs(text).reduce((w, r) => w + runWidth(r.script, r.text, size), 0);
}

/**
 * Draw shaped glyphs one by one at their GPOS-adjusted positions.
 * pdf-lib's drawText emits the shaped glyph ids but drops positioning (xOffset/yOffset, mark
 * attachment), which breaks Indic matras and conjuncts. Fonts are embedded as Identity-H, so
 * CID == glyph id and we can show each glyph by id.
 */
export function drawRuns(page: PDFPage, text: string, x: number, y: number, fonts: Fonts, size: number, color: RGB): number {
  let cx = x;
  for (const r of runs(text)) {
    const font = fonts[r.script];
    const fk = fkLayout(r.script);
    const scale = size / fk.unitsPerEm;
    const { glyphs, positions } = fk.layout(r.text);
    const key = page.node.newFontDictionary(font.name, font.ref);
    const ops = [beginText(), setFillingRgbColor(color.red, color.green, color.blue), setFontAndSize(key, size)];
    for (let i = 0; i < glyphs.length; i++) {
      const p = positions[i];
      ops.push(setTextMatrix(1, 0, 0, 1, cx + p.xOffset * scale, y + p.yOffset * scale));
      ops.push(showText(PDFHexString.of(glyphs[i].id.toString(16).padStart(4, "0"))));
      cx += p.xAdvance * scale;
    }
    ops.push(endText());
    page.pushOperators(...ops);
  }
  return cx - x;
}

/** Greedy word wrap using script-aware widths. */
export function wrap(text: string, fonts: Fonts, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (measure(cand, fonts, size) <= maxWidth || !line) line = cand;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
