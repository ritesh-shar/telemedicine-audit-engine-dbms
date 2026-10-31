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
