# Calify

Calify is a local calorie and body tracker. The current MVP is a single,
focused **weight and calorie history graph**.

## Local development

```bash
pnpm install
docker compose up --build        # full stack: app + Postgres
```

To run `pnpm dev` against a local database, start any Postgres and point
`DATABASE_URL` at it (e.g. `DATABASE_URL=postgres://calify@localhost:5432/calify
pnpm dev`). The schema and the historical import are created automatically on
first query (`app/lib/db.ts`).

The Jetson preview is available at:

<https://jetson.tail68fd31.ts.net/calify>

Every push to `main` redeploys it via `.github/workflows/deploy-main-preview.yml`
(self-hosted runner on the Jetson).

## Weight graph

- One full-width chart shows weight and daily calorie totals
  (`app/page.tsx` → `app/components/weight-screen.tsx`).
- Entries persist in **PostgreSQL** (`weight_entries` table), served through the
  `/api/weights` route (`GET` list, `POST` add). Data access is in
  `app/lib/weight-repo.ts`; connection + bootstrap in `app/lib/db.ts`.
- The first query against an empty table imports the historical weigh-ins from
  issue #6 (`app/lib/weight-seed.ts`). Those entries only had a date in the
  original chat log, so each is normalized to a documented local-time
  placeholder of **12:00** (timezone context: Europe/Helsinki). The import is
  idempotent and never runs again once the table is non-empty.
- `at` is stored as a local-wall-clock ISO string (no offset), so it renders
  back in the same calendar/clock terms it was entered.
- Each PR preview gets its own isolated Postgres (`data` network is
  project-local); only the main deployment's database has real history.
- `Add weight` takes a weight in kg and a date/time (defaults to now).
- Period selector: `1M · 3M · 6M · All`, anchored to the latest weight or calorie entry.
- The chart is a hand-rolled SVG (no chart dependency) so the visual — smooth
  thin line, subtle area fade, sparse labels, cursor-following tooltip — can be
  tuned precisely. `WeightChart` already accepts an optional `trend` series and
  `movingAverage()` is implemented in `app/lib/weight.ts`, so a 7-day
  moving-average line can be switched on without reworking the page.

## Calories and photos

- `Add calories` opens a modal for kcal, local date/time, and an optional image.
- JPEG, PNG and WebP files up to 2 MB are accepted. Larger files must be resized;
  HEIC photos must be converted. The modal preserves input on failure and displays
  size, format or storage errors. Uploads use multipart data, avoiding base64 overhead.
- `calorie_entries` is created automatically on first query. Calories and the
  optional image bytes are saved in one PostgreSQL insert. `GET /api/calories`
  returns metadata only; `/api/calories/[id]/image` serves each photo on demand.
  Image types are detected by file signature, not filename or reported MIME type.
- Calories are summed by local calendar day and use the right-hand kcal axis;
  weight uses the left-hand kg axis. Legend checkboxes toggle each graph.
- Scrub the graph or use the day slider/arrows to browse days with entries.
  Selected-day image thumbnails appear below the graph and link to the full photo.
  Days without calorie records are not treated as zero-calorie days.
- Run `npm test` for upload boundary, API response, image retrieval and daily-total
  tests (persistence is mocked), and `npm run lint` / `npm run build` for app checks.
