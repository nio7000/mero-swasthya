from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class MedicineCreate(BaseModel):
    name: str
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    price: float
    expiry_date: date
    threshold: Optional[int] = 10


class StockUpdate(BaseModel):
    medicine_id: int
    quantity: int


class TransactionResponse(BaseModel):
    id: int
    medicine_id: int
    type: str
    quantity: int
    timestamp: datetime

    class Config:
        orm_mode = True