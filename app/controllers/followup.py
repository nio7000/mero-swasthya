from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Followup
from app.utils.helpers import fmt_dt

router = APIRouter(tags=["Follow-up"])


@router.post("/followup/assign/")
def assign_followup(data: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(403, "Only doctors can assign follow-ups")
    pid = data.get("patient_id")
    if not pid:
        raise HTTPException(400, "patient_id required")
    existing = db.query(Followup).filter(Followup.patient_id == pid, Followup.used == False).first()
    if existing:
        db.delete(existing)
    db.add(Followup(patient_id=pid, doctor_id=user.id))
    db.commit()
    return {"message": "Follow-up assigned", "patient_id": pid}


@router.get("/followup/check/{patient_id}")
def check_followup(patient_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(Followup).filter(Followup.patient_id == patient_id, Followup.used == False).first()
    if not f:
        return {"has_followup": False}
    doctor = db.query(User).filter(User.user_id == f.doctor_id).first()
    return {"has_followup": True, "followup_id": f.id,
            "assigned_by": doctor.full_name if doctor else "Unknown",
            "assigned_at": fmt_dt(f.assigned_at)}


@router.post("/followup/use/{patient_id}")
def use_followup(patient_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    f = db.query(Followup).filter(Followup.patient_id == patient_id, Followup.used == False).first()
    if not f:
        raise HTTPException(404, "No active follow-up found")
    f.used = True; f.used_at = datetime.utcnow()
    db.commit()
    return {"message": "Follow-up used", "patient_id": patient_id}


@router.delete("/followup/cancel/{patient_id}")
def cancel_followup(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "doctor":
        raise HTTPException(403, "Only doctors can cancel follow-ups")
    f = db.query(Followup).filter(Followup.patient_id == patient_id, Followup.used == False).first()
    if not f:
        raise HTTPException(404, "No active follow-up found")
    db.delete(f); db.commit()
    return {"message": "Follow-up cancelled", "patient_id": patient_id}
