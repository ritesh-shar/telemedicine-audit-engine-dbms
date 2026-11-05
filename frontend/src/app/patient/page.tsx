
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Pill,
  Plus,
  Stethoscope,
} from "lucide-react";

import PatientNav from "../../patient-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

const statusStyles: Record<string, string> = {
  SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-slate-200 bg-slate-100 text-slate-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AppointmentCard({
  appointment,
}: {
  appointment: Appointment;
}) {
  return (
    <Card className="gap-4 rounded-xl border shadow-none transition-shadow hover:shadow-sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Stethoscope className="size-5" />
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-semibold">
              {appointment.doctorName}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {appointment.doctorSpecialization}
            </p>

            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {formatDateTime(appointment.appointmentTime)}
            </div>
          </div>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "shrink-0 font-medium",
            statusStyles[appointment.status] ??
              "border-border bg-muted text-muted-foreground"
          )}
        >
          {appointment.status}
        </Badge>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}

export default function PatientDashboard() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments"),
      fetch("/api/prescriptions"),
    ])
      .then(async ([appointmentResponse, prescriptionResponse]) => {
        const appointmentData = await appointmentResponse.json();
        const prescriptionData = await prescriptionResponse.json();

        if (!appointmentResponse.ok) {
          throw new Error(
            appointmentData.error ?? "Unable to load appointments."
          );
        }

        if (!prescriptionResponse.ok) {
          throw new Error(
            prescriptionData.error ?? "Unable to load prescriptions."
          );
        }

        setAppointments(appointmentData.appointments ?? []);
        setPrescriptions(prescriptionData.prescriptions ?? []);
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load dashboard information."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const upcoming = appointments.filter(
    (appointment) =>
      new Date(appointment.appointmentTime) >= new Date() &&
      !["CANCELLED", "COMPLETED"].includes(appointment.status)
  );

  const past = appointments.filter(
    (appointment) =>
      new Date(appointment.appointmentTime) < new Date() ||
      ["CANCELLED", "COMPLETED"].includes(appointment.status)
  );

  return (
    <>
      <PatientNav />

      <main className="min-h-screen flex-1 bg-muted/30">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

          {/* Page heading */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">
                Patient portal
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your appointments and prescriptions in one place.
              </p>
            </div>

            <Button onClick={() => (router.push("/doctors"))}>
              <Plus className="size-4" />
              Book appointment
            </Button>
          </div>

          {loading && <DashboardSkeleton />}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Summary cards */}
              <section className="grid gap-4 sm:grid-cols-3">
                <Card className="gap-3 rounded-xl shadow-none">
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">
                        Upcoming appointments
                      </p>
                      <CalendarDays className="size-5 text-primary" />
                    </div>
                    <p className="mt-3 text-3xl font-bold tabular-nums">
                      {upcoming.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Scheduled consultations
                    </p>
                  </CardContent>
                </Card>

                <Card className="gap-3 rounded-xl shadow-none">
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total appointments
                      </p>
                      <Clock3 className="size-5 text-primary" />
                    </div>
                    <p className="mt-3 text-3xl font-bold tabular-nums">
                      {appointments.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Across your consultation history
                    </p>
                  </CardContent>
                </Card>

                <Card className="gap-3 rounded-xl shadow-none">
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">
                        Prescriptions
                      </p>
                      <Pill className="size-5 text-primary" />
                    </div>
                    <p className="mt-3 text-3xl font-bold tabular-nums">
                      {prescriptions.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Issued prescriptions
                    </p>
                  </CardContent>
                </Card>
              </section>

              {/* Main dashboard content */}
              <div className="grid items-start gap-6 lg:grid-cols-5">

                {/* Appointments */}
                <div className="space-y-6 lg:col-span-3">
                  <Card className="rounded-xl shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                      <div>
                        <CardTitle>Upcoming appointments</CardTitle>
                        <CardDescription>
                          Your next scheduled consultations
                        </CardDescription>
                      </div>

                      <Badge variant="secondary">
                        {upcoming.length}
                      </Badge>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {upcoming.length > 0 ? (
                        upcoming.map((appointment) => (
                          <AppointmentCard
                            key={appointment.appointmentId}
                            appointment={appointment}
                          />
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                          <CalendarDays className="mx-auto size-8 text-muted-foreground" />
                          <p className="mt-3 font-medium">
                            No upcoming appointments
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Book a consultation with one of our doctors.
                          </p>
                          <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => (router.push("/doctors"))}
                          >
                            Find a doctor
                            <ArrowRight className="size-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl shadow-none">
                    <CardHeader>
                      <CardTitle>Appointment history</CardTitle>
                      <CardDescription>
                        Your previous and completed appointments
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {past.length > 0 ? (
                        past.map((appointment) => (
                          <AppointmentCard
                            key={appointment.appointmentId}
                            appointment={appointment}
                          />
                        ))
                      ) : (
                        <p className="rounded-lg bg-muted/50 p-5 text-center text-sm text-muted-foreground">
                          No appointment history yet.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Prescriptions */}
                <Card className="rounded-xl shadow-none lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>Prescriptions</CardTitle>
                      <Pill className="size-5 text-primary" />
                    </div>
                    <CardDescription>
                      Medicines and instructions issued to you
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {prescriptions.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-8 text-center">
                        <Pill className="mx-auto size-8 text-muted-foreground" />
                        <p className="mt-3 font-medium">
                          No prescriptions yet
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Your issued prescriptions will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {prescriptions.map((prescription, index) => (
                          <div key={prescription.prescriptionId}>
                            {index > 0 && <Separator className="mb-5" />}

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold">
                                {formatDate(prescription.prescribedAt)}
                              </p>

                              <Badge
                                variant={
                                  prescription.status === "ACTIVE"
                                    ? "outline"
                                    : "secondary"
                                }
                                className={
                                  prescription.status === "ACTIVE"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : ""
                                }
                              >
                                {prescription.status}
                              </Badge>
                            </div>

                            {prescription.instructions && (
                              <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                                {prescription.instructions}
                              </p>
                            )}

                            <div className="mt-4 space-y-3">
                              {prescription.items.map((item, itemIndex) => (
                                <div
                                  key={`${prescription.prescriptionId}-${itemIndex}`}
                                  className="flex gap-3"
                                >
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Pill className="size-4" />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold">
                                      {item.medicineName}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {item.dosage} · {item.frequency}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Duration: {item.duration}
                                      {item.quantity != null &&
                                        ` · Qty: ${item.quantity}`}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
