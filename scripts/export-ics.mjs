import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { createIcs, extractEventsFromYearHtml, summarize } from "../src/calendar.mjs";

const SOURCE_URL = "https://www.un.org/calendar/en/year";

const args = parseArgs(process.argv.slice(2));
const outPath = args.out ?? "dgacm-coc.ics";
const summaryPath = args.summary ?? "dist/dgacm-coc-summary.json";
const query = args.query ?? process.env.FILTER_QUERY ?? "Committee on Conferences";
const year = normalizeYear(args.year ?? process.env.FILTER_YEAR ?? "current");
const sourceUrl = args.source ?? SOURCE_URL;
const minimumEvents = Number(args["min-events"] ?? process.env.MIN_EVENTS ?? 0);
const dtstamp = args.dtstamp ?? process.env.DTSTAMP ?? "1970-01-01T00:00:00Z";

const html = args.input ? await readTextFile(args.input) : await fetchHtml(sourceUrl);
const events = extractEventsFromYearHtml(html, {
  sourceUrl,
  query,
  year,
  committeeOnly: args["committee-only"] === "true"
});
const stats = summarize(events);
const ics = createIcs(events, {
  calendarName: args.name ?? process.env.CALENDAR_NAME ?? "DGACM Committee on Conferences",
  dtstamp
});

await mkdir(dirname(outPath), { recursive: true });
await mkdir(dirname(summaryPath), { recursive: true });
await writeFile(outPath, ics);
await writeFile(
  summaryPath,
  `${JSON.stringify({ sourceUrl, query, year, output: outPath, ...stats }, null, 2)}\n`
);

if (stats.dated < minimumEvents) {
  throw new Error(`Expected at least ${minimumEvents} exportable events, found ${stats.dated}`);
}

console.log(`Wrote ${outPath}: ${stats.dated} exportable events, ${stats.tentative} undated rows skipped.`);

async function fetchHtml(url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch {
    return await fetchWithCurl(url);
  }
}

async function fetchWithCurl(url) {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn("curl", ["-sSL", "-A", "Mozilla/5.0", url], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0 && stdout) {
        resolvePromise(stdout);
      } else {
        reject(new Error(stderr.trim() || `curl exited with ${code}`));
      }
    });
  });
}

async function readTextFile(path) {
  const { readFile } = await import("node:fs/promises");
  return await readFile(path, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function normalizeYear(value) {
  if (!value || value === "all") {
    return "";
  }
  if (value === "current") {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      timeZone: "America/New_York"
    }).format(new Date());
  }
  return String(value);
}
