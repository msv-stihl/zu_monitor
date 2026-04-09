import json
import os
from datetime import datetime, timezone


def _now_utc():
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_datetime(value):
    if value is None:
        return None

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            return None

    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None

        if s.isdigit():
            try:
                return datetime.fromtimestamp(float(s), tz=timezone.utc)
            except Exception:
                return None

        try:
            s2 = s.replace("Z", "+00:00")
            return datetime.fromisoformat(s2).astimezone(timezone.utc)
        except Exception:
            return None

    return None


def _pick(d: dict, keys):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


def _normalize_item(item, i):
    if not isinstance(item, dict):
        return {
            "id": f"row-{i}",
            "name": str(item),
            "location": "",
            "opened_at": "",
        }

    opened_raw = _pick(
        item,
        [
            "c1",
            "opened_at",
            "openedAt",
            "created_at",
            "createdAt",
            "created",
            "date_open",
            "dateOpen",
            "timestamp",
        ],
    )
    opened_dt = _parse_datetime(opened_raw)

    return {
        "id": str(_pick(item, ["c0", "id", "incident_id", "incidentId", "key"]) or f"row-{i}"),
        "name": str(_pick(item, ["c3", "name", "title", "incident", "summary", "description"]) or ""),
        "location": str(_pick(item, ["c6", "location", "site", "region", "area", "city"]) or ""),
        "opened_at": _iso(opened_dt) if opened_dt else "",
    }


def _extract_rows(payload):
    if payload is None:
        return []

    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        for k in ["resultData", "incidents", "data", "rows", "items", "results"]:
            v = payload.get(k)
            if isinstance(v, list):
                return v
        return [payload]

    return []


def fetch_payload():
    sample = [
        {
            "id": "sample-1",
            "name": "Sample Incident A",
            "location": "Site 01",
            "opened_at": "2026-04-09T12:00:00Z",
        },
        {
            "id": "sample-2",
            "name": "Sample Incident B",
            "location": "Site 02",
            "opened_at": "2026-04-09T12:40:00Z",
        },
    ]

    try:
        from scripts.insomnia_api_request import fetch_api_payload  # type: ignore
    except ImportError:
        return sample

    try:
        return fetch_api_payload()
    except NotImplementedError:
        return sample


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    docs_data_dir = os.path.join(repo_root, "docs", "data")
    os.makedirs(docs_data_dir, exist_ok=True)

    payload = fetch_payload()
    rows = _extract_rows(payload)

    incidents = [_normalize_item(item, i) for i, item in enumerate(rows, start=1)]
    incidents.sort(key=lambda x: x.get("opened_at") or "9999-99-99T99:99:99Z")

    incidents_path = os.path.join(docs_data_dir, "incidents.json")
    meta_path = os.path.join(docs_data_dir, "generated_at.json")

    with open(incidents_path, "w", encoding="utf-8") as f:
        json.dump({"incidents": incidents}, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"generated_at": _iso(_now_utc())}, f, ensure_ascii=False, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
