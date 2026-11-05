import { describe, expect, it } from "vitest";
import {
  FIXED_APPOINTMENT_SLOTS,
  formatIndiaSlotKey,
  formatLocalSlotKey,
  formatUtcSlotKey,
  isPastSlot,
  isFixedUtcSlot,
  toUtcSlotIso,
} from "./appointment-slots";

describe("fixed India-time appointment slots", () => {
  it("contains unique half-hour slots in the expected day ranges", () => {
    expect(new Set(FIXED_APPOINTMENT_SLOTS).size).toBe(FIXED_APPOINTMENT_SLOTS.length);
    expect(FIXED_APPOINTMENT_SLOTS).toContain("09:00");
    expect(FIXED_APPOINTMENT_SLOTS).toContain("16:30");
    expect(FIXED_APPOINTMENT_SLOTS).not.toContain("12:00");
    expect(FIXED_APPOINTMENT_SLOTS).not.toContain("13:30");
  });

  it("formats a local Date without changing its browser-local wall clock", () => {
    expect(formatLocalSlotKey(new Date(2026, 9, 31, 9, 30))).toMatch(/T09:30$/);
  });

  it("converts India wall-clock time to the correct UTC instant", () => {
    expect(toUtcSlotIso("2026-11-05", "11:30")).toBe(
      "2026-11-05T06:00:00.000Z"
    );
  });

  it("formats stored UTC instants back to India-local slot keys", () => {
    expect(formatIndiaSlotKey("2026-11-05T06:00:00.000Z")).toBe(
      "2026-11-05T11:30"
    );
    expect(formatUtcSlotKey("2026-11-05T06:00:00.000Z")).toBe(
      "2026-11-05T11:30"
    );
  });

  it("validates allowed fixed slots in India time", () => {
    expect(isFixedUtcSlot("2026-11-05T06:00:00.000Z")).toBe(true);
    expect(isFixedUtcSlot("2026-11-05T05:45:00.000Z")).toBe(false);
  });

  it("detects past and present India-local slots", () => {
    const now = new Date("2026-10-31T04:00:00.000Z"); // 09:30 IST
    expect(isPastSlot("2026-10-31", "09:00", now)).toBe(true);
    expect(isPastSlot("2026-10-31", "09:30", now)).toBe(true);
    expect(isPastSlot("2026-10-31", "10:00", now)).toBe(false);
  });
});
