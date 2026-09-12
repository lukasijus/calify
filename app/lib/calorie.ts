export type CalorieEntry = {
  id: string;
  kcal: number;
  at: string;
  hasImage: boolean;
};

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function imageSizeError(size: number): string | null {
  if (size === 0) return "The image is empty. Choose another image.";
  return size > MAX_IMAGE_BYTES ? "Image must be 2 MB or smaller. Choose a smaller image." : null;
}

/** Detect supported image containers independently of unreliable phone MIME metadata. */
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function dailyCalories(entries: readonly CalorieEntry[]) {
  const days = new Map<string, number>();
  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + entry.kcal);
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, kcal]) => ({ day, kcal }));
}
