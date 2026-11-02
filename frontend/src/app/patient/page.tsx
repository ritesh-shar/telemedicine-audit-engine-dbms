"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PatientNav from "../../patient-nav";

interface Appointment {
  appointmentId: string;
  appointmentTime: string;
  status: string;
  doctorName: string;
  doctorSpecialization: string;
}

interface Prescription {
  prescriptionId: string;
  consultationId: string;
  prescribedAt: string;
  instructions: string | null;
  status: "ACTIVE" | "REVOKED";
  items: Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number | null;
  }>;
}

const statusStyle: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  CONFIRMED: "bg-teal-50 text-teal-700",
  COMPLETED: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments"),
      fetch("/api/prescriptions"),
    ])
      .then(async ([appointmentResponse, prescriptionResponse]) => {
        const appointmentData = await appointmentResponse.json();
        const prescriptionData = await prescriptionResponse.json();
        if (!appointmentResponse.ok) {
          throw new Error(appointmentData.error ?? "Unable to load appointments.");
        }
        if (!prescriptionResponse.ok) {
          throw new Error(prescriptionData.error ?? "Unable to load prescriptions.");
        }
        setAppointments(appointmentData.appointments ?? []);
        setPrescriptions(prescriptionData.prescriptions ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load appointments."))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = appointments.filter((appointment) =>
    new Date(appointment.appointmentTime) >= new Date() && !["CANCELLED", "COMPLETED"].includes(appointment.status));
  const past = appointments.filter((appointment) =>
    new Date(appointment.appointmentTime) < new Date() || ["CANCELLED", "COMPLETED"].includes(appointment.status));

  function appointmentCard(appointment: Appointment) {
    return (
      <article key={appointment.appointmentId} className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{appointment.doctorName}</h3>
            <p className="mt-1 text-sm text-teal-700">{appointment.doctorSpecialization}</p>
            <p className="mt-3 text-sm text-slate-600">
              {new Date(appointment.appointmentTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[appointment.status] ?? "bg-slate-100 text-slate-700"}`}>
            {appointment.status}
          </span>
        </div>
      </article>
    );
  }

  return (
    <>
      <PatientNav />
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">Patient dashboard</p>
            <h1 className="mt-2 text-3xl font-bold">Your consultations</h1>
          </div>
          <Link href="/doctors" className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
            Book appointment
          </Link>
        </div>

        {loading && <p className="mt-8 text-slate-500">Loading appointments...</p>}
        {error && <p role="alert" className="mt-8 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}

        {!loading && !error && (
          <div className="mt-8 grid gap-8 lg:grid-cols-5">
            <div className="space-y-8 lg:col-span-3">
              <section>
                <h2 className="mb-4 text-xl font-bold">Upcoming appointments</h2>
                <div className="space-y-3">{upcoming.length ? upcoming.map(appointmentCard) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No upcoming appointments.</p>}</div>
              </section>
              <section>
                <h2 className="mb-4 text-xl font-bold">Past appointments</h2>
                <div className="space-y-3">{past.length ? past.map(appointmentCard) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No past appointments.</p>}</div>
              </section>
            </div>
            <aside className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-xl font-bold">Prescriptions</h2>
                {prescriptions.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">No prescriptions have been issued yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {prescriptions.map((prescription) => (
                      <article key={prescription.prescriptionId} className="rounded-xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">
                            {new Date(prescription.prescribedAt).toLocaleDateString()}
                          </p>
                          <span className="text-xs font-semibold text-teal-700">{prescription.status}</span>
                        </div>
                        {prescription.instructions && (
                          <p className="mt-2 text-sm text-slate-600">{prescription.instructions}</p>
                        )}
                        <ul className="mt-3 space-y-1 text-sm text-slate-700">
                          {prescription.items.map((item, index) => (
                            <li key={`${prescription.prescriptionId}-${index}`}>
                              {item.medicineName} - {item.dosage}, {item.frequency}, {item.duration}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
