-- Run after 001_initial_schema.sql, the existing audit function/triggers, and
-- 002_advanced_features.sql:
-- psql -v ON_ERROR_STOP=1 -f database/postgres/tests/advanced_features_test.sql
--
-- Every write is rolled back at the end. The test requires an empty UUID
-- namespace only for the UUIDs below; existing rows with these IDs will cause
-- the test to fail rather than overwrite data.

\set ON_ERROR_STOP on
BEGIN;

SELECT set_config(
  'app.current_user_id',
  '00000000-0000-0000-0000-000000000001',
  true
);

INSERT INTO users (user_id, full_name, email, password_hash, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Doctor', 'test-doctor@example.test', 'not-a-real-password', 'DOCTOR'),
  ('00000000-0000-0000-0000-000000000002', 'Test Patient', 'test-patient@example.test', 'not-a-real-password', 'PATIENT');

INSERT INTO doctors (
  doctor_id, user_id, specialization, qualification, license_number,
  consultation_fee
)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'General Medicine',
  'MD',
  'TEST-LICENSE-001',
  50
);

INSERT INTO patients (patient_id, user_id, date_of_birth, gender)
VALUES (
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000002',
  '1990-01-01',
  'X'
);

INSERT INTO appointments (
  appointment_id, patient_id, doctor_id, appointment_time, status, reason
)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000011',
  '2099-01-01T10:00:00Z',
  'CONFIRMED',
  'Smoke test'
);

INSERT INTO consultations (consultation_id, appointment_id, consultation_status)
VALUES (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000021',
  'COMPLETED'
);

INSERT INTO prescriptions (
  prescription_id, consultation_id, patient_id, doctor_id, instructions
)
VALUES (
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000011',
  'Take with water'
);

INSERT INTO prescription_items (
  item_id, prescription_id, medicine_name, dosage, frequency, duration, quantity
)
VALUES
  (
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000041',
    'Medicine A', '10 mg', 'Once daily', '7 days', 7
  ),
  (
    '00000000-0000-0000-0000-000000000052',
    '00000000-0000-0000-0000-000000000041',
    'Medicine B', '5 mg', 'Twice daily', '5 days', 10
  );

DO $$
DECLARE
  item_count INTEGER;
  audit_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO item_count
  FROM prescription_items
  WHERE prescription_id = '00000000-0000-0000-0000-000000000041';
  IF item_count <> 2 THEN
    RAISE EXCEPTION 'Prescription header plus multiple medicine rows test failed';
  END IF;

  SELECT COUNT(*) INTO audit_count
  FROM auditlog
  WHERE entity_type = 'prescription_items'
    AND action = 'INSERT'
    AND entity_id IN (
      '00000000-0000-0000-0000-000000000051',
      '00000000-0000-0000-0000-000000000052'
    )
    AND user_id = '00000000-0000-0000-0000-000000000001';
  IF audit_count <> 2 THEN
    RAISE EXCEPTION 'Audit actor propagation test failed';
  END IF;
END;
$$;

-- A failed item insert must not leave the header or its earlier item behind.
DO $$
BEGIN
  BEGIN
    INSERT INTO prescriptions (
      prescription_id, consultation_id, patient_id, doctor_id
    )
    VALUES (
      '00000000-0000-0000-0000-000000000042',
      '00000000-0000-0000-0000-000000000031',
      '00000000-0000-0000-0000-000000000012',
      '00000000-0000-0000-0000-000000000011'
    );
    INSERT INTO prescription_items (
      prescription_id, medicine_name, dosage, frequency, duration, quantity
    )
    VALUES (
      '00000000-0000-0000-0000-000000000042',
      'Invalid medicine', '1 mg', 'Once', '1 day', 0
    );
    RAISE EXCEPTION 'Expected invalid quantity to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;

DO $$
DECLARE
  prescription_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO prescription_count
  FROM prescriptions
  WHERE prescription_id = '00000000-0000-0000-0000-000000000042';
  IF prescription_count <> 0 THEN
    RAISE EXCEPTION 'Failed medicine insert did not roll back the prescription';
  END IF;
END;
$$;

UPDATE appointments
SET status = 'COMPLETED'
WHERE appointment_id = '00000000-0000-0000-0000-000000000021';

UPDATE prescriptions
SET status = 'REVOKED'
WHERE prescription_id = '00000000-0000-0000-0000-000000000041';

UPDATE prescription_items
SET dosage = '20 mg'
WHERE item_id = '00000000-0000-0000-0000-000000000051';

DO $$
DECLARE
  old_status TEXT;
  new_status TEXT;
  trigger_count INTEGER;
BEGIN
  SELECT old_data ->> 'status', new_data ->> 'status'
  INTO old_status, new_status
  FROM auditlog
  WHERE entity_type = 'prescriptions'
    AND entity_id = '00000000-0000-0000-0000-000000000041'
    AND action = 'UPDATE'
  ORDER BY changed_at DESC
  LIMIT 1;
  IF old_status <> 'ACTIVE' OR new_status <> 'REVOKED' THEN
    RAISE EXCEPTION 'Prescription status audit old/new JSONB test failed';
  END IF;

  SELECT COUNT(*) INTO trigger_count
  FROM auditlog
  WHERE entity_type IN ('appointments', 'prescriptions', 'prescription_items')
    AND action = 'UPDATE'
    AND user_id = '00000000-0000-0000-0000-000000000001';
  IF trigger_count < 3 THEN
    RAISE EXCEPTION 'INSERT/UPDATE trigger coverage test failed';
  END IF;
END;
$$;

DO $$
DECLARE
  schedule_count INTEGER;
  history_count INTEGER;
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO schedule_count
  FROM doctor_appointment_schedule
  WHERE appointment_id = '00000000-0000-0000-0000-000000000021';
  SELECT COUNT(*) INTO history_count
  FROM patient_prescription_history
  WHERE prescription_id = '00000000-0000-0000-0000-000000000041';
  SELECT COUNT(*) INTO report_count
  FROM get_appointment_counts_by_doctor_status(
    '00000000-0000-0000-0000-000000000011',
    '2099-01-01T00:00:00Z',
    '2100-01-01T00:00:00Z'
  );
  IF schedule_count <> 1 OR history_count <> 2 OR report_count <> 1 THEN
    RAISE EXCEPTION 'View or stored function result test failed';
  END IF;
END;
$$;

-- Exercise DELETE triggers. Cascading prescription deletion also exercises the
-- prescription-item DELETE trigger.
DELETE FROM prescriptions
WHERE prescription_id = '00000000-0000-0000-0000-000000000041';
DELETE FROM consultations
WHERE consultation_id = '00000000-0000-0000-0000-000000000031';
DELETE FROM appointments
WHERE appointment_id = '00000000-0000-0000-0000-000000000021';

DO $$
DECLARE
  delete_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO delete_count
  FROM auditlog
  WHERE action = 'DELETE'
    AND entity_type IN ('appointments', 'prescriptions', 'prescription_items');
  IF delete_count < 3 THEN
    RAISE EXCEPTION 'DELETE trigger coverage test failed';
  END IF;
END;
$$;

\echo 'PASS: PostgreSQL advanced feature and audit smoke tests'
ROLLBACK;
