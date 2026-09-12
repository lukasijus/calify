export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type CalorieEntry = {
  id: string;
  kcal: number;
  at: string;
  hasImage: boolean;
};

export function imageError(image: { size: number; type: string }): string | null {
  if (image.size > MAX_IMAGE_BYTES) return "Image must be 8 MB or smaller. Choose a smaller image.";
  if (!image.size || !IMAGE_TYPES.includes(image.type)) return "Choose a JPEG, PNG or WebP image.";
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
