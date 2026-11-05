"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Stethoscope,
  UserRound,
} from "lucide-react";

import PatientNav from "../../../patient-nav";
import {
  FIXED_APPOINTMENT_SLOTS,
  isPastSlot,
  toUtcSlotIso,
} from "../../../lib/appointment-slots";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface Doctor {
  doctorId: string;
  displayName: string;
  specialization: string;
  availability: boolean;
}

interface AvailabilityResponse {
  doctorId: string;
  date: string;
  bookedSlots: string[];
  error?: string;
}

type AvailabilityState =
  | {
      requestKey: string;
      status: "success";
      bookedSlots: string[];
    }
  | {
      requestKey: string;
      status: "error";
      message: string;
    };

function formatDisplayDate(value: string) {
  if (!value) return "Not selected";

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function BookingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="h-[420px] rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}

function BookingPage({ initialDoctorId }: { initialDoctorId: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availabilityState, setAvailabilityState] =
    useState<AvailabilityState | null>(null);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);

  const [doctorId, setDoctorId] = useState(initialDoctorId);

  const [today] = useState(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  });

  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load the public doctor directory once. Availability is fetched separately.
  useEffect(() => {
    const controller = new AbortController();

    async function loadDoctors() {
      try {
        const response = await fetch("/api/doctors", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load doctors.");
        }

        setDoctors(data.doctors ?? []);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error ? reason.message : "Unable to load doctors."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDoctors();
    return () => controller.abort();
  }, []);

  // A different key means the requested doctor/date/refresh has not returned yet.
  const availabilityRequestKey = doctorId
    ? `${doctorId}|${date}|${availabilityRefresh}`
    : "";

  const currentAvailability =
    availabilityState?.requestKey === availabilityRequestKey
      ? availabilityState
      : null;

  const availabilityLoading =
    Boolean(doctorId) && !loading && currentAvailability === null;

  const availabilityError =
    currentAvailability?.status === "error"
      ? currentAvailability.message
      : "";

  const bookedSlots = useMemo(
    () =>
      currentAvailability?.status === "success"
        ? new Set(currentAvailability.bookedSlots)
        : new Set<string>(),
    [currentAvailability]
  );

  // Query PostgreSQL-backed availability whenever doctor/date changes.
  // No synchronous state reset is needed: a mismatched request key derives
  // the loading state until this request returns.
  useEffect(() => {
    if (loading || !doctorId) return;

    const controller = new AbortController();

    async function loadAvailability() {
      try {
        const response = await fetch(
          `/api/doctors/${encodeURIComponent(doctorId)}/availability?date=${encodeURIComponent(date)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const data = (await response.json()) as AvailabilityResponse;

        if (!response.ok) {
          throw new Error(
            data.error ?? "Unable to check available appointment slots."
          );
        }

        if (!Array.isArray(data.bookedSlots)) {
          throw new Error("The availability response was invalid.");
        }

        setAvailabilityState({
          requestKey: availabilityRequestKey,
          status: "success",
          bookedSlots: data.bookedSlots,
        });
      } catch (reason) {
        if (controller.signal.aborted) return;

        setAvailabilityState({
          requestKey: availabilityRequestKey,
          status: "error",
          message:
            reason instanceof Error
              ? reason.message
              : "Unable to check available appointment slots.",
        });
      }
    }

    void loadAvailability();
    return () => controller.abort();
  }, [
    doctorId,
    date,
    loading,
    availabilityRefresh,
    availabilityRequestKey,
  ]);

  const selectedDoctor = doctors.find(
    (doctor) => doctor.doctorId === doctorId
  );

  const availableSlots = useMemo(() => {
    if (
      !doctorId ||
      availabilityLoading ||
      availabilityError ||
      currentAvailability?.status !== "success"
    ) {
      return [];
    }

    return FIXED_APPOINTMENT_SLOTS.filter(
      (fixedSlot) =>
        !isPastSlot(date, fixedSlot) &&
        !bookedSlots.has(`${date}T${fixedSlot}`)
    );
  }, [
    doctorId,
    date,
    bookedSlots,
    availabilityLoading,
    availabilityError,
    currentAvailability,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!doctorId || !slot) {
      setError("Choose a doctor and appointment slot.");
      return;
    }

    if (availabilityLoading || availabilityError) {
      setError("Wait for appointment availability to finish loading.");
      return;
    }

    const slotIsAvailable = availableSlots.includes(
      slot as (typeof FIXED_APPOINTMENT_SLOTS)[number]
    );

    if (!slotIsAvailable) {
      setError(
        "This appointment slot is no longer available. Choose another slot."
      );
      setSlot("");
      setAvailabilityRefresh((current) => current + 1);
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

      if (!response.ok) {
        if (response.status === 409) {
          setSlot("");
          setAvailabilityRefresh((current) => current + 1);
        }

        throw new Error(data.error ?? "Unable to book appointment.");
      }

      setMessage("Your appointment has been booked successfully!");
      setReason("");
      setSlot("");
      setAvailabilityRefresh((current) => current + 1);
    } catch (reasonError) {
      setError(
        reasonError instanceof Error
          ? reasonError.message
          : "Unable to book appointment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PatientNav />

      <main className="min-h-screen flex-1 bg-muted/30">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          <section>
            <Badge variant="secondary" className="gap-1.5">
              <CalendarDays className="size-3.5" />
              Appointment scheduling
            </Badge>

            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Book a consultation
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Choose your specialist, select a convenient time, and confirm your
              appointment.
            </p>
          </section>

          {loading ? (
            <BookingSkeleton />
          ) : error && doctors.length === 0 ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid items-start gap-6 lg:grid-cols-5">
                <Card className="rounded-xl shadow-none lg:col-span-2">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <UserRound className="size-5" />
                    </div>
                    <CardTitle>Consultation details</CardTitle>
                    <CardDescription>
                      Select your doctor and provide the appointment details.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="doctor">Choose doctor</Label>
                      <select
                        id="doctor"
                        value={doctorId}
                        required
                        onChange={(event) => {
                          setDoctorId(event.target.value);
                          setSlot("");
                          setMessage("");
                          setError("");
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <option value="">Select a doctor</option>
                        {doctors
                          .filter((doctor) => doctor.availability)
                          .map((doctor) => (
                            <option key={doctor.doctorId} value={doctor.doctorId}>
                              {doctor.displayName} — {doctor.specialization}
                            </option>
                          ))}
                      </select>

                      {selectedDoctor && (
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Stethoscope className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {selectedDoctor.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {selectedDoctor.specialization}
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-auto shrink-0">
                            Selected
                          </Badge>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="date">Appointment date</Label>
                      <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="date"
                          type="date"
                          min={today}
                          value={date}
                          required
                          onChange={(event) => {
                            setDate(event.target.value);
                            setSlot("");
                            setError("");
                            setMessage("");
                          }}
                          className="pl-9 scheme-light"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">
                        Reason for visit
                        <span className="ml-1 font-normal text-muted-foreground">
                          (Optional)
                        </span>
                      </Label>
                      <Textarea
                        id="reason"
                        rows={5}
                        maxLength={1000}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Briefly describe your symptoms or reason for consultation..."
                        className="resize-none"
                      />
                      <p className="text-right text-xs text-muted-foreground">
                        {reason.length}/1000 characters
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl shadow-none lg:col-span-3">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Clock3 className="size-5" />
                    </div>
                    <CardTitle>Choose a time slot</CardTitle>
                    <CardDescription>{formatDisplayDate(date)}</CardDescription>

                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-primary" />
                        Selected
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full border border-border bg-background" />
                        Available
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-muted" />
                        Unavailable
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {!doctorId ? (
                      <div className="rounded-xl border border-dashed p-10 text-center">
                        <UserRound className="mx-auto size-8 text-muted-foreground" />
                        <p className="mt-3 font-medium">Select a doctor first</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Available consultation slots will appear here.
                        </p>
                      </div>
                    ) : (
                      <>
                        {availabilityLoading && (
                          <div
                            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
                            role="status"
                          >
                            <LoaderCircle className="size-4 animate-spin" />
                            Checking live availability...
                          </div>
                        )}

                        {availabilityError && (
                          <div
                            role="alert"
                            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                          >
                            {availabilityError}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {FIXED_APPOINTMENT_SLOTS.map((fixedSlot) => {
                            const key = `${date}T${fixedSlot}`;
                            const isBooked = bookedSlots.has(key);
                            const isPast = isPastSlot(date, fixedSlot);
                            const unavailable = isBooked || isPast;
                            const disabled =
                              availabilityLoading ||
                              Boolean(availabilityError) ||
                              unavailable;

                            return (
                              <Button
                                key={fixedSlot}
                                type="button"
                                variant={slot === fixedSlot ? "default" : "outline"}
                                disabled={disabled}
                                aria-pressed={slot === fixedSlot}
                                onClick={() => {
                                  setSlot(fixedSlot);
                                  setError("");
                                  setMessage("");
                                }}
                                className="h-12 justify-center font-semibold tabular-nums"
                              >
                                {fixedSlot}
                              </Button>
                            );
                          })}
                        </div>

                        {!availabilityLoading &&
                          !availabilityError &&
                          availableSlots.length === 0 && (
                            <p className="mt-4 rounded-lg bg-muted/50 p-3 text-center text-sm text-muted-foreground">
                              No appointment slots are available for this date.
                              Choose another date.
                            </p>
                          )}

                        <div className="mt-5 flex items-center justify-between border-t pt-4">
                          <span className="text-sm text-muted-foreground">
                            {availabilityLoading
                              ? "Checking available slots"
                              : "Available slots"}
                          </span>
                          <Badge variant="secondary">
                            {availabilityLoading || availabilityError
                              ? "—"
                              : `${availableSlots.length} / ${FIXED_APPOINTMENT_SLOTS.length}`}
                          </Badge>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-xl shadow-none">
                <CardContent className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Booking summary</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <UserRound className="size-4" />
                        {selectedDoctor?.displayName ?? "No doctor selected"}
                      </span>
                      <span className="flex items-center gap-2">
                        <CalendarDays className="size-4" />
                        {formatDisplayDate(date)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock3 className="size-4" />
                        {slot || "No time selected"}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      !doctorId ||
                      !slot ||
                      availabilityLoading ||
                      Boolean(availabilityError) ||
                      !availableSlots.includes(
                        slot as (typeof FIXED_APPOINTMENT_SLOTS)[number]
                      )
                    }
                    className="min-w-48"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      <>
                        Confirm appointment
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                >
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Appointment confirmed</p>
                    <p className="mt-1">{message}</p>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </main>
    </>
  );
}

function BookingPageWithSearchParams() {
  const searchParams = useSearchParams();
  const initialDoctorId = searchParams.get("doctorId") ?? "";

  // Remount the booking form when the URL's doctorId changes, rather than
  // copying the query parameter into state from an effect.
  return (
    <BookingPage
      key={initialDoctorId}
      initialDoctorId={initialDoctorId}
    />
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-6 h-96 rounded-xl" />
        </div>
      }
    >
      <BookingPageWithSearchParams />
    </Suspense>
  );
}
