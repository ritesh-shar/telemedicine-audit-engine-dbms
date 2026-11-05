"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Stethoscope,
  UserRound,
} from "lucide-react";

import {
  AppShell,
  ErrorMessage,
  PageIntro,
  StatusPill,
} from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatAppointmentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof CalendarDays;
}) {
  return (
    <Card className="rounded-xl shadow-none">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/appointments", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load appointments.");
        setAppointments(data.appointments ?? []);
        // Capture the reference time after the asynchronous response arrives.
        setLoadedAt(Date.now());
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Unable to load appointments.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const upcoming = useMemo(() => {
    if (loadedAt === null) return [];

    return appointments
      .filter(
        (appointment) =>
          ["SCHEDULED", "CONFIRMED"].includes(appointment.status) &&
          new Date(appointment.appointmentTime).getTime() >= loadedAt
      )
      .sort(
        (a, b) =>
          new Date(a.appointmentTime).getTime() -
          new Date(b.appointmentTime).getTime()
      )
      .slice(0, 5);
  }, [appointments, loadedAt]);

  const completedCount = appointments.filter(
    (appointment) => appointment.consultationStatus === "COMPLETED" || appointment.status === "COMPLETED"
  ).length;

  const needsAttentionCount = appointments.filter(
    (appointment) => appointment.status === "SCHEDULED"
  ).length;

  return (
    <AppShell active="dashboard">
      <PageIntro
        eyebrow="Doctor workspace"
        title="Your clinical dashboard"
        description=""
      />

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <DashboardLoading />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Assigned appointments"
              value={appointments.length}
              hint="Appointments assigned to your account"
              icon={CalendarDays}
            />
            <MetricCard
              label="Completed consultations"
              value={completedCount}
              hint="Consultations marked as completed"
              icon={CheckCircle2}
            />
            <MetricCard
              label="Awaiting confirmation"
              value={needsAttentionCount}
              hint="Scheduled appointments to review"
              icon={ClipboardList}
            />
          </section>

          <Card className="mt-6 rounded-xl shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Your upcoming schedule</CardTitle>
                <CardDescription className="mt-1">
                  Your next assigned patient appointments.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => router.push("/doctor/appointments")}>
                View all <ArrowRight className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarDays className="size-5" />
                  </span>
                  <h3 className="mt-3 font-semibold">Your schedule is clear</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    No upcoming appointments are currently assigned to this doctor account. New patient bookings will appear here.
                  </p>
                  <Button type="button" variant="outline" className="mt-4" onClick={() => router.push("/doctor/appointments")}>
                    Open appointments
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((appointment) => (
                    <div
                      key={appointment.appointmentId}
                      className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <UserRound className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">{appointment.patientName}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock3 className="size-3.5" />
                            {formatAppointmentDate(appointment.appointmentTime)}
                          </p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {appointment.reason || "General consultation"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <StatusPill status={appointment.status} />
                        {appointment.consultationId ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/doctor/consultations/${appointment.consultationId}`)}>
                            Open consultation
                          </Button>
                        ) : appointment.status === "CONFIRMED" ? (
                          <Button type="button" size="sm" onClick={() => router.push(`/doctor/consultations/new?appointmentId=${appointment.appointmentId}`)}>
                            Start consultation
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 flex items-start gap-3 rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              Appointment records are scoped to the signed-in doctor by the server. If you expected to see a booking here, verify that the patient booked the doctor profile associated with this account.
            </p>
            <Badge variant="secondary" className="ml-auto hidden shrink-0 sm:inline-flex">Doctor-only view</Badge>
          </div>
        </>
      )}
    </AppShell>
  );
}
