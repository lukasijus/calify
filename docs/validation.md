# Issue #4 validation status

This is an uncommitted working-tree implementation. No branch, commit, push or PR
was created, in accordance with the execution constraints. Issues/PRs #2 and #3
were not modified or used as prerequisites.

## Passed in this environment

- `node tests/local-data.test.ts`: four tests passed (dated weight upsert and
  persistence; damaged storage/quota errors; profile/result validation; board metadata).
- Python syntax compilation of engine, generator and synthetic test module.
- Worker JavaScript syntax check.

## Blocked, not passed

The checkout has no `node_modules`, `pnpm`, `npm`, Python OpenCV or browser test
installation. Shell requests to npm/PyPI fail DNS resolution. Dependency installation
was attempted and failed. Consequently:

- **The existing pnpm lockfile needs regeneration** with `pnpm install` after the
  added MUI/Emotion and Playwright dependencies. It is intentionally not hand-edited
  or represented as verified. The current frozen-lockfile Docker install will fail
  until this is done. This patch is not ready for merge before resolving it.
- Lint, TypeScript/Next production build, browser route/navigation tests and
  desktop/mobile screenshots could not run.
- Native OpenCV tests failed at import (`ModuleNotFoundError: cv2`). No successful
  calibration or generated downloadable-plate detection has been observed here.
- Browser Pyodide/ChArUco API compatibility, runtime download, exact SVG download
  rendering and the synthetic camera recovery test still require execution.
- No screenshot or numerical calibration result is claimed or fabricated.

`AGENTS.md` requires installed Next documentation. The required directory was
absent and installation was unavailable. Official online Next documentation for
16.3.4 was consulted as a fallback, alongside MUI's official Next integration
and the linked OpenCV references. Read the installed documentation and rerun
validation once dependencies are available.

## Concrete implementation choice and limits

A browser worker plus Pyodide/OpenCV provides a real solver without a photo-upload
backend. The SVG is generated on demand, so a runtime failure also disables its
download instead of serving an unverified target. Runtime packages come from a
pinned public CDN distribution; network/offline packaging and device memory need
review before production use. The browser runtime is 4.11, while the requested
explanatory tutorials are 4.13. Native and browser replay tests exercise the APIs
actually selected; these tests must pass before acceptance.

The included dataset generator creates images from known intrinsics. Its outputs
are synthetic validation, not a real-world body-measurement study. The interface
explicitly makes no such accuracy claim. No manual scale substitute is used.

## References consulted

- [MUI Next.js integration](https://mui.com/material-ui/integrations/nextjs/):
  App Router cache provider and client theme boundaries.
- [Next basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath):
  build-time routing prefix and asset handling.
- [Next server/client components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
  and [layouts/pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages).
- [OpenCV ChArUco calibration](https://docs.opencv.org/4.13.0/da/d13/tutorial_aruco_calibration.html)
  and [board detection](https://docs.opencv.org/4.13.0/df/d4a/tutorial_charuco_detection.html).
- [OpenCV camera model](https://docs.opencv.org/4.11.0/d9/d0c/group__calib3d.html)
  and [Pyodide 0.28.3 packages](https://pyodide.org/en/0.28.3/usage/packages-in-pyodide.html).
