import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({
  children,
  active
}: {
  children: ReactNode;
  active: "dashboard" | "appointments" | "admin";
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/doctor" className="text-xl font-semibold tracking-tight">
            <span className="text-cyan-400">care</span>ledger
          </Link>
          <nav className="flex items-center gap-2 text-sm text-slate-300">
            <Link className={navClass(active === "dashboard")} href="/doctor">
              Dashboard
            </Link>
            <Link
              className={navClass(active === "appointments")}
              href="/doctor/appointments"
            >
              Appointments
            </Link>
            <Link className={navClass(active === "admin")} href="/admin/audit">
              Admin audit
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}

function navClass(isActive: boolean) {
  return `rounded-full px-4 py-2 transition ${
    isActive
      ? "bg-cyan-400 font-medium text-slate-950"
      : "hover:bg-slate-800 hover:text-white"
  }`;
}

export function PageIntro({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-slate-400">{description}</p>
    </div>
  );
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  const normalized = status ?? "UNKNOWN";
  const color =
    normalized === "COMPLETED" || normalized === "ACTIVE"
      ? "bg-emerald-400/15 text-emerald-300"
      : normalized === "CANCELLED" || normalized === "REVOKED"
        ? "bg-rose-400/15 text-rose-300"
        : "bg-amber-400/15 text-amber-300";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
      {message}
    </div>
  );
}
