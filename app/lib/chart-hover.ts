type ChartPoint = { x: number; entry: { at: string } };

/** Closest point to a pixel x-coordinate, or null for an empty series. */
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

export function chartHover<W extends ChartPoint, C extends ChartPoint>(
  weights: readonly W[],
  calories: readonly C[],
  px: number | null,
) {
  const activeWeight = px === null ? null : nearestByX(weights, px);
  const nearestCalorie = px === null ? null : nearestByX(calories, px);
  const anchor =
    activeWeight && nearestCalorie
      ? Math.abs(activeWeight.x - px!) <= Math.abs(nearestCalorie.x - px!)
        ? activeWeight
        : nearestCalorie
      : activeWeight ?? nearestCalorie;

  // Entries store local-wall-clock ISO timestamps. Match the full calendar
  // date, allowing weigh-ins and meals at different times on the same day.
  const activeCalorie = anchor && px !== null
    ? nearestByX(calories.filter((point) => point.entry.at.slice(0, 10) === anchor.entry.at.slice(0, 10)), px)
    : null;

  return { activeWeight, activeCalorie, anchor };
}
