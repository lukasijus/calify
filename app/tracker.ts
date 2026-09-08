export type WeightEntry = { id: string; kg: number; at: string };
export type FoodEntry = { id: string; description: string; calories?: number; photo?: string; at: string };
export type TrackerData = { weights: WeightEntry[]; foods: FoodEntry[] };
export const STORAGE_KEY = "calify.tracker.v1";

export function localDateTime(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function dailyFoods(foods: FoodEntry[], day: string) {
  return foods.filter((food) => localDateTime(new Date(food.at)).slice(0, 10) === day)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function calorieTotal(foods: FoodEntry[]) {
  const recorded = foods.filter((food) => food.calories !== undefined);
  return recorded.length ? recorded.reduce((sum, food) => sum + food.calories!, 0) : null;
}

export function parseData(raw: string | null): TrackerData {
  if (raw === null) return { weights: [], foods: [] };
  const data = JSON.parse(raw);
  const validBase = (entry: { id: string; at: string }) => entry && typeof entry.id === "string" &&
    typeof entry.at === "string" && Number.isFinite(Date.parse(entry.at));
  if (!data || !Array.isArray(data.weights) || !Array.isArray(data.foods) ||
    !data.weights.every((entry: WeightEntry) => validBase(entry) && Number.isFinite(entry.kg) && entry.kg > 0 && entry.kg <= 1000) ||
    !data.foods.every((entry: FoodEntry) => validBase(entry) &&
      typeof entry.description === "string" && entry.description.trim().length > 0 &&
      (entry.calories === undefined || (Number.isFinite(entry.calories) && entry.calories >= 0)) &&
      (entry.photo === undefined || (typeof entry.photo === "string" && /^data:image\/jpeg;base64,/.test(entry.photo))))) {
    throw new Error("Invalid saved data");
  }
  return data;
}

// Keep photos small enough for a useful local feed, and store only decoded JPEGs.
export async function preparePhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG, or WebP photo under 10 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}
