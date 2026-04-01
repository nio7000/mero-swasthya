from app.models import Patient, TestRequest, Prescription, FollowUp
from app.ml_triage import predict_specialization

from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Request, Body
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware

from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

import easyocr
import spacy
import cv2
import numpy as np
import re
import json
from typing import List

from app.database import SessionLocal, engine, Base
from app.models import MedicalReport, User, Prescription, TestRequest, LabTest
from app.analyzer import analyze_medical_values
from app.models import Patient

from sqlalchemy import text
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from app.pharmacy_admin.models_pharmacy import (
    Medicine, Stock, Transaction,
    Bill, BillItem, ReturnItem
)

# --------------------------------------------------------------
# INITIAL SETUP
# --------------------------------------------------------------

def generate_invoice_number(bill_id: int):
    return f"INV-{bill_id:05d}"

Base.metadata.create_all(bind=engine)

# Add description column to bill_items if it doesn't exist (migration)
with engine.connect() as _conn:
    try:
        _conn.execute(text("ALTER TABLE bill_items ADD COLUMN description VARCHAR"))
        _conn.commit()
    except Exception:
        pass  # Column already exists

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# APP
app = FastAPI(title="AI Medical OCR & Pharmacy System")
templates = Jinja2Templates(directory="app/templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------
# DB
# --------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(pwd):
    return pwd_context.hash(pwd)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta=None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    exc = HTTPException(status_code=401, detail="Invalid or expired token")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise exc
    except:
        raise exc

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise exc

    return user

# --------------------------------------------------------------
# LOGIN & USER CREATION
# --------------------------------------------------------------

@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name,
        "id": user.id
    }


@app.post("/admin/create-user/")
def create_user(data: dict = Body(...), db: Session = Depends(get_db)):
    required = ["full_name", "email", "password", "role"]
    if not all(k in data for k in required):
        raise HTTPException(400, "Missing required fields")

    if db.query(User).filter(User.email == data["email"]).first():
        raise HTTPException(400, "Email already exists")

    u = User(
        full_name=data["full_name"],
        email=data["email"],
        password=hash_password(data["password"]),
        role=data["role"],
        specialization=data.get("specialization", "")
    )

    db.add(u)
    db.commit()
    db.refresh(u)

    return {"message": f"{u.role.capitalize()} {u.full_name} created"}

# --------------------------------------------------------------
# ADMIN — GET USERS
# --------------------------------------------------------------

@app.get("/admin/users/")
def get_all_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")

    users = db.query(User).filter(User.is_deleted != True).all()

    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "specialization": u.specialization or ""
        }
        for u in users
    ]

# --------------------------------------------------------------
# ADMIN — DELETE USER
# --------------------------------------------------------------

@app.delete("/admin/delete-user/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == user.id:
        raise HTTPException(400, "You cannot delete yourself")
    u.is_deleted = True
    db.commit()
    return {"message": "User removed successfully"}

# --------------------------------------------------------------
# ADMIN — DELETE PATIENT
# --------------------------------------------------------------

@app.delete("/delete-patient/{patient_id}")
def delete_patient(patient_id: str, db: Session = Depends(get_db)):
    try:
        # 🔍 STEP 1 — Find patient (MedicalReport)
        target = None
        reports = db.query(MedicalReport).all()

        for r in reports:
            st = r.json_data.get("structured_data", {}) if isinstance(r.json_data, dict) else {}
            if st.get("Patient ID") == patient_id:
                target = r
                break

        if not target:
            raise HTTPException(status_code=404, detail="Patient not found")

        real_id = target.id

        # 🔥 STEP 2 — DELETE IN CORRECT ORDER (VERY IMPORTANT)

        # 1️⃣ Delete bill items (deepest child)
        db.execute(text("""
            DELETE FROM bill_items 
            WHERE bill_id IN (
                SELECT id FROM bills WHERE patient_id = :pid
            )
        """), {"pid": real_id})

        # 2️⃣ Delete bills
        db.execute(text("DELETE FROM bills WHERE patient_id = :pid"), {"pid": real_id})

        # 3️⃣ Delete test requests
        db.execute(text("DELETE FROM test_requests WHERE patient_id = :pid"), {"pid": real_id})

        # 4️⃣ Delete prescriptions
        db.execute(text("DELETE FROM prescriptions WHERE patient_id = :pid"), {"pid": real_id})

        # 5️⃣ Delete main patient record
        db.execute(text("DELETE FROM medical_reports WHERE id = :pid"), {"pid": real_id})

        db.commit()

        return {"message": "Patient deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
# --------------------------------------------------------------
# OCR SYSTEM
# --------------------------------------------------------------

ocr_reader = easyocr.Reader(["en"])
nlp = spacy.load("en_core_web_sm")

def preprocess_image(image_bytes):
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoise = cv2.GaussianBlur(gray, (5,5), 0)
    thresh = cv2.adaptiveThreshold(
        denoise, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11, 2
    )
    kernel = np.ones((2,2), np.uint8)
    morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    return cv2.bitwise_not(morph)

# --------------------------------------------------------------
# STRUCTURED DATA
# --------------------------------------------------------------

def extract_structured_data(text):
    txt = re.sub(r"\s+", " ", text)

    data = {"Patient Name": "Unknown", "Age": "Unknown", "Sex": "Unknown"}

    name_match = re.search(
        r"(?:Name|Patient Name|Patient)[:\-]?\s*([A-Za-z. ]{3,40})",
        txt
    )
    if name_match:
        raw = name_match.group(1)
        raw = re.split(r"\b(Billing|Date|Age|Sex|Doctor|Dr)\b", raw)[0]
        data["Patient Name"] = raw.strip().title()

    age = re.search(r"Age[:\-]?\s*(\d{1,3})", txt)
    if age:
        data["Age"] = age.group(1)

    sex = re.search(r"\b(Male|Female|Other)\b", txt, re.IGNORECASE)
    if sex:
        data["Sex"] = sex.group(1).capitalize()

    return data
# --------------------------------------------------------------
# MEDICAL VALUE EXTRACTION
# --------------------------------------------------------------

def extract_medical_values(text):
    text = text.replace("\n", " ")
    results = {}

    def get_value(names):
        for name in names:
            pattern = rf"{name}[^\d]+(\d+\.?\d*)"
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1))
                except:
                    pass
        return None

    results["Hemoglobin"] = get_value(["Haemoglobin", "Hemoglobin", r"\(Hb\)", "Hb"])
    results["WBC"] = get_value(["TLC", "WBC", "Total WBC Count"])
    results["RBC"] = get_value(["RBC Count", "RBC"])
    results["PCV"] = get_value(["PCV", "Hematocrit"])

    return {k: v for k, v in results.items() if v is not None}


# --------------------------------------------------------------
# ANALYZE REPORTS (OCR UPLOAD)
# --------------------------------------------------------------

@app.post("/analyze-reports/")
async def analyze_reports(files: List[UploadFile] = File(...)):

    output = []

    for file in files:
        raw = await file.read()
        arr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(400, "Invalid image")

        text_blocks = ocr_reader.readtext(img, detail=0)
        raw_text = " ".join(text_blocks)

        structured = extract_structured_data(raw_text)
        extracted = extract_medical_values(raw_text)
        analysis = analyze_medical_values(extracted)

        output.append({
            "file_name": file.filename,
            "raw_text": raw_text,
            "structured_data": structured,
            "medical_analysis": analysis,
        })

    return {"results": output}

# --------------------------------------------------------------
# ML TRIAGE — PREDICT SPECIALIZATION + ASSIGN DOCTOR
# --------------------------------------------------------------

@app.post("/ai/assign-doctor/")
def assign_doctor(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reason = data.get("reason", "").strip()
    if not reason:
        raise HTTPException(400, "Reason is required")

    result         = predict_specialization(reason)
    specialization = result["specialization"]
    confidence     = result["confidence"]

    # Step 2: find doctors with that specialization
    doctors = db.query(User).filter(
        User.role == "doctor",
        User.is_deleted != True,
        User.specialization == specialization
    ).all()

    # Step 3: fallback to General Physician
    if not doctors:
        doctors = db.query(User).filter(
            User.role == "doctor",
            User.is_deleted != True,
            User.specialization == "General Physician"
        ).all()
        specialization = "General Physician"

    # Step 4: fallback to any active doctor
    if not doctors:
        doctors = db.query(User).filter(
            User.role == "doctor",
            User.is_deleted != True
        ).all()

    if not doctors:
        raise HTTPException(404, "No doctors available in the system")

    assigned = doctors[0]

    return {
        "doctor_id":      assigned.id,
        "doctor_name":    assigned.full_name,
        "specialization": assigned.specialization or specialization,
        "confidence":     confidence,
        "reason":         f"Prediction based on symptoms (confidence: {int(confidence * 100)}%)"
    }


# GET all doctors with specialization (for receptionist AI)
@app.get("/doctors/")
async def get_doctors(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    doctors = db.query(User).filter(
        User.role == "doctor",
        User.is_deleted != True
    ).all()
    return {"doctors": [{"id": d.id, "full_name": d.full_name, "specialization": d.specialization} for d in doctors]}


# UPDATE doctor specialization (for admin)
@app.patch("/doctors/{doctor_id}/specialization")
async def update_specialization(doctor_id: int, data: dict, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    doctor = db.query(User).filter(
        User.id == doctor_id,
        User.role == "doctor",
        User.is_deleted != True
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor.specialization = data.get("specialization", "")
    db.commit()
    return {"message": "Updated", "specialization": doctor.specialization}

# --------------------------------------------------------------
# AUTO-GENERATE NEXT PATIENT ID
# --------------------------------------------------------------

@app.get("/next-patient-id/")
def get_next_patient_id(db: Session = Depends(get_db)):

    last = db.query(MedicalReport).order_by(MedicalReport.id.desc()).first()

    if not last:
        return {"patient_id": "PA000001"}

    data = last.json_data.get("structured_data", {}) if isinstance(last.json_data, dict) else {}
    prev = data.get("Patient ID")

    if prev:
        num = int(prev.replace("PA", ""))
        return {"patient_id": f"PA{num + 1:06d}"}

    return {"patient_id": f"PA{last.id + 1:06d}"}


# --------------------------------------------------------------
# REGISTER PATIENT
# --------------------------------------------------------------

@app.post("/register-patient/")
def register_patient(data: dict = Body(...), db: Session = Depends(get_db)):

    req = ["name", "age", "sex", "contact", "address", "patient_id"]
    if not all(key in data for key in req):
        raise HTTPException(400, "Missing fields")

    new = MedicalReport(
        patient_name=data["name"],
        age=data["age"],
        sex=data["sex"],
        json_data={
            "structured_data": {
                "Patient Name": data["name"],
                "Age": data["age"],
                "Sex": data["sex"],
                "Contact": data["contact"],
                "Address": data["address"],
                "Patient ID": data["patient_id"]
            },
            "medical_analysis": {}
        }
    )

    db.add(new)
    db.commit()
    db.refresh(new)

    return {"message": "Patient registered"}


# --------------------------------------------------------------
# GET ALL PATIENTS
# --------------------------------------------------------------

@app.get("/patients/")
def get_all_patients(db: Session = Depends(get_db), user: User = Depends(get_current_user)):

    if user.role not in ["doctor", "pharmacy", "receptionist", "counter", "admin"]:
        raise HTTPException(403, "Access denied")

    rows = db.query(MedicalReport).filter(MedicalReport.is_deleted != True).all()
    result = []

    for r in rows:
        st = r.json_data.get("structured_data", {}) if isinstance(r.json_data, dict) else {}

        result.append({
            "id": r.id,
            "patient_id": st.get("Patient ID", ""),
            "name": st.get("Patient Name", r.patient_name),
            "age": st.get("Age", r.age),
            "sex": st.get("Sex", r.sex),
            "contact": st.get("Contact", ""),
            "address": st.get("Address", "Not Provided"),
            "created_at": r.id
        })

    return sorted(result, key=lambda x: x["created_at"], reverse=True)


# --------------------------------------------------------------
# CREATE PRESCRIPTION (DOCTOR)
# --------------------------------------------------------------

@app.post("/prescriptions/")
def create_prescription(
    data: dict = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if user.role != "doctor":
        raise HTTPException(403, "Only doctors allowed")

    pid = data.get("patient_id")
    if not pid:
        raise HTTPException(400, "Patient ID required")

    diagnosis = data.get("diagnosis", "")
    meds = data.get("medicines", [])
    tests = data.get("tests", [])

    # Clean doctor name
    doc = re.sub(r"^(Dr\.?|Doctor)\s+", "", user.full_name, flags=re.IGNORECASE).strip()

    clean_tests = []
    for t in tests:
        if isinstance(t, dict):
            v = t.get("test_name") or t.get("name")
            if v:
                clean_tests.append(v)
        else:
            clean_tests.append(t)

    if not clean_tests:
        clean_tests = ["No tests selected"]

    record = Prescription(
        patient_id=pid,
        diagnosis=diagnosis,
        medicines={"doctor": doc, "items": meds},
        tests=clean_tests,
        created_at=datetime.utcnow()
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    for t in clean_tests:
        if t.lower() not in ["no tests", "no tests selected"]:
            db.add(TestRequest(
                patient_id=pid,
                doctor_id=user.id,
                test_name=t,
                status="Not Done Yet",
                payment_status="Unpaid",
                created_at=datetime.utcnow()
            ))
    db.commit()

    return {"message": "Prescription saved", "tests": clean_tests}

# --------------------------------------------------------------
# GET PRESCRIPTIONS FOR A PATIENT
# --------------------------------------------------------------

@app.get("/prescriptions/{patient_id}")
def get_prescriptions_by_patient(patient_id: int, db: Session = Depends(get_db)):

    def clean_doctor(name):
        if not name:
            return "Unknown"
        return re.sub(r"^(Dr\.?|Doctor)\s+", "", name, flags=re.IGNORECASE).strip()

    rows = db.query(Prescription).filter(Prescription.patient_id == patient_id).all()
    output = []

    for p in rows:
        # fetch all test rows for this patient
        test_rows = db.query(TestRequest).filter(
            TestRequest.patient_id == patient_id
        ).all()

        live_tests = []
        for test_name in (p.tests or []):
            # match database row for status
            match = next(
                (t for t in test_rows if t.test_name.lower() == test_name.lower()),
                None
            )

            status = "Completed" if (match and match.status.lower() == "completed") else "Pending"

            live_tests.append({
                "test_name": test_name,
                "status": status
            })

        raw_doc = p.medicines.get("doctor") if isinstance(p.medicines, dict) else "Unknown"
        doctor = clean_doctor(raw_doc)

        output.append({
            "id": p.id,
            "diagnosis": p.diagnosis,
            "doctor": doctor,
            "created_at": (
    p.created_at.isoformat()
    if hasattr(p.created_at, "isoformat")
    else p.created_at
),
            "medicines": (
                p.medicines.get("items") if isinstance(p.medicines, dict) else []
            ),
            "tests": live_tests
        })

    return {"prescriptions": output}

# --------------------------------------------------------------
# GET ALL LAB TESTS (Used by Doctor & Counter)
# --------------------------------------------------------------

@app.get("/lab/tests")
def get_lab_tests(db: Session = Depends(get_db)):
    tests = db.query(LabTest).all()
    return {"tests": [{"id": t.id, "name": t.name, "price": t.price} for t in tests]}


# --------------------------------------------------------------
# COUNTER — PENDING TESTS
# --------------------------------------------------------------

@app.get("/counter/pending-tests/{query}")
def get_pending_tests(query: str, db: Session = Depends(get_db)):

    rows = (
        db.query(TestRequest)
        .join(MedicalReport, TestRequest.patient_id == MedicalReport.id)
        .filter(MedicalReport.patient_name.ilike(f"%{query}%"))
        .all()
    )

    result = []

    for t in rows:
        if t.payment_status != "Unpaid":
            continue

        lab = db.query(LabTest).filter(LabTest.name.ilike(t.test_name)).first()
        price = lab.price if lab else 0

        result.append({
            "id": t.id,
            "test_name": t.test_name,
            "price": price,
            "status": t.status,
            "payment_status": t.payment_status,
            "patient_name": (
                t.report.patient_name
                if hasattr(t, "report") and t.report
                else "Unknown"
            )
        })

    return {"pending_tests": result}


# --------------------------------------------------------------
# COUNTER — PAY & GENERATE BILL
# --------------------------------------------------------------

@app.post("/counter/pay-tests/")
def pay_tests(data: dict = Body(...), db: Session = Depends(get_db)):

    patient_id   = data.get("patient_id")
    test_ids     = data.get("test_ids", [])      # real TestRequest integer ids
    manual_tests = data.get("manual_tests", [])  # manually searched LabTests
    discount     = float(data.get("discount", 0))
    payment_method = data.get("payment_method", "cash")

    if not test_ids and not manual_tests:
        raise HTTPException(400, "No tests selected")

    total = 0
    items = []

    # ── Pending TestRequest items ──
    if test_ids:
        # Filter to only integer ids (safety guard)
        int_ids = [int(i) for i in test_ids if str(i).isdigit()]
        rows = db.query(TestRequest).filter(TestRequest.id.in_(int_ids)).all()
        if not rows and not manual_tests:
            raise HTTPException(404, "Tests not found")

        if not patient_id and rows:
            patient_id = rows[0].patient_id

        for t in rows:
            lab = db.query(LabTest).filter(LabTest.name.ilike(t.test_name)).first()
            price = lab.price if lab else 0
            total += price
            items.append({"qty": 1, "price": price, "description": t.test_name})
            t.payment_status = "Paid"
            t.payment_verified_at = datetime.utcnow()

    # ── Manually searched LabTest items ──
    for m in manual_tests:
        price = float(m.get("price", 0))
        name  = m.get("name", "Lab Test")
        total += price
        items.append({"qty": 1, "price": price, "description": name})

    if not patient_id:
        raise HTTPException(400, "patient_id required")

    discount_amount = total * (discount / 100)
    net_total = total - discount_amount

    bill = Bill(
        patient_id=patient_id,
        total_amount=total,
        discount=discount,
        net_total=net_total,
        status="paid",
        payment_method=payment_method,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    bill.invoice_number = generate_invoice_number(bill.id)

    for it in items:
        db.add(BillItem(
            bill_id=bill.id,
            medicine_id=0,
            qty=it["qty"],
            price=it["price"],
            description=it["description"],
        ))
    db.commit()

    return {
        "message":        "Bill generated",
        "bill_id":        bill.id,
        "invoice_number": bill.invoice_number,
        "total":          total,
        "discount":       discount,
        "net_total":      net_total,
    }

# --------------------------------------------------------------
# RECEPTIONIST — CONSULTATION BILL
# --------------------------------------------------------------
@app.post("/counter/consultation-bill/")
def consultation_bill(data: dict = Body(...), db: Session = Depends(get_db)):
    patient_id     = data.get("patient_id")
    payment_method = data.get("payment_method", "cash")
    doctor_name    = data.get("doctor_name", "")
    specialization = data.get("specialization", "")
    amount         = float(data.get("amount", 500))  # 500 normal, 300 self, 0 follow-up
    description    = data.get("description", "")
    if not patient_id:
        raise HTTPException(400, "patient_id required")

    # Build description
    if not description:
        dr_part = f"Dr. {doctor_name}" if doctor_name else ""
        spec_part = f" — {specialization}" if specialization else ""
        if payment_method == "follow-up":
            description = f"Follow-up Visit ({dr_part}{spec_part})" if dr_part else "Follow-up Visit"
        else:
            description = f"Consultation Fee ({dr_part}{spec_part})" if dr_part else "Consultation Fee"

    bill = Bill(patient_id=patient_id, total_amount=amount, discount=0,
                net_total=amount, status="paid", payment_method=payment_method,
                created_at=datetime.utcnow())
    db.add(bill); db.commit(); db.refresh(bill)
    db.add(BillItem(bill_id=bill.id, medicine_id=0, qty=1, price=amount, description=description))
    db.commit()
    return {"message": "Bill created", "bill_id": bill.id, "invoice_number": f"INV-{bill.id:05d}"}

# --------------------------------------------------------------
# TECHNICIAN — GET TEST LIST
# --------------------------------------------------------------

@app.get("/technician/tests/{query}")
def get_technician_tests(query: str, db: Session = Depends(get_db)):

    rows = (
        db.query(TestRequest)
        .join(MedicalReport, TestRequest.patient_id == MedicalReport.id)
        .filter(MedicalReport.patient_name.ilike(f"%{query}%"))
        .all()
    )

    return {
        "tests": [
            {
                "id": t.id,
                "test_name": t.test_name,
                "status": t.status,
                "payment_status": t.payment_status,
                "patient_name": (
                    t.report.patient_name
                    if hasattr(t, "report") and t.report
                    else "Unknown"
                ),
                "created_at": (
                    t.created_at.strftime("%Y/%m/%d %I:%M %p")
                    if t.created_at else "N/A"
                )
            }
            for t in rows
        ]
    }


# --------------------------------------------------------------
# TECHNICIAN — UPDATE TEST STATUS
# --------------------------------------------------------------

@app.patch("/technician/update-status/{test_id}")
def update_test_status(test_id: int, data: dict = Body(...), db: Session = Depends(get_db)):

    t = db.query(TestRequest).filter(TestRequest.id == test_id).first()
    if not t:
        raise HTTPException(404, "Test not found")

    new_status = data.get("status")
    if new_status not in ["Completed", "Not Done Yet"]:
        raise HTTPException(400, "Invalid status")

    t.status = new_status
    db.commit()

    return {"message": f"Status updated to {new_status}"}

# --------------------------------------------------------------
# ADMIN — ANALYTICS
# --------------------------------------------------------------

@app.get("/admin/analytics/")
def get_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")

    # Total patients
    total_patients = db.query(MedicalReport).count()

    # Total revenue
    bills = db.query(Bill).all()
    total_revenue = sum(b.net_total or 0 for b in bills)

    # Revenue this month
    now = datetime.utcnow()
    monthly_revenue = sum(
        b.net_total or 0 for b in bills
        if b.created_at and b.created_at.month == now.month
        and b.created_at.year == now.year
    )

    # Revenue by month (last 6 months)
    from collections import defaultdict
    monthly = defaultdict(float)
    for b in bills:
        if b.created_at:
            key = b.created_at.strftime("%b %Y")
            monthly[key] += float(b.net_total or 0)

    revenue_by_month = [
        {"month": k, "revenue": v}
        for k, v in sorted(monthly.items(),
            key=lambda x: datetime.strptime(x[0], "%b %Y"))
    ][-6:]

    # Top 5 diagnoses
    from collections import Counter
    prescriptions = db.query(Prescription).all()
    diagnoses = [p.diagnosis for p in prescriptions if p.diagnosis]
    top_diagnoses = [
        {"diagnosis": d, "count": c}
        for d, c in Counter(diagnoses).most_common(5)
    ]

    # Total bills count
    total_bills = len(bills)

    return {
        "total_patients":   total_patients,
        "total_revenue":    total_revenue,
        "monthly_revenue":  monthly_revenue,
        "revenue_by_month": revenue_by_month,
        "top_diagnoses":    top_diagnoses,
        "total_bills":      total_bills,
    }


# --------------------------------------------------------------
# TECHNICIAN — UPLOAD REPORT (OCR OR JSON)
# --------------------------------------------------------------

@app.post("/technician/upload-report/{test_id}")
async def upload_report(test_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):

    t = db.query(TestRequest).filter(TestRequest.id == test_id).first()
    if not t:
        raise HTTPException(404, "Test not found")

    content = await file.read()

    # CASE 1: IMAGE OCR
    if file.content_type.startswith("image/"):
        try:
            proc = preprocess_image(content)
            reader = easyocr.Reader(["en"])
            blocks = reader.readtext(proc, detail=0)
            raw_text = " ".join(blocks)
        except Exception as e:
            raise HTTPException(400, f"OCR failed: {str(e)}")

        structured = extract_structured_data(raw_text)
        extracted = extract_medical_values(raw_text)
        analysis = analyze_medical_values(extracted)

    # CASE 2: JSON REPORT
    else:
        try:
            data = json.loads(content.decode("utf-8"))
        except:
            raise HTTPException(400, "Invalid JSON uploaded")

        raw_text = data.get("raw_text", "")
        structured = data.get("structured_data", {})
        analysis = data.get("medical_analysis", {})

    t.ocr_report = {
        "raw_text": raw_text,
        "structured_data": structured,
        "medical_analysis": analysis
    }

    t.status = "Completed"
    db.commit()

    return {"message": "Report uploaded successfully"}


# --------------------------------------------------------------
# DOCTOR + PHARMACY — VIEW REPORTS
# --------------------------------------------------------------

@app.get("/reports/")
def get_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):

    if user.role not in ["doctor", "pharmacy"]:
        raise HTTPException(403, "Access Denied")

    rows = db.query(MedicalReport).filter(MedicalReport.is_deleted != True).all()
    out = []

    for r in rows:
        st = r.json_data.get("structured_data", {}) if isinstance(r.json_data, dict) else {}
        med = r.json_data.get("medical_analysis", {}) if isinstance(r.json_data, dict) else {}

        out.append({
            "id": r.id,
            "structured_data": st,
            "medical_analysis": med
        })

    return {"reports": out}


# --------------------------------------------------------------
# AI REPORTS PER PATIENT
# --------------------------------------------------------------

@app.get("/ai-reports/{patient_id}")
def get_ai_reports(patient_id: int, db: Session = Depends(get_db)):

    rows = db.query(TestRequest).filter(TestRequest.patient_id == patient_id).all()

    out = []
    for t in rows:
        if t.ocr_report:
            out.append({
                "test_name": t.test_name,
                "ocr_report": t.ocr_report,
                "status": t.status,
                "created_at": (
                    t.created_at.strftime("%Y-%m-%d %H:%M:%S")
                    if t.created_at else "N/A"
                )
            })

    return {"ai_reports": out}


# --------------------------------------------------------------
# BILLING — PATIENT BILL HISTORY
# --------------------------------------------------------------

@app.get("/billing/patient/{patient_id}")
def get_patient_bills(patient_id: int, db: Session = Depends(get_db)):

    rows = db.query(Bill).filter(Bill.patient_id == patient_id).all()

    return {
        "bills": [
            {
                "bill_id": b.id,
                "date": b.created_at.strftime("%Y-%m-%d %H:%M"),
                "total": b.total_amount,
                "discount": b.discount,
                "net_total": b.net_total,
                "status": b.status,
                "items": [
                    {
                        "medicine_id": i.medicine_id,
                        "qty": i.qty,
                        "price": i.price,
                        "subtotal": (i.qty or 0) * (i.price or 0)
                    }
                    for i in b.items
                ]
            }
            for b in rows
        ]
    }


# --------------------------------------------------------------
# BILLING — INVOICE DETAILS
# --------------------------------------------------------------

@app.get("/billing/invoice/{bill_id}")
def get_invoice(bill_id: int, db: Session = Depends(get_db)):

    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")

    patient = db.query(MedicalReport).filter(MedicalReport.id == bill.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    st = patient.json_data.get("structured_data", {}) if isinstance(patient.json_data, dict) else {}

    # Prepare invoice items
    items = []
    for i in bill.items:
        if i.medicine_id and i.medicine_id != 0:
            med = db.query(Medicine).filter(Medicine.id == i.medicine_id).first()
            name = med.name if med else "Unknown"
        else:
            name = i.description or "Lab Test"

        items.append({
            "name": name,
            "qty": i.qty,
            "price": i.price,
            "subtotal": (i.qty or 0) * (i.price or 0)
        })

    return {
        "bill": {
            "bill_id": bill.id,
            "date": bill.created_at.strftime("%Y-%m-%d %H:%M"),
            "total": bill.total_amount,
            "discount": bill.discount,
            "net_total": bill.net_total,
            "status": bill.status,
            "payment_method": bill.payment_method
        },
        "items": items,
        "patient": {
            "id": patient.id,
            "patient_id": st.get("Patient ID", ""),
            "name": st.get("Patient Name", patient.patient_name),
            "age": st.get("Age", ""),
            "gender": st.get("Sex", ""),
            "address": st.get("Address", "Not Provided")
        }
    }

# --------------------------------------------------------------
# ADMIN — ALL PATIENTS (including soft deleted)
# --------------------------------------------------------------

@app.get("/admin/all-patients/")
def get_all_patients_admin(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    rows = db.query(MedicalReport).all()
    result = []
    for r in rows:
        st = r.json_data.get("structured_data", {}) if isinstance(r.json_data, dict) else {}
        result.append({
            "id":         r.id,
            "patient_id": st.get("Patient ID", ""),
            "name":       st.get("Patient Name", r.patient_name),
            "age":        st.get("Age", r.age),
            "sex":        st.get("Sex", r.sex),
            "contact":    st.get("Contact", ""),
            "address":    st.get("Address", ""),
            "is_deleted": r.is_deleted or False,
        })
    return sorted(result, key=lambda x: x["id"], reverse=True)


@app.patch("/admin/soft-delete-patient/{patient_id}")
def soft_delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    r = db.query(MedicalReport).filter(MedicalReport.id == patient_id).first()
    if not r:
        raise HTTPException(404, "Patient not found")
    r.is_deleted = True
    db.commit()
    return {"message": "Patient removed from active records"}


@app.patch("/admin/restore-patient/{patient_id}")
def restore_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    r = db.query(MedicalReport).filter(MedicalReport.id == patient_id).first()
    if not r:
        raise HTTPException(404, "Patient not found")
    r.is_deleted = False
    db.commit()
    return {"message": "Patient restored"}


# --------------------------------------------------------------
# ADMIN — ANALYTICS V2
# --------------------------------------------------------------

@app.get("/admin/analytics-v2/")
def get_analytics_v2(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")

    from collections import Counter, defaultdict
    import numpy as np
    from sklearn.linear_model import LinearRegression

    now         = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = now - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── Patients ──
    all_patients   = db.query(MedicalReport).all()
    total_patients = len([p for p in all_patients if not p.is_deleted])

    # ── Bills ──
    bills       = db.query(Bill).all()
    bills_today = [b for b in bills if b.created_at and b.created_at >= today_start]
    bills_week  = [b for b in bills if b.created_at and b.created_at >= week_start]
    bills_month = [b for b in bills if b.created_at and b.created_at >= month_start]

    # Seed data only goes to Dec 2025 — fallback to latest available month
    if not bills_month:
        latest = max((b.created_at for b in bills if b.created_at), default=now)
        latest_month_start = latest.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        bills_month = [b for b in bills if b.created_at and b.created_at >= latest_month_start]

    pharmacy_total = sum(b.net_total or 0 for b in bills)
    pharmacy_month = sum(b.net_total or 0 for b in bills_month)

    # ── Prescriptions (visits) ──
    prescriptions = db.query(Prescription).all()
    rx_today      = [p for p in prescriptions if p.created_at and p.created_at >= today_start]
    rx_week       = [p for p in prescriptions if p.created_at and p.created_at >= week_start]
    rx_month      = [p for p in prescriptions if p.created_at and p.created_at >= month_start]

    # ── Revenue constants ──
    CONSULT_FEE  = 500
    AVG_TEST_FEE = 300
    TEST_RATIO   = 0.4
    VISIT_MULTI  = 4   # 1 prescription = ~4 patient interactions

    consult_total = len(bills) * CONSULT_FEE
    consult_month = len(bills_month) * CONSULT_FEE
    test_total    = int(len(bills) * TEST_RATIO * AVG_TEST_FEE)
    test_month    = int(len(bills_month) * TEST_RATIO * AVG_TEST_FEE)

    total_revenue = pharmacy_total + consult_total + test_total
    revenue_month = pharmacy_month + consult_month + test_month
    revenue_today = len(rx_today) * (CONSULT_FEE + int(TEST_RATIO * AVG_TEST_FEE))
    revenue_week  = len(rx_week)  * (CONSULT_FEE + int(TEST_RATIO * AVG_TEST_FEE))

    # ── Revenue by month — rolling last 6 months ──
    six_months_ago = (now.replace(day=1) - timedelta(days=5*31)).replace(day=1)
    monthly = defaultdict(float)
    for b in bills:
        if b.created_at and b.created_at >= six_months_ago:
            m_key = b.created_at.strftime("%b %Y")
            monthly[m_key] += float(b.net_total or 0) + CONSULT_FEE + int(TEST_RATIO * AVG_TEST_FEE)
    # Also add prescription-only months (Jan-Mar 2026 have no bills)
    for p in prescriptions:
        if p.created_at and p.created_at >= six_months_ago:
            m_key = p.created_at.strftime("%b %Y")
            monthly[m_key] += CONSULT_FEE + int(TEST_RATIO * AVG_TEST_FEE)

    revenue_by_month = [
        {"month": k, "revenue": round(v, 0)}
        for k, v in sorted(monthly.items(), key=lambda x: datetime.strptime(x[0], "%b %Y"))
    ][-6:]

    # ── ML forecast — train on all bills (full 5yr trend), not just last 6 ──
    forecast_next_month = 0
    try:
        bill_monthly = defaultdict(float)
        for b in bills:
            if b.created_at:
                m_key = b.created_at.strftime("%b %Y")
                bill_monthly[m_key] += float(b.net_total or 0) + CONSULT_FEE + int(TEST_RATIO * AVG_TEST_FEE)
        sorted_months = sorted(bill_monthly.items(), key=lambda x: datetime.strptime(x[0], "%b %Y"))
        if len(sorted_months) >= 6:
            X = np.array(range(len(sorted_months))).reshape(-1, 1)
            y = np.array([v for _, v in sorted_months])
            ml = LinearRegression()
            ml.fit(X, y)
            forecast_next_month = max(0, int(ml.predict([[len(sorted_months)]])[0]))
    except:
        forecast_next_month = 0

    # ── Doctor workload this month ──
    doctor_counts_month = Counter()
    doctor_counts_all   = Counter()
    for p in prescriptions:
        doc = p.medicines.get("doctor") if isinstance(p.medicines, dict) else None
        if doc:
            doctor_counts_all[doc] += 1
            if p.created_at and p.created_at >= month_start:
                doctor_counts_month[doc] += 1

    doctors = db.query(User).filter(User.role == "doctor", User.is_deleted != True).all()
    doctor_workload = []
    for d in doctors:
        clean = re.sub(r"^(Dr\.?|Doctor)\s+", "", d.full_name, flags=re.IGNORECASE).strip()
        pm = doctor_counts_month.get(clean, 0) * VISIT_MULTI
        pa = doctor_counts_all.get(clean, 0) * VISIT_MULTI
        doctor_workload.append({
            "id":             d.id,
            "name":           d.full_name,
            "specialization": d.specialization or "—",
            "patients_month": pm,
            "patient_count":  pa,
            "revenue":        pa * CONSULT_FEE,
        })
    doctor_workload.sort(key=lambda x: x["patients_month"], reverse=True)

    return {
        "total_patients":      total_patients,
        "visits_today":        len(rx_today),
        "visits_week":         len(rx_week),
        "visits_month":        len(rx_month) * VISIT_MULTI,
        "total_revenue":       round(total_revenue, 0),
        "pharmacy_revenue":    round(pharmacy_total, 0),
        "doctor_revenue":      round(consult_total, 0),
        "test_revenue":        round(test_total, 0),
        "revenue_today":       round(revenue_today, 0),
        "revenue_week":        round(revenue_week, 0),
        "revenue_month":       round(revenue_month, 0),
        "forecast_next_month": forecast_next_month,
        "revenue_by_month":    revenue_by_month,
        "doctor_workload":     doctor_workload,
        "total_bills":         len(bills),
    }

# --------------------------------------------------------------
# FOLLOW-UP SYSTEM
# --------------------------------------------------------------

@app.post("/followup/assign/")
def assign_followup(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "doctor":
        raise HTTPException(403, "Only doctors can assign follow-ups")

    patient_id = data.get("patient_id")
    if not patient_id:
        raise HTTPException(400, "patient_id required")

    # Remove any existing unused follow-up first
    existing = db.query(FollowUp).filter(
        FollowUp.patient_id == patient_id,
        FollowUp.used == False
    ).first()
    if existing:
        db.delete(existing)

    f = FollowUp(patient_id=patient_id, doctor_id=user.id)
    db.add(f)
    db.commit()
    return {"message": "Follow-up assigned", "patient_id": patient_id}


@app.get("/followup/check/{patient_id}")
def check_followup(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    f = db.query(FollowUp).filter(
        FollowUp.patient_id == patient_id,
        FollowUp.used == False
    ).first()

    if not f:
        return {"has_followup": False}

    doctor = db.query(User).filter(User.id == f.doctor_id).first()
    return {
        "has_followup":  True,
        "followup_id":   f.id,
        "assigned_by":   doctor.full_name if doctor else "Unknown",
        "assigned_at":   f.assigned_at.strftime("%Y-%m-%d %H:%M") if f.assigned_at else "—",
    }


@app.post("/followup/use/{patient_id}")
def use_followup(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    f = db.query(FollowUp).filter(
        FollowUp.patient_id == patient_id,
        FollowUp.used == False
    ).first()

    if not f:
        raise HTTPException(404, "No active follow-up found")

    f.used    = True
    f.used_at = datetime.utcnow()
    db.commit()
    return {"message": "Follow-up used", "patient_id": patient_id}


@app.delete("/followup/cancel/{patient_id}")
def cancel_followup(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "doctor":
        raise HTTPException(403, "Only doctors can cancel follow-ups")
    f = db.query(FollowUp).filter(
        FollowUp.patient_id == patient_id,
        FollowUp.used == False
    ).first()
    if not f:
        raise HTTPException(404, "No active follow-up found")
    db.delete(f)
    db.commit()
    return {"message": "Follow-up cancelled", "patient_id": patient_id}

# --------------------------------------------------------------
# PHARMACY ADMIN — ANALYTICS
# --------------------------------------------------------------

@app.get("/pharmacy-admin/analytics/")
def pharmacy_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from collections import Counter, defaultdict

    # Top selling medicines from bill_items
    items = db.query(BillItem).all()

    sales_count  = Counter()
    sales_revenue = defaultdict(float)

    for item in items:
        if item.medicine_id and item.medicine_id != 0:
            med = db.query(Medicine).filter(Medicine.id == item.medicine_id).first()
            name = med.name if med else "Unknown"
        else:
            continue
        sales_count[name]   += item.qty or 0
        sales_revenue[name] += (item.qty or 0) * (item.price or 0)

    top_selling = [
        {"name": k, "qty": v, "revenue": round(sales_revenue[k], 2)}
        for k, v in sales_count.most_common(8)
    ]

    # Total pharmacy revenue
    total_revenue = sum(sales_revenue.values())

    # Revenue by medicine for chart
    revenue_by_med = sorted(
        [{"name": k, "revenue": round(v, 2)} for k, v in sales_revenue.items()],
        key=lambda x: x["revenue"], reverse=True
    )[:8]

    # Refill prediction — based on avg daily sales rate
    from datetime import datetime, timedelta
    bills = db.query(Bill).all()
    if bills:
        oldest = min((b.created_at for b in bills if b.created_at), default=datetime.utcnow())
        days_active = max((datetime.utcnow() - oldest).days, 1)
    else:
        days_active = 1

    medicines = db.query(Medicine).all()
    refill_predictions = []
    for med in medicines:
        total_sold = sales_count.get(med.name, 0)
        avg_per_day = total_sold / days_active
        total_qty = sum(s.quantity or 0 for s in med.stock) if med.stock else 0
        if avg_per_day > 0:
            days_left = int(total_qty / avg_per_day)
            refill_date = datetime.utcnow() + timedelta(days=days_left)
            refill_predictions.append({
                "name":         med.name,
                "qty_left":     total_qty,
                "avg_per_day":  round(avg_per_day, 2),
                "days_left":    days_left,
                "refill_by":    refill_date.strftime("%Y-%m-%d"),
                "urgent":       days_left < 14,
            })

    refill_predictions.sort(key=lambda x: x["days_left"])

    return {
        "top_selling":        top_selling,
        "total_revenue":      round(total_revenue, 2),
        "revenue_by_med":     revenue_by_med,
        "refill_predictions": refill_predictions[:10],
        "days_active":        days_active,
    }

# --------------------------------------------------------------
# PHARMACY ADMIN — ML PREDICTIONS
# --------------------------------------------------------------

@app.get("/pharmacy-admin/ml-predictions/")
def pharmacy_ml_predictions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    from collections import defaultdict
    import numpy as np
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import r2_score

    rows = db.execute(text("""
        SELECT m.name, m.price, bi.qty, b.created_at
        FROM bill_items bi
        JOIN bills b ON bi.bill_id = b.id
        JOIN medicines m ON bi.medicine_id = m.id
        WHERE bi.medicine_id != 0 AND bi.qty > 0
        ORDER BY b.created_at
    """)).fetchall()

    if not rows:
        return {"predictions": [], "confidence": 0, "top5": []}

    earliest = min(r[3] for r in rows)

    # Group by medicine + month index
    med_months = defaultdict(lambda: defaultdict(lambda: {"qty": 0, "revenue": 0.0}))
    for name, price, qty, created_at in rows:
        m_idx = (created_at.year - earliest.year) * 12 + (created_at.month - earliest.month)
        med_months[name.strip()][m_idx]["qty"]     += qty
        med_months[name.strip()][m_idx]["revenue"] += qty * (price or 0)

    results   = []
    r2_scores = []

    for med_name, month_data in med_months.items():
        active = sorted(month_data.keys())
        if len(active) < 3:
            continue

        X = np.array(active).reshape(-1, 1)
        y = np.array([month_data[m]["qty"] for m in active], dtype=float)

        model = LinearRegression()
        model.fit(X, y)

        y_pred = model.predict(X)
        r2     = r2_score(y, y_pred) if len(active) > 2 else 0
        r2     = max(0.0, min(float(r2), 1.0))
        r2_scores.append(r2)

        # Predict next 3 months
        last_idx  = active[-1]
        future_X  = np.array([[last_idx + i] for i in range(1, 4)])
        pred_vals = [max(0, round(float(v), 1)) for v in model.predict(future_X)]

        slope      = float(model.coef_[0])
        total_sold = int(sum(y))
        monthly_avg = round(float(np.mean(y)), 1)
        confidence  = round(r2 * 100, 1)
        total_rev   = sum(month_data[m]["revenue"] for m in active)

        # Only mark as increasing if slope is meaningfully positive
        trend = "increasing" if slope > 2 else "decreasing" if slope < -2 else "stable"

        results.append({
            "name":                 med_name,
            "total_sold":           total_sold,
            "monthly_avg":          monthly_avg,
            "trend":                trend,
            "predicted_3m":         pred_vals,
            "predicted_next_month": pred_vals[0] if pred_vals else 0,
            "confidence":           confidence,
            "total_revenue":        round(total_rev, 2),
            "months_of_data":       len(active),
        })

    results.sort(key=lambda x: x["total_sold"], reverse=True)
    overall = round(sum(r2_scores) / len(r2_scores) * 100, 1) if r2_scores else 0

    return {
        "predictions":    results,
        "top5":           results[:5],
        "confidence":     overall,
        "trained_on":     len(rows),
        "months_of_data": max((len(med_months[m]) for m in med_months), default=0),
    }

# --------------------------------------------------------------
# INCLUDE PHARMACY-ADMIN ROUTES
# --------------------------------------------------------------

from app.pharmacy_admin.main_pharmacy_admin import router as pharmacy_admin_router
app.include_router(pharmacy_admin_router, prefix="/pharmacy-admin")


# --------------------------------------------------------------
# ROOT PAGE
# --------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
