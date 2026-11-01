import { ConsultationWorkspace } from "@/components/consultation-workspace";
import { AppShell, PageIntro } from "@/components/app-shell";

export default async function NewConsultationPage({
  searchParams
}: {
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const { appointmentId } = await searchParams;
  return (
    <AppShell active="appointments">
      <PageIntro eyebrow="Consultation workspace" title="Start a consultation" description="Record the visit and prepare a prescription in one focused workspace." />
      <ConsultationWorkspace appointmentId={appointmentId} />
    </AppShell>
  );
}
