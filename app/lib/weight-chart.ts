type Point = { x: number; y: number };

/** Monotone Hermite curve: controls stay between each pair of raw values. */
export function smoothPath(points: readonly Point[]): string {
  if (!points.length) return "";
  const slopes = points.slice(1).map((point, i) => {
    const dx = point.x - points[i].x;
    return dx > 0 ? (point.y - points[i].y) / dx : 0;
  });
  const tangents = points.map((_, i) => {
    const before = slopes[i - 1] ?? slopes[i] ?? 0;
    const after = slopes[i] ?? before;
    return before * after <= 0 ? 0 : Math.sign(before) * Math.min(Math.abs(before), Math.abs(after));
  });
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const third = (b.x - a.x) / 3;
    // Repeated timestamps remain real, vertical segments, never loops.
    path += third <= 0 ? ` L${b.x},${b.y}`
      : ` C${a.x + third},${a.y + tangents[i - 1] * third} ${b.x - third},${b.y - tangents[i] * third} ${b.x},${b.y}`;
  }
  return path;
}

/** Binary search in chronological screen coordinates; ties prefer the newer point. */
export function nearestPoint(points: readonly { x: number }[], x: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (points[middle].x <= x) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  if (low === points.length) return points.length - 1;
  return x - points[low - 1].x < points[low].x - x ? low - 1 : low;
}

type DateLabel = { x: number; text: string; index: number };

/** Reserve the final date first, then fit labels by their actual pixel bounds. */
export function dateLabels(candidates: readonly DateLabel[]) {
  const labels: (DateLabel & { anchor: "start" | "middle" | "end" })[] = [];
  if (!candidates.length) return labels;
  const first = candidates[0];
  const last = candidates[candidates.length - 1];
  const labelWidth = (text: string) => text.length * 7;
  if (last.x - first.x < labelWidth(first.text) + labelWidth(last.text) + 20) {
    return [{ ...last, anchor: "end" as const }];
  }
  labels.push({ ...first, anchor: "start" });
  let right = first.x + labelWidth(first.text);
  const lastLeft = last.x - labelWidth(last.text);
  for (const candidate of candidates.slice(1, -1)) {
    const half = labelWidth(candidate.text) / 2;
    if (candidate.x - half >= right + 28 && candidate.x + half <= lastLeft - 28
      && !labels.some((label) => label.text === candidate.text) && candidate.text !== last.text) {
      labels.push({ ...candidate, anchor: "middle" });
      right = candidate.x + half;
    }
  }
  if (last.text !== first.text) labels.push({ ...last, anchor: "end" });
  return labels;
}
