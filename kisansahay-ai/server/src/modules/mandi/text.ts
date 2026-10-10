import type { I18n, MandiBody } from "@kisansahay/contracts";
import { t } from "../../lib/i18n";
import { WAIT_DAY_CAP } from "./logic";

type Opt = MandiBody["options"][number];

const NOT_FORECAST = t(" This is a comparison, not a price forecast.", " यह तुलना है, मूल्य पूर्वानुमान नहीं।", " এইটো তুলনা, দামৰ পূৰ্বানুমান নহয়।");
const join = (a: I18n, b: I18n): I18n => ({ en: a.en + b.en, hi: a.hi + b.hi, as: a.as + b.as });
const inr = (n: number) => n.toLocaleString("en-IN");

export function reasonText(p: {
  recommendation: MandiBody["recommendation"];
  bestOpt?: Opt; nearest?: Opt; trend: MandiBody["trend"];
  commodity: string; state: string; quintals: number;
}): I18n {
  const { recommendation, bestOpt, nearest, trend, commodity, state, quintals } = p;
  let r: I18n;
  if (!bestOpt) {
    r = t(`No recent ${commodity} prices for ${state}. Ask at your nearest mandi before selling.`,
      `${state} में ${commodity} के हाल के भाव नहीं मिले। बेचने से पहले नज़दीकी मंडी में पूछें।`,
      `${state} ত ${commodity} ৰ শেহতীয়া দাম পোৱা নগ'ল। বিক্ৰীৰ আগতে ওচৰৰ মাণ্ডীত সোধক।`);
  } else if (recommendation === "wait") {
    r = t(`Prices at ${bestOpt.mandi} rose ${trend.change_pct}% over ${trend.days} days. If you can store safely, consider waiting up to ${WAIT_DAY_CAP} days and re-check.`,
      `${bestOpt.mandi} में ${trend.days} दिनों में भाव ${trend.change_pct}% बढ़े। सुरक्षित भंडारण हो तो ${WAIT_DAY_CAP} दिन तक रुककर फिर देखें।`,
      `${bestOpt.mandi} ত ${trend.days} দিনত দাম ${trend.change_pct}% বাঢ়িছে। নিৰাপদে ৰাখিব পাৰিলে ${WAIT_DAY_CAP} দিনলৈ ৰৈ আকৌ চাওক।`);
  } else if (recommendation === "sell_now") {
    const extra = nearest && bestOpt.mandi !== nearest.mandi ? bestOpt.net_per_q - nearest.net_per_q : 0;
    const total = inr(bestOpt.net_per_q * quintals);
    r = t(`${bestOpt.mandi} gives the best price after transport: ₹${bestOpt.net_per_q}/q net (₹${bestOpt.modal_price} − ₹${bestOpt.transport_cost_per_q} transport)${extra > 0 && nearest ? `, ₹${extra}/q more than ${nearest.mandi}` : ""}. For ${quintals} q that is about ₹${total}.`,
      `परिवहन के बाद ${bestOpt.mandi} में सबसे अच्छा भाव: ₹${bestOpt.net_per_q}/क्विंटल शुद्ध${extra > 0 && nearest ? `, ${nearest.mandi} से ₹${extra}/क्विंटल अधिक` : ""}। ${quintals} क्विंटल पर लगभग ₹${total}।`,
      `পৰিবহনৰ পিছত ${bestOpt.mandi} ত সৰ্বোত্তম দাম: ₹${bestOpt.net_per_q}/কুইণ্টল নিকা${extra > 0 && nearest ? `, ${nearest.mandi} তকৈ ₹${extra}/কুইণ্টল বেছি` : ""}। ${quintals} কুইণ্টলত প্ৰায় ₹${total}।`);
  } else {
    r = t("Price data is thin; compare 2–3 nearby mandis by phone before travelling.", "भाव का डेटा कम है; जाने से पहले 2–3 नज़दीकी मंडियों से फ़ोन पर भाव पूछें।", "দামৰ তথ্য কম; যোৱাৰ আগতে ২–৩ টা ওচৰৰ মাণ্ডীৰ দাম ফোনত সোধক।");
  }
  return join(r, NOT_FORECAST);
}

export function headlineText(recommendation: MandiBody["recommendation"], bestOpt?: Opt): I18n {
  if (!bestOpt) return t("No recent mandi prices found", "हाल के मंडी भाव नहीं मिले", "শেহতীয়া মাণ্ডীৰ দাম পোৱা নগ'ল");
  const n = bestOpt.net_per_q;
  if (recommendation === "wait") return t(`Consider waiting — best now ₹${n}/q at ${bestOpt.mandi}`, `रुकने पर विचार करें — अभी ${bestOpt.mandi} में ₹${n}/क्विंटल`, `ৰৈ থকাৰ কথা ভাবক — এতিয়া ${bestOpt.mandi} ত ₹${n}/কুইণ্টল`);
  return t(`Best net price: ${bestOpt.mandi} — ₹${n}/q`, `सबसे अच्छा शुद्ध भाव: ${bestOpt.mandi} — ₹${n}/क्विंटल`, `সৰ্বোত্তম নিকা দাম: ${bestOpt.mandi} — ₹${n}/কুইণ্টল`);
}
