
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

interface ApiResponse {
  message?: string;
  error?: string;
  details?: Record<string, string[]>;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setFieldErrors({});
    setSuccess(false);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Registration failed.");
        setFieldErrors(data.details ?? {});
        return;
      }

      setSuccess(true);
      setFullName("");
      setEmail("");
      setPassword("");
    } catch {
      setError("Unable to contact the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <Link href="/doctors" className="text-sm font-semibold text-teal-700">
          ← TeleMed
        </Link>

        <h1 className="mt-7 text-3xl font-bold text-slate-900">
          Create your account
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Register as a patient to book consultations and manage appointments.
        </p>

        {success ? (
          <div className="mt-7 rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="font-semibold text-green-800">
              Registration successful!
            </p>
            <p className="mt-2 text-sm text-green-700">
              Your patient account has been created. Please log in to continue.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Go to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="Your full name"
              />
              {fieldErrors.fullName?.[0] && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.fullName[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="you@example.com"
              />
              {fieldErrors.email?.[0] && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="At least 8 characters"
              />
              {fieldErrors.password?.[0] && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password[0]}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Use at least 8 characters. Maximum password size is 72 UTF-8 bytes.
              </p>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create patient account"}
            </button>
          </form>
        )}

        <p className="mt-7 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-teal-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
