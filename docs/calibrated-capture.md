# Calibrated capture POC

Implementation note for issue #2: the starter contains only a Next.js page, with no backend or inference pipeline. This implementation uses browser canvas image decoding, manually validated calibration and seeded background-contrast silhouette extraction. No dependencies, cloud uploads, stereo hardware or inference service are added. It is an assisted capture feasibility experiment, not an automatic pose/segmentation model.

## Workflow

Use JPEG, PNG or WebP front and side photos (up to 20 MB each). Images are downsampled to at most 1400 pixels on their longest edge before annotation; both the reference and body use that same coordinate system. Images are held in memory and discarded on reload, never serialized. Each view has its own reference size and endpoints. Use a measured horizontal edge of a printed ArUco/ChArUco board or another rigid rectangular target. Verify the actual printed dimension with a ruler: printer scaling and margins can change it. This POC manually validates the edge; it does not decode marker IDs, estimate camera intrinsics or rectify camera pose. No supplied printable marker is necessary to operate this manual mode.

Select the reference, click its two endpoints, sample the plain background and select each body measurement. Click inside the torso at the anatomical level to suggest silhouette boundaries. The algorithm scans left and right while RGB distance from the sampled background exceeds 45, stopping at the first background pixel. It fails explicitly on background seeds, tiny spans or image-border intersections. Shadows, patterns and low contrast can still produce plausible incorrect boundaries. Inspect every overlay and replace endpoints manually when needed. This method provides only a cross-section segmentation; anatomical levels are human landmarks. No learned pose model is bundled. Shoulders are outer deltoid width, hips the widest frontal span, and waist uses the same repeatable anatomical height in both views. Exclude arms from the span.

Confirm all annotations per view to enable saving. All results carry `manual-review` quality and warnings, not a calibrated probability. Any changed measurement or reference invalidates confirmation. Optional weight must be positive. Save failures and invalid stored data are surfaced without replacing the history.

## Geometry

For each image, scale = known reference edge in cm / reference edge length in pixels. Body width uses the horizontal distance between annotated endpoints. Reject reference edges shorter than 10 pixels, body spans shorter than 2 pixels, and reference slope above approximately 5.7 degrees. This is only a camera-roll check: a horizontal edge cannot establish absence of yaw or perspective.

Assume the camera is level, the reference plane is parallel to the sensor and the body cross-section lies at the reference depth. There is no depth or pose correction. Under a pinhole model, reported size / true size = reference distance / body distance. A board at 3 m and body at 2.7 m overestimates size by about 11%. A wall behind the subject is therefore unsuitable without matching depths. The body itself has depth, so even careful setup retains error. Keep the camera distance and height, lens/zoom, target, stance, measurement levels, breathing phase, lighting and clothing fixed. Avoid wide-angle lenses. Recapture when alignment cannot be established.

Waist circumference is explicitly estimated from an elliptical cross-section. With semi-axes a = frontal width / 2, b = side depth / 2, h = ((a-b)/(a+b))², Ramanujan II gives C ≈ π(a+b)(1 + 3h/(10 + √(4-3h))). The cross-section of a real waist is not an ellipse; these estimates are not tape measurements. Clothing, landmark placement, posture, lens distortion, calibration clicks, silhouette errors and breathing all affect results. No medical accuracy or body-fat inference is claimed.

## Persistence and validation

Versioned localStorage key `calify.sessions.v1` stores UUID, ISO timestamp, optional kg, four cm measurements with source view/quality/warnings and estimated waist circumference with quality/warnings. There are no image references because photos are not persisted. History is local to this browser origin; clearing browser data loses it. Concurrent tab saves are not transactional. Deltas compare against the immediately previous session; absent weight is not interpolated.

Run `pnpm test` with Node 22.18+ (or Node 24), `pnpm lint`, and `pnpm build` after installing the lockfile dependencies. Tests cover scales, invalid geometry, ellipse calculations, synthetic silhouette extraction and history parsing. Manual smoke check: use two contrasting images with a known horizontal reference, annotate all levels, confirm, save with weight, repeat with changed spans/weight, verify deltas, reload and verify history. Also test unsupported images, low contrast, replacing an upload, incomplete endpoints and denied localStorage. Real repeat-capture studies are still needed to quantify repeatability.

During implementation this checkout had no node_modules or npm/pnpm executable, and registry DNS was unavailable. Required local Next.js guides could not be read; no new Next-specific APIs were introduced. Lint/build and browser screenshots require the validation workflow's installed dependencies.
