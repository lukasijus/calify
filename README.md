# Calify

Calify is a local calorie and body tracker: one page with a **weight and
calories graph**, plus optional meal photos.

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

- One full-width, minimal weight chart is the only content on the page
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
- Period selector: `1M · 3M · 6M · All`, anchored to the latest weigh-in.
- The chart is a hand-rolled SVG (no chart dependency) so the visual — smooth
  thin line, subtle area fade, sparse labels, cursor-following tooltip — can be
  tuned precisely. `WeightChart` already accepts an optional `trend` series and
  `movingAverage()` is implemented in `app/lib/weight.ts`, so a 7-day
  moving-average line can be switched on without reworking the page.

## Calories graph (issue #19)

- `Add calories` logs a kcal amount, a date/time, and an optional meal photo.
  Entries persist in the `calorie_entries` Postgres table (image bytes inline,
  `image_data`/`image_mime` columns), served through `/api/calories` (`GET`
  list, `POST` add as `multipart/form-data`) and
  `/api/calories/{id}/image` (`GET` the photo). Data access is in
  `app/lib/calorie-repo.ts`.
- Photos are capped at **8 MB** and must be JPEG, PNG, or WebP
  (`MAX_CALORIE_IMAGE_BYTES` / `ALLOWED_CALORIE_IMAGE_TYPES` in
  `app/lib/calorie.ts`, enforced client-side in `AddCalorieForm` and
  server-side in the route + a Postgres `CHECK` constraint). The limit started
  at 2 MB and was raised to 8 MB per the issue #19 discussion after phone
  camera photos kept tripping it.
- `WeightChart` draws both series on one canvas: weight keeps the left axis,
  calories get their own right-hand axis (or the left axis alone if weight is
  hidden). A legend above the chart has a checkbox per series to show/hide it;
  the hover tooltip reports both values near the cursor.
- Calorie entries with a photo show as a thumbnail strip below the chart,
  scoped to the current period/time-range selection.
