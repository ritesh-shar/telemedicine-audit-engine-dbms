
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { pool, withTransaction } from "../../../lib/postgres";
import {
  AuthError,
  requireAuth,
  requireRole,
} from "../../../lib/auth";
import { isFixedUtcSlot } from "../../../lib/appointment-slots";

export const runtime = "nodejs";

class RouteError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RouteError";
  }
}

// Require a valid ISO datetime with an explicit timezone.
// Examples:
// 2027-01-15T10:00:00Z
// 2027-01-15T10:00:00+05:30
const appointmentTimeSchema = z
  .iso.datetime({ offset: true })
  .refine(
    (value) => Date.parse(value) > Date.now(),
    "Appointment time must be in the future."
  )
  .refine(isFixedUtcSlot, "Appointment time must be one of the fixed consultation slots.");

const createAppointmentSchema = z
  .object({
    doctorId: z.uuid("Invalid doctor ID."),
    appointmentTime: appointmentTimeSchema,
    reason: z
      .string()
      .trim()
      .max(1000, "Reason must not exceed 1000 characters.")
      .optional(),
  })
  .strict();

interface AppointmentRow {
  appointment_id: string;
  appointment_time: Date;
  status: string;
  reason: string | null;
  created_at: Date;
}

function isDoctorSlotConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const dbError = error as {
    code?: string;
    constraint?: string;
  };

  return (
    dbError.code === "23505" &&
    dbError.constraint === "unique_doctor_appointment_slot"
  );
}

function readPagination(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
} | null {
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");

  if (
    (limitRaw !== null && !/^\d+$/.test(limitRaw)) ||
    (offsetRaw !== null && !/^\d+$/.test(offsetRaw))
  ) {
    return null;
  }

  const limit = limitRaw === null ? 50 : Number(limitRaw);
  const offset = offsetRaw === null ? 0 : Number(offsetRaw);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    return null;
  }

  return { limit, offset };
}

// ============================================================
// POST /api/appointments
// Only authenticated patients can book appointments.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("PATIENT");

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const validation = createAppointmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { doctorId, appointmentTime, reason } = validation.data;
    const requestedTime = new Date(appointmentTime);

    const appointment = await withTransaction(async (client) => {
      // Set authenticated user for PostgreSQL audit triggers.
      // The setting is transaction-local.
      await client.query(
        "SELECT set_config('app.current_user_id', $1, true)",
        [user.user_id]
      );

      // Recheck future time inside the transaction.
      if (requestedTime.getTime() <= Date.now()) {
        throw new RouteError(
          "Appointment time must be in the future.",
          400
        );
      }

      // Derive patient profile from authenticated identity.
      // Never trust a patient ID supplied by the client.
      const patientResult = await client.query<{
        patient_id: string;
      }>(
        `SELECT patient_id
         FROM patients
         WHERE user_id = $1`,
        [user.user_id]
      );

      if (patientResult.rows.length === 0) {
        throw new RouteError(
          "Patient profile not found for this account.",
          403
        );
      }

      const patientId = patientResult.rows[0].patient_id;

      // Lock the doctor row while checking availability.
      // Concurrent updates to is_available must wait until
      // this transaction completes.
      const doctorResult = await client.query<{
        doctor_id: string;
        is_available: boolean;
      }>(
        `SELECT
           d.doctor_id,
           d.is_available
         FROM doctors d
         JOIN users u ON u.user_id = d.user_id
         WHERE d.doctor_id = $1
           AND u.role = 'DOCTOR'
         FOR SHARE OF d`,
        [doctorId]
      );

      if (doctorResult.rows.length === 0) {
        throw new RouteError("Doctor not found.", 404);
      }

      if (!doctorResult.rows[0].is_available) {
        throw new RouteError(
          "This doctor is currently unavailable.",
          409
        );
      }

      // The partial unique index provides final protection
      // against concurrent bookings of the same active slot.
      const result = await client.query<AppointmentRow>(
        `INSERT INTO appointments (
           patient_id,
           doctor_id,
           appointment_time,
           reason
         )
         VALUES ($1, $2, $3, $4)
         RETURNING
           appointment_id,
           appointment_time,
           status,
           reason,
           created_at`,
        [
          patientId,
          doctorId,
          requestedTime,
          reason ?? null,
        ]
      );

      return result.rows[0];
    });

    return NextResponse.json(
      {
        message: "Appointment booked successfully.",
        appointment: {
          appointmentId: appointment.appointment_id,
          appointmentTime: appointment.appointment_time,
          status: appointment.status,
          reason: appointment.reason,
          createdAt: appointment.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError || error instanceof RouteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (isDoctorSlotConflict(error)) {
      return NextResponse.json(
        {
          error:
            "This doctor already has an appointment booked at that time.",
        },
        { status: 409 }
      );
    }

    console.error("Appointment booking failed:", error);

    return NextResponse.json(
      { error: "Unable to book appointment." },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/appointments
// Patients see their appointments.
// Doctors see appointments assigned to their profile.
// Admins can see all appointments.
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const pagination = readPagination(
      request.nextUrl.searchParams
    );

    if (!pagination) {
      return NextResponse.json(
        { error: "Invalid pagination parameters." },
        { status: 400 }
      );
    }

    const { limit, offset } = pagination;

    const baseQuery = `
      SELECT
        a.appointment_id AS "appointmentId",
        a.appointment_time AS "appointmentTime",
        a.status,
        a.reason,
        a.created_at AS "createdAt",
        d.doctor_id AS "doctorId",
        du.full_name AS "doctorName",
        d.specialization AS "doctorSpecialization",
        p.patient_id AS "patientId",
        pu.full_name AS "patientName"
      FROM appointments a
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users du ON du.user_id = d.user_id
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN users pu ON pu.user_id = p.user_id
    `;

    let query: string;
    let values: (string | number)[];

    if (user.role === "PATIENT") {
      query = `
        ${baseQuery}
        WHERE p.user_id = $1
        ORDER BY a.appointment_time DESC
        LIMIT $2 OFFSET $3
      `;

      values = [user.user_id, limit, offset];
    } else if (user.role === "DOCTOR") {
      query = `
        ${baseQuery}
        WHERE d.user_id = $1
        ORDER BY a.appointment_time DESC
        LIMIT $2 OFFSET $3
      `;

      values = [user.user_id, limit, offset];
    } else if (user.role === "ADMIN") {
      query = `
        ${baseQuery}
        ORDER BY a.appointment_time DESC
        LIMIT $1 OFFSET $2
      `;

      values = [limit, offset];
    } else {
      return NextResponse.json(
        { error: "You do not have permission to view appointments." },
        { status: 403 }
      );
    }

    const result = await pool.query(query, values);

    return NextResponse.json(
      {
        appointments: result.rows,
        limit,
        offset,
        returnedCount: result.rows.length,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Appointment retrieval failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve appointments." },
      { status: 500 }
    );
  }
}
