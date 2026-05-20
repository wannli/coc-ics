# DGACM COC ICS

Limit: keep this file under 160 lines. This is a local tool for turning the UN DGACM Calendar "By Year" page into an `.ics` calendar file.

## What It Does

- Fetches or accepts pasted HTML from `https://www.un.org/calendar/en/year`.
- Parses meeting title, venue, from date, and to date from the rendered year tables.
- Filters rows by text, with a quick Committee/CoC filter.
- Exports concrete-date rows as all-day ICS events.
- Shows undated rows in the preview but skips them during ICS export.

## Run Locally

```sh
npm run dev
```

Open the printed local URL. Use "Fetch UN year page" or paste saved HTML from the UN page, then export the filtered results.

## Build And Test

```sh
npm test
npm run build
npm run export:ics
```

The build writes `dist/` with the browser app and a sample ICS file. The export command writes `dist/dgacm-coc.ics`.

## GitHub Action

`.github/workflows/build-ics.yml` can be run manually and also runs daily at 9am New York time. It tests, builds, exports `dist/dgacm-coc.ics`, and uploads the ICS plus summary JSON as an artifact.
