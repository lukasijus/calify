export type CalorieEntry = {
  id: string;
  kcal: number;
  at: string;
  image: string | null;
};

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Only small raster images are accepted; never arbitrary URLs or SVG. */
export function validImage(image: unknown): image is string | null {
  if (image === null) return true;
  if (typeof image !== "string" || image.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32) return false;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = match[2].length / 4 * 3 - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) return false;
  const prefix = atob(match[2].slice(0, 24));
  return match[1] === "jpeg" ? prefix.startsWith("\xff\xd8\xff")
    : match[1] === "png" ? prefix.startsWith("\x89PNG\r\n\x1a\n")
    : prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP";
}

export function validCalorieInput(body: unknown): body is { kcal: number; at: string; image?: string | null } {
  if (!body || typeof body !== "object") return false;
  const { kcal, at, image } = body as Record<string, unknown>;
  if (typeof kcal !== "number" || !Number.isInteger(kcal) || kcal <= 0 || kcal > 100_000) return false;
  if (typeof at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(at)) return false;
  // Check calendar components explicitly: Date.parse normalizes February 30.
  const date = new Date(`${at}Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== at.slice(0, 16)) return false;
  return validImage(image ?? null);
}

export function dailyCalories(entries: readonly CalorieEntry[]) {
  const days = new Map<string, { at: string; kcal: number }>();
  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    const total = days.get(day) ?? { at: `${day}T12:00:00.000`, kcal: 0 };
    total.kcal += entry.kcal;
    days.set(day, total);
  }
  return [...days.values()].sort((a, b) => a.at.localeCompare(b.at));
}
