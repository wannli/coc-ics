import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createIcs, extractEventsFromYearHtml, parseUnDate, summarize } from "../src/calendar.mjs";

const html = await readFile("test/fixtures/year-snippet.html", "utf8");

test("parses DGACM year-page table rows", () => {
  const events = extractEventsFromYearHtml(html, { year: "2026" });

  assert.equal(events.length, 5);
  assert.deepEqual(summarize(events), { total: 5, dated: 4, tentative: 1 });
  assert.equal(events[0].title, "Committee on Conferences, organizational session");
  assert.equal(events[0].venue, "New York");
  assert.equal(events[0].startDate, "2026-04-23");
  assert.equal(events[1].endDate, "2026-09-08");
  assert.equal(events[2].tentative, true);
});

test("includes non-committee June meetings when no text filter is set", () => {
  const events = extractEventsFromYearHtml(html, { year: "2026" });
  const juneTitles = events
    .filter((event) => event.startDate?.startsWith("2026-06"))
    .map((event) => event.title);

  assert.deepEqual(juneTitles, [
    "Economic and Social Council, Operational activities for development segment",
    "Committee on Contributions, Eighty-sixth session"
  ]);
});

test("includes every exposed year when no year filter is set", () => {
  const events = extractEventsFromYearHtml(html);
  const datedYears = new Set(events.filter((event) => !event.tentative).map((event) => event.startDate.slice(0, 4)));

  assert.deepEqual([...datedYears].sort(), ["2025", "2026"]);
});

test("filters committee rows by query and committee mode", () => {
  const events = extractEventsFromYearHtml(html, {
    query: "substantive",
    committeeOnly: true
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Committee on Conferences, substantive session");
});

test("creates valid all-day ICS and skips tentative rows", () => {
  const events = extractEventsFromYearHtml(html);
  const ics = createIcs(events, { calendarName: "Test Calendar" });
  const unfolded = unfoldIcs(ics);

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /X-WR-CALNAME:Test Calendar/);
  assert.match(ics, /SUMMARY:Committee on Conferences\\, organizational session/);
  assert.match(ics, /DESCRIPTION:Source: UN Calendar of Conferences and Meetings\\nDates:/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260423/);
  assert.match(ics, /DTEND;VALUE=DATE:20260424/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260902/);
  assert.match(ics, /DTEND;VALUE=DATE:20260909/);
  assert.match(unfolded, /SUMMARY:Economic and Social Council\\, Operational activities for development segment/);
  assert.match(unfolded, /SUMMARY:Conference of the States Parties to the United Nations Convention against Corruption\\, Eleventh session/);
  assert.match(ics, /DTSTART;VALUE=DATE:20251215/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260601/);
  assert.doesNotMatch(ics, /Ad Hoc Working Group/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 5);
});

test("parses UN date text", () => {
  assert.equal(parseUnDate("7 Dec 2026"), "2026-12-07");
  assert.equal(parseUnDate("Dates to be determined"), null);
});

function unfoldIcs(value) {
  return value.replace(/\r\n[ \t]/g, "");
}
