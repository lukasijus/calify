/* global importScripts, loadPyodide */
// Only public runtime/package assets are downloaded. Image bytes never leave this worker.
let runtime;
async function initialize() {
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.js');
  const py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/' });
  await py.loadPackage(['numpy', 'opencv-python']);
  const [source, board] = await Promise.all([
    fetch(new URL('engine.py', self.location.href)),
    fetch(new URL('board.json', self.location.href)),
  ]);
  if (!source.ok || !board.ok) throw new Error('Calibration files are unavailable. Check the preview base path.');
  await py.runPythonAsync(await source.text());
  py.runPython("assert cv2.__version__ == '4.11.0', 'Expected OpenCV 4.11.0; runtime is incompatible.'\nassert hasattr(cv2.aruco, 'CharucoDetector') and hasattr(cv2, 'calibrateCameraExtended'), 'This runtime lacks the required ChArUco calibration APIs.'");
  py.globals.set('board_json', await board.text());
  py.runPython('definition = json.loads(board_json)');
  return py;
}
async function handle({ data }) {
  try {
    runtime ??= initialize().catch(error => { runtime = undefined; throw error; });
    const py = await runtime;
    // Transfer binary separately to avoid large JSON-encoded photos.
    const payload = { ...data.payload };
    const bytes = payload.bytes;
    delete payload.bytes;
    py.globals.set('payload_json', JSON.stringify(payload));
    let proxy;
    try {
      if (bytes) { proxy = py.toPy(new Uint8Array(bytes)); py.globals.set('image_bytes', proxy); }
      const result = await py.runPythonAsync("payload = json.loads(payload_json)\nif 'image_bytes' in globals(): payload['bytes'] = image_bytes\njson.dumps(dispatch(payload, definition), allow_nan=False)");
      self.postMessage({ id: data.id, result: JSON.parse(result) });
    } finally {
      py.runPython("globals().pop('image_bytes', None)\nglobals().pop('payload', None)\nNone");
      proxy?.destroy();
    }
  } catch (error) {
    const message = String(error).trim().split('\n').at(-1);
    self.postMessage({ id: data.id, error: message || 'Local solver failed. Restart it and check your images.' });
  }
}
// Serialize access to the Python globals, even if requests arrive together.
let queue = Promise.resolve();
self.onmessage = event => { queue = queue.then(() => handle(event)); };
