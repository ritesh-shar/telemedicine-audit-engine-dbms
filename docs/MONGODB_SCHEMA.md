# MongoDB Consultation Schema

MongoDB stores the flexible consultation details for the telemedicine MVP.
The database is `telemedicine_db` and the collection is `consultations`.
There is one MongoDB document for each PostgreSQL consultation.

## Setup

Run the version-controlled setup script with `mongosh`:

```powershell
mongosh "mongodb://127.0.0.1:27017/telemedicine_db" `
  database/mongodb/schemas/create_consultations_collection.js
```

The script is idempotent. It creates the collection when it does not exist and
uses `collMod` to apply the current validator when it already exists. It then
ensures the indexes are present.

## Document contract and validation

The validator uses MongoDB `$jsonSchema` with `validationLevel: "strict"` and
`validationAction: "error"`. Every document must contain these fields:

| Field | BSON type | Meaning |
| --- | --- | --- |
| `consultationId` | `string` | The exact string value of PostgreSQL `consultations.consultation_id`; unique |
| `appointmentId` | `string` | PostgreSQL appointment UUID as a string |
| `patientId` | `string` | PostgreSQL patient UUID as a string |
| `doctorId` | `string` | PostgreSQL doctor UUID as a string |
| `symptoms` | `array` of `string` | Recorded symptoms |
| `observations` | `array` of `object` | Structured observations |
| `clinicalNotes` | `object` | `complaints`, `examination`, `assessment`, and `plan` strings |
| `createdAt` | `date` | BSON creation timestamp |
| `updatedAt` | `date` | BSON update timestamp |

Each observation requires `name`, `value`, `unit`, and `recordedAt`, where
`recordedAt` is a BSON date. Unknown fields are rejected both on the
consultation document and inside observations and clinical notes. This keeps
prescription data out of MongoDB.

The application must use the same `consultationId` when creating the
PostgreSQL consultation row and this MongoDB document. The unique index makes
retries idempotent rather than allowing duplicate consultation documents.

## Indexes

The setup script creates:

- `uq_consultations_consultation_id`: unique index on `consultationId`.
- `idx_consultations_appointment_id`: index on `appointmentId` for appointment
  authorization and consultation lookups.
- `idx_consultations_patient_id`: index on `patientId` for patient consultation
  lookups.

## Synthetic example document

This example contains fictional data only. It is documentation and is not
inserted by the setup script.

```javascript
{
  consultationId: "10000000-0000-4000-8000-000000000001",
  appointmentId: "20000000-0000-4000-8000-000000000001",
  patientId: "30000000-0000-4000-8000-000000000001",
  doctorId: "40000000-0000-4000-8000-000000000001",
  symptoms: ["headache", "fatigue"],
  observations: [
    {
      name: "blood_pressure",
      value: "120/80",
      unit: "mmHg",
      recordedAt: ISODate("2026-01-15T10:30:00Z")
    }
  ],
  clinicalNotes: {
    complaints: "Synthetic demo headache reported for two days",
    examination: "Synthetic demo observation; no urgent finding",
    assessment: "Synthetic demo tension headache assessment",
    plan: "Synthetic demo follow-up as advised"
  },
  createdAt: ISODate("2026-01-15T10:30:00Z"),
  updatedAt: ISODate("2026-01-15T10:30:00Z")
}
```

Prescription headers and medicine line items remain exclusively in PostgreSQL
(`prescriptions` and `prescription_items`). They must not be added to this
collection.
