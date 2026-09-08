import type { WeightEntry } from "../tracker";

const dateLabel = (at: string) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const sorted = [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (!sorted.length) return <div className="chart-empty">
    <span className="empty-symbol">↗</span>
    <h3>Your progress starts here</h3>
    <p>Add your first weight to start building the bigger picture.</p>
  </div>;
  const values = sorted.map((entry) => entry.kg);
  const min = Math.max(0, Math.min(...values) - 1);
  const max = Math.max(...values) + 1;
  const start = Date.parse(sorted[0].at);
  const end = Date.parse(sorted[sorted.length - 1].at);
  const points = sorted.map((entry) => ({
    ...entry,
    x: end === start ? 380 : 60 + (Date.parse(entry.at) - start) / (end - start) * 640,
    y: 220 - (entry.kg - min) / (max - min) * 185,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return <div className="chart-wrap">
    <svg className="weight-chart" viewBox="0 0 740 265" role="img" aria-label={`Weight history: ${sorted.length} entries, from ${sorted[0].kg} to ${sorted[sorted.length - 1].kg} kilograms. Full history below.`}>
      <defs>
        <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#43816b" stopOpacity=".22" />
          <stop offset="100%" stopColor="#43816b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((tick) => {
        const y = 35 + tick * 46.25; return <g key={tick}>
          <line x1="60" x2="700" y1={y} y2={y} stroke="#e5eae5" strokeDasharray="4 5" />
          <text x="45" y={y + 4} textAnchor="end">{(max - tick * (max - min) / 4).toFixed(1)}</text>
        </g>;
      })}
      {points.length > 1 && <>
        <polygon points={`${points[0].x},220 ${line} ${points[points.length - 1].x},220`} fill="url(#weight-fill)" />
        <polyline points={line} fill="none" stroke="#38745d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </>}
      {points.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="4.5" fill="#38745d" stroke="white" strokeWidth="2">
        <title>{point.kg} kg · {new Date(point.at).toLocaleString()}</title>
      </circle>)}
      <text x="60" y="252">{dateLabel(sorted[0].at)}</text>
      {end !== start && <text x="700" y="252" textAnchor="end">{dateLabel(sorted[sorted.length - 1].at)}</text>}
    </svg>
    <details className="history">
      <summary>View weight history · {sorted.length} entries</summary>
      <ul>{[...sorted].reverse().map((entry) => <li key={entry.id}>
        <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
        <strong>{entry.kg} kg</strong>
      </li>)}</ul>
    </details>
  </div>;
}
