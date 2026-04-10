function updateIncidentData() {
  var props = PropertiesService.getScriptProperties();

  var apiUrl = _getProp_(props, "API_URL", true);
  var apiPayload = _getPayload_(props);

  var apiCookie = _getProp_(props, "API_COOKIE", false);
  var prismaToken = _getProp_(props, "PRISMA_REQUEST_VERIFICATION_TOKEN", false);
  var prismaSignal = _getProp_(props, "PRISMA_SIGNALR_ID_CONNECTION", false);
  var extraHeadersJson = _getProp_(props, "API_HEADERS_JSON", false);

  var ghToken = _getProp_(props, "GITHUB_TOKEN", true);
  var ghOwner = _getProp_(props, "GITHUB_OWNER", true);
  var ghRepo = _getProp_(props, "GITHUB_REPO", true);
  var ghBranch = _getProp_(props, "GITHUB_BRANCH", false) || "main";

  var payload = _fetchApiPayload_(apiUrl, apiPayload, apiCookie, prismaToken, prismaSignal, extraHeadersJson);
  var rows = _extractRows_(payload);
  var incidents = _normalizeIncidents_(rows);

  var generatedAt = new Date().toISOString();
  var incidentsJson = JSON.stringify({ incidents: incidents }, null, 2) + "\n";
  var generatedJson = JSON.stringify({ generated_at: generatedAt }, null, 2) + "\n";

  _upsertGitHubFile_(ghToken, ghOwner, ghRepo, ghBranch, "docs/data/incidents.json", incidentsJson, "chore(data): refresh incidents");
  _upsertGitHubFile_(ghToken, ghOwner, ghRepo, ghBranch, "docs/data/generated_at.json", generatedJson, "chore(data): refresh generated_at");

  return { ok: true, normalized: incidents.length, generated_at: generatedAt };
}

function _getProp_(props, key, required) {
  var v = props.getProperty(key);
  if (v === null || v === undefined) v = "";
  v = String(v).trim();
  if (!v && required) {
    throw new Error("Missing script property: " + key);
  }
  return v;
}

function _getPayload_(props) {
  var direct = _getProp_(props, "API_PAYLOAD", false);
  if (direct) return direct;

  var fileId = _getProp_(props, "API_PAYLOAD_FILE_ID", false);
  if (fileId) {
    try {
      return DriveApp.getFileById(fileId).getBlob().getDataAsString("UTF-8").trim();
    } catch (e) {
      throw new Error("Failed to read API payload from Drive file id. Check API_PAYLOAD_FILE_ID. " + e);
    }
  }

  var parts = [];
  for (var i = 1; i <= 20; i++) {
    var p = _getProp_(props, "API_PAYLOAD_PART_" + i, false);
    if (!p) break;
    parts.push(p);
  }
  if (parts.length) return parts.join("");

  throw new Error("Missing API payload. Set API_PAYLOAD (small), or API_PAYLOAD_FILE_ID (recommended), or API_PAYLOAD_PART_1..n.");
}

function _fetchApiPayload_(url, payload, cookie, prismaToken, prismaSignal, extraHeadersJson) {
  payload = String(payload || "").trim();
  if ((payload.startsWith('"') && payload.endsWith('"')) || (payload.startsWith("'") && payload.endsWith("'"))) {
    payload = payload.slice(1, -1).trim();
  }

  var headers = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest"
  };

  if (cookie) headers.Cookie = cookie;
  if (prismaToken) headers.__RequestVerificationToken = prismaToken;
  if (prismaSignal) headers.__signalRIdConnection = prismaSignal;

  if (extraHeadersJson) {
    var extra = JSON.parse(extraHeadersJson);
    if (extra && typeof extra === "object") {
      Object.keys(extra).forEach(function (k) {
        var v = extra[k];
        if (v === null || v === undefined) return;
        headers[String(k)] = String(v);
      });
    }
  }

  var res = UrlFetchApp.fetch(url, {
    method: "post",
    headers: headers,
    payload: payload,
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("API HTTP " + code + ": " + text.slice(0, 500));
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("API did not return JSON. First 500 chars: " + text.slice(0, 500));
  }
}

function _extractRows_(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return [];

  var candidates = ["resultData", "incidents", "data", "rows", "items", "results"];
  for (var i = 0; i < candidates.length; i++) {
    var v = payload[candidates[i]];
    if (Array.isArray(v)) return v;
  }

  return [payload];
}

function _normalizeIncidents_(rows) {
  var TEAM_MAP = {
    "CIV": "CIVIL",
    "ELE": "ELÉTRICA",
    "REF": "REFRIGERAÇÃO",
    "PIN": "PINTURA",
    "SPI": "SPCI",
    "LCO": "LIMPEZA CONVENCIONAL",
    "LTE": "LIMPEZA TÉCNICA",
    "JAR": "JARDINAGEM",
    "ELM": "UTILIDADES"
  };

  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r || typeof r !== "object") continue;

    var id = r.c0 !== undefined && r.c0 !== null ? String(r.c0) : "row-" + (i + 1);
    var openedRaw = r.c1 !== undefined && r.c1 !== null ? String(r.c1) : "";
    var openedAt = "";
    if (openedRaw) {
      var d = new Date(openedRaw);
      if (!isNaN(d.getTime())) openedAt = d.toISOString();
    }

    var rawTeamCode = r.c2 !== undefined && r.c2 !== null ? String(r.c2) : "";
    var teamName = TEAM_MAP[rawTeamCode] || rawTeamCode;

    var name = r.c3 !== undefined && r.c3 !== null ? String(r.c3) : "";
    var location = r.c6 !== undefined && r.c6 !== null ? String(r.c6) : "";

    out.push({ id: id, name: name, location: location, opened_at: openedAt, team: teamName });
  }

  out.sort(function (a, b) {
    var da = a.opened_at || "9999-99-99T99:99:99Z";
    var db = b.opened_at || "9999-99-99T99:99:99Z";
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  });

  return out;
}

function _upsertGitHubFile_(token, owner, repo, branch, path, content, message) {
  var apiBase = "https://api.github.com";
  var getUrl = apiBase + "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + path + "?ref=" + encodeURIComponent(branch);

  var commonHeaders = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  var sha = "";
  var getRes = UrlFetchApp.fetch(getUrl, { method: "get", headers: commonHeaders, muteHttpExceptions: true });
  if (getRes.getResponseCode() === 200) {
    var getJson = JSON.parse(getRes.getContentText());
    if (getJson && getJson.sha) sha = String(getJson.sha);
  }

  var putUrl = apiBase + "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + path;
  var body = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: branch
  };
  if (sha) body.sha = sha;

  var putRes = UrlFetchApp.fetch(putUrl, {
    method: "put",
    headers: Object.assign({ "Content-Type": "application/json" }, commonHeaders),
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = putRes.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("GitHub update failed (" + path + ") HTTP " + code + ": " + putRes.getContentText().slice(0, 500));
  }
}
