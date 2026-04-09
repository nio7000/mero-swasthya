from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.controllers import auth, patients, reports, doctors, prescriptions, tests, billing, followup, analytics, pharmacy

# ── DB SETUP ──
Base.metadata.create_all(bind=engine)

# ── APP ──
app = FastAPI(title="Mero Swasthya — AI Medical System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROUTERS ──
for router in [
    auth.router,
    patients.router,
    reports.router,
    doctors.router,
    prescriptions.router,
    tests.router,
    billing.router,
    followup.router,
    analytics.router,
    pharmacy.router,
]:
    app.include_router(router)
