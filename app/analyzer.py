# app/analyzer.py

def analyze_medical_values(values):
    """
    Analyzes CBC values extracted by OCR
    """

    results = {}

    # 🔥 MATCH EXACT KEYS FROM extract_medical_values()
    CBC_RANGES = {
        "Hemoglobin": (12.0, 16.0, "g/dL"),
        "WBC": (4.0, 10.0, "thou/µL"),
        "RBC": (4.0, 5.5, "million/µL"),
        "PCV": (36.0, 48.0, "%"),
    }

    for key, value in values.items():
        if key in CBC_RANGES:
            low, high, unit = CBC_RANGES[key]

            if value < low:
                status = "Low"
            elif value > high:
                status = "High"
            else:
                status = "Normal"

            results[key] = {
                "value": value,
                "unit": unit,
                "range": f"{low} - {high}",
                "status": status,
            }

    return results
