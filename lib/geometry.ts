export type Point = { x: number; y: number };
export type Segment = [Point, Point];
export type View = 'front' | 'side';
export type Measurement = { cm: number; view: View; quality: 'manual-review'; warnings: string[] };
export const geometryWarning = 'Scale assumes the reference and body are at the same depth, parallel to the image plane. Perspective and depth offsets are not corrected.';
export function distance([a, b]: Segment) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
export function measure(segment: Segment, reference: Segment, referenceCm: number, view: View): Measurement {
  const pixels = distance(reference);
  const width = Math.abs(segment[1].x - segment[0].x);
  if (!Number.isFinite(referenceCm) || referenceCm <= 0 || !Number.isFinite(pixels) || pixels < 10 || !Number.isFinite(width) || width < 2) throw new Error('Use a positive reference size and clearly separated points.');
  if (Math.abs(reference[1].y - reference[0].y) > pixels * 0.1) throw new Error('Reference must be horizontal. Level the camera and recapture.');
  return { cm: width / pixels * referenceCm, view, quality: 'manual-review', warnings: [geometryWarning, 'Silhouette endpoints and anatomical level require human validation.'] };
}
/** Ramanujan II, with measured diameters converted to semi-axes. */
export function ellipseCircumference(width: number, depth: number) {
  if (![width, depth].every(v => Number.isFinite(v) && v > 0)) throw new Error('Ellipse diameters must be positive.');
  const a = width / 2, b = depth / 2;
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
}
/** Seeded row segmentation: compare pixels to a sampled plain background. */
export function silhouetteRow(data: Uint8ClampedArray, width: number, height: number, seed: Point, background: Point, threshold = 45): Segment {
  const x = Math.round(seed.x), y = Math.round(seed.y);
  const bx = Math.round(background.x), by = Math.round(background.y);
  if (![x, y, bx, by].every(Number.isFinite) || x < 0 || x >= width || y < 0 || y >= height || bx < 0 || bx >= width || by < 0 || by >= height || data.length !== width * height * 4) throw new Error('Select points inside the image.');
  const bg = (by * width + bx) * 4;
  const foreground = (column: number) => {
    const i = (y * width + column) * 4;
    return Math.hypot(data[i] - data[bg], data[i + 1] - data[bg + 1], data[i + 2] - data[bg + 2]) > threshold;
  };
  if (!foreground(x)) throw new Error('Body blends into the background. Choose a contrasting background or mark edges manually.');
  let left = x, right = x;
  while (left > 0 && foreground(left - 1)) left--;
  while (right < width - 1 && foreground(right + 1)) right++;
  if (left === 0 || right === width - 1 || right - left < 2) throw new Error('No reliable silhouette boundaries. Mark edges manually or recapture.');
  return [{ x: left, y }, { x: right, y }];
}
