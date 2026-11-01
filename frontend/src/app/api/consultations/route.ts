import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthenticationError,
  requireAuthenticatedUser
} from "@/lib/auth";
import { consultationInputSchema } from "@/lib/consultation-validation";
import {
  ConsultationDocument,
  getConsultationsCollection
} from "@/lib/mongodb";
import { getPostgresPool } from "@/lib/postgres";

class CrossDatabaseConsistencyError extends Error {
  constructor(
    public readonly consultationId: string,
    public readonly mongoDocumentId: string
  ) {
    super(
      "MongoDB consultation was created, but PostgreSQL finalization failed."
    );
    this.name = "CrossDatabaseConsistencyError";
  }
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid consultation data.", details: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof CrossDatabaseConsistencyError) {
    console.error(
      "Consultation requires cross-database reconciliation:",
      error
    );
    return NextResponse.json(
      {
        error: error.message,
        consultationId: error.consultationId,
        mongoDocumentId: error.mongoDocumentId
      },
      { status: 502 }
    );
  }

  console.error("Consultation creation failed:", error);
  return NextResponse.json(
    { error: "Unable to create the consultation." },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  let client;
  let insertedMongoDocumentId: string | undefined;
  let consultationIdForError: string | undefined;

  try {
    const user = await requireAuthenticatedUser();

    if (user.role !== "DOCTOR") {
      return NextResponse.json(
        { error: "Only doctors can create consultations." },
        { status: 403 }
      );
    }

    const input = consultationInputSchema.parse(await request.json());
    const consultationId = input.consultationId ?? randomUUID();
    consultationIdForError = consultationId;
    const pool = getPostgresPool();
    client = await pool.connect();

    await client.query("BEGIN");

    const appointmentResult = await client.query<{
      appointment_id: string;
      patient_id: string;
      doctor_id: string;
      status: string;
    }>(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, a.status
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
       WHERE a.appointment_id = $1 AND d.user_id = $2
       FOR UPDATE`,
      [input.appointmentId, user.userId]
    );

    const appointment = appointmentResult.rows[0];

    if (!appointment) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Appointment not found or not assigned to this doctor." },
        { status: 404 }
      );
    }

    if (!["CONFIRMED", "COMPLETED"].includes(appointment.status)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "The appointment does not permit consultation creation." },
        { status: 409 }
      );
    }

    const existingResult = await client.query<{
      consultation_id: string;
      consultation_status: string;
      mongo_document_id: string | null;
    }>(
      `SELECT consultation_id, consultation_status, mongo_document_id
       FROM consultations
       WHERE appointment_id = $1`,
      [input.appointmentId]
    );

    const existing = existingResult.rows[0];

    if (existing) {
      if (
        existing.consultation_status === "COMPLETED" ||
        existing.consultation_id === consultationId
      ) {
        const collection = await getConsultationsCollection();
        const document = await collection.findOne({
          consultationId: existing.consultation_id
        });

        if (document) {
          if (existing.consultation_status !== "COMPLETED") {
            await client.query(
              `UPDATE consultations
               SET mongo_document_id = $1,
                   consultation_status = 'COMPLETED',
                   completed_at = CURRENT_TIMESTAMP
               WHERE consultation_id = $2`,
              [document._id.toString(), existing.consultation_id]
            );
            await client.query("COMMIT");
          } else {
            await client.query("ROLLBACK");
          }

          return NextResponse.json({
            consultationId: existing.consultation_id,
            appointmentId: input.appointmentId,
            status: "COMPLETED"
          });
        }
      }

      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "A consultation already exists for this appointment.",
          consultationId: existing.consultation_id,
          status: existing.consultation_status
        },
        { status: 409 }
      );
    }

    await client.query(
      `INSERT INTO consultations
       (consultation_id, appointment_id, consultation_status)
       VALUES ($1, $2, 'IN_PROGRESS')`,
      [consultationId, input.appointmentId]
    );

    const document: ConsultationDocument = {
      consultationId,
      appointmentId: input.appointmentId,
      patientId: appointment.patient_id,
      doctorId: appointment.doctor_id,
      symptoms: input.symptoms,
      observations: input.observations,
      clinicalNotes: input.clinicalNotes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const collection = await getConsultationsCollection();
    const inserted = await collection.insertOne(document);
    insertedMongoDocumentId = inserted.insertedId.toString();

    await client.query(
      `UPDATE consultations
       SET mongo_document_id = $1,
           consultation_status = 'COMPLETED',
           completed_at = CURRENT_TIMESTAMP
       WHERE consultation_id = $2`,
      [insertedMongoDocumentId, consultationId]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        consultationId,
        appointmentId: input.appointmentId,
        status: "COMPLETED"
      },
      { status: 201 }
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Consultation transaction rollback failed:", rollbackError);
      }
    }

    if (insertedMongoDocumentId && consultationIdForError) {
      return errorResponse(
        new CrossDatabaseConsistencyError(
          consultationIdForError,
          insertedMongoDocumentId
        )
      );
    }

    return errorResponse(error);
  } finally {
    client?.release();
  }
}
