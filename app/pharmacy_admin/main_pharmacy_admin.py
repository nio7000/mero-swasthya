from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.auth_utils import require_roles
from app.auth_utils import get_current_user
from sqlalchemy import text

from app.pharmacy_admin.models_pharmacy import (
    Medicine,
    Stock,
    Transaction,
    Bill,
    BillItem,
    ReturnItem
)

router = APIRouter(tags=["Pharmacy Admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def root():
    return {"message": "💊 Pharmacy Admin API Running"}

from datetime import datetime, timedelta, date

@router.get("/dashboard/summary", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def get_summary(db: Session = Depends(get_db)):
    meds = db.query(
    Medicine.id,
    Medicine.name,
    Medicine.strength,
    Medicine.category,
    Medicine.manufacturer,
    Medicine.price,
    Medicine.expiry_date,
    Medicine.threshold
).filter(Medicine.is_active == 1).all()

    low_stock = 0
    expiring_soon = 0

    today = date.today()
    soon = today + timedelta(days=30)

    for m in meds:
        # Total stock
        stocks = db.query(
    Stock.quantity
).filter(
    Stock.medicine_id == m.id
).all()
        total_qty = sum(s.quantity for s in stocks)

        if total_qty < m.threshold:
            low_stock += 1

        # ------------------------------
        # FIX: NORMALIZE expiry_date
        # ------------------------------
        exp = m.expiry_date

        # If DB stored string ("2026-12-31")
        if isinstance(exp, str):
            try:
                exp = datetime.strptime(exp, "%Y-%m-%d").date()
            except:
                exp = None

        # If DB stored datetime ("2026-12-31 00:00:00")
        elif isinstance(exp, datetime):
            exp = exp.date()

        # If DB stored date — already correct
        elif isinstance(exp, date):
            pass
        else:
            exp = None

        # Count expiring items
        if exp and today <= exp <= soon:
            expiring_soon += 1

    return {
        "total_medicines": len(meds),
        "low_stock_medicines": low_stock,
        "expiring_soon_count": expiring_soon,
    }

# ------------------------------ ADD MEDICINE ------------------------------
@router.post("/medicines/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def add_medicine(data: dict = Body(...), db: Session = Depends(get_db)):

    if not data.get("name"):
        raise HTTPException(400, "Medicine name required")

    name = data["name"].strip()
    exists = db.query(Medicine).filter(
    Medicine.name.ilike(name)
).first()
    if exists:
        raise HTTPException(400, "Medicine already exists")

    med = Medicine(
        name=name,
        strength=data.get("strength"),
        category=data.get("category"),
        manufacturer=data.get("manufacturer"),
        price=data.get("price"),
        expiry_date=data.get("expiry_date"),
        threshold=data.get("threshold", 10),
        created_by=data.get("created_by")
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    if data.get("quantity"):
        stock = Stock(
            medicine_id=med.id,
            quantity=data["quantity"]
        )
        db.add(stock)
        db.commit()

    return {"message": "Medicine added", "id": med.id}


# ------------------------------ GET ALL MEDICINES ------------------------------
@router.get("/medicines/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy", "doctor"))])
def get_all_medicines(db: Session = Depends(get_db)):

    meds = db.query(
    Medicine.id,
    Medicine.name,
    Medicine.strength,
    Medicine.category,
    Medicine.manufacturer,
    Medicine.price,
    Medicine.expiry_date,
    Medicine.threshold
).filter(Medicine.is_active == 1).order_by(Medicine.id).all()
    response = []

    for m in meds:
        stocks = db.query(
    Stock.quantity,
    Stock.updated_at
).filter(
    Stock.medicine_id == m.id
).all()
        total_qty = sum(s.quantity for s in stocks)

        response.append({
            "id": m.id,
            "name": m.name,
            "strength": m.strength,
            "category": m.category,
            "manufacturer": m.manufacturer,
            "price": m.price,
            "expiry_date": str(m.expiry_date),
            "threshold": m.threshold,
            "total_qty": total_qty,
            "stock": [
                {
                    "quantity": s.quantity,
                    "updated_at": s.updated_at.strftime("%Y-%m-%d %H:%M:%S") if s.updated_at else None
                }
                for s in stocks
            ]
        })

    return {"medicines": response}

# ------------------------------ DELETE MEDICINES ------------------------------

@router.delete("/medicines/{medicine_id}", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def delete_medicine(medicine_id: int, db: Session = Depends(get_db)):
    try:
        medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()

        if not medicine:
            raise HTTPException(404, "Medicine not found")

        # 🔥 DELETE CHILD TABLES FIRST
        db.execute(text("DELETE FROM stocks WHERE medicine_id = :id"), {"id": medicine_id})
        db.execute(text("DELETE FROM transactions WHERE medicine_id = :id"), {"id": medicine_id})
        db.execute(text("DELETE FROM bill_items WHERE medicine_id = :id"), {"id": medicine_id})
        db.execute(text("DELETE FROM return_items WHERE medicine_id = :id"), {"id": medicine_id})

        # 🔥 DELETE MAIN RECORD
        db.execute(text("DELETE FROM medicines WHERE id = :id"), {"id": medicine_id})

        db.commit()

        return {"message": "Medicine deleted permanently"}

    except HTTPException as e:
        db.rollback()
        raise e   # 🔥 keep original error

    except Exception as e:
        db.rollback()
        print("🔥 ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
# ------------------------------ UPDATE MEDICINE ------------------------------
@router.put("/medicines/{medicine_id}", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def update_medicine(
    medicine_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()

    if not medicine:
        raise HTTPException(404, "Medicine not found")

    # 🔥 UPDATE STOCK (FIXED)
    if "quantity" in data:
        stock_row = db.query(Stock).filter(
            Stock.medicine_id == medicine_id
        ).first()

        if stock_row:
            stock_row.quantity = int(data["quantity"])
        else:
            new_stock = Stock(
                medicine_id=medicine_id,
                quantity=int(data["quantity"])
            )
            db.add(new_stock)

    # 🔥 Prevent duplicate name
    if data.get("name"):
        name = data["name"].strip()

        existing = db.query(Medicine).filter(
            Medicine.name.ilike(name),
            Medicine.id != medicine_id
        ).first()

        if existing:
            raise HTTPException(400, "Medicine with this name already exists")

        medicine.name = name

    # 🔥 UPDATE FIELDS
    if "strength" in data:
        medicine.strength = data["strength"]

    if "category" in data:
        medicine.category = data["category"]

    if "manufacturer" in data:
        medicine.manufacturer = data["manufacturer"]

    if "price" in data:
        medicine.price = data["price"]

    # 🔥 FIXED DATE VALIDATION
    if "expiry_date" in data:
        try:
            medicine.expiry_date = datetime.strptime(
                data["expiry_date"], "%Y-%m-%d"
            ).date()
        except:
            raise HTTPException(400, "Invalid expiry date")

    if "threshold" in data:
        try:
            medicine.threshold = int(data["threshold"])
        except:
            raise HTTPException(400, "Invalid threshold")

    # 🔥 FINAL SAVE
    db.commit()

    return {"message": "Medicine updated successfully"}

# ------------------------------ UPDATE STOCK ------------------------------
@router.post("/stock/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def update_stock(data: dict = Body(...), db: Session = Depends(get_db)):

    med_id = data.get("medicine_id")
    qty = data.get("quantity")

    if not med_id or qty is None:
        raise HTTPException(400, "Medicine ID and quantity required")

    med = db.query(Medicine).filter(Medicine.id == med_id).first()
    if not med:
        raise HTTPException(404, "Medicine not found")

    stock = Stock(
        medicine_id=med_id,
        quantity=qty
    )

    txn = Transaction(
        medicine_id=med_id,
        type="add",
        quantity=qty,
        handled_by=data.get("handled_by")
    )

    db.add_all([stock, txn])
    db.commit()

    return {"message": "Stock updated successfully"}


# ------------------------------ RETURN ITEMS ------------------------------
@router.post("/billing/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def create_bill(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        patient_id = data.get("patient_id")
        cart = data.get("cart")
        discount = data.get("discount", 0)
        payment_method = data.get("payment_method", "cash")

        if not patient_id or not cart:
            raise HTTPException(400, "Invalid billing data")

        # STEP 1 — VALIDATE STOCK
        for item in cart:
            med_name = item.get("medicine_name", "Unknown")
            medicine_id = item.get("medicine_id")
            qty = item.get("qty", 0)

            if not medicine_id:
                raise HTTPException(400, "Invalid medicine_id")

            stocks = db.query(Stock).filter(
                Stock.medicine_id == medicine_id
            ).all()

            if not stocks:
                raise HTTPException(400, f"No stock for {med_name}")

            total_qty = sum(s.quantity for s in stocks)

            if total_qty < qty:
                raise HTTPException(400, f"Not enough stock for {med_name}")

        # STEP 2 — CALCULATE
        total_amount = sum(item.get("price", 0) * item.get("qty", 0) for item in cart)
        discount_amount = total_amount * (discount / 100)
        net_total = total_amount - discount_amount

        # STEP 3 — CREATE BILL
        bill = Bill(
            patient_id=patient_id,
            total_amount=total_amount,
            discount=discount,
            net_total=net_total,
            payment_method=payment_method,
            status="paid",
            bill_type="pharmacy",
        )
        db.add(bill)
        db.commit()
        db.refresh(bill)

        # STEP 4 — ITEMS + STOCK REDUCE
        for item in cart:
            medicine_id = item.get("medicine_id")
            qty_needed = item.get("qty", 0)

            db.add(BillItem(
                bill_id=bill.id,
                medicine_id=item.get("medicine_id"),
                qty=item.get("qty", 0),
                price=item.get("price", 0),
            ))

            stocks = db.query(Stock).filter(
                Stock.medicine_id == medicine_id
            ).order_by(Stock.id).all()

            for stock in stocks:
                if qty_needed <= 0:
                    break

                if stock.quantity >= qty_needed:
                    stock.quantity -= qty_needed
                    qty_needed = 0
                else:
                    qty_needed -= stock.quantity
                    stock.quantity = 0

            db.add(Transaction(
                medicine_id=medicine_id,
                type="sale",
                quantity=item.get("qty", 0),
                handled_by=current_user.id
            ))

        db.commit()

        return {
            "message": "Bill generated successfully",
            "bill_id": bill.id
        }

    except HTTPException as e:
        db.rollback()
        raise e

    except Exception as e:
        db.rollback()
        print("🔥 ERROR:", e)
        raise HTTPException(500, str(e))

# ------------------------------ GET BILL HISTORY ------------------------------
@router.get("/billing/patient/{patient_id}", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def get_patient_bills(patient_id: int, db: Session = Depends(get_db)):

    bills = db.query(Bill).filter(
        Bill.patient_id == patient_id,
        Bill.bill_type == "pharmacy"
    ).order_by(Bill.id.desc()).all()
    response = []

    for b in bills:
        items = db.query(BillItem).filter(BillItem.bill_id == b.id).all()
        returns = db.query(ReturnItem).filter(ReturnItem.bill_id == b.id).all()

        returned_map = {}
        for r in returns:
            returned_map[r.medicine_id] = returned_map.get(r.medicine_id, 0) + r.qty

        item_list = []
        for it in items:
            returned_qty = returned_map.get((it.medicine_id), 0)

            item_list.append({
                "medicine_id": it.medicine_id,
                "medicine_name": db.query(Medicine).filter(Medicine.id == it.medicine_id).first().name if it.medicine_id and it.medicine_id != 0 else "Lab Test",
                "qty": it.qty,
                "returned_qty": returned_qty,
                "remaining_qty": it.qty - returned_qty,
                "price": it.price,
                "subtotal": it.qty * it.price,
            })

        bill_status = (
            "Returned" if all(i["returned_qty"] == i["qty"] for i in item_list)
            else "Partially Returned" if any(i["returned_qty"] > 0 for i in item_list)
            else "Completed"
        )

        response.append({
            "bill_id": b.id,
            "date": b.created_at.strftime("%Y-%m-%d %H:%M"),
            "net_total": b.net_total,
            "status": bill_status,
            "items": item_list
        })

    return {"bills": response}


# ------------------------------ INVOICE VIEW ------------------------------
@router.get("/billing/invoice/{bill_id}", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def get_invoice(bill_id: int, db: Session = Depends(get_db)):

    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Bill not found")

    items = db.query(BillItem).filter(BillItem.bill_id == bill_id).all()

    return {
        "bill_id": bill.id,
        "date": bill.created_at.strftime("%Y-%m-%d %H:%M"),
        "total_amount": bill.total_amount,
        "discount": bill.discount,
        "net_total": bill.net_total,
        "status": bill.status,
        "payment_method": bill.payment_method,
        "items": [
            {
                "medicine_name": db.query(Medicine).filter(Medicine.id == it.medicine_id).first().name if it.medicine_id and it.medicine_id != 0 else "Lab Test",
                "qty": it.qty,
                "price": it.price,
                "subtotal": (it.qty or 0) * (it.price or 0),
            }
            for it in items
        ]
    }

# ------------------------------ DASHBOARD SUMMARY ------------------------------
@router.get("/dashboard/summary", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def pharmacy_dashboard_summary(db: Session = Depends(get_db)):

    total_meds = db.query(Medicine.id).count()

    low_stock = (
        db.query(Stock.quantity)
        .filter(Stock.quantity < 5)
        .count()
    )

    soon = datetime.utcnow().date() + timedelta(days=30)
    expiring_soon = (
        db.query(Medicine.expiry_date)
        .filter(Medicine.expiry_date < soon)
        .count()
    )

    return {
        "total_medicines": total_meds,
        "low_stock_medicines": low_stock,
        "expiring_soon_count": expiring_soon
    }



# ------------------------------ TRANSACTIONS ------------------------------
@router.get("/transactions/", dependencies=[Depends(require_roles("pharmacy_admin", "pharmacy"))])
def get_all_transactions(db: Session = Depends(get_db)):

    txns = db.query(Transaction).order_by(Transaction.timestamp.desc()).all()

    return {
        "transactions": [
            {
                "id": t.id,
                "medicine_id": t.medicine_id,
                "type": t.type,
                "quantity": t.quantity,
                "timestamp": t.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "handled_by": t.handled_by,
            }
            for t in txns
        ]
    }
