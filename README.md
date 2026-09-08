# Calify

Calify is a local calorie and body tracker.

## Dashboard

The main page includes a responsive weight-history chart, a recent weight change
(entries in the seven days ending at the latest weigh-in), and a daily food journal.
Both forms default to the current local date/time when the dashboard loads and after
saving. Food descriptions are required; calories and photos are optional. Select a
journal date to revisit meals. Saving a backdated meal opens that day automatically.
Weight history and food cards support deletion with confirmation.

Entries and photos persist in IndexedDB on the current browser and device. There is
no server storage, account, backup, or cross-device sync. Clearing browser data
removes the journal; private browsing may discard it on exit. Photos up to 15 MB
are decoded locally and resized to at most 1,000 pixels before storage. No uploads
or new dependencies are required. Storage failures are shown without clearing the
form or reporting a successful save.

## Validation

Run `pnpm lint`, `pnpm test` (Node.js 22.18+ for native TypeScript loading), and
`pnpm build`. Tests cover local-day boundaries, feed ordering, optional/zero calorie
totals, and photo input limits.

Manual browser checks at `/calify`:

1. Add two weights on different dates, including a backdated entry. Check the chart,
   recent change, and expandable history; reload and check persistence.
2. Add a text-only meal, a meal with zero calories, and a meal with calories and a
   photo. Check thumbnails, totals, and persistence after reload.
3. Add a meal on another day and switch journal dates. Check that totals only
   include the selected local day.
4. Delete food/weight entries and reload. Try an unsupported or oversized photo;
   check that the form retains its input and displays an error.
5. Check keyboard navigation and layouts at 375px and desktop widths. With browser
   storage disabled, confirm that the app displays a load error and disables saving.

## Local development

```bash
pnpm install
pnpm dev
```

The Jetson preview is available at:

<https://jetson.tail68fd31.ts.net/calify>
