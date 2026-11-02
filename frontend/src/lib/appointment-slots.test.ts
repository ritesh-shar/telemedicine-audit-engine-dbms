import { describe, expect, it } from "vitest";
import {
  FIXED_APPOINTMENT_SLOTS,
  formatLocalSlotKey,
  formatUtcSlotKey,
  isPastSlot,
  isFixedUtcSlot,
  toUtcSlotIso,
} from "./appointment-slots";

describe("fixed appointment slots", () => {
  it("contains unique half-hour slots in the expected day ranges", () => {
    expect(new Set(FIXED_APPOINTMENT_SLOTS).size).toBe(FIXED_APPOINTMENT_SLOTS.length);
    expect(FIXED_APPOINTMENT_SLOTS).toContain("09:00");
    expect(FIXED_APPOINTMENT_SLOTS).toContain("16:30");
    expect(FIXED_APPOINTMENT_SLOTS).not.toContain("12:00");
    expect(FIXED_APPOINTMENT_SLOTS).not.toContain("13:30");
  });

  it("formats a local appointment key without timezone conversion", () => {
    expect(formatLocalSlotKey(new Date(2026, 9, 31, 9, 30))).toBe(
      "2026-10-31T09:30"
    );
  });

  it("detects past and present slots", () => {
    const now = new Date("2026-10-31T09:30:00.000Z");
    expect(isPastSlot("2026-10-31", "09:00", now)).toBe(true);
    expect(isPastSlot("2026-10-31", "09:30", now)).toBe(true);
    expect(isPastSlot("2026-10-31", "10:00", now)).toBe(false);
  });

  it("converts fixed slots to and validates UTC timestamps", () => {
    expect(toUtcSlotIso("2026-10-31", "09:30")).toBe(
      "2026-10-31T09:30:00.000Z"
    );
    expect(formatUtcSlotKey("2026-10-31T09:30:00.000Z")).toBe(
      "2026-10-31T09:30"
    );
    expect(isFixedUtcSlot("2026-10-31T09:30:00.000Z")).toBe(true);
    expect(isFixedUtcSlot("2026-10-31T09:15:00.000Z")).toBe(false);
  });
});
