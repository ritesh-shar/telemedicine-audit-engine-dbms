import "server-only";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import {
  isUserRole,
  type UserRole,
} from "./validation";

const SESSION_COOKIE_NAME = "telemedicine_session";
const LEGACY_SESSION_COOKIE_NAME = "session";
// 8 hours. Consider lowering this for healthcare apps (e.g., 1-2 hours)
// to reduce the attack window of stolen or unrevoked tokens.
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

const SESSION_ISSUER = "telemedicine-audit-engine";
const SESSION_AUDIENCE = "telemedicine-web";

export interface SessionUser {
  user_id: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthenticationError extends AuthError {
  constructor(message = "Authentication required.") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

// Cache the encoded secret in memory to prevent re-encoding on every request.
let cachedEncodedSecret: Uint8Array | null = null;

function getSessionSecret(): Uint8Array {
  if (cachedEncodedSecret) {
    return cachedEncodedSecret;
  }

  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "Authentication configuration error: SESSION_SECRET is missing."
    );
  }

  const encodedSecret = new TextEncoder().encode(secret);

  if (encodedSecret.length < 32) {
    throw new Error(
      "Authentication configuration error: SESSION_SECRET must be at least 32 bytes for HS256."
    );
  }

  cachedEncodedSecret = encodedSecret;
  return cachedEncodedSecret;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

/**
 * Create a signed JWT and store it in an HTTP-only cookie.
 * ⚠️ Next.js Constraint: This can ONLY be called in Route Handlers or Server Actions,
 * never directly during a Server Component render.
 */
export async function setSessionCookie(user: {
  user_id: string;
  role: UserRole;
}): Promise<void> {
  const token = await new SignJWT({
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.user_id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    // Inject a unique JWT ID. This is critical for future-proofing your app
    // to allow token revocation (blocklisting) before the 8-hour expiration.
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());

  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    getCookieOptions()
  );
}

/**
 * Clear the session cookie during logout.
 * ⚠️ Next.js Constraint: This can ONLY be called in Route Handlers or Server Actions.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getCookieOptions(),
    maxAge: 0,
    expires: new Date(0), // Instantly expire the cookie
  });
  cookieStore.set(LEGACY_SESSION_COOKIE_NAME, "", {
    ...getCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Verify the current session.
 * Returns authenticated user ID and role, or null.
 * Safe to use in Server Components, Middleware, and Route Handlers.
 */

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  // Configuration errors must not be swallowed as authentication failures.
  const secret = getSessionSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });

    const userId =
      typeof payload.sub === "string"
        ? payload.sub
        : typeof payload.userId === "string"
          ? payload.userId
          : null;

    if (!userId || !isUserRole(payload.role)) {
      return null;
    }

    return {
      user_id: userId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  try {
    const user = await requireAuth();
    return { userId: user.user_id, role: user.role };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) {
      throw new AuthenticationError();
    }
    throw error;
  }
}


/**
 * Require an authenticated user. Throws AuthError if unauthenticated.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new AuthError("Authentication required.", 401);
  }

  return user;
}

/**
 * Require an authenticated user with one of the specified roles.
 */
export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new AuthError("You do not have permission to access this resource.", 403);
  }

  return user;
}
