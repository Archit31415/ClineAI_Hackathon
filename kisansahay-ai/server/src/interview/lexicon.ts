/**
 * Multilingual lexicon for the scripted slot-filler (Level-2 fallback; no LLM needed).
 * Human-reviewed word lists in en / hi (Devanagari + romanised) / as (Assamese script).
 */
export const STATES: Record<string, string[]> = {
  Assam: ["assam", "असम", "অসম", "axom"],
  "Uttar Pradesh": ["uttar pradesh", "up ", "u.p.", "उत्तर प्रदेश", "यूपी", "উত্তৰ প্ৰদেশ"],
  Bihar: ["bihar", "बिहार", "বিহাৰ"],
  "West Bengal": ["west bengal", "bengal", "पश्चिम बंगाल", "পশ্চিমবংগ"],
};

/** district -> state */
export const DISTRICTS: Record<string, { state: string; words: string[] }> = {
  Nagaon: { state: "Assam", words: ["nagaon", "nogaon", "नगांव", "नगाँव", "নগাঁও", "নগাওঁ", "নগাও"] },
  Kamrup: { state: "Assam", words: ["kamrup", "guwahati", "कामरूप", "গুৱাহাটী", "কামৰূপ"] },
  Goalpara: { state: "Assam", words: ["goalpara", "গোৱালপাৰা"] },
  Jorhat: { state: "Assam", words: ["jorhat", "যোৰহাট"] },
  Barpeta: { state: "Assam", words: ["barpeta", "বৰপেটা"] },
  Morigaon: { state: "Assam", words: ["morigaon", "মৰিগাঁও"] },
  Lucknow: { state: "Uttar Pradesh", words: ["lucknow", "lakhnau", "लखनऊ", "लखनउ", "लक्नो", "लखनो", "लक्नौ"] },
  Barabanki: { state: "Uttar Pradesh", words: ["barabanki", "बाराबंकी", "बारबंकी"] },
  Sitapur: { state: "Uttar Pradesh", words: ["sitapur", "सीतापुर"] },
  Kanpur: { state: "Uttar Pradesh", words: ["kanpur", "कानपुर"] },
  Unnao: { state: "Uttar Pradesh", words: ["unnao", "उन्नाव"] },
  Hardoi: { state: "Uttar Pradesh", words: ["hardoi", "हरदोई"] },
};

export const CROPS: Record<string, string[]> = {
  paddy: ["paddy", "rice", "dhan", "धान", "चावल", "ধান", "ধান্য", "চাউল"],
  wheat: ["wheat", "gehu", "gehun", "गेहूं", "गेहूँ", "गेंहू", "गेहू", "गे हूँ", "गे हूं", "ঘেঁহু"],
  mustard: ["mustard", "sarson", "सरसों", "সৰিয়হ"],
  maize: ["maize", "corn", "makka", "मक्का", "মাকৈ"],
  potato: ["potato", "aloo", "आलू", "আলু"],
  jute: ["jute", "पटसन", "মৰাপাট"],
};

export const LOSS_TYPES: Record<string, string[]> = {
  hail: ["hail", "hailstorm", "ola", "ओला", "ओलावृष्टि", "শিলাবৃষ্টি", "শিল"],
  flood: ["flood", "baadh", "बाढ़", "बाढ", "বানপানী", "বান"],
  drought: ["drought", "sookha", "सूखा", "খৰাং"],
  pest: ["pest", "insect attack", "कीट", "পোক"],
};

export const WHEN_WORDS: { days: number; words: string[] }[] = [
  { days: 0, words: ["today", "aaj", "आज", "আজি"] },
  { days: 1, words: ["yesterday", "kal", "कल", "কালি"] },
  { days: 2, words: ["day before yesterday", "parso", "परसों", "পৰহি"] },
];

export const PAIN: Record<string, string[]> = {
  stuck_payment: ["installment", "instalment", "kisht", "किस्त", "pm-kisan", "pm kisan", "पीएम किसान", "not received", "नहीं आई", "stuck", "কিস্তি"],
  sell_produce: ["sell", "bechna", "बेचना", "बेचने", "mandi", "मंडी", "price", "भाव", "বিক্ৰী", "দাম"],
  soil: ["soil card", "soil health", "मृदा", "मिट्टी", "soil", "মাটি কাৰ্ড", "মাটি পৰীক্ষা"],
  equipment: ["tractor", "machine", "machinery", "ट्रैक्टर", "मशीन", "যন্ত্ৰ"],
  credit: ["loan", "credit", "kcc", "कर्ज", "ऋण", "লোন", "ঋণ"],
  organic: ["organic", "jaivik", "जैविक", "জৈৱিক"],
  irrigation: ["pump", "irrigation", "solar", "सिंचाई", "पंप", "জলসিঞ্চন", "পাম্প"],
  animal_health: ["cow", "buffalo", "goat", "cattle", "गाय", "भैंस", "बकरी", "পশু", "গৰু", "ম'হ", "ছাগলী"],
  disease: ["leaf", "leaves", "spots", "yellow", "पत्ती", "पत्तियों", "धब्बे", "पीली", "পাত", "দাগ", "হালধীয়া"],
};

export const CATEGORY: Record<string, string[]> = {
  general: ["general", "सामान्य", "সাধাৰণ"],
  obc: ["obc", "ओबीसी", "পিছপৰা"],
  sc: ["sc", "scheduled caste", "अनुसूचित जाति", "অনুসূচিত জাতি"],
  st: ["st", "scheduled tribe", "tribal", "अनुसूचित जनजाति", "जनजाति", "জনজাতি"],
};

export const OWNERSHIP: Record<string, string[]> = {
  owner: ["own", "owner", "my land", "मेरी जमीन", "अपनी", "मालिक", "নিজৰ মাটি", "নিজৰ"],
  tenant: ["tenant", "lease", "rent", "किराये", "ठेके", "ভাড়া"],
  sharecropper: ["sharecrop", "batai", "बटाई", "আধি"],
};

export const YES = ["yes", "haan", "ha", "हाँ", "हां", "जी", "হয়", "হয়", "ঠিক", "correct", "sahi", "सही"];
export const NO = ["no", "nahi", "नहीं", "ना", "নহয়", "নাই", "না"];

/** Native digits -> ASCII (Devanagari + Bengali/Assamese). */
export function normDigits(s: string): string {
  return s
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
}

/** Number words (small) for spoken land sizes. */
export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, half: 0.5,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, आधा: 0.5,
  এক: 1, দুই: 2, দু: 2, তিনি: 3, চাৰি: 4, পাঁচ: 5, আধা: 0.5,
};
