import re
import spacy

class MedicalReportParser:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def parse(self, text: str):
        data = {}

        # Normalize text
        text = text.replace("\n", " ").replace(":", " ")

        # --- Smart regex extraction ---
        patterns = {
            "Patient Name": r"(?:Name|Patient Name)\s*[:\-]?\s*([A-Za-z ]+)",
            "Age": r"(?:Age|Ag)\s*[:\-]?\s*(\d{1,2})",
            "Sex": r"(?:Sex|Gender)\s*[:\-]?\s*(Male|Female)",
            "Haemoglobin": r"(?:Haemoglobin|Hb)\s*[^\d]*(\d{1,2}\.\d{1,2})",
            "WBC Count": r"(?:WBC Count|Total WBC|TLC)\s*[^\d]*(\d{1,2}\.\d{1,2})",
            "RBC Count": r"(?:RBC Count|RBC)\s*[^\d]*(\d{1,2}\.\d{1,2})",
            "PCV (Hematocrit)": r"PCV\s*Hematocrit.*?(\d+\.?\d*)",
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            data[key] = match.group(1) if match else "Not found"

        # Use spaCy for named entities as fallback
        doc = self.nlp(text)
        names = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
        if data["Patient Name"] == "Not found" and names:
            data["Patient Name"] = names[0]

        return data
