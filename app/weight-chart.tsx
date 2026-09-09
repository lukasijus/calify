"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import styles from "./weight-chart.module.css";
import { entryDate, type WeightEntry } from "@/lib/weight-data";

/**
 * Minimal weight-history chart.
 *
 * Deliberately hand-rolled SVG (no chart framework) so the visual behaviour can
 * match the calm, data-first reference: thin smooth line, subtle fade, sparse
 * labels, restrained markers, cursor-following tooltip.
 *
 * The line is drawn with monotone-cubic interpolation, which stays smooth
 * without the overshoot artefacts a naive spline produces on noisy daily
 * weigh-ins. A second series (e.g. a 7-day moving average) can be layered by
 * feeding another point list through `monotonePath`.
 *
 * Axis labels and the tooltip are HTML positioned as a percentage of the plot
 * box so their type size stays readable at every screen width (SVG <text> would
 * shrink with the viewBox on small phones).
 */

const VB_W = 720;
const VB_H = 460;
const PAD = { top: 26, right: 16, bottom: 34, left: 16 } as const;
const PLOT_W = VB_W - PAD.left - PAD.right;
const PLOT_H = VB_H - PAD.top - PAD.bottom;

type PlotPoint = { x: number; y: number; entry: WeightEntry };

function niceHalf(value: number, dir: "floor" | "ceil"): number {
  return dir === "floor" ? Math.floor(value * 2) / 2 : Math.ceil(value * 2) / 2;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${round(pts[0].x)},${round(pts[0].y)}`;
  if (n === 2)
    return `M${round(pts[0].x)},${round(pts[0].y)} L${round(pts[1].x)},${round(pts[1].y)}`;

  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    slope[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }

  const tan: number[] = new Array(n);
  tan[0] = slope[0];
  tan[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tan[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tan[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M${round(pts[0].x)},${round(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const x1 = pts[i].x + dx[i] / 3;
    const y1 = pts[i].y + (tan[i] * dx[i]) / 3;
    const x2 = pts[i + 1].x - dx[i] / 3;
    const y2 = pts[i + 1].y - (tan[i + 1] * dx[i]) / 3;
    d +=
      ` C${round(x1)},${round(y1)} ${round(x2)},${round(y2)}` +
      ` ${round(pts[i + 1].x)},${round(pts[i + 1].y)}`;
  }
  return d;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatKg(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

const pctX = (x: number) => `${(x / VB_W) * 100}%`;
const pctY = (y: number) => `${(y / VB_H) * 100}%`;

export default function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [hover, setHover] = useState<{
    index: number;
    left: number;
    top: number;
  } | null>(null);

  const model = useMemo(() => {
    if (entries.length === 0) return null;

    const times = entries.map((e) => entryDate(e).getTime());
    const kgs = entries.map((e) => e.kg);
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const tSpan = tMax - tMin || 1;

    const dataMin = Math.min(...kgs);
    const dataMax = Math.max(...kgs);
    const spread = dataMax - dataMin;
    const margin = Math.max(0.4, spread * 0.12);
    let yMin = niceHalf(dataMin - margin, "floor");
    let yMax = niceHalf(dataMax + margin, "ceil");
    if (yMax - yMin < 1) {
      yMin -= 0.5;
      yMax += 0.5;
    }
    const ySpan = yMax - yMin;

    const xOf = (t: number) =>
      PAD.left +
      (times.length === 1 ? PLOT_W / 2 : ((t - tMin) / tSpan) * PLOT_W);
    const yOf = (kg: number) => PAD.top + (1 - (kg - yMin) / ySpan) * PLOT_H;

    const points: PlotPoint[] = entries.map((entry, i) => ({
      x: xOf(times[i]),
      y: yOf(entry.kg),
      entry,
    }));

    const linePath = monotonePath(points);
    const baseY = PAD.top + PLOT_H;
    const areaPath =
      points.length > 1
        ? `${linePath} L${round(points[points.length - 1].x)},${round(baseY)}` +
          ` L${round(points[0].x)},${round(baseY)} Z`
        : "";

    // Horizontal grid: 4 bands; label only top & bottom to stay calm.
    const gridLines = Array.from({ length: 5 }, (_, i) => {
      const value = yMax - (i / 4) * ySpan;
      return {
        value,
        y: yOf(value),
        edge: i === 0 ? "top" : i === 4 ? "bottom" : null,
      };
    });

    // Sparse x labels: first, middle, last — deduped by index and by text so
    // nothing overlaps or repeats.
    const labelIdx = Array.from(
      new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
    ).filter((i) => i >= 0);
    let xLabels = labelIdx.map((idx, k) => ({
      x: points[idx].x,
      text: formatDay(entryDate(entries[idx])),
      align:
        k === 0
          ? ("start" as const)
          : k === labelIdx.length - 1
            ? ("end" as const)
            : ("mid" as const),
    }));
    if (
      xLabels.length === 3 &&
      (xLabels[1].text === xLabels[0].text ||
        xLabels[1].text === xLabels[2].text)
    ) {
      xLabels = [xLabels[0], xLabels[2]];
    }

    return {
      points,
      linePath,
      areaPath,
      gridLines,
      xLabels,
      last: points[points.length - 1],
      baseY,
    };
  }, [entries]);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const wrap = wrapRef.current;
      if (!svg || !wrap || !model) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const vbX = ((clientX - rect.left) / rect.width) * VB_W;

      let nearest = 0;
      let best = Infinity;
      for (let i = 0; i < model.points.length; i++) {
        const dist = Math.abs(model.points[i].x - vbX);
        if (dist < best) {
          best = dist;
          nearest = i;
        }
      }

      // Position the cursor-following tooltip here (an event handler) rather
      // than during render so we never read layout refs in the render phase.
      const wrapRect = wrap.getBoundingClientRect();
      const px = clientX - wrapRect.left;
      const py = clientY - wrapRect.top;
      const tip = tooltipRef.current;
      const tw = tip?.offsetWidth ?? 150;
      const th = tip?.offsetHeight ?? 62;
      const gap = 16;

      let left = px + gap;
      if (left + tw > wrapRect.width) left = px - gap - tw;
      left = Math.max(4, Math.min(left, wrapRect.width - tw - 4));

      let top = py - th / 2;
      top = Math.max(4, Math.min(top, wrapRect.height - th - 4));

      setHover({ index: nearest, left, top });
    },
    [model],
  );

  if (!model) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>No weigh-ins yet.</div>
      </div>
    );
  }

  const active = hover ? model.points[hover.index] : null;
  const marker = active ?? model.last;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onPointerMove={(e) => handleMove(e.clientX, e.clientY)}
      onPointerDown={(e) => handleMove(e.clientX, e.clientY)}
      onPointerLeave={() => setHover(null)}
      onPointerCancel={() => setHover(null)}
    >
      <svg
        ref={svgRef}
        className={styles.svg}
        width={VB_W}
        height={VB_H}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="Weight history chart"
      >
        <defs>
          <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {model.gridLines.map((g, i) => (
          <line
            key={i}
            className={styles.gridLine}
            x1={PAD.left}
            x2={VB_W - PAD.right}
            y1={round(g.y)}
            y2={round(g.y)}
          />
        ))}

        {model.areaPath && (
          <path
            className={styles.area}
            d={model.areaPath}
            fill="url(#weightArea)"
          />
        )}

        <path className={styles.line} d={model.linePath} />

        {model.points.map((p, i) => (
          <circle
            key={i}
            className={styles.dot}
            cx={round(p.x)}
            cy={round(p.y)}
            r={2.4}
          />
        ))}

        <line
          className={styles.crosshair}
          x1={round(marker.x)}
          x2={round(marker.x)}
          y1={PAD.top}
          y2={model.baseY}
        />

        {/* Latest value: always visually obvious. */}
        <circle
          className={styles.currentHalo}
          cx={round(model.last.x)}
          cy={round(model.last.y)}
          r={7}
        />
        <circle
          className={styles.currentDot}
          cx={round(model.last.x)}
          cy={round(model.last.y)}
          r={4}
        />

        {active && active !== model.last && (
          <circle
            className={styles.hoverRing}
            cx={round(active.x)}
            cy={round(active.y)}
            r={5.5}
          />
        )}
      </svg>

      {model.gridLines
        .filter((g) => g.edge)
        .map((g, i) => (
          <span
            key={i}
            className={styles.yLabel}
            style={{
              top: pctY(g.y),
              transform:
                g.edge === "top"
                  ? "translateY(-115%)"
                  : "translateY(15%)",
            }}
          >
            {`${Number.isInteger(g.value) ? g.value : g.value.toFixed(1)} kg`}
          </span>
        ))}

      {model.xLabels.map((l, i) => (
        <span
          key={i}
          className={styles.xLabel}
          style={{
            left: pctX(l.x),
            transform:
              l.align === "start"
                ? "translateX(0)"
                : l.align === "end"
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
        >
          {l.text}
        </span>
      ))}

      {hover && (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{ left: `${hover.left}px`, top: `${hover.top}px` }}
        >
          <div className={styles.tooltipDate}>
            {formatDay(entryDate(model.points[hover.index].entry))}
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipSwatch} />
            <span className={styles.tooltipLabel}>Weight</span>
            <span className={styles.tooltipValue}>
              {formatKg(model.points[hover.index].entry.kg)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
