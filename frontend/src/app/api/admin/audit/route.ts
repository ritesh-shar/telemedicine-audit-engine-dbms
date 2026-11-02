import { NextResponse } from "next/server";

import {
  AuthenticationError,
  requireAuthenticatedUser
} from "@/lib/auth";
import { getPostgresPool } from "@/lib/postgres";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can view the audit log." },
        { status: 403 }
      );
    }

    const result = await getPostgresPool().query<{
      audit_id: string;
      user_id: string | null;
      actor_name: string | null;
      action: string;
      entity_type: string;
      entity_id: string;
      old_data: unknown;
      new_data: unknown;
      changed_at: string;
    }>(
      `SELECT a.audit_id, a.user_id, u.full_name AS actor_name, a.action,
              a.entity_type, a.entity_id, a.old_data, a.new_data, a.changed_at
       FROM auditlog a
       LEFT JOIN users u ON u.user_id = a.user_id
       ORDER BY a.changed_at DESC
       LIMIT 250`
    );

    return NextResponse.json({
      entries: result.rows.map((entry) => ({
        auditId: entry.audit_id,
        actorId: entry.user_id,
        actorName: entry.actor_name,
        action: entry.action,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        oldData: entry.old_data,
        newData: entry.new_data,
        changedAt: entry.changed_at
      }))
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.error("Audit log lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to retrieve the audit log." },
      { status: 500 }
    );
  }
}
