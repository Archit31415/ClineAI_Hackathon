/**
 * WhatsApp summary (<= 1,000 chars) + wa.me link. No PII beyond district.
 */
import type { ActionPlan, I18n, Lang } from "@kisansahay/contracts";
import { pick } from "../lib/i18n";

export const WHATSAPP_LIMIT = 1000;

const TITLE: I18n = { en: "KisanSahay Farm Action Plan", hi: "किसान सहाय खेती कार्य योजना", as: "কিষাণ সহায় খেতিৰ কাৰ্য পৰিকল্পনা" };
const URGENT: I18n = { en: "Do today", hi: "आज करें", as: "আজি কৰক" };
const NEXT: I18n = { en: "Next", hi: "आगे", as: "পিছত" };
const DOCS: I18n = { en: "Collect", hi: "इकट्ठा करें", as: "গোটাওক" };
const FOOT: I18n = {
  en: "AI-assisted. Confirm with the official portal, agriculture office or a vet.",
  hi: "AI सहायता से बना। आधिकारिक पोर्टल, कृषि कार्यालय या पशु चिकित्सक से पुष्टि करें।",
  as: "AI সহায়ত প্ৰস্তুত। চৰকাৰী প'ৰ্টেল, কৃষি কাৰ্যালয় বা পশু চিকিৎসকৰ পৰা নিশ্চিত কৰক।",
};

function fmtDue(iso?: string): string {
  if (!iso) return "";
  return ` (⏰ ${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)})`;
}

export function whatsappText(plan: ActionPlan, lang: Lang = plan.lang): string {
  const lines: string[] = [`*${pick(TITLE, lang)}*`];
  const urgent = plan.ordered_actions.filter((a) => a.priority === 1 && a.kind !== "collect_doc");
  const next = plan.ordered_actions.filter((a) => a.priority === 2 && a.kind !== "collect_doc");
  const docs = plan.documents ?? [];
  if (urgent.length) {
    lines.push(`\n🔴 *${pick(URGENT, lang)}*`);
    urgent.slice(0, 4).forEach((a) => lines.push(`• ${pick(a.label, lang)}${fmtDue(a.due_at)}`));
  }
  if (next.length) {
    lines.push(`\n🟡 *${pick(NEXT, lang)}*`);
    next.slice(0, 4).forEach((a) => lines.push(`• ${pick(a.label, lang)}`));
  }
  if (docs.length) lines.push(`\n📄 *${pick(DOCS, lang)}:* ${docs.slice(0, 6).map((d) => pick(d.name, lang).split(" (")[0]).join(", ")}`);
  if (plan.cross_notes[0]) lines.push(`\n💡 ${pick(plan.cross_notes[0], lang)}`);
  const foot = `\n_${pick(FOOT, lang)}_`;

  let text = lines.join("\n");
  if (text.length + foot.length > WHATSAPP_LIMIT) {
    // trim bullet lines from the end until it fits
    const parts = text.split("\n");
    while (parts.length > 2 && parts.join("\n").length + foot.length + 2 > WHATSAPP_LIMIT) parts.splice(parts.length - 1, 1);
    text = parts.join("\n") + "\n…";
  }
  return (text + foot).slice(0, WHATSAPP_LIMIT);
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
