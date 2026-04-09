from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Role, Prescription
from app.ml_triage import predict_specialization


def _doctors(db, specialization=None):
    q = db.query(User).join(Role, User.role_id == Role.role_id).filter(Role.role == "doctor")
    if specialization:
        q = q.filter(User.specialization == specialization)
    return q.all()

router = APIRouter(tags=["Doctors"])


@router.get("/doctors/")
def get_doctors(db: Session = Depends(get_db), _=Depends(get_current_user)):
    doctors = _doctors(db)
    return {"doctors": [{"id": d.id, "full_name": d.full_name, "specialization": d.specialization} for d in doctors]}


@router.post("/ai/assign-doctor/")
def assign_doctor(data: dict = Body(...), db: Session = Depends(get_db), _=Depends(get_current_user)):
    reason = data.get("reason", "").strip()
    if not reason:
        raise HTTPException(400, "Reason is required")

    result = predict_specialization(reason)
    spec   = result["specialization"]

    doctors = (
        _doctors(db, specialization=spec)
        or _doctors(db, specialization="General Physician")
        or _doctors(db)
    )
    if not doctors:
        raise HTTPException(404, "No doctors available")

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    workload = {
        d.user_id: db.query(Prescription)
            .filter(Prescription.doctor_id == d.user_id, Prescription.created_at >= month_start)
            .count()
        for d in doctors
    }
    d = min(doctors, key=lambda doc: workload[doc.user_id])
    return {
        "doctor_id":      d.id,
        "doctor_name":    d.full_name,
        "specialization": d.specialization or spec,
        "confidence":     result["confidence"],
        "reason":         f"Prediction based on symptoms (confidence: {int(result['confidence'] * 100)}%)"
    }


@router.patch("/doctors/{doctor_id}/specialization")
def update_specialization(doctor_id: int, data: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    doctor = db.query(User).join(Role, User.role_id == Role.role_id).filter(User.user_id == doctor_id, Role.role == "doctor").first()
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    doctor.specialization = data.get("specialization", "")
    db.commit()
    return {"message": "Updated", "specialization": doctor.specialization}
