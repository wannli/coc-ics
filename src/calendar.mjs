const MONTHS = new Map([
  ["jan", 1],
  ["feb", 2],
  ["mar", 3],
  ["apr", 4],
  ["may", 5],
  ["jun", 6],
  ["jul", 7],
  ["aug", 8],
  ["sep", 9],
  ["sept", 9],
  ["oct", 10],
  ["nov", 11],
  ["dec", 12]
]);

const FIELD_BY_CLASS = {
  "views-field-uw-search-aggregated-title": "title",
  "views-field-name": "venue",
  "views-field-uw-calendar-conference-from-date": "fromText",
  "views-field-uw-calendar-conference-to-date": "toText"
};

export function extractEventsFromYearHtml(html, options = {}) {
  const documentHtml = String(html);
  const sourceUrl = options.sourceUrl ?? "https://www.un.org/calendar/en/year";
  const rows = [...documentHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const events = [];

  for (const row of rows) {
    const cells = {};
    const tdMatches = [...row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];

    for (const [, attrs, contents] of tdMatches) {
      const field = fieldFromAttrs(attrs);
      if (field) {
        cells[field] = cleanText(contents);
      }
    }

    if (!cells.title || !cells.venue || !cells.fromText || !cells.toText) {
      continue;
    }

    const startDate = parseUnDate(cells.fromText);
    const endDate = parseUnDate(cells.toText);
    const tentative = !startDate || !endDate;

    const event = {
      title: cells.title,
      venue: cells.venue,
      fromText: cells.fromText,
      toText: cells.toText,
      startDate,
      endDate,
      sourceYear: yearBefore(documentHtml, row.index ?? 0),
      tentative,
      sourceUrl
    };

    if (matchesEvent(event, options)) {
      events.push(event);
    }
  }

  return events;
}

export function matchesEvent(event, options = {}) {
  const query = normalize(options.query ?? "");
  const year = options.year ? String(options.year) : "";
  const haystack = normalize(`${event.title} ${event.venue} ${event.fromText} ${event.toText}`);

  if (query && !haystack.includes(query)) {
    return false;
  }

  if (options.committeeOnly && !isCommitteeEvent(event)) {
    return false;
  }

  if (year && ![event.sourceYear, event.fromText, event.toText, event.startDate, event.endDate].some((value) => String(value ?? "").includes(year))) {
    return false;
  }

  return true;
}

export function isCommitteeEvent(event) {
  const text = normalize(`${event.title} ${event.venue}`);
  return text.includes("committee on conferences") || /\bcoc\b/.test(text);
}

export function createIcs(events, options = {}) {
  const datedEvents = events.filter((event) => !event.tentative);
  const prodId = options.prodId ?? "-//Local DGACM COC ICS//EN";
  const calendarName = options.calendarName ?? "DGACM Calendar Export";
  const now = formatTimestamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${escapeIcsText(prodId)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-WR-TIMEZONE:UTC"
  ];

  for (const event of datedEvents) {
    const endExclusive = addDays(event.endDate, 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${eventUid(event)}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${compactDate(event.startDate)}`,
      `DTEND;VALUE=DATE:${compactDate(endExclusive)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `LOCATION:${escapeIcsText(event.venue)}`,
      `DESCRIPTION:${escapeIcsText(descriptionFor(event))}`,
      `URL:${escapeIcsText(event.sourceUrl)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return foldIcsLines(lines).join("\r\n") + "\r\n";
}

export function summarize(events) {
  const dated = events.filter((event) => !event.tentative).length;
  const tentative = events.length - dated;
  return { total: events.length, dated, tentative };
}

export function parseUnDate(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = MONTHS.get(match[2].toLowerCase().slice(0, 4).replace(".", "")) ?? MONTHS.get(match[2].toLowerCase().slice(0, 3));
  const year = Number(match[3]);

  if (!month || day < 1 || day > 31) {
    return null;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
}

export function cleanText(html) {
  return decodeEntities(String(html))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldFromAttrs(attrs) {
  const classMatch = attrs.match(/\bclass=(["'])(.*?)\1/i);
  if (!classMatch) {
    return null;
  }

  for (const className of classMatch[2].split(/\s+/)) {
    if (FIELD_BY_CLASS[className]) {
      return FIELD_BY_CLASS[className];
    }
  }

  return null;
}

function yearBefore(html, index) {
  const prefix = html.slice(0, index);
  const matches = [...prefix.matchAll(/\bid=(["'])[^"']*year_(\d{4})[^"']*\1/gi)];
  return matches.length ? matches.at(-1)[2] : null;
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}

function compactDate(value) {
  return String(value).replaceAll("-", "");
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function descriptionFor(event) {
  const dateLine = event.startDate === event.endDate ? event.fromText : `${event.fromText} to ${event.toText}`;
  return `Source: UN Calendar of Conferences and Meetings\\nDates: ${dateLine}`;
}

function eventUid(event) {
  const key = `${event.title}|${event.venue}|${event.startDate}|${event.endDate}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return `${hash.toString(16)}@dgacm-coc-ics.local`;
}

function foldIcsLines(lines) {
  return lines.flatMap((line) => {
    const chunks = [];
    let rest = line;
    while (rest.length > 75) {
      chunks.push(rest.slice(0, 75));
      rest = ` ${rest.slice(75)}`;
    }
    chunks.push(rest);
    return chunks;
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}
