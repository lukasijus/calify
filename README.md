# Calify

Calify is a local calorie and body tracker. This iteration is intentionally a
single screen: a calm, minimal **weight-history graph**.

## Local development

```bash
pnpm install
pnpm dev
```

The Jetson preview is available at:

<https://jetson.tail68fd31.ts.net/calify>

## Weight tracking

- The dashboard (`app/page.tsx`) shows the current weight, the trend over the
  selected period (`1M · 3M · 6M · All`), an `Add weight` action, and a
  full-width chart.
- The chart (`app/weight-chart.tsx`) is a hand-rolled SVG: a thin monotone-cubic
  line with a subtle area fade, sparse axis labels, restrained point markers and
  a cursor-following tooltip. It is deliberately architected so a second series
  (e.g. a 7-day moving average) can be layered on later without a rewrite.
- Entries are persisted in `localStorage` under `calify.weight.entries.v1`
  (`lib/weight-data.ts`). On first load the series is seeded with the measured
  historical weigh-ins.

### Historical imports

The historical weigh-ins only preserved a **date**, not a clock time. They are
imported as date-level entries normalised to a documented local-time placeholder
of **12:00 (noon, Europe/Helsinki)** and tagged `source: "historical"` so a
future pass can distinguish raw weigh-ins from a smoothed trend.
