# Calify

Calify is a local calorie and body tracker.

The dashboard includes a weight-history graph with the change since the previous
entry, plus a food journal with a date picker and daily known-calorie totals.
Both forms support backdated entries. Food descriptions are required; calories
and photos are optional. Entries can be deleted from the journal or expanded
weight history.

Data is saved in IndexedDB in the current browser, including photos resized to
at most 1,000 pixels on their longest side. There is no account or cross-device
sync. Clearing site data removes the journal, and private browsing may discard
it when the session ends. Saving errors leave the form open for retry.

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/calify` (the existing base path is preserved).

## Validation

Use Node 22.18+ or Node 24 for the dependency-free TypeScript tests:

```bash
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

For a browser smoke test, add two weights out of date order, then reload and
check the graph and history. Add foods with missing calories, zero calories,
and a photo; confirm the total only sums known values. Add a food on another
date and use the date picker to switch between days. Reload to verify the photo
and entries persist. Check deleting entries, keyboard dialog navigation, and
the layout at a narrow mobile width. Storage or photo errors should retain
the form without adding an unsaved entry to the dashboard.

The Jetson preview is available at:

<https://jetson.tail68fd31.ts.net/calify>
