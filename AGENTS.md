# AGENTS.md

Limit: keep this file under 120 lines. Record how to work in this repo; keep product facts in `README.md`.

- Use Git and conventional commits for project changes.
- Keep the app dependency-free unless a library removes real risk.
- Prefer the current UN Calendar "By Year" page as the source: `https://www.un.org/calendar/en/year`.
- The UN year view is paginated; fetch every `?page=N` page until the pager ends, then dedupe identical rows.
- Treat the page as rendered Drupal HTML. The stable row fields are meeting title, venue, from date, and to date.
- Default generated `dgacm-coc.ics` to all exposed years and months on the paginated UN year view; use query or year filters only for ad hoc exports.
- Preserve "Dates to be determined" rows in previews, but do not export them as ICS events because calendar clients need concrete dates.
- Run `npm test` and `npm run build` before reporting success.
- Use `npm run export:ics` to generate the tracked `dgacm-coc.ics`; in CI this runs through `.github/workflows/build-ics.yml` and commits the file when changed.
- If changing the frontend, run `npm run dev` and smoke-test the local app in a browser.
- Keep this file and `README.md` tight; update only when the workflow or user-visible behavior changes.
