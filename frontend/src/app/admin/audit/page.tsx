"use client";

import { useEffect, useState } from "react";

import { AppShell, ErrorMessage, PageIntro } from "@/components/app-shell";

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

  useEffect(() => {
    fetch("/api/admin/audit")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load audit entries.");
        setEntries(data.entries);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load audit entries.")
      );
  }, []);

  return (
    <AppShell active="admin">
      <PageIntro eyebrow="Administration" title="Audit trail" description="Review who changed what, when it changed, and the old and new record values." />
      {error && <ErrorMessage message={error} />}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Old / new details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((entry) => (
                <tr key={entry.auditId} className="align-top">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{entry.entityType}</p>
                    <p className="mt-1 max-w-48 truncate text-xs text-slate-500">{entry.entityId}</p>
                  </td>
                  <td className="px-6 py-4 text-cyan-300">{entry.action}</td>
                  <td className="px-6 py-4 text-slate-300">{entry.actorName ?? "Direct SQL / unknown"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">{new Date(entry.changedAt).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <details>
                      <summary className="cursor-pointer text-cyan-400">View changes</summary>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400">
                        <pre className="max-w-md overflow-auto rounded bg-slate-950 p-3">{JSON.stringify(entry.oldData, null, 2)}</pre>
                        <pre className="max-w-md overflow-auto rounded bg-slate-950 p-3">{JSON.stringify(entry.newData, null, 2)}</pre>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length && !error && <p className="px-6 py-10 text-center text-sm text-slate-400">No audit entries found.</p>}
      </div>
    </AppShell>
  );
}
