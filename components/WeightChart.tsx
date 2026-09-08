"use client";

import { useMemo, useRef, useState } from "react";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  buildAreaPath,
  buildChartLayout,
  buildSmoothLinePath,
} from "@/lib/weight/chart-geometry";
import { formatAxisDate, formatTooltip, formatWeight } from "@/lib/weight/format";
import type { WeightEntry } from "@/lib/weight/types";
import styles from "./WeightChart.module.css";

type WeightChartProps = {
  /** Sorted ascending by recordedAt. */
  entries: WeightEntry[];
};

// Text is rendered as HTML overlaid on the SVG (rather than as SVG <text>)
// so labels keep a consistent, crisp size regardless of how much the
// viewBox is stretched to fill the container on a given screen.
export default function WeightChart({ entries }: WeightChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const layout = useMemo(() => buildChartLayout(entries), [entries]);

  if (!layout || layout.points.length === 0) {
    return (
      <div className={styles.empty}>
        No weight entries yet. Add your first one to see the graph.
      </div>
    );
  }

  const { points, gridLines, plotLeft, plotRight, plotTop, plotBottom, minY, maxY } = layout;
  const linePath = buildSmoothLinePath(points);
  const areaPath = buildAreaPath(points, plotBottom);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const activePoint = hoverIndex !== null ? points[hoverIndex] : lastPoint;
  const isHovering = hoverIndex !== null;

  const toPercentX = (x: number) => (x / CHART_WIDTH) * 100;
  const toPercentY = (y: number) => (y / CHART_HEIGHT) * 100;
  const gridY = (value: number) =>
    plotTop + (1 - (value - minY) / (maxY - minY)) * (plotBottom - plotTop);

  function updateHoverFromClientX(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = CHART_WIDTH / rect.width;
    const localX = (clientX - rect.left) * scaleX;

    let nearestIndex = 0;
    let nearestDistance = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - localX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setHoverIndex(nearestIndex);
  }

  return (
    <div className={styles.wrapper}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Weight history graph, latest reading ${formatWeight(lastPoint.entry.weightKg)}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updateHoverFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || e.buttons === 0) {
            updateHoverFromClientX(e.clientX);
          }
        }}
        onPointerUp={() => setHoverIndex(null)}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="weightAreaFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--weight-line-color)", stopOpacity: 0.16 }} />
            <stop offset="100%" style={{ stopColor: "var(--weight-line-color)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        {gridLines.map((value) => (
          <line
            key={value}
            x1={plotLeft}
            x2={plotRight}
            y1={gridY(value)}
            y2={gridY(value)}
            className={styles.gridLine}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <line
          x1={lastPoint.x}
          x2={lastPoint.x}
          y1={lastPoint.y}
          y2={plotBottom}
          className={styles.latestGuide}
          vectorEffect="non-scaling-stroke"
        />

        <path d={areaPath} fill="url(#weightAreaFade)" stroke="none" />
        <path d={linePath} fill="none" className={styles.line} vectorEffect="non-scaling-stroke" />

        <circle cx={lastPoint.x} cy={lastPoint.y} r={4.5} className={styles.latestDot} />

        {isHovering && (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={plotTop}
              y2={plotBottom}
              className={styles.hoverGuide}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r={4.5} className={styles.hoverDot} />
          </>
        )}
      </svg>

      {/* Min/max weight labels, aligned to their grid line. */}
      <span
        className={styles.gridLabel}
        style={{ left: `${toPercentX(plotLeft)}%`, top: `${toPercentY(gridY(maxY))}%` }}
      >
        {formatWeight(maxY)}
      </span>
      <span
        className={styles.gridLabel}
        style={{ left: `${toPercentX(plotLeft)}%`, top: `${toPercentY(gridY(minY))}%` }}
      >
        {formatWeight(minY)}
      </span>

      {/* Sparse date labels: first and last point only. */}
      <span
        className={styles.axisLabel}
        style={{ left: `${toPercentX(firstPoint.x)}%`, textAlign: "left" }}
      >
        {formatAxisDate(firstPoint.entry.recordedAt)}
      </span>
      <span
        className={`${styles.axisLabel} ${styles.axisLabelEnd}`}
        style={{ left: `${toPercentX(lastPoint.x)}%`, textAlign: "right" }}
      >
        {formatAxisDate(lastPoint.entry.recordedAt)}
      </span>

      <div
        className={styles.tooltip}
        style={{
          left: `${clampPercent(toPercentX(activePoint.x))}%`,
          top: `${Math.max(toPercentY(activePoint.y), 8)}%`,
          opacity: isHovering ? 1 : 0,
        }}
      >
        {formatTooltip(activePoint.entry.recordedAt, activePoint.entry.weightKg)}
      </div>
    </div>
  );
}

function clampPercent(value: number) {
  return Math.min(96, Math.max(4, value));
}
