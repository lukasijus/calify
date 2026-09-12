"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { dailyCalories, type CalorieEntry } from "../lib/calories";
import { formatDayMonth, type WeightEntry } from "../lib/weight";

type TrendPoint = { at: string; kg: number };

type WeightChartProps = {
  entries: WeightEntry[];
  calories: CalorieEntry[];
  showWeight: boolean;
  showCalories: boolean;
  /**
   * Optional smoothed series (e.g. 7-day moving average). Rendered as a second,
   * thinner line so raw weigh-ins stay distinguishable from the trend. Not
   * currently supplied by the page — the hook is here so it can be enabled
   * without reworking the chart.
   */
  trend?: TrendPoint[];
};

const ACCENT = "#2f6bff";
const CALORIE_COLOR = "#c36b19";
const PADDING = { top: 20, right: 72, bottom: 28, left: 44 } as const;

function formatKg(kg: number): string {
  return kg.toFixed(1);
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

export function WeightChart({ entries, calories, showWeight, showCalories, trend }: WeightChartProps) {
  const [containerRef, width] = useContainerWidth();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const totals = useMemo(() => dailyCalories(calories), [calories]);
  const days = useMemo(() => [...new Set([...entries, ...calories].map((entry) => entry.at.slice(0, 10)))].sort(), [entries, calories]);
  const day = selectedDay && days.includes(selectedDay) ? selectedDay : days[days.length - 1];
  const dayImages = calories.filter((entry) => entry.at.startsWith(day) && entry.image);
  const dayWeight = entries.filter((entry) => entry.at.startsWith(day)).at(-1);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ pointerY: number } | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ w: 150, h: 56 });

  const height =
    width === 0
      ? 300
      : width < 480
        ? Math.round(width * 0.82)
        : Math.round(Math.min(width * 0.46, 420));

  const layout = useMemo(
    () => ({
      left: PADDING.left,
      right: width - (showCalories && totals.length > 0 ? PADDING.right : 16),
      top: PADDING.top,
      bottom: height - PADDING.bottom,
    }),
    [width, height, showCalories, totals.length],
  );

  const model = useMemo(() => {
    if (days.length === 0 || width === 0) return null;

    const times = [...entries.map((e) => Date.parse(e.at)), ...days.map((day) => Date.parse(`${day}T12:00:00.000`))];
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeSpan = maxTime - minTime || 1;

    const values = entries.map((e) => e.kg);
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 1;
    const valuePad = Math.max((dataMax - dataMin) * 0.18, 0.4);
    const scale = niceScale(dataMin - valuePad, dataMax + valuePad, 5);

    const xFor = (time: number) =>
      minTime === maxTime
        ? (layout.left + layout.right) / 2
        : layout.left + ((time - minTime) / timeSpan) * (layout.right - layout.left);
    const yFor = (kg: number) =>
      layout.bottom - ((kg - scale.min) / (scale.max - scale.min)) * (layout.bottom - layout.top);

    const points = entries.map((entry) => ({
      entry,
      x: xFor(Date.parse(entry.at)),
      y: yFor(entry.kg),
    }));

    const calorieScale = niceScale(0, Math.max(1, ...totals.map((entry) => entry.kcal)), 5);
    const calorieYFor = (kcal: number) => layout.bottom - (kcal / calorieScale.max) * (layout.bottom - layout.top);
    const caloriePoints = totals.map((entry) => ({ entry, x: xFor(Date.parse(entry.at)), y: calorieYFor(entry.kcal) }));
    const dayPoints = days.map((day) => ({
      day,
      x: xFor(Date.parse(`${day}T12:00:00.000`)),
      weight: points.filter((point) => point.entry.at.startsWith(day)).at(-1),
      calories: caloriePoints.find((point) => point.entry.at.startsWith(day)),
    }));

    const trendPoints =
      trend && trend.length > 1
        ? trend
            .filter((p) => Date.parse(p.at) >= minTime && Date.parse(p.at) <= maxTime)
            .map((p) => ({ x: xFor(Date.parse(p.at)), y: yFor(p.kg) }))
        : [];

    // Sparse, non-overlapping x labels: first + last + evenly spaced middles.
    const maxLabels = width < 380 ? 3 : width < 560 ? 4 : 6;
    const labelIndexes: number[] = [];
    if (dayPoints.length <= maxLabels) {
      for (let i = 0; i < dayPoints.length; i++) labelIndexes.push(i);
    } else {
      for (let i = 0; i < maxLabels; i++) {
        labelIndexes.push(Math.round((i * (dayPoints.length - 1)) / (maxLabels - 1)));
      }
    }
    const xLabels = labelIndexes
      .filter((value, i, arr) => arr.indexOf(value) === i)
      .map((index) => ({
        index,
        x: dayPoints[index].x,
        text: formatDayMonth(new Date(`${dayPoints[index].day}T12:00:00`)),
      }))
      .filter((label, i, arr) => i === 0 || label.text !== arr[i - 1].text);

    const tickDecimals = scale.step < 1 ? 1 : 0;

    return {
      dayPoints, caloriePoints, calorieScale, calorieYFor,
      points,
      latest: points[points.length - 1],
      trendPoints,
      ticks: scale.ticks.filter((t) => t >= scale.min - 1e-9 && t <= scale.max + 1e-9),
      formatTick: (t: number) => `${t.toFixed(tickDecimals)}kg`,
      yFor,
      xLabels,
      linePath: smoothPath(points),
    };
  }, [entries, days, totals, trend, width, layout]);

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
    let nearest = 0;
    let best = Infinity;
    model.dayPoints.forEach((point, index) => {
      const distance = Math.abs(point.x - px);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setSelectedDay(model.dayPoints[nearest].day);
    setHover({ pointerY: py });
  };

  const clearHover = () => setHover(null);

  const active = model?.dayPoints.find((point) => point.day === day);
  const latest = model ? model.latest : null;

  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (active && hover) {
    const gap = 14;
    tooltipLeft = active.x + gap;
    if (tooltipLeft + tooltipSize.w > width - 4) tooltipLeft = active.x - gap - tooltipSize.w;
    tooltipLeft = Math.max(4, tooltipLeft);
    tooltipTop = hover.pointerY - tooltipSize.h - gap;
    if (tooltipTop < 4) tooltipTop = hover.pointerY + gap;
    tooltipTop = Math.min(tooltipTop, height - tooltipSize.h - 4);
  }

  return (
    <>
    <div
      ref={containerRef}
      className={`wc-chart${days.length === 0 ? " wc-chart-empty" : ""}`}
      onPointerMove={handlePointer}
      onPointerDown={handlePointer}
      onPointerLeave={clearHover}
      onPointerCancel={clearHover}
    >
      {days.length === 0 && <p>No entries yet. Add weight or calories to start the graph.</p>}
      {days.length > 0 && !showWeight && !showCalories && <p className="wc-chart-notice">Select a graph in the legend to show it.</p>}
      {width > 0 && model && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`History chart. ${showWeight ? "Weight in kilograms. " : ""}${showCalories ? "Daily calories in kilocalories." : ""} Use the day slider below to explore entries and images.`}
        >
          <defs>
            <linearGradient id="wc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.16} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* horizontal grid + y labels */}
          {showWeight && entries.length > 0 && model.ticks.map((tick) => {
            const y = model.yFor(tick);
            return (
              <g key={tick}>
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
                  {model.formatTick(tick)}
                </text>
              </g>
            );
          })}

          {showCalories && totals.length > 0 && model.calorieScale.ticks.map((tick) => (
            <text key={`kcal-${tick}`} x={layout.right + 8} y={model.calorieYFor(tick)} dominantBaseline="middle" className="wc-axis-label" style={{ fill: CALORIE_COLOR }}>{tick}kcal</text>
          ))}
          {showCalories && (
            <g>
              <path d={model.caloriePoints.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ")} fill="none" stroke={CALORIE_COLOR} strokeWidth={2.25} strokeDasharray="6 3" />
              {model.caloriePoints.map((point) => <circle key={point.entry.at} cx={point.x} cy={point.y} r={3.5} fill={CALORIE_COLOR} />)}
            </g>
          )}

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

          {/* area + line */}
          {showWeight && model.points.length > 1 && (
            <path
              d={`${model.linePath} L${model.points[model.points.length - 1].x},${layout.bottom} L${model.points[0].x},${layout.bottom} Z`}
              fill="url(#wc-area)"
            />
          )}
          {showWeight && model.trendPoints.length > 1 && (
            <path
              d={smoothPath(model.trendPoints)}
              fill="none"
              stroke={ACCENT}
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          )}
          {showWeight && <path
            d={model.linePath}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />}

          {/* latest value marker + quiet guide (hidden while scrubbing) */}
          {showWeight && latest && !active && (
            <>
              <line
                x1={latest.x}
                x2={latest.x}
                y1={layout.top}
                y2={layout.bottom}
                stroke="#ececf0"
                strokeWidth={1}
              />
              <text
                x={Math.min(latest.x, layout.right)}
                y={layout.top - 7}
                textAnchor="end"
                className="wc-axis-label"
              >
                {formatDayMonth(new Date(latest.entry.at))}
              </text>
              <circle cx={latest.x} cy={latest.y} r={8} fill={ACCENT} fillOpacity={0.14} />
              <circle cx={latest.x} cy={latest.y} r={4} fill={ACCENT} stroke="#fff" strokeWidth={2} />
            </>
          )}

          {/* hover crosshair + point */}
          {active && (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={layout.top}
                y2={layout.bottom}
                stroke="#c7c7d1"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              {showWeight && active.weight && <circle cx={active.weight.x} cy={active.weight.y} r={4.5} fill={ACCENT} stroke="#fff" strokeWidth={2.5} />}
              {showCalories && active.calories && <circle cx={active.calories.x} cy={active.calories.y} r={4.5} fill={CALORIE_COLOR} stroke="#fff" strokeWidth={2.5} />}
            </>
          )}
        </svg>
      )}

      {active && hover && (
        <div
          ref={tooltipRef}
          className="wc-tooltip"
          style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
        >
          <div className="wc-tooltip-date">{formatDayMonth(new Date(`${active.day}T12:00:00`))}</div>
          {showWeight && active.weight && <div className="wc-tooltip-row">
            <span className="wc-tooltip-dot" />
            <span className="wc-tooltip-label">Weight</span>
            <span className="wc-tooltip-value">{formatKg(active.weight.entry.kg)} kg</span>
          </div>}
          {showCalories && active.calories && <div className="wc-tooltip-row">
            <span className="wc-tooltip-dot" style={{ background: CALORIE_COLOR }} />
            <span className="wc-tooltip-label">Calories</span>
            <span className="wc-tooltip-value">{active.calories.entry.kcal} kcal</span>
          </div>}
        </div>
      )}
    </div>
    {days.length > 0 && <section className="wc-day-browser" aria-label="Daily entries and images">
      <label className="wc-field">
        <span>Browse days</span>
        <input type="range" min={0} max={days.length - 1} value={days.indexOf(day)}
          aria-valuetext={day}
          onChange={(event) => { setSelectedDay(days[Number(event.target.value)]); setHover(null); }} />
      </label>
      <div className="wc-day-navigation">
        <button className="wc-btn wc-btn-ghost" type="button" aria-label="Previous day" disabled={days.indexOf(day) === 0} onClick={() => { setSelectedDay(days[days.indexOf(day) - 1]); setHover(null); }}>←</button>
        <p aria-live="polite"><time dateTime={day}>{day}</time> · {totals.find((entry) => entry.at.startsWith(day))?.kcal ?? "No"} kcal logged{dayWeight && <> · {formatKg(dayWeight.kg)} kg</>}</p>
        <button className="wc-btn wc-btn-ghost" type="button" aria-label="Next day" disabled={days.indexOf(day) === days.length - 1} onClick={() => { setSelectedDay(days[days.indexOf(day) + 1]); setHover(null); }}>→</button>
      </div>
      {dayImages.length ? <div className="wc-thumbnails">
        {dayImages.map((entry) => <figure key={entry.id}>
          {/* Uploaded data URLs are already local and do not need the image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.image!} alt={`Food entry, ${entry.kcal} kcal on ${day} at ${entry.at.slice(11, 16)}`} width={96} height={96} />
          <figcaption>{entry.at.slice(11, 16)} · {entry.kcal} kcal</figcaption>
        </figure>)}
      </div> : <p className="wc-no-images">No images for this day.</p>}
    </section>}
    </>
  );
}
