# Re-export Medicine and Bill from the canonical models module.
# All other pharmacy tables (Stock, Transaction, BillItem, ReturnItem)
# have been removed in the v2 schema — quantity is now a column on
# medicines and billing is handled through the unified bills table.
from app.models import Medicine, Bill

__all__ = ["Medicine", "Bill"]
