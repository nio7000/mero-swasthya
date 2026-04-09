import re
from collections import defaultdict

# =========================================================
# 1. NORMALIZATION
# =========================================================

def normalize_text(text: str) -> str:
    text = text.lower().strip()

    # basic cleanup
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # phrase-level normalization / receptionist shorthand expansion
    replacements = {
        "gynac": "gynecologist",
        "gynae": "gynecologist",
        "gyne": "gynecologist",
        "gastric": "gas",
        "gas problem": "gas issue",
        "stomach burning": "acidity",
        "burning stomach": "acidity",
        "loose motion": "diarrhea",
        "period problem": "period issue",
        "menstrual problem": "period issue",
        "urine problem": "urinary issue",
        "eye problem": "eye issue",
        "tooth problem": "tooth pain",
        "skin problem": "skin issue",
        "breathing problem": "breathing issue",
        "chest heaviness": "chest pain",
        "heavy chest": "chest pain",
        "heart pain": "chest pain",
        "white discharge": "vaginal discharge",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


# =========================================================
# 2. SPECIALIST PHRASE MAP
#    Every phrase here is treated as a strong signal.
# =========================================================

SPECIALIST_PHRASES = {
    "Gynecologist": [
        "vaginal discharge",
        "pregnancy",
        "pregnancy checkup",
        "irregular periods",
        "period issue",
        "missed period",
        "menstrual pain",
        "pcos",
        "fertility issue",
        "ovarian cyst",
        "uterus pain",
        "pelvic pain female",
        "prenatal care",
        "hormonal imbalance",
    ],
    "Gastroenterologist": [
        "stomach issue",
        "stomach pain",
        "abdominal pain",
        "acidity",
        "gas",
        "gas issue",
        "bloating",
        "indigestion",
        "diarrhea",
        "constipation",
        "vomiting",
        "nausea",
        "acid reflux",
        "ulcer",
        "jaundice",
        "liver problem",
    ],
    "Cardiologist": [
        "chest pain",
        "heart issue",
        "heart problem",
        "palpitation",
        "heart palpitations",
        "high blood pressure",
        "blood pressure",
        "bp issue",
        "hypertension",
        "irregular heartbeat",
        "chest tightness",
        "shortness of breath with chest pain",
    ],
    "Dermatologist": [
        "skin issue",
        "skin rash",
        "rash",
        "itching",
        "itchy skin",
        "acne",
        "eczema",
        "psoriasis",
        "fungal infection",
        "skin allergy",
        "hair loss",
        "warts",
        "blisters",
    ],
    "Orthopedist": [
        "joint pain",
        "knee pain",
        "back pain",
        "bone pain",
        "fracture",
        "broken bone",
        "neck pain",
        "shoulder pain",
        "hip pain",
        "ankle sprain",
        "wrist pain",
        "arthritis",
        "slip disc",
    ],
    "Ophthalmologist": [
        "eye issue",
        "eye pain",
        "blurry vision",
        "vision problem",
        "red eyes",
        "eye infection",
        "watery eyes",
        "itchy eyes",
        "cataract",
        "glasses prescription",
    ],
    "Dentist": [
        "tooth pain",
        "toothache",
        "dental pain",
        "gum bleeding",
        "gum issue",
        "tooth decay",
        "broken tooth",
        "jaw pain",
        "wisdom tooth",
        "mouth pain",
    ],
    "Pediatrician": [
        "child fever",
        "child cough",
        "child rash",
        "baby issue",
        "child issue",
        "newborn checkup",
        "infant vaccination",
        "baby not eating",
        "child growth problem",
        "toddler diarrhea",
    ],
    "Neurologist": [
        "headache",
        "migraine",
        "seizure",
        "memory loss",
        "stroke symptoms",
        "tremors",
        "nerve pain",
        "fainting",
        "numbness",
        "epilepsy",
    ],
    "ENT Specialist": [
        "ear pain",
        "ear issue",
        "hearing loss",
        "sore throat",
        "throat issue",
        "nose bleed",
        "sinus problem",
        "sinus issue",
        "runny nose",
        "tonsillitis",
        "blocked nose",
        "throat infection",
        "voice hoarseness",
    ],
    "Psychiatrist": [
        "depression",
        "anxiety",
        "stress",
        "panic attacks",
        "insomnia",
        "mood swings",
        "mental issue",
        "sleep disorder",
        "ocd",
        "bipolar",
    ],
    "Urologist": [
        "urinary issue",
        "urinary pain",
        "frequent urination",
        "blood in urine",
        "kidney stone",
        "uti",
        "prostate problem",
        "bladder infection",
        "urinary tract infection",
    ],
    "Pulmonologist": [
        "breathing issue",
        "asthma",
        "chronic cough",
        "tb",
        "tuberculosis",
        "lung infection",
        "copd",
        "wheezing",
        "chest congestion",
    ],
    "General Physician": [
        "fever",
        "cold",
        "flu",
        "body ache",
        "fatigue",
        "weakness",
        "general weakness",
        "routine checkup",
        "general checkup",
        "loss of appetite",
        "weight loss",
    ],
}


# =========================================================
# 3. TOKEN-LEVEL KEYWORDS
#    Used only if no exact phrase match wins.
# =========================================================

SPECIALIST_KEYWORDS = {
    "Gynecologist": {
        "vaginal": 5,
        "discharge": 4,
        "pregnancy": 5,
        "period": 5,
        "menstrual": 5,
        "pcos": 5,
        "ovarian": 5,
        "uterus": 5,
        "prenatal": 5,
        "fertility": 4,
        "pelvic": 2,
    },
    "Gastroenterologist": {
        "stomach": 4,
        "abdominal": 4,
        "gas": 4,
        "acidity": 5,
        "bloating": 4,
        "diarrhea": 5,
        "constipation": 5,
        "vomiting": 4,
        "nausea": 4,
        "reflux": 4,
        "ulcer": 4,
        "liver": 4,
        "jaundice": 5,
        "indigestion": 4,
    },
    "Cardiologist": {
        "chest": 4,
        "heart": 5,
        "palpitation": 5,
        "bp": 4,
        "pressure": 2,
        "hypertension": 5,
        "heartbeat": 5,
        "breathlessness": 3,
    },
    "Dermatologist": {
        "skin": 5,
        "rash": 5,
        "itching": 4,
        "itchy": 4,
        "acne": 5,
        "eczema": 5,
        "psoriasis": 5,
        "fungal": 4,
        "allergy": 3,
        "hair": 2,
        "warts": 4,
        "blisters": 4,
    },
    "Orthopedist": {
        "joint": 5,
        "knee": 5,
        "back": 4,
        "bone": 5,
        "fracture": 5,
        "neck": 4,
        "shoulder": 4,
        "hip": 4,
        "ankle": 4,
        "wrist": 4,
        "arthritis": 5,
        "disc": 4,
    },
    "Ophthalmologist": {
        "eye": 5,
        "vision": 5,
        "blurry": 4,
        "watery": 3,
        "cataract": 5,
        "glasses": 4,
    },
    "Dentist": {
        "tooth": 5,
        "dental": 5,
        "gum": 5,
        "jaw": 4,
        "mouth": 3,
    },
    "Pediatrician": {
        "child": 5,
        "baby": 5,
        "newborn": 5,
        "infant": 5,
        "toddler": 5,
    },
    "Neurologist": {
        "headache": 5,
        "migraine": 5,
        "seizure": 5,
        "memory": 4,
        "stroke": 5,
        "tremors": 5,
        "nerve": 4,
        "fainting": 4,
        "numbness": 4,
        "epilepsy": 5,
    },
    "ENT Specialist": {
        "ear": 5,
        "hearing": 4,
        "throat": 5,
        "nose": 5,
        "sinus": 5,
        "tonsillitis": 5,
        "hoarseness": 4,
    },
    "Psychiatrist": {
        "depression": 5,
        "anxiety": 5,
        "stress": 4,
        "panic": 5,
        "insomnia": 5,
        "mood": 4,
        "mental": 5,
        "sleep": 3,
        "ocd": 5,
        "bipolar": 5,
    },
    "Urologist": {
        "urinary": 5,
        "urine": 5,
        "kidney": 5,
        "uti": 5,
        "bladder": 4,
        "prostate": 5,
    },
    "Pulmonologist": {
        "breathing": 5,
        "asthma": 5,
        "cough": 4,
        "tb": 5,
        "tuberculosis": 5,
        "lung": 5,
        "copd": 5,
        "wheezing": 5,
        "congestion": 4,
    },
    "General Physician": {
        "fever": 5,
        "cold": 4,
        "flu": 4,
        "weakness": 4,
        "fatigue": 4,
        "checkup": 3,
        "appetite": 3,
    },
}


# =========================================================
# 4. BUILD PHRASE INDEX
# =========================================================

PHRASE_TO_SPECIALIST = {}
for specialist, phrases in SPECIALIST_PHRASES.items():
    for phrase in phrases:
        PHRASE_TO_SPECIALIST[phrase] = specialist


# =========================================================
# 5. PREDICTOR
# =========================================================

def predict_specialization(reason: str) -> dict:
    text = normalize_text(reason)

    # ---- A. exact phrase match (highest priority)
    if text in PHRASE_TO_SPECIALIST:
        specialist = PHRASE_TO_SPECIALIST[text]
        return {
            "specialization": specialist,
            "confidence": 1.0,
            "method": "exact_phrase"
        }

    # ---- B. contains full known phrase
    matched_phrases = []
    phrase_scores = defaultdict(int)

    for phrase, specialist in PHRASE_TO_SPECIALIST.items():
        if phrase in text:
            score = len(phrase.split()) + 2
            phrase_scores[specialist] += score
            matched_phrases.append((phrase, specialist, score))

    if phrase_scores:
        best_specialist = max(phrase_scores, key=phrase_scores.get)
        best_score = phrase_scores[best_specialist]
        confidence = min(0.98, round(0.70 + (best_score * 0.05), 2))

        return {
            "specialization": best_specialist,
            "confidence": confidence,
            "method": "phrase_contains",
            "matched": matched_phrases
        }

    # ---- C. token scoring fallback
    tokens = text.split()
    token_scores = defaultdict(int)

    for specialist, kw_map in SPECIALIST_KEYWORDS.items():
        for token in tokens:
            if token in kw_map:
                token_scores[specialist] += kw_map[token]

    if token_scores:
        best_specialist = max(token_scores, key=token_scores.get)
        best_score = token_scores[best_specialist]

        # make sure weak single-token collisions don't confidently misroute
        if best_score >= 5:
            confidence = min(0.9, round(0.55 + (best_score * 0.03), 2))
            return {
                "specialization": best_specialist,
                "confidence": confidence,
                "method": "token_score"
            }

    # ---- D. safe fallback
    return {
        "specialization": "General Physician",
        "confidence": 0.4,
        "method": "safe_fallback"
    }