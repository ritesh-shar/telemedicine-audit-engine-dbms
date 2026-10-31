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
