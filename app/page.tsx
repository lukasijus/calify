'use client';
/* Local object URLs deliberately bypass remote image optimization. */
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { usePhotos, loadPhoto } from '@/components/photos';
import { useLocalState } from '@/components/local-state';
import { useProfile } from '@/components/profile';
import { type Weight, upsertWeight, validWeights } from '@/lib/local-data';
const emptyWeights: Weight[] = [];
function PhotoPanel({ view }: { view: 'Front' | 'Side' }) {
  const { photos, replace } = usePhotos();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const profile = useProfile();
  const photo = photos[view];
  const mismatch = photo && profile.value && (photo.width !== profile.value.resolution[0] || photo.height !== profile.value.resolution[1]);
  return <Paper sx={{ p: 3, flex: 1, minWidth: 0 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Typography variant="h2">{view} view</Typography><Chip label="Local photo" size="small" variant="outlined" /></Stack>
    <Box sx={{ bgcolor: '#f2f5f3', border: '1px dashed #b7cac1', borderRadius: 2, mb: 2, minHeight: 340, display: 'grid', placeItems: 'center' }}>
      {photo ? <img className="preview" src={photo.url} alt={`${view} view: ${photo.name}`} /> : <Box sx={{ textAlign: 'center', p: 3 }}><Typography sx={{ fontSize: 40, color: '#8ca59a' }} aria-hidden>＋</Typography><Typography variant="h3">Your {view.toLowerCase()} view goes here</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Add a photo to start your visual record.</Typography></Box>}
    </Box>
    <Button component="label" variant="outlined" disabled={busy}>{photo ? 'Replace' : 'Upload'} {view.toLowerCase()} photo<input aria-label={`${view} photo`} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      setBusy(true);
      try { replace(view, await loadPhoto(file)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open photo.'); }
      finally { setBusy(false); }
    }} /></Button>
    {photo && <Button onClick={() => replace(view)}>Remove</Button>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {mismatch && <Alert severity="warning" sx={{ mt: 2 }}>Photo resolution differs from your saved calibration. Review the camera setup on Calibration.</Alert>}
  </Paper>;
}
function WeightGraph({ entries }: { entries: Weight[] }) {
  if (!entries.length) return <Box sx={{ py: 7, textAlign: 'center', bgcolor: '#f7f9f8', borderRadius: 2 }}><Typography variant="h3">Your first entry is the starting point</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Add a dated weight to see your history in kg.</Typography></Box>;
  const ordered = [...entries].sort((a,b) => a.date.localeCompare(b.date));
  const min = Math.min(...ordered.map(w => w.kg)) - 1;
  const max = Math.max(...ordered.map(w => w.kg)) + 1;
  const start = Date.parse(ordered[0].date), end = Date.parse(ordered.at(-1)!.date);
  const x = (w: Weight) => start === end ? 440 : 70 + (Date.parse(w.date) - start) / (end - start) * 740;
  const y = (w: Weight) => 195 - (w.kg - min) / (max - min) * 155;
  return <><svg role="img" aria-labelledby="weight-title weight-description" viewBox="0 0 880 260" style={{ width: '100%' }}>
    <title id="weight-title">Weight history: dates and kilograms</title><desc id="weight-description">{ordered.length} entries. Exact dates and weights are in the table below.</desc>
    {[min, (min + max) / 2, max].map(t => <g key={t}><line x1="70" x2="810" y1={195 - (t-min)/(max-min)*155} y2={195 - (t-min)/(max-min)*155} stroke="#dae3de" /><text x="5" y={200 - (t-min)/(max-min)*155} fontSize="13" fill="#596c65">{t.toFixed(1)} kg</text></g>)}
    {ordered.length > 1 && <polyline points={ordered.map(w => `${x(w)},${y(w)}`).join(' ')} fill="none" stroke="#216657" strokeWidth="3" />}
    {ordered.map(w => <circle key={w.date} cx={x(w)} cy={y(w)} r="5" fill="#216657"><title>{w.date}: {w.kg} kg</title></circle>)}
    <text x={start === end ? 440 : 70} y="230" textAnchor={start === end ? 'middle' : 'start'} fontSize="14">{ordered[0].date}</text>
    {start !== end && <text x="810" y="230" textAnchor="end" fontSize="14">{ordered.at(-1)!.date}</text>}
    <text x="440" y="255" textAnchor="middle" fontSize="13">Date</text>
  </svg>{ordered.length === 1 && <Typography color="text.secondary">One entry recorded. Add another date to see a trend.</Typography>}</>;
}
export default function Main() {
  const weights = useLocalState('weights', emptyWeights, validWeights);
  const profile = useProfile();
  const [date, setDate] = useState('');
  const [kg, setKg] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  return <Stack spacing={3}>
    <Box><Typography variant="overline" color="primary">YOUR PERSONAL OVERVIEW</Typography><Typography variant="h1">Main</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Two perspectives. One simple record of progress.</Typography></Box>
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}><Chip size="small" label={profile.value ? 'Camera profile saved' : 'Camera setup not saved'} variant="outlined" /><Button component={Link} href="/calibration">Review calibration →</Button></Stack>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}><PhotoPanel view="Front" /><PhotoPanel view="Side" /></Stack>
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h2">Weight history</Typography><Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Your recorded weight over time. No estimates.</Typography>
      {!weights.ready ? <Typography>Loading local history…</Typography> : <WeightGraph entries={weights.value} />}
      {(weights.error || error) && <Alert severity="error" sx={{ my: 2 }}>{weights.error || error}</Alert>}
      {weights.error && <Button color="error" onClick={() => weights.save([])}>Reset unavailable weight history</Button>}
      <Box component="form" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, my: 3, alignItems: 'start' }} onSubmit={e => {
        e.preventDefault();
        try { const next = upsertWeight(weights.value, { date, kg: Number(kg) }); if (weights.save(next)) { setError(''); setNotice(`Saved ${date}: ${Number(kg)} kg.`); } }
        catch (e) { setError((e as Error).message); }
      }}>
        <TextField label="Date" type="date" value={date} required onChange={e => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Weight (kg)" type="number" value={kg} required onChange={e => setKg(e.target.value)} slotProps={{ htmlInput: { min: 0.1, max: 1000, step: 0.1 } }} />
        <Button type="submit" variant="contained" disabled={!weights.ready || !!weights.error}>Save entry</Button>
      </Box>
      <Typography variant="body2" color="text.secondary">Saving an existing date updates that entry. To change a date, remove the old entry and add a new one.</Typography>
      <Typography role="status" sx={{ mt: 1 }}>{notice}</Typography>
      {weights.value.length > 0 && <Box sx={{ overflowX: 'auto' }}><Table size="small"><caption>Recorded weights. Dates use YYYY-MM-DD; weight is in kilograms.</caption><TableHead><TableRow><TableCell scope="col">Date</TableCell><TableCell scope="col">Weight (kg)</TableCell><TableCell scope="col">Actions</TableCell></TableRow></TableHead><TableBody>{[...weights.value].sort((a,b) => a.date.localeCompare(b.date)).map(w => <TableRow key={w.date}><TableCell component="th" scope="row">{w.date}</TableCell><TableCell>{w.kg}</TableCell><TableCell><Button aria-label={`Edit weight ${w.date}`} onClick={() => { setDate(w.date); setKg(String(w.kg)); }}>Edit</Button><Button aria-label={`Remove weight ${w.date}`} onClick={() => weights.save(weights.value.filter(v => v.date !== w.date))}>Remove</Button></TableCell></TableRow>)}</TableBody></Table></Box>}
    </Paper>
    <Typography variant="body2" color="text.secondary">Photos stay in memory while this tab is open and clear on reload. Weight history and saved camera profiles stay in this browser, separately for each preview path, until you remove them or clear site data. Nothing is uploaded.</Typography>
  </Stack>;
}
