'use client';

import { useRef, useState } from 'react';
import { measure, silhouetteRow, type Measurement, type Point, type Segment, type View } from '../lib/geometry';

type Result = Record<string, Measurement>;
export default function Capture({ view, onChange }: { view: View; onChange: (result: Result | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLCanvasElement | null>(null);
  const uploadVersion = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [referenceCm, setReferenceCm] = useState('20');
  const [points, setPoints] = useState<Record<string, Segment>>({});
  const [pending, setPending] = useState<Point | null>(null);
  const [background, setBackground] = useState<Point | null>(null);
  const [mode, setMode] = useState('reference');
  const [automatic, setAutomatic] = useState(true);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const names = view === 'front' ? ['waistWidth', 'shoulderWidth', 'hipWidth'] : ['waistDepth'];
  const labels: Record<string, string> = { reference: 'Reference edge', waistWidth: 'Waist width', shoulderWidth: 'Shoulder width', hipWidth: 'Hip width', waistDepth: 'Waist depth', background: 'Plain background' };
  function invalidate() { setReviewed(false); onChange(null); setError(''); }
  function draw(next: Record<string, Segment>, bg = background, first: Point | null = null) {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !image.current) return;
    ctx.drawImage(image.current, 0, 0);
    ctx.lineWidth = 3;
    ctx.font = '18px sans-serif';
    Object.entries(next).forEach(([name, [a, b]]) => {
      ctx.strokeStyle = name === 'reference' ? '#ffdc00' : '#00ffff';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillText(labels[name], a.x, Math.max(20, a.y - 8));
    });
    for (const p of [bg, first]) if (p) { ctx.fillStyle = '#ff00ff'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8); }
  }
  async function upload(file?: File) {
    const version = ++uploadVersion.current;
    invalidate(); setLoaded(false); setPoints({}); setPending(null); setBackground(null); image.current = null;
    canvas.current?.getContext('2d')?.clearRect(0, 0, canvas.current.width, canvas.current.height);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) { setError('Use JPEG, PNG or WebP up to 20 MB.'); return; }
    try {
      const bitmap = await createImageBitmap(file);
      if (version !== uploadVersion.current) { bitmap.close(); return; }
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      const source = document.createElement('canvas'); source.width = Math.round(bitmap.width * scale); source.height = Math.round(bitmap.height * scale);
      source.getContext('2d')!.drawImage(bitmap, 0, 0, source.width, source.height); bitmap.close(); image.current = source;
      canvas.current!.width = source.width; canvas.current!.height = source.height;
      setLoaded(true); setMode('reference'); draw({}, null);
    } catch { if (version === uploadVersion.current) setError('Cannot decode image. Export it as JPEG or PNG.'); }
  }
  function click(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!loaded || !canvas.current || !image.current) return;
    invalidate();
    const rect = canvas.current.getBoundingClientRect();
    const p = { x: Math.min(canvas.current.width - 1, Math.max(0, (event.clientX - rect.left) * canvas.current.width / rect.width)), y: Math.min(canvas.current.height - 1, Math.max(0, (event.clientY - rect.top) * canvas.current.height / rect.height)) };
    if (mode === 'background') { setBackground(p); draw(points, p); return; }
    let segment: Segment;
    if (mode !== 'reference' && automatic) {
      if (!background) { setError('First select a plain background point.'); return; }
      try {
        const { width, height } = image.current;
        segment = silhouetteRow(image.current.getContext('2d')!.getImageData(0, 0, width, height).data, width, height, p, background);
      } catch (e) { setError((e as Error).message); return; }
    } else {
      if (!pending) { setPending(p); draw(points, background, p); return; }
      segment = [pending, { x: p.x, y: mode === 'reference' ? p.y : pending.y }]; setPending(null);
    }
    const next = { ...points, [mode]: segment }; setPoints(next); draw(next);
  }
  function validate() {
    try {
      if (pending) throw new Error('Finish marking both endpoints first.');
      if (!points.reference || names.some(name => !points[name])) throw new Error('Mark the reference and every measurement first.');
      const result = Object.fromEntries(names.map(name => [name, measure(points[name], points.reference, Number(referenceCm), view)]));
      onChange(result); setReviewed(true); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  return <section>
    <h2>{view === 'front' ? 'Front photo' : 'Side photo'}</h2>
    <label>Photo <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])} /></label>
    <label>Measured horizontal reference edge (cm) <input type="number" min="1" step="0.1" value={referenceCm} onChange={e => { setReferenceCm(e.target.value); invalidate(); }} /></label>
    <label>Mark <select value={mode} onChange={e => { setMode(e.target.value); setPending(null); draw(points); }}>{['reference', 'background', ...names].map(name => <option key={name} value={name}>{labels[name]}</option>)}</select></label>
    <label><input type="checkbox" checked={automatic} onChange={e => { setAutomatic(e.target.checked); setPending(null); draw(points); }} /> Suggest silhouette edges from background contrast</label>
    <p>{mode === 'reference' ? 'Click both ends of the known horizontal reference edge.' : mode === 'background' ? 'Click a plain background area next to the body.' : automatic ? 'Click inside the torso at the desired anatomical level. Inspect the cyan edge suggestions.' : 'Click the left and right body edges at the desired level.'} Choose each measurement from the menu. Click again to replace it.</p>
    <canvas ref={canvas} onClick={click} aria-label={`${view} image annotation; select reference and silhouette points`} />
    <p>Marked: {Object.keys(points).map(name => labels[name]).join(', ') || 'none'}</p>
    <button type="button" disabled={!loaded} onClick={validate}>Confirm reference and all body edges</button>
    {reviewed && <p>Validated manually. Ready to save.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
