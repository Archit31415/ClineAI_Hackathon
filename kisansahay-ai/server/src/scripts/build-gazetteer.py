"""
Build data/geo/india.json (states + districts, 9-language names, centroids) from Wikidata (CC0).

Inputs (fetched beforehand from https://query.wikidata.org/):
  /tmp/wd_districts.json   per-state districts: labels {en,hi,mr,bn,as,ta,te,kn,ml} + P625 coord
  /tmp/wd_states.json      SPARQL JSON result with state labels
  /tmp/states-districts.json (optional) open list with old names in brackets, e.g. "Mysuru (Mysore)"
  (/tmp/wd_districts.json also includes ~45 districts Wikidata does not tag as Q1149652, e.g. Nagaon,
   Jammu & Kashmir, Sikkim; those were looked up by name with wbsearchentities and merged in.)
Run:  python3 server/src/scripts/build-gazetteer.py
The matcher in server/src/geo/gazetteer.ts adds romanised spellings at load time.
"""
import collections
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT = os.path.join(ROOT, "data/geo/india.json")
LANGS = ["en", "hi", "mr", "bn", "as", "ta", "te", "kn", "ml"]

# Current states + UTs (Wikidata also returns historical ones such as "Bombay State").
KEEP = {
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
    "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "National Capital Territory of Delhi", "Odisha",
    "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal",
}
STATE_ALIASES = {
    "Uttar Pradesh": ["UP", "U.P."], "National Capital Territory of Delhi": ["Delhi", "NCT"],
    "Odisha": ["Orissa"], "West Bengal": ["Bengal", "Paschimbanga"], "Tamil Nadu": ["Tamilnadu"],
    "Andhra Pradesh": ["AP"], "Madhya Pradesh": ["MP"], "Himachal Pradesh": ["HP"],
    "Jammu and Kashmir": ["J&K", "Kashmir"], "Puducherry": ["Pondicherry"], "Assam": ["Axom", "Asom"],
    "Himachal Pradesh": ["HP", "Himachal"], "Arunachal Pradesh": ["Arunachal"], "Maharashtra": ["Maharastra"],
    "Chhattisgarh": ["Chattisgarh", "Chhatisgarh"], "Karnataka": ["Karnatak"], "Telangana": ["Telengana"],
    "Uttarakhand": ["Uttaranchal"], "Kerala": ["Keralam"],
}
# Older / alternate English names people still use.
DISTRICT_ALIASES = {
    "Bengaluru Urban": ["Bangalore", "Bangalore Urban", "Bengaluru"], "Bengaluru Rural": ["Bangalore Rural"],
    "Mysuru": ["Mysore"], "Belagavi": ["Belgaum"], "Ballari": ["Bellary"], "Kalaburagi": ["Gulbarga"],
    "Shivamogga": ["Shimoga"], "Tumakuru": ["Tumkur"], "Vijayapura": ["Bijapur", "Vijaypura"],
    "Vijaypura": ["Bijapur", "Vijayapura"], "Chikkamagaluru": ["Chikmagalur"], "Ahilyanagar": ["Ahmednagar"],
    "Chhatrapati Sambhajinagar": ["Aurangabad"], "Dharashiv": ["Osmanabad"], "Prayagraj": ["Allahabad"],
    "Ayodhya": ["Faizabad"], "Thoothukudi": ["Tuticorin"], "Tiruchirappalli": ["Trichy", "Tiruchirapalli"],
    "Thiruvananthapuram": ["Trivandrum"], "Kozhikode": ["Calicut"], "Ernakulam": ["Kochi", "Cochin"],
    "Alappuzha": ["Alleppey"], "Kollam": ["Quilon"], "Palakkad": ["Palghat"], "Thrissur": ["Trichur"],
    "Purba Bardhaman": ["Burdwan", "Bardhaman", "বর্ধমান", "बर्धमान"], "Gurugram": ["Gurgaon"], "Nuh": ["Mewat"],
    "Kamrup Metropolitan": ["Guwahati"], "Lucknow": ["Lakhnau", "लखनउ", "लक्नो", "लखनो", "लक्नौ"],
    "Kanpur Nagar": ["Kanpur", "कानपुर"], "Barabanki": ["बारबंकी"],
    "Nagaon": ["Nowgong", "Nogaon", "नगांव", "নগাওঁ", "নগাও"], "Sivasagar": ["Sibsagar"], "Sribhumi": ["Karimganj"],
    "Bishwanath": ["Biswanath"], "Narmadapuram": ["Hoshangabad"], "Kutch": ["Kachchh"], "Debagarh": ["Deogarh"],
    "Subarnapur": ["Sonepur"], "Firozpur": ["Ferozepur"], "Sri Muktsar Sahib": ["Muktsar"], "Bagpat": ["Baghpat"],
    "Shaheed Bhagat Singh Nagar": ["Nawanshahr"], "Kanniyakumari": ["Kanyakumari"], "Sahebganj": ["Sahibganj"],
    "Davanagere": ["Davangere"], "Gariaband": ["Gariyaband"], "Puducherry": ["Pondicherry"],
}
SUFFIX = re.compile(r"\s*(district|District|जिला|ज़िला|जिल्हा|জেলা|জিলা|மாவட்டம்|జిల్లా|ಜಿಲ್ಲೆ|ജില്ല)\s*$")


def clean(s: str) -> str:
    return SUFFIX.sub("", s).strip()


districts = json.load(open("/tmp/wd_districts.json"))
state_labels = collections.defaultdict(dict)
for r in json.load(open("/tmp/wd_states.json"))["results"]["bindings"]:
    state_labels[r["s"]["value"]][r["l"]["xml:lang"]] = r["l"]["value"]
state_by_en = {v["en"]: v for v in state_labels.values() if "en" in v}

out = {
    "_source": {
        "label": "Wikidata (CC0): instances of 'district of India' (Q1149652) under current states/UTs",
        "url": "https://query.wikidata.org/",
        "retrieved": "2026-10-10",
        "note": "Names as given by Wikidata; centroids from P625. Some districts lack a label in a language or a "
                "centroid (fallback: English name / state's first district). Verify before production use.",
    },
    "states": {},
}
for st in sorted(KEEP):
    labels = {k: v for k, v in state_by_en.get(st, {"en": st}).items() if k in LANGS}
    seen, ds = set(), []
    for e in districts.get(st, {}).values():
        lab = {k: clean(v) for k, v in e["labels"].items() if k in LANGS and v}
        if "en" not in lab or lab["en"].lower() in seen:
            continue
        seen.add(lab["en"].lower())
        item = {"name": lab["en"], "names": {k: v for k, v in lab.items() if k != "en"}}
        if lab["en"] in DISTRICT_ALIASES:
            item["aliases"] = list(DISTRICT_ALIASES[lab["en"]])
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", e.get("coord") or "")
        if m:
            item["lat"], item["lng"] = round(float(m.group(2)), 3), round(float(m.group(1)), 3)
        ds.append(item)
    ds.sort(key=lambda x: x["name"])
    name = "Delhi" if st == "National Capital Territory of Delhi" else st
    entry = {"names": {k: v for k, v in labels.items() if k != "en"}, "districts": ds}
    if st in STATE_ALIASES:
        entry["aliases"] = STATE_ALIASES[st]
    out["states"][name] = entry

# Old/alternate names from the open list, e.g. "Mysuru (Mysore)" -> alias "Mysore".
alt = "/tmp/states-districts.json"
if os.path.exists(alt):
    for s in json.load(open(alt))["states"]:
        st = "Delhi" if s["state"].startswith("Delhi") else re.sub(r"\s*\(.*\)$", "", s["state"]).strip()
        if st not in out["states"]:
            continue
        for raw in s["districts"]:
            m = re.match(r"^(.*?)\s*\((.*)\)\s*(.*)$", raw)
            if not m:
                continue
            a, b = m.group(1).strip(), m.group(2).strip()
            if re.search(r"\d|Nagar$|Rural|Urban|North|South|East|West|Sahuji|Panchsheel|Prabuddh|Bhim", b):
                continue
            for d in out["states"][st]["districts"]:
                al = d.setdefault("aliases", [])
                if d["name"].lower().replace(" ", "") == a.lower().replace(" ", "") and b.lower() not in [x.lower() for x in al] and b != d["name"]:
                    al.append(b)
                if not al:
                    del d["aliases"]

with open(OUT, "w") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("states", len(out["states"]), "districts", sum(len(v["districts"]) for v in out["states"].values()))
