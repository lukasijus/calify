# Issue #4 validation

PR #5 was repaired after its first agent run added dependencies without updating
the lockfile. The lockfile now matches package.json; frozen installation remains
required. The lint error and browser-test selectors/navigation race were fixed.
The worker-generated Git askpass helper was removed from the repository.

## Verified on the Jetson

- Frozen pnpm 11.25.0 installation, lint, four local-data tests, and production
  build pass. Installed Next.js docs were reviewed.
- Three native OpenCV 4.11 tests pass: generated plate dimensions/detection,
  rejection of unusable data, and synthetic camera recovery.
- Desktop and mobile browser checks exercise weight persistence/editing,
  navigation and refresh under `/calify-pr-5`, A4 SVG download, overflow checks,
  and the real browser Pyodide/OpenCV calibration/save/reset workflow.
- Calibration uses 12 synthetic 1280 × 960 images. Reprojection RMS is
  **0.3275 pixels**. Recovered focal lengths are **1046.56 / 1026.10 pixels**,
  compared with the known **1050 / 1030 pixels**. This tests the implementation,
  not real-world body-measurement accuracy or general lens-distortion recovery.
- The generated 210 × 297 mm A4 SVG is independently reconstructed and detected
  in the native test; all 24 ChArUco corners are detected. Printing at actual size
  and measuring the physical reference remain necessary.

## Reproduction

Use the README's native Python environment setup, then:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
CALIFY_BASE_PATH=/calify-pr-5 pnpm build
CALIFY_TEST_ARTIFACTS=/tmp/calify-validation pnpm test:calibration
CALIFY_TEST_ARTIFACTS=/tmp/calify-validation CALIFY_BASE_PATH=/calify-pr-5 pnpm test:browser --workers=1
```

The Python environment must be activated for `test:calibration`. Browser tests
require the Playwright Chromium installation. Screenshots and the numerical
result are included in [validation artifacts](validation/).

## Remaining product limits

Runtime assets are downloaded from the pinned Pyodide CDN; first-use calibration
needs internet access. Photos stay in the browser. Native and browser tests use
OpenCV 4.11, while the explanatory links cover OpenCV 4.13. The synthetic dataset
is not a real-world repeatability study. Calibration does not automatically apply
body measurements to Main photos, and no medical/body-fat accuracy is claimed.
