import re
import cv2
import numpy as np


def preprocess_image(image_bytes: bytes):
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image")
    gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoise = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh  = cv2.adaptiveThreshold(denoise, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY_INV, 11, 2)
    kernel  = np.ones((2, 2), np.uint8)
    return cv2.bitwise_not(cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel))


def extract_structured_data(text: str) -> dict:
    txt  = re.sub(r"\s+", " ", text)
    data = {"Patient Name": "Unknown", "Age": "Unknown", "Sex": "Unknown"}

    name_match = re.search(r"(?:Name|Patient Name|Patient)[:\-]?\s*([A-Za-z. ]{3,40})", txt)
    if name_match:
        raw = name_match.group(1)
        data["Patient Name"] = re.split(r"\b(Billing|Date|Age|Sex|Doctor|Dr)\b", raw)[0].strip().title()

    age = re.search(r"Age[:\-]?\s*(\d{1,3})", txt)
    if age:
        data["Age"] = age.group(1)

    sex = re.search(r"\b(Male|Female|Other)\b", txt, re.IGNORECASE)
    if sex:
        data["Sex"] = sex.group(1).capitalize()

    return data


def extract_medical_values(text: str) -> dict:
    text = text.replace("\n", " ")

    def get_value(names):
        for name in names:
            m = re.search(rf"{name}[^\d]+(\d+\.?\d*)", text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1))
                except Exception:
                    pass
        return None

    results = {
        "Hemoglobin": get_value(["Haemoglobin", "Hemoglobin", r"\(Hb\)", "Hb"]),
        "WBC":        get_value(["TLC", "WBC", "Total WBC Count"]),
        "RBC":        get_value(["RBC Count", "RBC"]),
        "PCV":        get_value(["PCV", "Hematocrit"]),
    }
    return {k: v for k, v in results.items() if v is not None}
