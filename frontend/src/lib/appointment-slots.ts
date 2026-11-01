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

export function formatLocalSlotKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function formatUtcSlotKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function isPastSlot(date: string, slot: string, now = new Date()): boolean {
  return new Date(`${date}T${slot}:00.000Z`) <= now;
}

export function toUtcSlotIso(date: string, slot: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !FIXED_APPOINTMENT_SLOTS.includes(slot as (typeof FIXED_APPOINTMENT_SLOTS)[number])) {
    throw new Error("Invalid appointment date or fixed slot.");
  }

  return `${date}T${slot}:00.000Z`;
}

export function isFixedUtcSlot(value: string | Date): boolean {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const slot = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return (
    FIXED_APPOINTMENT_SLOTS.includes(slot as (typeof FIXED_APPOINTMENT_SLOTS)[number]) &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}
