import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthenticationError,
  requireAuthenticatedUser
} from "@/lib/auth";
import { prescriptionStatusSchema } from "@/lib/prescription-validation";
import { getPostgresPool } from "@/lib/postgres";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid prescription data.", details: error.issues },
      { status: 400 }
    );
  }
  console.error("Prescription status update failed:", error);
  return NextResponse.json(
    { error: "Unable to update the prescription." },
    { status: 500 }
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  let client;

  try {
    const user = await requireAuthenticatedUser();
    if (user.role === "PATIENT") {
      return NextResponse.json(
        { error: "Patients cannot update prescription status." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const prescriptionId = z.string().uuid().safeParse(id);
    if (!prescriptionId.success) {
      return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }
    const input = prescriptionStatusSchema.parse(body);

    client = await getPostgresPool().connect();
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      user.userId
    ]);

    const ownershipClause =
      user.role === "ADMIN" ? "TRUE" : "d.user_id = $2";
    const parameters =
      user.role === "ADMIN" ? [prescriptionId.data] : [prescriptionId.data, user.userId];
    const existing = await client.query<{
      prescription_id: string;
      consultation_id: string;
      patient_id: string;
      doctor_id: string;
      prescribed_at: Date;
      instructions: string | null;
      status: "ACTIVE" | "REVOKED";
    }>(
      `SELECT p.prescription_id, p.consultation_id, p.patient_id, p.doctor_id,
              p.prescribed_at, p.instructions, p.status
       FROM prescriptions p
       JOIN consultations c ON c.consultation_id = p.consultation_id
       JOIN appointments a ON a.appointment_id = c.appointment_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       WHERE p.prescription_id = $1 AND ${ownershipClause}
       FOR UPDATE`,
      parameters
    );

    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
    }

    const updated = await client.query<typeof existing.rows[0]>(
      `UPDATE prescriptions
       SET status = $1
       WHERE prescription_id = $2
       RETURNING prescription_id, consultation_id, patient_id, doctor_id,
                 prescribed_at, instructions, status`,
      [input.status, prescriptionId.data]
    );

    await client.query("COMMIT");
    const prescription = updated.rows[0];
    return NextResponse.json({
      prescription: {
        prescriptionId: prescription.prescription_id,
        consultationId: prescription.consultation_id,
        prescribedAt: prescription.prescribed_at,
        instructions: prescription.instructions,
        status: prescription.status
      }
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Prescription transaction rollback failed:", rollbackError);
      }
    }
    return errorResponse(error);
  } finally {
    client?.release();
  }
}
