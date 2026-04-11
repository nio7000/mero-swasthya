# Pharmacy endpoints — medicine inventory management and billing.
# Used by both pharmacy_admin (full access) and pharmacy (dispensing only).
# Routes are prefixed with /pharmacy-admin so they don't clash with counter billing.

from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_roles
from app.models import Medicine, Bill
from app.utils.helpers import fmt_dt

router = APIRouter(prefix="/pharmacy-admin", tags=["Pharmacy"])

# Both roles share the same endpoints — pharmacy can dispense, pharmacy_admin can also manage inventory
_PHARMACY_ROLES = ("pharmacy_admin", "pharmacy")


@router.get("/dashboard/summary", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def get_summary(db: Session = Depends(get_db)):
    # Quick stats for the pharmacy dashboard header
    meds  = db.query(Medicine).all()
    today = date.today()
    soon  = today + timedelta(days=30)   # medicines expiring within 30 days
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


@router.post("/medicines/", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def add_medicine(data: dict = Body(...), db: Session = Depends(get_db)):
    if not data.get("name"):
        raise HTTPException(400, "Medicine name required")
    name = data["name"].strip()

    # Case-insensitive duplicate check
    if db.query(Medicine).filter(Medicine.name.ilike(name)).first():
        raise HTTPException(400, "Medicine already exists")

    expiry = None
    if data.get("expiry") or data.get("expiry_date"):
        raw = data.get("expiry") or data.get("expiry_date")
        try:
            expiry = datetime.strptime(raw, "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(400, "Invalid expiry date")

    med = Medicine(
        name=name,
        strength=data.get("strength"),
        category=data.get("category"),
        manufacturer=data.get("manufacturer"),
        price=data.get("price"),
        quantity=int(data.get("quantity", 0)),
        expiry=expiry,
        threshold=data.get("threshold", 10),
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return {"message": "Medicine added", "id": med.id}


@router.get("/medicines/", dependencies=[Depends(require_roles(*_PHARMACY_ROLES, "doctor"))])
def get_all_medicines(db: Session = Depends(get_db)):
    # Doctors also need this list for the prescription medicine picker
    meds = db.query(Medicine).order_by(Medicine.medicine_id).all()
    return {"medicines": [{
        "id":          m.id,
        "name":        m.name,
        "strength":    m.strength,
        "category":    m.category,
        "manufacturer": m.manufacturer,
        "price":       m.price,
        "expiry":      str(m.expiry) if m.expiry else None,
        "expiry_date": str(m.expiry) if m.expiry else None,   # alias for frontend compat
        "threshold":   m.threshold,
        "quantity":    m.quantity or 0,
        "total_qty":   m.quantity or 0,
    } for m in meds]}


@router.put("/medicines/{medicine_id}", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def update_medicine(medicine_id: int, data: dict = Body(...), db: Session = Depends(get_db)):
    med = db.query(Medicine).filter(Medicine.medicine_id == medicine_id).first()
    if not med:
        raise HTTPException(404, "Medicine not found")

    if "quantity" in data:
        med.quantity = int(data["quantity"])

    if data.get("name"):
        name = data["name"].strip()
        # Make sure another medicine doesn't already have this name
        if db.query(Medicine).filter(Medicine.name.ilike(name), Medicine.medicine_id != medicine_id).first():
            raise HTTPException(400, "Medicine with this name already exists")
        med.name = name

    # Update whichever fields were provided
    for field in ["strength", "category", "manufacturer", "price", "threshold"]:
        if field in data:
            setattr(med, field, data[field])

    if "expiry" in data or "expiry_date" in data:
        raw = data.get("expiry") or data.get("expiry_date")
        try:
            med.expiry = datetime.strptime(raw, "%Y-%m-%d").date()
        except Exception:
            raise HTTPException(400, "Invalid expiry date")

    db.commit()
    return {"message": "Medicine updated successfully"}


@router.delete("/medicines/{medicine_id}", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def delete_medicine(medicine_id: int, db: Session = Depends(get_db)):
    med = db.query(Medicine).filter(Medicine.medicine_id == medicine_id).first()
    if not med:
        raise HTTPException(404, "Medicine not found")
    db.delete(med)
    db.commit()
    return {"message": "Medicine deleted"}


@router.post("/stock/", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def update_stock(data: dict = Body(...), db: Session = Depends(get_db)):
    # Adds to existing stock (used when new inventory arrives)
    med_id = data.get("medicine_id")
    qty    = data.get("quantity")
    if not med_id or qty is None:
        raise HTTPException(400, "Medicine ID and quantity required")
    med = db.query(Medicine).filter(Medicine.medicine_id == med_id).first()
    if not med:
        raise HTTPException(404, "Medicine not found")
    med.quantity = (med.quantity or 0) + int(qty)
    db.commit()
    return {"message": "Stock updated successfully", "new_quantity": med.quantity}


@router.post("/billing/", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def create_bill(data: dict = Body(...), db: Session = Depends(get_db), _=Depends(get_current_user)):
    pid, cart = data.get("patient_id"), data.get("cart")
    if not pid or not cart:
        raise HTTPException(400, "Invalid billing data")

    # Validate stock before touching anything — fail fast if any item is short
    for item in cart:
        med = db.query(Medicine).filter(Medicine.medicine_id == item.get("medicine_id")).first()
        if not med or (med.quantity or 0) < item.get("qty", 0):
            raise HTTPException(400, f"Insufficient stock for {item.get('medicine_name', '')}")

    total    = sum(item.get("price", 0) * item.get("qty", 0) for item in cart)
    discount = data.get("discount", 0)
    net      = total - total * (discount / 100)

    # Build the details snapshot — look up each medicine from DB so we have the
    # correct name, strength, and manufacturer at the time of billing
    details = []
    for i in cart:
        med = db.query(Medicine).filter(Medicine.medicine_id == i.get("medicine_id")).first()
        details.append({
            "description":  (med.name if med else None) or i.get("medicine_name") or "Medicine",
            "strength":     med.strength if med else None,
            "manufacturer": med.manufacturer if med else None,
            "qty":          i.get("qty", 1),
            "price":        round(i.get("price", 0), 2),
            "subtotal":     round(i.get("price", 0) * i.get("qty", 1), 2),
        })

    bill = Bill(
        patient_id=pid, total_amount=total, discount=discount, net_total=net,
        payment_method=data.get("payment_method", "cash"), bill_type="pharmacy",
        paid_at=datetime.utcnow(), details=details
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)

    # Deduct stock after committing the bill — can't go below 0
    for item in cart:
        med = db.query(Medicine).filter(Medicine.medicine_id == item.get("medicine_id")).first()
        if med:
            med.quantity = max(0, (med.quantity or 0) - item.get("qty", 0))

    db.commit()
    return {"message": "Bill generated successfully", "bill_id": bill.id}


@router.get("/analytics/", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def get_analytics(db: Session = Depends(get_db)):
    bills         = db.query(Bill).filter(Bill.bill_type == "pharmacy").all()
    total_revenue = sum(b.net_total or 0 for b in bills)
    return {"total_revenue": total_revenue, "total_bills": len(bills)}


@router.get("/ml-predictions/", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def get_ml_predictions(db: Session = Depends(get_db)):
    # Simple placeholder — real predictions come from the analytics controller
    meds = db.query(Medicine).all()
    top5 = [m.name for m in sorted(meds, key=lambda m: m.quantity or 0, reverse=True)[:5]]
    return {"top5": top5, "predictions": [], "confidence": 0}


@router.get("/billing/patient/{patient_id}", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def get_patient_bills(patient_id: int, db: Session = Depends(get_db)):
    # Pharmacy bill history for a patient — newest first
    bills = db.query(Bill).filter(
        Bill.patient_id == patient_id, Bill.bill_type == "pharmacy"
    ).order_by(Bill.bill_id.desc()).all()
    return {"bills": [
        {
            "bill_id":        b.id,
            "date":           fmt_dt(b.paid_at),
            "total_amount":   b.total_amount,
            "discount":       b.discount,
            "net_total":      b.net_total,
            "payment_method": b.payment_method,
        }
        for b in bills
    ]}


@router.get("/billing/invoice/{bill_id}", dependencies=[Depends(require_roles(*_PHARMACY_ROLES))])
def get_invoice(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.bill_id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")
    return {
        "bill_id":        bill.id,
        "date":           fmt_dt(bill.paid_at),
        "total_amount":   bill.total_amount,
        "discount":       bill.discount,
        "net_total":      bill.net_total,
        "payment_method": bill.payment_method,
        "items":          bill.details or [],
    }
