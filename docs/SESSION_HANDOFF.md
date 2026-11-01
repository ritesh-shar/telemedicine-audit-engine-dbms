# Telemedicine Audit Engine — Session Handoff

This is a readable project record of the implementation and verification work
completed during the session. It is organized by topic rather than being a
verbatim export of the chat interface.

## Repository

`ritesh-shar/telemedicine-audit-engine-dbms`

Workspace:

```text
C:\Users\rithi\telemedicine-audit-engine-dbms
```

## 1. Prescription APIs

Implemented PostgreSQL prescription routes:

```text
frontend/src/app/api/prescriptions/route.ts
frontend/src/app/api/prescriptions/[id]/route.ts
frontend/src/lib/prescription-validation.ts
```

Implemented behavior:

- Doctor-only prescription creation.
- Consultation ownership verification through PostgreSQL joins.
- Completed-consultation requirement.
- Validation of every medicine item.
- Header and all medicine rows inserted in one PostgreSQL transaction.
- Transaction-local audit actor identity:

  ```sql
  SELECT set_config('app.current_user_id', $1, true)
  ```

- Patient, doctor, and admin prescription visibility rules.
- Doctor/admin status updates with row locking.
- Prescription revocation through `PATCH`.
- Response shaping without exposing internal database fields.

## 2. PostgreSQL audit function and triggers

Existing and verified files:

```text
database/postgres/functions/audit_trigger.sql
database/postgres/triggers/audit_triggers.sql
database/postgres/migrations/001_initial_schema.sql
```

The audit function supports:

| Table | Primary key |
|---|---|
| `appointments` | `appointment_id` |
| `prescriptions` | `prescription_id` |
| `prescription_items` | `item_id` |

It records:

- `INSERT`, `UPDATE`, and `DELETE`.
- `OLD` and `NEW` row values as JSONB.
- The actor from `app.current_user_id`.
- The correct `entity_id`.
- `old_data` for updates/deletes.
- `new_data` for inserts/updates.

The triggers are `AFTER` row triggers covering all three operations.

The audit table is defined in:

```text
database/postgres/migrations/001_initial_schema.sql
```

## 3. PostgreSQL views and stored function

Added:

```text
database/postgres/views/doctor_appointment_schedule.sql
database/postgres/views/patient_prescription_history.sql
database/postgres/functions/appointment_counts_by_doctor_status.sql
docs/POSTGRES_ADVANCED_FEATURES.md
```

The views provide:

- Doctor appointment schedule with appointment, patient, and doctor details.
- Patient prescription history with medicine rows.

The stored function is:

```sql
get_appointment_counts_by_doctor_status(
    p_doctor_id UUID DEFAULT NULL,
    p_from TIMESTAMPTZ DEFAULT NULL,
    p_to TIMESTAMPTZ DEFAULT NULL
)
```

It returns appointment counts grouped by doctor and status.

## 4. Doctor and admin UI

Added server API routes:

```text
frontend/src/app/api/appointments/route.ts
frontend/src/app/api/admin/audit/route.ts
```

Added pages:

```text
frontend/src/app/doctor/page.tsx
frontend/src/app/doctor/appointments/page.tsx
frontend/src/app/doctor/consultations/new/page.tsx
frontend/src/app/doctor/consultations/[id]/page.tsx
frontend/src/app/admin/audit/page.tsx
```

Added shared UI components:

```text
frontend/src/components/app-shell.tsx
frontend/src/components/consultation-workspace.tsx
```

The UI includes:

- Doctor dashboard.
- Doctor appointment schedule.
- Consultation workspace.
- Symptoms, complaints, examination, assessment, and plan fields.
- Multiple prescription medicine lines.
- Prescription history and revocation.
- Admin audit history.
- Expandable old/new JSON audit details.

The pages call server APIs with `fetch`; client components do not connect
directly to PostgreSQL or MongoDB.

## 5. Next.js type and build fix

The original layout used an undeclared `LayoutProps` type. It was replaced
with the standard React type:

```tsx
import type { ReactNode } from "react";

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
```

This fixed the TypeScript error:

```text
Cannot find name 'LayoutProps'
```

## 6. MongoDB schema and tests

MongoDB schema:

```text
database/mongodb/schemas/create_consultations_collection.js
```

MongoDB smoke test:

```text
database/mongodb/tests/consultations_smoke_test.js
```

The schema includes:

- Required consultation fields.
- Nested observation and clinical-note validation.
- Unique `consultationId` index.
- Appointment and patient lookup indexes.
- MongoDB-generated `_id` support.

The `_id` field was explicitly added to the root JSON schema after MongoDB
reported:

```text
additionalProperties: ['_id']
```

After reapplying the schema, the MongoDB smoke test passed:

```text
PASS: validator rejects a missing required field
PASS: validator rejects an incorrectly typed required field
PASS: valid consultation document can be inserted
PASS: unique consultationId index rejects a duplicate
PASS: consultation document can be retrieved by consultation ID
PASS: retrieved consultation retains its appointment ID
MongoDB consultation smoke tests completed.
```

## 7. PostgreSQL test scripts

Added:

```text
database/postgres/tests/advanced_features_test.sql
docs/TEST_RESULTS.md
```

The PostgreSQL smoke test covers:

- Prescription header plus multiple medicine rows.
- Rollback after a failed medicine insert.
- Prescription status audit old/new JSONB.
- Transaction-local audit actor propagation.
- Appointment, prescription, and prescription-item update triggers.
- Appointment, prescription, and prescription-item delete triggers.
- Doctor schedule view.
- Patient prescription history view.
- Appointment-count stored function.

## 8. PostgreSQL environment and verification

The PostgreSQL database is:

```text
telemedicine_db
```

The PostgreSQL user is:

```text
postgres
```

The WSL Linux username is different and must not be used as the PostgreSQL
database user.

The frontend environment file is:

```text
frontend/.env.local
```

Expected variables:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=telemedicine_db
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/telemedicine_db
SESSION_SECRET=your-long-development-secret
```

The real password and secret must not be committed.

The base PostgreSQL migration had already been applied, so rerunning it
produced the expected existing-table error:

```text
ERROR: relation "users" already exists
```

The database was then verified to contain:

```text
appointments
auditlog
consultations
doctors
patients
prescription_items
prescriptions
users
```

The audit function, views, and stored function were installed successfully.

The PostgreSQL smoke test produced:

```text
PASS: PostgreSQL advanced feature and audit smoke tests
ROLLBACK
```

The test data was rolled back.

The trigger inspection returned nine rows because each of three triggers
reports three event types:

```text
3 triggers × INSERT, UPDATE, DELETE = 9 rows
```

These results are recorded in:

```text
docs/TEST_RESULTS.md
```

## 9. Frontend validation

The following checks passed:

```text
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

The Next.js production build completed successfully.

## 10. Checklist status

The project checklist contains 15 items.

Fully verified:

- MongoDB validator and indexes are version-controlled.
- Reusable MongoDB connection module exists.
- PostgreSQL consultation reference matches the shared schema.
- Prescription creation supports multiple medicines in one transaction.
- Audit function maps all three primary-key names.
- Three audit triggers cover `INSERT`, `UPDATE`, and `DELETE`.
- Views and stored function execute with test evidence.
- MongoDB schema smoke test passed.
- PostgreSQL advanced-feature smoke test passed.

Implemented but requiring live API integration verification:

- Consultation create/read APIs with cross-database failure handling.
- Consultation retry/idempotency behavior.
- Doctor and patient consultation authorization checks.
- API prescription creation and API-level rollback.
- API status update audit verification.
- Complete doctor consultation and prescription workflow.

Still requiring team/process completion:

- Pull request review.
- CI passing on the pull request.
- Pull request merged.
- Complete patient-to-doctor-to-prescription workflow tested with Ritesh.

## 11. Useful commands

### MongoDB

From PowerShell:

```powershell
mongosh "mongodb://127.0.0.1:27017/telemedicine_db" `
  database\mongodb\schemas\create_consultations_collection.js

mongosh "mongodb://127.0.0.1:27017/telemedicine_db" `
  database\mongodb\tests\consultations_smoke_test.js
```

### PostgreSQL

From WSL:

```bash
cd /mnt/c/Users/rithi/telemedicine-audit-engine-dbms

export DATABASE_URL='postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/telemedicine_db'

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f database/postgres/tests/advanced_features_test.sql
```

### Frontend

From PowerShell:

```powershell
Set-Location frontend
npm run dev
```

Restart the development server after changing `.env.local`.
