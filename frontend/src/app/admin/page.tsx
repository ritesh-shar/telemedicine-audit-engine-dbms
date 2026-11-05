"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";

import { AppShell, ErrorMessage, PageIntro } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminStats {
  total_users: number;
  total_patients: number;
  total_doctors: number;
  available_doctors: number;
  total_appointments: number;
  scheduled_appointments: number;
  confirmed_appointments: number;
  completed_appointments: number;
  total_prescriptions: number;
  active_prescriptions: number;
}

const statCards = [
  { key: "total_users", label: "User accounts", icon: Users, hint: "All registered accounts" },
  { key: "total_patients", label: "Patients", icon: HeartPulse, hint: "Patient profiles" },
  { key: "total_doctors", label: "Doctors", icon: Stethoscope, hint: "Provisioned doctor profiles" },
  { key: "available_doctors", label: "Available doctors", icon: Activity, hint: "Currently accepting bookings" },
  { key: "total_appointments", label: "Appointments", icon: CalendarDays, hint: "All appointment records" },
  { key: "scheduled_appointments", label: "Awaiting confirmation", icon: ClipboardList, hint: "Scheduled appointments" },
  { key: "confirmed_appointments", label: "Confirmed", icon: CalendarDays, hint: "Accepted by doctors" },
  { key: "completed_appointments", label: "Completed", icon: ShieldCheck, hint: "Completed appointment records" },
  { key: "total_prescriptions", label: "Prescriptions", icon: FileText, hint: "All issued prescriptions" },
  { key: "active_prescriptions", label: "Active prescriptions", icon: FileText, hint: "Not revoked" },
] as const;

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOverview() {
      try {
        const response = await fetch("/api/admin/overview", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load admin overview.");
        setStats(data.stats as AdminStats);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Unable to load admin overview.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadOverview();
    return () => controller.abort();
  }, []);

  return (
    <AppShell active="admin">
      <PageIntro
        eyebrow="Administration"
        title="System overview"
        description=""
      />

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map(({ key, label, icon: Icon, hint }) => (
            <Card key={key} className="rounded-xl shadow-none">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-bold tabular-nums">
                  {stats[key].toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <CardTitle>Audit and accountability</CardTitle>
            </div>
            <CardDescription>
              Inspect database changes with the recorded actor, entity, timestamp, and before/after values.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="secondary">Admin-only</Badge>
            <Link
              href="/admin/audit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open audit trail
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <CardTitle>Account provisioning</CardTitle>
            </div>
            <CardDescription>
              Patient accounts are self-registered. Doctor and administrator accounts are provisioned through trusted setup scripts, not public registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Do not promote a public patient account to ADMIN from the browser. Use the administrator provisioning script for role-controlled account creation.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
