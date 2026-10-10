/**
 * A4 dossier PDF: large type, language-aware (embedded Noto fonts), one section per module with
 * tier label + provenance, ordered checklist, documents, QR to official portals, disclaimer footer.
 * Photos are NOT embedded server-side (privacy): only counts/metadata appear.
 */
import QRCode from "qrcode";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import type { ActionPlan, I18n, Lang } from "@kisansahay/contracts";
import { pick } from "../lib/i18n";
import { registry } from "../modules/registry";
import { drawRuns, embedFonts, wrap, type Fonts } from "./fonts";

const A4: [number, number] = [595.28, 841.89];
const M = 42;
const GREEN = rgb(0.13, 0.45, 0.24);
const DARK = rgb(0.1, 0.1, 0.1);
const GREY = rgb(0.4, 0.4, 0.4);
const RED = rgb(0.75, 0.12, 0.12);

const L = {
  title: { en: "Farm Action Plan", hi: "खेती कार्य योजना", as: "খেতিৰ কাৰ্য পৰিকল্পনা" },
  todo: { en: "What to do (in order)", hi: "क्या करें (क्रम से)", as: "কি কৰিব (ক্ৰমে)" },
  docs: { en: "Documents to collect", hi: "इकट्ठा करने वाले दस्तावेज़", as: "গোটাবলগীয়া নথি" },
  notes: { en: "Why this order", hi: "यह क्रम क्यों", as: "এই ক্ৰম কিয়" },
  modules: { en: "Details by module", hi: "मॉड्यूल अनुसार विवरण", as: "মডিউল অনুসৰি বিৱৰণ" },
  portals: { en: "Official portals", hi: "आधिकारिक पोर्टल", as: "চৰকাৰী প'ৰ্টেল" },
  footer: {
    en: "Prepared with AI assistance. Confirm with the official portal, your agriculture office or a veterinarian. Nothing has been submitted on your behalf.",
    hi: "AI सहायता से तैयार। आधिकारिक पोर्टल, कृषि कार्यालय या पशु चिकित्सक से पुष्टि करें। आपकी ओर से कुछ भी जमा नहीं किया गया है।",
    as: "AI সহায়ত প্ৰস্তুত। চৰকাৰী প'ৰ্টেল, কৃষি কাৰ্যালয় বা পশু চিকিৎসকৰ পৰা নিশ্চিত কৰক। আপোনাৰ হৈ একো দাখিল কৰা হোৱা নাই।",
  },
} satisfies Record<string, I18n>;

const MODULE_NAMES: Record<string, I18n> = {
  claim: { en: "Claim Assistant", hi: "दावा सहायक", as: "দাবী সহায়ক" },
  schemes: { en: "Scheme Finder", hi: "योजना खोजक", as: "আঁচনি সন্ধানী" },
  soil_card: { en: "Soil Card", hi: "मृदा कार्ड", as: "মাটি কাৰ্ড" },
  mandi: { en: "Mandi Advisor", hi: "मंडी सलाहकार", as: "মাণ্ডী পৰামৰ্শদাতা" },
  crop_doctor: { en: "Crop Doctor", hi: "फसल डॉक्टर", as: "শস্য চিকিৎসক" },
  advisory: { en: "Weather Advisory", hi: "मौसम सलाह", as: "বতৰ পৰামৰ্শ" },
  livestock: { en: "Livestock Triage", hi: "पशु जाँच", as: "পশু পৰীক্ষা" },
};

const PORTALS = [
  { label: "PMFBY", url: "https://pmfby.gov.in" },
  { label: "PM-KISAN", url: "https://pmkisan.gov.in" },
  { label: "myScheme", url: "https://www.myscheme.gov.in" },
];

class Writer {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, private fonts: Fonts) {
    this.page = doc.addPage(A4);
    this.y = A4[1] - M;
  }
  ensure(h: number) {
    if (this.y - h < M + 40) { this.page = this.doc.addPage(A4); this.y = A4[1] - M; }
  }
  text(s: string, size = 12, color = DARK, indent = 0) {
    for (const line of wrap(s, this.fonts, size, A4[0] - 2 * M - indent)) {
      this.ensure(size * 1.5);
      drawRuns(this.page, line, M + indent, this.y - size, this.fonts, size, color);
      this.y -= size * 1.5;
    }
  }
  gap(h = 8) { this.y -= h; }
  rule() { this.ensure(10); this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4[0] - M, y: this.y }, thickness: 0.5, color: GREY }); this.y -= 8; }
}

export async function renderPdf(plan: ActionPlan, lang: Lang = plan.lang): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("KisanSahay Farm Action Plan");
  doc.setProducer("KisanSahay-AI");
  const fonts = await embedFonts(doc);
  const w = new Writer(doc, fonts);
  const tiers = new Map(registry().map((m) => [m.id, m.tier]));
  const P = (x: I18n | undefined) => pick(x, lang);

  w.text(`KisanSahay-AI · ${P(L.title)}`, 22, GREEN);
  w.text(`${plan.generated_at.slice(0, 16).replace("T", " ")} IST · ${plan.provenance}`, 10, GREY);
  w.rule();

  w.text(P(L.todo), 16, GREEN);
  plan.ordered_actions.filter((a) => a.kind !== "collect_doc").forEach((a, i) => {
    const due = a.due_at ? ` [${a.due_at.slice(0, 16).replace("T", " ")}]` : "";
    w.text(`${i + 1}. [ ] ${P(a.label)}${due}`, 13, a.priority === 1 ? RED : DARK, 6);
  });
  w.gap();

  if (plan.documents?.length) {
    w.text(P(L.docs), 16, GREEN);
    for (const d of plan.documents) w.text(`[ ] ${P(d.name)}`, 12, DARK, 6);
    w.gap();
  }
  if (plan.cross_notes.length || plan.explanation) {
    w.text(P(L.notes), 16, GREEN);
    if (plan.explanation) w.text(`• ${P(plan.explanation)}`, 12, DARK, 6);
    for (const n of plan.cross_notes) w.text(`• ${P(n)}`, 12, DARK, 6);
    w.gap();
  }

  w.rule();
  w.text(P(L.modules), 16, GREEN);
  for (const r of plan.results) {
    w.ensure(60);
    w.text(`${P(MODULE_NAMES[r.module])} — [${(tiers.get(r.module) ?? "").toUpperCase()}] · ${r.provenance}${r.confidence !== undefined ? ` · conf ${r.confidence}` : ""}`, 13, GREEN);
    w.text(P(r.headline), 12, DARK, 6);
    if (r.sources.length) w.text(`Sources: ${r.sources.slice(0, 3).map((s) => `${s.label} (${s.as_of})`).join("; ")}`, 9, GREY, 6);
    if (r.disclaimer !== "general") w.text(`Disclaimer: ${r.disclaimer}`, 9, GREY, 6);
    w.gap(4);
  }

  // QR codes to official portals
  w.rule();
  w.text(P(L.portals), 14, GREEN);
  w.ensure(110);
  let x = M;
  for (const p of PORTALS) {
    const png = await QRCode.toBuffer(p.url, { margin: 1, width: 180 });
    const img = await doc.embedPng(png);
    w.page.drawImage(img, { x, y: w.y - 80, width: 80, height: 80 });
    drawRuns(w.page, p.label, x, w.y - 94, fonts, 10, DARK);
    x += 120;
  }
  w.y -= 104;

  // footer on every page
  for (const page of doc.getPages()) {
    const lines = wrap(P(L.footer), fonts, 9, A4[0] - 2 * M);
    lines.forEach((ln, i) => drawRuns(page, ln, M, M - 4 + (lines.length - 1 - i) * 12, fonts, 9, GREY));
  }
  return doc.save();
}
