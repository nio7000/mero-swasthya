export const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

export const STORAGE_KEYS = {
  TOKEN:     "token",
  ROLE:      "role",
  EMAIL:     "userEmail",
  FULL_NAME: "fullName",
};

export const ROLES = {
  DOCTOR:         "doctor",
  PHARMACY:       "pharmacy",
  PHARMACY_ADMIN: "pharmacy_admin",
  TECHNICIAN:     "technician",
  RECEPTIONIST:   "receptionist",
  COUNTER:        "counter",
  ADMIN:          "admin",
};

export const ROLE_ROUTES = {
  doctor:         "/doctorportal",
  pharmacy:       "/pharmacy",
  pharmacy_admin: "/pharmacy-admin",
  technician:     "/dashboard",
  receptionist:   "/receptionist",
  counter:        "/counter",
  admin:          "/admin",
};

export const FEES = {
  CONSULT:   500,
  SELF:      300,
  FOLLOW_UP: 0,
};

// Hospital info
export const HOSPITAL_NAME  = "NiO's Hospital";
export const HOSPITAL_ADDR  = "Birtamode-5, Jhapa, Nepal";
export const HOSPITAL_PHONE = "+977 023-123456";

// Formatting
export const CURRENCY = "Rs.";

// Validation
export const PHONE_REGEX  = /^\d{0,10}$/;
export const MAX_DISCOUNT = 100;

// Thresholds
export const LOW_STOCK_DAYS = 30;

// CSS variable references (for inline styles that need JS values)
export const COLORS = {
  primary:    "var(--primary)",
  primaryDk:  "var(--primary-dk)",
  primaryLt:  "var(--primary-lt)",
  accent:     "var(--accent)",
  accentLt:   "var(--accent-lt)",
  danger:     "var(--danger)",
  dangerLt:   "var(--danger-lt)",
  success:    "var(--success)",
  successLt:  "var(--success-lt)",
  warn:       "var(--warn)",
  warnLt:     "var(--warn-lt)",
  surface:    "var(--surface)",
  surface2:   "var(--surface2)",
  border:     "var(--border)",
  text:       "var(--text)",
  text2:      "var(--text2)",
  text3:      "var(--text3)",
};

export const FONTS = {
  sans:  "var(--font)",
  serif: "var(--font-serif)",
};
