from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date

from app.dependencies import get_db, require_roles
from app.models import Medicine, Bill

router = APIRouter(tags=["Pharmacy Admin"])


@router.get("/")
def root():
    return {"message": "Pharmacy Admin API Running"}


@router.get("/dashboard/summary", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def get_summary(db: Session = Depends(get_db)):
    meds  = db.query(Medicine).all()
    today = date.today()
    soon  = today + timedelta(days=30)
    low_stock = expiring_soon = 0

    for m in meds:
        if (m.quantity or 0) < (m.threshold or 0):
            low_stock += 1
        exp = m.expiry
        if isinstance(exp, datetime):
            exp = exp.date()
        if exp and today <= exp <= soon:
            expiring_soon += 1

    return {
        "total_medicines":    len(meds),
        "low_stock_medicines": low_stock,
        "expiring_soon_count": expiring_soon,
    }


@router.get("/medicines/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy", "doctor"))])
def get_medicines(db: Session = Depends(get_db)):
    meds = db.query(Medicine).order_by(Medicine.medicine_id).all()
    return {"medicines": [{
        "id": m.id, "name": m.name, "strength": m.strength, "category": m.category,
        "manufacturer": m.manufacturer, "price": m.price,
        "expiry": str(m.expiry) if m.expiry else None,
        "expiry_date": str(m.expiry) if m.expiry else None,
        "threshold": m.threshold, "quantity": m.quantity or 0,
        "total_qty": m.quantity or 0,
    } for m in meds]}


@router.post("/medicines/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def add_medicine(data: dict = Body(...), db: Session = Depends(get_db)):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Medicine name required")
    if db.query(Medicine).filter(Medicine.name.ilike(name)).first():
        raise HTTPException(400, "Medicine already exists")

    expiry = None
    raw = data.get("expiry") or data.get("expiry_date")
    if raw:
        try:
            expiry = datetime.strptime(raw, "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(400, "Invalid expiry date")

    med = Medicine(
        name=name, strength=data.get("strength"), category=data.get("category"),
        manufacturer=data.get("manufacturer"), price=data.get("price"),
        quantity=int(data.get("quantity", 0)), expiry=expiry,
        threshold=data.get("threshold", 10),
    )
    db.add(med); db.commit(); db.refresh(med)
    return {"message": "Medicine added", "id": med.id}


@router.put("/medicines/{medicine_id}", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def update_medicine(medicine_id: int, data: dict = Body(...), db: Session = Depends(get_db)):
    med = db.query(Medicine).filter(Medicine.medicine_id == medicine_id).first()
    if not med:
        raise HTTPException(404, "Medicine not found")

    if "quantity" in data:
        med.quantity = int(data["quantity"])
    if data.get("name"):
        name = data["name"].strip()
        if db.query(Medicine).filter(Medicine.name.ilike(name), Medicine.medicine_id != medicine_id).first():
            raise HTTPException(400, "Name already exists")
        med.name = name
    for field in ["strength", "category", "manufacturer", "price", "threshold"]:
        if field in data:
            setattr(med, field, data[field])
    raw = data.get("expiry") or data.get("expiry_date")
    if raw:
        try:
            med.expiry = datetime.strptime(raw, "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(400, "Invalid expiry date")

    db.commit()
    return {"message": "Medicine updated"}


@router.delete("/medicines/{medicine_id}", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def delete_medicine(medicine_id: int, db: Session = Depends(get_db)):
    med = db.query(Medicine).filter(Medicine.medicine_id == medicine_id).first()
    if not med:
        raise HTTPException(404, "Medicine not found")
    db.delete(med); db.commit()
    return {"message": "Medicine deleted"}


@router.post("/stock/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def update_stock(data: dict = Body(...), db: Session = Depends(get_db)):
    med_id = data.get("medicine_id")
    qty    = data.get("quantity")
    if not med_id or qty is None:
        raise HTTPException(400, "medicine_id and quantity required")
    med = db.query(Medicine).filter(Medicine.medicine_id == med_id).first()
    if not med:
        raise HTTPException(404, "Medicine not found")
    med.quantity = (med.quantity or 0) + int(qty)
    db.commit()
    return {"message": "Stock updated", "new_quantity": med.quantity}


@router.get("/billing/patient/{patient_id}", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def get_patient_bills(patient_id: int, db: Session = Depends(get_db)):
    bills = db.query(Bill).filter(Bill.patient_id == patient_id, Bill.bill_type == "pharmacy").order_by(Bill.bill_id.desc()).all()
    return {"bills": [
        {"bill_id": b.id, "date": str(b.paid_at), "total_amount": b.total_amount,
         "discount": b.discount, "net_total": b.net_total, "payment_method": b.payment_method}
        for b in bills
    ]}
