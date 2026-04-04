from sqlalchemy import Column, Integer, String, JSON, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

# ------------------------------------------------
# USERS (Admin creates these accounts)
# ------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100))
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # doctor | pharmacy | technician | receptionist | counter | admin
    specialization = Column(String, nullable=True)
    is_deleted     = Column(Boolean, default=False)


# ------------------------------------------------
# MEDICAL REPORTS
# ------------------------------------------------
class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String)
    age = Column(String)
    sex = Column(String)
    json_data = Column(JSON)
    is_deleted = Column(Boolean, default=False)


# ------------------------------------------------
# PRESCRIPTIONS
# ------------------------------------------------
class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("medical_reports.id"))
    diagnosis = Column(String)
    medicines = Column(JSON)
    tests = Column(JSON, nullable=True)  # ✅ store tests directly with each prescription
    status = Column(String, default="Pending")

    # 🔹 Use String to store doctor’s local device time (not UTC)
    created_at = Column(String, nullable=True)

    # Relationships
    report = relationship("MedicalReport", backref="prescriptions")


# ------------------------------------------------
# TEST REQUESTS (Doctor → Counter → Technician)
# ------------------------------------------------
class TestRequest(Base):
    __tablename__ = "test_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("medical_reports.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    test_name = Column(String, nullable=False)
    notes = Column(String)

    status = Column(String, default="Not Done Yet")       # Technician progress
    payment_status = Column(String, default="Unpaid")     # Counter handles payment
    payment_method = Column(String, nullable=True)
    payment_verified_at = Column(DateTime, nullable=True)

    ocr_report = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    doctor = relationship("User", backref="test_requests")
    report = relationship("MedicalReport", backref="test_requests")


# ------------------------------------------------
# PATIENTS (Optional manual register)
# ------------------------------------------------
class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    age = Column(Integer)
    sex = Column(String)
    contact = Column(String)
    address = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# ------------------------------------------------
# LAB TEST MASTER (STATIC TEST LIST)
# ------------------------------------------------
class LabTest(Base):
    __tablename__ = "lab_tests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Integer, nullable=True)


class FollowUp(Base):
    __tablename__ = "followups"

    id          = Column(Integer, primary_key=True, index=True)
    patient_id  = Column(Integer, ForeignKey("medical_reports.id"), nullable=False)
    doctor_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    used        = Column(Boolean, default=False)
    used_at     = Column(DateTime, nullable=True)