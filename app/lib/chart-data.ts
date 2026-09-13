type CaloriePoint = { id: string; at: string; kcal: number };
type ChartPoint = { entry: { at: string }; x: number };

/** Stored timestamps are local wall-clock values; keep their calendar day. */
export function dailyCalories(entries: readonly CaloriePoint[]): CaloriePoint[] {
  const days = new Map<string, CaloriePoint>();
  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    const total = days.get(day);
    if (total) total.kcal += entry.kcal;
    else days.set(day, { id: day, at: `${day}T00:00:00.000`, kcal: entry.kcal });
  }
  return [...days.values()].sort((a, b) => a.at.localeCompare(b.at));
}

function nearestByX<T extends ChartPoint>(points: readonly T[], px: number): T | null {
  let nearest: T | null = null;
  let best = Infinity;
  for (const point of points) {
    const distance = Math.abs(point.x - px);
    if (distance < best) {
      best = distance;
      nearest = point;
    }
  }
  return nearest;
}

/** Snap to a plotted date, and only show values belonging to that date. */
export function chartSelection<W extends ChartPoint, C extends ChartPoint>(
  weights: readonly W[],
  calories: readonly C[],
  px: number,
) {
  const anchor = nearestByX<W | C>([...weights, ...calories], px);
  const day = anchor?.entry.at.slice(0, 10);
  return {
    anchor,
    activeWeight: nearestByX(weights.filter((p) => p.entry.at.slice(0, 10) === day), px),
    activeCalorie: nearestByX(calories.filter((p) => p.entry.at.slice(0, 10) === day), px),
  };
}
