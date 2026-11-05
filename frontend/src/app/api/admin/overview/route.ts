import { NextResponse } from "next/server";

import { AuthError, requireRole } from "@/lib/auth";
import { getPostgresPool } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("ADMIN");

    const result = await getPostgresPool().query<{
      total_users: string;
      total_patients: string;
      total_doctors: string;
      available_doctors: string;
      total_appointments: string;
      scheduled_appointments: string;
      confirmed_appointments: string;
      completed_appointments: string;
      total_prescriptions: string;
      active_prescriptions: string;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM users)::text AS total_users,
        (SELECT COUNT(*) FROM patients)::text AS total_patients,
        (SELECT COUNT(*) FROM doctors)::text AS total_doctors,
        (SELECT COUNT(*) FROM doctors WHERE is_available = TRUE)::text AS available_doctors,
        (SELECT COUNT(*) FROM appointments)::text AS total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'SCHEDULED')::text AS scheduled_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'CONFIRMED')::text AS confirmed_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'COMPLETED')::text AS completed_appointments,
        (SELECT COUNT(*) FROM prescriptions)::text AS total_prescriptions,
        (SELECT COUNT(*) FROM prescriptions WHERE status = 'ACTIVE')::text AS active_prescriptions`
    );

    const row = result.rows[0];
    const stats = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, Number(value)])
    );

    return NextResponse.json(
      { stats },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Admin overview failed:", error);
    return NextResponse.json(
      { error: "Unable to load the admin overview." },
      { status: 500 }
    );
  }
}
