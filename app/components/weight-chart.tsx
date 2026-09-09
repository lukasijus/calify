"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatDayMonth, type WeightEntry } from "../lib/weight";
import { smoothPath, nearestPoint, dateLabels } from "../lib/weight-chart";

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

const ACCENT = "var(--wc-accent)";
const PADDING = { top: 68, right: 16, bottom: 28, left: 48 } as const;

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
  const gradientId = useId();
  const [selection, setSelection] = useState<{ entries: WeightEntry[]; index: number } | null>(null);
  const gesture = useRef<{ pointerId: number; index: number | null; lastHaptic: number } | null>(null);

  const height =
    width === 0
      ? 300
      : width < 480
        ? Math.max(260, Math.round(width * 0.82))
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
    const timeSpan = maxTime - minTime;

    const values = entries.map((e) => e.kg);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const valuePad = Math.max((dataMax - dataMin) * 0.18, 0.4);
    const scale = niceScale(dataMin - valuePad, dataMax + valuePad, 5);

    const xFor = (time: number) =>
      timeSpan === 0
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

    const xLabels = dateLabels(points.map((point, index) => ({
      index,
      x: point.x,
      text: formatDayMonth(new Date(point.entry.at)),
    })));

    const tickDecimals = scale.step < 1 ? 1 : 0;

    return {
      points,
      latest: points[points.length - 1],
      trendPoints,
      ticks: scale.ticks.filter((t) => t >= scale.min - 1e-9 && t <= scale.max + 1e-9),
      formatTick: (t: number) => t.toFixed(tickDecimals),
      yFor,
      xLabels,
      linePath: smoothPath(points),
    };
  }, [entries, trend, width, layout]);

  const selectPointer = (event: ReactPointerEvent<HTMLDivElement>, sliding = false) => {
    if (!model || !event.isPrimary) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) * width / rect.width;
    const index = nearestPoint(model.points, px);
    const drag = gesture.current;
    if (sliding && drag && drag.index !== index) {
      const now = performance.now();
      if (drag.index !== null && event.pointerType !== "mouse" && now - drag.lastHaptic >= 45) {
        // Haptics are optional, including when browser permissions reject them.
        try {
          if (typeof navigator.vibrate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            navigator.vibrate(5);
          }
        } catch { /* Unsupported or blocked: selection still works. */ }
        drag.lastHaptic = now;
      }
      drag.index = index;
    }
    setSelection((previous) => previous?.entries === entries && previous.index === index
      ? previous : { entries, index });
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) setSelection(null);
  };

  const active = selection?.entries === entries && model ? model.points[selection.index] : null;
  const latest = model?.latest;
  const tooltipLeft = active ? Math.max(4, Math.min(active.x - 48, width - 100)) : 0;

  return (
    <div
      ref={containerRef}
      className={`wc-chart${entries.length === 0 ? " wc-chart-empty" : ""}`}
      role={model ? "slider" : undefined}
      tabIndex={model ? 0 : undefined}
      aria-label={model ? "Weight history. Use arrow keys to select a weigh-in." : undefined}
      aria-valuemin={model ? 1 : undefined}
      aria-valuemax={model?.points.length}
      aria-valuenow={model ? (active ? selection!.index + 1 : model.points.length) : undefined}
      aria-valuetext={latest ? `${formatDayMonth(new Date((active ?? latest).entry.at))}, ${formatKg((active ?? latest).entry.kg)} kg` : undefined}
      onKeyDown={(event) => {
        if (!model) return;
        const current = active ? selection!.index : model.points.length - 1;
        const index = event.key === "Home" ? 0 : event.key === "End" ? model.points.length - 1
          : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(0, current - 1)
          : event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(model.points.length - 1, current + 1) : null;
        if (index !== null) {
          event.preventDefault();
          setSelection({ entries, index });
        } else if (event.key === "Escape") setSelection(null);
      }}
      onPointerDown={(event) => {
        if (!model || !event.isPrimary || event.button !== 0) return;
        gesture.current = { pointerId: event.pointerId, index: null, lastHaptic: -Infinity };
        event.currentTarget.setPointerCapture(event.pointerId);
        selectPointer(event, true);
      }}
      onPointerMove={(event) => {
        if (gesture.current?.pointerId === event.pointerId) selectPointer(event, true);
        else if (!gesture.current && event.pointerType === "mouse") selectPointer(event);
      }}
      onPointerUp={(event) => endGesture(event)}
      onPointerLeave={() => { if (!gesture.current) setSelection(null); }}
      onPointerCancel={(event) => endGesture(event, true)}
      onLostPointerCapture={() => { gesture.current = null; }}
      onBlur={() => setSelection(null)}
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
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.08} />
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
                  stroke="var(--wc-grid)"
                  strokeWidth={1}
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
          {model.xLabels.map((label) => (
            <text
              key={`${label.text}-${label.index}`}
              x={label.x}
              y={height - 8}
              textAnchor={label.anchor}
              className="wc-axis-label"
            >
              {label.text}
            </text>
          ))}

          {/* area + line */}
          {model.points.length > 1 && (
            <path
              d={`${model.linePath} L${model.latest.x},${layout.bottom} L${model.points[0].x},${layout.bottom} Z`}
              fill={`url(#${gradientId})`}
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
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Keep the latest weigh-in identifiable while exploring older points. */}
          {latest && active !== latest && (
            <>
              {!active && <circle cx={latest.x} cy={latest.y} r={8} fill={ACCENT} fillOpacity={0.12} />}
              <circle cx={latest.x} cy={latest.y} r={3.5} fill={ACCENT} stroke="var(--wc-surface)" strokeWidth={1.5} />
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
                stroke="var(--wc-guide)"
                strokeWidth={1}
              />
              <circle cx={active.x} cy={active.y} r={9} fill={ACCENT} fillOpacity={0.14} />
              <circle cx={active.x} cy={active.y} r={4.5} fill={ACCENT} stroke="var(--wc-surface)" strokeWidth={2.5} />
            </>
          )}
        </svg>
      )}

      {active && (
        <div
          className="wc-tooltip"
          style={{ left: tooltipLeft, top: 8 }}
        >
          <div className="wc-tooltip-date">{formatDayMonth(new Date(active.entry.at))}</div>
          <div className="wc-tooltip-value">{formatKg(active.entry.kg)} kg</div>
        </div>
      )}
    </div>
  );
}
