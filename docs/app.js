const DATA_URL = "./data/incidents.json";
const META_URL = "./data/generated_at.json";

const rowsEl = document.getElementById("rows");
const lastUpdatedEl = document.getElementById("lastUpdated");
const rowCountEl = document.getElementById("rowCount");
const emptyStateEl = document.getElementById("emptyState");
const errorStateEl = document.getElementById("errorState");
const refreshBtn = document.getElementById("refreshBtn");

const MAX_MINUTES = 120;

let current = [];
let tickHandle = null;

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtOpened(d) {
  if (!d) return "—";
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${dd}/${mm} ${hh}:${mi}`;
}

function fmtDuration(secondsLeft) {
  const s = Math.max(0, Math.floor(secondsLeft));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${pad2(m)}:${pad2(sec)}`;
}

function ageMinutes(openedAt, now) {
  if (!openedAt) return null;
  return (now.getTime() - openedAt.getTime()) / 60000;
}

function rowClassByAge(ageMin) {
  if (ageMin === null) return "";
  if (ageMin < 30) return "rowGreen";
  if (ageMin < 60) return "rowYellow";
  return "rowRed";
}

function buildRow(incident, now) {
  const openedAt = parseDate(incident.opened_at);
  const ageMin = ageMinutes(openedAt, now);
  const leftMin = ageMin === null ? null : Math.max(0, MAX_MINUTES - ageMin);
  const secondsLeft = leftMin === null ? 0 : leftMin * 60;

  const tr = document.createElement("tr");
  const cls = rowClassByAge(ageMin);
  if (cls) tr.className = cls;
  tr.dataset.openedAt = openedAt ? openedAt.toISOString() : "";

  const tdName = document.createElement("td");
  tdName.textContent = incident.name ?? "—";

  const tdLoc = document.createElement("td");
  tdLoc.textContent = incident.location ?? "—";

  const tdTeam = document.createElement("td");
  tdTeam.textContent = incident.team ?? "—";

  const tdOpened = document.createElement("td");
  tdOpened.textContent = fmtOpened(openedAt);

  const tdLeft = document.createElement("td");
  tdLeft.className = "colLeft";
  tdLeft.textContent = openedAt ? fmtDuration(secondsLeft) : "—";
  tdLeft.dataset.openedAt = openedAt ? openedAt.toISOString() : "";
  tdLeft.dataset.leftSeconds = String(secondsLeft);

  tr.append(tdName, tdLoc, tdTeam, tdOpened, tdLeft);
  return tr;
}

function render(incidents) {
  const now = new Date();
  rowsEl.replaceChildren();

  emptyStateEl.hidden = incidents.length !== 0;
  errorStateEl.hidden = true;
  rowCountEl.textContent = String(incidents.length);

  for (const incident of incidents) {
    rowsEl.appendChild(buildRow(incident, now));
  }

  if (tickHandle) window.clearInterval(tickHandle);
  tickHandle = window.setInterval(tick, 1000);
}

function tick() {
  const now = new Date();
  for (const tr of rowsEl.children) {
    const openedAt = parseDate(tr.dataset.openedAt);
    const ageMin = ageMinutes(openedAt, now);
    const cls = rowClassByAge(ageMin);
    tr.className = cls;

    const tdLeft = tr.querySelector("td.colLeft");
    if (!tdLeft || !openedAt) continue;

    const leftMin = Math.max(0, MAX_MINUTES - ageMin);
    tdLeft.textContent = fmtDuration(leftMin * 60);
  }
}

async function loadJson(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function refresh() {
  try {
    refreshBtn.disabled = true;
    const [data, meta] = await Promise.allSettled([loadJson(DATA_URL), loadJson(META_URL)]);

    if (meta.status === "fulfilled") {
      const updated = parseDate(meta.value.generated_at);
      lastUpdatedEl.textContent = updated ? fmtOpened(updated) : "—";
    } else {
      lastUpdatedEl.textContent = "—";
    }

    if (data.status !== "fulfilled") throw data.reason;
    const incidents = Array.isArray(data.value.incidents) ? data.value.incidents : [];

    current = incidents
      .map((x) => ({
        id: x.id ?? "",
        name: x.name ?? "",
        location: x.location ?? "",
        team: x.team ?? "",
        opened_at: x.opened_at ?? "",
      }))
      .sort((a, b) => {
        const da = parseDate(a.opened_at)?.getTime() ?? Number.POSITIVE_INFINITY;
        const db = parseDate(b.opened_at)?.getTime() ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

    render(current);
  } catch (e) {
    rowsEl.replaceChildren();
    emptyStateEl.hidden = true;
    errorStateEl.hidden = false;
    rowCountEl.textContent = "0";
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener("click", refresh);
refresh();

// Auto-refresh data every 60 seconds so the user never has to click the button
setInterval(refresh, 60000);
