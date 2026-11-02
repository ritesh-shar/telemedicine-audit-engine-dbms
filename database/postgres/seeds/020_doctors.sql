-- Development dataset: 20 doctor accounts across 10 common specializations.
-- Every seeded account uses the password: DoctorPass123!
-- Safe to rerun: users are matched by email and doctors by license number.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE seed_doctor_data (
    full_name VARCHAR(100),
    email VARCHAR(255),
    specialization VARCHAR(100),
    qualification VARCHAR(150),
    license_number VARCHAR(100),
    consultation_fee NUMERIC(10, 2)
) ON COMMIT DROP;

INSERT INTO seed_doctor_data (
    full_name,
    email,
    specialization,
    qualification,
    license_number,
    consultation_fee
)
VALUES
        ('Dr. Aisha Khan', 'aisha.khan@telemed.test', 'Cardiology', 'MD, Cardiology', 'TEL-CARD-001', 900.00),
        ('Dr. Daniel Brooks', 'daniel.brooks@telemed.test', 'Cardiology', 'MBBS, MD Cardiology', 'TEL-CARD-002', 850.00),
        ('Dr. Meera Patel', 'meera.patel@telemed.test', 'Dermatology', 'MD, Dermatology', 'TEL-DERM-001', 700.00),
        ('Dr. Lucas Martin', 'lucas.martin@telemed.test', 'Dermatology', 'MBBS, DNB Dermatology', 'TEL-DERM-002', 650.00),
        ('Dr. Sofia Garcia', 'sofia.garcia@telemed.test', 'Pediatrics', 'MD, Pediatrics', 'TEL-PEDI-001', 600.00),
        ('Dr. Arjun Rao', 'arjun.rao@telemed.test', 'Pediatrics', 'MBBS, DCH', 'TEL-PEDI-002', 550.00),
        ('Dr. Emily Wilson', 'emily.wilson@telemed.test', 'Psychiatry', 'MD, Psychiatry', 'TEL-PSYC-001', 800.00),
        ('Dr. Noah Williams', 'noah.williams@telemed.test', 'Psychiatry', 'MBBS, DPM', 'TEL-PSYC-002', 750.00),
        ('Dr. Fatima Ahmed', 'fatima.ahmed@telemed.test', 'Orthopedics', 'MS, Orthopedics', 'TEL-ORTH-001', 850.00),
        ('Dr. Oliver Brown', 'oliver.brown@telemed.test', 'Orthopedics', 'MBBS, DNB Orthopedics', 'TEL-ORTH-002', 800.00),
        ('Dr. Priya Nair', 'priya.nair@telemed.test', 'General Medicine', 'MD, General Medicine', 'TEL-GMED-001', 500.00),
        ('Dr. Ethan Davis', 'ethan.davis@telemed.test', 'General Medicine', 'MBBS, MD', 'TEL-GMED-002', 450.00),
        ('Dr. Hannah Lee', 'hannah.lee@telemed.test', 'Gynecology', 'MD, Obstetrics and Gynecology', 'TEL-GYNE-001', 750.00),
        ('Dr. Vikram Singh', 'vikram.singh@telemed.test', 'Gynecology', 'MBBS, DGO', 'TEL-GYNE-002', 700.00),
        ('Dr. Grace Taylor', 'grace.taylor@telemed.test', 'Ophthalmology', 'MS, Ophthalmology', 'TEL-OPHT-001', 650.00),
        ('Dr. Rohan Shah', 'rohan.shah@telemed.test', 'Ophthalmology', 'MBBS, DO', 'TEL-OPHT-002', 600.00),
        ('Dr. Chloe Anderson', 'chloe.anderson@telemed.test', 'ENT', 'MS, ENT', 'TEL-ENT-001', 600.00),
        ('Dr. Aditya Menon', 'aditya.menon@telemed.test', 'ENT', 'MBBS, DLO', 'TEL-ENT-002', 550.00),
        ('Dr. Isabella Thomas', 'isabella.thomas@telemed.test', 'Neurology', 'DM, Neurology', 'TEL-NEUR-001', 950.00),
        ('Dr. Kabir Verma', 'kabir.verma@telemed.test', 'Neurology', 'MD, DM Neurology', 'TEL-NEUR-002', 900.00);

INSERT INTO users (full_name, email, password_hash, role)
SELECT
    full_name,
    email,
    crypt('DoctorPass123!', gen_salt('bf', 12)),
    'DOCTOR'
FROM seed_doctor_data
ON CONFLICT (email) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        role = 'DOCTOR';

INSERT INTO doctors (
    user_id,
    specialization,
    qualification,
    license_number,
    consultation_fee,
    is_available
)
SELECT
    u.user_id,
    d.specialization,
    d.qualification,
    d.license_number,
    d.consultation_fee,
    TRUE
FROM seed_doctor_data d
JOIN users u ON u.email = d.email
ON CONFLICT (license_number) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        specialization = EXCLUDED.specialization,
        qualification = EXCLUDED.qualification,
        consultation_fee = EXCLUDED.consultation_fee,
        is_available = EXCLUDED.is_available;

COMMIT;

SELECT
    u.full_name,
    u.email,
    d.specialization,
    d.license_number
FROM doctors d
JOIN users u ON u.user_id = d.user_id
WHERE u.email LIKE '%@telemed.test'
ORDER BY d.specialization, u.full_name;
