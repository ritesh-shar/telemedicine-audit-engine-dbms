"use client";

import { useEffect, useState } from "react";

import { AppShell, ErrorMessage, PageIntro } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditEntry {
  auditId: string;
  actorName: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldData: unknown;
  newData: unknown;
  changedAt: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAudit() {
      try {
        const response = await fetch("/api/admin/audit", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load audit entries.");
        setEntries(data.entries ?? []);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Unable to load audit entries.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAudit();
    return () => controller.abort();
  }, []);

  return (
    <AppShell active="admin-audit">
      <PageIntro
        eyebrow="Administration"
        title="Audit trail"
        description=""
      />
      {error && <ErrorMessage message={error} />}
      <Card className="rounded-xl shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Recorded changes</CardTitle>
          <Badge variant="secondary">Latest 250 entries</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No audit entries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3 font-medium">Entity</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                    <th className="px-3 py-3 font-medium">Actor</th>
                    <th className="px-3 py-3 font-medium">Timestamp</th>
                    <th className="px-3 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.auditId} className="align-top">
                      <td className="px-3 py-4">
                        <p className="font-medium">{entry.entityType}</p>
                        <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">{entry.entityId}</p>
                      </td>
                      <td className="px-3 py-4"><Badge variant="outline">{entry.action}</Badge></td>
                      <td className="px-3 py-4">{entry.actorName ?? "Direct SQL / unknown"}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-muted-foreground">
                        {new Date(entry.changedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </td>
                      <td className="px-3 py-4">
                        <details>
                          <summary className="cursor-pointer font-medium text-primary">View before / after</summary>
                          <div className="mt-3 grid gap-3 xl:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-semibold text-muted-foreground">OLD</p>
                              <pre className="max-h-64 max-w-md overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(entry.oldData, null, 2)}</pre>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-semibold text-muted-foreground">NEW</p>
                              <pre className="max-h-64 max-w-md overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(entry.newData, null, 2)}</pre>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
