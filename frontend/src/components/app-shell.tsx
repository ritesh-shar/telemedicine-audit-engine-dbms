"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppShellSection = "dashboard" | "appointments" | "admin" | "admin-audit";

export function AppShell({
  children,
  active,
}: {
  children: ReactNode;
  active: AppShellSection;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const isAdminSection = active === "admin" || active === "admin-audit";
  const homeHref = isAdminSection ? "/admin" : "/doctor";
  const navigation = isAdminSection
    ? [
        { href: "/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/audit", label: "Audit trail", icon: ShieldCheck },
      ]
    : [
        { href: "/doctor", label: "Dashboard", icon: LayoutDashboard },
        {
          href: "/doctor/appointments",
          label: "Appointments",
          icon: CalendarDays,
        },
      ];

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out.");
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("Sign out failed. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={homeHref} className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HeartPulse className="size-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">TeleMed</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {isAdminSection ? "Administrator" : "Doctor"}
            </Badge>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Doctor navigation">
            {navigation.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/doctor" && href !== "/admin" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <Button variant="outline" size="sm" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{loggingOut ? "Signing out..." : "Sign out"}</span>
          </Button>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden" aria-label="Mobile doctor navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/doctor" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        {logoutError && (
          <p role="alert" className="border-t bg-destructive/5 px-4 py-2 text-center text-sm text-destructive">
            {logoutError}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 space-y-3">
      <Badge variant="secondary">{eyebrow}</Badge>
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  const normalized = status ?? "UNKNOWN";
  const styles: Record<string, string> = {
    SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
    CONFIRMED: "border-sky-200 bg-sky-50 text-sky-700",
    COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    CANCELLED: "border-red-200 bg-red-50 text-red-700",
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REVOKED: "border-slate-200 bg-slate-100 text-slate-600",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-700",
    FAILED: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", styles[normalized] ?? "border-border bg-muted text-muted-foreground")}>
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
