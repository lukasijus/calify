export type WeightEntry = { id: string; kind: "weight"; at: string; kg: number };
export type FoodEntry = { id: string; kind: "food"; at: string; description: string; calories?: number; photo?: string };
export type Entry = WeightEntry | FoodEntry;

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localDateTime(date = new Date()) {
  return `${localDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function foodsForDay(entries: Entry[], day: string) {
  return entries.filter((entry): entry is FoodEntry => entry.kind === "food" && localDate(new Date(entry.at)) === day)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function calorieTotal(foods: FoodEntry[]) {
  const known = foods.filter((food) => food.calories !== undefined);
  return known.length ? known.reduce((sum, food) => sum + food.calories!, 0) : null;
}

export function orderedWeights(entries: Entry[]) {
  return entries.filter((entry): entry is WeightEntry => entry.kind === "weight")
    .sort((a, b) => a.at.localeCompare(b.at));
}

// Each record is saved independently, including its resized photo when present.
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("calify", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("entries", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Storage is blocked by another tab."));
  });
}

export async function readEntries(): Promise<Entry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("entries", "readonly");
    const request = transaction.objectStore("entries").getAll();
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function saveEntry(entry: Entry): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("entries", "readwrite");
    transaction.objectStore("entries").add(entry);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function removeEntry(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("entries", "readwrite");
    transaction.objectStore("entries").delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 10 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    throw new Error("This image could not be opened. Try a JPEG, PNG, or WebP photo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
