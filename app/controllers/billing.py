# Billing endpoints — handles three types of bills:
# - "pharmacy"      → medicine sales (created by PharmacyPortal via pharmacy.py)
# - "test"          → lab test payments (created by CounterPortal)
# - "consultation"  → doctor visit fees (created by CounterPortal)
#
# This file handles counter billing and invoice retrieval.
# Pharmacy billing lives in pharmacy.py (under /pharmacy-admin prefix).

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, TestRequest, Patient, Bill
from app.utils.helpers import generate_invoice_number, fmt_dt

router = APIRouter(tags=["Billing"])


def _create_bill(db, patient_id, total, discount, net, method, bill_type, details=None) -> Bill:
    # Shared helper to create any bill type — keeps the route handlers clean
    bill = Bill(
        patient_id=patient_id, total_amount=total, discount=discount,
        net_total=net, payment_method=method, bill_type=bill_type,
        paid_at=datetime.utcnow(), details=details
    )
    db.add(bill)
    return bill


@router.post("/counter/pay-tests/")
def pay_tests(data: dict = Body(...), db: Session = Depends(get_db)):
    pid          = data.get("patient_id")
    test_ids     = data.get("test_ids", [])
    manual_tests = data.get("manual_tests", [])
    discount     = float(data.get("discount", 0))
    method       = data.get("payment_method", "cash")

    if not test_ids and not manual_tests:
        raise HTTPException(400, "No tests selected")

    total, items = 0, []

    if test_ids:
        # Resolve from TestRequest rows — also marks them as Paid
        int_ids = [int(i) for i in test_ids if str(i).isdigit()]
        rows    = db.query(TestRequest).filter(TestRequest.id.in_(int_ids)).all()

        # If patient_id wasn't provided, infer it from the first test request
        if not pid and rows:
            pid = rows[0].patient_id

        for t in rows:
            price  = float(t.test.price or 0) if t.test else 0
            name   = t.test.name if t.test else "Lab Test"
            total += price
            items.append({"description": name, "qty": 1, "price": price, "subtotal": price})
            t.payment_status = "Paid"
            t.paid_at        = datetime.utcnow()

    # Manual tests are walk-in tests not linked to a doctor's order
    for m in manual_tests:
        price  = float(m.get("price", 0))
        total += price
        items.append({"description": m.get("name", "Lab Test"), "qty": 1, "price": price, "subtotal": price})

    if not pid:
        raise HTTPException(400, "patient_id required")

    net  = total - total * (discount / 100)
    bill = _create_bill(db, pid, total, discount, net, method, "test", details=items)
    db.commit()
    db.refresh(bill)
    return {
        "message":        "Bill generated",
        "bill_id":        bill.id,
        "invoice_number": generate_invoice_number(bill.id),
        "total":          total,
        "discount":       discount,
        "net_total":      net,
    }


@router.post("/counter/consultation-bill/")
def consultation_bill(data: dict = Body(...), db: Session = Depends(get_db)):
    pid = data.get("patient_id")
    if not pid:
        raise HTTPException(400, "patient_id required")
    method = data.get("payment_method", "cash")
    amount = float(data.get("amount", 500))
    desc   = data.get("description") or f"Consultation Fee ({data.get('doctor_name', '')})"
    items  = [{"description": desc, "qty": 1, "price": amount, "subtotal": amount}]
    bill   = _create_bill(db, pid, amount, 0, amount, method, "consultation", details=items)
    db.commit()
    db.refresh(bill)
    return {"message": "Bill created", "bill_id": bill.id, "invoice_number": generate_invoice_number(bill.id)}


@router.get("/billing/patient/{patient_id}")
def get_patient_bills(patient_id: int, db: Session = Depends(get_db)):
    # Returns only test bills for this patient — used by the counter portal history
    rows = db.query(Bill).filter(Bill.patient_id == patient_id, Bill.bill_type == "test").all()
    return {"bills": [
        {
            "bill_id":         b.id,
            "date":            fmt_dt(b.paid_at),
            "total":           b.total_amount,
            "discount":        b.discount,
            "net_total":       b.net_total,
            "payment_method":  b.payment_method,
        }
        for b in rows
    ]}


@router.get("/billing/invoice/{bill_id}")
def get_invoice(bill_id: int, db: Session = Depends(get_db)):
    # Generic invoice endpoint — used by admin portal, pharmacy portal, and counter
    bill = db.query(Bill).filter(Bill.bill_id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    patient = db.query(Patient).filter(Patient.patient_id == bill.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    return {
        "bill": {
            "bill_id":        bill.id,
            "date":           fmt_dt(bill.paid_at),
            "total":          bill.total_amount,
            "discount":       bill.discount,
            "net_total":      bill.net_total,
            "payment_method": bill.payment_method,
        },
        "items":   bill.details or [],   # snapshot stored at billing time
        "patient": {
            "id":      patient.id,
            "name":    patient.full_name,
            "age":     patient.age,
            "gender":  patient.sex,
            "address": patient.address or "Not Provided",
        },
    }


@router.get("/admin/billing/patient/{patient_id}")
def admin_get_patient_bills(patient_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Admin version — returns ALL bill types, not just test bills
    if user.role != "admin":
        raise HTTPException(403, "Access denied")
    rows = db.query(Bill).filter(Bill.patient_id == patient_id).order_by(Bill.bill_id.asc()).all()
    return {"bills": [
        {
            "bill_id":        b.id,
            "date":           fmt_dt(b.paid_at),
            "total":          b.total_amount,
            "discount":       b.discount,
            "net_total":      b.net_total,
            "payment_method": b.payment_method,
            "bill_type":      b.bill_type or "counter",
        }
        for b in rows
    ]}
