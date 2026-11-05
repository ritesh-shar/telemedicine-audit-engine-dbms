"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileText,
  LoaderCircle,
  Pill,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface ClinicalNotes {
  complaints: string;
  examination: string;
  assessment: string;
  plan: string;
}

interface ConsultationResponse {
  symptoms?: string[];
  clinicalNotes?: Partial<ClinicalNotes>;
  postgres?: {
    appointmentId?: string;
  };
}

interface MedicineDraft {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  additionalInstructions: string;
}

interface PrescriptionItem {
  itemId?: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  additionalInstructions: string | null;
}

interface Prescription {
  prescriptionId: string;
  consultationId: string;
  prescribedAt: string;
  instructions: string | null;
  status: "ACTIVE" | "REVOKED";
  items: PrescriptionItem[];
}

const emptyNotes: ClinicalNotes = {
  complaints: "",
  examination: "",
  assessment: "",
  plan: "",
};

const emptyMedicine = (): MedicineDraft => ({
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "",
  additionalInstructions: "",
});

const noteFields: Array<{
  key: keyof ClinicalNotes;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: "complaints",
    label: "Presenting complaints",
    description: "Symptoms and history reported by the patient.",
    placeholder: "Document the patient's complaints and relevant history...",
  },
  {
    key: "examination",
    label: "Examination",
    description: "Relevant clinical examination findings.",
    placeholder: "Record examination findings...",
  },
  {
    key: "assessment",
    label: "Clinical assessment",
    description: "Your assessment based on the consultation.",
    placeholder: "Enter the clinical assessment...",
  },
  {
    key: "plan",
    label: "Care plan",
    description: "Treatment plan and recommended follow-up.",
    placeholder: "Document the proposed care plan...",
  },
];

const medicineFields: Array<{
  key: keyof MedicineDraft;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}> = [
  { key: "medicineName", label: "Medicine name", placeholder: "e.g. Medicine name", required: true },
  { key: "dosage", label: "Dosage", placeholder: "e.g. 500 mg", required: true },
  { key: "frequency", label: "Frequency", placeholder: "e.g. Twice daily", required: true },
  { key: "duration", label: "Duration", placeholder: "e.g. 5 days", required: true },
  { key: "quantity", label: "Quantity", placeholder: "Units", type: "number" },
];

function WorkspaceSkeleton() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Skeleton className="h-[620px] rounded-xl" />
      <Skeleton className="h-[620px] rounded-xl" />
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConsultationWorkspace({
  appointmentId,
  consultationId,
  initialData,
}: {
  appointmentId?: string;
  consultationId?: string;
  initialData?: {
    symptoms?: string[];
    clinicalNotes?: Partial<ClinicalNotes>;
  };
}) {
  const [savedConsultationId, setSavedConsultationId] = useState<string | undefined>(consultationId);
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | undefined>(appointmentId);
  const [symptoms, setSymptoms] = useState(initialData?.symptoms?.join(", ") ?? "");
  const [notes, setNotes] = useState<ClinicalNotes>({
    ...emptyNotes,
    ...initialData?.clinicalNotes,
  });
  const [medicines, setMedicines] = useState<MedicineDraft[]>([emptyMedicine()]);
  const [instructions, setInstructions] = useState("");

  const [consultationLoaded, setConsultationLoaded] = useState(!consultationId);
  const [prescriptionsLoadedFor, setPrescriptionsLoadedFor] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [savingConsultation, setSavingConsultation] = useState(false);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [busyPrescriptionId, setBusyPrescriptionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  // Load the existing MongoDB consultation document when opening a saved consultation.
  useEffect(() => {
    if (!consultationId) return;

    const controller = new AbortController();

    async function loadConsultation() {
      try {
        const response = await fetch(`/api/consultations/${encodeURIComponent(consultationId!)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load consultation.");
        }

        const consultation = data.consultation as ConsultationResponse;
        setActiveAppointmentId(consultation.postgres?.appointmentId ?? appointmentId);
        setSymptoms(consultation.symptoms?.join(", ") ?? "");
        setNotes({
          ...emptyNotes,
          ...consultation.clinicalNotes,
        });
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Unable to load consultation.");
        }
      } finally {
        if (!controller.signal.aborted) setConsultationLoaded(true);
      }
    }

    loadConsultation();
    return () => controller.abort();
  }, [consultationId, appointmentId]);

  // Prescription history is scoped to the currently opened consultation.
  useEffect(() => {
    if (!savedConsultationId) return;

    const controller = new AbortController();

    async function loadPrescriptions() {
      try {
        const response = await fetch("/api/prescriptions", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load prescription history.");
        }

        const matching = (data.prescriptions as Prescription[]).filter(
          (prescription) => prescription.consultationId === savedConsultationId
        );
        setPrescriptions(matching);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Unable to load prescription history.");
        }
      } finally {
        if (!controller.signal.aborted) setPrescriptionsLoadedFor(savedConsultationId!);
      }
    }

    loadPrescriptions();
    return () => controller.abort();
  }, [savedConsultationId]);

  async function saveConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAppointmentId) {
      setError("This workspace does not have an appointment ID.");
      return;
    }
    if (savedConsultationId) return;

    setSavingConsultation(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: activeAppointmentId,
          symptoms: symptoms.split(",").map((item) => item.trim()).filter(Boolean),
          observations: [],
          clinicalNotes: notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save consultation.");
      }

      setSavedConsultationId(data.consultationId as string);
      setStatusMessage("Consultation saved. You can now issue a prescription.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save consultation.");
    } finally {
      setSavingConsultation(false);
    }
  }

  async function createPrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!savedConsultationId) {
      setError("Save the consultation before issuing a prescription.");
      return;
    }

    setSavingPrescription(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId: savedConsultationId,
          instructions: instructions.trim() || null,
          items: medicines.map((medicine) => ({
            medicineName: medicine.medicineName.trim(),
            dosage: medicine.dosage.trim(),
            frequency: medicine.frequency.trim(),
            duration: medicine.duration.trim(),
            quantity: medicine.quantity.trim() ? Number(medicine.quantity) : undefined,
            additionalInstructions: medicine.additionalInstructions.trim() || undefined,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to issue prescription.");
      }

      setPrescriptions((current) => [...current, data.prescription as Prescription]);
      setMedicines([emptyMedicine()]);
      setInstructions("");
      setStatusMessage("Prescription issued successfully.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to issue prescription.");
    } finally {
      setSavingPrescription(false);
    }
  }

  async function revokePrescription(prescriptionId: string) {
    setBusyPrescriptionId(prescriptionId);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/prescriptions/${encodeURIComponent(prescriptionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVOKED" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to revoke prescription.");

      setPrescriptions((current) => current.map((prescription) =>
        prescription.prescriptionId === prescriptionId
          ? { ...prescription, status: "REVOKED" }
          : prescription
      ));
      setStatusMessage("Prescription revoked.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to revoke prescription.");
    } finally {
      setBusyPrescriptionId(null);
    }
  }

  async function removePrescription(prescriptionId: string) {
    if (!window.confirm("Permanently remove this prescription and its medicine items?")) return;

    setBusyPrescriptionId(prescriptionId);
    setError("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/prescriptions/${encodeURIComponent(prescriptionId)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to remove prescription.");

      setPrescriptions((current) => current.filter(
        (prescription) => prescription.prescriptionId !== prescriptionId
      ));
      setStatusMessage("Prescription removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove prescription.");
    } finally {
      setBusyPrescriptionId(null);
    }
  }

  function updateMedicine(index: number, field: keyof MedicineDraft, value: string) {
    setMedicines((current) => current.map((medicine, itemIndex) =>
      itemIndex === index ? { ...medicine, [field]: value } : medicine
    ));
  }

  const isSaved = Boolean(savedConsultationId);
  const prescriptionLoading = Boolean(savedConsultationId) && prescriptionsLoadedFor !== savedConsultationId;

  if (!consultationLoaded) {
    return <WorkspaceSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Clinical documentation and medication management</p>
          {activeAppointmentId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Appointment reference: <span className="font-mono">{activeAppointmentId}</span>
            </p>
          )}
        </div>
        <Badge variant={isSaved ? "secondary" : "outline"} className="gap-1.5">
          {isSaved ? <ShieldCheck className="size-3.5" /> : <FileText className="size-3.5" />}
          {isSaved ? "Consultation saved" : "Draft consultation"}
        </Badge>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {statusMessage && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Clinical notes */}
        <Card className="rounded-xl shadow-none">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <CardTitle>Clinical notes</CardTitle>
            <CardDescription>
              Record the patient&apos;s symptoms, examination, assessment, and care plan.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={saveConsultation} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="symptoms">Reported symptoms</Label>
                <Input
                  id="symptoms"
                  value={symptoms}
                  onChange={(event) => setSymptoms(event.target.value)}
                  placeholder="e.g. Headache, fatigue, fever"
                  readOnly={isSaved}
                />
                <p className="text-xs text-muted-foreground">Separate multiple symptoms with commas.</p>
              </div>

              <Separator />

              {noteFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Textarea
                    id={field.key}
                    rows={4}
                    value={notes[field.key]}
                    onChange={(event) => setNotes((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))}
                    placeholder={field.placeholder}
                    readOnly={isSaved}
                    required
                    className="min-h-24 resize-y"
                  />
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <p className="text-xs text-muted-foreground">
                  {isSaved
                    ? "This consultation has been saved. Its clinical notes are read-only."
                    : "Complete all four note sections before saving."}
                </p>
                <Button type="submit" disabled={savingConsultation || isSaved || !activeAppointmentId}>
                  {savingConsultation ? (
                    <><LoaderCircle className="size-4 animate-spin" /> Saving...</>
                  ) : isSaved ? (
                    <><CheckCircle2 className="size-4" /> Saved</>
                  ) : (
                    <><Save className="size-4" /> Save consultation</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Prescription editor and history */}
        <div className="space-y-6">
          <Card className="rounded-xl shadow-none">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Pill className="size-5" />
              </div>
              <CardTitle>Digital prescription</CardTitle>
              <CardDescription>
                Add medication instructions after saving the clinical consultation.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {!isSaved ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">Save the consultation first</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prescription creation becomes available once the clinical notes are saved.
                  </p>
                </div>
              ) : (
                <form onSubmit={createPrescription} className="space-y-5">
                  {medicines.map((medicine, index) => (
                    <div key={index} className="space-y-4 rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Medicine {index + 1}</p>
                        {medicines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setMedicines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            <Trash2 className="size-4" /> Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {medicineFields.map((field) => (
                          <div key={field.key} className="space-y-1.5">
                            <Label htmlFor={`medicine-${index}-${field.key}`}>{field.label}</Label>
                            <Input
                              id={`medicine-${index}-${field.key}`}
                              type={field.type ?? "text"}
                              min={field.type === "number" ? 1 : undefined}
                              step={field.type === "number" ? 1 : undefined}
                              value={medicine[field.key]}
                              onChange={(event) => updateMedicine(index, field.key, event.target.value)}
                              placeholder={field.placeholder}
                              required={field.required}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`medicine-${index}-additionalInstructions`}>Additional medicine instructions</Label>
                        <Input
                          id={`medicine-${index}-additionalInstructions`}
                          value={medicine.additionalInstructions}
                          onChange={(event) => updateMedicine(index, "additionalInstructions", event.target.value)}
                          placeholder="Optional instructions for this medicine"
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setMedicines((current) => [...current, emptyMedicine()])}
                    disabled={medicines.length >= 100}
                  >
                    <Plus className="size-4" /> Add medicine
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="prescription-instructions">Overall prescription instructions</Label>
                    <Textarea
                      id="prescription-instructions"
                      rows={3}
                      maxLength={2000}
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      placeholder="General instructions for the patient..."
                      className="resize-y"
                    />
                    <p className="text-right text-xs text-muted-foreground">{instructions.length}/2000 characters</p>
                  </div>

                  <Button type="submit" className="w-full" disabled={savingPrescription}>
                    {savingPrescription ? (
                      <><LoaderCircle className="size-4 animate-spin" /> Issuing...</>
                    ) : (
                      <><Pill className="size-4" /> Issue prescription</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Review medicine names, dosages, frequency, and duration before issuing.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Prescription history</CardTitle>
                  <CardDescription>Prescriptions linked to this consultation.</CardDescription>
                </div>
                <Badge variant="secondary">{prescriptions.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!isSaved ? (
                <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  Prescription history will appear after the consultation is saved.
                </p>
              ) : prescriptionLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-lg" />
                  <Skeleton className="h-20 rounded-lg" />
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <FileText className="mx-auto size-7 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No prescriptions issued yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Issued prescriptions will be listed here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((prescription) => (
                    <article key={prescription.prescriptionId} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{formatDateTime(prescription.prescribedAt)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {prescription.items.length} medicine item(s)
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={prescription.status === "ACTIVE"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-border bg-muted text-muted-foreground"}
                        >
                          {prescription.status}
                        </Badge>
                      </div>

                      {prescription.instructions && (
                        <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                          {prescription.instructions}
                        </p>
                      )}

                      <div className="mt-3 space-y-2">
                        {prescription.items.map((item, itemIndex) => (
                          <div key={item.itemId ?? `${prescription.prescriptionId}-${itemIndex}`} className="flex items-start gap-2 text-sm">
                            <Pill className="mt-0.5 size-4 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="font-medium">{item.medicineName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.dosage} · {item.frequency} · {item.duration}
                                {item.quantity !== null ? ` · Qty ${item.quantity}` : ""}
                              </p>
                              {item.additionalInstructions && (
                                <p className="mt-1 text-xs text-muted-foreground">{item.additionalInstructions}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-4" />
                      <div className="flex flex-wrap justify-end gap-2">
                        {prescription.status === "ACTIVE" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyPrescriptionId === prescription.prescriptionId}
                            onClick={() => revokePrescription(prescription.prescriptionId)}
                          >
                            {busyPrescriptionId === prescription.prescriptionId ? "Updating..." : "Revoke"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyPrescriptionId === prescription.prescriptionId}
                          onClick={() => removePrescription(prescription.prescriptionId)}
                        >
                          <Trash2 className="size-4" /> Remove
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
            <UserRound className="mt-0.5 size-4 shrink-0" />
            <p>Prescription and consultation actions are authorized by the server against the signed-in doctor&apos;s account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
