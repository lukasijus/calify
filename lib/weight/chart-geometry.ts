import type { WeightEntry } from "./types";

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 420;
const PADDING = { top: 52, right: 12, bottom: 48, left: 12 };

export type PlottedPoint = {
  x: number;
  y: number;
  entry: WeightEntry;
};

export type ChartLayout = {
  points: PlottedPoint[];
  minY: number;
  maxY: number;
  gridLines: number[];
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
};

/** Builds plot coordinates (in viewBox units) for a sorted list of entries. */
export function buildChartLayout(entries: WeightEntry[]): ChartLayout | null {
  if (entries.length === 0) return null;

  const times = entries.map((e) => new Date(e.recordedAt).getTime());
  const weights = entries.map((e) => e.weightKg);

  const minTime = times[0];
  const maxTime = times[times.length - 1];
  // Single-point domains still need a span so the point can be centered.
  const timeSpan = maxTime - minTime || 24 * 60 * 60 * 1000;

  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const range = rawMax - rawMin;
  const pad = Math.max(range * 0.2, 0.8);
  const minY = Math.floor((rawMin - pad) * 2) / 2;
  const maxY = Math.ceil((rawMax + pad) * 2) / 2;

  const plotLeft = PADDING.left;
  const plotRight = CHART_WIDTH - PADDING.right;
  const plotTop = PADDING.top;
  const plotBottom = CHART_HEIGHT - PADDING.bottom;

  const xScale = (time: number) =>
    plotLeft + ((time - minTime) / timeSpan) * (plotRight - plotLeft);
  const yScale = (weight: number) =>
    plotTop + (1 - (weight - minY) / (maxY - minY)) * (plotBottom - plotTop);

  const points = entries.map((entry) => ({
    x: xScale(new Date(entry.recordedAt).getTime()),
    y: yScale(entry.weightKg),
    entry,
  }));

  const gridLines = [minY, minY + (maxY - minY) / 3, minY + (2 * (maxY - minY)) / 3, maxY];

  return { points, minY, maxY, gridLines, plotLeft, plotRight, plotTop, plotBottom };
}

/** Smooth Catmull-Rom -> cubic Bezier path through the given points. */
export function buildSmoothLinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

/** Same as the line path, but closed along the bottom for an area fill. */
export function buildAreaPath(
  points: { x: number; y: number }[],
  plotBottom: number,
): string {
  if (points.length === 0) return "";
  const linePath = buildSmoothLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${plotBottom} L ${first.x} ${plotBottom} Z`;
}
