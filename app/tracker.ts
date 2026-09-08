export type WeightEntry = { id: string; date: string; kg: number };
export type FoodEntry = { id: string; date: string; description: string; calories?: number; photo?: Blob };
export type Entries = { weights: WeightEntry[]; foods: FoodEntry[] };

export function localDateTime(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function dailyFoods(foods: FoodEntry[], day: string) {
  return foods.filter((food) => localDateTime(new Date(food.date)).slice(0, 10) === day)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function calorieTotal(foods: FoodEntry[]) {
  return foods.some((food) => food.calories !== undefined)
    ? foods.reduce((sum, food) => sum + (food.calories ?? 0), 0) : null;
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("calify-tracker", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("weights", { keyPath: "id" });
      request.result.createObjectStore("foods", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Calify tabs and reload."));
  });
}

export async function readEntries(): Promise<Entries> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(["weights", "foods"], "readonly");
      const weights = transaction.objectStore("weights").getAll();
      const foods = transaction.objectStore("foods").getAll();
      transaction.oncomplete = () => resolve({ weights: weights.result, foods: foods.result });
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function writeEntry(store: "weights" | "foods", entry: WeightEntry | FoodEntry | string) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const collection = transaction.objectStore(store);
      if (typeof entry === "string") collection.delete(entry);
      else collection.put(entry);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 15 MB.");
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("This image could not be opened. Try a JPEG, PNG, or WebP photo."); }
  try {
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable. Try saving without a photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Unable to process this photo.")), "image/jpeg", 0.8,
    ));
  } finally { bitmap.close(); }
}
