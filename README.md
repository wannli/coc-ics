# DGACM COC ICS

Limit: keep this file under 160 lines. This is a local tool for turning the UN DGACM Calendar "By Year" page into an `.ics` calendar file.

## What It Does

- Fetches or accepts pasted HTML from `https://www.un.org/calendar/en/year`.
- Parses meeting title, venue, from date, and to date from the rendered year tables.
- Exports all dated rows exposed on the year page by default; optional text and year filters can narrow it.
- Exports concrete-date rows as all-day ICS events.
- Tracks the generated calendar file at `dgacm-coc.ics`.
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

The build writes `dist/` with the browser app and a sample ICS file. The export command writes the tracked `dgacm-coc.ics` file and a summary JSON in `dist/`.

## GitHub Action

`.github/workflows/build-ics.yml` can be run manually and also runs daily at 9am New York time. It tests, builds, exports all exposed years and months to `dgacm-coc.ics`, commits it when changed, and uploads the ICS plus summary JSON as an artifact.
