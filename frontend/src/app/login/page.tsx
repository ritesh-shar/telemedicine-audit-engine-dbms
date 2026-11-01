"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface ApiResponse {
  error?: string;
  details?: Record<string, string[]>;
  user?: { role: string };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Login failed.");
        setFieldErrors(data.details ?? {});
        return;
      }

      router.replace(data.user?.role === "PATIENT" ? "/patient" : "/doctors");
      router.refresh();
    } catch {
      setError("Unable to contact the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link href="/doctors" className="text-sm font-semibold text-teal-700">← TeleMed</Link>
        <h1 className="mt-7 text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">Log in to manage your consultations.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email address</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            {fieldErrors.email?.[0] && <p className="mt-1 text-sm text-red-600">{fieldErrors.email[0]}</p>}
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            {fieldErrors.password?.[0] && <p className="mt-1 text-sm text-red-600">{fieldErrors.password[0]}</p>}
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-600">
          New patient? <Link href="/register" className="font-semibold text-teal-700 hover:underline">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
