# Calify

Calify is a local calorie and body tracker.

## Local development

```bash
pnpm install
pnpm dev
```

The Jetson preview is available at:

<https://jetson.tail68fd31.ts.net/calify>

## Calibrated body capture POC

The home page accepts front/side photos, supports assisted silhouette measurement with manually validated scale, and saves measurement history in this browser. See [capture architecture and limitations](docs/calibrated-capture.md) for setup, geometry, persistence and validation. Photos are not stored or uploaded. Waist circumference is an ellipse estimate, not a medical measurement.

Run `pnpm test` (Node 22.18+ or 24), `pnpm lint`, and `pnpm build` to validate.
