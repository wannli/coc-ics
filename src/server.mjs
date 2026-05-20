import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createIcs, extractEventsFromYearHtml, summarize } from "./calendar.mjs";

const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "127.0.0.1";
const ROOT = resolve("src/client");
const SOURCE_URL = "https://www.un.org/calendar/en/year";

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/fetch") {
      const html = await fetchYearPage();
      return sendJson(res, { ok: true, sourceUrl: SOURCE_URL, htmlLength: html.length, html });
    }

    if (url.pathname === "/api/preview" && req.method === "POST") {
      const body = await readJson(req);
      const events = extractEventsFromYearHtml(body.html ?? "", {
        sourceUrl: body.sourceUrl ?? SOURCE_URL,
        query: body.query ?? "",
        year: body.year ?? "",
        committeeOnly: Boolean(body.committeeOnly)
      });
      return sendJson(res, { ok: true, events, summary: summarize(events) });
    }

    if (url.pathname === "/api/export" && req.method === "POST") {
      const body = await readJson(req);
      const events = extractEventsFromYearHtml(body.html ?? "", {
        sourceUrl: body.sourceUrl ?? SOURCE_URL,
        query: body.query ?? "",
        year: body.year ?? "",
        committeeOnly: Boolean(body.committeeOnly)
      });
      const ics = createIcs(events, {
        calendarName: body.calendarName || "DGACM Calendar Export"
      });
      res.writeHead(200, {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"dgacm-calendar.ics\""
      });
      return res.end(ics);
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DGACM COC ICS running at http://${HOST}:${PORT}`);
});

async function fetchYearPage() {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) {
      throw new Error(`UN calendar returned ${response.status}`);
    }
    return await response.text();
  } catch {
    return await fetchWithCurl(SOURCE_URL);
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

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    return res.end(file);
  } catch {
    res.writeHead(404);
    return res.end("Not found");
  }
}

async function readJson(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 5_000_000) {
      throw new Error("Request body is too large");
    }
  }
  return text ? JSON.parse(text) : {};
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
