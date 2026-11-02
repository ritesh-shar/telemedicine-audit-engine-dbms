"use client";

import { useState } from "react";
import { useEffect } from "react";
import type * as React from "react";

import { ErrorMessage, StatusPill } from "@/components/app-shell";

interface Medicine {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  additionalInstructions: string;
}

interface Prescription {
  prescriptionId: string;
  consultationId: string;
  prescribedAt: string;
  instructions: string | null;
  status: "ACTIVE" | "REVOKED";
  items: Medicine[];
}

const emptyMedicine = (): Medicine => ({
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "",
  additionalInstructions: ""
});

export function ConsultationWorkspace({
  appointmentId,
  consultationId,
  initialData
}: {
  appointmentId?: string;
  consultationId?: string;
  initialData?: {
    symptoms?: string[];
    clinicalNotes?: {
      complaints?: string;
      examination?: string;
      assessment?: string;
      plan?: string;
    };
  };
}) {
  const [savedConsultationId, setSavedConsultationId] = useState(consultationId);
  const [activeAppointmentId, setActiveAppointmentId] = useState(appointmentId);
  const [symptoms, setSymptoms] = useState(initialData?.symptoms?.join(", ") ?? "");
  const [notes, setNotes] = useState({
    complaints: initialData?.clinicalNotes?.complaints ?? "",
    examination: initialData?.clinicalNotes?.examination ?? "",
    assessment: initialData?.clinicalNotes?.assessment ?? "",
    plan: initialData?.clinicalNotes?.plan ?? ""
  });
  const [medicines, setMedicines] = useState<Medicine[]>([emptyMedicine()]);
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    if (!consultationId) return;
    fetch(`/api/consultations/${consultationId}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load consultation.");
        setActiveAppointmentId(data.consultation.postgres.appointmentId);
        setSymptoms(data.consultation.symptoms?.join(", ") ?? "");
        setNotes(data.consultation.clinicalNotes ?? notes);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Unable to load consultation.")
      );
  // The initial notes object is only used as a fallback for the loaded record.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  useEffect(() => {
    if (!savedConsultationId) return;
    fetch("/api/prescriptions")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load prescription history.");
        setPrescriptions(
          data.prescriptions.filter(
            (prescription: Prescription) =>
              prescription.consultationId === savedConsultationId
          )
        );
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load prescription history."
        )
      );
  }, [savedConsultationId]);

  async function saveConsultation(event: React.FormEvent) {
    event.preventDefault();
    if (!activeAppointmentId) {
      setError("This workspace does not have an appointment ID.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: activeAppointmentId,
          symptoms: symptoms.split(",").map((item) => item.trim()).filter(Boolean),
          observations: [],
          clinicalNotes: notes
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save consultation.");
      setSavedConsultationId(data.consultationId);
      setStatus("Consultation saved. You can now issue a prescription.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save consultation.");
    } finally {
      setSaving(false);
    }
  }

  async function createPrescription(event: React.FormEvent) {
    event.preventDefault();
    if (!savedConsultationId) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId: savedConsultationId,
          instructions: instructions || null,
          items: medicines.map((medicine) => ({
            ...medicine,
            quantity: medicine.quantity ? Number(medicine.quantity) : undefined
          }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create prescription.");
      setStatus(`Prescription ${data.prescription.prescriptionId} issued successfully.`);
      setPrescriptions((current) => [...current, data.prescription]);
      setMedicines([emptyMedicine()]);
      setInstructions("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create prescription.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={saveConsultation} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">Consultation notes</h2>
        <p className="mt-1 text-sm text-slate-400">Capture the clinical assessment before issuing a prescription.</p>
        <label className="mt-6 block text-sm text-slate-300">
          Symptoms
          <input className="field mt-2" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="Headache, fatigue" />
        </label>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(["complaints", "examination", "assessment", "plan"] as const).map((field) => (
            <label key={field} className="text-sm capitalize text-slate-300">
              {field}
              <textarea className="field mt-2 min-h-28" value={notes[field]} onChange={(event) => setNotes({ ...notes, [field]: event.target.value })} required />
            </label>
          ))}
        </div>
        <button className="button-primary mt-6" disabled={saving || Boolean(consultationId)}>{consultationId ? "Consultation saved" : saving ? "Saving..." : "Save consultation"}</button>
      </form>

      <form onSubmit={createPrescription} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Prescription</h2>
            <p className="mt-1 text-sm text-slate-400">Add one or more medicine lines after saving the consultation.</p>
          </div>
          {savedConsultationId && <StatusPill status="ACTIVE" />}
        </div>
        <div className="mt-6 space-y-4">
          {medicines.map((medicine, index) => (
            <div key={index} className="rounded-xl bg-slate-950 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["medicineName", "dosage", "frequency", "duration", "quantity"] as const).map((field) => (
                  <input key={field} className="field" placeholder={field.replace(/([A-Z])/g, " $1")} required={field !== "quantity"} type={field === "quantity" ? "number" : "text"} value={medicine[field]} onChange={(event) => updateMedicine(setMedicines, medicines, index, field, event.target.value)} />
                ))}
              </div>
              <input className="field mt-3" placeholder="Additional instructions" value={medicine.additionalInstructions} onChange={(event) => updateMedicine(setMedicines, medicines, index, "additionalInstructions", event.target.value)} />
              {medicines.length > 1 && <button type="button" className="mt-3 text-sm text-rose-300" onClick={() => setMedicines(medicines.filter((_, itemIndex) => itemIndex !== index))}>Remove medicine</button>}
            </div>
          ))}
        </div>
        <button type="button" className="button-secondary mt-4" onClick={() => setMedicines([...medicines, emptyMedicine()])}>+ Add medicine</button>
        <textarea className="field mt-4 min-h-24" placeholder="Prescription instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
        <button className="button-primary mt-4 w-full" disabled={!savedConsultationId || saving}>{saving ? "Saving..." : "Issue prescription"}</button>
        <div className="mt-8 border-t border-slate-800 pt-6">
          <h3 className="font-semibold">Prescription history</h3>
          <div className="mt-3 space-y-3">
            {!prescriptions.length && <p className="text-sm text-slate-500">No prescriptions issued for this consultation.</p>}
            {prescriptions.map((prescription) => (
              <div key={prescription.prescriptionId} className="rounded-xl bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-300">{new Date(prescription.prescribedAt).toLocaleString()}</p>
                  <div className="flex items-center gap-2">
                    <StatusPill status={prescription.status} />
                    {prescription.status === "ACTIVE" && (
                      <button type="button" className="text-xs text-rose-300 hover:text-rose-200" onClick={() => revokePrescription(prescription.prescriptionId, setPrescriptions, setError)}>
                        Revoke
                      </button>
                    )}
                    <button type="button" className="text-xs text-slate-400 hover:text-white" onClick={() => removePrescription(prescription.prescriptionId, setPrescriptions, setError)}>
                      Remove
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-400">{prescription.items.map((item) => `${item.medicineName} · ${item.dosage} · ${item.frequency}`).join(" | ")}</p>
              </div>
            ))}
          </div>
        </div>
      </form>
      {(status || error) && <div className="xl:col-span-2">{error ? <ErrorMessage message={error} /> : <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{status}</p>}</div>}
    </div>
  );
}

async function revokePrescription(
  prescriptionId: string,
  setPrescriptions: React.Dispatch<React.SetStateAction<Prescription[]>>,
  setError: React.Dispatch<React.SetStateAction<string>>
) {
  const response = await fetch(`/api/prescriptions/${prescriptionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "REVOKED" })
  });
  const data = await response.json();
  if (!response.ok) {
    setError(data.error ?? "Unable to revoke prescription.");
    return;
  }
  setPrescriptions((current) =>
    current.map((prescription) =>
      prescription.prescriptionId === prescriptionId
        ? { ...prescription, status: "REVOKED" }
        : prescription
    )
  );
}

async function removePrescription(
  prescriptionId: string,
  setPrescriptions: React.Dispatch<React.SetStateAction<Prescription[]>>,
  setError: React.Dispatch<React.SetStateAction<string>>
) {
  if (!window.confirm("Remove this prescription permanently?")) return;

  const response = await fetch(`/api/prescriptions/${prescriptionId}`, {
    method: "DELETE"
  });
  const data = await response.json();
  if (!response.ok) {
    setError(data.error ?? "Unable to remove prescription.");
    return;
  }
  setPrescriptions((current) =>
    current.filter((prescription) => prescription.prescriptionId !== prescriptionId)
  );
}

function updateMedicine(
  setMedicines: React.Dispatch<React.SetStateAction<Medicine[]>>,
  medicines: Medicine[],
  index: number,
  field: keyof Medicine,
  value: string
) {
  setMedicines(medicines.map((medicine, itemIndex) => itemIndex === index ? { ...medicine, [field]: value } : medicine));
}
