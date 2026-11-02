import { z } from "zod";

const textField = (max: number) => z.string().trim().min(1).max(max);

export const prescriptionItemSchema = z.object({
  medicineName: textField(150),
  dosage: textField(100),
  frequency: textField(100),
  duration: textField(100),
  quantity: z.number().int().positive().optional(),
  additionalInstructions: z.string().trim().max(500).nullable().optional()
});

export const prescriptionInputSchema = z.object({
  consultationId: z.string().uuid(),
  instructions: z.string().trim().max(2000).nullable().optional(),
  items: z.array(prescriptionItemSchema).min(1).max(100)
});

export const prescriptionStatusSchema = z.object({
  status: z.enum(["ACTIVE", "REVOKED"])
});

export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;
