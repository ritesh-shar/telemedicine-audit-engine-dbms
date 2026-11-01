
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PatientNav() {
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

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link href="/patient" className="text-lg font-bold tracking-tight text-teal-800">
          TeleMed
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600 sm:gap-5">
          <Link href="/patient" className="hover:text-teal-700">
            Dashboard
          </Link>

          <Link href="/doctors" className="hover:text-teal-700">
            Doctors
          </Link>

          <Link href="/patient/appointments" className="hover:text-teal-700">
            Appointments
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </nav>
      </div>

      {error && (
        <p role="alert" className="px-5 pb-2 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </header>
  );
}
