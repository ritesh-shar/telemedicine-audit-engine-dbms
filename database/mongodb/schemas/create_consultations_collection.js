// Run with mongosh against the telemedicine_db database.
// This script is safe to run again: it updates the validator when the
// collection already exists and ensures indexes with the same definitions.

const collectionName = "consultations";

const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "consultationId",
      "appointmentId",
      "patientId",
      "doctorId",
      "symptoms",
      "observations",
      "clinicalNotes",
      "createdAt",
      "updatedAt"
    ],
    properties: {
      _id: {
        bsonType: "objectId",
        description: "MongoDB-generated document identifier"
      },
      consultationId: {
        bsonType: "string",
        description: "PostgreSQL consultations.consultation_id as a string"
      },
      appointmentId: {
        bsonType: "string",
        description: "PostgreSQL appointments.appointment_id as a string"
      },
      patientId: {
        bsonType: "string",
        description: "PostgreSQL patients.patient_id as a string"
      },
      doctorId: {
        bsonType: "string",
        description: "PostgreSQL doctors.doctor_id as a string"
      },
      symptoms: {
        bsonType: "array",
        items: { bsonType: "string" }
      },
      observations: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["name", "value", "unit", "recordedAt"],
          additionalProperties: false,
          properties: {
            name: { bsonType: "string" },
            value: { bsonType: "string" },
            unit: { bsonType: "string" },
            recordedAt: { bsonType: "date" }
          }
        }
      },
      clinicalNotes: {
        bsonType: "object",
        required: ["complaints", "examination", "assessment", "plan"],
        additionalProperties: false,
        properties: {
          complaints: { bsonType: "string" },
          examination: { bsonType: "string" },
          assessment: { bsonType: "string" },
          plan: { bsonType: "string" }
        }
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    },
    additionalProperties: false
  }
};

const collectionExists = db
  .getCollectionInfos({ name: collectionName })
  .length > 0;

if (collectionExists) {
  db.runCommand({
    collMod: collectionName,
    validator,
    validationLevel: "strict",
    validationAction: "error"
  });
} else {
  db.createCollection(collectionName, {
    validator,
    validationLevel: "strict",
    validationAction: "error"
  });
}

const consultations = db.getCollection(collectionName);
consultations.createIndex(
  { consultationId: 1 },
  { name: "uq_consultations_consultation_id", unique: true }
);
consultations.createIndex(
  { appointmentId: 1 },
  { name: "idx_consultations_appointment_id" }
);
consultations.createIndex(
  { patientId: 1 },
  { name: "idx_consultations_patient_id" }
);

print(`Configured ${db.getName()}.${collectionName}`);
