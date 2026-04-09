"""
seed_from_csv.py
================
Complete reseed of MeroSwasthya from the provided CSV files.

Sources:
  ~/Downloads/roles.csv                      → roles table
  ~/Downloads/users.csv                      → users table
  ~/Downloads/patients_100_realistic.csv     → patients table
  ~/Downloads/medicines_30.csv               → medicines + stocks tables
  ~/Downloads/admin_analytics_daily.csv      → bills, payments, test_requests, appointments
  ~/Downloads/doctor_workload_monthly.csv    → prescriptions per doctor per month

Run from project root:
    python3 seed_from_csv.py
"""

import sys, csv, random
from datetime import datetime, timedelta, date
from pathlib import Path

sys.path.insert(0, ".")

import bcrypt
from sqlalchemy import text
from app.database import SessionLocal
from app.pharmacy_admin.models_pharmacy import Bill, BillItem, Transaction
from app.models import (
    Prescription, PrescriptionItem, PrescriptionTest,
    TestRequest, Payment,
)

DL = Path.home() / "Downloads"
db = SessionLocal()
random.seed(42)

# ── Role ID mapping: CSV role_id (1-7) → existing DB role IDs (74-80) ─────────
ROLE_MAP = {1: 74, 2: 75, 3: 76, 4: 77, 5: 78, 6: 79, 7: 80}
NPR_PER_USD = 133.0


def read_csv(name):
    with open(DL / name, newline="", encoding="utf-8") as f:
        lines = f.read().splitlines()
    # skip blank/header-only lines (users.csv has an extra "users" line)
    data_lines = [l for l in lines if "," in l]
    reader = csv.DictReader(iter(data_lines))
    return list(reader)


def hash_pw(plain):
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def rand_time(day_date, spread=10):
    return datetime(day_date.year, day_date.month, day_date.day) + timedelta(
        hours=random.randint(8, 8 + spread), minutes=random.randint(0, 59)
    )


# ════════════════════════════════════════════════════════════════════════════
# STEP 1 — Clear all transactional data, patients, users (keep roles)
# ════════════════════════════════════════════════════════════════════════════
print("Step 1: Clearing existing data...")

db.execute(text("DELETE FROM payments"))
db.execute(text("DELETE FROM return_items"))
db.execute(text("DELETE FROM bill_items"))
db.execute(text("DELETE FROM bills"))
db.execute(text("DELETE FROM transactions"))
db.execute(text("DELETE FROM stocks"))
db.execute(text("DELETE FROM prescription_items"))
db.execute(text("DELETE FROM prescription_tests"))
db.execute(text("DELETE FROM prescriptions"))
db.execute(text("DELETE FROM test_requests"))
db.execute(text("DELETE FROM followups"))
db.execute(text("DELETE FROM appointments"))
db.execute(text("DELETE FROM medicine_descriptions"))
db.execute(text("DELETE FROM lab_results"))
db.execute(text("DELETE FROM medical_reports"))
db.execute(text("DELETE FROM medicines"))
db.execute(text("DELETE FROM lab_tests"))
db.execute(text("UPDATE roles SET created_by = NULL"))
db.execute(text("DELETE FROM users"))
db.execute(text("DELETE FROM patients"))
db.commit()
print("  Done.\n")


# ════════════════════════════════════════════════════════════════════════════
# STEP 2 — Seed USERS (with bcrypt passwords)
# ════════════════════════════════════════════════════════════════════════════
print("Step 2: Seeding users...")
users_csv = read_csv("users.csv")
user_id_map = {}  # csv user_id → db id

for row in users_csv:
    csv_uid   = int(row["user_id"])
    role_id   = ROLE_MAP.get(int(row["role_id"]), 74)
    spec      = row.get("specialization", "").strip() or None
    hashed_pw = hash_pw(row["password"].strip() or "123")

    result = db.execute(text("""
        INSERT INTO users (full_name, email, password, role_id, specialization, is_deleted)
        VALUES (:fn, :em, :pw, :rid, :sp, false)
        RETURNING id
    """), {"fn": row["full_name"], "em": row["email"], "pw": hashed_pw,
           "rid": role_id, "sp": spec})
    db_id = result.fetchone()[0]
    user_id_map[csv_uid] = db_id

db.commit()
print(f"  {len(user_id_map)} users seeded.\n")

# Convenience: doctor IDs in DB
doctor_db_ids = [
    user_id_map[int(r["user_id"])]
    for r in users_csv
    if int(r["role_id"]) == 2
]
counter_db_ids = [
    user_id_map[int(r["user_id"])]
    for r in users_csv
    if int(r["role_id"]) == 7
]
admin_db_id = user_id_map.get(1)


# ════════════════════════════════════════════════════════════════════════════
# STEP 3 — Seed PATIENTS (100 realistic)
# ════════════════════════════════════════════════════════════════════════════
print("Step 3: Seeding patients...")
patients_csv = read_csv("patients_100_realistic.csv")
patient_id_map = {}  # csv patient_id → db id

for row in patients_csv:
    csv_pid = int(row["patient_id"])
    code    = f"PA{csv_pid:06d}"
    reg_at  = datetime.strptime(row["registered_at"], "%Y-%m-%d")
    deleted = row["is_deleted"].strip().lower() in ("true", "1", "yes")

    result = db.execute(text("""
        INSERT INTO patients (patient_code, name, age, sex, contact, address, created_at, is_deleted)
        VALUES (:code, :name, :age, :sex, :contact, :address, :reg, :del)
        RETURNING id
    """), {
        "code": code, "name": row["full_name"], "age": int(row["age"]),
        "sex": row["sex"], "contact": row["contact"], "address": row["address"],
        "reg": reg_at, "del": deleted,
    })
    db_id = result.fetchone()[0]
    patient_id_map[csv_pid] = db_id

db.commit()
patient_db_ids = list(patient_id_map.values())
print(f"  {len(patient_id_map)} patients seeded.\n")


# ════════════════════════════════════════════════════════════════════════════
# STEP 4 — Seed MEDICINES + STOCKS
# ════════════════════════════════════════════════════════════════════════════
print("Step 4: Seeding medicines and stocks...")
medicines_csv = read_csv("medicines_30.csv")
medicine_id_map = {}   # csv medicine_id → db id
medicine_prices = {}   # db id → price

for row in medicines_csv:
    csv_mid   = int(row["medicine_id"])
    expiry    = datetime.strptime(row["expiry"], "%Y-%m-%d").date() if row["expiry"] else None

    result = db.execute(text("""
        INSERT INTO medicines (name, manufacturer, strength, category, price,
                               expiry_date, threshold, is_active, created_by)
        VALUES (:name, :mfr, :str, :cat, :price, :exp, :thr, true, :cby)
        RETURNING id
    """), {
        "name": row["name"], "mfr": row["manufacturer"], "str": row["strength"],
        "cat": row["category"], "price": float(row["price"]),
        "exp": expiry, "thr": int(row["threshold"]),
        "cby": admin_db_id,
    })
    db_id = result.fetchone()[0]
    medicine_id_map[csv_mid] = db_id
    medicine_prices[db_id] = float(row["price"])

    # Stock entry
    db.execute(text("""
        INSERT INTO stocks (medicine_id, quantity, updated_at)
        VALUES (:mid, :qty, NOW())
    """), {"mid": db_id, "qty": int(row["quantity"])})

db.commit()
med_db_ids = list(medicine_id_map.values())
print(f"  {len(medicine_id_map)} medicines + stocks seeded.\n")


# ════════════════════════════════════════════════════════════════════════════
# STEP 5 — Seed LAB TESTS (standard panel)
# ════════════════════════════════════════════════════════════════════════════
print("Step 5: Seeding lab tests...")
lab_tests = [
    ("Complete Blood Count (CBC)",        350),
    ("Blood Glucose (Fasting)",           200),
    ("Blood Glucose (PP)",                200),
    ("HbA1c",                             600),
    ("Lipid Profile",                     700),
    ("Liver Function Test (LFT)",         800),
    ("Kidney Function Test (KFT)",        800),
    ("Thyroid Profile (T3/T4/TSH)",       900),
    ("Urine Routine Examination",         200),
    ("Chest X-Ray",                      1200),
    ("ECG",                               500),
    ("Dengue NS1 Antigen",               1000),
    ("Malaria Antigen Test",              400),
    ("Typhoid (Widal Test)",              350),
    ("Hepatitis B Surface Antigen",       500),
    ("Pregnancy Test (urine)",            200),
    ("COVID-19 Antigen Test",             800),
    ("Stool Routine Examination",         200),
    ("Blood Culture",                    1500),
    ("ESR",                               150),
]
lab_test_id_map = {}   # name → db id
lab_test_ids   = []

for name, price in lab_tests:
    result = db.execute(text(
        "INSERT INTO lab_tests (name, price) VALUES (:n, :p) RETURNING id"
    ), {"n": name, "p": price})
    db_id = result.fetchone()[0]
    lab_test_id_map[name] = db_id
    lab_test_ids.append(db_id)

db.commit()
print(f"  {len(lab_test_ids)} lab tests seeded.\n")


# ════════════════════════════════════════════════════════════════════════════
# STEP 6 — Historical data from admin_analytics_daily.csv
#          Bills, Payments, Test Requests, Appointments
# ════════════════════════════════════════════════════════════════════════════
print("Step 6: Seeding historical bills/tests/appointments from daily analytics CSV...")

daily_csv = read_csv("admin_analytics_daily.csv")

bill_count = pay_count = tr_count = appt_count = 0

for i, row in enumerate(daily_csv):
    day            = datetime.strptime(row["date"], "%Y-%m-%d").date()
    n_pharmacy     = int(float(row.get("pharmacy_orders", 0) or 0))
    n_tests        = int(float(row.get("test_orders", 0) or 0))
    n_visits       = int(float(row.get("total_visits", 0) or 0))
    pharmacy_rev   = float(row.get("pharmacy_revenue_npr", 0) or 0)
    test_rev       = float(row.get("test_revenue_npr", 0) or 0)

    # Keep bill count reasonable — cap per day
    n_pharmacy = min(n_pharmacy, 200)
    n_tests    = min(n_tests, 150)
    n_visits   = min(n_visits, 100)

    # ── PHARMACY BILLS ──────────────────────────────────────────────────────
    avg_bill = (pharmacy_rev / n_pharmacy) if n_pharmacy else 800
    for _ in range(n_pharmacy):
        pat_id  = random.choice(patient_db_ids)
        method  = random.choice(["cash","cash","cash","esewa","fonepay","card"])
        bill_dt = rand_time(day)
        total   = round(avg_bill * random.uniform(0.6, 1.4), 2)
        discount= round(total * random.uniform(0, 0.07), 2)
        net     = round(total - discount, 2)

        bill = Bill(
            patient_id=pat_id, total_amount=total, discount=discount,
            net_total=net, status="paid", payment_method=method,
            bill_type="pharmacy", created_at=bill_dt,
        )
        db.add(bill)
        db.flush()

        n_items    = random.randint(1, 3)
        med_sample = random.sample(med_db_ids, min(n_items, len(med_db_ids)))
        for mid in med_sample:
            unit_price = medicine_prices[mid]
            qty        = max(1, int((total / n_items) / unit_price))
            db.add(BillItem(bill_id=bill.id, medicine_id=mid, qty=qty, price=unit_price))
            t = Transaction(medicine_id=mid, type="stock_out", quantity=qty,
                            timestamp=bill_dt,
                            handled_by=random.choice(counter_db_ids) if counter_db_ids else None)
            t.reference_type = "bill"
            t.reference_id   = bill.id
            db.add(t)

        db.add(Payment(bill_id=bill.id, amount=net, method=method,
                       status="paid", paid_at=bill_dt))
        bill_count += 1
        pay_count  += 1

    # ── LAB TEST REQUESTS ────────────────────────────────────────────────────
    for _ in range(n_tests):
        pat_id = random.choice(patient_db_ids)
        doc_id = random.choice(doctor_db_ids)
        lt_id  = random.choice(lab_test_ids)
        req_dt = rand_time(day)
        tr = TestRequest(
            patient_id=pat_id, doctor_id=doc_id, lab_test_id=lt_id,
            notes="Routine investigation", status="Done",
            payment_status="Paid",
            payment_method=random.choice(["cash","esewa","cash"]),
            payment_verified_at=req_dt, ocr_report={}, created_at=req_dt,
        )
        db.add(tr)
        tr_count += 1

    # ── APPOINTMENTS ──────────────────────────────────────────────────────────
    for _ in range(min(n_visits, 30)):
        pat_id  = random.choice(patient_db_ids)
        doc_id  = random.choice(doctor_db_ids)
        appt_dt = rand_time(day)
        db.execute(text("""
            INSERT INTO appointments
                (patient_id, doctor_id, date, status, created_at, updated_at, is_deleted)
            VALUES (:p, :d, :dt, 'completed', :dt, :dt, false)
        """), {"p": pat_id, "d": doc_id, "dt": appt_dt})
        appt_count += 1

    if (i + 1) % 60 == 0:
        db.commit()
        print(f"  {i+1}/{len(daily_csv)} days — bills:{bill_count} tests:{tr_count} appts:{appt_count}")

db.commit()
print(f"  Bills: {bill_count}, Tests: {tr_count}, Appts: {appt_count}\n")


# ════════════════════════════════════════════════════════════════════════════
# STEP 7 — Prescriptions from doctor_workload_monthly.csv
# ════════════════════════════════════════════════════════════════════════════
print("Step 7: Seeding prescriptions from doctor workload CSV...")

workload_csv = read_csv("doctor_workload_monthly.csv")

diagnoses = [
    "Hypertension","Type 2 Diabetes","Upper Respiratory Infection","Gastritis",
    "Migraine","Typhoid Fever","Anemia","Urinary Tract Infection","Bronchitis",
    "Skin Allergy","Back Pain","Arthritis","Anxiety Disorder","Hypothyroidism",
    "Viral Fever","Malaria","Dengue","GERD","Kidney Stone","Fatty Liver",
    "Pneumonia","Conjunctivitis","Sinusitis","Tonsillitis","Asthma",
]

rx_count = 0

# Map doctor CSV names to DB ids (by matching full_name)
doc_name_to_db_id = {}
for row in users_csv:
    if int(row["role_id"]) == 2:
        doc_name_to_db_id[row["full_name"].strip()] = user_id_map[int(row["user_id"])]

for row in workload_csv:
    period  = row["month_period"]      # "2021-01"
    n_rx    = int(float(row.get("prescriptions", 0) or 0))
    doc_name= row["doctor_name"].strip()
    doc_id  = doc_name_to_db_id.get(doc_name)

    if not doc_id or n_rx == 0:
        continue

    year, month = map(int, period.split("-"))
    # Spread prescriptions across the month
    days_in_month = 28 if month == 2 else 30 if month in (4,6,9,11) else 31

    # Batch into chunks of 30 per day max
    per_day = max(1, n_rx // days_in_month)

    created = 0
    for d in range(1, days_in_month + 1):
        if created >= n_rx:
            break
        day_date = date(year, month, d)
        for _ in range(min(per_day, n_rx - created)):
            pat_id = random.choice(patient_db_ids)
            rx_dt  = rand_time(day_date)

            rx = Prescription(
                patient_id=pat_id, doctor_id=doc_id,
                diagnosis=random.choice(diagnoses),
                status="Active", created_at=rx_dt,
            )
            db.add(rx)
            db.flush()

            # 1-3 medicines
            for mid in random.sample(med_db_ids, min(random.randint(1,3), len(med_db_ids))):
                db.add(PrescriptionItem(
                    prescription_id=rx.id, medicine_id=mid,
                    dosage=random.choice(["Once daily","Twice daily","Three times daily"]),
                    duration=random.choice(["5 days","7 days","10 days","14 days"]),
                ))

            # 0-1 lab tests
            if random.random() < 0.35:
                db.add(PrescriptionTest(
                    prescription_id=rx.id,
                    lab_test_id=random.choice(lab_test_ids),
                ))

            created += 1
            rx_count += 1

    if rx_count % 5000 == 0:
        db.commit()
        print(f"  {rx_count} prescriptions so far...")

db.commit()
print(f"  {rx_count} prescriptions seeded.\n")


db.close()
print(f"""
════════════════════════════════════
SEED COMPLETE
  Users           : {len(user_id_map)}
  Patients        : {len(patient_id_map)}
  Medicines       : {len(medicine_id_map)}
  Lab Tests       : {len(lab_test_ids)}
  Bills+Payments  : {bill_count}
  Test Requests   : {tr_count}
  Appointments    : {appt_count}
  Prescriptions   : {rx_count}
════════════════════════════════════
""")
