# Prescription endpoints — used by doctors to write prescriptions and
# by any portal that needs to display a patient's prescription history.

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import (
    User, Prescription, PrescriptionItem, PrescriptionTest,
    TestRequest, Test, Medicine
)
from app.utils.helpers import clean_doctor_name, fmt_dt_iso

router = APIRouter(tags=["Prescriptions"])


@router.get("/lab/tests")
def get_lab_tests(db: Session = Depends(get_db)):
    # Returns the full list of tests so the doctor portal can populate the test picker
    tests = db.query(Test).all()
    return {"tests": [{"id": t.id, "name": t.name, "price": t.price} for t in tests]}


@router.post("/prescriptions/")
def create_prescription(
    data: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "doctor":
        raise HTTPException(403, "Only doctors allowed")

    pid = data.get("patient_id")
    if not pid:
        raise HTTPException(400, "Patient ID required")

    # Create the prescription header first, then flush to get the ID
    # so child rows (items/tests) can reference it
    rx = Prescription(
        patient_id=pid,
        doctor_id=user.id,
        diagnosis=data.get("diagnosis", ""),
        created_at=datetime.utcnow(),
    )
    db.add(rx)
    db.flush()

    # Add medicine line items — handle both id-based and name-based lookups
    for med in data.get("medicines", []):
        if isinstance(med, dict):
            med_id   = med.get("id")
            med_name = med.get("name") or med.get("medicine_name")

            # If no id provided, try to find the medicine by name
            if not med_id and med_name:
                found  = db.query(Medicine).filter(Medicine.name == med_name).first()
                med_id = found.id if found else None

            db.add(PrescriptionItem(
                prescription_id=rx.id,
                medicine_id=med_id,
                dose=med.get("dose") or med.get("dosage"),
                duration=med.get("duration"),
                notes=med.get("notes"),
            ))

    # Add ordered lab tests and create corresponding TestRequest rows
    for t in data.get("tests", []):
        if isinstance(t, dict):
            lt_id   = t.get("id") or t.get("test_id")
            lt_name = t.get("name") or t.get("test_name") or ""
        else:
            lt_id, lt_name = None, str(t)

        # Skip placeholder values like "No tests selected"
        if not lt_id and lt_name and lt_name.lower() not in ("no tests selected", "no tests", ""):
            found = db.query(Test).filter(Test.name == lt_name).first()
            lt_id = found.id if found else None

        if not lt_id:
            continue

        # Link test to the prescription
        db.add(PrescriptionTest(prescription_id=rx.id, test_id=lt_id))

        # Also create a TestRequest so the technician and counter can see it
        db.add(TestRequest(
            patient_id=pid,
            doctor_id=user.id,
            test_id=lt_id,
            status="Not Done Yet",
            payment_status="Unpaid",
            requested_at=datetime.utcnow(),
        ))

    db.commit()
    return {"message": "Prescription saved", "prescription_id": rx.id}


@router.get("/prescriptions/{patient_id}")
def get_prescriptions(patient_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id)
        .order_by(Prescription.created_at.desc())
        .all()
    )

    output = []
    for p in rows:
        # Build medicine list with names resolved from the medicine table
        medicines = []
        for item in p.items:
            med_name = item.medicine.name if item.medicine else "Unknown"
            medicines.append({
                "name":     med_name,
                "dose":     item.dose,
                "duration": item.duration,
                "notes":    item.notes,
            })

        # For each ordered test, find the most recent TestRequest to get live status
        live_tests = []
        for pt in p.ordered_tests:
            if not pt.test_id:
                continue
            lt_name = pt.test.name if pt.test else "Unknown"

            # Most recent TestRequest for this patient + test combo
            tr = (
                db.query(TestRequest)
                .filter(
                    TestRequest.patient_id == patient_id,
                    TestRequest.test_id == pt.test_id,
                )
                .order_by(TestRequest.requested_at.desc())
                .first()
            )
            status = "Completed" if (tr and str(tr.status) == "Done") else "Pending"
            live_tests.append({"test_name": lt_name, "status": status})

        doctor_name = clean_doctor_name(p.doctor.full_name) if p.doctor else "—"
        output.append({
            "id":         p.id,
            "diagnosis":  p.diagnosis,
            "doctor":     doctor_name,
            "created_at": fmt_dt_iso(p.created_at),
            "medicines":  medicines,
            "tests":      live_tests,
        })

    return {"prescriptions": output}
