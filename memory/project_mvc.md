---
name: MeroSwasthya MVC Architecture
description: Full MVC refactor completed April 2026 — new folder structure, deleted files, conventions
type: project
---

MVC refactor completed (April 2026). Backend broken from monolithic main.py into controller files. Frontend pages moved to views/, controllers extracted as custom hooks.

**Backend structure:**
- `app/dependencies.py` — get_db, get_current_user, require_roles (single source of truth)
- `app/utils/helpers.py` — get_structured_data, serialize_patient, clean_doctor_name, generate_invoice_number, fmt_dt, fmt_dt_iso
- `app/utils/ocr.py` — preprocess_image, extract_structured_data, extract_medical_values
- `app/controllers/` — auth, patients, reports, doctors, prescriptions, tests, billing, followup, analytics, pharmacy
- `app/main.py` — only app setup + include_router calls (no route handlers)
- DELETED: `app/auth_utils.py`, `app/views.py`, `app/pharmacy_admin/main_pharmacy_admin.py` superseded

**Frontend structure:**
- `client/src/views/` — UI components (moved from pages/)
- `client/src/controllers/` — useAuth, usePatients, useDoctor, useReceptionist, useCounter, useTechnician, usePharmacy, useAdmin
- `client/src/services/api.js` — ALL API endpoints in one place (complete)
- `client/src/utils/datetime.js` — ALL date/time functions; date.js re-exports from it
- `client/src/constants/index.js` — includes COLORS and FONTS as JS objects referencing CSS vars

**Why:** User requested 100% MVC refactor; previous attempt was 70-80% complete.
**How to apply:** All new routes go in app/controllers/, all new API calls go in services/api.js, all date formatting uses utils/datetime.js.
