"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  ExternalLink,
  LoaderCircle,
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

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/appointments", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load appointments.");
        setAppointments(data.appointments ?? []);
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

  const sortedAppointments = useMemo(
    () => [...appointments].sort(
      (a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime()
    ),
    [appointments]
  );

  async function updateAppointmentStatus(
    appointmentId: string,
    status: "CONFIRMED" | "COMPLETED" | "CANCELLED"
  ) {
    setUpdating(appointmentId);
    setError("");

    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update appointment.");

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.appointmentId === appointmentId
            ? { ...appointment, status: data.appointment.status }
            : appointment
        )
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to update appointment.");
    } finally {
      setUpdating("");
    }
  }

  const scheduledCount = appointments.filter((item) => item.status === "SCHEDULED").length;
  const confirmedCount = appointments.filter((item) => item.status === "CONFIRMED").length;
  const completedCount = appointments.filter((item) => item.status === "COMPLETED").length;

  return (
    <AppShell active="appointments">
      <PageIntro
        eyebrow="Appointments"
        title="Your patient schedule"
        description=""
      />

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
          <Skeleton className="h-96 rounded-xl sm:col-span-3" />
        </div>
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card className="rounded-xl shadow-none">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Awaiting confirmation</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{scheduledCount}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-none">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{confirmedCount}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-none">
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{completedCount}</p>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-xl shadow-none">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>All appointments</CardTitle>
                <CardDescription className="mt-1">
                  {appointments.length} appointment{appointments.length === 1 ? "" : "s"} assigned to your account
                </CardDescription>
              </div>
              <Badge variant="secondary">Doctor view</Badge>
            </CardHeader>
            <CardContent>
              {sortedAppointments.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-12 text-center">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarDays className="size-5" />
                  </span>
                  <h3 className="mt-3 font-semibold">No appointments assigned yet</h3>
                  <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                    Patient bookings for the doctor profile linked to this account will appear here. Make sure patients select this doctor when booking.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-3 font-medium">Patient</th>
                        <th className="px-3 py-3 font-medium">Appointment</th>
                        <th className="px-3 py-3 font-medium">Reason</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sortedAppointments.map((appointment) => (
                        <tr key={appointment.appointmentId} className="align-middle">
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <UserRound className="size-4" />
                              </span>
                              <span className="font-medium">{appointment.patientName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-muted-foreground">
                            <span className="flex items-center gap-2">
                              <Clock3 className="size-4" />
                              {formatAppointmentDate(appointment.appointmentTime)}
                            </span>
                          </td>
                          <td className="max-w-56 px-3 py-4 text-muted-foreground">
                            <span className="line-clamp-2">{appointment.reason || "General consultation"}</span>
                          </td>
                          <td className="px-3 py-4">
                            <StatusPill status={appointment.consultationStatus ?? appointment.status} />
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {appointment.consultationId ? (
                                <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/doctor/consultations/${appointment.consultationId}`)}>
                                  <ExternalLink className="size-3.5" /> Open
                                </Button>
                              ) : appointment.status === "CONFIRMED" || appointment.status === "COMPLETED" ? (
                                <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/doctor/consultations/new?appointmentId=${appointment.appointmentId}`)}>
                                  <ClipboardList className="size-3.5" /> Start consultation
                                </Button>
                              ) : null}

                              {appointment.status === "SCHEDULED" && (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={updating === appointment.appointmentId}
                                    onClick={() => updateAppointmentStatus(appointment.appointmentId, "CONFIRMED")}
                                  >
                                    {updating === appointment.appointmentId ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={updating === appointment.appointmentId}
                                    onClick={() => updateAppointmentStatus(appointment.appointmentId, "CANCELLED")}
                                  >
                                    Decline
                                  </Button>
                                </>
                              )}
                              {appointment.status === "CONFIRMED" && !appointment.consultationId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updating === appointment.appointmentId}
                                  onClick={() => updateAppointmentStatus(appointment.appointmentId, "COMPLETED")}
                                >
                                  Mark done
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
