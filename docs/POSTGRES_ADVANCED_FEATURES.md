# PostgreSQL advanced features

Run the setup in this order:

```text
database/postgres/migrations/001_initial_schema.sql
database/postgres/functions/audit_trigger.sql
database/postgres/triggers/audit_triggers.sql
database/postgres/migrations/002_advanced_features.sql
```

The audit function and triggers are existing shared objects and are not
redefined by `002_advanced_features.sql`. The migration is the canonical
setup path for the views and reporting function. The standalone scripts below
are for review and development only; do not run them together with the
migration.

```text
database/postgres/views/doctor_appointment_schedule.sql
database/postgres/views/patient_prescription_history.sql
database/postgres/functions/appointment_counts_by_doctor_status.sql
```

## Views

### Doctor appointment schedule

`doctor_appointment_schedule` joins appointments with patient and doctor
profiles. It provides appointment timing and status, patient identity for the
doctor dashboard, and the doctor's name and professional details.

```sql
SELECT appointment_id, appointment_time, status,
       patient_name, doctor_name, doctor_specialization
FROM doctor_appointment_schedule
WHERE doctor_id = '<doctor UUID>'
ORDER BY appointment_time;
```

Expected result: one row per appointment for the selected doctor, ordered by
appointment time.

### Patient prescription history

`patient_prescription_history` returns one row per medicine item. The
`patient_user_id` column supports filtering by the authenticated patient's
user ID, while prescription and medicine details remain in one queryable
record.

```sql
SELECT prescription_id, prescribed_at, prescription_status,
       medicine_name, dosage, frequency, duration
FROM patient_prescription_history
WHERE patient_user_id = '<patient user UUID>'
ORDER BY prescribed_at DESC, medicine_name;
```

Expected result: only prescriptions belonging to the selected patient, with
one row for each medicine item.

## Stored function

`get_appointment_counts_by_doctor_status` returns appointment counts grouped
by doctor and appointment status. All parameters are optional:

- `p_doctor_id` limits the report to one doctor.
- `p_from` includes appointments at or after the supplied timestamp.
- `p_to` excludes appointments at or after the supplied timestamp.

```sql
SELECT *
FROM get_appointment_counts_by_doctor_status(
    p_doctor_id => '<doctor UUID>',
    p_from => '2026-01-01T00:00:00Z',
    p_to => '2027-01-01T00:00:00Z'
);
```

Expected result: zero or more rows containing the selected doctor, doctor
name, each status present in the date range, and its appointment count.
