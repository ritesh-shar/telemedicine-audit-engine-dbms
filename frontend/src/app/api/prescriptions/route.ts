import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthenticationError,
  requireAuthenticatedUser
} from "@/lib/auth";
import {
  prescriptionInputSchema
} from "@/lib/prescription-validation";
import { getPostgresPool } from "@/lib/postgres";

interface PrescriptionRow {
  prescription_id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  prescribed_at: Date;
  instructions: string | null;
  status: "ACTIVE" | "REVOKED";
}

interface PrescriptionItemRow {
  item_id: string;
  prescription_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  additional_instructions: string | null;
}

interface PrescriptionListRow extends PrescriptionRow {
  item_id: string | null;
  item_prescription_id: string | null;
  medicine_name: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  additional_instructions: string | null;
}

function formatPrescription(
  prescription: PrescriptionRow,
  items: PrescriptionItemRow[]
) {
  return {
    prescriptionId: prescription.prescription_id,
    consultationId: prescription.consultation_id,
    prescribedAt: prescription.prescribed_at,
    instructions: prescription.instructions,
    status: prescription.status,
    items: items.map((item) => ({
      itemId: item.item_id,
      medicineName: item.medicine_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity,
      additionalInstructions: item.additional_instructions
    }))
  };
}

function invalidJsonResponse() {
  return NextResponse.json(
    { error: "Request body must contain valid JSON." },
    { status: 400 }
  );
}

function errorResponse(error: unknown, action: string): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid prescription data.", details: error.issues },
      { status: 400 }
    );
  }

  console.error(`${action} failed:`, error);
  return NextResponse.json(
    { error: `Unable to ${action.toLowerCase()}.` },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  let client;

  try {
    const user = await requireAuthenticatedUser();

    if (user.role !== "DOCTOR") {
      return NextResponse.json(
        { error: "Only doctors can create prescriptions." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonResponse();
    }

    const input = prescriptionInputSchema.parse(body);
    client = await getPostgresPool().connect();
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      user.userId
    ]);

    const consultationResult = await client.query<{
      consultation_id: string;
      patient_id: string;
      doctor_id: string;
    }>(
      `SELECT c.consultation_id, a.patient_id, a.doctor_id
       FROM consultations c
       JOIN appointments a ON a.appointment_id = c.appointment_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       WHERE c.consultation_id = $1
         AND d.user_id = $2
         AND c.consultation_status = 'COMPLETED'
       FOR UPDATE`,
      [input.consultationId, user.userId]
    );

    const consultation = consultationResult.rows[0];
    if (!consultation) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "Consultation not found, not assigned to this doctor, or not completed."
        },
        { status: 404 }
      );
    }

    const prescriptionResult = await client.query<PrescriptionRow>(
      `INSERT INTO prescriptions
         (consultation_id, patient_id, doctor_id, instructions)
       VALUES ($1, $2, $3, $4)
       RETURNING prescription_id, consultation_id, patient_id, doctor_id,
                 prescribed_at, instructions, status`,
      [
        consultation.consultation_id,
        consultation.patient_id,
        consultation.doctor_id,
        input.instructions ?? null
      ]
    );

    const prescription = prescriptionResult.rows[0];
    const items: PrescriptionItemRow[] = [];

    for (const item of input.items) {
      const itemResult = await client.query<PrescriptionItemRow>(
        `INSERT INTO prescription_items
           (prescription_id, medicine_name, dosage, frequency, duration,
            quantity, additional_instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING item_id, prescription_id, medicine_name, dosage, frequency,
                   duration, quantity, additional_instructions`,
        [
          prescription.prescription_id,
          item.medicineName,
          item.dosage,
          item.frequency,
          item.duration,
          item.quantity ?? null,
          item.additionalInstructions ?? null
        ]
      );
      items.push(itemResult.rows[0]);
    }

    await client.query("COMMIT");
    return NextResponse.json(
      { prescription: formatPrescription(prescription, items) },
      { status: 201 }
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Prescription transaction rollback failed:", rollbackError);
      }
    }
    return errorResponse(error, "create prescription");
  } finally {
    client?.release();
  }
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const pool = getPostgresPool();
    const ownershipClause =
      user.role === "PATIENT"
        ? "pat.user_id = $1"
        : user.role === "DOCTOR"
          ? "d.user_id = $1"
          : "TRUE";
    const parameters = user.role === "ADMIN" ? [] : [user.userId];

    const result = await pool.query<PrescriptionListRow>(
      `SELECT p.prescription_id, p.consultation_id, p.patient_id, p.doctor_id,
              p.prescribed_at, p.instructions, p.status,
              pi.item_id, pi.prescription_id AS item_prescription_id,
              pi.medicine_name, pi.dosage, pi.frequency, pi.duration,
              pi.quantity, pi.additional_instructions
       FROM prescriptions p
       JOIN consultations c ON c.consultation_id = p.consultation_id
       JOIN appointments a ON a.appointment_id = c.appointment_id
       JOIN patients pat ON pat.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       LEFT JOIN prescription_items pi ON pi.prescription_id = p.prescription_id
       WHERE ${ownershipClause}
       ORDER BY p.prescribed_at DESC, pi.item_id`,
      parameters
    );

    const prescriptions = new Map<
      string,
      { prescription: PrescriptionRow; items: PrescriptionItemRow[] }
    >();
    for (const row of result.rows) {
      let grouped = prescriptions.get(row.prescription_id);
      if (!grouped) {
        grouped = {
          prescription: row,
          items: []
        };
        prescriptions.set(row.prescription_id, grouped);
      }
      if (
        row.item_id &&
        row.item_prescription_id &&
        row.medicine_name !== null &&
        row.dosage !== null &&
        row.frequency !== null &&
        row.duration !== null
      ) {
        grouped.items.push({
          item_id: row.item_id,
          prescription_id: row.item_prescription_id,
          medicine_name: row.medicine_name,
          dosage: row.dosage,
          frequency: row.frequency,
          duration: row.duration,
          quantity: row.quantity,
          additional_instructions: row.additional_instructions
        });
      }
    }

    return NextResponse.json({
      prescriptions: [...prescriptions.values()].map(({ prescription, items }) =>
        formatPrescription(prescription, items)
      )
    });
  } catch (error) {
    return errorResponse(error, "retrieve prescriptions");
  }
}
