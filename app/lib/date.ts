/**
 * Local-time date helpers shared by every entry type (weight, calories, ...).
 *
 * Everything here stores/reads timestamps *without* a timezone offset so a
 * value round-trips in whatever timezone the viewer happens to be in, rather
 * than freezing to the timezone of whoever recorded it.
 */

/** Matches the local-wall-clock ISO strings entries store in `at` (no
 * timezone offset), with or without seconds/milliseconds. Shared by every
 * API route that accepts a client-supplied timestamp. */
export const LOCAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/** Normalize a validated `LOCAL_ISO` string to include seconds/millis. */
export function normalizeLocalIso(at: string): string {
  return at.length === 16 ? `${at}:00.000` : at;
}

/** ISO-like string without timezone, so it round-trips in local time. */
export function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`
  );
}

/** Value for an `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`). */
export function toDateTimeLocalValue(date: Date): string {
  return toLocalIso(date).slice(0, 16);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Compact axis/tooltip label, e.g. `8 Sep`. Fixed strings so it matches on
 * server and client regardless of the runtime's ICU locale data. */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
