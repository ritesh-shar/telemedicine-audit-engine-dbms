import { z } from "zod";

export const USER_ROLES = ["PATIENT", "DOCTOR", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    USER_ROLES.includes(value as UserRole)
  );
}

// Strictly for account creation and password updates.
// Do NOT use this for login validation.
const newPasswordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .refine(
    (password) => new TextEncoder().encode(password).length <= 72,
    "Password must not exceed 72 bytes."
  );

export const patientRegistrationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must contain at least 2 characters.")
    .max(100, "Full name must not exceed 100 characters."),

  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .max(255, "Email must not exceed 255 characters.")
    .transform((email) => email.toLowerCase()),

  password: newPasswordSchema,
}).strict();

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .max(255, "Email must not exceed 255 characters.")
    .transform((email) => email.toLowerCase()),

  // Login passwords should only check for existence.
  // Never enforce length or character constraints here to avoid locking out legacy users
  // if you change your password policy in the future.
  password: z.string().min(1, "Password is required."),
});

export type PatientRegistrationInput = z.infer<
  typeof patientRegistrationSchema
>;

export type LoginInput = z.infer<typeof loginSchema>;
