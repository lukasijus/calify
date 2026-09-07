import { asset } from './paths';
export type Detection = { resolution: [number, number]; corners: number[][]; ids: number[]; coverage: number; sharpness: number };
export type Plate = { svg: string; detectedCorners: number; opencv: string };
export class CalibrationClient {
  private worker: Worker;
  private nextId = 0;
  private closed = false;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor() {
    this.worker = new Worker(asset('/calibration/worker.js'));
    this.worker.onmessage = ({ data }) => {
      const entry = this.pending.get(data.id);
      if (!entry) return;
      clearTimeout(entry.timer); this.pending.delete(data.id);
      if (data.error) entry.reject(new Error(data.error)); else entry.resolve(data.result);
    };
    this.worker.onerror = () => this.close('Could not start the local solver. Check network access for the runtime download and browser WebAssembly support, then retry.');
  }
  request<T>(payload: Record<string, unknown>): Promise<T> {
    if (this.closed) return Promise.reject(new Error('Solver stopped. Use Prepare printable plate to restart it.'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => this.close('Solver timed out. Retry with fewer or smaller images; keep all images at the same resolution.'), 180_000);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      const transfers = payload.bytes instanceof ArrayBuffer ? [payload.bytes] : [];
      this.worker.postMessage({ id, payload }, transfers);
    });
  }
  close(message = 'Calibration cancelled. Start the solver again to retry.') {
    this.closed = true;
    this.worker.terminate();
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(message)); }
    this.pending.clear();
  }
}
