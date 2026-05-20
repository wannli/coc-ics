import { mkdir, readFile, rm, writeFile, cp } from "node:fs/promises";
import { createIcs, extractEventsFromYearHtml, summarize } from "../src/calendar.mjs";

const sampleHtml = await readFile("test/fixtures/year-snippet.html", "utf8");
const events = extractEventsFromYearHtml(sampleHtml, {
  sourceUrl: "https://www.un.org/calendar/en/year",
  query: "Committee",
  year: "2026"
});
const stats = summarize(events);

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("src/client", "dist", { recursive: true });
await writeFile(
  "dist/sample-dgacm-calendar.ics",
  createIcs(events, { calendarName: "DGACM Calendar Sample" })
);
await writeFile(
  "dist/build-info.json",
  `${JSON.stringify({ builtAt: new Date().toISOString(), ...stats }, null, 2)}\n`
);

console.log(`Built dist with ${stats.total} sample rows (${stats.dated} exportable).`);
