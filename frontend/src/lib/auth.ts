import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export type UserRole = "PATIENT" | "DOCTOR" | "ADMIN";

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

export class AuthenticationError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "Authentication configuration is missing. Set SESSION_SECRET in the server environment."
    );
  }

  return new TextEncoder().encode(secret);
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const sessionCookie = (await cookies()).get("session")?.value;

  if (!sessionCookie) {
    throw new AuthenticationError();
  }

  try {
    const { payload } = await jwtVerify(sessionCookie, getSessionSecret());
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const role =
      payload.role === "PATIENT" ||
      payload.role === "DOCTOR" ||
      payload.role === "ADMIN"
        ? payload.role
        : null;

    if (!userId || !role) {
      throw new AuthenticationError("The session is invalid.");
    }

    return { userId, role };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError("The session is invalid.");
  }
}
