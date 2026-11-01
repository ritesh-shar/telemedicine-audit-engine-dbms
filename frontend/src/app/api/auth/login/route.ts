import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";

import { pool } from "../../../../lib/postgres";
import { setSessionCookie } from "../../../../lib/auth";
import {
  isUserRole,
  loginSchema,
} from "../../../../lib/validation";

export const runtime = "nodejs";

interface LoginUser {
  user_id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
}

// Pre-computed dummy hash (bcrypt cost factor 12) to execute on non-existent accounts.
// Prevents response timing side-channel attacks for email enumeration.
const DUMMY_HASH =
  "$2a$12$eImiTXuWVxfM37uY4JANjOL.81F8R5w/U5A/rW5rJ9s.N2O24.8a2";

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

  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { email, password } = validation.data;

  try {
    const result = await pool.query<LoginUser>(
      `SELECT
        user_id,
        full_name,
        email,
        password_hash,
        role
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    // Select target hash to ensure compare() always executes, preventing timing analysis.
    const targetHash = user ? user.password_hash : DUMMY_HASH;
    const passwordMatches = await compare(password, targetHash);

    if (!user || !passwordMatches) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Verify role integrity against domain limits
    if (!isUserRole(user.role)) {
      console.error(`User ${user.user_id} has an invalid domain role: ${user.role}`);
      return NextResponse.json(
        { error: "Login failed due to an account configuration error." },
        { status: 500 }
      );
    }

    await setSessionCookie({
      user_id: user.user_id,
      role: user.role,
    });

    return NextResponse.json({
      message: "Login successful.",
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed due to an unexpected server error:", error);

    return NextResponse.json(
      { error: "Login failed due to a server error." },
      { status: 500 }
    );
  }
}
