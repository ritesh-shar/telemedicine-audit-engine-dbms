// Run with:
// mongosh "$MONGODB_URI/$MONGODB_DB" database/mongodb/tests/consultations_smoke_test.js
//
// The schema setup script must be run before this test.

const collection = db.getCollection("consultations");
const prefix = `test-${new ObjectId().toHexString()}`;
const now = new Date();
const validDocument = {
  consultationId: `${prefix}-consultation`,
  appointmentId: `${prefix}-appointment`,
  patientId: `${prefix}-patient`,
  doctorId: `${prefix}-doctor`,
  symptoms: ["headache"],
  observations: [
    {
      name: "temperature",
      value: "36.8",
      unit: "C",
      recordedAt: now
    }
  ],
  clinicalNotes: {
    complaints: "Headache",
    examination: "No acute findings",
    assessment: "Tension headache",
    plan: "Rest and hydration"
  },
  createdAt: now,
  updatedAt: now
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  print(`PASS: ${message}`);
}

collection.deleteMany({ consultationId: validDocument.consultationId });

try {
  const missingRequiredField = {
    consultationId: validDocument.consultationId,
    appointmentId: validDocument.appointmentId,
    patientId: validDocument.patientId,
    doctorId: validDocument.doctorId,
    observations: validDocument.observations,
    clinicalNotes: validDocument.clinicalNotes,
    createdAt: validDocument.createdAt,
    updatedAt: validDocument.updatedAt
  };
  assertThrows(
    () => collection.insertOne(missingRequiredField),
    "validator rejects a missing required field"
  );

  const incorrectTypeDocument = {
    consultationId: 123,
    appointmentId: validDocument.appointmentId,
    patientId: validDocument.patientId,
    doctorId: validDocument.doctorId,
    symptoms: validDocument.symptoms,
    observations: validDocument.observations,
    clinicalNotes: validDocument.clinicalNotes,
    createdAt: validDocument.createdAt,
    updatedAt: validDocument.updatedAt
  };
  assertThrows(
    () => collection.insertOne(incorrectTypeDocument),
    "validator rejects an incorrectly typed required field"
  );

  collection.insertOne(validDocument);
  assert(
    collection.countDocuments({ consultationId: validDocument.consultationId }) === 1,
    "valid consultation document can be inserted"
  );

  assertThrows(
    () => collection.insertOne(validDocument),
    "unique consultationId index rejects a duplicate"
  );

  const found = collection.findOne({
    consultationId: validDocument.consultationId
  });
  assert(found !== null, "consultation document can be retrieved by consultation ID");
  assert(
    found.appointmentId === validDocument.appointmentId,
    "retrieved consultation retains its appointment ID"
  );
  assert(
    found.patientId === validDocument.patientId &&
      found.doctorId === validDocument.doctorId,
    "retrieved consultation retains its patient and doctor ownership IDs"
  );

  const conflictingOwnershipDocument = {
    ...validDocument,
    appointmentId: `${prefix}-other-appointment`,
    patientId: `${prefix}-other-patient`,
    doctorId: `${prefix}-other-doctor`
  };
  assertThrows(
    () => collection.insertOne(conflictingOwnershipDocument),
    "unique consultationId prevents conflicting ownership documents"
  );
} finally {
  collection.deleteMany({ consultationId: validDocument.consultationId });
}

function assertThrows(operation, message) {
  let threw = false;
  try {
    operation();
  } catch (error) {
    threw = true;
  }
  assert(threw, message);
}

print("MongoDB consultation smoke tests completed.");
