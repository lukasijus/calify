// Fixed to "en-GB" (day before month, e.g. "8 Sep") so the chart reads the
// same way regardless of the visitor's browser locale.
const AXIS_LABEL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export function formatAxisDate(iso: string): string {
  return AXIS_LABEL_FORMAT.format(new Date(iso));
}

export function formatTooltip(iso: string, weightKg: number): string {
  return `${TOOLTIP_DATE_FORMAT.format(new Date(iso))} · ${formatWeight(weightKg)}`;
}

export function formatWeight(weightKg: number): string {
  return `${weightKg.toFixed(1)} kg`;
}

/** Local `datetime-local` input value for "now", e.g. 2026-09-09T14:30. */
export function nowForDateTimeInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
