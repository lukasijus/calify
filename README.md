# Calify

Calify is a local calorie and body tracker.

## Local development

```bash
pnpm install
pnpm dev
```

The Jetson preview is available at:

<https://jetson.tail68fd31.ts.net/calify>

## MVP dashboard

The home page includes a responsive weight graph with complete history and change
since the previous entry, plus a daily food journal with optional calories and
photos. Both entry forms default to the current local date/time. Use the food
journal date picker to review other days; adding a backdated meal opens that day.

Data is saved to this browser's local storage (`calify.tracker.v1`), with no account,
server persistence, or device sync. Clearing site data removes the journal. Photos
are limited to JPG/PNG/WebP inputs up to 10 MB and resized to at most 800 pixels.
Storage errors keep the form open and do not report an unsaved entry as saved.

Validation (Node.js 22.6+ for the built-in TypeScript test runner):

```bash
pnpm lint
pnpm test
pnpm build
```

Manual browser check: add two weights with different timestamps, reload, and
verify the graph/history and change; add meals with no calories, zero calories,
and a photo; reload and verify the daily total and photo; select another day and
check that meals are separated by local date. Repeat at a narrow mobile width and
with keyboard-only dialog navigation. Block browser storage to verify the error
state. This patch does not deploy or change the existing preview configuration.
