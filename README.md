# Calify

Calify is a local calorie and body tracker. The current MVP is a single,
focused **weight-history graph**.

## Local development

```bash
pnpm install
pnpm dev
```

The Jetson preview is available at:

<https://jetson.tail68fd31.ts.net/calify>

## Weight graph

- One full-width, minimal weight chart is the only content on the page
  (`app/page.tsx` → `app/components/weight-screen.tsx`).
- Entries persist in `localStorage` under `calify.weight.v1`
  (`app/lib/weight.ts`).
- On first run the store is seeded with the historical weigh-ins from issue #6
  (`app/lib/weight-seed.ts`). Those entries only had a date in the original
  chat log, so each is normalized to a documented local-time placeholder of
  **12:00** (timezone context: Europe/Helsinki). Wiping all entries does not
  re-seed.
- `Add weight` takes a weight in kg and a date/time (defaults to now).
- Period selector: `1M · 3M · 6M · All`, anchored to the latest weigh-in.
- The chart is a hand-rolled SVG (no chart dependency) so the visual — smooth
  thin line, subtle area fade, sparse labels, cursor-following tooltip — can be
  tuned precisely. `WeightChart` already accepts an optional `trend` series and
  `movingAverage()` is implemented in `app/lib/weight.ts`, so a 7-day
  moving-average line can be switched on without reworking the page.
