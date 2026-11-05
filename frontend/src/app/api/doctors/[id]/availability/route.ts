import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { pool } from "../../../../../lib/postgres";
import { AuthError, requireRole } from "../../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dateSchema = z.iso.date();
const doctorIdSchema = z.uuid();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("PATIENT");

    const { id } = await context.params;
    if (!doctorIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid doctor ID." }, { status: 400 });
    }

    const dateValue = request.nextUrl.searchParams.get("date");
    const dateResult = dateSchema.safeParse(dateValue);
    if (!dateResult.success) {
      return NextResponse.json(
        { error: "A valid date in YYYY-MM-DD format is required." },
        { status: 400 }
      );
    }
    const date = dateResult.data;

    const doctorResult = await pool.query<{ is_available: boolean }>(
      `SELECT d.is_available
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE d.doctor_id = $1 AND u.role = 'DOCTOR'`,
      [id]
    );

    if (!doctorResult.rows[0]) {
      return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
    }
    if (!doctorResult.rows[0].is_available) {
      return NextResponse.json(
        { error: "This doctor is currently unavailable." },
        { status: 409 }
      );
    }

    // The date and slots shown by the UI are India-local (Asia/Kolkata).
    // Convert local midnight boundaries to timestamptz instants for the query.
    const result = await pool.query<{ slot_key: string }>(
      `SELECT TO_CHAR(
          appointment_time AT TIME ZONE 'Asia/Kolkata',
          'YYYY-MM-DD"T"HH24:MI'
       ) AS slot_key
       FROM appointments
       WHERE doctor_id = $1
         AND appointment_time >= ($2::date::timestamp AT TIME ZONE 'Asia/Kolkata')
         AND appointment_time < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
         AND status IN ('SCHEDULED', 'CONFIRMED')
       ORDER BY appointment_time`,
      [id, date]
    );

    return NextResponse.json(
      {
        doctorId: id,
        date,
        timeZone: "Asia/Kolkata",
        bookedSlots: result.rows.map((row) => row.slot_key),
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Doctor availability lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to retrieve doctor availability." },
      { status: 500 }
    );
  }
}
