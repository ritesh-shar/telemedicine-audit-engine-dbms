import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthenticationError,
  requireAuthenticatedUser
} from "@/lib/auth";
import { getConsultationsCollection } from "@/lib/mongodb";
import { getPostgresPool } from "@/lib/postgres";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    const consultationId = z.string().uuid().safeParse(id);

    if (!consultationId.success) {
      return NextResponse.json(
        { error: "Consultation not found." },
        { status: 404 }
      );
    }

    const pool = getPostgresPool();
    const consultationResult = await pool.query<{
      consultation_id: string;
      appointment_id: string;
      consultation_status: string;
      mongo_document_id: string | null;
      patient_user_id: string;
      doctor_user_id: string;
    }>(
      `SELECT c.consultation_id, c.appointment_id, c.consultation_status,
              c.mongo_document_id, p.user_id AS patient_user_id,
              d.user_id AS doctor_user_id
       FROM consultations c
       JOIN appointments a ON a.appointment_id = c.appointment_id
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       WHERE c.consultation_id = $1`,
      [consultationId.data]
    );

    const consultation = consultationResult.rows[0];

    if (!consultation) {
      return NextResponse.json(
        { error: "Consultation not found." },
        { status: 404 }
      );
    }

    const canView =
      user.role === "ADMIN" ||
      (user.role === "PATIENT" &&
        user.userId === consultation.patient_user_id) ||
      (user.role === "DOCTOR" && user.userId === consultation.doctor_user_id);

    if (!canView) {
      return NextResponse.json(
        { error: "Consultation not found." },
        { status: 404 }
      );
    }

    const collection = await getConsultationsCollection();
    const document = await collection.findOne({
      consultationId: consultation.consultation_id
    });

    if (!document) {
      return NextResponse.json(
        { error: "Consultation details are unavailable." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      consultation: {
        ...document,
        _id: document._id?.toString(),
        postgres: {
          consultationId: consultation.consultation_id,
          appointmentId: consultation.appointment_id,
          status: consultation.consultation_status,
          mongoDocumentId: consultation.mongo_document_id
        }
      }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error("Consultation lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to retrieve the consultation." },
      { status: 500 }
    );
  }
}
