import { AppShell, PageIntro } from "@/components/app-shell";
import { ConsultationWorkspace } from "@/components/consultation-workspace";

export default async function ConsultationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell active="appointments">
      <PageIntro eyebrow="Consultation workspace" title="Continue patient care" description="Review the clinical record and add a prescription when the plan is ready." />
      <ConsultationWorkspace consultationId={id} />
    </AppShell>
  );
}
