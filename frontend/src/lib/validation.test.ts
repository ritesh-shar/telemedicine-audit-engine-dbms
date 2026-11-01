import { describe, expect, it } from "vitest";
import {
  loginSchema,
  patientRegistrationSchema,
} from "./validation";

describe("patientRegistrationSchema", () => {
  const validPatient = {
    fullName: "Ritesh Sharma",
    email: "RITESH@example.com",
    password: "secure-password",
  };

  it("normalizes email and accepts a valid patient registration", () => {
    const result = patientRegistrationSchema.safeParse(validPatient);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ritesh@example.com");
    }
  });

  it("rejects public registration of privileged roles", () => {
    const result = patientRegistrationSchema.safeParse({
      ...validPatient,
      role: "ADMIN",
    });

    expect(result.success).toBe(false);
  });

  it("rejects passwords over 72 UTF-8 bytes", () => {
    const result = patientRegistrationSchema.safeParse({
      ...validPatient,
      password: `${"a".repeat(69)}🚑`,
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalizes email and requires a password", () => {
    expect(loginSchema.safeParse({
      email: "Patient@example.com",
      password: "any-existing-password",
    })).toMatchObject({
      success: true,
      data: {
        email: "patient@example.com",
      },
    });

    expect(loginSchema.safeParse({
      email: "patient@example.com",
      password: "",
    }).success).toBe(false);
  });
});
