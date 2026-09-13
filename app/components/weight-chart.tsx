"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatDayMonth } from "../lib/date";
import { chartSelection } from "../lib/chart-data";
import type { WeightEntry } from "../lib/weight";

type TrendPoint = { at: string; kg: number };

export type CaloriePoint = { id: string; at: string; kcal: number };

type WeightChartProps = {
  entries: WeightEntry[];
  /**
   * Optional smoothed series (e.g. 7-day moving average). Rendered as a second,
   * thinner line so raw weigh-ins stay distinguishable from the trend. Not
   * currently supplied by the page — the hook is here so it can be enabled
   * without reworking the chart.
   */
  trend?: TrendPoint[];
  /** Daily calorie totals drawn on the same canvas, right-hand axis. */
  calories?: CaloriePoint[];
  /** Legend/checkbox visibility, lifted to the parent so other UI (e.g. the
   * image thumbnail strip) can react to the same toggle. */
  showWeight: boolean;
  showCalories: boolean;
  onToggleWeight: () => void;
  onToggleCalories: () => void;
};

const WEIGHT_COLOR = "#2f6bff";
const CALORIE_COLOR = "#ff8a3d";
const PADDING = { top: 20, right: 16, bottom: 28, left: 44 } as const;
const DUAL_AXIS_RIGHT_PADDING = 40;

function formatKg(kg: number): string {
  return kg.toFixed(1);
}

function formatKcal(kcal: number): string {
  return Math.round(kcal).toString();
}

/** "Nice" number for axis ticks (Heckbert's algorithm). */
function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range || 1));
  const fraction = (range || 1) / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }
  return niceFraction * 10 ** exponent;
}

function niceScale(min: number, max: number, maxTicks = 5) {
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(1, maxTicks - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { min: niceMin, max: niceMax, step, ticks };
}

/** Catmull-Rom spline → cubic bezier path. `tension` closer to 0 hugs points. */
function smoothPath(points: ReadonlyArray<{ x: number; y: number }>, tension = 0.2): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function WeightChart({
  entries,
  trend,
  calories = [],
  showWeight,
  showCalories,
  onToggleWeight,
  onToggleCalories,
}: WeightChartProps) {
  const [containerRef, width] = useContainerWidth();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ px: number; pointerY: number } | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ w: 150, h: 56 });

  const weightVisible = showWeight && entries.length > 0;
  const caloriesVisible = showCalories && calories.length > 0;
  const dualAxis = weightVisible && caloriesVisible;

  const height =
    width === 0
      ? 300
      : width < 480
        ? Math.round(width * 0.82)
        : Math.round(Math.min(width * 0.46, 420));

  const layout = useMemo(
    () => ({
      left: PADDING.left,
      right: width - (dualAxis ? DUAL_AXIS_RIGHT_PADDING : PADDING.right),
      top: PADDING.top,
      bottom: height - PADDING.bottom,
    }),
    [width, height, dualAxis],
  );

  const model = useMemo(() => {
    if ((!weightVisible && !caloriesVisible) || width === 0) return null;

    const times = [
      ...(weightVisible ? entries.map((e) => Date.parse(e.at)) : []),
      ...(caloriesVisible ? calories.map((c) => Date.parse(c.at)) : []),
    ];
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeSpan = maxTime - minTime || 1;
    const singlePoint = times.length <= 1 || minTime === maxTime;

    const xFor = (time: number) =>
      singlePoint
        ? (layout.left + layout.right) / 2
        : layout.left + ((time - minTime) / timeSpan) * (layout.right - layout.left);

    let weightScale: ReturnType<typeof niceScale> | null = null;
    let weightPoints: { entry: WeightEntry; x: number; y: number }[] = [];
    let yForWeight: (kg: number) => number = () => layout.bottom;
    if (weightVisible) {
      const values = entries.map((e) => e.kg);
      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);
      const valuePad = Math.max((dataMax - dataMin) * 0.18, 0.4);
      weightScale = niceScale(dataMin - valuePad, dataMax + valuePad, 5);
      const scale = weightScale;
      yForWeight = (kg) =>
        layout.bottom - ((kg - scale.min) / (scale.max - scale.min)) * (layout.bottom - layout.top);
      weightPoints = entries.map((entry) => ({
        entry,
        x: xFor(Date.parse(entry.at)),
        y: yForWeight(entry.kg),
      }));
    }

    let calorieScale: ReturnType<typeof niceScale> | null = null;
    let caloriePoints: { entry: CaloriePoint; x: number; y: number }[] = [];
    let yForCalories: (kcal: number) => number = () => layout.bottom;
    if (caloriesVisible) {
      const values = calories.map((c) => c.kcal);
      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);
      const valuePad = Math.max((dataMax - dataMin) * 0.18, 40);
      calorieScale = niceScale(Math.max(0, dataMin - valuePad), dataMax + valuePad, 5);
      const scale = calorieScale;
      yForCalories = (kcal) =>
        layout.bottom - ((kcal - scale.min) / (scale.max - scale.min)) * (layout.bottom - layout.top);
      caloriePoints = calories.map((entry) => ({
        entry,
        x: xFor(Date.parse(entry.at)),
        y: yForCalories(entry.kcal),
      }));
    }

    const trendPoints =
      weightVisible && trend && trend.length > 1
        ? trend
            .filter((p) => Date.parse(p.at) >= minTime && Date.parse(p.at) <= maxTime)
            .map((p) => ({ x: xFor(Date.parse(p.at)), y: yForWeight(p.kg) }))
        : [];

    // Sparse, non-overlapping x labels: first + last + evenly spaced middles.
    const labelSource = weightVisible ? weightPoints : caloriePoints;
    const maxLabels = width < 380 ? 3 : width < 560 ? 4 : 6;
    const labelIndexes: number[] = [];
    if (labelSource.length <= maxLabels) {
      for (let i = 0; i < labelSource.length; i++) labelIndexes.push(i);
    } else {
      for (let i = 0; i < maxLabels; i++) {
        labelIndexes.push(Math.round((i * (labelSource.length - 1)) / (maxLabels - 1)));
      }
    }
    const xLabels = labelIndexes
      .filter((value, i, arr) => arr.indexOf(value) === i)
      .map((index) => ({
        index,
        x: labelSource[index].x,
        text: formatDayMonth(new Date(labelSource[index].entry.at)),
      }))
      .filter((label, i, arr) => i === 0 || label.text !== arr[i - 1].text);

    const weightTickDecimals = weightScale && weightScale.step < 1 ? 1 : 0;
    const weightTicks = weightScale
      ? weightScale.ticks.filter((t) => t >= weightScale!.min - 1e-9 && t <= weightScale!.max + 1e-9)
      : [];
    const calorieTicks = calorieScale
      ? calorieScale.ticks.filter((t) => t >= calorieScale!.min - 1e-9 && t <= calorieScale!.max + 1e-9)
      : [];
    const formatWeightTick = (t: number) => `${t.toFixed(weightTickDecimals)}kg`;
    const formatCalorieTick = (t: number) => `${formatKcal(t)}kcal`;

    // Weight is the primary (left, gridded) axis whenever it's shown; calories
    // take the left axis only when weight is hidden, and always fall back to
    // the ungridded right axis alongside weight.
    const primaryAxis = weightVisible
      ? { ticks: weightTicks, yFor: yForWeight, format: formatWeightTick }
      : caloriesVisible
        ? { ticks: calorieTicks, yFor: yForCalories, format: formatCalorieTick }
        : null;
    const secondaryAxis = dualAxis ? { ticks: calorieTicks, yFor: yForCalories, format: formatKcal } : null;

    return {
      weightPoints,
      caloriePoints,
      latestWeight: weightPoints[weightPoints.length - 1] ?? null,
      trendPoints,
      primaryAxis,
      secondaryAxis,
      yForWeight,
      yForCalories,
      xLabels,
      weightLinePath: smoothPath(weightPoints),
      calorieLinePath: smoothPath(caloriePoints),
    };
  }, [entries, calories, trend, width, layout, weightVisible, caloriesVisible, dualAxis]);

  useLayoutEffect(() => {
    if (!tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    setTooltipSize((prev) =>
      Math.abs(prev.w - rect.width) > 1 || Math.abs(prev.h - rect.height) > 1
        ? { w: rect.width, h: rect.height }
        : prev,
    );
  }, [hover]);

  const handlePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!model) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (px < layout.left - 12 || px > layout.right + 12) {
      setHover(null);
      return;
    }
    setHover({ px, pointerY: py });
  };

  const clearHover = () => setHover(null);

  const { anchor, activeWeight, activeCalorie } = hover && model
    ? chartSelection(model.weightPoints, model.caloriePoints, hover.px)
    : { anchor: null, activeWeight: null, activeCalorie: null };
  const latestWeight = model ? model.latestWeight : null;

  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (anchor && hover) {
    const gap = 14;
    tooltipLeft = anchor.x + gap;
    if (tooltipLeft + tooltipSize.w > width - 4) tooltipLeft = anchor.x - gap - tooltipSize.w;
    tooltipLeft = Math.max(4, tooltipLeft);
    tooltipTop = hover.pointerY - tooltipSize.h - gap;
    if (tooltipTop < 4) tooltipTop = hover.pointerY + gap;
    tooltipTop = Math.min(tooltipTop, height - tooltipSize.h - 4);
  }

  return (
    <div className="wc-chart-wrap">
      <div className="wc-legend" role="group" aria-label="Show/hide graphs">
        <label className="wc-legend-item">
          <input type="checkbox" checked={showWeight} onChange={onToggleWeight} />
          <span className="wc-legend-dot" style={{ background: WEIGHT_COLOR }} />
          Weight
        </label>
        <label className="wc-legend-item">
          <input type="checkbox" checked={showCalories} onChange={onToggleCalories} />
          <span className="wc-legend-dot" style={{ background: CALORIE_COLOR }} />
          Calories
        </label>
      </div>
      <div
        ref={containerRef}
        className={`wc-chart${!weightVisible && !caloriesVisible ? " wc-chart-empty" : ""}`}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={clearHover}
        onPointerCancel={clearHover}
      >
        {!weightVisible && !caloriesVisible && (
          <p>
            {entries.length === 0 && calories.length === 0
              ? "No entries yet. Add a weigh-in or calories to start the graph."
              : "Turn on Weight or Calories above to see the graph."}
          </p>
        )}
        {width > 0 && model && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Weight and calories history chart"
          >
            <defs>
              <linearGradient id="wc-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={WEIGHT_COLOR} stopOpacity={0.16} />
                <stop offset="100%" stopColor={WEIGHT_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* horizontal grid + y labels for the primary axis (weight when
                shown, otherwise calories) */}
            {model.primaryAxis?.ticks.map((tick) => {
              const y = model.primaryAxis!.yFor(tick);
              return (
                <g key={`primary-${tick}`}>
                  <line
                    x1={layout.left}
                    x2={layout.right}
                    y1={y}
                    y2={y}
                    stroke="#ececf0"
                    strokeWidth={1}
                    strokeDasharray="4 7"
                  />
                  <text
                    x={layout.left - 10}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="wc-axis-label"
                  >
                    {model.primaryAxis!.format(tick)}
                  </text>
                </g>
              );
            })}

            {/* right-hand calorie axis labels, only when both series share
                the canvas (calories-only uses the primary axis above). */}
            {model.secondaryAxis?.ticks.map((tick) => (
              <text
                key={`secondary-${tick}`}
                x={layout.right + 8}
                y={model.secondaryAxis!.yFor(tick)}
                textAnchor="start"
                dominantBaseline="middle"
                className="wc-axis-label wc-axis-label-calorie"
              >
                {model.secondaryAxis!.format(tick)}
              </text>
            ))}

            {/* x labels */}
            {model.xLabels.map((label, i) => (
              <text
                key={`${label.text}-${label.index}`}
                x={label.x}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === model.xLabels.length - 1 ? "end" : "middle"}
                className="wc-axis-label"
              >
                {label.text}
              </text>
            ))}

            {/* weight area + line */}
            {weightVisible && model.weightPoints.length > 1 && (
              <path
                d={`${model.weightLinePath} L${layout.right},${layout.bottom} L${model.weightPoints[0].x},${layout.bottom} Z`}
                fill="url(#wc-area)"
              />
            )}
            {weightVisible && model.trendPoints.length > 1 && (
              <path
                d={smoothPath(model.trendPoints)}
                fill="none"
                stroke={WEIGHT_COLOR}
                strokeOpacity={0.35}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            )}
            {weightVisible && (
              <path
                d={model.weightLinePath}
                fill="none"
                stroke={WEIGHT_COLOR}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* calorie line + daily dots (logs are sparse, so every point
                is marked rather than only the latest). */}
            {caloriesVisible && model.caloriePoints.length > 1 && (
              <path
                d={model.calorieLinePath}
                fill="none"
                stroke={CALORIE_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {caloriesVisible &&
              model.caloriePoints.map((point) => (
                <circle
                  key={point.entry.id}
                  cx={point.x}
                  cy={point.y}
                  r={activeCalorie === point ? 4.5 : 3}
                  fill={CALORIE_COLOR}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              ))}

            {/* latest weight marker + quiet guide (hidden while scrubbing) */}
            {latestWeight && !anchor && (
              <>
                <line
                  x1={latestWeight.x}
                  x2={latestWeight.x}
                  y1={layout.top}
                  y2={layout.bottom}
                  stroke="#ececf0"
                  strokeWidth={1}
                />
                <text
                  x={Math.min(latestWeight.x, layout.right)}
                  y={layout.top - 7}
                  textAnchor="end"
                  className="wc-axis-label"
                >
                  {formatDayMonth(new Date(latestWeight.entry.at))}
                </text>
                <circle cx={latestWeight.x} cy={latestWeight.y} r={8} fill={WEIGHT_COLOR} fillOpacity={0.14} />
                <circle
                  cx={latestWeight.x}
                  cy={latestWeight.y}
                  r={4}
                  fill={WEIGHT_COLOR}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </>
            )}

            {/* hover crosshair + point */}
            {anchor && (
              <>
                <line
                  x1={anchor.x}
                  x2={anchor.x}
                  y1={layout.top}
                  y2={layout.bottom}
                  stroke="#c7c7d1"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
                {activeWeight && (
                  <>
                    <circle cx={activeWeight.x} cy={activeWeight.y} r={9} fill={WEIGHT_COLOR} fillOpacity={0.14} />
                    <circle
                      cx={activeWeight.x}
                      cy={activeWeight.y}
                      r={4.5}
                      fill={WEIGHT_COLOR}
                      stroke="#fff"
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </>
            )}
          </svg>
        )}

        {anchor && hover && (
          <div
            ref={tooltipRef}
            className="wc-tooltip"
            style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
          >
            <div className="wc-tooltip-date">{formatDayMonth(new Date(anchor.entry.at))}</div>
            {activeWeight && (
              <div className="wc-tooltip-row">
                <span className="wc-tooltip-dot" style={{ background: WEIGHT_COLOR }} />
                <span className="wc-tooltip-label">Weight</span>
                <span className="wc-tooltip-value">{formatKg(activeWeight.entry.kg)} kg</span>
              </div>
            )}
            {activeCalorie && (
              <div className="wc-tooltip-row">
                <span className="wc-tooltip-dot" style={{ background: CALORIE_COLOR }} />
                <span className="wc-tooltip-label">Calories</span>
                <span className="wc-tooltip-value">{formatKcal(activeCalorie.entry.kcal)} kcal</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
