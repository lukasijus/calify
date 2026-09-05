import type { Measurement } from './geometry';
export type Session = {
  id: string;
  timestamp: string;
  weightKg?: number;
  measurements: { waistWidth: Measurement; waistDepth: Measurement; shoulderWidth: Measurement; hipWidth: Measurement };
  waistCircumference: { cm: number; estimated: true; quality: 'manual-review'; warnings: string[] };
};
export const storageKey = 'calify.sessions.v1';
export function parseSessions(raw: string | null): Session[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const warnings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
  if (!Array.isArray(parsed) || !parsed.every(s => s && typeof s.id === 'string' && typeof s.timestamp === 'string' && Number.isFinite(Date.parse(s.timestamp)) && (s.weightKg === undefined || positive(s.weightKg)) && ['waistWidth', 'waistDepth', 'shoulderWidth', 'hipWidth'].every(key => {
    const m = s.measurements?.[key];
    return m && positive(m.cm) && m.view === (key === 'waistDepth' ? 'side' : 'front') && m.quality === 'manual-review' && warnings(m.warnings);
  }) && positive(s.waistCircumference?.cm) && s.waistCircumference.estimated === true && s.waistCircumference.quality === 'manual-review' && warnings(s.waistCircumference.warnings))) throw new Error('Saved history is invalid. Existing data has not been overwritten.');
  return parsed.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
