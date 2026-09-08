# Calify

A local photo-progress dashboard and guided ChArUco camera calibration workspace.

## Development

```sh
pnpm install
pnpm dev
```

The default route is `/calify`, with Calibration at `/calify/calibration`.
Set `CALIFY_BASE_PATH` **before building** for an isolated preview, for example
`CALIFY_BASE_PATH=/calify/pr-4 pnpm build`. Next links add the prefix; public
worker assets use the same build-time value. Docker builds accept
`--build-arg CALIFY_BASE_PATH=/calify/pr-4` and copy the public runtime sources.
Changing a running server's environment cannot change the built base path.

MUI uses a shared theme and the official App Router Emotion cache integration.
Main has two local photo previews and an editable dated weight history, graph
and accessible table. Calibration contains the setup explanation, print workflow,
detection overlays, parameter fitting, diagnostics and saved-profile review/reset.

## Data and solver

Photos use local object URLs. Main photos survive route changes within the tab
but clear on reload. Calibration images clear on leaving Calibration or reloading.
Weights and profiles use validated localStorage records, namespaced by base path;
storage errors are shown. Clearing site data removes these records. No image or
profile is uploaded and there is no calibration API/server-side photo processing.

The first calibration action downloads **Pyodide 0.28.3 and its OpenCV 4.11.0
package** from the pinned jsDelivr distribution. A browser Web Worker runs the
same Python engine used by native tests. This requires internet access for public
runtime packages, WebAssembly and sufficient device memory; it is not an offline
installation. CDN runtime availability is an external dependency. Runtime failures
leave calibration unsuccessful and can be retried. A production offline package
would need a separate vendoring/build decision; no backend is introduced here.

`public/calibration/board.json` defines ChArUco v1: DICT_5X5_100, 5 × 7 squares,
30 mm square length, 21 mm marker length, non-legacy layout, sequential IDs from 0.
OpenCV generates the target and detects all 24 inner corners before enabling the
A4 SVG download. Lossless rectangle vectorization preserves the generated pattern.
The target is 150 × 210 mm, centered on 210 × 297 mm A4, with a 100 mm reference.
The exact same board definition is used for detection and calibration point matching.

The solver calls `calibrateCameraExtended`, fitting a pinhole model with five
coefficients (k1, k2, p1, p2, k3). It requires eight usable images, matching resolution,
noncollinear corners and basic pose diversity; file hashes filter identical uploads.
Blur/coverage thresholds and RMS ≤ 2 px are screening heuristics, not validated
quality guarantees. Settings are user-identified; EXIF does not authenticate them.
Recalibrate after lens, zoom, focus, crop, orientation or resolution changes.
No body measurements or automatic corrections to Main photos are implemented.
A reference at a different depth cannot establish the body's scale. Low board
reprojection error does not demonstrate body-measurement accuracy.

## Reproduce the plate and validation

Requires Python 3.10+ and Node 22.6+ for the dependency-free TypeScript tests.

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r scripts/requirements-calibration.txt
python scripts/generate-plate.py > /tmp/calify-charuco-v1-a4.svg
pnpm test
CALIFY_TEST_ARTIFACTS=/tmp/calify-validation pnpm test:calibration
pnpm lint
pnpm build
pnpm exec playwright install chromium
CALIFY_TEST_ARTIFACTS=/tmp/calify-validation pnpm test:browser
```

Native tests reconstruct the downloadable SVG target and detect its corners,
check missing boards, incomplete inputs, mixed resolutions and repeated poses,
then render twelve board images from a known synthetic camera and fit them again.
Expected camera: 1280 × 960, fx 1050, fy 1030, cx 640, cy 480, zero distortion.
Assertions require RMS < 1 px, focal lengths within 4%, principal point within
15 px. These tolerances cover synthetic raster interpolation, not real-world accuracy.
`CALIFY_TEST_ARTIFACTS` writes the dataset and computed results for browser replay.

Playwright builds under `/calify/pr-4`, tests both viewport sizes, navigation,
reloads, weight editing/persistence, public assets, generated downloads and real
browser calibration/profile persistence on the synthetic dataset. It captures
`main.png` and `calibration.png` per project in `test-results`. No numerical
solver output is mocked. Run with an empty base path and `/calify` too if changing
routing configuration.

See [implementation validation status](docs/validation.md) for checks actually run
in the task environment and remaining blockers.
