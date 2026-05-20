import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createIcs, extractEventsFromYearHtml, parseUnDate, summarize } from "../src/calendar.mjs";

const html = await readFile("test/fixtures/year-snippet.html", "utf8");

test("parses DGACM year-page table rows", () => {
  const events = extractEventsFromYearHtml(html, { year: "2026" });

  assert.equal(events.length, 3);
  assert.deepEqual(summarize(events), { total: 3, dated: 2, tentative: 1 });
  assert.equal(events[0].title, "Committee on Conferences, organizational session");
  assert.equal(events[0].venue, "New York");
  assert.equal(events[0].startDate, "2026-04-23");
  assert.equal(events[1].endDate, "2026-09-08");
  assert.equal(events[2].tentative, true);
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

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /X-WR-CALNAME:Test Calendar/);
  assert.match(ics, /SUMMARY:Committee on Conferences\\, organizational session/);
  assert.match(ics, /DESCRIPTION:Source: UN Calendar of Conferences and Meetings\\nDates:/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260423/);
  assert.match(ics, /DTEND;VALUE=DATE:20260424/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260902/);
  assert.match(ics, /DTEND;VALUE=DATE:20260909/);
  assert.doesNotMatch(ics, /Ad Hoc Working Group/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
});

test("parses UN date text", () => {
  assert.equal(parseUnDate("7 Dec 2026"), "2026-12-07");
  assert.equal(parseUnDate("Dates to be determined"), null);
});
