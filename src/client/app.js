const state = {
  sourceUrl: "https://www.un.org/calendar/en/year",
  events: []
};

const els = {
  fetchButton: document.querySelector("#fetchButton"),
  sampleButton: document.querySelector("#sampleButton"),
  exportButton: document.querySelector("#exportButton"),
  queryInput: document.querySelector("#queryInput"),
  yearInput: document.querySelector("#yearInput"),
  committeeInput: document.querySelector("#committeeInput"),
  htmlInput: document.querySelector("#htmlInput"),
  resultsBody: document.querySelector("#resultsBody"),
  summaryText: document.querySelector("#summaryText"),
  sourceText: document.querySelector("#sourceText")
};

const sampleHtml = `
<div id="year_2026_months">
  <table>
    <tbody>
      <tr>
        <td class="views-field views-field-uw-search-aggregated-title">Committee on Conferences, organizational session</td>
        <td class="views-field views-field-name">New York</td>
        <td class="views-field views-field-uw-calendar-conference-from-date"><span>23 Apr 2026</span></td>
        <td class="views-field views-field-uw-calendar-conference-to-date"><span>23 Apr 2026</span></td>
      </tr>
      <tr>
        <td class="views-field views-field-uw-search-aggregated-title">Committee on Conferences, substantive session</td>
        <td class="views-field views-field-name">New York</td>
        <td class="views-field views-field-uw-calendar-conference-from-date"><span>2 Sep 2026</span></td>
        <td class="views-field views-field-uw-calendar-conference-to-date"><span>8 Sep 2026</span></td>
      </tr>
      <tr>
        <td class="views-field views-field-uw-search-aggregated-title">Committee on Conferences, briefing</td>
        <td class="views-field views-field-name">New York</td>
        <td class="views-field views-field-uw-calendar-conference-from-date">Dates to be determined</td>
        <td class="views-field views-field-uw-calendar-conference-to-date">Dates to be determined</td>
      </tr>
    </tbody>
  </table>
</div>`;

els.fetchButton.addEventListener("click", async () => {
  await withBusy(els.fetchButton, async () => {
    setStatus("Fetching UN year page...");
    const payload = await getJson("/api/fetch");
    els.htmlInput.value = payload.html;
    state.sourceUrl = payload.sourceUrl;
    await preview();
  });
});

els.sampleButton.addEventListener("click", async () => {
  els.htmlInput.value = sampleHtml;
  state.sourceUrl = "local sample";
  await preview();
});

els.exportButton.addEventListener("click", async () => {
  await withBusy(els.exportButton, async () => {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload())
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dgacm-calendar.ics";
    link.click();
    URL.revokeObjectURL(link.href);
  });
});

for (const input of [els.queryInput, els.yearInput, els.committeeInput]) {
  input.addEventListener("input", debounce(preview, 200));
  input.addEventListener("change", preview);
}

els.htmlInput.addEventListener("input", debounce(preview, 300));

async function preview() {
  const html = els.htmlInput.value.trim();
  if (!html) {
    state.events = [];
    render();
    setStatus("No page loaded yet.");
    return;
  }

  const payload = await getJson("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload())
  });
  state.events = payload.events;
  render(payload.summary);
}

function render(summary = { total: 0, dated: 0, tentative: 0 }) {
  els.summaryText.textContent = `${summary.total} matching rows, ${summary.dated} exportable, ${summary.tentative} undated`;
  els.sourceText.textContent = state.sourceUrl;
  els.resultsBody.replaceChildren(...state.events.slice(0, 400).map(renderRow));
  if (state.events.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No matching rows.";
    row.append(cell);
    els.resultsBody.append(row);
  }
}

function renderRow(event) {
  const row = document.createElement("tr");
  row.append(
    td(event.title),
    td(event.venue),
    td(event.fromText),
    td(event.toText),
    statusCell(event)
  );
  return row;
}

function statusCell(event) {
  const cell = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = `badge ${event.tentative ? "tentative" : "ready"}`;
  badge.textContent = event.tentative ? "Skipped" : "Exported";
  cell.append(badge);
  return cell;
}

function td(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function requestPayload() {
  return {
    html: els.htmlInput.value,
    sourceUrl: state.sourceUrl,
    query: els.queryInput.value,
    year: els.yearInput.value,
    committeeOnly: els.committeeInput.checked,
    calendarName: "DGACM Calendar Export"
  };
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

async function withBusy(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (error) {
    setStatus(error.message);
  } finally {
    button.disabled = false;
  }
}

function setStatus(message) {
  els.summaryText.textContent = message;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
