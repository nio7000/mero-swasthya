-- ============================================================
-- FYP DATABASE — SCHEMA + DATA IMPORT
-- ============================================================

-- ── ENUMS ──
CREATE TYPE payment_status_enum AS ENUM ('Unpaid', 'Paid', 'Waived');
CREATE TYPE test_status_enum    AS ENUM ('Not Done Yet', 'In Progress', 'Done');

-- ── 1. ROLES ──
CREATE TABLE roles (
    role_id     SERIAL PRIMARY KEY,
    role        VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR
);

-- ── 2. USERS ──
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    full_name      VARCHAR(100),
    email          VARCHAR UNIQUE NOT NULL,
    password       VARCHAR NOT NULL,
    role_id        INTEGER NOT NULL REFERENCES roles(role_id),
    specialization VARCHAR
);

-- ── 3. PATIENTS ──
CREATE TABLE patients (
    patient_id    SERIAL PRIMARY KEY,
    full_name     VARCHAR NOT NULL,
    age           INTEGER,
    sex           VARCHAR,
    contact       VARCHAR,
    address       VARCHAR,
    registered_at TIMESTAMP DEFAULT NOW(),
    is_deleted    BOOLEAN DEFAULT FALSE
);

-- ── 4. MEDICINES ──
CREATE TABLE medicines (
    medicine_id  SERIAL PRIMARY KEY,
    name         VARCHAR UNIQUE NOT NULL,
    manufacturer VARCHAR,
    strength     VARCHAR,
    category     VARCHAR,
    price        FLOAT,
    quantity     INTEGER DEFAULT 0,
    expiry       DATE,
    threshold    INTEGER DEFAULT 10
);

-- ── 5. TESTS ──
CREATE TABLE tests (
    test_id SERIAL PRIMARY KEY,
    name    VARCHAR NOT NULL,
    price   FLOAT
);

-- ── 6. APPOINTMENTS ──
CREATE TABLE appointments (
    appointment_id SERIAL PRIMARY KEY,
    patient_id     INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id      INTEGER NOT NULL REFERENCES users(user_id),
    notes          VARCHAR
);

-- ── 7. PRESCRIPTIONS ──
CREATE TABLE prescriptions (
    prescription_id SERIAL PRIMARY KEY,
    patient_id      INTEGER REFERENCES patients(patient_id),
    doctor_id       INTEGER REFERENCES users(user_id),
    diagnosis       VARCHAR,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── 8. PRESCRIPTION_ITEMS ──
CREATE TABLE prescription_items (
    id              SERIAL PRIMARY KEY,
    prescription_id INTEGER NOT NULL REFERENCES prescriptions(prescription_id),
    medicine_id     INTEGER REFERENCES medicines(medicine_id),
    dose            VARCHAR(100),
    duration        VARCHAR(100),
    notes           VARCHAR(300)
);

-- ── 9. PRESCRIPTION_TESTS ──
CREATE TABLE prescription_tests (
    id              SERIAL PRIMARY KEY,
    prescription_id INTEGER NOT NULL REFERENCES prescriptions(prescription_id),
    test_id         INTEGER REFERENCES tests(test_id)
);

-- ── 10. TEST_REQUESTS ──
CREATE TABLE test_requests (
    id             SERIAL PRIMARY KEY,
    patient_id     INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id      INTEGER NOT NULL REFERENCES users(user_id),
    test_id        INTEGER REFERENCES tests(test_id),
    requested_at   TIMESTAMP DEFAULT NOW(),
    payment_status payment_status_enum DEFAULT 'Unpaid',
    status         test_status_enum DEFAULT 'Not Done Yet',
    paid_at        TIMESTAMP
);

-- ── 11. TEST_RESULTS ──
CREATE TABLE test_results (
    id              SERIAL PRIMARY KEY,
    test_request_id INTEGER NOT NULL REFERENCES test_requests(id),
    result_data     JSON,
    uploaded_at     TIMESTAMP DEFAULT NOW()
);

-- ── 12. FOLLOWUPS ──
CREATE TABLE followups (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES patients(patient_id),
    doctor_id       INTEGER NOT NULL REFERENCES users(user_id),
    prescription_id INTEGER REFERENCES prescriptions(prescription_id),
    assigned_at     TIMESTAMP DEFAULT NOW(),
    used            BOOLEAN DEFAULT FALSE,
    used_at         TIMESTAMP
);

-- ── 13. BILLS ──
CREATE TABLE bills (
    bill_id        SERIAL PRIMARY KEY,
    patient_id     INTEGER NOT NULL REFERENCES patients(patient_id),
    total_amount   FLOAT DEFAULT 0,
    discount       FLOAT DEFAULT 0,
    net_total      FLOAT DEFAULT 0,
    paid_at        TIMESTAMP DEFAULT NOW(),
    payment_method VARCHAR DEFAULT 'cash',
    bill_type      VARCHAR
);

-- ============================================================
-- DATA IMPORT
-- ============================================================

-- 1. ROLES
\copy roles(role_id, role, description) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/roles.csv' CSV HEADER;
-- Fix 'pharmacist' → 'pharmacy' to match app constants
UPDATE roles SET role = 'pharmacy' WHERE role = 'pharmacist';
SELECT setval('roles_role_id_seq', (SELECT MAX(role_id) FROM roles));

-- 2. USERS (skip first 2 junk lines: "users" and "users,,,,,")
\copy users(user_id, full_name, email, password, role_id, specialization) FROM PROGRAM 'tail -n +4 /Users/nikesholi/Desktop/MeroSwasthya_dataset/users.csv' CSV;
SELECT setval('users_user_id_seq', (SELECT MAX(user_id) FROM users));

-- 3. PATIENTS
\copy patients(patient_id, full_name, age, sex, contact, address, registered_at, is_deleted) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/patients_100_realistic.csv' CSV HEADER;
SELECT setval('patients_patient_id_seq', (SELECT MAX(patient_id) FROM patients));

-- 4. MEDICINES
\copy medicines(medicine_id, name, manufacturer, strength, category, price, quantity, expiry, threshold) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/medicines_30.csv' CSV HEADER;
SELECT setval('medicines_medicine_id_seq', (SELECT MAX(medicine_id) FROM medicines));

-- 5. TESTS
\copy tests(test_id, name, price) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/tests.csv' CSV HEADER;
SELECT setval('tests_test_id_seq', (SELECT MAX(test_id) FROM tests));

-- 7. PRESCRIPTIONS
\copy prescriptions(prescription_id, patient_id, doctor_id, diagnosis, created_at) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/prescriptions.csv' CSV HEADER;
SELECT setval('prescriptions_prescription_id_seq', (SELECT MAX(prescription_id) FROM prescriptions));

-- 8. PRESCRIPTION_ITEMS
\copy prescription_items(id, prescription_id, medicine_id, dose, duration, notes) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/prescription_items.csv' CSV HEADER;
SELECT setval('prescription_items_id_seq', (SELECT MAX(id) FROM prescription_items));

-- 9. PRESCRIPTION_TESTS
\copy prescription_tests(id, prescription_id, test_id) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/prescription_tests.csv' CSV HEADER;
SELECT setval('prescription_tests_id_seq', (SELECT MAX(id) FROM prescription_tests));

-- 10. TEST_REQUESTS
-- CSV has: paid/pending/completed/uploaded → map to ENUMs
-- payment_status: 'paid' → 'Paid' ; status: 'completed'|'uploaded' → 'Done', 'pending' → 'Not Done Yet'
CREATE TEMP TABLE test_requests_raw (
    id             INTEGER,
    patient_id     INTEGER,
    doctor_id      INTEGER,
    test_id        INTEGER,
    requested_at   TIMESTAMP,
    payment_status VARCHAR,
    status         VARCHAR,
    paid_at        TIMESTAMP
);
\copy test_requests_raw FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/test_requests.csv' CSV HEADER;

INSERT INTO test_requests(id, patient_id, doctor_id, test_id, requested_at, payment_status, status, paid_at)
SELECT
    id, patient_id, doctor_id, test_id, requested_at,
    CASE LOWER(payment_status)
        WHEN 'paid'   THEN 'Paid'::payment_status_enum
        WHEN 'waived' THEN 'Waived'::payment_status_enum
        ELSE               'Unpaid'::payment_status_enum
    END,
    CASE LOWER(status)
        WHEN 'completed'   THEN 'Done'::test_status_enum
        WHEN 'uploaded'    THEN 'Done'::test_status_enum
        WHEN 'in progress' THEN 'In Progress'::test_status_enum
        ELSE                    'Not Done Yet'::test_status_enum
    END,
    paid_at
FROM test_requests_raw;
SELECT setval('test_requests_id_seq', (SELECT MAX(id) FROM test_requests));

-- 13. BILLS
\copy bills(bill_id, patient_id, total_amount, discount, net_total, paid_at, payment_method, bill_type) FROM '/Users/nikesholi/Desktop/MeroSwasthya_dataset/bills.csv' CSV HEADER;
SELECT setval('bills_bill_id_seq', (SELECT MAX(bill_id) FROM bills));

-- ── VERIFY ──
SELECT 'roles'              AS tbl, COUNT(*) FROM roles
UNION ALL SELECT 'users',              COUNT(*) FROM users
UNION ALL SELECT 'patients',           COUNT(*) FROM patients
UNION ALL SELECT 'medicines',          COUNT(*) FROM medicines
UNION ALL SELECT 'tests',              COUNT(*) FROM tests
UNION ALL SELECT 'prescriptions',      COUNT(*) FROM prescriptions
UNION ALL SELECT 'prescription_items', COUNT(*) FROM prescription_items
UNION ALL SELECT 'prescription_tests', COUNT(*) FROM prescription_tests
UNION ALL SELECT 'test_requests',      COUNT(*) FROM test_requests
UNION ALL SELECT 'bills',              COUNT(*) FROM bills
ORDER BY 1;
