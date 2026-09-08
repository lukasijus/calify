import type { WeightEntry } from "./tracker";

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Keep chart rendering independent of storage and forms for future series/goal overlays.
export default function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const sorted = [...entries].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (!sorted.length) return <div className="chart-empty"><span className="empty-symbol" aria-hidden="true">↗</span><h3>Your progress starts here</h3><p>Add your first weight to start your personal timeline.</p></div>;
  const values = sorted.map((entry) => entry.kg);
  const low = Math.floor(Math.min(...values) - 1);
  const high = Math.ceil(Math.max(...values) + 1);
  const start = Date.parse(sorted[0].date);
  const end = Date.parse(sorted[sorted.length - 1].date);
  const points = sorted.map((entry) => ({
    ...entry,
    x: end === start ? 390 : 60 + ((Date.parse(entry.date) - start) / (end - start)) * 680,
    y: 230 - ((entry.kg - low) / (high - low)) * 200,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return <div className="chart-wrap">
    <svg className="weight-chart" viewBox="0 0 800 280" role="img" aria-label={`Weight history: ${sorted.length} entries, from ${sorted[0].kg} to ${sorted[sorted.length - 1].kg} kilograms. Details are available below.`}>
      <defs><linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#328668" stopOpacity=".22" /><stop offset="100%" stopColor="#328668" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((tick) => { const y = 30 + tick * 50; return <g key={tick}><line x1="60" y1={y} x2="740" y2={y} stroke="#e5ebe6" strokeDasharray="4 5" /><text x="45" y={y + 4} textAnchor="end">{(high - (tick / 4) * (high - low)).toFixed(1)}</text></g>; })}
      {points.length > 1 && <polygon points={`${points[0].x},230 ${line} ${points[points.length - 1].x},230`} fill="url(#weight-fill)" />}
      <polyline points={line} fill="none" stroke="#28775b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="5" fill="#28775b" stroke="white" strokeWidth="2"><title>{formatDate(point.date)} · {new Date(point.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {point.kg} kg</title></circle>)}
      <text x="60" y="263">{formatDate(sorted[0].date)}</text>
      {end !== start && <text x="740" y="263" textAnchor="end">{formatDate(sorted[sorted.length - 1].date)}</text>}
    </svg>
    {sorted.length === 1 && <p className="chart-note">First entry recorded. Your trend will appear as you add more.</p>}
  </div>;
}
