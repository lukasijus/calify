"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { dailyCalories, type CalorieEntry } from "../lib/calorie";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatDayMonth, type WeightEntry } from "../lib/weight";

type TrendPoint = { at: string; kg: number };

type WeightChartProps = {
  entries: WeightEntry[];
  calories: CalorieEntry[];
  /**
   * Optional smoothed series (e.g. 7-day moving average). Rendered as a second,
   * thinner line so raw weigh-ins stay distinguishable from the trend. Not
   * currently supplied by the page — the hook is here so it can be enabled
   * without reworking the chart.
   */
  trend?: TrendPoint[];
};

const ACCENT = "#2f6bff";
const PADDING = { top: 20, right: 66, bottom: 28, left: 44 } as const;

const dayTime = (at: string) => Date.parse(`${at.slice(0, 10)}T12:00:00`);

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

export function WeightChart({ entries, calories, trend }: WeightChartProps) {
  const [showWeight, setShowWeight] = useState(true);
  const [showCalories, setShowCalories] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const daily = useMemo(() => dailyCalories(calories), [calories]);
  const days = useMemo(() => [...new Set([...entries, ...calories].map((entry) => entry.at.slice(0, 10)))].sort(), [entries, calories]);
  const day = selectedDay && days.includes(selectedDay) ? selectedDay : days.at(-1);
  const dayIndex = day ? days.indexOf(day) : -1;
  const dayCalories = calories.filter((entry) => entry.at.slice(0, 10) === day);
  const dayWeights = entries.filter((entry) => entry.at.slice(0, 10) === day);
  const [containerRef, width] = useContainerWidth();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ index: number; pointerY: number } | null>(null);
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
      right: width - PADDING.right,
      top: PADDING.top,
      bottom: height - PADDING.bottom,
    }),
    [width, height],
  );

  const model = useMemo(() => {
    if (days.length === 0 || width === 0) return null;

    const times = days.map(dayTime);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeSpan = maxTime - minTime || 1;

    const values = entries.map((e) => e.kg);
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 1;
    const valuePad = Math.max((dataMax - dataMin) * 0.18, 0.4);
    const scale = niceScale(dataMin - valuePad, dataMax + valuePad, 5);

    const xFor = (time: number) =>
      days.length === 1
        ? (layout.left + layout.right) / 2
        : layout.left + ((time - minTime) / timeSpan) * (layout.right - layout.left);
    const yFor = (kg: number) =>
      layout.bottom - ((kg - scale.min) / (scale.max - scale.min)) * (layout.bottom - layout.top);

    const points = entries.map((entry) => ({
      entry,
      x: xFor(dayTime(entry.at)),
      y: yFor(entry.kg),
    }));

    const trendPoints =
      trend && trend.length > 1
        ? trend
            .filter((p) => dayTime(p.at) >= minTime && dayTime(p.at) <= maxTime)
            .map((p) => ({ x: xFor(dayTime(p.at)), y: yFor(p.kg) }))
        : [];

    const calorieScale = niceScale(0, Math.max(1, ...daily.map((d) => d.kcal)), 5);
    const calorieY = (kcal: number) => layout.bottom - (kcal / calorieScale.max) * (layout.bottom - layout.top);
    const caloriePoints = daily.map((d) => ({ x: xFor(dayTime(d.day)), y: calorieY(d.kcal) }));
    const dayPoints = days.map((day) => ({ day, x: xFor(dayTime(day)) }));

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
      dayPoints, caloriePoints, calorieScale, calorieY,
      points,
      latest: points[points.length - 1],
      trendPoints,
      ticks: scale.ticks.filter((t) => t >= scale.min - 1e-9 && t <= scale.max + 1e-9),
      formatTick: (t: number) => `${t.toFixed(tickDecimals)}kg`,
      yFor,
      xLabels,
      linePath: smoothPath(points),
    };
  }, [entries, trend, width, layout, days, daily]);

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
    const selected = model.dayPoints[nearest].day;
    setSelectedDay(selected);
    setHover({ index: model.points.findIndex((p) => p.entry.at.slice(0, 10) === selected), pointerY: py });
  };

  const clearHover = () => setHover(null);

  const active = showWeight && hover && model ? model.points[hover.index] : null;
  const latest = showWeight && model ? model.latest : null;

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
    <div className="wc-legend" role="group" aria-label="Show graphs">
      <label><input type="checkbox" checked={showWeight} onChange={(e) => setShowWeight(e.target.checked)} /><span className="wc-legend-weight">━</span> Weight (kg)</label>
      <label><input type="checkbox" checked={showCalories} onChange={(e) => setShowCalories(e.target.checked)} /><span className="wc-legend-calories">┄</span> Calories (kcal/day)</label>
    </div>
    <div
      ref={containerRef}
      className={`wc-chart${days.length === 0 ? " wc-chart-empty" : ""}`}
      onPointerMove={handlePointer}
      onPointerDown={handlePointer}
      onPointerLeave={clearHover}
      onPointerCancel={clearHover}
    >
      {days.length === 0 && <p>No entries yet. Add weight or calories to start the graph.</p>}
      {width > 0 && model && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`History chart. ${showWeight ? "Weight in kilograms. " : ""}${showCalories ? "Daily calories in kcal." : ""} Use the day controls below to explore entries.`}
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

          {showCalories && daily.length > 0 && <>
            {model.calorieScale.ticks.map((tick) => <text key={tick} x={layout.right + 8} y={model.calorieY(tick)} dominantBaseline="middle" className="wc-axis-label">{tick} kcal</text>)}
            <path d={model.caloriePoints.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")} fill="none" stroke="#d97706" strokeWidth={2.25} strokeDasharray="6 4" />
            {model.caloriePoints.map((p, i) => <circle key={daily[i].day} cx={p.x} cy={p.y} r={3.5} fill="#d97706" />)}
          </>}
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
          {latest && !active && (
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
              <circle cx={active.x} cy={active.y} r={9} fill={ACCENT} fillOpacity={0.14} />
              <circle cx={active.x} cy={active.y} r={4.5} fill={ACCENT} stroke="#fff" strokeWidth={2.5} />
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
          <div className="wc-tooltip-date">{formatDayMonth(new Date(active.entry.at))}</div>
          <div className="wc-tooltip-row">
            <span className="wc-tooltip-dot" />
            <span className="wc-tooltip-label">Weight</span>
            <span className="wc-tooltip-value">{formatKg(active.entry.kg)} kg</span>
          </div>
        </div>
      )}
    </div>
    {day && <div className="wc-day-details">
      <div className="wc-day-navigation">
        <button className="wc-btn wc-btn-ghost" aria-label="Previous day with entries" disabled={dayIndex <= 0} onClick={() => { setSelectedDay(days[dayIndex - 1]); setHover(null); }}>←</button>
        <div aria-live="polite">{day} · {dayCalories.length ? `${dayCalories.reduce((sum, entry) => sum + entry.kcal, 0)} kcal` : "No kcal logged"} · {dayWeights.length ? `${dayWeights.at(-1)!.kg} kg` : "No weight logged"}</div>
        <button className="wc-btn wc-btn-ghost" aria-label="Next day with entries" disabled={dayIndex >= days.length - 1} onClick={() => { setSelectedDay(days[dayIndex + 1]); setHover(null); }}>→</button>
      </div>
      <input className="wc-day-slider" type="range" min={0} max={Math.max(0, days.length - 1)} value={dayIndex} aria-label="Browse days with entries" aria-valuetext={day} onChange={(e) => { setSelectedDay(days[Number(e.target.value)]); setHover(null); }} />
      <div className="wc-thumbnails">
        {dayCalories.filter((entry) => entry.hasImage).map((entry) => {
          const src = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/calories/${encodeURIComponent(entry.id)}/image`;
          return <a key={entry.id} href={src} target="_blank" rel="noreferrer"><Image unoptimized src={src} width={96} height={96} alt={`${entry.kcal} kcal at ${entry.at.slice(11, 16)}`} /><span>{entry.kcal} kcal · {entry.at.slice(11, 16)}</span></a>;
        })}
      </div>
      {!dayCalories.some((entry) => entry.hasImage) && <p className="wc-day-empty">No images for this day.</p>}
    </div>}
    </>
  );
}
