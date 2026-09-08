export type Weight = { date: string; kg: number };
export type CameraResult = {
  resolution: [number, number];
  cameraMatrix: number[][];
  distortion: number[];
  rms: number;
  perViewErrors: number[];
  usableImages: number;
};
export type Profile = CameraResult & {
  version: 1;
  board: typeof import('../public/calibration/board.json');
  camera: string;
  lens: string;
  timestamp: string;
};

export function validWeight(value: unknown): value is Weight {
  if (!value || typeof value !== 'object') return false;
  const w = value as Weight;
  return typeof w.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.date)
    && !Number.isNaN(Date.parse(w.date)) && new Date(w.date).toISOString().slice(0, 10) === w.date
    && typeof w.kg === 'number' && Number.isFinite(w.kg) && w.kg > 0 && w.kg <= 1000;
}
export function validWeights(value: unknown): value is Weight[] {
  return Array.isArray(value) && value.every(validWeight)
    && new Set(value.map(w => w.date)).size === value.length;
}
export function upsertWeight(history: Weight[], entry: Weight): Weight[] {
  if (!validWeight(entry)) throw new Error('Enter a valid date and a weight greater than 0 and at most 1,000 kg.');
  return [...history.filter(w => w.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}
export function validResult(value: unknown): value is CameraResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as CameraResult;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  return Array.isArray(r.resolution) && r.resolution.length === 2 && r.resolution.every(n => Number.isInteger(n) && n > 0)
    && Array.isArray(r.cameraMatrix) && r.cameraMatrix.length === 3
    && r.cameraMatrix.every(row => Array.isArray(row) && row.length === 3 && row.every(finite))
    && r.cameraMatrix[0][0] > 0 && r.cameraMatrix[1][1] > 0
    && r.cameraMatrix[0][2] >= 0 && r.cameraMatrix[0][2] <= r.resolution[0]
    && r.cameraMatrix[1][2] >= 0 && r.cameraMatrix[1][2] <= r.resolution[1]
    && r.cameraMatrix[2][0] === 0 && r.cameraMatrix[2][1] === 0 && r.cameraMatrix[2][2] === 1
    && Array.isArray(r.distortion) && r.distortion.length === 5 && r.distortion.every(finite)
    && finite(r.rms) && r.rms >= 0 && r.rms <= 2
    && Number.isInteger(r.usableImages) && r.usableImages >= 8
    && Array.isArray(r.perViewErrors) && r.perViewErrors.length === r.usableImages
    && r.perViewErrors.every(n => finite(n) && n >= 0);
}
export function validProfile(value: unknown, board: Profile['board']): value is Profile {
  if (!validResult(value)) return false;
  const p = value as Profile;
  return p.version === 1 && typeof p.camera === 'string' && !!p.camera.trim()
    && typeof p.lens === 'string' && !!p.lens.trim()
    && typeof p.timestamp === 'string' && !Number.isNaN(Date.parse(p.timestamp))
    && p.board != null && Object.keys(board).every(key =>
      JSON.stringify(p.board[key as keyof typeof board]) === JSON.stringify(board[key as keyof typeof board]));
}
export function readLocal<T>(storage: Pick<Storage, 'getItem'>, key: string, validate: (v: unknown) => v is T, fallback: T): T {
  const raw = storage.getItem(key);
  if (raw === null) return fallback;
  const value: unknown = JSON.parse(raw);
  if (!validate(value)) throw new Error('Saved data is incompatible or damaged. It has not been overwritten.');
  return value;
}
export function writeLocal(storage: Pick<Storage, 'setItem'>, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value));
}
