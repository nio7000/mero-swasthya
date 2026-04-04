from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import numpy as np

# ── Training data: symptom phrases → specialization ──
TRAINING_DATA = [
    # Dermatologist
    ("skin rash", "Dermatologist"),
    ("acne on face", "Dermatologist"),
    ("itchy skin", "Dermatologist"),
    ("eczema", "Dermatologist"),
    ("psoriasis", "Dermatologist"),
    ("dry flaky skin", "Dermatologist"),
    ("skin infection", "Dermatologist"),
    ("redness on skin", "Dermatologist"),
    ("hair loss", "Dermatologist"),
    ("fungal infection on skin", "Dermatologist"),
    ("warts", "Dermatologist"),
    ("skin allergy", "Dermatologist"),
    ("blisters on skin", "Dermatologist"),

    # Gynecologist
    ("pregnancy checkup", "Gynecologist"),
    ("irregular periods", "Gynecologist"),
    ("menstrual pain", "Gynecologist"),
    ("vaginal discharge", "Gynecologist"),
    ("PCOS", "Gynecologist"),
    ("fertility issues", "Gynecologist"),
    ("prenatal care", "Gynecologist"),
    ("uterus pain", "Gynecologist"),
    ("ovarian cyst", "Gynecologist"),
    ("missed period", "Gynecologist"),
    ("hormonal imbalance", "Gynecologist"),

    # Cardiologist
    ("chest pain", "Cardiologist"),
    ("heart palpitations", "Cardiologist"),
    ("shortness of breath", "Cardiologist"),
    ("high blood pressure", "Cardiologist"),
    ("irregular heartbeat", "Cardiologist"),
    ("heart attack symptoms", "Cardiologist"),
    ("chest tightness", "Cardiologist"),
    ("dizziness and chest pain", "Cardiologist"),
    ("swollen legs heart", "Cardiologist"),
    ("hypertension", "Cardiologist"),

    # Orthopedist
    ("bone ache", "Orthopedist"),
    ("joint pain", "Orthopedist"),
    ("knee pain", "Orthopedist"),
    ("back pain", "Orthopedist"),
    ("fracture", "Orthopedist"),
    ("broken bone", "Orthopedist"),
    ("spine problem", "Orthopedist"),
    ("hip pain", "Orthopedist"),
    ("shoulder pain", "Orthopedist"),
    ("muscle and bone pain", "Orthopedist"),
    ("arthritis", "Orthopedist"),
    ("neck pain", "Orthopedist"),
    ("slip disc", "Orthopedist"),
    ("ankle sprain", "Orthopedist"),
    ("wrist pain", "Orthopedist"),

    # Ophthalmologist
    ("eye pain", "Ophthalmologist"),
    ("blurry vision", "Ophthalmologist"),
    ("vision problem", "Ophthalmologist"),
    ("red eyes", "Ophthalmologist"),
    ("eye infection", "Ophthalmologist"),
    ("watery eyes", "Ophthalmologist"),
    ("eye irritation", "Ophthalmologist"),
    ("cataracts", "Ophthalmologist"),
    ("glasses prescription", "Ophthalmologist"),
    ("itchy eyes", "Ophthalmologist"),

    # Dentist
    ("toothache", "Dentist"),
    ("dental pain", "Dentist"),
    ("gum bleeding", "Dentist"),
    ("tooth decay", "Dentist"),
    ("broken tooth", "Dentist"),
    ("dental checkup", "Dentist"),
    ("teeth cleaning", "Dentist"),
    ("wisdom tooth", "Dentist"),
    ("mouth pain", "Dentist"),
    ("jaw pain", "Dentist"),

    # Pediatrician
    ("child fever", "Pediatrician"),
    ("baby not eating", "Pediatrician"),
    ("child rash", "Pediatrician"),
    ("infant vaccination", "Pediatrician"),
    ("child growth problem", "Pediatrician"),
    ("newborn checkup", "Pediatrician"),
    ("child cough", "Pediatrician"),
    ("toddler diarrhea", "Pediatrician"),
    ("child weight loss", "Pediatrician"),

    # Neurologist
    ("headache", "Neurologist"),
    ("migraine", "Neurologist"),
    ("seizure", "Neurologist"),
    ("numbness in hands", "Neurologist"),
    ("memory loss", "Neurologist"),
    ("dizziness", "Neurologist"),
    ("stroke symptoms", "Neurologist"),
    ("tremors", "Neurologist"),
    ("nerve pain", "Neurologist"),
    ("fainting", "Neurologist"),
    ("epilepsy", "Neurologist"),

    # Gastroenterologist
    ("stomach pain", "Gastroenterologist"),
    ("abdominal pain", "Gastroenterologist"),
    ("vomiting", "Gastroenterologist"),
    ("diarrhea", "Gastroenterologist"),
    ("constipation", "Gastroenterologist"),
    ("acid reflux", "Gastroenterologist"),
    ("bloating", "Gastroenterologist"),
    ("liver problem", "Gastroenterologist"),
    ("jaundice", "Gastroenterologist"),
    ("nausea", "Gastroenterologist"),
    ("indigestion", "Gastroenterologist"),
    ("stomach ulcer", "Gastroenterologist"),

    # ENT Specialist
    ("ear pain", "ENT Specialist"),
    ("hearing loss", "ENT Specialist"),
    ("sore throat", "ENT Specialist"),
    ("nose bleed", "ENT Specialist"),
    ("sinus problem", "ENT Specialist"),
    ("runny nose", "ENT Specialist"),
    ("ear infection", "ENT Specialist"),
    ("tonsillitis", "ENT Specialist"),
    ("voice hoarseness", "ENT Specialist"),
    ("blocked nose", "ENT Specialist"),
    ("throat infection", "ENT Specialist"),

    # Psychiatrist
    ("depression", "Psychiatrist"),
    ("anxiety", "Psychiatrist"),
    ("mental health", "Psychiatrist"),
    ("panic attacks", "Psychiatrist"),
    ("insomnia", "Psychiatrist"),
    ("mood swings", "Psychiatrist"),
    ("stress", "Psychiatrist"),
    ("suicidal thoughts", "Psychiatrist"),
    ("schizophrenia", "Psychiatrist"),
    ("OCD", "Psychiatrist"),
    ("bipolar", "Psychiatrist"),
    ("sleep disorder", "Psychiatrist"),

    # Urologist
    ("urinary pain", "Urologist"),
    ("frequent urination", "Urologist"),
    ("blood in urine", "Urologist"),
    ("kidney stone", "Urologist"),
    ("UTI", "Urologist"),
    ("prostate problem", "Urologist"),
    ("bladder infection", "Urologist"),
    ("urinary tract infection", "Urologist"),

    # Pulmonologist
    ("breathing problem", "Pulmonologist"),
    ("asthma", "Pulmonologist"),
    ("chronic cough", "Pulmonologist"),
    ("TB", "Pulmonologist"),
    ("tuberculosis", "Pulmonologist"),
    ("lung infection", "Pulmonologist"),
    ("COPD", "Pulmonologist"),
    ("wheezing", "Pulmonologist"),
    ("chest congestion", "Pulmonologist"),

    # General Physician
    ("fever", "General Physician"),
    ("cold", "General Physician"),
    ("flu", "General Physician"),
    ("general checkup", "General Physician"),
    ("body ache", "General Physician"),
    ("fatigue", "General Physician"),
    ("weakness", "General Physician"),
    ("routine checkup", "General Physician"),
    ("weight loss", "General Physician"),
    ("loss of appetite", "General Physician"),
    ("general weakness", "General Physician"),
]

# ── Train the model ──
texts  = [t[0] for t in TRAINING_DATA]
labels = [t[1] for t in TRAINING_DATA]

model = Pipeline([
    ("tfidf", TfidfVectorizer(
    ngram_range=(1, 3),
    lowercase=True,
    sublinear_tf=True,
    min_df=1,
    analyzer="word",
    stop_words=None,
)),
    ("clf", LogisticRegression(max_iter=1000, C=5)),
])
model.fit(texts, labels)


def predict_specialization(reason: str) -> dict:
    """
    Given a free-text reason for visit, returns the predicted
    specialization and a confidence score.
    """
    reason = reason.strip().lower()
    proba  = model.predict_proba([reason])[0]
    idx    = np.argmax(proba)
    specialization = model.classes_[idx]
    confidence     = round(float(proba[idx]), 2)

    return {
        "specialization": specialization,
        "confidence":     confidence,
    }