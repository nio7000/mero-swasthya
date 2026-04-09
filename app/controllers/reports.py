import cv2
import numpy as np
import easyocr

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from typing import List
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, TestRequest, Patient, TestResult
from app.analyzer import analyze_medical_values
from app.utils.helpers import fmt_dt_iso
from app.utils.ocr import extract_structured_data, extract_medical_values

ocr_reader = easyocr.Reader(["en"])

router = APIRouter(tags=["Reports"])


@router.post("/analyze-reports/")
async def analyze_reports(files: List[UploadFile] = File(...)):
    output = []
    for file in files:
        raw = await file.read()
        arr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(400, "Invalid image")
        raw_text = " ".join(ocr_reader.readtext(img, detail=0))
        output.append({
            "file_name":        file.filename,
            "raw_text":         raw_text,
            "structured_data":  extract_structured_data(raw_text),
            "medical_analysis": analyze_medical_values(extract_medical_values(raw_text)),
        })
    return {"results": output}


@router.get("/reports/")
def get_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ["doctor", "pharmacy", "pharmacist", "pharmacy_admin",
                         "receptionist", "counter", "admin", "technician"]:
        raise HTTPException(403, "Access Denied")
    rows = db.query(Patient).filter(Patient.is_deleted != True).order_by(Patient.patient_id.desc()).all()
    return {"reports": [
        {
            "id":         p.id,
            "patient_id": p.id,
            "structured_data": {
                "Patient Name": p.full_name,
                "Age":          str(p.age or ""),
                "Sex":          p.sex or "",
                "Contact":      p.contact or "",
                "Address":      p.address or "",
            },
            "medical_analysis": {},
        }
        for p in rows
    ]}


@router.get("/ai-reports/{patient_id}")
def get_ai_reports(patient_id: int, db: Session = Depends(get_db)):
    rows = db.query(TestRequest).filter(TestRequest.patient_id == patient_id).all()
    results = []
    for t in rows:
        test_result = db.query(TestResult).filter(TestResult.test_request_id == t.id).first()
        results.append({
            "test_name":  t.test.name if t.test else "Unknown",
            "ocr_report": test_result.result_data if test_result else {},
            "status":     t.status,
            "requested_at": fmt_dt_iso(t.requested_at),
        })
    return {"ai_reports": results}
