"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatDayMonth, type WeightEntry } from "../lib/weight";

type TrendPoint = { at: string; kg: number };

type WeightChartProps = {
  entries: WeightEntry[];
  /**
   * Optional smoothed series (e.g. 7-day moving average). Rendered as a second,
   * thinner line so raw weigh-ins stay distinguishable from the trend. Not
   * currently supplied by the page — the hook is here so it can be enabled
   * without reworking the chart.
   */
  trend?: TrendPoint[];
};

const ACCENT = "#2f6bff";
const PADDING = { top: 20, right: 16, bottom: 28, left: 44 } as const;

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

export function WeightChart({ entries, trend }: WeightChartProps) {
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
    if (entries.length === 0 || width === 0) return null;

    const times = entries.map((e) => Date.parse(e.at));
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeSpan = maxTime - minTime || 1;

    const values = entries.map((e) => e.kg);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const valuePad = Math.max((dataMax - dataMin) * 0.18, 0.4);
    const scale = niceScale(dataMin - valuePad, dataMax + valuePad, 5);

    const xFor = (time: number) =>
      entries.length === 1
        ? (layout.left + layout.right) / 2
        : layout.left + ((time - minTime) / timeSpan) * (layout.right - layout.left);
    const yFor = (kg: number) =>
      layout.bottom - ((kg - scale.min) / (scale.max - scale.min)) * (layout.bottom - layout.top);

    const points = entries.map((entry) => ({
      entry,
      x: xFor(Date.parse(entry.at)),
      y: yFor(entry.kg),
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
    if (points.length <= maxLabels) {
      for (let i = 0; i < points.length; i++) labelIndexes.push(i);
    } else {
      for (let i = 0; i < maxLabels; i++) {
        labelIndexes.push(Math.round((i * (points.length - 1)) / (maxLabels - 1)));
      }
    }
    const xLabels = labelIndexes
      .filter((value, i, arr) => arr.indexOf(value) === i)
      .map((index) => ({
        index,
        x: points[index].x,
        text: formatDayMonth(new Date(points[index].entry.at)),
      }))
      .filter((label, i, arr) => i === 0 || label.text !== arr[i - 1].text);

    const tickDecimals = scale.step < 1 ? 1 : 0;

    return {
      points,
      latest: points[points.length - 1],
      trendPoints,
      ticks: scale.ticks.filter((t) => t >= scale.min - 1e-9 && t <= scale.max + 1e-9),
      formatTick: (t: number) => `${t.toFixed(tickDecimals)}kg`,
      yFor,
      xLabels,
      linePath: smoothPath(points),
    };
  }, [entries, trend, width, layout]);

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
    model.points.forEach((point, index) => {
      const distance = Math.abs(point.x - px);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHover({ index: nearest, pointerY: py });
  };

  const clearHover = () => setHover(null);

  const active = hover && model ? model.points[hover.index] : null;
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
    <div
      ref={containerRef}
      className={`wc-chart${entries.length === 0 ? " wc-chart-empty" : ""}`}
      onPointerMove={handlePointer}
      onPointerDown={handlePointer}
      onPointerLeave={clearHover}
      onPointerCancel={clearHover}
    >
      {entries.length === 0 && <p>No weigh-ins yet. Add your first entry to start the graph.</p>}
      {width > 0 && model && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Weight history chart, latest ${formatKg(model.latest.entry.kg)} kilograms`}
        >
          <defs>
            <linearGradient id="wc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.16} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* horizontal grid + y labels */}
          {model.ticks.map((tick) => {
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
          {model.points.length > 1 && (
            <path
              d={`${model.linePath} L${layout.right},${layout.bottom} L${model.points[0].x},${layout.bottom} Z`}
              fill="url(#wc-area)"
            />
          )}
          {model.trendPoints.length > 1 && (
            <path
              d={smoothPath(model.trendPoints)}
              fill="none"
              stroke={ACCENT}
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          )}
          <path
            d={model.linePath}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

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
  );
}
