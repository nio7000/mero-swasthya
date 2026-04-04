from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    strength = Column(String, nullable=True)         # ✅ Strength (e.g. 500mg)
    category = Column(String)
    manufacturer = Column(String)
    price = Column(Float)
    expiry_date = Column(Date)
    threshold = Column(Integer, default=10)
    created_by = Column(Integer, nullable=True)
    is_active = Column(Integer, default=1)           # ✅ Soft delete flag

    stock = relationship("Stock", back_populates="medicine", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="medicine", cascade="all, delete-orphan")


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    quantity = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)

    medicine = relationship("Medicine", back_populates="stock")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"))
    type = Column(String)
    quantity = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)
    handled_by = Column(Integer, nullable=True)

    medicine = relationship("Medicine", back_populates="transactions")

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, nullable=False)
    total_amount = Column(Float, default=0)
    discount = Column(Float, default=0)
    net_total = Column(Float, default=0)
    status = Column(String, default="paid")  # paid / returned / partial
    created_at = Column(DateTime, default=datetime.utcnow)
    payment_method = Column(String, default="cash")
    bill_type = Column(String, default="pharmacy")  # pharmacy / lab / counter

    items = relationship("BillItem", back_populates="bill", cascade="all, delete-orphan")

class BillItem(Base):
    __tablename__ = "bill_items"
    id          = Column(Integer, primary_key=True)
    bill_id     = Column(Integer, ForeignKey("bills.id"))
    medicine_id = Column(Integer, nullable=False)
    qty         = Column(Integer, nullable=False)
    price       = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    bill        = relationship("Bill", back_populates="items")

class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey("bills.id"))
    medicine_id = Column(Integer, nullable=False)
    qty = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
