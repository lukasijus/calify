import type { WeightEntry } from "./tracker";

const shortDate = (at: string) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// The plot consumes ordered data only, leaving room for goal and average overlays.
export default function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (!entries.length) return (
    <div className="chart-empty">
      <span className="empty-symbol" aria-hidden="true">↗</span>
      <h3>Your journey starts with one entry</h3>
      <p>Log your weight to start seeing the bigger picture.</p>
    </div>
  );
  const min = Math.min(...entries.map((entry) => entry.kg));
  const max = Math.max(...entries.map((entry) => entry.kg));
  const padding = Math.max((max - min) * 0.25, 0.5);
  const low = Math.max(0, min - padding);
  const high = max + padding;
  const start = new Date(entries[0].at).getTime();
  const end = new Date(entries[entries.length - 1].at).getTime();
  const x = (at: string) => start === end ? 370 : 60 + ((new Date(at).getTime() - start) / (end - start)) * 620;
  const y = (kg: number) => 220 - ((kg - low) / (high - low)) * 190;
  const line = entries.map((entry, index) => `${index ? "L" : "M"}${x(entry.at)},${y(entry.kg)}`).join(" ");
  return (
    <div className="chart-wrap">
      <svg className="weight-chart" viewBox="0 0 720 265" role="img" aria-label={`Weight history: ${entries.length} entries, from ${entries[0].kg} to ${entries[entries.length - 1].kg} kilograms. Full values in weight history below.`}>
        <defs>
          <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#41957b" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#41957b" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = low + (high - low) * tick / 4;
          return <g key={tick}><line x1="60" x2="680" y1={y(value)} y2={y(value)} stroke="#e5ebe6" strokeDasharray="4 5" /><text x="44" y={y(value) + 4} textAnchor="end">{value.toFixed(1)}</text></g>;
        })}
        {entries.length > 1 && <path d={`${line} L${x(entries[entries.length - 1].at)},220 L${x(entries[0].at)},220 Z`} fill="url(#weight-fill)" />}
        <path d={line} fill="none" stroke="#28785e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {entries.map((entry) => <circle key={entry.id} cx={x(entry.at)} cy={y(entry.kg)} r="4.5" fill="#28785e" stroke="white" strokeWidth="2"><title>{shortDate(entry.at)} · {new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {entry.kg} kg</title></circle>)}
        <text x={start === end ? 370 : 60} y="252" textAnchor={start === end ? "middle" : "start"}>{shortDate(entries[0].at)}</text>
        {start !== end && <text x="680" y="252" textAnchor="end">{shortDate(entries[entries.length - 1].at)}</text>}
      </svg>
    </div>
  );
}
