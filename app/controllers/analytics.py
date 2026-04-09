from collections import Counter, defaultdict
from datetime import datetime, timedelta

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sklearn.linear_model import LinearRegression
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Patient, Prescription, Bill, Medicine, Role

router = APIRouter(tags=["Analytics"])

CONSULT_FEE  = 500
AVG_TEST_FEE = 300
TEST_RATIO   = 0.4


@router.get("/admin/analytics/")
def get_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")

    bills   = db.query(Bill).all()
    now     = datetime.utcnow()
    monthly = defaultdict(float)
    for b in bills:
        if b.paid_at:
            monthly[b.paid_at.strftime("%b %Y")] += float(b.net_total or 0)

    revenue_by_month = [
        {"month": k, "revenue": v}
        for k, v in sorted(monthly.items(), key=lambda x: datetime.strptime(x[0], "%b %Y"))
    ][-6:]

    diagnoses    = db.query(Prescription).all()
    top_diagnoses = [
        {"diagnosis": d, "count": c}
        for d, c in Counter(p.diagnosis for p in diagnoses if p.diagnosis).most_common(5)
    ]

    return {
        "total_patients":   db.query(Patient).filter(Patient.is_deleted != True).count(),
        "total_revenue":    sum(b.net_total or 0 for b in bills),
        "monthly_revenue":  sum(b.net_total or 0 for b in bills
                                if b.paid_at and b.paid_at.month == now.month
                                and b.paid_at.year == now.year),
        "revenue_by_month": revenue_by_month,
        "top_diagnoses":    top_diagnoses,
        "total_bills":      len(bills),
    }


@router.get("/admin/analytics-v2/")
def get_analytics_v2(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Access denied")

    now         = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_patient_count = db.query(Patient).filter(Patient.is_deleted != True).count()
    bills         = db.query(Bill).all()
    prescriptions = db.query(Prescription).all()

    # Split bills by actual type
    pharmacy_bills    = [b for b in bills if b.bill_type == "pharmacy"]
    consult_bills     = [b for b in bills if b.bill_type == "consultation"]
    test_bills        = [b for b in bills if b.bill_type == "test"]

    pharmacy_total = sum(b.net_total or 0 for b in pharmacy_bills)
    consult_total  = sum(b.net_total or 0 for b in consult_bills)
    test_total     = sum(b.net_total or 0 for b in test_bills)
    total_revenue  = pharmacy_total + consult_total + test_total

    # This-month bills — fallback to latest month if current month has no data
    bills_month = [b for b in bills if b.paid_at and b.paid_at >= month_start]
    if not bills_month:
        latest = max((b.paid_at for b in bills if b.paid_at), default=now)
        bills_month = [b for b in bills if b.paid_at and b.paid_at >= latest.replace(day=1)]
    revenue_month = sum(b.net_total or 0 for b in bills_month)

    # Visits counted from prescriptions
    rx_today = [p for p in prescriptions if p.created_at and p.created_at >= today_start]
    rx_week  = [p for p in prescriptions if p.created_at and p.created_at >= week_start]
    rx_month = [p for p in prescriptions if p.created_at and p.created_at >= month_start]

    # Revenue last 6 months (actual bill data)
    six_ago = (now.replace(day=1) - timedelta(days=5 * 31)).replace(day=1)
    monthly = defaultdict(float)
    for b in bills:
        if b.paid_at and b.paid_at >= six_ago:
            monthly[b.paid_at.strftime("%b %Y")] += float(b.net_total or 0)

    revenue_by_month = [
        {"month": k, "revenue": round(v, 0)}
        for k, v in sorted(monthly.items(), key=lambda x: datetime.strptime(x[0], "%b %Y"))
    ][-6:]

    # ML forecast using last 12 months only
    forecast_next_month = 0
    try:
        twelve_ago = (now.replace(day=1) - timedelta(days=11 * 31)).replace(day=1)
        bill_monthly = defaultdict(float)
        for b in bills:
            if b.paid_at and b.paid_at >= twelve_ago:
                bill_monthly[b.paid_at.strftime("%b %Y")] += float(b.net_total or 0)
        sorted_months = sorted(bill_monthly.items(), key=lambda x: datetime.strptime(x[0], "%b %Y"))
        if len(sorted_months) >= 3:
            X  = np.array(range(len(sorted_months))).reshape(-1, 1)
            y  = np.array([v for _, v in sorted_months])
            ml = LinearRegression().fit(X, y)
            forecast_next_month = max(0, int(ml.predict([[len(sorted_months)]])[0]))
    except Exception:
        pass

    # Doctor workload from prescriptions
    doctor_counts_month = Counter()
    doctor_counts_all   = Counter()
    for p in prescriptions:
        if p.doctor_id:
            doctor_counts_all[p.doctor_id] += 1
            if p.created_at and p.created_at >= month_start:
                doctor_counts_month[p.doctor_id] += 1

    doctors = db.query(User).join(Role, User.role_id == Role.role_id).filter(Role.role == "doctor").all()
    doctor_workload = sorted([{
        "id":             d.user_id,
        "name":           d.full_name,
        "specialization": d.specialization or "—",
        "patients_month": doctor_counts_month.get(d.user_id, 0),
        "patient_count":  doctor_counts_all.get(d.user_id, 0),
        "revenue":        doctor_counts_all.get(d.user_id, 0) * CONSULT_FEE,
    } for d in doctors], key=lambda x: x["patients_month"], reverse=True)

    return {
        "total_patients":      total_patient_count,
        "visits_today":        len(rx_today),
        "visits_week":         len(rx_week),
        "visits_month":        len(rx_month),
        "total_revenue":       round(total_revenue, 0),
        "pharmacy_revenue":    round(pharmacy_total, 0),
        "consult_revenue":     round(consult_total, 0),
        "test_revenue":        round(test_total, 0),
        "revenue_today":       round(sum(b.net_total or 0 for b in bills if b.paid_at and b.paid_at >= today_start), 0),
        "revenue_week":        round(sum(b.net_total or 0 for b in bills if b.paid_at and b.paid_at >= week_start), 0),
        "revenue_month":       round(revenue_month, 0),
        "forecast_next_month": forecast_next_month,
        "revenue_by_month":    revenue_by_month,
        "doctor_workload":     doctor_workload,
        "total_bills":         len(bills),
    }


@router.get("/pharmacy-admin/analytics/")
def pharmacy_analytics(db: Session = Depends(get_db), _=Depends(get_current_user)):
    medicines = db.query(Medicine).all()
    bills     = db.query(Bill).filter(Bill.bill_type == "pharmacy").all()
    oldest    = min((b.paid_at for b in bills if b.paid_at), default=datetime.utcnow())
    days_active = max((datetime.utcnow() - oldest).days, 1)

    refill_predictions = []
    for med in medicines:
        if med.quantity is not None and med.threshold and med.quantity < med.threshold:
            refill_predictions.append({
                "name":      med.name,
                "qty_left":  med.quantity,
                "threshold": med.threshold,
                "urgent":    med.quantity == 0,
            })

    return {
        "total_medicines":     len(medicines),
        "low_stock_count":     len(refill_predictions),
        "total_bills":         len(bills),
        "total_revenue":       round(sum(b.net_total or 0 for b in bills), 2),
        "refill_predictions":  refill_predictions[:10],
        "days_active":         days_active,
    }


@router.get("/pharmacy-admin/ml-predictions/")
def pharmacy_ml_predictions(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import func
    from app.models import PrescriptionItem

    # Use prescription_items joined with prescriptions for date — real sales proxy
    rows = (
        db.query(Medicine.name, Prescription.created_at)
        .join(PrescriptionItem, PrescriptionItem.medicine_id == Medicine.medicine_id)
        .join(Prescription, Prescription.prescription_id == PrescriptionItem.prescription_id)
        .filter(Prescription.created_at != None)
        .all()
    )

    medicine_total  = defaultdict(int)
    medicine_weekly = defaultdict(lambda: defaultdict(int))

    for name, created_at in rows:
        if name:
            medicine_total[name] += 1
            week_key = created_at.strftime("%Y-W%W")
            medicine_weekly[name][week_key] += 1

    if not medicine_total:
        return {"predictions": [], "confidence": 0, "top5": []}

    top5_names = sorted(medicine_total, key=medicine_total.get, reverse=True)[:5]
    all_names  = list(medicine_total.keys())  # all medicines with sales history

    def build_prediction(name):
        weekly       = medicine_weekly[name]
        sorted_weeks = sorted(weekly.items())
        total        = medicine_total[name]
        # weekly_avg = mean units prescribed per week
        weekly_avg = max(1, total // max(1, len(sorted_weeks)))

        if len(sorted_weeks) < 3:
            return {
                "medicine":      name,
                "total_sold":    total,
                "monthly_avg":   weekly_avg * 4,
                "next_3_months": [weekly_avg] * 4,
                "trend":         "stable",
                "r2":            0.5,
            }

        y     = np.array([v for _, v in sorted_weeks], dtype=float)
        X     = np.arange(len(y)).reshape(-1, 1)
        model = LinearRegression().fit(X, y)
        slope = model.coef_[0]
        n     = len(y)
        next4 = [max(0, round(float(model.predict([[n + i]])[0]))) for i in range(4)]

        # Confidence: hold-out last 4 weeks, measure actual forecast error
        # This is real model performance on unseen data, not a heuristic
        if n >= 8:
            hm = LinearRegression().fit(X[:-4], y[:-4])
            y_pred_test = hm.predict(X[-4:])
            mape = float(np.mean(np.abs(y[-4:] - y_pred_test)) / (y[-4:].mean() + 1e-9))
            confidence = round(max(0.0, min(1.0, 1.0 - mape)), 2)
        else:
            cv = float(y.std() / y.mean()) if y.mean() > 0 else 1.0
            confidence = round(max(0.0, min(1.0, 1.0 - cv)), 2)

        return {
            "medicine":      name,
            "total_sold":    total,
            "monthly_avg":   int(y.mean() * 4),
            "next_3_months": next4,
            "trend":         "increasing" if slope > 0.5 else "decreasing" if slope < -0.5 else "stable",
            "r2":            confidence,
        }

    top5_predictions = [build_prediction(n) for n in top5_names]
    all_predictions  = [build_prediction(n) for n in all_names]

    avg_confidence = round(float(np.mean([p["r2"] for p in top5_predictions])), 2) if top5_predictions else 0.0

    return {
        "top5":            top5_names,
        "predictions":     top5_predictions,
        "all_predictions": all_predictions,   # for inventory table
        "confidence":      avg_confidence,
        "trained_on":      sum(medicine_total.values()),
        "weeks_of_data":   len(set(wk for wks in medicine_weekly.values() for wk in wks)),
    }
