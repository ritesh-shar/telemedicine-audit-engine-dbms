import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let data = {};
  if (text) data = JSON.parse(text);
  return { response, data };
}

function cookieFrom(response) {
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "expected authentication cookie");
  return cookie.split(";")[0];
}

async function login(email, password) {
  const { response, data } = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200, JSON.stringify(data));
  return { cookie: cookieFrom(response), user: data.user };
}

const email = `workflow-${Date.now()}@telemed.test`;
const password = "WorkflowPass123!";

let result = await request("/api/appointments");
assert.equal(result.response.status, 401);

result = await request("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fullName: "HTTP Workflow Patient", email, password })
});
assert.equal(result.response.status, 201, JSON.stringify(result.data));

const patient = await login(email, password);
const patientHeaders = { Cookie: patient.cookie };

result = await request("/api/doctors");
assert.equal(result.response.status, 200);
assert.ok(result.data.doctors.length > 0);
const doctor = result.data.doctors.find((item) =>
  item.availability && item.displayName.includes("Aisha Khan")
);
assert.ok(doctor);

const doctorSession = await login("aisha.khan@telemed.test", "DoctorPass123!");
const doctorHeaders = { Cookie: doctorSession.cookie };

result = await request("/api/appointments", { headers: doctorHeaders });
assert.equal(result.response.status, 200, JSON.stringify(result.data));
const occupiedSlots = new Set(
  result.data.appointments
    .filter((appointment) => appointment.doctorId === doctor.doctorId)
    .map((appointment) => new Date(appointment.appointmentTime).toISOString())
);

const fixedSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
];
let appointmentId;

for (let dayOffset = 2; dayOffset <= 14 && !appointmentId; dayOffset++) {
  const appointmentDate = new Date();
  appointmentDate.setUTCDate(appointmentDate.getUTCDate() + dayOffset);
  const date = appointmentDate.toISOString().slice(0, 10);

  for (const slot of fixedSlots) {
    const appointmentTime = `${date}T${slot}:00.000Z`;
    if (occupiedSlots.has(appointmentTime)) continue;

    result = await request("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...patientHeaders },
      body: JSON.stringify({
        doctorId: doctor.doctorId,
        appointmentTime,
        reason: "HTTP workflow test"
      })
    });

    if (result.response.status === 201) {
      appointmentId = result.data.appointment.appointmentId;
      break;
    }
    assert.ok(
      result.response.status === 409,
      `Unexpected booking response: ${result.response.status} ${JSON.stringify(result.data)}`
    );
  }
}

assert.ok(appointmentId, "Could not find an available appointment slot for the doctor");

result = await request("/api/appointments", { headers: doctorHeaders });
assert.equal(result.response.status, 200, JSON.stringify(result.data));

const bookedAppointment = result.data.appointments.find(
  (appointment) => appointment.appointmentId === appointmentId
);
assert.ok(bookedAppointment, "Doctor cannot see the booked workflow appointment");

result = await request(`/api/appointments/${appointmentId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...doctorHeaders },
  body: JSON.stringify({ status: "CONFIRMED" })
});
assert.equal(result.response.status, 200, JSON.stringify(result.data));

result = await request("/api/consultations", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...doctorHeaders },
  body: JSON.stringify({
    appointmentId,
    symptoms: ["Integration workflow"],
    observations: [],
    clinicalNotes: {
      complaints: "Integration test complaint",
      examination: "No abnormal findings",
      assessment: "Workflow test",
      plan: "Monitor"
    }
  })
});
assert.equal(result.response.status, 201, JSON.stringify(result.data));
const consultationId = result.data.consultationId;
assert.ok(consultationId, "consultation response did not include an ID");

result = await request("/api/prescriptions", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...doctorHeaders },
  body: JSON.stringify({
    consultationId,
    instructions: "Integration workflow prescription",
    items: [{
      medicineName: "Workflow medicine",
      dosage: "1 tablet",
      frequency: "Once daily",
      duration: "2 days",
      quantity: 2
    }]
  })
});
assert.equal(result.response.status, 201, JSON.stringify(result.data));

result = await request("/api/prescriptions", { headers: patientHeaders });
assert.equal(result.response.status, 200, JSON.stringify(result.data));
assert.ok(result.data.prescriptions.some((prescription) =>
  prescription.consultationId === consultationId
));

console.log("PASS: live patient-doctor HTTP workflow");
