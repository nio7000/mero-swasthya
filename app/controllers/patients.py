# Patient management endpoints — used by receptionist, doctors, admin, and pharmacy.
# Supports registration, listing, soft-delete (admin), and hard-delete (full cleanup).

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db, get_current_user
from app.models import User, Patient

router = APIRouter(tags=["Patients"])


def _pid(p: Patient) -> str:
    # Formats the patient ID as a readable string like "PA000042"
    return f"PA{p.id:06d}"


def _serialize(p: Patient) -> dict:
    # Turns a Patient row into the standard dict returned by all patient endpoints.
    # structured_data mirrors the format used by the OCR/AI report system.
    return {
        "id":         p.id,
        "patient_id": _pid(p),
        "name":       p.full_name,
        "age":        p.age,
        "sex":        p.sex,
        "contact":    p.contact or "",
        "address":    p.address or "",
        "is_deleted": p.is_deleted or False,
        "structured_data": {
            "Patient Name": p.full_name,
            "Age":          str(p.age or ""),
            "Sex":          p.sex or "",
            "Contact":      p.contact or "",
            "Address":      p.address or "",
            "Patient ID":   _pid(p),
        },
    }


@router.get("/next-patient-id/")
def get_next_patient_id(db: Session = Depends(get_db)):
    # The receptionist screen previews the next ID before saving
    last = db.query(Patient).order_by(Patient.patient_id.desc()).first()
    next_id = (last.id + 1) if last else 1
    return {"patient_id": f"PA{next_id:06d}"}


@router.post("/register-patient/")
def register_patient(data: dict = Body(...), db: Session = Depends(get_db)):
    req = ["name", "age", "sex", "contact", "address"]
    if not all(k in data for k in req):
        raise HTTPException(400, "Missing fields")
    p = Patient(
        full_name=data["name"],
        age=int(data["age"]) if str(data["age"]).isdigit() else None,
        sex=data["sex"],
        contact=data["contact"],
        address=data["address"],
    )
    db.add(p)
    db.commit()
    return {"message": "Patient registered"}


@router.get("/patients/")
def get_all_patients(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # All clinical roles need the patient list — only truly restricted roles are excluded
    allowed = ["doctor", "pharmacy", "pharmacist", "pharmacy_admin",
               "receptionist", "counter", "admin", "technician"]
    if user.role not in allowed:
        raise HTTPException(403, "Access denied")
    # Soft-deleted patients are hidden from normal views
    rows = db.query(Patient).filter(Patient.is_deleted != True).order_by(Patient.patient_id.desc()).all()
    return [_serialize(p) for p in rows]


@router.delete("/delete-patient/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    try:
        # Hard delete — cleans up all related records in the right order
        # to avoid foreign key constraint violations
        db.execute(text("DELETE FROM bills         WHERE patient_id=:p"), {"p": patient_id})
        db.execute(text("DELETE FROM test_requests WHERE patient_id=:p"), {"p": patient_id})
        db.execute(text("DELETE FROM prescription_items WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id=:p)"), {"p": patient_id})
        db.execute(text("DELETE FROM prescription_tests WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id=:p)"), {"p": patient_id})
        db.execute(text("DELETE FROM prescriptions WHERE patient_id=:p"), {"p": patient_id})
        db.execute(text("DELETE FROM followups     WHERE patient_id=:p"), {"p": patient_id})
        db.execute(text("DELETE FROM appointments  WHERE patient_id=:p"), {"p": patient_id})
        db.execute(text("DELETE FROM patients      WHERE id=:p"), {"p": patient_id})
        db.commit()
        return {"message": "Patient deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))


@router.get("/admin/all-patients/")
def get_all_patients_admin(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Admin view includes soft-deleted patients so they can restore them
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    rows = db.query(Patient).order_by(Patient.patient_id.desc()).all()
    return [_serialize(p) for p in rows]


@router.patch("/admin/soft-delete-patient/{patient_id}")
def soft_delete_patient(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Soft delete hides the patient from all clinical views but keeps billing history intact
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    p = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    p.is_deleted = True
    db.commit()
    return {"message": "Patient removed from active records"}


@router.patch("/admin/restore-patient/{patient_id}")
def restore_patient(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    p = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    p.is_deleted = False
    db.commit()
    return {"message": "Patient restored"}
