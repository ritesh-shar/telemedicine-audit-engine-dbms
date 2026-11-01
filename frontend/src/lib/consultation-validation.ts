import { z } from "zod";

const observationSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().min(1),
  recordedAt: z.coerce.date()
});

export const consultationInputSchema = z.object({
  appointmentId: z.string().uuid(),
  symptoms: z.array(z.string().min(1)),
  observations: z.array(observationSchema),
  clinicalNotes: z.object({
    complaints: z.string(),
    examination: z.string(),
    assessment: z.string(),
    plan: z.string()
  }),
  consultationId: z.string().uuid().optional()
});

export type ConsultationInput = z.infer<typeof consultationInputSchema>;
