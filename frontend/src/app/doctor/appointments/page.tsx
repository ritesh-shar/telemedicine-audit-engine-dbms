"use client";

import { useEffect, useState } from "react";

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

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState("");

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

  async function updateAppointmentStatus(appointmentId: string, status: "CONFIRMED" | "COMPLETED") {
    setUpdating(appointmentId);
    setError("");
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update appointment.");
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.appointmentId === appointmentId
            ? { ...appointment, status }
            : appointment
        )
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to update appointment.");
    } finally {
      setUpdating("");
    }
  }

  return (
    <AppShell active="appointments">
      <PageIntro
        eyebrow="Appointments"
        title="Your complete schedule"
        description="Every appointment is loaded through the authenticated server API and scoped to the signed-in doctor."
      />
      {error && <ErrorMessage message={error} />}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Appointment</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {appointments.map((appointment) => (
                <tr key={appointment.appointmentId}>
                  <td className="px-6 py-4 font-medium text-white">{appointment.patientName}</td>
                  <td className="px-6 py-4 text-slate-300">{new Date(appointment.appointmentTime).toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-400">{appointment.reason ?? "General consultation"}</td>
                  <td className="px-6 py-4"><StatusPill status={appointment.consultationStatus ?? appointment.status} /></td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-4">
                      {(appointment.status === "CONFIRMED" || appointment.status === "COMPLETED" || appointment.consultationId) && (
                        <a className="text-cyan-400 hover:text-cyan-300" href={appointment.consultationId ? `/doctor/consultations/${appointment.consultationId}` : `/doctor/consultations/new?appointmentId=${appointment.appointmentId}`}>
                          {appointment.consultationId ? "Open consultation" : "Start consultation"}
                        </a>
                      )}
                      {appointment.status === "SCHEDULED" && (
                        <button
                          type="button"
                          disabled={updating === appointment.appointmentId}
                          onClick={() => updateAppointmentStatus(appointment.appointmentId, "CONFIRMED")}
                          className="text-sm font-medium text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
                        >
                          {updating === appointment.appointmentId ? "Saving..." : "Confirm"}
                        </button>
                      )}
                      {appointment.status === "CONFIRMED" && (
                        <button
                          type="button"
                          disabled={updating === appointment.appointmentId}
                          onClick={() => updateAppointmentStatus(appointment.appointmentId, "COMPLETED")}
                          className="text-sm font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                        >
                          {updating === appointment.appointmentId ? "Saving..." : "Mark done"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!appointments.length && !error && <p className="px-6 py-10 text-center text-sm text-slate-400">No appointments found.</p>}
      </div>
    </AppShell>
  );
}
