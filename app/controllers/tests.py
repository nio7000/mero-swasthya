# Lab test endpoints — used by both the technician and counter portals.
# Technician: sees all tests, updates status, uploads reports via OCR or JSON.
# Counter: sees only unpaid tests so they can collect payment.

import json
import easyocr

from fastapi import APIRouter, Depends, HTTPException, Body, File, UploadFile
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import TestRequest, Patient, TestResult
from app.analyzer import analyze_medical_values
from app.utils.helpers import fmt_dt
from app.utils.ocr import preprocess_image, extract_structured_data, extract_medical_values

router = APIRouter(tags=["Tests"])


def _test_rows(db, query: str):
    """Return (TestRequest, patient_full_name) pairs matching a patient name search."""
    return (
        db.query(TestRequest, Patient.full_name)
        .join(Patient, TestRequest.patient_id == Patient.patient_id)
        .filter(Patient.full_name.ilike(f"%{query}%"))
        .all()
    )


@router.get("/counter/pending-tests/{query}")
def get_pending_tests(query: str, db: Session = Depends(get_db)):
    # Counter only sees tests that haven't been paid yet
    rows   = _test_rows(db, query)
    result = []
    for t, patient_name in rows:
        if t.payment_status != "Unpaid":
            continue
        result.append({
            "id":             t.id,
            "test_name":      t.test.name if t.test else "Unknown",
            "price":          t.test.price if t.test else 0,
            "status":         t.status,
            "payment_status": t.payment_status,
            "patient_name":   patient_name,
        })
    return {"pending_tests": result}


@router.get("/technician/tests/{query}")
def get_technician_tests(query: str, db: Session = Depends(get_db)):
    # Technician sees all tests regardless of payment status
    rows = _test_rows(db, query)
    return {"tests": [
        {
            "id":             t.id,
            "test_name":      t.test.name if t.test else "Unknown",
            "status":         t.status,
            "payment_status": t.payment_status,
            "patient_name":   patient_name,
            "requested_at":   fmt_dt(t.requested_at, "%Y/%m/%d %I:%M %p"),
        }
        for t, patient_name in rows
    ]}


@router.patch("/technician/update-status/{test_id}")
def update_test_status(test_id: int, data: dict = Body(...), db: Session = Depends(get_db)):
    t = db.query(TestRequest).filter(TestRequest.id == test_id).first()
    if not t:
        raise HTTPException(404, "Test not found")
    new_status = data.get("status")
    if new_status not in ["Done", "In Progress", "Not Done Yet"]:
        raise HTTPException(400, "Invalid status")
    t.status = new_status
    db.commit()
    return {"message": f"Status updated to {new_status}"}


@router.post("/technician/upload-report/{test_id}")
async def upload_report(test_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    t = db.query(TestRequest).filter(TestRequest.id == test_id).first()
    if not t:
        raise HTTPException(404, "Test not found")

    content = await file.read()

    if file.content_type.startswith("image/"):
        # Image upload — run OCR to extract text, then parse and analyze it
        try:
            proc     = preprocess_image(content)
            raw_text = " ".join(easyocr.Reader(["en"]).readtext(proc, detail=0))
        except Exception as e:
            raise HTTPException(400, f"OCR failed: {e}")
        structured = extract_structured_data(raw_text)
        analysis   = analyze_medical_values(extract_medical_values(raw_text))
    else:
        # JSON upload — structured data already extracted, just validate and store it
        try:
            payload = json.loads(content.decode("utf-8"))
        except Exception:
            raise HTTPException(400, "Invalid JSON uploaded")
        raw_text   = payload.get("raw_text", "")
        structured = payload.get("structured_data", {})
        analysis   = payload.get("medical_analysis", {})

    db.add(TestResult(test_request_id=t.id, result_data={
        "raw_text": raw_text, "structured_data": structured, "medical_analysis": analysis,
    }))
    t.status = "Done"  # automatically mark as done when report is uploaded
    db.commit()
    return {"message": "Report uploaded successfully"}
