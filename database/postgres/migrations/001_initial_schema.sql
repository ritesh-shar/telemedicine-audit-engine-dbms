-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. USERS
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('PATIENT', 'DOCTOR', 'ADMIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. DOCTORS
CREATE TABLE doctors (
    doctor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE
        REFERENCES users(user_id) ON DELETE CASCADE,
    specialization VARCHAR(100) NOT NULL,
    qualification VARCHAR(150) NOT NULL,
    license_number VARCHAR(100) NOT NULL UNIQUE,
    consultation_fee NUMERIC(10, 2) NOT NULL
        CHECK (consultation_fee >= 0),
    is_available BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. PATIENTS
CREATE TABLE patients (
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE
        REFERENCES users(user_id) ON DELETE CASCADE,
    date_of_birth DATE,
    gender VARCHAR(20),
    phone VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. APPOINTMENTS
CREATE TABLE appointments (
    appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL
        REFERENCES patients(patient_id),
    doctor_id UUID NOT NULL
        REFERENCES doctors(doctor_id),
    appointment_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN (
            'SCHEDULED',
            'CONFIRMED',
            'COMPLETED',
            'CANCELLED'
        )),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Prevent two active appointments for the same doctor at the same time
CREATE UNIQUE INDEX unique_doctor_appointment_slot
ON appointments (doctor_id, appointment_time)
WHERE status IN ('SCHEDULED', 'CONFIRMED');

-- Speed up patient and doctor appointment lookups
CREATE INDEX idx_appointments_patient
ON appointments(patient_id);

CREATE INDEX idx_appointments_doctor_time
ON appointments(doctor_id, appointment_time);

-- 5. CONSULTATIONS
CREATE TABLE consultations (
    consultation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL UNIQUE
        REFERENCES appointments(appointment_id),
    mongo_document_id VARCHAR(100) UNIQUE,
    consultation_status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (consultation_status IN (
            'IN_PROGRESS',
            'COMPLETED'
        )),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

-- 6. PRESCRIPTIONS
CREATE TABLE prescriptions (
    prescription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL
        REFERENCES consultations(consultation_id),
    patient_id UUID NOT NULL
        REFERENCES patients(patient_id),
    doctor_id UUID NOT NULL
        REFERENCES doctors(doctor_id),
    prescribed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    instructions TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'REVOKED'))
);

-- 7. PRESCRIPTION ITEMS
CREATE TABLE prescription_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL
        REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
    medicine_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100) NOT NULL,
    quantity INTEGER CHECK (quantity > 0),
    additional_instructions TEXT
);

-- 8. AUDIT LOG
CREATE TABLE auditlog (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Useful for retrieving an entity's audit history
CREATE INDEX idx_auditlog_entity
ON auditlog(entity_type, entity_id);

-- Useful for retrieving actions by user
CREATE INDEX idx_auditlog_user
ON auditlog(user_id);

-- 9. AUDIT TRIGGERS

CREATE TRIGGER audit_appointments
AFTER INSERT OR UPDATE OR DELETE ON appointments
FOR EACH ROW
EXECUTE FUNCTION audit_record_changes();

CREATE TRIGGER audit_prescriptions
AFTER INSERT OR UPDATE OR DELETE ON prescriptions
FOR EACH ROW
EXECUTE FUNCTION audit_record_changes();

CREATE TRIGGER audit_prescription_items
AFTER INSERT OR UPDATE OR DELETE ON prescription_items
FOR EACH ROW
EXECUTE FUNCTION audit_record_changes();
