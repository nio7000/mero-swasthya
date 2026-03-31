from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models import Patient
from app.database import get_db

router = APIRouter(prefix="/receptionist", tags=["Receptionist"])

# Generate next patient ID like PA000001
def generate_patient_id(db):
    last_patient = db.query(Patient).order_by(Patient.id.desc()).first()
    if not last_patient:
        return "PA000001"
    next_id = int(last_patient.patient_id[2:]) + 1
    return f"PA{next_id:06d}"

@router.post("/register")
def register_patient(data: dict, db: Session = Depends(get_db)):
    new_id = generate_patient_id(db)
    patient = Patient(
        patient_id=new_id,
        name=data["name"],
        age=data["age"],
        sex=data["sex"],
        contact=data["contact"],
        address=data["address"]
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return {"message": "Patient registered successfully!", "patient_id": new_id}
