
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Stethoscope,
  CalendarDays,
  ArrowRight,
  Users,
} from "lucide-react";

import PatientNav from "../../patient-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Doctor {
  doctorId: string;
  displayName: string;
  specialization: string;
  qualification: string;
  fee: number;
  availability: boolean;
}

function DoctorSkeleton() {
  return (
    <Card className="rounded-xl shadow-none">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  );
}

export default function DoctorsPage() {
  const router = useRouter();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/doctors")
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load doctors.");
        }

        setDoctors(data.doctors ?? []);
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load doctors."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return doctors;

    return doctors.filter((doctor) =>
      [
        doctor.displayName,
        doctor.specialization,
        doctor.qualification,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [doctors, search]);

  const availableCount = doctors.filter(
    (doctor) => doctor.availability
  ).length;

  return (
    <>
      <PatientNav />

      <main className="min-h-screen flex-1 bg-muted/30">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

          {/* Heading */}
          <section className="space-y-3">
            <Badge variant="secondary" className="gap-1.5">
              <Stethoscope className="size-3.5" />
              Our care team
            </Badge>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Find your doctor
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Explore our specialists and find the right
                  healthcare professional for your consultation.
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                {doctors.length} registered doctors
              </div>
            </div>
          </section>

          {/* Search and availability summary */}
          <section className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-xl shadow-none sm:col-span-2">
              <CardContent className="space-y-2">
                <label
                  htmlFor="doctor-search"
                  className="text-sm font-semibold"
                >
                  Search specialists
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="doctor-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Name, specialization, or qualification..."
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-none">
              <CardContent>
                <p className="text-sm font-medium text-muted-foreground">
                  Currently available
                </p>

                <p className="mt-2 text-3xl font-bold tabular-nums">
                  {loading ? "—" : availableCount}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Out of {loading ? "..." : doctors.length} doctors
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Loading */}
          {loading && (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <DoctorSkeleton key={index} />
              ))}
            </section>
          )}

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {/* Doctor cards */}
          {!loading && !error && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">
                  {search ? "Search results" : "Available specialists"}
                </h2>

                <p className="text-sm text-muted-foreground">
                  {filteredDoctors.length} result(s)
                </p>
              </div>

              {filteredDoctors.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredDoctors.map((doctor) => (
                    <Card
                      key={doctor.doctorId}
                      className="gap-5 rounded-xl shadow-none transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <Avatar className="size-14 rounded-xl">
                            <AvatarFallback className="rounded-xl bg-primary/10 text-lg font-semibold text-primary">
                              {doctor.displayName
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <Badge
                            variant="outline"
                            className={
                              doctor.availability
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {doctor.availability
                              ? "Available"
                              : "Unavailable"}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {doctor.displayName}
                          </CardTitle>

                          <CardDescription className="font-medium text-primary">
                            {doctor.specialization}
                          </CardDescription>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {doctor.qualification}
                        </p>

                        <div className="flex items-center justify-between border-t pt-4">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Consultation fee
                            </p>
                            <p className="mt-1 text-xl font-bold">
                              ₹{doctor.fee.toFixed(2)}
                            </p>
                          </div>

                          <CalendarDays className="size-5 text-muted-foreground" />
                        </div>
                      </CardContent>

                      <CardFooter>
                        <Button
                          className="w-full"
                          disabled={!doctor.availability}
                          onClick={() =>
                            router.push(
                              `/patient/appointments?doctorId=${encodeURIComponent(doctor.doctorId)}`
                            )
                          }
                        >
                          Book appointment
                          <ArrowRight className="size-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-background p-10 text-center">
                  <Search className="mx-auto size-8 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">
                    No doctors found
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try another name or specialization.
                  </p>

                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
