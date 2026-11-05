"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: "/patient",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/doctors",
    label: "Find a doctor",
    icon: Stethoscope,
  },
  {
    href: "/patient/appointments",
    label: "Appointments",
    icon: CalendarDays,
  },
];

export default function PatientNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to log out.");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Logout failed. Please try again.");
      setLoggingOut(false);
    }
  }

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/patient" && pathname.startsWith(`${href}/`))
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/patient" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="size-5" />
          </span>

          <span className="text-xl font-bold tracking-tight">
            TeleMed
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">
            {loggingOut ? "Signing out..." : "Sign out"}
          </span>
        </Button>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t px-4 py-2 lg:hidden">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              isActive(href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      {error && (
        <p role="alert" className="border-t bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </header>
  );
}
