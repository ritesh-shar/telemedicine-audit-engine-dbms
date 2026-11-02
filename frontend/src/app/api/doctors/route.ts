
import { NextRequest, NextResponse } from "next/server";
import { pool } from "../../../lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DoctorRow {
  doctor_id: string;
  display_name: string;
  specialization: string;
  qualification: string;
  consultation_fee: string;
  availability: boolean;
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

export async function GET(request: NextRequest) {
  try {
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

    const result = await pool.query<DoctorRow>(
      `SELECT
          d.doctor_id,
          u.full_name AS display_name,
          d.specialization,
          d.qualification,
          d.consultation_fee,
          d.is_available AS availability
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE u.role = 'DOCTOR'
       ORDER BY u.full_name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const doctors = result.rows.map((doctor) => {
      const fee = Number(doctor.consultation_fee);

      return {
        doctorId: doctor.doctor_id,
        displayName: doctor.display_name,
        specialization: doctor.specialization,
        qualification: doctor.qualification,
        fee,
        availability: doctor.availability,
      };
    });

    return NextResponse.json(
      {
        doctors,
        count: doctors.length,
        limit,
        offset,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Doctor discovery failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve doctors." },
      { status: 500 }
    );
  }
}
