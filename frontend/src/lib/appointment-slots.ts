/**
 * Appointment slots are wall-clock times in India Standard Time (Asia/Kolkata).
 * PostgreSQL stores TIMESTAMPTZ instants in UTC; these helpers convert between
 * the patient's chosen IST date/time and the corresponding UTC instant.
 */
export const APPOINTMENT_TIME_ZONE = "Asia/Kolkata";
export const INDIA_UTC_OFFSET_MINUTES = 330;

export const FIXED_APPOINTMENT_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
] as const;

type FixedSlot = (typeof FIXED_APPOINTMENT_SLOTS)[number];

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Format a timestamp as an India-local slot key, e.g. 2026-11-05T11:30. */
export function formatIndiaSlotKey(value: string | Date): string {
  const instant = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid appointment timestamp.");

  // India has a fixed UTC+05:30 offset and does not observe daylight saving time.
  const indiaWallClock = new Date(
    instant.getTime() + INDIA_UTC_OFFSET_MINUTES * 60_000
  );
  const year = indiaWallClock.getUTCFullYear();
  const month = String(indiaWallClock.getUTCMonth() + 1).padStart(2, "0");
  const day = String(indiaWallClock.getUTCDate()).padStart(2, "0");
  const hour = String(indiaWallClock.getUTCHours()).padStart(2, "0");
  const minute = String(indiaWallClock.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** @deprecated Use formatIndiaSlotKey; retained for existing imports. */
export const formatUtcSlotKey = formatIndiaSlotKey;

/** Formats a Date using the browser's local timezone (not used for booking keys). */
export function formatLocalSlotKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error("Invalid appointment timestamp.");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** Returns whether an India-local appointment slot is at or before `now`. */
export function isPastSlot(date: string, slot: string, now = new Date()): boolean {
  return new Date(toUtcSlotIso(date, slot)).getTime() <= now.getTime();
}

/** Converts an India-local date and fixed slot into a UTC ISO timestamp. */
export function toUtcSlotIso(date: string, slot: string): string {
  if (
    !isValidCalendarDate(date) ||
    !FIXED_APPOINTMENT_SLOTS.includes(slot as FixedSlot)
  ) {
    throw new Error("Invalid appointment date or fixed slot.");
  }

  // Interpret the selected wall-clock time as IST, not UTC.
  return new Date(`${date}T${slot}:00.000+05:30`).toISOString();
}

/** Validates that an instant lands on one of the fixed slots in India time. */
export function isFixedUtcSlot(value: string | Date): boolean {
  const instant = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(instant.getTime())) return false;

  const indiaWallClock = new Date(
    instant.getTime() + INDIA_UTC_OFFSET_MINUTES * 60_000
  );
  const slot = `${String(indiaWallClock.getUTCHours()).padStart(2, "0")}:${String(
    indiaWallClock.getUTCMinutes()
  ).padStart(2, "0")}`;

  return (
    FIXED_APPOINTMENT_SLOTS.includes(slot as FixedSlot) &&
    indiaWallClock.getUTCSeconds() === 0 &&
    indiaWallClock.getUTCMilliseconds() === 0
  );
}
