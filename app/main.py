# Entry point for the FastAPI backend.
# All routers are registered here and CORS is opened up for the React frontend.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.controllers import auth, patients, reports, doctors, prescriptions, tests, billing, followup, analytics, pharmacy

# Create all tables if they don't already exist in the DB
Base.metadata.create_all(bind=engine)

# Main app instance
app = FastAPI(title="Mero Swasthya — AI Medical System")

# Allow the React dev server (and any origin in general) to hit the API.
# In production you'd lock this down to specific domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all the feature routers — each controller handles its own routes
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
