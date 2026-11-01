"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import PatientNav from "../../../patient-nav";
import {
  FIXED_APPOINTMENT_SLOTS,
  formatUtcSlotKey,
  isPastSlot,
  toUtcSlotIso,
} from "../../../lib/appointment-slots";

interface Doctor { doctorId: string; displayName: string; specialization: string; availability: boolean; }
interface Appointment {
  appointmentId: string;
  appointmentTime: string;
  status: string;
  doctorId: string;
}

function BookingPage() {
  const searchParams = useSearchParams();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorId, setDoctorId] = useState(searchParams.get("doctorId") ?? "");
  const [today] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/doctors").then((response) => response.json()),
      fetch("/api/appointments").then((response) => response.json()),
    ]).then(([doctorData, appointmentData]) => {
      setDoctors(doctorData.doctors ?? []);
      setAppointments(appointmentData.appointments ?? []);
    }).catch(() => setError("Unable to load booking information."))
      .finally(() => setLoading(false));
  }, []);

  const bookedSlots = useMemo(() => new Set(
    appointments
      .filter((appointment) => appointment.doctorId === doctorId && !["CANCELLED"].includes(appointment.status))
      .map((appointment) => formatUtcSlotKey(appointment.appointmentTime))
  ), [appointments, doctorId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!doctorId || !slot) {
      setError("Choose a doctor and appointment slot.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          appointmentTime: toUtcSlotIso(date, slot),
          reason: reason.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to book appointment.");
      setMessage("Appointment booked successfully.");
      setReason("");
      setSlot("");
      setAppointments((current) => [
        ...current,
        {
          appointmentId: data.appointment.appointmentId,
          appointmentTime: data.appointment.appointmentTime,
          status: data.appointment.status,
          doctorId,
        },
      ]);
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "Unable to book appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PatientNav />
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-bold">Book an appointment</h1>
        <p className="mt-2 text-slate-600">Choose one of the fixed consultation slots below.</p>
        <form onSubmit={handleSubmit} className="mt-8 grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <label htmlFor="doctor" className="mb-1.5 block text-sm font-semibold">Doctor</label>
              <select id="doctor" value={doctorId} onChange={(event) => { setDoctorId(event.target.value); setSlot(""); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3">
                <option value="">Select a doctor</option>
                {doctors.filter((doctor) => doctor.availability).map((doctor) => (
                  <option key={doctor.doctorId} value={doctor.doctorId}>{doctor.displayName} - {doctor.specialization}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="date" className="mb-1.5 block text-sm font-semibold">Date</label>
              <input id="date" type="date" min={today} value={date}
                onChange={(event) => { setDate(event.target.value); setSlot(""); }}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-3" />
            </div>
            <div>
              <label htmlFor="reason" className="mb-1.5 block text-sm font-semibold">Reason for visit (optional)</label>
              <textarea id="reason" rows={5} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-3" placeholder="Briefly describe your symptoms" />
            </div>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Available fixed slots</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {FIXED_APPOINTMENT_SLOTS.map((fixedSlot) => {
                const key = `${date}T${fixedSlot}`;
                const unavailable = isPastSlot(date, fixedSlot) || bookedSlots.has(key) || !doctorId;
                return (
                  <button key={fixedSlot} type="button" disabled={unavailable} onClick={() => setSlot(fixedSlot)}
                    className={`rounded-lg border px-2 py-3 text-sm font-semibold ${slot === fixedSlot ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 hover:border-teal-600"} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}>
                    {fixedSlot}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="lg:col-span-2">
            {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {message && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
            <button disabled={loading || submitting || !slot} className="rounded-lg bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {submitting ? "Booking..." : "Confirm appointment"}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

export default function AppointmentsPage() {
  return <Suspense fallback={<p className="p-8 text-slate-500">Loading booking form...</p>}><BookingPage /></Suspense>;
}
