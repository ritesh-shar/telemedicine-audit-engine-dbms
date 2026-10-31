-- Apply after 001_initial_schema.sql and the existing audit function/triggers.
-- This migration intentionally does not redefine audit objects.

CREATE OR REPLACE VIEW doctor_appointment_schedule AS
SELECT
    a.appointment_id,
    a.appointment_time,
    a.status,
    a.reason,
    a.created_at,
    a.doctor_id,
    doctor_user.user_id AS doctor_user_id,
    doctor_user.full_name AS doctor_name,
    d.specialization AS doctor_specialization,
    d.qualification AS doctor_qualification,
    a.patient_id,
    patient_user.user_id AS patient_user_id,
    patient_user.full_name AS patient_name
FROM appointments a
JOIN doctors d ON d.doctor_id = a.doctor_id
JOIN users doctor_user ON doctor_user.user_id = d.user_id
JOIN patients p ON p.patient_id = a.patient_id
JOIN users patient_user ON patient_user.user_id = p.user_id;

CREATE OR REPLACE VIEW patient_prescription_history AS
SELECT
    p.prescription_id,
    p.consultation_id,
    p.patient_id,
    patient_user.user_id AS patient_user_id,
    patient_user.full_name AS patient_name,
    p.doctor_id,
    doctor_user.user_id AS doctor_user_id,
    doctor_user.full_name AS doctor_name,
    p.prescribed_at,
    p.status AS prescription_status,
    p.instructions,
    pi.item_id,
    pi.medicine_name,
    pi.dosage,
    pi.frequency,
    pi.duration,
    pi.quantity,
    pi.additional_instructions
FROM prescriptions p
JOIN consultations c ON c.consultation_id = p.consultation_id
JOIN appointments a ON a.appointment_id = c.appointment_id
JOIN patients patient ON patient.patient_id = a.patient_id
JOIN users patient_user ON patient_user.user_id = patient.user_id
JOIN doctors d ON d.doctor_id = a.doctor_id
JOIN users doctor_user ON doctor_user.user_id = d.user_id
JOIN prescription_items pi ON pi.prescription_id = p.prescription_id;

CREATE OR REPLACE FUNCTION get_appointment_counts_by_doctor_status(
    p_doctor_id UUID DEFAULT NULL,
    p_from TIMESTAMPTZ DEFAULT NULL,
    p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    doctor_id UUID,
    doctor_name VARCHAR(100),
    appointment_status VARCHAR(20),
    appointment_count BIGINT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        s.doctor_id,
        s.doctor_name,
        s.status AS appointment_status,
        COUNT(*) AS appointment_count
    FROM doctor_appointment_schedule s
    WHERE (p_doctor_id IS NULL OR s.doctor_id = p_doctor_id)
      AND (p_from IS NULL OR s.appointment_time >= p_from)
      AND (p_to IS NULL OR s.appointment_time < p_to)
    GROUP BY s.doctor_id, s.doctor_name, s.status
    ORDER BY s.doctor_name, s.status;
$$;
