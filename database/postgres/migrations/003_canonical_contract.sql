-- Reconcile databases created from the implementation's earlier schema
-- with the shared handout contract.

ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consultation_status_check;
ALTER TABLE consultations ALTER COLUMN consultation_status SET DEFAULT 'PENDING';
ALTER TABLE consultations ADD CONSTRAINT consultations_consultation_status_check
CHECK (consultation_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'));

ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_id_fkey;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_doctor_id_fkey;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS patient_id;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS doctor_id;
