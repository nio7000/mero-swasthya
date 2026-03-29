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

from app.models import Patient, TestRequest, Prescription

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
        role=data["role"]
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

    users = db.query(User).all()

    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role
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

    # ❗ Prevent deleting yourself (IMPORTANT)
    if u.id == user.id:
        raise HTTPException(400, "You cannot delete yourself")

    db.delete(u)
    db.commit()

    return {"message": "User deleted successfully"}

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

    rows = db.query(MedicalReport).all()
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
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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
            "created_at": p.created_at,
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

    test_ids = data.get("test_ids", [])
    if not test_ids:
        raise HTTPException(400, "No tests selected")

    rows = db.query(TestRequest).filter(TestRequest.id.in_(test_ids)).all()
    if not rows:
        raise HTTPException(404, "Tests not found")

    patient_id = rows[0].patient_id

    total = 0
    items = []

    for t in rows:
        lab = db.query(LabTest).filter(LabTest.name.ilike(t.test_name)).first()
        price = lab.price if lab else 0

        total += price
        items.append({
            "medicine_id": 0,
            "medicine_name": t.test_name,
            "qty": 1,
            "price": price,
            "subtotal": price
        })

        t.payment_status = "Paid"
        t.payment_verified_at = datetime.utcnow()

    discount = float(data.get("discount", 0))
    discount_amount = total * (discount / 100)
    net_total = total - discount_amount

    bill = Bill(
        patient_id=patient_id,
        total_amount=total,
        discount=discount,
        net_total=net_total,
        status="paid",
        payment_method=data.get("payment_method", "cash")
    )

    db.add(bill)
    db.commit()
    db.refresh(bill)

    bill.invoice_number = generate_invoice_number(bill.id)

    for it in items:
        db.add(BillItem(
            bill_id=bill.id,
            medicine_id=0,
            medicine_name=it["medicine_name"],
            qty=1,
            price=it["price"],
            subtotal=it["subtotal"]
        ))

    db.commit()

    return {
        "message": "Bill generated",
        "bill_id": bill.id,
        "invoice_number": bill.invoice_number,
        "total": total,
        "discount": discount,
        "net_total": net_total
    }
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

    rows = db.query(MedicalReport).all()
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
                        "subtotal": i.subtotal
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
        if i.medicine_id == 0:
            name = i.medicine_name
        else:
            med = db.query(Medicine).filter(Medicine.id == i.medicine_id).first()
            name = med.name if med else "Unknown"

        items.append({
            "name": name,
            "qty": i.qty,
            "price": i.price,
            "subtotal": i.subtotal
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
