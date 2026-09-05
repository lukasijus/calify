'use client';

import { useEffect, useState } from 'react';
import Capture from './capture';
import { ellipseCircumference, geometryWarning, type Measurement } from '../lib/geometry';
import { parseSessions, storageKey, type Session } from '../lib/sessions';

function delta(current: number, previous?: number) {
  if (previous === undefined) return 'No previous value';
  const difference = current - previous;
  return `${difference >= 0 ? '+' : ''}${difference.toFixed(1)} vs previous session`;
}
export default function Home() {
  const [front, setFront] = useState<Record<string, Measurement> | null>(null);
  const [side, setSide] = useState<Record<string, Measurement> | null>(null);
  const [weight, setWeight] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try { setSessions(parseSessions(localStorage.getItem(storageKey))); setReady(true); }
    catch (e) { setMessage(`History unavailable: ${(e as Error).message}`); }
  }, []);
  function save() {
    if (!front || !side || !ready) return;
    try {
      const weightKg = weight.trim() ? Number(weight) : undefined;
      if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0)) throw new Error('Weight must be a positive number.');
      const session: Session = {
        id: crypto.randomUUID(), timestamp: new Date().toISOString(), weightKg,
        measurements: { waistWidth: front.waistWidth, waistDepth: side.waistDepth, shoulderWidth: front.shoulderWidth, hipWidth: front.hipWidth },
        waistCircumference: { cm: ellipseCircumference(front.waistWidth.cm, side.waistDepth.cm), estimated: true, quality: 'manual-review', warnings: [geometryWarning, 'Elliptical cross-section assumption; this is not a tape measurement.'] },
      };
      const current = parseSessions(localStorage.getItem(storageKey));
      const next = [session, ...current];
      localStorage.setItem(storageKey, JSON.stringify(next)); setSessions(next); setFront(null); setSide(null); setMessage('Session saved on this browser. Reconfirm captures before saving another session.');
    } catch (e) { setMessage(`Not saved: ${(e as Error).message}`); }
  }
  const latest = sessions[0], previous = sessions[1];
  return <main>
    <h1>Calify capture POC</h1>
    <p>Repeatable body-shape tracking. Not medical-grade measurement or body-fat estimation. Images stay in this tab; only measurement data is saved in this browser.</p>
    <details open><summary>Capture setup and limitations</summary>
      <ol>
        <li>Use a fixed phone position, normal lens (avoid wide angle), level camera, even lighting and a plain contrasting background. Keep arms separated from the torso.</li>
        <li>Place a flat known-size target beside you at the same distance from the camera as the body measurement plane. A printed ArUco target can be used; measure its actual horizontal edge with a ruler after printing. No automatic marker identification or camera pose correction is performed.</li>
        <li>Take front and true side photos in the same session. Keep the target facing the camera in both. Mark its horizontal edge in each photo.</li>
        <li>Sample the background, then mark waist at the same anatomical height in both views, shoulders at the outer deltoids and hips at their widest point. Verify suggested edges or disable suggestions and mark manually.</li>
        <li>Use the same stance, clothing and relaxed breathing phase each time. Loose clothes, shadows and arms touching the torso make segmentation unreliable.</li>
      </ol>
      <p>{geometryWarning} A target on a wall behind you gives a biased scale. Recapture if depth alignment or camera angle is uncertain. All results have manual-review quality, not statistical confidence.</p>
    </details>
    <div className="captures"><Capture view="front" onChange={setFront} /><Capture view="side" onChange={setSide} /></div>
    <section><h2>Save session</h2>
      <label>Optional weight (kg) <input type="number" min="1" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} /></label>
      {front && side && <p>Preview: waist width {front.waistWidth.cm.toFixed(1)} cm; depth {side.waistDepth.cm.toFixed(1)} cm; estimated circumference {ellipseCircumference(front.waistWidth.cm, side.waistDepth.cm).toFixed(1)} cm.</p>}
      <button disabled={!front || !side || !ready} onClick={save}>Save validated session locally</button>
      <p role="status">{message}</p>
    </section>
    <section><h2>Latest measurements</h2>
      {latest ? <><p>{new Date(latest.timestamp).toLocaleString()} — quality: manual review</p>
        <p>Estimated waist circumference: <strong>{latest.waistCircumference.cm.toFixed(1)} cm</strong> ({delta(latest.waistCircumference.cm, previous?.waistCircumference.cm)})</p>
        <p>Weight: {latest.weightKg === undefined ? 'Not entered' : `${latest.weightKg.toFixed(1)} kg (${delta(latest.weightKg, previous?.weightKg)})`}</p>
        <ul>{Object.entries(latest.measurements).map(([name, m]) => <li key={name}>{name}: {m.cm.toFixed(1)} cm ({m.view}; {delta(m.cm, previous?.measurements[name as keyof Session['measurements']]?.cm)})</li>)}</ul>
        <p>{latest.waistCircumference.warnings.join(' ')}</p>
      </> : <p>No saved sessions yet.</p>}
    </section>
    <section><h2>History</h2><table><thead><tr><th>Date</th><th>Estimated waist (cm)</th><th>Weight (kg)</th></tr></thead><tbody>{sessions.map(s => <tr key={s.id}><td>{new Date(s.timestamp).toLocaleString()}</td><td>{s.waistCircumference.cm.toFixed(1)}</td><td>{s.weightKg?.toFixed(1) ?? '—'}</td></tr>)}</tbody></table></section>
  </main>;
}
