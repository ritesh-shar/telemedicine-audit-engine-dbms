
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withTransaction } from "../../../../lib/postgres";
import {
  AuthError,
  requireAuth,
} from "../../../../lib/auth";
import type { UserRole } from "../../../../lib/validation";

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

const appointmentIdSchema = z.uuid("Invalid appointment ID.");

const updateAppointmentSchema = z
  .object({
    status: z.enum([
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
    ]),
  })
  .strict();

type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

interface AppointmentOwnershipRow {
  appointment_id: string;
  status: AppointmentStatus;
  patient_user_id: string;
  doctor_user_id: string;
  appointment_time: Date;
  reason: string | null;
  created_at: Date;
}

function canTransition(
  role: UserRole,
  current: AppointmentStatus,
  next: AppointmentStatus
): boolean {
  if (role === "PATIENT") {
    return (
      next === "CANCELLED" &&
      (current === "SCHEDULED" ||
        current === "CONFIRMED")
    );
  }

  if (role === "DOCTOR") {
    return (
      (current === "SCHEDULED" &&
        next === "CONFIRMED") ||
      (current === "CONFIRMED" &&
        next === "COMPLETED")
    );
  }

  if (role === "ADMIN") {
    return (
      (current === "SCHEDULED" &&
        (next === "CONFIRMED" ||
          next === "CANCELLED")) ||
      (current === "CONFIRMED" &&
        (next === "COMPLETED" ||
          next === "CANCELLED"))
    );
  }

  return false;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    const { id } = await context.params;

    const idValidation = appointmentIdSchema.safeParse(id);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid appointment ID format." },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const validation = updateAppointmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const requestedStatus =
      validation.data.status as AppointmentStatus;

    const result = await withTransaction(async (client) => {
      // Set authenticated user for the audit trigger.
      await client.query(
        "SELECT set_config('app.current_user_id', $1, true)",
        [user.user_id]
      );

      // Lock the appointment row while checking ownership
      // and evaluating its current status.
      const existingResult =
        await client.query<AppointmentOwnershipRow>(
          `SELECT
             a.appointment_id,
             a.status,
             a.appointment_time,
             a.reason,
             a.created_at,
             p.user_id AS patient_user_id,
             d.user_id AS doctor_user_id
           FROM appointments a
           JOIN patients p ON p.patient_id = a.patient_id
           JOIN doctors d ON d.doctor_id = a.doctor_id
           WHERE a.appointment_id = $1
           FOR UPDATE OF a`,
          [id]
        );

      if (existingResult.rows.length === 0) {
        throw new RouteError("Appointment not found.", 404);
      }

      const existing = existingResult.rows[0];

      // Verify identity and ownership using database relationships.
      const isOwner =
        user.role === "ADMIN" ||
        (user.role === "PATIENT" &&
          existing.patient_user_id === user.user_id) ||
        (user.role === "DOCTOR" &&
          existing.doctor_user_id === user.user_id);

      if (!isOwner) {
        // Do not reveal whether another user's appointment exists.
        throw new RouteError("Appointment not found.", 404);
      }

      // Idempotency: repeating the same status does not create
      // another UPDATE or audit event.
      if (existing.status === requestedStatus) {
        return {
          appointment: {
            appointment_id: existing.appointment_id,
            status: existing.status,
            appointment_time: existing.appointment_time,
            reason: existing.reason,
            created_at: existing.created_at,
          },
          unchanged: true,
        };
      }

      // Check the role-specific status transition.
      if (
        !canTransition(
          user.role,
          existing.status,
          requestedStatus
        )
      ) {
        throw new RouteError(
          `You cannot change an appointment from ${existing.status} to ${requestedStatus}.`,
          409
        );
      }

      const updateResult = await client.query<{
        appointment_id: string;
        status: AppointmentStatus;
        appointment_time: Date;
        reason: string | null;
        created_at: Date;
      }>(
        `UPDATE appointments
         SET status = $2
         WHERE appointment_id = $1
         RETURNING
           appointment_id,
           status,
           appointment_time,
           reason,
           created_at`,
        [id, requestedStatus]
      );

      return {
        appointment: updateResult.rows[0],
        unchanged: false,
      };
    });

    const appointment = result.appointment;

    return NextResponse.json(
      {
        message: result.unchanged
          ? "Appointment already has the requested status."
          : "Appointment status updated successfully.",
        appointment: {
          appointmentId: appointment.appointment_id,
          status: appointment.status,
          appointmentTime: appointment.appointment_time,
          reason: appointment.reason,
          createdAt: appointment.created_at,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError || error instanceof RouteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Appointment status update failed:", error);

    return NextResponse.json(
      { error: "Unable to update appointment." },
      { status: 500 }
    );
  }
}
