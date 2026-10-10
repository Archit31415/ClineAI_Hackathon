import type { I18n, Lang, ModuleId } from "@kisansahay/contracts/types";

export const pick = (t: I18n | undefined, lang: Lang) => (t ? t[lang] || t.en : "");

export const LANGS: { id: Lang; label: string; sub: string; bcp47: string }[] = [
  { id: "hi", label: "हिन्दी", sub: "Hindi", bcp47: "hi-IN" },
  { id: "as", label: "অসমীয়া", sub: "Assamese", bcp47: "as-IN" },
  { id: "en", label: "English", sub: "English", bcp47: "en-IN" },
];

export const MODULE_META: Record<ModuleId, { icon: string; name: I18n }> = {
  claim: { icon: "🌩️", name: { en: "Claim Assistant", hi: "बीमा दावा", as: "বীমা দাবী" } },
  schemes: { icon: "🏛️", name: { en: "Schemes", hi: "योजनाएँ", as: "আঁচনি" } },
  soil_card: { icon: "🧪", name: { en: "Soil Card", hi: "मृदा कार्ड", as: "মাটি কাৰ্ড" } },
  mandi: { icon: "⚖️", name: { en: "Mandi Prices", hi: "मंडी भाव", as: "মাণ্ডীৰ দাম" } },
  crop_doctor: { icon: "🌾", name: { en: "Crop Doctor", hi: "फसल डॉक्टर", as: "শস্য চিকিৎসক" } },
  advisory: { icon: "🌦️", name: { en: "Weather Advice", hi: "मौसम सलाह", as: "বতৰ পৰামৰ্শ" } },
  livestock: { icon: "🐄", name: { en: "Animal Health", hi: "पशु स्वास्थ्य", as: "পশু স্বাস্থ্য" } },
};

export const TIER_LABEL: Record<string, I18n> = {
  deep: { en: "Deep", hi: "गहन", as: "গভীৰ" },
  working: { en: "Working", hi: "कार्यरत", as: "কাৰ্যক্ষম" },
  prototype: { en: "Prototype", hi: "प्रोटोटाइप", as: "প্ৰ'ট'টাইপ" },
};

const UI = {
  tagline: { en: "Tell me your problem", hi: "अपनी समस्या बताइए", as: "আপোনাৰ সমস্যা কওক" },
  type_here: { en: "Type here…", hi: "यहाँ लिखें…", as: "ইয়াত লিখক…" },
  send: { en: "Send", hi: "भेजें", as: "পঠিয়াওক" },
  listening: { en: "Listening…", hi: "सुन रहा हूँ…", as: "শুনি আছো…" },
  build_plan: { en: "Make my Action Plan", hi: "मेरी कार्य योजना बनाएँ", as: "মোৰ কাৰ্য পৰিকল্পনা বনাওক" },
  plan: { en: "Farm Action Plan", hi: "खेती कार्य योजना", as: "খেতিৰ কাৰ্য পৰিকল্পনা" },
  home: { en: "Home", hi: "होम", as: "ঘৰ" },
  coming_soon: { en: "Coming soon", hi: "जल्द आ रहा है", as: "সোনকালে আহিব" },
  run: { en: "Check", hi: "जाँचें", as: "পৰীক্ষা কৰক" },
  share_wa: { en: "Share on WhatsApp", hi: "WhatsApp पर भेजें", as: "WhatsApp ত পঠিয়াওক" },
  download_pdf: { en: "Download PDF", hi: "PDF डाउनलोड", as: "PDF ডাউনল'ড" },
  print: { en: "Print", hi: "प्रिंट", as: "প্ৰিণ্ট" },
  offline: { en: "Offline — showing your last saved plan", hi: "ऑफ़लाइन — आपकी पिछली योजना दिखा रहे हैं", as: "অফলাইন — আপোনাৰ শেষ পৰিকল্পনা দেখুওৱা হৈছে" },
  consent_title: { en: "Before we start", hi: "शुरू करने से पहले", as: "আৰম্ভ কৰাৰ আগতে" },
  consent_body: {
    en: "We use what you say to prepare advice and draft documents. Your details stay on this phone. We do not submit anything to government portals. Location is used only if you tap to share it (for claim evidence and local weather).",
    hi: "आप जो बताएँगे उससे हम सलाह और दस्तावेज़ का मसौदा बनाएँगे। आपकी जानकारी इसी फ़ोन पर रहेगी। हम किसी सरकारी पोर्टल पर कुछ जमा नहीं करते। लोकेशन तभी ली जाएगी जब आप साझा करें (दावे के सबूत और स्थानीय मौसम के लिए)।",
    as: "আপুনি কোৱা কথাৰে আমি পৰামৰ্শ আৰু নথিৰ খচৰা প্ৰস্তুত কৰো। আপোনাৰ তথ্য এই ফোনতে থাকিব। আমি কোনো চৰকাৰী প'ৰ্টেলত একো দাখিল নকৰো। আপুনি শ্বেয়াৰ কৰিলেহে অৱস্থান লোৱা হ'ব (দাবীৰ প্ৰমাণ আৰু স্থানীয় বতৰৰ বাবে)।",
  },
  agree: { en: "I agree", hi: "मैं सहमत हूँ", as: "মই সন্মত" },
  urgent: { en: "Do today", hi: "आज करें", as: "আজি কৰক" },
  next: { en: "Next", hi: "आगे", as: "পিছত" },
  later: { en: "Later", hi: "बाद में", as: "পিছলৈ" },
  documents: { en: "Documents to collect", hi: "दस्तावेज़ इकट्ठा करें", as: "নথি গোটাওক" },
  why: { en: "Why this order", hi: "यह क्रम क्यों", as: "এই ক্ৰম কিয়" },
  hours_left: { en: "hours left", hi: "घंटे बचे", as: "ঘণ্টা বাকী" },
  disclaimer: {
    en: "Prepared with AI assistance. Confirm with the official portal, your agriculture office or a veterinarian.",
    hi: "AI सहायता से तैयार। आधिकारिक पोर्टल, कृषि कार्यालय या पशु चिकित्सक से पुष्टि करें।",
    as: "AI সহায়ত প্ৰস্তুত। চৰকাৰী প'ৰ্টেল, কৃষি কাৰ্যালয় বা পশু চিকিৎসকৰ পৰা নিশ্চিত কৰক।",
  },
  agro_disclaimer: {
    en: "Use only registered products, read the label, wear protective gear, and ask the KVK / agriculture officer before spraying.",
    hi: "केवल पंजीकृत उत्पाद, लेबल पढ़ें, सुरक्षा उपकरण पहनें, छिड़काव से पहले KVK / कृषि अधिकारी से पूछें।",
    as: "কেৱল পঞ্জীভুক্ত সামগ্ৰী, লেবেল পঢ়ক, সুৰক্ষা সঁজুলি পিন্ধক, স্প্ৰেৰ আগতে KVK / কৃষি বিষয়াক সোধক।",
  },
  vet_disclaimer: { en: "Triage only — not a diagnosis. No medicine doses are given. Always call a vet.", hi: "केवल प्राथमिक जाँच — निदान नहीं। दवा की मात्रा नहीं दी जाती। हमेशा पशु चिकित्सक बुलाएँ।", as: "কেৱল প্ৰাথমিক পৰীক্ষা — ৰোগ নিৰ্ণয় নহয়। ঔষধৰ মাত্ৰা দিয়া নহয়। সদায় পশু চিকিৎসক মাতক।" },
  fin_disclaimer: { en: "Comparison with stated assumptions — not financial advice or a forecast.", hi: "बताई गई मान्यताओं के साथ तुलना — वित्तीय सलाह या पूर्वानुमान नहीं।", as: "উল্লিখিত অনুমানৰ সৈতে তুলনা — বিত্তীয় পৰামৰ্শ বা পূৰ্বানুমান নহয়।" },
  take_photo: { en: "Take photo", hi: "फ़ोटो लें", as: "ফটো লওক" },
  retake: { en: "Retake", hi: "फिर लें", as: "আকৌ লওক" },
  photo_needs_ai: {
    en: "Photo reading needs AI setup on the server (VISION_PROVIDER). Until then, please tap or type the symptoms / values.",
    hi: "फ़ोटो पढ़ने के लिए सर्वर पर AI सेटअप चाहिए। तब तक लक्षण / मान चुनें या टाइप करें।",
    as: "ফটো পঢ়িবলৈ ছাৰ্ভাৰত AI ছেটআপ লাগে। তেতিয়ালৈকে লক্ষণ / মান বাছক বা টাইপ কৰক।",
  },
  share_location: { en: "Share location (for evidence & weather)", hi: "लोकेशन साझा करें (सबूत व मौसम हेतु)", as: "অৱস্থান শ্বেয়াৰ কৰক (প্ৰমাণ আৰু বতৰৰ বাবে)" },
  confirm_values: { en: "Confirm values", hi: "मानों की पुष्टि करें", as: "মান নিশ্চিত কৰক" },
  cline_panel: { en: "Cline agent (in-product)", hi: "Cline एजेंट (प्रोडक्ट में)", as: "Cline এজেণ্ট (প্ৰডাক্টত)" },
  new_chat: { en: "New farmer", hi: "नया किसान", as: "নতুন কৃষক" },
} satisfies Record<string, I18n>;

export type UiKey = keyof typeof UI;
export const ui = (k: UiKey, lang: Lang) => pick(UI[k], lang);
