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
