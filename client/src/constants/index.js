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
  CONSULT: 500,
  SELF:    300,
};

export const CURRENCY       = "Rs.";
export const HOSPITAL_NAME  = "NiO's Hospital";
export const HOSPITAL_ADDR  = "Birtamode-5, Jhapa, Nepal";
export const HOSPITAL_PHONE = "+977 023-123456";
export const PHONE_REGEX    = /^\d{0,10}$/;
export const MAX_DISCOUNT   = 100;
export const LOW_STOCK_DAYS = 30;
