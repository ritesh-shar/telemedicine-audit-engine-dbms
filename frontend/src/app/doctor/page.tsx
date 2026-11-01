"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  AppShell,
  ErrorMessage,
  PageIntro,
  StatusPill
} from "@/components/app-shell";

interface Appointment {
  appointmentId: string;
  appointmentTime: string;
  status: string;
  reason: string | null;
  patientName: string;
  doctorName: string;
  consultationId: string | null;
  consultationStatus: string | null;
}

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/appointments")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load appointments.");
        setAppointments(data.appointments);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load appointments.")
      );
  }, []);

  const upcoming = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status !== "CANCELLED")
        .slice(0, 5),
    [appointments]
  );
  const completed = appointments.filter(
    (appointment) => appointment.consultationStatus === "COMPLETED"
  ).length;

  return (
    <AppShell active="dashboard">
      <PageIntro
        eyebrow="Doctor workspace"
        title="Good morning, doctor."
        description="Review your assigned appointments, open a consultation workspace, and keep each patient record moving."
      />
      {error && <ErrorMessage message={error} />}
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Assigned appointments" value={appointments.length} />
        <Metric label="Consultations completed" value={completed} />
        <Metric
          label="Needs attention"
          value={appointments.filter((a) => !a.consultationId && a.status !== "CANCELLED").length}
        />
      </section>
      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Your schedule</h2>
            <p className="text-sm text-slate-400">The next appointments assigned to you.</p>
          </div>
          <Link className="text-sm font-medium text-cyan-400 hover:text-cyan-300" href="/doctor/appointments">
            View all
          </Link>
        </div>
        <AppointmentList appointments={upcoming} />
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function AppointmentList({ appointments }: { appointments: Appointment[] }) {
  if (!appointments.length) {
    return <p className="rounded-xl bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">No appointments found.</p>;
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <div key={appointment.appointmentId} className="flex flex-col gap-4 rounded-xl bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-white">{appointment.patientName}</p>
            <p className="mt-1 text-sm text-slate-400">
              {new Date(appointment.appointmentTime).toLocaleString()} · {appointment.reason ?? "General consultation"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={appointment.consultationStatus ?? appointment.status} />
            {appointment.consultationId ? (
              <Link className="text-sm font-medium text-cyan-400 hover:text-cyan-300" href={`/doctor/consultations/${appointment.consultationId}`}>
                Open
              </Link>
            ) : (
              <Link className="text-sm font-medium text-cyan-400 hover:text-cyan-300" href={`/doctor/consultations/new?appointmentId=${appointment.appointmentId}`}>
                Start
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
