import re


def get_structured_data(report) -> dict:
    """Extract structured_data from a MedicalReport safely."""
    if not report or not isinstance(report.json_data, dict):
        return {}
    return report.json_data.get("structured_data", {})


def serialize_patient(report) -> dict:
    """Return a standard patient dict from a MedicalReport row."""
    st = get_structured_data(report)
    return {
        "id":         report.id,
        "patient_id": st.get("Patient ID", ""),
        "name":       st.get("Patient Name", report.patient_name),
        "age":        st.get("Age", report.age),
        "sex":        st.get("Sex", report.sex),
        "contact":    st.get("Contact", ""),
        "address":    st.get("Address", "Not Provided"),
    }


def clean_doctor_name(name: str) -> str:
    """Remove 'Dr.' or 'Doctor' prefix from a name."""
    if not name:
        return "Unknown"
    return re.sub(r"^(Dr\.?|Doctor)\s+", "", name, flags=re.IGNORECASE).strip()


def generate_invoice_number(bill_id: int) -> str:
    return f"INV-{bill_id:05d}"


def fmt_dt(dt, fmt="%Y-%m-%d %H:%M") -> str:
    """Format a datetime object safely; return empty string if None."""
    if not dt:
        return ""
    if hasattr(dt, "strftime"):
        return dt.strftime(fmt)
    return str(dt)


def fmt_dt_iso(dt) -> str:
    """Return ISO string for datetime, or raw string if already a string."""
    if not dt:
        return ""
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)
