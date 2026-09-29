"use strict";

// Endpoints and measured training facts are published independently of the design.
const byId = (id) => document.getElementById(id);
const write = (id, value) => {
  if (value !== undefined && value !== null && String(value).trim() !== "") byId(id).textContent = String(value);
};
const safeUrl = (value) => {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch (_) { return null; }
};
const activate = (id, value, label) => {
  const url = safeUrl(value);
  if (!url) return false;
  const link = byId(id);
  link.href = url;
  link.removeAttribute("aria-disabled");
  if (label) {
    link.replaceChildren(document.createTextNode(label + " "));
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(arrow);
  }
  return true;
};
async function readJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(path, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("Report unavailable");
    return await response.json();
  } finally { clearTimeout(timeout); }
}
const endpointReady = readJson("endpoint.json").then((endpoint) => {
  const oldUrl = endpoint.old_url || endpoint.chat_url;
  const oldAvailable = activate("old-chat", oldUrl);
  const newAvailable = activate("new-chat", endpoint.new_url, "Open next model");
  const ultraAvailable = activate("ultra-chat", endpoint.ultra_url);
  activate("hero-chat", endpoint.chat_url || oldUrl);
  if (endpoint.repository_url) activate("repository", endpoint.repository_url);
  write("old-status", oldAvailable ? "Endpoint configured" : "Unavailable");
  write("new-status", newAvailable ? "Candidate preview" : "In development");
  write("ultra-status", ultraAvailable ? "Endpoint configured" : "Unavailable");
  write("endpoint-note", oldAvailable || newAvailable || ultraAvailable
    ? "Chat runs on local hardware through a temporary tunnel. It may be offline during training or maintenance."
    : "Chat addresses are not currently configured. Please check back after the next update.");
  return endpoint;
}).catch(() => {
  write("old-status", "Address unavailable");
  write("ultra-status", "Address unavailable");
  write("endpoint-note", "The current chat addresses could not be loaded. Please refresh to try again.");
  return null;
});
function renderCatalog(catalog, endpoint) {
  if (!Array.isArray(catalog.modes)) return;
  const labels = { ready: "Ready to chat", pending: "Not yet available", offline: "Currently offline" };
  catalog.modes.forEach((mode) => {
    if (!["old", "new", "ultra"].includes(mode.id) || !labels[mode.status]) return;
    write(`${mode.id}-status`, labels[mode.status]);
    if (mode.id === "new") activate("new-chat", endpoint.new_url, mode.status === "pending" ? "Preview next model" : "Open next model");
  });
}
const humanState = (value) => typeof value === "string" ? (value === "running" ? "training" : value).replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase()) : null;
function utcDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(date);
  return `${day} · ${time} UTC`;
}
const corpusLabel = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? `${new Intl.NumberFormat("en-GB").format(value)} characters` : null;
const numeric = (value) => typeof value === "number" && Number.isFinite(value);
function sourceResults(sources) {
  const measured = sources.filter((row) => row && numeric(row.pilotBpc) && numeric(row.overnightBpc));
  if (!measured.length) return 0;
  const table = document.createElement("table");
  const caption = table.createCaption();
  caption.textContent = "Shared evaluation · bits per character";
  const header = table.createTHead().insertRow();
  ["Evaluation source", "Pilot", "Extended", "Change (extended − pilot)"].forEach((label) => {
    const th = document.createElement("th"); th.scope = "col"; th.textContent = label; header.append(th);
  });
  const body = table.createTBody();
  measured.forEach((source) => {
    const row = body.insertRow();
    const label = document.createElement("th"); label.scope = "row"; label.textContent = source.name || "Evaluation source"; row.append(label);
    const delta = numeric(source.deltaBpc) ? source.deltaBpc : source.overnightBpc - source.pilotBpc;
    let deltaText = `${delta > 0 ? "+" : ""}${delta.toFixed(4)}`;
    if (Array.isArray(source.ci95) && source.ci95.length === 2 && source.ci95.every(numeric)) deltaText += ` (95% CI ${source.ci95[0].toFixed(4)} to ${source.ci95[1].toFixed(4)})`;
    [source.pilotBpc.toFixed(4), source.overnightBpc.toFixed(4), deltaText].forEach((value) => { row.insertCell().textContent = value; });
  });
  const region = byId("source-results"); region.replaceChildren(table); region.hidden = false;
  write("pilot-evaluation", `${measured.length} source${measured.length === 1 ? "" : "s"} evaluated ↓`);
  write("extended-evaluation", `${measured.length} source${measured.length === 1 ? "" : "s"} evaluated ↓`);
  byId("pilot-evaluation").classList.remove("pending-value");
  byId("extended-evaluation").classList.remove("pending-value");
  return measured.length;
}
function renderTraining(report) {
  if (!report || typeof report !== "object" || Array.isArray(report) || typeof report.status !== "string") throw new Error("Invalid training report");
  write("training-phase", humanState(report.status));
  const phaseSummary = {
    training: "The extended run is training on a larger corpus. A shared evaluation follows when it finishes.",
    evaluating: "Training has finished. The checkpoints are being evaluated on shared sources before the comparison is published.",
    complete: "The training runs have finished. Follow their evaluation and published measurements below.",
    failed: "The run needs attention. The published status below shows the latest reported stage."
  };
  write("training-summary", report.summary || phaseSummary[report.status]);
  if (report.pilot) {
    write("pilot-label", report.pilot.label);
    if (numeric(report.pilot.durationMinutes)) write("pilot-duration", `${report.pilot.durationMinutes} minutes`);
    write("pilot-state", humanState(report.pilot.status));
    write("pilot-timeline-status", humanState(report.pilot.status));
    write("pilot-corpus", corpusLabel(report.pilot.trainCharacters));
  }
  if (report.overnight) {
    const run = report.overnight;
    write("extended-label", run.label);
    if (numeric(run.durationHours)) write("extended-duration", `${run.durationHours} hours`);
    write("extended-state", humanState(run.status));
    write("extended-timeline-status", humanState(run.status));
    write("target-finish", utcDate(run.endAt));
    const start = utcDate(run.startAt);
    if (start) write("schedule-note", `Planned start: ${start}.`);
    write("extended-corpus", corpusLabel(run.trainCharacters));
    write("pilot-corpus", corpusLabel(run.pilotTrainCharacters));
  }
  if (report.comparison) {
    const comparison = report.comparison;
    write("comparison-status", comparison.status === "pending" ? "Comparison pending" : humanState(comparison.status));
    write("comparison-timeline-status", humanState(comparison.status));
    write("comparison-method", comparison.note);
    write("comparison-summary", comparison.summary);
    if (Array.isArray(comparison.sources) && comparison.sources.length) {
      const measuredCount = sourceResults(comparison.sources);
      if (measuredCount && !comparison.summary) write("comparison-summary", "Results are reported for each evaluation source. A negative change means the extended run used fewer bits per character on that source.");
    }
  }
  const updated = utcDate(report.updatedAt);
  if (updated) write("report-updated", `Report updated: ${updated}. Refreshes every minute while this page is visible.`);
}

let refreshInFlight = false;
let hasTrainingReport = false;
async function refreshTraining(endpoint) {
  const remote = safeUrl(endpoint && endpoint.training_status_url);
  let report;
  let useFallback = !remote;
  if (remote) {
    try { report = await readJson(remote); }
    catch (error) {
      // Never replace a successfully displayed report with a stale fallback.
      if (hasTrainingReport) throw error;
      useFallback = true;
    }
  }
  if (useFallback) report = await readJson("training-status.json");
  renderTraining(report);
  hasTrainingReport = true;
}
async function refreshPublishedData(initial = false) {
  if (refreshInFlight || (!initial && document.hidden)) return;
  refreshInFlight = true;
  try {
    const endpoint = await endpointReady;
    const requests = [refreshTraining(endpoint)];
    const catalogUrl = safeUrl(endpoint && endpoint.model_status_url);
    if (catalogUrl) requests.push(readJson(catalogUrl).then((catalog) => renderCatalog(catalog, endpoint)));
    // Independent failures leave each section's last successfully rendered data intact.
    await Promise.allSettled(requests);
  } finally { refreshInFlight = false; }
}
refreshPublishedData(true);
setInterval(() => refreshPublishedData(), 60_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshPublishedData();
});
