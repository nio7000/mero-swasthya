# SQLAlchemy ORM models — each class maps to a table in the PostgreSQL DB.
# Import Base from database.py so all models share the same metadata.

from sqlalchemy import Column, Integer, String, JSON, ForeignKey, DateTime, Boolean, Float, Date, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


# ── ROLES ──
# Stores the role definitions (doctor, pharmacy, admin, etc.)
# Users reference this table via role_id
class Role(Base):
    __tablename__ = "roles"

    role_id     = Column("role_id", Integer, primary_key=True, index=True)
    role        = Column(String(50), unique=True, nullable=False)
    description = Column(String, nullable=True)


# ── USERS ──
# All staff members — doctors, pharmacists, receptionists, admins, etc.
# Role is resolved via a join so user.role gives the string directly
class User(Base):
    __tablename__ = "users"

    user_id              = Column("user_id", Integer, primary_key=True, index=True)
    full_name            = Column(String(100))
    email                = Column(String, unique=True, nullable=False)
    password             = Column(String, nullable=False)           # bcrypt hash, never plain text
    role_id              = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    specialization       = Column(String, nullable=True)            # only relevant for doctors
    must_change_password = Column(Boolean, default=False)           # flag set on first login

    _role_rel = relationship("Role", foreign_keys=[role_id], lazy="joined")

    @property
    def id(self):
        # Alias so code can use user.id instead of user.user_id
        return self.user_id

    @property
    def role(self):
        # Returns the role string ("doctor", "admin", etc.) instead of the Role object
        return self._role_rel.role if self._role_rel else None


# ── PATIENTS ──
# Core patient record — created by the receptionist at registration
class Patient(Base):
    __tablename__ = "patients"

    patient_id    = Column("patient_id", Integer, primary_key=True, index=True)
    full_name     = Column(String, nullable=False)
    age           = Column(Integer)
    sex           = Column(String)
    contact       = Column(String)
    address       = Column(String)
    registered_at = Column(DateTime, default=datetime.utcnow)
    is_deleted    = Column(Boolean, default=False)   # soft delete — keeps billing history intact

    @property
    def id(self):
        return self.patient_id


# ── MEDICINES ──
# The hospital's medicine inventory — managed by pharmacy admin
class Medicine(Base):
    __tablename__ = "medicines"

    medicine_id  = Column("medicine_id", Integer, primary_key=True, index=True)
    name         = Column(String, unique=True, nullable=False)
    manufacturer = Column(String)
    strength     = Column(String, nullable=True)   # e.g. "500mg", "10mg"
    category     = Column(String)                  # e.g. "antibiotic", "analgesic"
    price        = Column(Float)
    quantity     = Column(Integer, default=0)      # current stock count
    expiry       = Column(Date)
    threshold    = Column(Integer, default=10)     # alert when stock drops below this

    @property
    def id(self):
        return self.medicine_id


# ── TESTS ──
# Lab tests the hospital can perform — referenced by prescriptions and billing
class Test(Base):
    __tablename__ = "tests"

    test_id = Column("test_id", Integer, primary_key=True, index=True)
    name    = Column(String, nullable=False)
    price   = Column(Float, nullable=True)

    @property
    def id(self):
        return self.test_id


# ── APPOINTMENTS ──
# Links a patient to a doctor for a visit
class Appointment(Base):
    __tablename__ = "appointments"

    appointment_id = Column("appointment_id", Integer, primary_key=True, index=True)
    patient_id     = Column(Integer, ForeignKey("patients.patient_id"), nullable=False)
    doctor_id      = Column(Integer, ForeignKey("users.user_id"),       nullable=False)
    notes          = Column(String, nullable=True)

    patient = relationship("Patient")
    doctor  = relationship("User", foreign_keys=[doctor_id])

    @property
    def id(self):
        return self.appointment_id


# ── PRESCRIPTIONS ──
# A doctor's prescription for a patient visit.
# The medicines and tests are stored as separate child rows.
class Prescription(Base):
    __tablename__ = "prescriptions"

    prescription_id = Column("prescription_id", Integer, primary_key=True, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.patient_id"), nullable=True)
    doctor_id       = Column(Integer, ForeignKey("users.user_id"),       nullable=True)
    diagnosis       = Column(String)
    created_at      = Column(DateTime, default=datetime.utcnow)

    # Cascade delete so removing a prescription cleans up its line items
    items         = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")
    ordered_tests = relationship("PrescriptionTest",  back_populates="prescription", cascade="all, delete-orphan")
    doctor        = relationship("User", foreign_keys=[doctor_id])

    @property
    def id(self):
        return self.prescription_id


# ── PRESCRIPTION ITEMS ──
# Individual medicine rows within a prescription
class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id              = Column(Integer, primary_key=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.prescription_id"), nullable=False)
    medicine_id     = Column(Integer, ForeignKey("medicines.medicine_id"),          nullable=True)
    dose            = Column(String(100))      # e.g. "1-0-1"
    duration        = Column(String(100))      # e.g. "7 days"
    notes           = Column(String(300))      # extra instructions

    prescription = relationship("Prescription", back_populates="items")
    medicine     = relationship("Medicine")


# ── PRESCRIPTION TESTS ──
# Lab tests ordered as part of a prescription
class PrescriptionTest(Base):
    __tablename__ = "prescription_tests"

    id              = Column(Integer, primary_key=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.prescription_id"), nullable=False)
    test_id         = Column(Integer, ForeignKey("tests.test_id"),                 nullable=True)

    prescription = relationship("Prescription", back_populates="ordered_tests")
    test         = relationship("Test")


# ── TEST REQUESTS ──
# When a doctor orders a lab test for a patient, a TestRequest is created.
# The technician updates it to Done, and the counter marks payment.
class TestRequest(Base):
    __tablename__ = "test_requests"

    id             = Column(Integer, primary_key=True, index=True)
    patient_id     = Column(Integer, ForeignKey("patients.patient_id"), nullable=False)
    doctor_id      = Column(Integer, ForeignKey("users.user_id"),       nullable=False)
    test_id        = Column(Integer, ForeignKey("tests.test_id"),       nullable=True)
    requested_at   = Column(DateTime, default=datetime.utcnow)
    payment_status = Column(
        SAEnum("Unpaid", "Paid", "Waived", name="payment_status_enum", create_type=False),
        default="Unpaid"
    )
    status = Column(
        SAEnum("Not Done Yet", "In Progress", "Done", name="test_status_enum", create_type=False),
        default="Not Done Yet"
    )
    paid_at = Column(DateTime, nullable=True)

    doctor = relationship("User", foreign_keys=[doctor_id], backref="test_requests")
    test   = relationship("Test", backref="test_requests", lazy="joined")  # joined so test name is always available


# ── TEST RESULTS ──
# Stores the structured result data uploaded by the technician
class TestResult(Base):
    __tablename__ = "test_results"

    id              = Column(Integer, primary_key=True, index=True)
    test_request_id = Column(Integer, ForeignKey("test_requests.id"), nullable=False)
    result_data     = Column(JSON, nullable=True)   # flexible JSON — different tests have different fields
    uploaded_at     = Column(DateTime, default=datetime.utcnow)

    test_request = relationship("TestRequest", backref="test_results")


# ── FOLLOWUPS ──
# Tracks when a doctor schedules a follow-up for a patient.
# used=True once the patient comes back for the follow-up visit.
class Followup(Base):
    __tablename__ = "followups"

    id              = Column(Integer, primary_key=True, index=True)
    patient_id      = Column(Integer, ForeignKey("patients.patient_id"),          nullable=False)
    doctor_id       = Column(Integer, ForeignKey("users.user_id"),                nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.prescription_id"), nullable=True)
    assigned_at     = Column(DateTime, default=datetime.utcnow)
    used            = Column(Boolean, default=False)    # False = still pending
    used_at         = Column(DateTime, nullable=True)   # when the patient actually came in


# ── BILLS ──
# One bill per transaction — covers pharmacy, lab tests, and consultation fees.
# bill_type distinguishes between them: "pharmacy", "test", "consultation"
# details is a JSON array of line items stored at creation time (snapshot approach)
class Bill(Base):
    __tablename__ = "bills"

    bill_id        = Column("bill_id", Integer, primary_key=True, index=True)
    patient_id     = Column(Integer, ForeignKey("patients.patient_id"), nullable=False)
    total_amount   = Column(Float, default=0)
    discount       = Column(Float, default=0)    # percentage, e.g. 10 = 10%
    net_total      = Column(Float, default=0)    # what the patient actually pays
    paid_at        = Column(DateTime, default=datetime.utcnow)
    payment_method = Column(String, default="cash")
    bill_type      = Column(String)
    details        = Column(JSON, nullable=True)  # snapshot of line items at time of billing

    patient = relationship("Patient")

    @property
    def id(self):
        return self.bill_id
