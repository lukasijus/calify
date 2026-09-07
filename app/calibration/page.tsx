'use client';
/* Local previews never go through an image server. */
/* Blob download URLs are allocated and released together after render. */
/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import board from '@/public/calibration/board.json';
import { CalibrationClient, type Detection, type Plate } from '@/lib/calibration-client';
import { type CameraResult, validResult } from '@/lib/local-data';
import { loadPhoto } from '@/components/photos';
import { useProfile } from '@/components/profile';
type Capture = { id: string; name: string; url: string; detection?: Detection; error?: string };
const methodUrl = 'https://docs.opencv.org/4.13.0/da/d13/tutorial_aruco_calibration.html';
const boardUrl = 'https://docs.opencv.org/4.13.0/df/d4a/tutorial_charuco_detection.html';
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return <Paper component="section" sx={{ p: { xs: 2, sm: 3 } }}><Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}><Chip label={number} color="primary" size="small" /><Typography variant="h2">{title}</Typography></Stack>{children}</Paper>;
}
function SetupDiagram() {
  return <Box component="figure" sx={{ m: 0, mt: 2, bgcolor: '#edf4f0', borderRadius: 2, p: 2 }}>
    <svg viewBox="0 0 720 165" role="img" aria-labelledby="setup-title setup-desc"><title id="setup-title">Camera and reference placement</title><desc id="setup-desc">First capture a board at varied angles. Later, put a known reference near the subject's depth. A reference closer to the camera has a different scale.</desc>
      <g fill="none" stroke="#216657" strokeWidth="2"><rect x="20" y="55" width="65" height="45" rx="8" /><circle cx="53" cy="77" r="13" /><path d="M95 77L290 30M95 77L290 125" strokeDasharray="5 5" /><path d="M248 35l35 8v72l-35 8zM302 33l36 -8v105l-36 -8z" /><path d="M409 80h60" /><circle cx="595" cy="37" r="14" /><path d="M595 51v60m-30-40h60m-30 40l-20 30m20-30l20 30" /><rect x="637" y="65" width="30" height="44" /><path d="M560 149h120" strokeDasharray="4 4" /></g>
      <g fill="#20332e" fontSize="13" fontFamily="Arial"><text x="14" y="145">Fixed camera</text><text x="215" y="152">1. Board: varied poses</text><text x="480" y="163">2. Reference near subject depth</text></g>
    </svg><Typography component="figcaption" variant="body2">Two separate steps: calibrate the camera, then check each capture’s reference and placement. Diagram is schematic.</Typography>
  </Box>;
}
export default function Calibration() {
  const profile = useProfile();
  const mounted = useRef(true);
  const client = useRef<CalibrationClient | null>(null);
  const capturesRef = useRef<Capture[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [plate, setPlate] = useState<Plate | null>(null);
  const [plateUrl, setPlateUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [camera, setCamera] = useState('');
  const [lens, setLens] = useState('');
  const [result, setResult] = useState<CameraResult | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; client.current?.close(); capturesRef.current.forEach(c => URL.revokeObjectURL(c.url)); };
  }, []);
  useEffect(() => {
    if (!plate) return;
    const url = URL.createObjectURL(new Blob([plate.svg], { type: 'image/svg+xml' }));
    setPlateUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [plate]);
  function updateCaptures(next: Capture[]) { capturesRef.current = next; setCaptures(next); setResult(null); setNotice(''); }
  function getClient() { return client.current ??= new CalibrationClient(); }
  async function generate() {
    setBusy('Loading local OpenCV and verifying the printable board…'); setError('');
    try { setPlate(await getClient().request<Plate>({ action: 'plate' })); }
    catch (e) { setError(`Could not prepare the plate. ${(e as Error).message}`); client.current?.close(); client.current = null; }
    finally { setBusy(''); }
  }
  async function upload(files: File[]) {
    setError(''); setResult(null); setNotice('');
    if (capturesRef.current.length + files.length > 30) { setError('Keep at most 30 images in a session. Remove images before adding more.'); return; }
    setBusy('Detecting board corners locally…');
    try {
      for (const file of files) {
        if (!mounted.current) return;
        const photo = await loadPhoto(file);
        if (!mounted.current) { URL.revokeObjectURL(photo.url); return; }
        const bytes = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        if (!mounted.current) { URL.revokeObjectURL(photo.url); return; }
        const id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (capturesRef.current.some(c => c.id === id)) { URL.revokeObjectURL(photo.url); setError('A duplicate image was skipped. Capture different board positions and angles.'); continue; }
        const capture: Capture = { id, name: file.name, url: photo.url };
        try {
          capture.detection = await getClient().request<Detection>({ action: 'detect', bytes });
          const first = capturesRef.current.find(c => c.detection)?.detection;
          if (first && first.resolution.join() !== capture.detection.resolution.join()) {
            capture.error = `Resolution ${capture.detection.resolution.join(' × ')} differs from ${first.resolution.join(' × ')}. Remove this image and recapture with matching settings.`;
            capture.detection = undefined;
          }
        } catch (e) { capture.error = (e as Error).message; }
        if (!mounted.current) { URL.revokeObjectURL(photo.url); return; }
        updateCaptures([...capturesRef.current, capture]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  const usable = captures.filter(c => c.detection);
  const currentResolution = usable[0]?.detection?.resolution;
  const incompatible = profile.value && ((currentResolution && currentResolution.join() !== profile.value.resolution.join()) || (camera.trim() && camera.trim() !== profile.value.camera) || (lens.trim() && lens.trim() !== profile.value.lens));
  return <Stack spacing={3}>
    <Box><Typography variant="overline" color="primary">A REPEATABLE CAMERA SETUP</Typography><Typography variant="h1">Calibration</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Prepare your reference. Understand your camera. Keep the limitations in view.</Typography></Box>
    <Paper component="section" sx={{ p: 3 }}><Typography variant="h2">What we are calibrating</Typography><Typography sx={{ mt: 1 }}>Camera calibration fits focal lengths, the optical center and lens distortion from several images of a known board at different positions and angles. ChArUco combines identifiable markers with accurately located chessboard corners. <a href={methodUrl}>OpenCV explains the technique and corner accuracy.</a></Typography><SetupDiagram />
      <Typography sx={{ mt: 2 }}>A known-size reference visible in a later photo is a separate scale/pose check for that capture. Calify currently implements board detection and a pinhole camera model with five distortion coefficients. It does not yet apply that profile to body photos or calculate body measurements. A manual two-point scale is not full camera calibration.</Typography>
      <Alert severity="info" sx={{ mt: 2 }}>A calibrated flat board does not validate body-measurement accuracy. A board closer to the camera than the body has a different apparent scale; perspective and the body’s three-dimensional shape remain limitations.</Alert>
    </Paper>
    <Typography color="text.secondary">Download/print → verify physical size → upload → review → calibrate → save</Typography>
    {busy && <Box role="status"><Typography sx={{ mb: 1 }}>{busy}</Typography><LinearProgress /></Box>}
    {error && <Alert severity="error">{error}</Alert>}
    {!busy && error && <Button onClick={() => { client.current?.close(); client.current = null; setError(''); }}>Restart solver for next attempt</Button>}
    <Step number={1} title="Download and print the board">
      <Typography>Calify ChArUco v1 · {board.dictionary} · {board.squaresX} × {board.squaresY} squares · {board.squareMm} mm squares · {board.markerMm} mm markers. The target is {board.widthMm} × {board.heightMm} mm on A4 ({board.pageWidthMm} × {board.pageHeightMm} mm). Non-legacy OpenCV pattern; sequential marker IDs starting at 0.</Typography>
      <Typography color="text.secondary" sx={{ my: 2 }}>Prepare downloads the Pyodide 0.28.3 / OpenCV 4.11 runtime from jsDelivr (a large initial download). Detection and calibration run in a browser worker. Photos are never sent to a server. Runtime loading needs internet access.</Typography>
      <Button variant="outlined" disabled={!!busy} onClick={generate}>{plate ? 'Regenerate plate' : 'Prepare printable plate'}</Button>
      {plateUrl && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mt: 2 }} alignItems="center"><Box component="img" src={plateUrl} alt="Generated A4 ChArUco calibration plate, with a 100 mm ruler reference" sx={{ width: 210, border: '1px solid #ccd8d1' }} /><Box><Button component="a" href={plateUrl} download="calify-charuco-v1-a4.svg" variant="contained">Download A4 SVG</Button><Typography sx={{ mt: 1 }}>OpenCV {plate?.opencv} detected all {plate?.detectedCorners} corners in the generated target.</Typography><Typography variant="body2" color="text.secondary">Print the downloaded SVG, not this on-screen preview.</Typography></Box></Stack>}
      <Typography sx={{ mt: 2 }}>Print at <strong>100% / actual size</strong>. Disable fit-to-page. Measure the labelled 100 mm line with a ruler, then mount the entire sheet flat on a rigid surface. The generated plate is only offered after its target passes OpenCV detection.</Typography>
    </Step>
    <Step number={2} title="Verify size and identify your setup">
      <FormControlLabel control={<Checkbox checked={verified} disabled={!!busy} onChange={e => { setVerified(e.target.checked); setResult(null); }} />} label="I measured the printed reference as 100 mm and mounted the sheet flat." />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ my: 2 }}><TextField fullWidth label="Camera / device" placeholder="e.g. Pixel 8 rear camera" value={camera} disabled={!!busy} onChange={e => { setCamera(e.target.value); setResult(null); }} /><TextField fullWidth label="Lens, zoom and focus setting" placeholder="e.g. main lens, 1×, fixed focus" value={lens} disabled={!!busy} onChange={e => { setLens(e.target.value); setResult(null); }} /></Stack>
      <Typography color="text.secondary">Keep the same lens, zoom, focus, resolution, crop and orientation throughout. Use even lighting without glare. Mark camera and subject positions for repeatable later photos; keep the reference near the subject’s depth. Settings are self-reported, not automatically verified from photo metadata.</Typography>
      {incompatible && <Alert severity="warning" sx={{ mt: 2 }}>These settings or image dimensions differ from the saved profile. Recalibrate for this setup before using that profile.</Alert>}
    </Step>
    <Step number={3} title="Capture and upload board images">
      <Typography>Take 12–20 sharp photos, with the board covering different parts of the frame. Vary its distance and tilt in both directions. Include edges of the frame. Keep at least 12 inner corners visible. Eight usable images is the minimum, not a guarantee of sufficient coverage.</Typography>
      <Button component="label" variant="contained" disabled={!!busy || !verified || !camera.trim() || !lens.trim()} sx={{ mt: 2 }}>Upload board images<input hidden type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Board images" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void upload(files); }} /></Button>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>JPEG, PNG or WebP; up to 20 MB and 24 MP each, 30 images per session. Images stay in memory and clear when you leave this page or reload.</Typography>
    </Step>
    <Step number={4} title="Review image quality">
      <Typography role="status">{usable.length} usable / {captures.length} uploaded{currentResolution ? ` · ${currentResolution.join(' × ')} pixels` : ' · no image resolution yet'}</Typography>
      {!captures.length && <Typography color="text.secondary" sx={{ mt: 1 }}>Upload board photos to see detected corners and rejection reasons.</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>{captures.map(c => <Paper key={c.id} sx={{ p: 2, minWidth: 0 }}>
        {c.detection ? <svg viewBox={`0 0 ${c.detection.resolution.join(' ')}`} role="img" aria-label={`${c.name}: ${c.detection.ids.length} detected corners marked in green`} style={{ width: '100%', maxHeight: 250 }}><image href={c.url} width={c.detection.resolution[0]} height={c.detection.resolution[1]} />{c.detection.corners.map(([x,y], i) => <circle key={i} cx={x} cy={y} r={Math.max(4, c.detection!.resolution[0] / 180)} stroke="black" strokeWidth="1" fill="#5bff85" />)}</svg> : <img src={c.url} alt={c.name} style={{ width: '100%', height: 180, objectFit: 'contain' }} />}
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere', mt: 1 }}>{c.name}</Typography>
        {c.detection && <Typography variant="body2">{c.detection.ids.length} corners · {(c.detection.coverage * 100).toFixed(1)}% corner coverage · sharpness {c.detection.sharpness.toFixed(0)}</Typography>}
        {c.error && <Alert severity="warning" sx={{ mt: 1, overflowWrap: 'anywhere' }}>{c.error}</Alert>}
        <Button disabled={!!busy} onClick={() => { URL.revokeObjectURL(c.url); updateCaptures(captures.filter(v => v.id !== c.id)); }}>Remove image</Button>
      </Paper>)}</Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Coverage and sharpness are rough screening heuristics. Review overlays for misplaced corners; add varied angles even if every image is accepted.</Typography>
    </Step>
    <Step number={5} title="Calibrate and inspect the fit">
      <Button variant="contained" disabled={!!busy || usable.length < 8 || !verified || !camera.trim() || !lens.trim()} onClick={async () => {
        setBusy('Fitting camera parameters on this device…'); setError(''); setResult(null); setNotice('');
        try {
          const value = await getClient().request<CameraResult>({ action: 'calibrate', views: usable.map(c => c.detection) });
          if (!validResult(value)) throw new Error('Invalid or unstable solver output. Recapture varied, sharp views and retry.');
          setResult(value);
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(''); }
      }}>Calibrate camera</Button>
      <Typography sx={{ mt: 2 }}>Reprojection error measures how closely fitted points match detected board corners, in pixels. Lower is a better image fit, not proof of accurate body measurements. Calify rejects RMS above 2 px or invalid parameters as a basic review threshold, not a certification.</Typography>
      {result && <Box sx={{ mt: 2 }}><Alert severity="info">Parameters computed, not yet saved. RMS: {result.rms.toFixed(3)} px · {result.usableImages} images · {result.resolution.join(' × ')} px.</Alert><Box sx={{ overflowX: 'auto' }}><Table size="small"><caption>Per-image reprojection RMS. Replace images with unusually large errors and recalibrate.</caption><TableHead><TableRow><TableCell>Image</TableCell><TableCell>Error (px)</TableCell></TableRow></TableHead><TableBody>{result.perViewErrors.map((v,i) => <TableRow key={i}><TableCell sx={{ overflowWrap: 'anywhere' }}>{usable[i]?.name}</TableCell><TableCell>{v.toFixed(3)}</TableCell></TableRow>)}</TableBody></Table></Box><details><summary>Inspect camera matrix and distortion coefficients</summary><pre>{JSON.stringify({ cameraMatrix: result.cameraMatrix, distortion: result.distortion }, null, 2)}</pre></details></Box>}
    </Step>
    <Step number={6} title="Save and review your setup">
      <Button variant="contained" disabled={!result || !!busy || !profile.ready} onClick={() => {
        if (result && profile.save({ ...result, version: 1, board, camera: camera.trim(), lens: lens.trim(), timestamp: new Date().toISOString() })) setNotice('Camera profile saved on this device.');
      }}>Save setup locally</Button>
      <Typography role="status" sx={{ mt: 1 }}>{notice}</Typography>
      {profile.error && <Alert severity="error">{profile.error}</Alert>}
      {profile.value ? <Box sx={{ mt: 2 }}><Typography variant="h3">Saved: {profile.value.camera} · {profile.value.lens}</Typography><Typography>{profile.value.resolution.join(' × ')} px · {profile.value.usableImages} images · RMS {profile.value.rms.toFixed(3)} px</Typography><Typography variant="body2">Saved {profile.value.timestamp}</Typography><details><summary>Review complete local profile</summary><Typography variant="body2">Matrix: fx, fy, cx, cy in pixels. Distortion order: k1, k2, p1, p2, k3. Board lengths in mm.</Typography><pre>{JSON.stringify(profile.value, null, 2)}</pre></details></Box> : <Typography sx={{ mt: 1 }}>No usable profile saved. Completing the steps alone does not create a calibration.</Typography>}
      {(profile.value || profile.error) && <Button color="error" onClick={() => { if (profile.save(null)) setNotice('Saved profile removed.'); }}>Reset saved profile</Button>}
      <Typography color="text.secondary" sx={{ mt: 2 }}>Recalibrate after changing camera, lens, zoom, focus, resolution, crop or orientation. No saved profile is automatically applied to Main photos. The profile and weight history persist only in this browser and preview path; clearing site data removes them.</Typography>
    </Step>
    <Paper component="section" sx={{ p: 3 }}><Typography variant="h2">Method and sources</Typography><Stack spacing={2} sx={{ mt: 2 }}>
      <Typography><a href={methodUrl}>OpenCV: calibration with ArUco and ChArUco</a> describes estimating camera parameters from multiple viewpoints and the rationale for ChArUco corners. This supports the board-calibration method, not validated Calify body measurements.</Typography>
      <Typography><a href={boardUrl}>OpenCV: creating and detecting ChArUco boards</a> explains the dictionary, square/marker dimensions and board detection. Calify uses the same JSON board definition for OpenCV generation, detection and point matching, with non-legacy layout.</Typography>
      <Typography><a href="https://docs.opencv.org/4.11.0/d9/d0c/group__calib3d.html">OpenCV camera model and calibration reference</a> documents the pinhole model, distortion and reprojection diagnostics. Calify runs <code>calibrateCameraExtended</code> on detected ChArUco correspondences. Strong wide-angle/fisheye lenses may need a different model.</Typography>
      <Typography><a href="https://pyodide.org/en/0.28.3/usage/packages-in-pyodide.html">Pyodide’s package list</a> specifies the browser OpenCV 4.11 runtime. The explanatory tutorials above are 4.13; Calify explicitly uses the 4.11 implementation. Synthetic validation instructions are in the repository; separate real-world validation is still required.</Typography>
    </Stack></Paper>
  </Stack>;
}
