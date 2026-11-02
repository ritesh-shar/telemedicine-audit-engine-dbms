"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PatientNav from "../../patient-nav";

interface Doctor {
  doctorId: string;
  displayName: string;
  specialization: string;
  qualification: string;
  fee: number;
  availability: boolean;
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/doctors")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load doctors.");
        setDoctors(data.doctors ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load doctors."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PatientNav />
      <main className="mx-auto min-h-screen max-w-7xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Care team</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Find a doctor</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Browse available specialists and book a consultation at a fixed time.</p>

        {loading && <p className="mt-8 text-slate-500">Loading doctors...</p>}
        {error && <p role="alert" className="mt-8 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
        {!loading && !error && (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor) => (
              <article key={doctor.doctorId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-800">
                  {doctor.displayName.charAt(0)}
                </div>
                <h2 className="mt-4 text-xl font-bold">{doctor.displayName}</h2>
                <p className="mt-1 font-medium text-teal-700">{doctor.specialization}</p>
                <p className="mt-2 text-sm text-slate-500">{doctor.qualification}</p>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-lg font-bold">₹{doctor.fee.toFixed(2)}</span>
                  <span className={`text-xs font-semibold ${doctor.availability ? "text-green-700" : "text-slate-500"}`}>
                    {doctor.availability ? "Available" : "Unavailable"}
                  </span>
                </div>
                <Link href={`/patient/appointments?doctorId=${doctor.doctorId}`}
                  className={`mt-5 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${doctor.availability ? "bg-teal-700 text-white hover:bg-teal-800" : "pointer-events-none bg-slate-100 text-slate-400"}`}>
                  Book appointment
                </Link>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && doctors.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-semibold text-slate-700">No doctors are available.</p>
            <p className="mt-2 text-sm text-slate-500">
              Confirm that PostgreSQL is running and apply database/postgres/seeds/020_doctors.sql.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
