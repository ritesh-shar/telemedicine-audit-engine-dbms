import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";

import { withTransaction } from "../../../../lib/postgres";
import { patientRegistrationSchema } from "../../../../lib/validation";
import { setSessionCookie } from "../../../../lib/auth"; // Optional: Issue cookie on signup

export const runtime = "nodejs";

interface DatabaseError {
  code?: string;
  constraint?: string;
  detail?: string;
}

/**
 * Robust unique violation detector.
 * Checks for PostgreSQL SQLSTATE 23505 (unique_violation) and verifies target context.
 */
function isDuplicateEmail(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const dbError = error as DatabaseError;

  // SQLSTATE 23505 = unique_violation
  if (dbError.code !== "23505") {
    return false;
  }

  // Fallback check: verify if the error constraint or detail involves the email field
  return (
    dbError.constraint === "users_email_key" ||
    (typeof dbError.detail === "string" && dbError.detail.includes("email"))
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const validation = patientRegistrationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { fullName, email, password } = validation.data;

  try {
    // Hash the password before acquiring a pool connection to minimize transaction hold times.
    const passwordHash = await hash(password, 12);

    const user = await withTransaction(async (client) => {
      // Public registration always creates a PATIENT.
      const userResult = await client.query<{
        user_id: string;
        full_name: string;
        email: string;
        role: "PATIENT";
      }>(
        `INSERT INTO users (
          full_name,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, 'PATIENT')
        RETURNING user_id, full_name, email, role`,
        [fullName, email, passwordHash]
      );

      const createdUser = userResult.rows[0];

      // Create the corresponding patient profile linked via foreign key.
      const patientResult = await client.query<{
        patient_id: string;
      }>(
        `INSERT INTO patients (user_id)
         VALUES ($1)
         RETURNING patient_id`,
        [createdUser.user_id]
      );

      return {
        ...createdUser,
        patient_id: patientResult.rows[0].patient_id,
      };
    });

    // Optionally auto-authenticate the user upon successful registration:
    // await setSessionCookie({ user_id: user.user_id, role: user.role });

    return NextResponse.json(
      {
        message: "Patient registered successfully.",
        user: {
          user_id: user.user_id,
          patient_id: user.patient_id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (isDuplicateEmail(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Preserve stack traces in server logs for internal 500 debugging
    console.error("Patient registration failed due to an unexpected error:", error);

    return NextResponse.json(
      { error: "Registration failed due to a server error." },
      { status: 500 }
    );
  }
}
