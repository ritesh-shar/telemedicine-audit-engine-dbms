# Test results

This document records only test commands that have actually been run. A test
must not be marked as passed based on code inspection alone.

## Database smoke tests

### MongoDB

Command:

```bash
mongosh "$MONGODB_URI/$MONGODB_DB" \
  database/mongodb/schemas/create_consultations_collection.js
mongosh "$MONGODB_URI/$MONGODB_DB" \
  database/mongodb/tests/consultations_smoke_test.js
```

Status: **NOT RUN in this workspace** (`mongosh` and a configured MongoDB
connection were not available during implementation).

Coverage:

- Validator rejects missing required fields.
- Validator rejects incorrect field types.
- Valid consultation insertion.
- Duplicate `consultationId` rejection.
- Consultation retrieval by ID.

### PostgreSQL

Command:

```bash
psql -v ON_ERROR_STOP=1 \
  -f database/postgres/migrations/001_initial_schema.sql
psql -v ON_ERROR_STOP=1 \
  -f database/postgres/functions/audit_trigger.sql
psql -v ON_ERROR_STOP=1 \
  -f database/postgres/triggers/audit_triggers.sql
psql -v ON_ERROR_STOP=1 \
  -f database/postgres/views/doctor_appointment_schedule.sql
psql -v ON_ERROR_STOP=1 \
  -f database/postgres/views/patient_prescription_history.sql
psql -v ON_ERROR_STOP=1 \
  -f database/postgres/functions/appointment_counts_by_doctor_status.sql
psql -v ON_ERROR_STOP=1 \
  -f database/postgres/tests/advanced_features_test.sql
```

Status: **PASSED in WSL on 2026-10-30**.

The base migration was already applied in `telemedicine_db`, so it was not
rerun. The audit function, views, and stored function were installed or
replaced, and the smoke test was run with:

```bash
psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f database/postgres/tests/advanced_features_test.sql
```

Observed final output:

```text
PASS: PostgreSQL advanced feature and audit smoke tests
ROLLBACK
```

The test inserted its fixture data, verified the checks, and rolled it back.

Coverage:

- Prescription header with multiple medicine rows.
- Failed medicine insert rollback.
- Prescription status audit with old/new JSONB.
- Appointment, prescription, and prescription-item audit writes.
- Transaction-local audit actor.
- Doctor schedule view.
- Patient prescription history view.
- Appointment-count stored function.
- DELETE trigger behavior.

The trigger inspection returned nine rows: three rows for each trigger
(INSERT, UPDATE, and DELETE), which is expected for one trigger covering all
three event types.

## API integration tests still required

These cases require an authenticated HTTP test harness and seeded PostgreSQL
and MongoDB records. They are intentionally **NOT RUN**:

- Consultation creation idempotency for retry with the same ID.
- A doctor cannot create or read another doctor's consultation.
- A patient cannot read another patient's consultation.
- API prescription creation with multiple medicine rows.
- API rollback when one medicine item fails validation.
- API status update produces the expected audit row.

The existing route-level authorization and transaction code should be tested
against live services before marking these cases as passed.
