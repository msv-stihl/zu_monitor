import json
import os

import requests


def _read_payload() -> str:
    payload = os.environ.get("API_PAYLOAD")
    if payload and payload.strip():
        return payload

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    payload_path = os.path.join(repo_root, "scripts", "request_payload.txt")
    try:
        with open(payload_path, "r", encoding="utf-8") as f:
            payload = f.read()
    except FileNotFoundError:
        payload = ""

    payload = payload.strip()
    if not payload:
        raise RuntimeError("Missing API payload. Set API_PAYLOAD or fill scripts/request_payload.txt.")

    return payload


def _build_headers() -> dict:
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
    }

    api_token = os.environ.get("API_TOKEN")
    if api_token and api_token.strip():
        headers["Authorization"] = f"Bearer {api_token.strip()}"

    cookie = os.environ.get("API_COOKIE")
    if cookie and cookie.strip():
        headers["Cookie"] = cookie.strip()

    prisma_ver = os.environ.get("PRISMA_REQUEST_VERIFICATION_TOKEN")
    if prisma_ver and prisma_ver.strip():
        headers["__RequestVerificationToken"] = prisma_ver.strip()

    prisma_sig = os.environ.get("PRISMA_SIGNALR_ID_CONNECTION")
    if prisma_sig and prisma_sig.strip():
        headers["__signalRIdConnection"] = prisma_sig.strip()

    extra = os.environ.get("API_HEADERS_JSON")
    if extra and extra.strip():
        try:
            extra_headers = json.loads(extra)
        except json.JSONDecodeError as e:
            raise RuntimeError("API_HEADERS_JSON is not valid JSON.") from e

        if not isinstance(extra_headers, dict):
            raise RuntimeError("API_HEADERS_JSON must be a JSON object.")

        for k, v in extra_headers.items():
            if v is None:
                continue
            headers[str(k)] = str(v)

    return headers


def _resolve_url() -> str:
    full = os.environ.get("API_URL")
    if full and full.strip():
        return full.strip()

    base = os.environ.get("API_BASE_URL", "https://prisma4.manserv.com.br").strip()
    if not base:
        raise RuntimeError("Missing API_BASE_URL or API_URL.")
    return f"{base.rstrip('/')}/Prisma4/api/Search/Data"


def fetch_api_payload():
    url = _resolve_url()
    payload = _read_payload()
    headers = _build_headers()

    res = requests.post(url, data=payload.encode("utf-8"), headers=headers, timeout=60)
    res.raise_for_status()

    try:
        return res.json()
    except ValueError as e:
        raise RuntimeError("API did not return JSON.") from e
