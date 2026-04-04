class Roles:
    DOCTOR         = "doctor"
    PHARMACY       = "pharmacy"
    PHARMACY_ADMIN = "pharmacy_admin"
    TECHNICIAN     = "technician"
    RECEPTIONIST   = "receptionist"
    COUNTER        = "counter"
    ADMIN          = "admin"
    ALL_STAFF      = [DOCTOR, PHARMACY, PHARMACY_ADMIN, TECHNICIAN, RECEPTIONIST, COUNTER, ADMIN]

class Status:
    PENDING    = "Pending"
    COMPLETED  = "Completed"
    NOT_DONE   = "Not Done Yet"
    PAID       = "Paid"
    UNPAID     = "Unpaid"
    PAID_LOWER = "paid"

class Fees:
    CONSULT = 500
    SELF    = 300

PHONE_LENGTH      = 10
MAX_DISCOUNT      = 100
LOW_STOCK_DAYS    = 30
DEFAULT_THRESHOLD = 10
