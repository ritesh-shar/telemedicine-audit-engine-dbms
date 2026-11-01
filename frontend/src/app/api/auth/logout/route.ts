import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSessionCookie();

    const response = NextResponse.json(
      { message: "Logout successful." },
      { status: 200 }
    );

    // Prevent browsers and proxies from caching stale session state
    response.headers.set("Cache-Control", "no-store, max-age=0");

    return response;
  } catch (error) {
    console.error("Logout execution failed:", error);

    return NextResponse.json(
      { error: "Logout failed due to a server error." },
      { status: 500 }
    );
  }
}
